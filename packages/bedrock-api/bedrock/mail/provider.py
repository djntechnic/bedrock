"""
Module:  provider.py
Layer:   bedrock/mail
Desc:    The mail capability: what a mail backend has to do, the no-op used
         when none is configured, and the `ProviderRegistry` that picks one.

         This is the first capability declared under the provider convention
         (`bedrock.core.providers`), and it is the reason that convention
         exists. Sending mail has several plausible backends — an SMTP relay,
         a hosted API, nothing at all — the choice between them is deployment
         configuration rather than code, and an application that has
         configured none of them still has to boot and serve pages. Exactly
         one backend wins, so this is a provider and not a registry.

         **Nothing configured is a supported state.** `mail_provider` unset
         resolves to `NullMailProvider`, which drops the message and logs it.
         Every caller in the platform is written so that dropping is survivable
         — a password-reset request still returns 204, because the response
         must not reveal whether the address exists, let alone whether the mail
         went out. `is_configured()` is there for callers that want to skip
         work entirely rather than address a letter to nowhere.

         **Two backends ship here** because neither needs any application
         knowledge:

           `smtp`     — a relay, the right default for a self-hosted app.
           `console`  — renders the message to the log instead of sending it.
                        Not a joke provider: it is how you read a password
                        reset link in local development without standing up a
                        mail server, and it is the honest way to say "mail is
                        on, delivery is not" in a demo environment.

         An application registers its own the same way it registers anything
         else — `mail.register("postmark", ...)` from a module imported for
         side effect at startup. Nothing here needs to change for that.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from loguru import logger

from bedrock.core.providers import ProviderRegistry

#: `app_config_settings` key naming the active backend. Category-prefixed per
#: the key-naming standard in `core.config_constants`, which is why the
#: capability owns a `mail` category rather than borrowing `system`.
MAIL_PROVIDER_KEY = "mail_provider"


@dataclass(frozen=True)
class MailMessage:
    """One outbound message.

    Deliberately minimal: a recipient, a subject, and both body forms. There
    is no cc, bcc, reply-to, attachment or template id, because the platform
    sends exactly three kinds of transactional mail and none of them need one.
    Adding a field later is additive for every provider that ignores it;
    guessing at fields now would force every provider to implement a surface
    nothing calls.

    :param to: A single recipient address. Platform mail is transactional and
        addressed to one person; a provider is free to accept more, but the
        platform never asks it to, which keeps "who received this" answerable
        from the audit log.
    :param subject: Subject line, already localised and interpolated.
    :param text_body: Plain-text body. Always present — a message that only
        renders as HTML is a message some clients cannot read.
    :param html_body: Optional HTML alternative.
    """

    to: str
    subject: str
    text_body: str
    html_body: str | None = None


@runtime_checkable
class MailProvider(Protocol):
    """What the platform requires of a mail backend.

    One method. A provider that needs setup does it in its constructor, which
    the registry calls lazily on first use, so opening a connection at
    registration time is not a thing a provider can accidentally do.
    """

    def send(self, message: MailMessage) -> None:
        """Deliver `message`, or raise.

        Raising is the correct response to a failure — the caller decides
        whether the failure is fatal, and for every platform caller it is not.
        A provider must not swallow a delivery failure and return normally,
        because that turns "the relay rejected it" into "sent" in the log.
        """
        ...


class NullMailProvider:
    """Drops every message, loudly enough to notice.

    The fallback the registry uses when `mail_provider` is unset or names
    something unregistered. It logs at `info` rather than `warning`: for a
    self-hosted app with no relay this is the intended configuration, not a
    fault, and a warning per password-reset attempt would be noise. The
    recipient and subject are logged, the body is not — dropping a message is
    not a reason to write a reset link to a log file.
    """

    def send(self, message: MailMessage) -> None:
        logger.info(
            "mail not configured; dropping message to {} (subject={!r}). "
            "Set the {!r} config key to enable delivery.",
            message.to, message.subject, MAIL_PROVIDER_KEY,
        )


class ConsoleMailProvider:
    """Writes the full message to the log instead of sending it.

    For local development and demo deployments. Unlike `NullMailProvider` this
    logs the body, which is the entire point — it is how a developer reads the
    password-reset link without running a mail server.

    That also makes it unsafe for production: a reset link in a log file is a
    reset link anyone with the log can use. The warning below says so on every
    send rather than once, because the risk is per-message.
    """

    def send(self, message: MailMessage) -> None:
        logger.warning(
            "console mail provider — message NOT sent, body written to the log. "
            "Do not use in production.\n"
            "To: {}\nSubject: {}\n\n{}",
            message.to, message.subject, message.text_body,
        )


def _smtp_provider() -> MailProvider:
    """Build the SMTP provider.

    Imported inside the factory so that `smtplib` and the SMTP settings are
    only touched by a deployment that actually selects this backend.
    """
    from bedrock.mail.smtp import SmtpMailProvider

    return SmtpMailProvider()


#: The mail capability. Module-level and owned by the platform: applications
#: call `register` on this object, they never construct their own.
mail: ProviderRegistry[MailProvider] = ProviderRegistry(
    capability="mail",
    config_key=MAIL_PROVIDER_KEY,
    fallback=NullMailProvider,
)

mail.register("console", ConsoleMailProvider)
mail.register("smtp", _smtp_provider)
