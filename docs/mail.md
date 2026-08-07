# Email delivery

bedrock sends three transactional messages: an **invitation**, a **password
reset**, and an **email verification**. Everything else about mail — marketing,
digests, notifications — belongs to the application.

An application with no mail configured boots, serves, and answers all three
endpoints. Nothing here is required to run bedrock; it is required for the
users of your application to be anyone other than you.

---

## Turning it on

Two halves, split on whether the value is a secret.

**Non-secret settings live in `app_config_settings`**, editable from the admin
console without a deploy:

| Key | Default | What it is |
| --- | --- | --- |
| `mail_provider` | `null` | Which backend serves. `smtp`, `console`, `null`, or one your app registered. |
| `mail_from_address` | — | The From address. |
| `mail_from_name` | — | Display name on the From header. |
| `system_app_name` | *"this application"* | Named in subject lines and body copy. |
| `system_base_url` | `http://localhost:5173` | Public origin of the SPA. Links are built from it. |
| `auth_password_reset_ttl_minutes` | `60` | Reset link lifetime. |
| `auth_invite_ttl_hours` | `168` | Invitation lifetime. |
| `auth_email_verification_ttl_hours` | `48` | Verification link lifetime. |
| `rate_limit_password_reset` | `5/hour` | Per-IP cap on the endpoints that send mail. |

**Credentials live in the environment**, in the application's `.env`:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=postmaster@example.com
SMTP_PASSWORD=...
SMTP_USE_STARTTLS=true    # default; use SMTP_USE_SSL=true on port 465 instead
SMTP_TIMEOUT=10
```

`SMTP_PASSWORD` is not in `app_config_settings` on purpose: that table is
rendered in an admin UI and returned by the config export endpoint. The
Cloudflare Images token already drew this line and mail follows it.

Set `mail_provider` to `smtp` and mail is on. Nothing else is needed.

> **`system_base_url` matters more than it looks.** Every link in every message
> is built from it. Left unset, a production invitation tells the recipient to
> visit `localhost`.

---

## The backends

| Name | What it does |
| --- | --- |
| `smtp` | Talks to a relay. The default for a self-hosted app; every hosted mail service also offers an SMTP endpoint. |
| `console` | Writes the whole message, body included, to the log. **Development only** — a reset link in a log file is a reset link anyone with the log can use. |
| `null` | Drops the message and logs the recipient. What you get with nothing configured. |

Adding another is the provider convention, unchanged
([`extension_points.md`](extension_points.md)):

```python
from bedrock.mail import mail, MailMessage

class PostmarkProvider:
    def send(self, message: MailMessage) -> None:
        ...   # raise on failure; do not swallow

mail.register("postmark", PostmarkProvider)
```

Register it from a module `main.py` imports for side effect, then set
`mail_provider` to `postmark`. A provider must **raise** on a delivery failure —
swallowing one turns "the relay rejected it" into "sent" in the log.

---

## The flows

### Invitation

`POST /api/v1/admin/users/invite` creates the account and emails a link to
choose a password. Before F1 it created an account and stopped, which meant
"invite" was really "an admin now reads the password out over some other
channel".

The response `message` states whether the mail went out, because an admin who
believes an email was sent and is wrong will wait for a reply that never comes.
`send_email: false` skips it, for service accounts nobody reads mail for.

### Password reset

```
POST /api/v1/auth/password-reset/request    { "email": "..." }        → 202
POST /api/v1/auth/password-reset/complete   { "token", "new_password" } → 204
```

The request endpoint returns **202 for every input** — registered, unregistered,
deactivated, and mail-not-configured alike. A 404 for an unknown address turns
the reset form into a way to test whether a given person has an account here.

Completion also accepts an **invitation** token, because setting a first
password and resetting a forgotten one are the same action by someone who
proved control of the address. It marks the address verified for the same
reason, and **revokes every live session** — a JWT the attacker already holds
is valid for seven days and knows nothing about the password.

### Email verification

```
POST /api/v1/auth/verify-email/request                  → 202   (authenticated)
POST /api/v1/auth/verify-email/confirm   { "token" }    → 204   (anonymous)
```

Requesting is authenticated and takes no recipient — it can only send to the
address already on the account, so it cannot be pointed at a third party.
Confirming is anonymous, because the link is opened from a mail client that may
not be the browser holding the session.

---

## Tokens

One table, `auth_email_tokens`, holds all three kinds.

- **Only the SHA-256 is stored.** A database read must not yield a working
  reset link. A fast hash is correct here — the token is 256 bits of CSPRNG
  output, so there is no dictionary to run and a slow KDF would only force a
  scan of every outstanding token instead of one indexed lookup.
- **Single use, enforced by the database.** Redemption is
  `UPDATE … WHERE consumed_at IS NULL` and believes the row count, so two
  simultaneous redemptions cannot both succeed.
- **Issuing supersedes.** A second reset request kills the first link, rather
  than leaving every link a user ever requested live in their inbox.
- **Rejection is undifferentiated.** Expired, spent, unknown and wrong-purpose
  all return the same message. Which one it was is exactly what an attacker
  probing tokens wants told.

`purge_expired()` removes spent rows; nothing schedules it yet, because bedrock
has no job runner until F6. Call it from your application's maintenance task,
or leave it — the table is small and not load-bearing.

---

## The pages the links land on

`@djntechnic/bedrock-ui` ships the three pages, and the paths are **fixed by the
platform** — `bedrock.mail.service` builds every link from the same constants,
so an app that mounts them elsewhere breaks links already sitting in inboxes,
where no deploy can reach them. Wire the router to `AUTH_FLOW_PATHS`:

```tsx
import {
  AUTH_FLOW_PATHS,
  ForgotPasswordPage,
  SetPasswordPage,
  VerifyEmailPage,
} from "@djntechnic/bedrock-ui";

<Route path={AUTH_FLOW_PATHS.forgotPassword} element={<ForgotPasswordPage />} />
<Route path={AUTH_FLOW_PATHS.resetPassword} element={<SetPasswordPage mode="reset" />} />
<Route path={AUTH_FLOW_PATHS.acceptInvite} element={<SetPasswordPage mode="invite" />} />
<Route path={AUTH_FLOW_PATHS.verifyEmail} element={<VerifyEmailPage />} />
```

All four are **anonymous** — outside `<ProtectedRoute>`, and they must stay
there. Someone who has forgotten their password cannot be asked to sign in
first, an invited user has no password to sign in with, and a verification link
is opened from a mail client that may not be the browser holding the session.

`SetPasswordPage` is one component for two routes because the backend serves
both from one endpoint; `mode` changes only the wording. It validates length and
confirmation locally before posting, so a typo does not spend a rate-limit slot.

Add the entry point to your own login form:

```tsx
<Link to={AUTH_FLOW_PATHS.forgotPassword}>Forgot your password?</Link>
```

bedrock does not ship the login page — it is the one auth surface an app almost
always restyles — so this link is the app's to place.

---

## What is not here yet

- **Retry.** A failed send is logged and dropped. Retrying inside a request
  handler means holding the connection open across a backoff; retry belongs in
  a queue, which is F6.
- **Template overrides.** The three messages are functions. An application that
  wants different copy writes its own sender today. A registry with one possible
  registration is the failure mode `extension_points.md` exists to prevent —
  when a *second* application needs different wording, that is the signal.
