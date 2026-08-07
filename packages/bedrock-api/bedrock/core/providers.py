"""
Module:  providers.py
Layer:   bedrock/core
Desc:    The second kind of extension point: swappable *implementations* of a
         platform capability, chosen by configuration at runtime.

         Bedrock already has a settled convention for the first kind. Seven
         registries — health counters, diagnostic checks, app-config sections,
         canonical tables, schema objects, the current-season resolver, and the
         frontend's cell/row-accent/nav/search equivalents — all answer the
         question *"what else should the platform include?"*. Every
         registration under that convention is additive: the platform collects
         them and runs all of them.

         Providers answer a different question — *"who does this?"* — and
         exactly one answer wins. Sending mail, storing an uploaded file and
         reporting an unhandled error each have several plausible backends; the
         choice between them is deployment configuration rather than code; and
         an application that has configured none of them still has to boot.
         Forcing that shape into the additive registry convention would mean
         every caller picking a winner out of a list, which is how three call
         sites end up picking differently.

         So a capability owner declares one `ProviderRegistry` at module scope,
         naming the config key that selects the active implementation and the
         no-op used when nothing is configured:

             mail = ProviderRegistry[MailProvider](
                 capability="mail",
                 config_key="mail_provider",
                 fallback=NullMailProvider,
             )

         The application registers implementations at startup, exactly as it
         registers anything else — an import for side effect from `main.py`:

             mail.register("smtp", lambda: SmtpMailProvider(...))

         and platform code asks for the winner without knowing the field:

             mail.active().send(to=..., subject=..., body=...)

         Three properties are deliberate:

         **Unconfigured degrades, it does not raise.** `cloudflare_images.py`
         set this precedent with `is_configured()`, and it is the right one: a
         self-hosted app with no SMTP server should start and serve pages, not
         refuse to boot. An unresolvable provider name falls back and logs
         rather than raising, for the same reason `cell_type` falls through to
         plain text on the frontend — the selecting value lives in an
         admin-editable table, so any name at all can arrive at runtime and a
         typo must not take the process down.

         **Instantiation is lazy and cached.** A provider typically opens a
         connection or reads credentials, so the factory runs on first use, not
         at registration. That also means registration order and database
         readiness are independent: registering a provider at import time
         cannot trigger a config read before the database exists.

         **The active choice is re-read, not frozen.** `db.get_config` already
         caches with a TTL and `db.set_config` evicts, so flipping a provider
         in the admin UI takes effect without a restart while costing no extra
         query on the hot path.
"""
from __future__ import annotations

import threading
from typing import Callable, Generic, TypeVar

from loguru import logger

#: The implementation type a registry hands out. Capability owners are expected
#: to parameterise on a `typing.Protocol` describing the methods they call.
P = TypeVar("P")

#: The reserved name of the fallback implementation. An application may
#: override it — registering "null" replaces the built-in no-op — but it is
#: always resolvable, which is what lets `active()` promise a non-None return.
NULL_PROVIDER = "null"


