# Architecture

## Product shape

A single-instance, self-deployed personal third-party NetEase Cloud Music player: one deployment binds to the deployer's own NetEase account — no multi-user, no server-side tenancy. First launch guides through QR-code binding; once persisted, credentials survive restarts.

## Data flow (dependencies point one way only; the reverse is forbidden)

```
pages / components
  → $lib/ncm/*          page data modules (shape conversion such as toSongItem)
  → $lib/ncm/client.ts  unified transport layer (decodes NcmClientError)
  → /api/* routes       pure proxy: parse params, call facade, no business logic
  → $lib/server/ncm/*   facade (ncmXxx async functions + upstream mapping)
  → hana-music-api      NetEase Cloud SDK (npm dependency, direct functional calls)
```

## Hard boundaries (invariants fixed by the rework consensus; violating one is an architecture regression)

- References to hana-music-api are allowed only inside `src/lib/server/ncm/` (verify purity any time with `rg "hana-music-api" src`).
- Direct functional calls to the SDK: no client instantiation, no monkey-patching.
- Per-call `{ cookie }` context: no in-memory singletons, no global client.
- The facade mapping layer is the single source of upstream shape knowledge; missing or mistyped upstream fields always fall back to safe empty values (`asRecord`/`asArray`/… in `raw.ts`) — no server-side second-guessing or patching.
- The route layer contains no business logic.
- The error chain is one-way: `NcmError → ncmErrorJson → NcmClientError`; pages branch on code only and never see upstream error details.

## Binding & credentials (SSOT)

- Single source of credentials: `.data/credential.json` (all reads/writes in `src/lib/server/binding.ts`; `DATA_DIR` overrides the directory).
- Read failure / corrupted file / missing file is always treated as unbound (the user re-scans and it heals); writes go to a temp file first, then an atomic rename, avoiding half-written corruption.
- The binding heartbeat lives in `(app)/+layout.svelte`: one check on cold start + periodic re-checks at `BINDING_HEARTBEAT_INTERVAL`; any UNAUTHENTICATED from any client API triggers the global invalidation orchestration (banner + guided return to the binding page, see `markBindingInvalid`).

## Client state & components

- `$lib/stores` (Svelte 5 runes): `nowPlaying` (playback/queue orchestration), `playlist` (queue; `updatePlaylist` skips identical content), `liked` (heart set + pending set), `message` (global toast).
- `$lib/components/hana/` is the rich base component library (Button/Drawer/Dropdown/VirtualList + ScrollContainer/LazyImage/Message, etc.); `player/` is the player and drawer; `playlists/` is the playlist detail view (the favorites page reuses the same view); `common/` holds list-row components; `app/` holds navigation, the binding-invalid banner, and the PWA install prompt.

## Routing & rendering

- `(app)` route group: home, `search`, `playlist/[id]`, `favorites`, `settings`; `bind` is the QR-binding page (the only guided entry for the unbound state).
- Pages are prerendered (`svelte.config.js`, concurrency 5); all `/api` routes set `prerender = false` for live calls.

## Upstream defense details (`raw.ts`)

- Image URLs are normalized to https; the NetEase CDN p1–p4 hosts are sharded by path hash — the same path always maps to the same host, preventing browser-cache misses caused by host drift.
- Batch ids are chunked at `TRACK_CHUNK_SIZE = 1000` (the upstream per-request id limit).

## Skin system

Token CSS is scoped under `[data-skin='...']` (the `--skin-*` variables in `src/lib/skin/skins.css`); the `uno.config.ts` theme references tokens via `skinColor()`. Switching skins = changing the `data-skin` attribute on `<html>`, effective immediately. Currently a single skin: `campanula`.
