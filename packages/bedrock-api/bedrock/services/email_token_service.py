"""
Module:  email_token_service.py
Layer:   bedrock/services
Desc:    Single-use, expiring tokens for the three flows that prove control of
         an email address: accepting an invitation, resetting a password, and
         verifying an address.

         ── The token is never stored ────────────────────────────────────────
         Only SHA-256 of it is. A password-reset token is a bearer credential
         that grants account takeover, so a database read — a backup on a
         laptop, a stray `SELECT *` in a support session, a SQL injection in
         some unrelated app table — must not yield a working reset link.

         SHA-256 rather than bcrypt, deliberately, and this is the one place
         where the fast hash is the right call: the token is 256 bits from
         `secrets.token_urlsafe`, so there is no dictionary to run and a slow
         KDF defends against nothing. What the fast hash buys is a single
         indexed lookup by `token_hash` — bcrypt would force a scan of every
         outstanding token, comparing each one, which is both slower and a
         timing oracle for how many are outstanding.

         ── Single use is enforced by the database, not by a check ───────────
         `consume` claims a token with `UPDATE … WHERE consumed_at IS NULL` and
         believes the row count. Two requests arriving with the same token at
         the same instant both pass a `SELECT`-then-check; only one of them
         gets `rowcount == 1`.

         ── Issuing invalidates the outstanding ones ─────────────────────────
         Requesting a second reset expires the first. The alternative leaves
         every link a user ever requested live until its own expiry, which
         turns "I clicked reset twice" into a widening window of valid
         credentials sitting in an inbox.
"""
from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from loguru import logger

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T

#: An admin created the account; the token lets the invitee set a password.
PURPOSE_INVITE = "invite"
#: The user asked to reset a forgotten password.
PURPOSE_PASSWORD_RESET = "password_reset"
#: The user is confirming they control the address on their account.
PURPOSE_EMAIL_VERIFICATION = "email_verification"

#: Every purpose the service will issue or accept. A token is only ever valid
#: for the purpose it was issued under: an email-verification link must not be
#: replayable as a password reset, which is what `consume(purpose=...)` checks.
PURPOSES: frozenset[str] = frozenset({
    PURPOSE_INVITE,
    PURPOSE_PASSWORD_RESET,
    PURPOSE_EMAIL_VERIFICATION,
})

#: Config key and default TTL, per purpose. Admin-editable — an operator
#: shortening the reset window is a policy decision, not a deploy.
_TTL_SETTINGS: dict[str, tuple[str, int]] = {
    PURPOSE_INVITE: ("auth_invite_ttl_hours", 168),                 # 7 days
    PURPOSE_PASSWORD_RESET: ("auth_password_reset_ttl_minutes", 60),
    PURPOSE_EMAIL_VERIFICATION: ("auth_email_verification_ttl_hours", 48),
}

#: Multiplier converting each purpose's configured unit to seconds. Reset is
#: configured in minutes and the other two in hours because that is how an
#: operator thinks about them; a single unit would make one of the three
#: settings read as an absurd number.
_TTL_UNIT_SECONDS: dict[str, int] = {
    PURPOSE_INVITE: 3600,
    PURPOSE_PASSWORD_RESET: 60,
    PURPOSE_EMAIL_VERIFICATION: 3600,
}

#: Bytes of entropy per token. 32 → a 43-character URL-safe string.
_TOKEN_BYTES = 32


@dataclass(frozen=True)
class IssuedToken:
    """A freshly minted token and when it stops working.

    :param token: The plaintext token. This is the only moment it exists —
        it goes straight into a URL and is never persisted or logged.
    :param expires_at: UTC expiry, `YYYY-MM-DD HH:MM:SS`, matching the format
        `auth_sessions.expires_at` already uses.
    :param expires_in: Human-readable window for the email body, e.g.
        "60 minutes". Computed here so the template does not have to know
        which unit this purpose is configured in.
    """

    token: str
    expires_at: str
    expires_in: str


