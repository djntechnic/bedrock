"""
Module:  service.py
Layer:   bedrock/mail
Desc:    What the platform actually sends: the three transactional messages,
         each one a token, a link and a template away from the provider.

         ── Sending never raises at the caller ───────────────────────────────
         Every function here returns a bool and swallows the failure. That is
         unusual for this codebase and it is the right call for exactly one
         reason: the caller cannot act on the difference. A password-reset
         endpoint must return the same response whether the address exists,
         whether mail is configured, and whether the relay accepted the
         message — anything else turns the endpoint into an account
         enumeration oracle. Given the response is fixed, propagating the
         exception would only convert a delivery problem into a 500 that tells
         the *attacker* something the user cannot use.

         The failure is not lost: it is logged at `error` with the provider
         name, and the corresponding `auth_activity_log` row is written by the
         route regardless. An operator watching either surface sees it.

         ── Where the link points ────────────────────────────────────────────
         Links are built from `system_base_url` plus a fixed path. The paths
         are the platform's, so that every bedrock app's reset link has the
         same shape and `create-bedrock-app` can scaffold the pages that serve
         them. The host is the application's, because bedrock cannot know it.

         An unset `system_base_url` falls back to the Vite dev server's
         address, which is right for local development and obviously wrong in
         production — deliberately so. A link to `localhost` in a real
         invitation is a visible, one-config-row fix; a silently omitted link
         is a mystery.
"""
from __future__ import annotations

from urllib.parse import quote, urljoin

from loguru import logger

from bedrock.core.database import db
from bedrock.core.providers import NULL_PROVIDER
from bedrock.mail import templates
from bedrock.mail.provider import MailMessage, mail
from bedrock.services import email_token_service as tokens

#: SPA paths the tokenised links point at. Platform-owned so the shape is the
#: same in every bedrock app; the application serves them.
INVITE_PATH = "/accept-invite"
PASSWORD_RESET_PATH = "/reset-password"
VERIFY_EMAIL_PATH = "/verify-email"

#: Used when `system_base_url` is unset. The Vite dev server, because the only
#: situation in which nobody has configured a base URL is local development.
_DEFAULT_BASE_URL = "http://localhost:5173"

#: Used when `system_app_name` is unset. Generic on purpose — a made-up
#: product name in a real invitation is worse than an unbranded one.
_DEFAULT_APP_NAME = "this application"


def app_name() -> str:
    """:returns: The application's name for subject lines and body copy."""
    return str(db.get_config("system_app_name", "") or _DEFAULT_APP_NAME)


def base_url() -> str:
    """:returns: The public origin of the SPA, without a trailing slash."""
    configured = str(db.get_config("system_base_url", "") or "").strip()
    return (configured or _DEFAULT_BASE_URL).rstrip("/")


def sender_address() -> str:
    """:returns: The From address, or "" when unset.

    Blank is not an error here — a relay on localhost will happily stamp its
    own default sender. Providers that need one say so themselves.
    """
    return str(db.get_config("mail_from_address", "") or "").strip()


def sender_name() -> str:
    """:returns: The From display name, or "" for a bare address."""
    return str(db.get_config("mail_from_name", "") or "").strip()


def is_configured() -> bool:
    """:returns: Whether a real mail backend is active.

    Callers use this to decide whether to *offer* something — a "resend
    invitation" button with no relay behind it is a button that lies. It is
    not a precondition for the send functions below; those work unconfigured
    and drop the message.
    """
    return mail.is_configured()


def build_link(path: str, token: str) -> str:
    """Compose a tokenised action link.

    :param path: One of the `*_PATH` constants.
    :param token: The plaintext token, percent-encoded here. `token_urlsafe`
        output needs no escaping today, but the encoding is what keeps that
        true if the token format ever changes. `safe=""` because `quote`
        otherwise leaves `/` alone — correct for a path segment, wrong for the
        query-string value this is.
    :returns: An absolute URL.
    """
    target = urljoin(base_url() + "/", path.lstrip("/"))
    return f"{target}?token={quote(token, safe='')}"


def _deliver(message: MailMessage, *, flow: str) -> bool:
    """Hand one message to the active provider, absorbing any failure.

    :param message: The rendered message.
    :param flow: Flow name for the log line, e.g. "password_reset".
    :returns: True when the provider accepted it. False covers both a raising
        provider and the no-op having nothing to do — a caller that needs to
        tell those apart should ask `is_configured()` first.
    """
    provider_name = mail.active_name()
    try:
        mail.active().send(message)
    except Exception as exc:  # noqa: BLE001 — any provider, any transport
        logger.error(
            "Failed to send {} mail to {} via provider {!r}: {}",
            flow, message.to, provider_name, exc,
        )
        return False
    # Resolved once, above: asking `is_configured()` here would re-read the
    # config key and could disagree with the provider that just ran.
    return provider_name != NULL_PROVIDER


def send_invite(
    *,
    user_id: int,
    email: str,
    display_name: str | None,
    invited_by: str | None = None,
) -> bool:
    """Issue an invitation token and email the acceptance link.

    :param user_id: The account just created for the invitee.
    :param email: Where to send it.
    :param display_name: The invitee's display name, if the admin supplied one.
    :param invited_by: Email of the inviting admin, named in the body.
    :returns: True when the message was handed to a live provider.
    """
    issued = tokens.issue(user_id, tokens.PURPOSE_INVITE)
    message = templates.invite_message(
        to=email,
        display_name=display_name,
        app_name=app_name(),
        action_url=build_link(INVITE_PATH, issued.token),
        expires_in=issued.expires_in,
        invited_by=invited_by,
    )
    return _deliver(message, flow="invite")


def send_password_reset(
    *,
    user_id: int,
    email: str,
    display_name: str | None,
) -> bool:
    """Issue a reset token and email the reset link.

    :returns: True when the message was handed to a live provider.
    """
    issued = tokens.issue(user_id, tokens.PURPOSE_PASSWORD_RESET)
    message = templates.password_reset_message(
        to=email,
        display_name=display_name,
        app_name=app_name(),
        action_url=build_link(PASSWORD_RESET_PATH, issued.token),
        expires_in=issued.expires_in,
    )
    return _deliver(message, flow="password_reset")


def send_email_verification(
    *,
    user_id: int,
    email: str,
    display_name: str | None,
) -> bool:
    """Issue a verification token and email the confirmation link.

    :returns: True when the message was handed to a live provider.
    """
    issued = tokens.issue(user_id, tokens.PURPOSE_EMAIL_VERIFICATION)
    message = templates.verification_message(
        to=email,
        display_name=display_name,
        app_name=app_name(),
        action_url=build_link(VERIFY_EMAIL_PATH, issued.token),
        expires_in=issued.expires_in,
    )
    return _deliver(message, flow="email_verification")
