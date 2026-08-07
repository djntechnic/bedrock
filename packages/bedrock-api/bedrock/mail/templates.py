"""
Module:  templates.py
Layer:   bedrock/mail
Desc:    The three transactional messages the platform sends: an invitation, a
         password reset, and an email-verification request.

         ── Why these are functions and not files ────────────────────────────
         A template engine, a template directory and a template-override
         registry are all things this will plausibly want one day. None of them
         are things it needs to send three fixed messages, and a registry with
         one possible registration is the "pile of hooks" failure mode
         `docs/extension_points.md` exists to prevent. Each message is a
         function returning a fully-rendered `MailMessage`; an app that wants
         different copy today can write its own sender. When a *second*
         application actually needs different wording, that is the signal to
         add the seam, and the signature below is what it will hang off.

         ── Both body forms, always ──────────────────────────────────────────
         Every message renders plain text and HTML. The plain-text body is not
         a fallback afterthought: it carries the same URL as a bare line, so a
         client that strips HTML, a terminal mail reader, and a spam filter
         scoring the text part all see a working link. HTML interpolation goes
         through `html.escape` — a display name is user-supplied, and it is the
         one value in these templates that an attacker controls.
"""
from __future__ import annotations

import html

from bedrock.mail.provider import MailMessage

#: Shown when a user has no display name set. Not "there" or a bare comma —
#: transactional mail addressed to nobody reads as a phishing attempt.
_FALLBACK_GREETING = "Hello"


def _greeting(display_name: str | None) -> str:
    """:returns: `Hi <name>` when a name is known, a neutral greeting otherwise."""
    name = (display_name or "").strip()
    return f"Hi {name}" if name else _FALLBACK_GREETING


def _wrap_html(app_name: str, heading: str, paragraphs: list[str],
               action_label: str, action_url: str, footer: str) -> str:
    """Render the one HTML shell every platform message uses.

    Inline styles and a table-free single column: transactional mail is read in
    clients with no stylesheet support and no flexbox, and the plain-text part
    is what carries the message if this renders as nothing at all.

    :param app_name: Application name, shown as the header.
    :param heading: First line of the body.
    :param paragraphs: Body copy, already plain text; escaped here.
    :param action_label: Button text.
    :param action_url: Button target. Not escaped as text — placed in an
        `href`, so it is quoted and escaped as an attribute value.
    :param footer: Small print below the button.
    :returns: A complete HTML document.
    """
    body = "".join(
        f'<p style="margin:0 0 16px;line-height:1.5">{html.escape(p)}</p>'
        for p in paragraphs
    )
    safe_url = html.escape(action_url, quote=True)
    return (
        '<!DOCTYPE html><html><body style="margin:0;padding:24px;'
        'font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1a1a1a">'
        '<div style="max-width:520px;margin:0 auto">'
        f'<p style="margin:0 0 24px;font-size:14px;color:#666">'
        f'{html.escape(app_name)}</p>'
        f'<h1 style="margin:0 0 16px;font-size:20px">{html.escape(heading)}</h1>'
        f'{body}'
        f'<p style="margin:24px 0"><a href="{safe_url}" '
        'style="display:inline-block;padding:10px 20px;background:#1a1a1a;'
        'color:#fff;text-decoration:none;border-radius:6px">'
        f'{html.escape(action_label)}</a></p>'
        '<p style="margin:0 0 8px;font-size:13px;color:#666">'
        'If the button does not work, paste this link into your browser:</p>'
        f'<p style="margin:0 0 24px;font-size:13px;word-break:break-all">'
        f'<a href="{safe_url}" style="color:#0645ad">{html.escape(action_url)}</a></p>'
        f'<p style="margin:0;font-size:13px;color:#666">{html.escape(footer)}</p>'
        '</div></body></html>'
    )


def _text(greeting: str, paragraphs: list[str], action_label: str,
          action_url: str, footer: str) -> str:
    """Render the plain-text body, with the URL on its own unwrapped line."""
    parts = [greeting + ",", ""]
    parts.extend(p + "\n" for p in paragraphs)
    parts.append(f"{action_label}:")
    parts.append(action_url)
    parts.append("")
    parts.append(footer)
    return "\n".join(parts)


def invite_message(
    *, to: str, display_name: str | None, app_name: str, action_url: str,
    expires_in: str, invited_by: str | None = None,
) -> MailMessage:
    """The message an admin's invitation sends.

    The link sets a password, which is what makes an invite usable: before
    this, `POST /admin/users/invite` created an account the invitee had no way
    to reach.

    :param to: Recipient address.
    :param display_name: Recipient's display name, if the admin supplied one.
    :param app_name: Application name, for the subject line and header.
    :param action_url: The password-setting link, token included.
    :param expires_in: Human-readable validity window, e.g. "7 days".
    :param invited_by: Email of the inviting admin. Included when known —
        an unsolicited account creation is much easier to trust when it names
        the person who did it.
    """
    who = f" by {invited_by}" if invited_by else ""
    paragraphs = [
        f"You have been invited{who} to {app_name}. "
        "Choose a password to activate your account.",
        f"This invitation expires in {expires_in}.",
    ]
    footer = "If you were not expecting this invitation, you can ignore this email."
    return MailMessage(
        to=to,
        subject=f"You have been invited to {app_name}",
        text_body=_text(_greeting(display_name), paragraphs,
                        "Set your password", action_url, footer),
        html_body=_wrap_html(app_name, f"Welcome to {app_name}", paragraphs,
                             "Set your password", action_url, footer),
    )


def password_reset_message(
    *, to: str, display_name: str | None, app_name: str, action_url: str,
    expires_in: str,
) -> MailMessage:
    """The message a password-reset request sends.

    :param to: Recipient address.
    :param display_name: Recipient's display name, if set.
    :param app_name: Application name.
    :param action_url: The reset link, token included.
    :param expires_in: Human-readable validity window, e.g. "60 minutes".
    """
    paragraphs = [
        f"Someone requested a password reset for your {app_name} account.",
        f"This link expires in {expires_in} and can only be used once.",
    ]
    footer = (
        "If you did not request this, no action is needed — your password has "
        "not changed."
    )
    return MailMessage(
        to=to,
        subject=f"Reset your {app_name} password",
        text_body=_text(_greeting(display_name), paragraphs,
                        "Reset your password", action_url, footer),
        html_body=_wrap_html(app_name, "Reset your password", paragraphs,
                             "Reset your password", action_url, footer),
    )


def verification_message(
    *, to: str, display_name: str | None, app_name: str, action_url: str,
    expires_in: str,
) -> MailMessage:
    """The message an email-verification request sends.

    :param to: Recipient address.
    :param display_name: Recipient's display name, if set.
    :param app_name: Application name.
    :param action_url: The confirmation link, token included.
    :param expires_in: Human-readable validity window, e.g. "48 hours".
    """
    paragraphs = [
        f"Confirm this address to finish setting up your {app_name} account.",
        f"This link expires in {expires_in}.",
    ]
    footer = "If you did not create this account, you can ignore this email."
    return MailMessage(
        to=to,
        subject=f"Confirm your email address for {app_name}",
        text_body=_text(_greeting(display_name), paragraphs,
                        "Confirm your email", action_url, footer),
        html_body=_wrap_html(app_name, "Confirm your email address", paragraphs,
                             "Confirm your email", action_url, footer),
    )
