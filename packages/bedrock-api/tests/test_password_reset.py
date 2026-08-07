"""
Module:  test_password_reset.py
Layer:   bedrock-api/tests
Desc:    The four F1 endpoints end to end — reset request/complete, email
         verification request/confirm — plus the invitation email now attached
         to `POST /admin/users/invite`.

         Two properties get more attention here than the happy path, because
         both are the kind that regress silently:

         **The response never reveals whether an account exists.** A 404 on an
         unknown address turns the reset form into a membership oracle. The
         tests assert the *identical* status for known, unknown, and inactive.

         **A reset ends existing sessions.** Rotating a password does nothing
         to a JWT already in an attacker's hands — it is valid for seven days
         and carries no password material. Without the revocation, "I reset my
         password" and "they are locked out" are different statements.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from bedrock.core.providers import NULL_PROVIDER
from bedrock.mail.provider import ConsoleMailProvider, MailMessage, mail
from bedrock.services import email_token_service as tokens
from bedrock.services import user_service as us
from conftest import build_app  # noqa: E402 — conftest's dir is on sys.path

PASSWORD = "correct horse battery staple"
NEW_PASSWORD = "a different long password"


@pytest.fixture(scope="module")
def client(platform_db) -> TestClient:
    return TestClient(build_app())


class Recorder:
    """Captures outbound mail so a test can read the link out of it."""

    def __init__(self) -> None:
        self.sent: list[MailMessage] = []

    def send(self, message: MailMessage) -> None:
        self.sent.append(message)

    def last_token(self) -> str:
        """:returns: The token from the most recent message's link."""
        assert self.sent, "no mail was sent"
        for line in self.sent[-1].text_body.splitlines():
            if "token=" in line:
                return line.split("token=", 1)[1].strip()
        raise AssertionError("no tokenised link in the message body")


@pytest.fixture
def outbox(monkeypatch):
    """Mail configured and captured, restoring the shipped registry after."""
    from bedrock.core import database

    recorder = Recorder()
    mail.register("recorder", lambda: recorder)
    real = database.db.get_config
    monkeypatch.setattr(
        database.db, "get_config",
        lambda key, default=None: (
            "recorder" if key == "mail_provider" else real(key, default)
        ),
    )
    yield recorder
    mail.reset_for_tests()
    mail.register("console", ConsoleMailProvider)
    from bedrock.mail.provider import _smtp_provider

    mail.register("smtp", _smtp_provider)


@pytest.fixture
def unconfigured_mail(monkeypatch):
    """Mail explicitly off, which is the default an app starts in."""
    from bedrock.core import database

    real = database.db.get_config
    monkeypatch.setattr(
        database.db, "get_config",
        lambda key, default=None: (
            NULL_PROVIDER if key == "mail_provider" else real(key, default)
        ),
    )


@pytest.fixture
def user(platform_db):
    return us.create_user(
        email=f"reset-{uuid.uuid4().hex[:12]}@example.com",
        password=PASSWORD,
        display_name="Dana",
        default_role="collector",
    )


def _login(client: TestClient, email: str, password: str):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


class TestResetRequestIsOpaque:
    """Same response for every input — that is the feature."""

    def test_known_address_is_accepted(self, client, user, outbox):
        response = client.post(
            "/api/v1/auth/password-reset/request", json={"email": user.email}
        )
        assert response.status_code == 202

    def test_unknown_address_is_also_accepted(self, client, outbox):
        response = client.post(
            "/api/v1/auth/password-reset/request",
            json={"email": "nobody-at-all@example.com"},
        )
        assert response.status_code == 202

    def test_inactive_account_is_also_accepted(self, client, user, outbox):
        us.set_active(user.user_id, False)
        response = client.post(
            "/api/v1/auth/password-reset/request", json={"email": user.email}
        )
        assert response.status_code == 202

    def test_no_mail_goes_to_an_unknown_address(self, client, outbox):
        client.post(
            "/api/v1/auth/password-reset/request",
            json={"email": "nobody-at-all@example.com"},
        )
        assert outbox.sent == []

    def test_no_mail_goes_to_an_inactive_account(self, client, user, outbox):
        us.set_active(user.user_id, False)
        client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
        assert outbox.sent == []

    def test_a_malformed_address_is_still_rejected(self, client, outbox):
        """Opacity is about existence, not about accepting nonsense."""
        response = client.post(
            "/api/v1/auth/password-reset/request", json={"email": "not-an-email"}
        )
        assert response.status_code == 422

    def test_it_works_with_no_mail_provider(self, client, user, unconfigured_mail):
        """An app that has configured nothing must still answer this endpoint."""
        response = client.post(
            "/api/v1/auth/password-reset/request", json={"email": user.email}
        )
        assert response.status_code == 202


