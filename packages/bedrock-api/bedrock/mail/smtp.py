"""
Module:  smtp.py
Layer:   bedrock/mail
Desc:    SMTP mail provider — the default backend for a self-hosted bedrock
         application. Talks to any relay: a local postfix, a corporate
         Exchange server, or the SMTP endpoint every hosted mail service also
         offers.

         ── Where the settings live, and why they are split ──────────────────
         Connection settings come from the environment (`Config`), not from
         `app_config_settings`. That is not the §S4 default and the deviation
         is deliberate: `SMTP_PASSWORD` is a credential, and
         `app_config_settings` is rendered in an admin UI and dumped by the
         config export endpoint. `Config` already draws this line for the
         Cloudflare Images token; mail follows it.

         What *is* admin-editable is everything non-secret: which provider is
         active, the From address, the display name. Those are read through
         `db.get_config` in `bedrock.mail.service`, so an operator can change
         the sender without a deploy but cannot read the relay password out of
         a settings page.

         ── Failure behaviour ────────────────────────────────────────────────
         `send` raises on any failure, per the `MailProvider` contract. It does
         not retry. A transient relay failure is real, but retrying inside a
         request handler means holding the connection open across a backoff,
         and the platform's callers all treat a failed send as non-fatal
         anyway. Retry belongs in a queue, which is F6's job, not this one's.
"""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from loguru import logger

from bedrock.core.config import Config
from bedrock.mail.provider import MailMessage


class SmtpMailProvider:
    """Sends through an SMTP relay.

    Constructed by the provider registry on first use, so an application that
    never selects `smtp` never reads these settings.

    :param host: Relay hostname. Defaults to `SMTP_HOST`.
    :param port: Relay port. Defaults to `SMTP_PORT`, itself defaulting to 587
        (submission) — the port a modern relay wants for STARTTLS.
    :param username: SMTP AUTH user. Blank disables authentication, which is
        the normal shape for a relay on localhost.
    :param password: SMTP AUTH password.
    :param use_ssl: Connect with implicit TLS (port 465 style) rather than
        upgrading an plaintext connection.
    :param use_starttls: Upgrade the connection with STARTTLS after greeting.
        Ignored when `use_ssl` is set — the connection is already encrypted.
    :param timeout: Socket timeout in seconds. Low by default: this runs
        inside a request, and a relay that has not answered in ten seconds is
        not going to make the response fast either way.
    :raises RuntimeError: When no host is configured. This is a constructor
        failure, which the provider registry catches — the effect is that
        selecting `smtp` without `SMTP_HOST` logs an error and falls back to
        the no-op rather than 500ing a password-reset request.
    """

    def __init__(
        self,
        *,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        use_ssl: bool | None = None,
        use_starttls: bool | None = None,
        timeout: float | None = None,
    ) -> None:
        self.host = host if host is not None else Config.SMTP_HOST
        self.port = port if port is not None else Config.SMTP_PORT
        self.username = username if username is not None else Config.SMTP_USERNAME
        self.password = password if password is not None else Config.SMTP_PASSWORD
        self.use_ssl = use_ssl if use_ssl is not None else Config.SMTP_USE_SSL
        self.use_starttls = (
            use_starttls if use_starttls is not None else Config.SMTP_USE_STARTTLS
        )
        self.timeout = timeout if timeout is not None else Config.SMTP_TIMEOUT

        if not self.host:
            raise RuntimeError(
                "SMTP mail provider selected but SMTP_HOST is not set. Set it "
                "in the application's .env, or set the 'mail_provider' config "
                "key to 'console' (development) or leave it unset (no mail)."
            )

    def send(self, message: MailMessage) -> None:
        """Deliver one message through the relay.

        :param message: The message to send. `from_address` is not on it —
            the sender is deployment configuration, resolved by the caller in
            `bedrock.mail.service` and passed through the envelope below.
        :raises smtplib.SMTPException: On any relay-level failure.
        :raises OSError: On a connection or timeout failure.
        """
        from bedrock.mail.service import sender_address, sender_name

        outgoing = EmailMessage()
        outgoing["To"] = message.to
        outgoing["Subject"] = message.subject
        from_address = sender_address()
        outgoing["From"] = (
            formataddr((sender_name(), from_address)) if sender_name() else from_address
        )
        outgoing.set_content(message.text_body)
        if message.html_body:
            outgoing.add_alternative(message.html_body, subtype="html")

        with self._connect() as smtp:
            if self.username:
                smtp.login(self.username, self.password)
            smtp.send_message(outgoing)

        logger.info(
            "Mail sent via SMTP to {} (subject={!r}) through {}:{}",
            message.to, message.subject, self.host, self.port,
        )

    def _connect(self) -> smtplib.SMTP:
        """Open the relay connection, encrypted per configuration.

        :returns: A connected client, usable as a context manager.
        """
        if self.use_ssl:
            return smtplib.SMTP_SSL(
                self.host, self.port, timeout=self.timeout,
                context=ssl.create_default_context(),
            )
        smtp = smtplib.SMTP(self.host, self.port, timeout=self.timeout)
        if self.use_starttls:
            smtp.starttls(context=ssl.create_default_context())
            # RFC 3207: everything learned before the upgrade is untrusted, so
            # the capability list has to be re-fetched. smtplib does this for
            # login() but not for send_message(), and an un-refreshed EHLO is
            # how SMTPUTF8 and SIZE silently stop being offered.
            smtp.ehlo()
        return smtp
