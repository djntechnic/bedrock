"""
Module:  test_mail.py
Layer:   bedrock-api/tests
Desc:    The mail capability: provider selection, the SMTP backend, template
         rendering, and the link/sender resolution in between.

         The property most of these tests are really defending is that **an
         application with no mail configured still works**. That is what makes
         the package reusable, and it is the case a happy-path test never
         touches — so it is asserted first and repeatedly.
"""
from __future__ import annotations

import smtplib
from email.message import EmailMessage

import pytest

from bedrock.core.providers import NULL_PROVIDER
from bedrock.mail import service as mailer
from bedrock.mail import templates
from bedrock.mail.provider import (
    ConsoleMailProvider, MailMessage, MailProvider, NullMailProvider, mail,
)
from bedrock.mail.smtp import SmtpMailProvider


@pytest.fixture
def config(monkeypatch):
    """A settable `db.get_config`, shared by everything that reads config here.

    Yields the backing dict so a test can write a key and see the effect
    immediately — the real `get_config` caches with a TTL, which would make
    "set it then assert" flaky for reasons that have nothing to do with mail.
    """
    from bedrock.core import database

    values: dict[str, object] = {}

    def fake_get_config(key, default=None):
        return values.get(key, default)

    monkeypatch.setattr(database.db, "get_config", fake_get_config)
    yield values


@pytest.fixture
def registry(config):
    """The real `mail` registry, restored to its shipped state afterwards.

    Tests register throwaway providers on the module-level singleton, so the
    teardown re-registers the two bedrock ships. Without it the second test
    file to touch mail would run against whatever the first one left behind.
    """
    yield mail
    mail.reset_for_tests()
    mail.register("console", ConsoleMailProvider)
    from bedrock.mail.provider import _smtp_provider

    mail.register("smtp", _smtp_provider)


class Recorder:
    """A provider that keeps what it was given."""

    def __init__(self) -> None:
        self.sent: list[MailMessage] = []

    def send(self, message: MailMessage) -> None:
        self.sent.append(message)


class Exploder:
    """A provider whose send always fails."""

    def send(self, message: MailMessage) -> None:
        raise RuntimeError("relay refused the connection")


class TestUnconfigured:
    """Nothing configured is a supported state, not a broken one."""

    def test_falls_back_to_null(self, registry, config):
        assert registry.active_name() == NULL_PROVIDER
        assert isinstance(registry.active(), NullMailProvider)

    def test_is_configured_is_false(self, registry, config):
        assert mailer.is_configured() is False

    def test_null_provider_swallows_the_message(self, registry, config):
        NullMailProvider().send(
            MailMessage(to="a@example.com", subject="s", text_body="b")
        )  # must not raise

    def test_sending_reports_failure_without_raising(self, registry, config, monkeypatch):
        """The whole point: a send with no backend is survivable."""
        monkeypatch.setattr(mailer.tokens, "issue", _fake_issue)
        assert mailer.send_password_reset(
            user_id=1, email="a@example.com", display_name=None
        ) is False


class TestSelection:
    def test_console_is_registered_out_of_the_box(self, registry):
        assert "console" in registry.registered_names()

    def test_smtp_is_registered_out_of_the_box(self, registry):
        assert "smtp" in registry.registered_names()

    def test_config_selects_the_provider(self, registry, config):
        recorder = Recorder()
        registry.register("recorder", lambda: recorder)
        config["mail_provider"] = "recorder"
        assert registry.active_name() == "recorder"
        assert registry.active() is recorder

    def test_unknown_provider_degrades(self, registry, config):
        config["mail_provider"] = "carrier-pigeon"
        assert registry.active_name() == NULL_PROVIDER
        assert mailer.is_configured() is False

    def test_console_provider_satisfies_the_protocol(self):
        assert isinstance(ConsoleMailProvider(), MailProvider)

    def test_null_provider_satisfies_the_protocol(self):
        assert isinstance(NullMailProvider(), MailProvider)


def _fake_issue(user_id, purpose, **_kwargs):
    """Stand-in for the token service — these tests are about mail, not tokens."""
    from bedrock.services.email_token_service import IssuedToken

    return IssuedToken(
        token="test-token", expires_at="2099-01-01 00:00:00", expires_in="60 minutes"
    )