class TestResetCompletion:
    def test_the_link_sets_a_new_password(self, client, user, outbox):
        client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
        response = client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": outbox.last_token(), "new_password": NEW_PASSWORD},
        )
        assert response.status_code == 204
        assert _login(client, user.email, NEW_PASSWORD).status_code == 200

    def test_the_old_password_stops_working(self, client, user, outbox):
        client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
        client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": outbox.last_token(), "new_password": NEW_PASSWORD},
        )
        assert _login(client, user.email, PASSWORD).status_code == 401

    def test_existing_sessions_are_revoked(self, client, user, outbox):
        """The point of a reset: a token the attacker already holds must die."""
        token = _login(client, user.email, PASSWORD).json()["access_token"]
        assert client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code == 200

        client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
        client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": outbox.last_token(), "new_password": NEW_PASSWORD},
        )
        assert client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code == 401

    def test_the_link_works_once(self, client, user, outbox):
        client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
        reset_token = outbox.last_token()
        client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": reset_token, "new_password": NEW_PASSWORD},
        )
        response = client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": reset_token, "new_password": "yet another password"},
        )
        assert response.status_code == 400

    @pytest.mark.parametrize("bad_token", ["nope", "x" * 100])
    def test_an_invalid_token_is_rejected(self, client, bad_token):
        response = client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": bad_token, "new_password": NEW_PASSWORD},
        )
        assert response.status_code == 400

    def test_the_rejection_says_nothing_useful(self, client):
        """Expired, spent and never-existed must be indistinguishable."""
        response = client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": "nope", "new_password": NEW_PASSWORD},
        )
        assert response.json()["detail"] == (
            "This link is invalid or has expired. Request a new one."
        )

    def test_a_short_password_is_rejected(self, client, user, outbox):
        client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
        response = client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": outbox.last_token(), "new_password": "short"},
        )
        assert response.status_code == 422

    def test_completing_a_reset_verifies_the_address(self, client, user, outbox):
        """Receiving the link is the same proof verification asks for."""
        assert user.is_verified is False
        client.post("/api/v1/auth/password-reset/request", json={"email": user.email})
        client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": outbox.last_token(), "new_password": NEW_PASSWORD},
        )
        refreshed = us.get_user_by_id(user.user_id)
        assert refreshed.is_verified is True

    def test_a_verification_token_is_not_a_reset_token(self, client, user):
        """Cross-purpose replay is the vulnerability this endpoint invites."""
        issued = tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
        response = client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": issued.token, "new_password": NEW_PASSWORD},
        )
        assert response.status_code == 400
        assert _login(client, user.email, PASSWORD).status_code == 200