class ProviderRegistry(Generic[P]):
    """One swappable capability: many registered implementations, one active.

    Instances are module-level singletons owned by the platform module that
    declares the capability. Applications never construct one; they call
    :meth:`register` on the one the platform exposes.
    """

    def __init__(
        self,
        capability: str,
        config_key: str,
        fallback: Callable[[], P],
        *,
        default: str = NULL_PROVIDER,
    ) -> None:
        """Declare a capability.

        :param capability: Human-readable name, used only in log messages.
        :param config_key: `app_config_settings` key naming the active
            implementation. Read through `db.get_config`, so it participates in
            the normal config cache and admin editing surface.
        :param fallback: Zero-argument factory for the no-op implementation
            used when nothing is configured or the configured name is unknown.
            Must not raise and must not need a database.
        :param default: Implementation name used when `config_key` is unset.
            Defaults to the no-op, so an app that configures nothing works.
        """
        self.capability = capability
        self.config_key = config_key
        self.default = default
        self._factories: dict[str, Callable[[], P]] = {NULL_PROVIDER: fallback}
        self._instances: dict[str, P] = {}
        self._lock = threading.Lock()
        #: Names already warned about, so an unknown config value logs once
        #: rather than on every call through a hot path.
        self._warned: set[str] = set()

    def register(self, name: str, factory: Callable[[], P]) -> None:
        """Register an implementation of this capability.

        Re-registering a name overwrites and drops any cached instance, which
        keeps repeated imports idempotent and lets a test swap an
        implementation without leaking the previous one.

        :param name: Value that selects this implementation via `config_key`.
        :param factory: Zero-argument callable returning the implementation.
            Called at most once, on first use.
        """
        with self._lock:
            self._factories[name] = factory
            self._instances.pop(name, None)

    def registered_names(self) -> tuple[str, ...]:
        """:returns: Every selectable implementation name, `null` included."""
        with self._lock:
            return tuple(self._factories)

    def active_name(self) -> str:
        """Resolve which implementation should serve, without building it.

        :returns: A name that is guaranteed to be registered — the configured
            one when it resolves, otherwise `NULL_PROVIDER`.
        """
        configured = self._configured_name()
        known = ""
        with self._lock:
            if configured in self._factories:
                return configured
            unknown = configured not in self._warned
            if unknown:
                self._warned.add(configured)
                known = ", ".join(sorted(self._factories))
        if unknown:
            # Not an exception: `config_key` is admin-editable, so a typo would
            # otherwise turn a settings page into a way to halt the process.
            logger.warning(
                f"{self.capability}: no provider named {configured!r} is "
                f"registered (known: {known}); falling back to "
                f"{NULL_PROVIDER!r}. Set {self.config_key!r} to a known name."
            )
        return NULL_PROVIDER

    def active(self) -> P:
        """Return the implementation that should serve this call.

        Never returns None and never raises on account of configuration: an
        unknown or unset name degrades to the no-op. A factory that raises is
        the exception — that is a broken implementation rather than a
        misconfiguration, and it is reported as such after falling back, so a
        dead SMTP client cannot silently become "mail is off".

        :returns: The active implementation, instantiated on first use.
        """
        name = self.active_name()
        instance = self._instantiate(name)
        if instance is not None:
            return instance
        # The configured provider's factory blew up. Fall back so the caller
        # still gets an object, but do not cache the failure under its own
        # name — a transient cause (a network hiccup reading credentials)
        # should be retried on the next call.
        fallback = self._instantiate(NULL_PROVIDER)
        if fallback is None:
            # The no-op's factory is contractually not allowed to raise, so
            # this means the app overrode "null" with something broken.
            raise RuntimeError(
                f"{self.capability}: the {NULL_PROVIDER!r} provider failed to "
                f"instantiate; it must never raise."
            )
        return fallback

    def is_configured(self) -> bool:
        """Whether a real implementation is active.

        Callers use this to skip work that only makes sense with a live
        backend — not queueing an email nobody can send, not offering an upload
        button with nowhere to put the file.

        :returns: False when the no-op is serving, True otherwise.
        """
        return self.active_name() != NULL_PROVIDER

    def _configured_name(self) -> str:
        """Read `config_key`, tolerating a database that is not ready yet.

        Providers are registered at import time, and a caller can reach one
        before the pool is up or during a shutdown. Config being unreadable is
        not a reason to fail differently from config being unset.

        :returns: The configured name, or this registry's default.
        """
        try:
            from bedrock.core.database import db

            value = db.get_config(self.config_key, self.default)
        except Exception as exc:
            logger.debug(
                f"{self.capability}: could not read {self.config_key!r} "
                f"({exc}); using default {self.default!r}."
            )
            return self.default
        name = str(value).strip() if value is not None else ""
        return name or self.default

    def _instantiate(self, name: str) -> P | None:
        """Build `name` if needed and cache it.

        :param name: A registered implementation name.
        :returns: The instance, or None when its factory raised.
        """
        with self._lock:
            if name in self._instances:
                return self._instances[name]
            factory = self._factories.get(name)
        if factory is None:
            return None
        try:
            instance = factory()
        except Exception as exc:
            logger.error(
                f"{self.capability}: provider {name!r} failed to initialise "
                f"({exc}); falling back to {NULL_PROVIDER!r}."
            )
            return None
        with self._lock:
            # Another thread may have won the race; keep whichever landed
            # first so callers never see two instances of one provider.
            return self._instances.setdefault(name, instance)

    def reset_for_tests(self) -> None:
        """Test helper: drops registrations, instances and warn state.

        Not used by application code. The additive registries spell this
        `__clear_*`, but that convention only works at module scope: a
        double-underscore *method* is name-mangled to
        `_ProviderRegistry__clear_providers`, so the parallel name would be
        unusable from a test. The role is the same.
        """
        with self._lock:
            fallback = self._factories[NULL_PROVIDER]
            self._factories = {NULL_PROVIDER: fallback}
            self._instances.clear()
            self._warned.clear()