def _hash(token: str) -> str:
    """:returns: Lowercase hex SHA-256 of `token` — what the table stores."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    """:returns: The current time, UTC and timezone-aware."""
    return datetime.now(timezone.utc)


def _format(moment: datetime) -> str:
    """:returns: `moment` as the space-separated UTC string the schema stores."""
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _parse(stored: str) -> datetime | None:
    """Read a stored timestamp back as an aware UTC datetime.

    Tolerates the ISO `T` separator and a trailing `Z` as well as the format
    this module writes, because SQLite stores whatever it was handed and a
    column written by a migration or by hand may not match.

    :returns: The parsed instant, or None when the value is unreadable — which
        callers treat as expired, since a token whose expiry cannot be read is
        not a token anyone should honour.
    """
    text = (stored or "").strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _ttl_seconds(purpose: str, *, database: DatabaseManager | None = None) -> int:
    """Resolve this purpose's configured lifetime.

    :param purpose: One of `PURPOSES`.
    :returns: Lifetime in seconds. A non-positive or unparseable configured
        value falls back to the default rather than issuing a token that is
        already expired.
    """
    d = database or db
    key, default = _TTL_SETTINGS[purpose]
    try:
        configured = int(d.get_config(key, default))
    except (TypeError, ValueError):
        logger.warning(
            "Config {!r} is not an integer; using the default of {}.", key, default
        )
        configured = default
    if configured <= 0:
        logger.warning(
            "Config {!r} is {}; a token lifetime must be positive, using {}.",
            key, configured, default,
        )
        configured = default
    return configured * _TTL_UNIT_SECONDS[purpose]


def _describe(seconds: int) -> str:
    """Render a lifetime the way an email should say it.

    :param seconds: Lifetime in seconds.
    :returns: e.g. "60 minutes", "48 hours", "7 days".
    """
    if seconds % 86400 == 0 and seconds >= 86400:
        days = seconds // 86400
        return f"{days} day" if days == 1 else f"{days} days"
    if seconds % 3600 == 0 and seconds >= 3600:
        hours = seconds // 3600
        return f"{hours} hour" if hours == 1 else f"{hours} hours"
    minutes = max(1, seconds // 60)
    return f"{minutes} minute" if minutes == 1 else f"{minutes} minutes"


def issue(
    user_id: int,
    purpose: str,
    *,
    database: DatabaseManager | None = None,
) -> IssuedToken:
    """Mint a token for `user_id`, invalidating any outstanding ones.

    :param user_id: The account the token acts on.
    :param purpose: One of `PURPOSES`.
    :param database: Override the default manager (tests).
    :returns: The plaintext token and its expiry. Store nothing from this
        beyond putting the token in a URL.
    :raises ValueError: When `purpose` is not a known purpose. Unlike the
        admin-editable values elsewhere in the platform this one is a code
        constant, so a bad value is a bug and should fail loudly.
    """
    if purpose not in PURPOSES:
        raise ValueError(f"unknown token purpose: {purpose!r}")
    d = database or db

    revoke_outstanding(user_id, purpose, database=d)

    ttl = _ttl_seconds(purpose, database=d)
    token = secrets.token_urlsafe(_TOKEN_BYTES)
    expires_at = _format(_now() + timedelta(seconds=ttl))
    d.execute(
        f"""
        INSERT INTO {T.AUTH_EMAIL_TOKENS} (user_id, purpose, token_hash, expires_at)
        VALUES (%s, %s, %s, %s)
        """,
        (user_id, purpose, _hash(token), expires_at),
    )
    logger.info(
        "Issued {} token for user_id={} expiring {}", purpose, user_id, expires_at
    )
    return IssuedToken(token=token, expires_at=expires_at, expires_in=_describe(ttl))


def revoke_outstanding(
    user_id: int,
    purpose: str,
    *,
    database: DatabaseManager | None = None,
) -> int:
    """Consume every live token this user holds for `purpose`.

    Marked consumed rather than deleted so the row remains as evidence that a
    link was superseded — the audit trail for "why did my first reset email
    stop working" lives in this table.

    :returns: How many were invalidated.
    """
    d = database or db
    return d.execute(
        f"""
        UPDATE {T.AUTH_EMAIL_TOKENS}
           SET consumed_at = %s
         WHERE user_id = %s AND purpose = %s AND consumed_at IS NULL
        """,
        (_format(_now()), user_id, purpose),
    )


def consume(
    token: str,
    purpose: str | tuple[str, ...],
    *,
    database: DatabaseManager | None = None,
) -> int | None:
    """Redeem `token`, returning the user it belongs to.

    A token is spent by this call whether or not the caller's subsequent work
    succeeds. That is the safe direction: a reset whose password update fails
    leaves the user requesting a fresh link, whereas the reverse leaves a
    used link working.

    :param token: The plaintext token from the URL.
    :param purpose: The purpose(s) the caller will accept. A tuple is allowed
        because setting an initial password from an invitation and resetting a
        forgotten one are the same endpoint doing the same thing.
    :param database: Override the default manager (tests).
    :returns: The `user_id`, or None when the token is unknown, expired,
        already used, or issued for a different purpose. The caller gets one
        undifferentiated failure on purpose: telling a caller *which* of those
        it was tells an attacker whether a guessed token ever existed.
    """
    accepted = (purpose,) if isinstance(purpose, str) else tuple(purpose)
    d = database or db
    if not token:
        return None

    token_hash = _hash(token)
    df = d.query(
        f"""
        SELECT token_id, user_id, purpose, expires_at, consumed_at
          FROM {T.AUTH_EMAIL_TOKENS}
         WHERE token_hash = %s
         LIMIT 1
        """,
        (token_hash,),
    )
    if df.empty:
        logger.info("Rejected {} token: no such token", "/".join(accepted))
        return None

    row = df.iloc[0].to_dict()
    if row.get("purpose") not in accepted:
        logger.warning(
            "Rejected token issued for {!r} presented as {!r} (user_id={})",
            row.get("purpose"), "/".join(accepted), row.get("user_id"),
        )
        return None
    if row.get("consumed_at") is not None:
        logger.info("Rejected token: already consumed (user_id={})", row.get("user_id"))
        return None
    expires_at = _parse(str(row.get("expires_at") or ""))
    if expires_at is None or expires_at <= _now():
        logger.info("Rejected token: expired (user_id={})", row.get("user_id"))
        return None

    # The claim. Two concurrent redemptions of one token both reach here; the
    # `consumed_at IS NULL` guard means exactly one of them updates a row.
    claimed = d.execute(
        f"""
        UPDATE {T.AUTH_EMAIL_TOKENS}
           SET consumed_at = %s
         WHERE token_id = %s AND consumed_at IS NULL
        """,
        (_format(_now()), int(row["token_id"])),
    )
    if claimed != 1:
        logger.warning(
            "Rejected token: lost the race to claim it (user_id={})", row.get("user_id")
        )
        return None
    return int(row["user_id"])


def purge_expired(
    *,
    older_than_days: int = 30,
    database: DatabaseManager | None = None,
) -> int:
    """Delete spent and long-expired rows.

    Nothing calls this on a schedule yet — bedrock has no job runner until F6 —
    so it exists to be called from an application's own maintenance task. The
    table is not load-bearing once a token is spent; retention beyond a month
    buys no forensic value that `auth_activity_log` does not already hold.

    :param older_than_days: Only remove rows that expired at least this long
        ago, so a token that failed five minutes ago is still explainable.
    :returns: Rows deleted.
    """
    d = database or db
    cutoff = _format(_now() - timedelta(days=max(0, older_than_days)))
    return d.execute(
        f"DELETE FROM {T.AUTH_EMAIL_TOKENS} WHERE expires_at < %s", (cutoff,)
    )
