"""
Package: bedrock.mail
Desc:    Transactional email for a bedrock application.

         Importing this package registers the two backends bedrock ships
         (`smtp`, `console`) and nothing else — no connection is opened and no
         config is read until something actually sends, because the provider
         registry instantiates lazily.

         The public surface is small on purpose:

             from bedrock.mail import mail, send_password_reset

             mail.register("postmark", PostmarkProvider)   # an app's backend
             send_password_reset(user_id=..., email=..., display_name=...)

         Everything under `templates` and `smtp` is reachable but is
         implementation: a caller that reaches past `service` into `templates`
         is composing a message the platform does not send, which is a sign it
         belongs in the application.
"""
from bedrock.mail.provider import (
    ConsoleMailProvider,
    MAIL_PROVIDER_KEY,
    MailMessage,
    MailProvider,
    NullMailProvider,
    mail,
)
from bedrock.mail.service import (
    build_link,
    is_configured,
    send_email_verification,
    send_invite,
    send_password_reset,
)

__all__ = [
    "ConsoleMailProvider",
    "MAIL_PROVIDER_KEY",
    "MailMessage",
    "MailProvider",
    "NullMailProvider",
    "build_link",
    "is_configured",
    "mail",
    "send_email_verification",
    "send_invite",
    "send_password_reset",
]
