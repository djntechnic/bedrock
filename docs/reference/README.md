# Reference

Architectural guides and standing reference material — how the platform is
put together and how to operate it. Unlike `docs/specs/` and `docs/plans/`,
these documents describe the system as it exists today, not a change in
flight; they're amended in place as the platform evolves.

| Document | Covers |
| -------- | ------ |
| [`platform-guide.md`](platform-guide.md) | Primary cross-repository architectural guide, lifecycle model, and consumer invariants. |
| [`extension-points.md`](extension-points.md) | Registries vs. providers — which kind to reach for and why. |
| [`app-assembly.md`](app-assembly.md) | `bedrock.core.app_factory.create_app()` — mounting order, CORS, error handlers, rate-limiting, routers. |
| [`deployment.md`](deployment.md) | `deploy/` Dockerfiles, compose, nginx. |
| [`media.md`](media.md) | Media/image pipeline. |
| [`mail.md`](mail.md) | SMTP + templates: invitation, password reset, email flows. |
| [`object-storage.md`](object-storage.md) | Storage provider protocol (Cloudflare R2, S3-compatible backends). |
| [`pagination.md`](pagination.md) | Pagination conventions across the API. |
| [`seo.md`](seo.md) | SEO routes and the nginx blocks they need. |
| [`roadmap.md`](roadmap.md) | Longer-horizon platform roadmap. |
