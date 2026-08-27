# Object storage

`StorageProvider` is three methods: hand it bytes and a filename, get an opaque
key back. That is the right surface for "a user uploaded a photo, put it
somewhere", and it is what `media_service` calls.

It is the wrong surface for an application that owns its own key space.
CollectIt's image keys are `{sku}/{seq}.jpg` — minted by the application,
immutable for the life of a listing, and the reason its `immutable` cache
header is honest. A backend that mints its own key cannot express that at all.

So the capability is widened by a **second protocol**, not a wider first one.

```python
from bedrock.storage import active_object_store

store = active_object_store()
store.put("SKU-1/01.jpg", jpeg, content_type="image/jpeg",
          cache_control="public, max-age=31536000, immutable")
store.list_prefix("SKU-1/")
store.delete_many(["SKU-1/01.jpg", "SKU-1/02.jpg"])
store.verify_public("SKU-1/01.jpg")
```

`ObjectStore` extends `StorageProvider`, so an object store is still a storage
provider and every existing caller keeps calling three methods. A backend
either implements the wider protocol or does not:

| Backend | `StorageProvider` | `ObjectStore` |
| --- | --- | --- |
| `local` | yes | yes |
| `s3` | yes | yes |
| `cloudflare_images` | yes | no — it mints its own image ids |

`active_object_store()` raises `ObjectStoreUnsupported`, naming the configured
backend, rather than handing back something that fails later with an
`AttributeError`. `as_object_store(provider)` is the non-raising form.

## The four methods, and why each is there

**`put(key, data, *, content_type, cache_control)`** writes at exactly `key`.
Backends must not decorate it: an application that computed a key and got a
different one back cannot address its own objects. Keys go through `safe_key()`,
which normalises separators and rejects — never silently rewrites — anything
that cannot be made relative. `../../etc/passwd` is an error, not `etc/passwd`.

**`delete_many(keys)`** is not a loop on every backend. S3 bills per request and
removes a thousand keys in one call; `S3StorageProvider` chunks at exactly that
limit, because 1001 keys is a hard API error rather than a truncation.

**`list_prefix(prefix)`** must be exhaustive. `list_objects_v2` returns at most
1000 keys and reports the truncation in a field that is easy not to read. A
version that ignores it makes an orphan sweep examine the first thousand objects
of forty thousand and report a clean bucket — success, with nothing done. The S3
adapter follows the continuation token to the end, and raises if a page claims
truncation without supplying one.

**`verify_public(key)`** fetches the object through its *public* hostname and
reports what came back. This catches a failure that is invisible from the
storage API: Cloudflare's Bot Fight Mode and hotlink protection sit in front of
the public hostname, not the bucket. Credentials work, uploads succeed,
`head_bucket` passes, and every consumer of those URLs gets a challenge page.
`PublicCheck.supported` separates "checked, and it is broken" from "this backend
has no public URL to check" — local disk is the second and must not be reported
as a failure.

## The S3-compatible backend

One adapter covers Cloudflare R2, MinIO and S3 itself; they differ only in an
endpoint URL, which is empty for AWS.

```bash
pip install 'bedrock-api[s3]'
```

```
S3_BUCKET=my-bucket
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com   # R2 or MinIO; empty for AWS
S3_REGION=auto
S3_PUBLIC_BASE_URL=https://images.example.com                 # the CDN, not the endpoint
```

Credentials are environment settings, never `app_config_settings` rows — app
config is rendered in an admin UI and returned by the export endpoint. Which
backend is active is a config row; what it authenticates with is not.

`boto3` is imported inside the constructor, so an application that never selects
this backend never needs it installed. Selecting it without configuring it
raises: the provider registry catches the failing factory, logs it, and falls
back to local disk — an operator gets working uploads on the container's disk
and a loud log, rather than lost files.

`S3StorageProvider.ops` counts the requests made this process, by billed class
(`puts`, `deletes`, `lists`). S3-compatible providers price per request as well
as per byte, and the cost that surprises an operator is always a listing loop
nobody counted. `check_connection()` is a separate diagnostic from
`verify_public()` on purpose: the first passing while the second fails is the
exact signature of a misconfigured CDN in front of a healthy bucket.

## The fallback is an object store

`local` resolves to `LocalObjectStore`, which implements both protocols over a
directory tree. That is what lets an application built on caller-chosen keys run
on a laptop with nothing configured — and what lets the wider surface be tested
without an S3 endpoint anywhere in CI.

It subclasses `LocalStorageProvider` rather than replacing it: the narrow
provider's `delete` and `path_for` flatten a key to its basename on purpose, and
nested keys need the other resolution rule. One class cannot honestly have both.