class TestSending:
    @pytest.fixture(autouse=True)
    def _stub_tokens(self, monkeypatch):
        monkeypatch.setattr(mailer.tokens, "issue", _fake_issue)

    @pytest.fixture
    def recorder(self, registry, config):
        rec = Recorder()
        registry.register("recorder", lambda: rec)
        config["mail_provider"] = "recorder"
        return rec

    def test_password_reset_is_delivered(self, recorder, config):
        assert mailer.send_password_reset(
            user_id=7, email="user@example.com", display_name="Dana"
        ) is True
        assert len(recorder.sent) == 1
        assert recorder.sent[0].to == "user@example.com"

    def test_invite_is_delivered(self, recorder, config):
        assert mailer.send_invite(
            user_id=7, email="user@example.com", display_name=None,
            invited_by="admin@example.com",
        ) is True
        assert "admin@example.com" in recorder.sent[0].text_body

    def test_verification_is_delivered(self, recorder, config):
        assert mailer.send_email_verification(
            user_id=7, email="user@example.com", display_name=None
        ) is True
        assert len(recorder.sent) == 1

    def test_a_raising_provider_is_absorbed(self, registry, config):
        """A dead relay must not 500 the request that triggered the send."""
        registry.register("exploder", Exploder)
        config["mail_provider"] = "exploder"
        assert mailer.send_password_reset(
            user_id=7, email="user@example.com", display_name=None
        ) is False

    def test_the_link_carries_the_token(self, recorder, config):
        config["system_base_url"] = "https://example.com"
        mailer.send_password_reset(user_id=7, email="u@example.com", display_name=None)
        assert (
            "https://example.com/reset-password?token=test-token"
            in recorder.sent[0].text_body
        )


class TestLinkBuilding:
    def test_base_url_defaults_to_the_dev_server(self, config):
        assert mailer.base_url() == "http://localhost:5173"

    def test_trailing_slash_does_not_double(self, config):
        config["system_base_url"] = "https://example.com/"
        assert mailer.build_link("/reset-password", "abc") == (
            "https://example.com/reset-password?token=abc"
        )

    def test_token_is_percent_encoded(self, config):
        config["system_base_url"] = "https://example.com"
        assert mailer.build_link("/verify-email", "a b/c") == (
            "https://example.com/verify-email?token=a%20b%2Fc"
        )

    def test_app_name_falls_back(self, config):
        assert mailer.app_name() == "this application"

    def test_app_name_is_configurable(self, config):
        config["system_app_name"] = "RynoGuy"
        assert mailer.app_name() == "RynoGuy"

    def test_sender_is_blank_when_unset(self, config):
        assert mailer.sender_address() == ""
        assert mailer.sender_name() == ""


class TestTemplates:
    """Rendering, escaping, and the properties that make a message readable."""

    @pytest.mark.parametrize(
        "render",
        [
            templates.invite_message,
            templates.password_reset_message,
            templates.verification_message,
        ],
    )
    def test_every_message_has_both_bodies(self, render):
        message = render(
            to="u@example.com", display_name="Dana", app_name="Bedrock",
            action_url="https://example.com/x?token=abc", expires_in="60 minutes",
        )
        assert message.text_body
        assert message.html_body

    @pytest.mark.parametrize(
        "render",
        [
            templates.invite_message,
            templates.password_reset_message,
            templates.verification_message,
        ],
    )
    def test_the_url_appears_in_both_bodies(self, render):
        url = "https://example.com/x?token=abc"
        message = render(
            to="u@example.com", display_name=None, app_name="Bedrock",
            action_url=url, expires_in="60 minutes",
        )
        assert url in message.text_body
        assert url in message.html_body

    def test_the_plain_text_url_is_on_its_own_line(self):
        """A wrapped URL is a broken URL in a plain-text mail client."""
        url = "https://example.com/reset-password?token=abc"
        message = templates.password_reset_message(
            to="u@example.com", display_name=None, app_name="Bedrock",
            action_url=url, expires_in="60 minutes",
        )
        assert url in message.text_body.splitlines()

    def test_display_name_is_escaped_in_html(self):
        """A display name is user-supplied and lands inside HTML."""
        message = templates.password_reset_message(
            to="u@example.com", display_name="<script>alert(1)</script>",
            app_name="Bedrock", action_url="https://example.com/x", expires_in="1 hour",
        )
        assert "<script>" not in message.html_body

    def test_app_name_is_escaped_in_html(self):
        message = templates.password_reset_message(
            to="u@example.com", display_name=None, app_name="<b>App</b>",
            action_url="https://example.com/x", expires_in="1 hour",
        )
        assert "<b>App</b>" not in message.html_body

    def test_a_missing_display_name_still_greets(self):
        message = templates.password_reset_message(
            to="u@example.com", display_name=None, app_name="Bedrock",
            action_url="https://example.com/x", expires_in="1 hour",
        )
        assert message.text_body.startswith("Hello,")

    def test_a_blank_display_name_is_treated_as_missing(self):
        message = templates.password_reset_message(
            to="u@example.com", display_name="   ", app_name="Bedrock",
            action_url="https://example.com/x", expires_in="1 hour",
        )
        assert message.text_body.startswith("Hello,")

    def test_expiry_is_stated(self):
        message = templates.password_reset_message(
            to="u@example.com", display_name=None, app_name="Bedrock",
            action_url="https://example.com/x", expires_in="17 minutes",
        )
        assert "17 minutes" in message.text_body

    def test_invite_without_an_inviter_omits_the_clause(self):
        message = templates.invite_message(
            to="u@example.com", display_name=None, app_name="Bedrock",
            action_url="https://example.com/x", expires_in="7 days",
        )
        assert " by " not in message.text_body


