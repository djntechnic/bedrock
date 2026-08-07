# Media storage

Attach files to anything, hold them for review, and put the bytes wherever the
deployment says. Plan F4.

Generalised out of MLBTracker's `photo_service` — good work bound to one table:
every function took a `collection_card_id` and resolved ownership through
`_owner_of_card`. What was actually generic is here, keyed by
`(entity_type, entity_id)`.

## Two layers

**`bedrock.storage`** is the provider: where bytes go. **`bedrock.services.media_service`**
is the layer above it that records what was stored, against which entity, and
whether a human has approved it. Most callers want the second.

```python
from bedrock.services import media_service as media

asset = media.attach_media(
    "collection_card", card_id, file_bytes, "front.jpg",
    owner_id=user.user_id, submitted_by_user_id=user.user_id,
)
# → status "pending"

media.approve([asset.media_id], reviewed_by_user_id=admin.user_id)

for asset in media.list_for_entity("collection_card", card_id):
    ...  # approved only, unless you ask otherwise
```

## Backends

| Name | Config value | Needs |
| --- | --- | --- |
| Local disk | `local` *(default)* | nothing |
| Cloudflare Images | `cloudflare_images` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_HASH` |

Selected by the `storage_provider` row in `app_config_settings`. Register your
own the way you register anything else:

```python
from bedrock.storage import storage
storage.register("s3", S3StorageProvider)
```

The protocol is three methods — `store`, `delete`, `url_for` — because the
platform calls three. No listing, no copying, no presigned URLs, no multipart:
guessing at a wider surface forces every backend to implement what nothing
calls, and an S3 adapter that has to invent a `list_prefix` is an adapter
nobody will write.

### The fallback is local disk, not a no-op

A deliberate divergence from mail. `NullMailProvider` drops the message,
because a dropped email is survivable and a self-hosted app with no relay must
still boot. A dropped *file* is data loss — the user watched an upload succeed
and the bytes are gone. Local disk needs no configuration, so "nothing
configured" has a real implementation available and there is no reason to reach
for a black hole.

The consequence worth knowing: local disk is per-container, so two API
containers do not see each other's uploads. Configure a real backend before
scaling out.

## Things that are decisions, not defaults

**Uploads land `pending`.** Approval is what makes an asset visible, so an
unreviewed image cannot reach a public CDN. The ordering guarantees it rather
than a policy someone has to remember. An application with no review step
passes `status=STATUS_APPROVED` and says so at the call site — better than a
config flag making the same decision invisibly.

**`list_for_entity` filters to approved by default.** A public page asking for
"the images" must not have to remember to filter, because the one time it
forgets is the time an unreviewed upload is on the internet. Pass `status=None`
for everything.

**`approve` and `reject` only move `pending` rows**, enforced in the WHERE
clause rather than by reading first. Two admins working the same queue must not
both count the same asset, and a stale page must not resurrect something
already rejected.

**Rejecting purges the bytes and keeps the row.** The bytes are why it was
rejected; the row is the record of the decision and the reason.

**Deleting removes the row first, then the bytes.** An orphaned file is
recoverable. A row pointing at nothing renders as a broken image forever.

**A delete is skipped when the asset was stored on a different backend.** After
the active provider changes, asking the local provider to delete a Cloudflare
image would unlink nothing and report success. It logs at warning instead.

## No foreign key, and what that costs

`media_assets` is keyed by `(entity_type, entity_id)` with no foreign key to
any application table. That is what lets one table serve a card's photos, a
gallery item's images and a blog post's attachments — and it means **nothing
cascades**. An application deleting an entity calls:

```python
media.delete_for_entity("collection_card", card_id)
```

in the same transaction. There is no way for the platform to do this for you
without knowing your tables, which is the thing it must not know.

## What is not here

- **Image processing.** No resizing, no thumbnails, no format conversion.
  Dimensions are read when Pillow happens to be installed and skipped when it
  is not — metadata is worth having and never worth failing an upload over. A
  CDN backend does transformation better than an application ever will.
- **Virus scanning.** An upload from an untrusted user should be scanned, and
  that wants a queue (F6) rather than a request handler.
- **Direct-to-storage uploads.** Presigned URLs mean the bytes never touch the
  API, which matters at a scale bedrock apps do not have yet, and would change
  the protocol for every backend.
