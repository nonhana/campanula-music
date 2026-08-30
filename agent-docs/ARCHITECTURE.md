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

## Trust network & deployment prerequisites

- The instance must be deployed on a trusted network (a home LAN or private network reachable only by the owner). This is the security boundary of the whole system: there is no caller authentication on `/api/*`, so anyone who can reach the instance can use the player and read the bound account's data.
- Why the binding flow has no caller auth: under the single-user self-host assumption, the deployer is the only expected network peer, so an authentication layer (hooks middleware, sessions, rate limiting — the M29 item) was evaluated and deliberately deferred; it would protect against nobody in the assumed deployment.
- Residual risk: in-flight QR-polling hijack and replay are mitigated at the data layer (the QR-session epoch in `binding.ts`: unbind deletes the session so stale polls cannot re-bind), but nothing stops a network peer from starting their own binding flow.
- Upgrade trigger: if the instance is ever exposed to the public internet (or any shared network), the deferred caller authentication (M29) becomes mandatory before exposure — do not deploy publicly without it.

## Client state & components

- `$lib/stores` (classic `svelte/store` — `writable`/`derived`; no runes in state modules): `nowPlaying` (playback/queue orchestration), `playlist` (queue; `updatePlaylist` skips identical content), `liked` (heart set + pending set), `message` (global toast).
- `$lib/components/hana/` is the rich base component library (Button/Dropdown/VirtualList + ScrollContainer/LazyImage/Message, etc.); `player/` is the player and drawer; `playlists/` is the playlist detail view (the favorites page reuses the same view); `common/` holds list-row components; `app/` holds navigation, the binding-invalid banner, and the PWA install prompt.

## Routing & rendering

- `(app)` route group: home, `search`, `playlist/[id]`, `favorites`, `settings`; `bind` is the QR-binding page (the only guided entry for the unbound state).
- Pages are prerendered (`svelte.config.js`, concurrency 5); all `/api` routes set `prerender = false` for live calls.

## Upstream defense details (`raw.ts`)

- Image URLs are normalized to https; the NetEase CDN p1–p4 hosts are sharded by path hash — the same path always maps to the same host, preventing browser-cache misses caused by host drift.
- Batch ids are chunked at `TRACK_CHUNK_SIZE = 1000` (the upstream per-request id limit).

## Skin system

Token CSS is scoped under `[data-skin='...']` (the `--skin-*` variables in `src/lib/skin/skins.css`); the `uno.config.ts` theme references tokens via `skinColor()`. Switching skins = changing the `data-skin` attribute on `<html>`, effective immediately. Currently a single skin: `campanula`.