class FakeSMTP:
    """Records what an SMTP provider would have done to a real relay."""

    instances: list["FakeSMTP"] = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host, self.port, self.timeout = host, port, timeout
        self.started_tls = False
        self.ehlo_count = 0
        self.login_args: tuple[str, str] | None = None
        self.sent: list[EmailMessage] = []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        self.started_tls = True

    def ehlo(self):
        self.ehlo_count += 1

    def login(self, username, password):
        self.login_args = (username, password)

    def send_message(self, message):
        self.sent.append(message)


class TestSmtpProvider:
    @pytest.fixture(autouse=True)
    def _clear(self, config):
        FakeSMTP.instances.clear()

    @pytest.fixture
    def provider(self, monkeypatch):
        monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
        monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
        return SmtpMailProvider(
            host="relay.example.com", port=587, username="", password="",
            use_ssl=False, use_starttls=True, timeout=5,
        )

    def test_no_host_refuses_to_construct(self):
        """Better a constructor failure the registry catches than a 500 later."""
        with pytest.raises(RuntimeError, match="SMTP_HOST"):
            SmtpMailProvider(host="")

    def test_sends_through_the_relay(self, provider, config):
        provider.send(MailMessage(to="u@example.com", subject="Hi", text_body="Body"))
        assert len(FakeSMTP.instances) == 1
        assert FakeSMTP.instances[0].sent[0]["To"] == "u@example.com"

    def test_starttls_is_used_and_ehlo_reissued(self, provider, config):
        provider.send(MailMessage(to="u@example.com", subject="Hi", text_body="Body"))
        conn = FakeSMTP.instances[0]
        assert conn.started_tls is True
        # RFC 3207 — capabilities learned before the upgrade are untrusted.
        assert conn.ehlo_count == 1

    def test_ssl_mode_does_not_starttls(self, monkeypatch, config):
        monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
        monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
        provider = SmtpMailProvider(
            host="relay.example.com", port=465, use_ssl=True, use_starttls=True,
        )
        provider.send(MailMessage(to="u@example.com", subject="Hi", text_body="B"))
        assert FakeSMTP.instances[0].started_tls is False

    def test_blank_username_skips_auth(self, provider, config):
        provider.send(MailMessage(to="u@example.com", subject="Hi", text_body="B"))
        assert FakeSMTP.instances[0].login_args is None

    def test_credentials_are_used_when_present(self, monkeypatch, config):
        monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
        provider = SmtpMailProvider(
            host="relay.example.com", username="postmaster", password="hunter2",
            use_ssl=False, use_starttls=False,
        )
        provider.send(MailMessage(to="u@example.com", subject="Hi", text_body="B"))
        assert FakeSMTP.instances[0].login_args == ("postmaster", "hunter2")

    def test_from_address_comes_from_config(self, provider, config):
        config["mail_from_address"] = "noreply@example.com"
        provider.send(MailMessage(to="u@example.com", subject="Hi", text_body="B"))
        assert FakeSMTP.instances[0].sent[0]["From"] == "noreply@example.com"

    def test_from_name_is_included_when_set(self, provider, config):
        config["mail_from_address"] = "noreply@example.com"
        config["mail_from_name"] = "Bedrock"
        provider.send(MailMessage(to="u@example.com", subject="Hi", text_body="B"))
        assert FakeSMTP.instances[0].sent[0]["From"] == "Bedrock <noreply@example.com>"

    def test_html_is_attached_as_an_alternative(self, provider, config):
        provider.send(MailMessage(
            to="u@example.com", subject="Hi", text_body="plain",
            html_body="<p>rich</p>",
        ))
        sent = FakeSMTP.instances[0].sent[0]
        assert sent.is_multipart()
        assert {p.get_content_type() for p in sent.iter_parts()} == {
            "text/plain", "text/html"
        }

    def test_relay_failure_propagates(self, monkeypatch, config):
        """The provider contract: raise. Swallowing turns a bounce into "sent"."""
        class Failing(FakeSMTP):
            def send_message(self, message):
                raise smtplib.SMTPRecipientsRefused({})

        monkeypatch.setattr(smtplib, "SMTP", Failing)
        provider = SmtpMailProvider(host="relay.example.com", use_starttls=False)
        with pytest.raises(smtplib.SMTPRecipientsRefused):
            provider.send(MailMessage(to="u@example.com", subject="H", text_body="B"))
