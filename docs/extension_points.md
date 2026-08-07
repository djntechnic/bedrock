# Extension points

bedrock holds no business domain. Everywhere it needs application knowledge it
exposes an extension point and the host application supplies the answer.

There are exactly **two kinds**, and picking the wrong one is the mistake this
document exists to prevent. Before adding an extension point, decide which
question it answers:

| | **Registry** | **Provider** |
| --- | --- | --- |
| Answers | *"What else should the platform include?"* | *"Who does this?"* |
| How many win | all of them | exactly one |
| Chosen by | code — the app registers what it wants | configuration — a row in `app_config_settings` |
| Changing it | needs a deploy | needs a settings edit |
| Nothing registered | the platform does less | the platform uses a no-op |
| Example | health counters, nav items, diagnostic checks | mail, media storage, error reporting |

A useful test: **if two implementations could sensibly be active at once, it is
a registry.** Three health counters all run. Two SMTP servers do not both send
the email.

---

## Kind 1 — Registries (additive)

A registry collects contributions and uses all of them. This is the older and
more common kind; seven of them exist today.

### The convention

A registry lives in its own module, holds module-level state, and exposes three
functions:

```python
_counters: dict[str, Callable[[], int]] = {}

def register_health_counter(name: str, fn: Callable[[], int]) -> None: ...
def registered_counter_names() -> tuple[str, ...]: ...
def __clear_health_counters() -> None: ...
```

- **`register_*`** — the app calls this. Re-registering a name **overwrites**,
  which is what keeps repeated imports (tests, reloaders) idempotent.
- **`registered_*`** — the reader. Named for the *contents*, not the verb, so
  `registered_counter_names()` rather than `get_counters()`.
- **`__clear_*`** — test helper. Module scope only; see the note on providers
  below for why the method form has to be spelled differently.
- A **collector** (`collect_health_counters`, `build_app_config`) where the
  platform consumes the registrations.

Ordering, where it matters, follows registration order — dicts preserve
insertion order, so the payload key order is stable across restarts.

### Failure policy is per-registry and deliberate

This is the part that cannot be made uniform, and should not be:

- `collect_health_counters` **swallows and logs** a raising counter. A health
  endpoint that 500s because one optional count broke is worse than one
  reporting a null.
- `build_app_config` **propagates**. A missing config section means the
  frontend boots misconfigured, which is worse than a clear 500 at startup.

Write the choice, and the reason, in the module docstring. Both of the above do.

### The registries today

Backend:

| Extension point | Supplies |
| --- | --- |
| `core.app_config_sections.register_app_config_section` | boot-payload sections |
| `core.health_metrics.register_health_counter` | health endpoint counts |
| `core.db_health.register_canonical_tables` | tables whose emptiness means a wiped DB |
| `core.diagnostics_registry.register_diagnostic_check` | data-quality checks |
| `core.schema_drift.register_schema_objects` | the app's half of the schema |
| `core.database.register_current_season_resolver` | the app's current period |
| `core.config_constants.APP_CATEGORY_MODULE` | app config categories (dotted path) |
| `core.migrations.APP_MIGRATION_MODULE` | inline schema migrations (dotted path) |

Frontend:

| Extension point | Supplies |
| --- | --- |
| `grids/cellRegistry.registerMediaRenderer` | `cell_type` → renderer needing the whole row |
| `grids/cellRegistry.registerColumnRenderer` | `column_id` → renderer |
| `grids/rowAccentRegistry.registerRowAccentResolver` | row → accent colour |
| `navRegistry.registerNavItems` | the primary navigation tree |
| `searchSourceRegistry.registerSearchSource` | command-palette result groups |

Two of these are **dotted-path** rather than function registration
(`APP_CATEGORY_MODULE`, `APP_MIGRATION_MODULE`). That is not a third kind — it
is the same additive contract resolved by import at a point too early in
startup for a function call to have happened yet. Prefer function registration
unless you genuinely need it before `main.py` runs.

### Unregistered keys must degrade, never throw

`cell_type` and the config-category list are read from admin-editable database
rows, so a value no build has ever heard of can arrive at runtime. Resolving an
unknown key returns `undefined`/falls through to plain text. An admin typing
into a settings field must not be able to crash a page.

---

## Kind 2 — Providers (config-selected)

A provider is a swappable *implementation* of a capability where exactly one
wins and the choice is deployment configuration. `bedrock.core.providers`
implements this.

### Declaring a capability

The platform module that owns the capability declares one registry at module
scope, parameterised on a `Protocol` describing what it calls:

```python
class MailProvider(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...

class NullMailProvider:
    def send(self, to: str, subject: str, body: str) -> None:
        logger.info(f"mail not configured; dropping message to {to!r}")

mail = ProviderRegistry[MailProvider](
    capability="mail",
    config_key="mail_provider",
    fallback=NullMailProvider,
)
```

### Registering and using

The app registers at startup — an import for side effect from `main.py`,
exactly like a registry:

```python
mail.register("smtp", lambda: SmtpMailProvider(host=..., port=...))
```

Platform code asks for the winner without knowing the field:

```python
if mail.is_configured():
    mail.active().send(to=user.email, subject=..., body=...)
```

### Guarantees

- **`active()` never returns `None` and never raises on account of
  configuration.** Unset, blank, or unknown all fall back to the no-op. The
  selecting value lives in an admin-editable table, so a typo must not halt the
  process — the same reasoning as unknown `cell_type` on the frontend.
- **Unknown names log once**, not once per call, so a misconfigured hot path
  does not flood the log. The message names the config key and the registered
  alternatives, so it is actionable without reading source.
- **Instantiation is lazy, cached, and thread-safe.** The factory runs on first
  use, so registration cannot trigger a config read before the database exists,
  and eight concurrent first callers share one instance.
- **A raising factory falls back and is retried**, not cached. A broken backend
  is logged at `error` — it is a defect, not a configuration choice — but must
  not permanently become "the feature is off" because of one network blip.
- **The active choice is re-read, not frozen.** `db.get_config` caches with a
  TTL and `set_config` evicts, so flipping a provider in the admin UI takes
  effect without a restart and costs no extra query on the hot path.
- **`is_configured()`** lets callers skip work that only makes sense with a live
  backend — not offering an upload button with nowhere to put the file.

### `reset_for_tests()`, not `__clear_*`

Registries spell their test helper `__clear_health_counters`. A `ProviderRegistry`
cannot: a double-underscore *method* is name-mangled to
`_ProviderRegistry__clear_providers`, which is unusable from a test. The role is
identical; only the spelling differs, and only because Python forces it.

---

## Adding a new extension point

1. Decide the kind from the table at the top. If two implementations could be
   active at once, it is a registry.
2. Put it in its own module under `bedrock/core/`, or next to the capability it
   serves.
3. Write the docstring first, and say in it **what happens when the app
   registers nothing** and **what happens when a contribution fails**. Both
   have real answers here and neither is guessable from the signature.
4. Ship a test that the platform works with nothing registered. That property —
   not the happy path — is what makes the package reusable rather than
   MLBTracker with the names filed off.
5. Add a row to the tables above.