class TestEmailVerification:
    def test_the_link_verifies_the_address(self, client, user, outbox):
        token = _login(client, user.email, PASSWORD).json()["access_token"]
        assert client.post(
            "/api/v1/auth/verify-email/request",
            headers={"Authorization": f"Bearer {token}"},
        ).status_code == 202

        assert client.post(
            "/api/v1/auth/verify-email/confirm",
            json={"token": outbox.last_token()},
        ).status_code == 204
        assert us.get_user_by_id(user.user_id).is_verified is True

    def test_requesting_requires_a_session(self, client, outbox):
        """No recipient parameter and no anonymous access — so it cannot be
        pointed at a third party's inbox."""
        assert client.post("/api/v1/auth/verify-email/request").status_code == 401

    def test_an_already_verified_account_sends_nothing(self, client, user, outbox):
        us.set_verified(user.user_id, True)
        token = _login(client, user.email, PASSWORD).json()["access_token"]
        response = client.post(
            "/api/v1/auth/verify-email/request",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 202
        assert outbox.sent == []

    def test_confirming_needs_no_session(self, client, user, outbox):
        """The link is opened from a mail client, not necessarily the browser
        holding the session."""
        issued = tokens.issue(user.user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
        assert client.post(
            "/api/v1/auth/verify-email/confirm", json={"token": issued.token}
        ).status_code == 204

    def test_an_invalid_token_is_rejected(self, client):
        assert client.post(
            "/api/v1/auth/verify-email/confirm", json={"token": "nope"}
        ).status_code == 400

    def test_a_reset_token_is_not_a_verification_token(self, client, user):
        issued = tokens.issue(user.user_id, tokens.PURPOSE_PASSWORD_RESET)
        assert client.post(
            "/api/v1/auth/verify-email/confirm", json={"token": issued.token}
        ).status_code == 400


class TestInviteEmail:
    """`POST /admin/users/invite` created an account nobody could reach."""

    @pytest.fixture
    def admin_headers(self, platform_db, client):
        admin = us.create_user(
            email=f"admin-{uuid.uuid4().hex[:12]}@example.com",
            password=PASSWORD, default_role="admin",
        )
        token = _login(client, admin.email, PASSWORD).json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_an_invite_sends_mail(self, client, admin_headers, outbox):
        invitee = f"invitee-{uuid.uuid4().hex[:12]}@example.com"
        response = client.post(
            "/api/v1/admin/users/invite", json={"email": invitee},
            headers=admin_headers,
        )
        assert response.status_code == 201
        assert outbox.sent[-1].to == invitee

    def test_the_invitee_can_set_their_password(self, client, admin_headers, outbox):
        """The whole feature: an invitation the recipient can act on."""
        invitee = f"invitee-{uuid.uuid4().hex[:12]}@example.com"
        client.post("/api/v1/admin/users/invite", json={"email": invitee},
                    headers=admin_headers)
        assert client.post(
            "/api/v1/auth/password-reset/complete",
            json={"token": outbox.last_token(), "new_password": NEW_PASSWORD},
        ).status_code == 204
        assert _login(client, invitee, NEW_PASSWORD).status_code == 200

    def test_the_response_says_the_mail_was_sent(self, client, admin_headers, outbox):
        response = client.post(
            "/api/v1/admin/users/invite",
            json={"email": f"invitee-{uuid.uuid4().hex[:12]}@example.com"},
            headers=admin_headers,
        )
        assert "Invitation sent" in response.json()["message"]

    def test_send_email_false_skips_the_mail(self, client, admin_headers, outbox):
        response = client.post(
            "/api/v1/admin/users/invite",
            json={"email": f"invitee-{uuid.uuid4().hex[:12]}@example.com",
                  "send_email": False},
            headers=admin_headers,
        )
        assert response.status_code == 201
        assert outbox.sent == []
        assert "No invitation email" in response.json()["message"]

    def test_an_unsendable_invite_says_so(self, client, admin_headers, unconfigured_mail):
        """An admin who believes an email went out and is wrong waits forever."""
        response = client.post(
            "/api/v1/admin/users/invite",
            json={"email": f"invitee-{uuid.uuid4().hex[:12]}@example.com"},
            headers=admin_headers,
        )
        assert response.status_code == 201
        assert "was not sent" in response.json()["message"]

    def test_a_duplicate_invite_still_conflicts(self, client, admin_headers, outbox):
        invitee = f"invitee-{uuid.uuid4().hex[:12]}@example.com"
        client.post("/api/v1/admin/users/invite", json={"email": invitee},
                    headers=admin_headers)
        response = client.post("/api/v1/admin/users/invite", json={"email": invitee},
                               headers=admin_headers)
        assert response.status_code == 409
