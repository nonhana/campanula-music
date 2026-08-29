# API conventions (/api/* endpoint contract)

## Response envelope

- Success: `json(<domain shape>)`, no extra wrapping.
- Failure: `{ "error": { "code": <domain code>, "message": <user-facing Chinese copy> } }`, and it must go through the unified exit `ncmErrorJson` (`src/lib/server/ncm/http.ts`); routes must not invent their own error shapes.

## Error codes & HTTP status

| Domain code | Meaning | Fallback status |
| --- | --- | --- |
| UNAUTHENTICATED | Unbound / binding invalid | 401 |
| RATE_LIMITED | Rate limited | 429 |
| RESOURCE_UNAVAILABLE | No copyright / resource unavailable | 404 |
| UNKNOWN | Fallback | 500 |

- When the facade carries an upstream `status ≥ 400`, pass that status through; otherwise use the fallback table above.
- The upstream often returns "HTTP 200 + business failure code"; such responses must be classified by business code into an error status — passing 200 through would make clients misjudge success via `res.ok`.
- The code table is synced in three places (`satisfies` guarantees compile-time errors): `$lib/types` (definition), `server/ncm/errors.ts` (classification), `lib/ncm/client.ts` (allowlist; non-allowlisted codes degrade to UNKNOWN, but the server message is still passed through for display).

## Client calls

Pages request `/api/*` only through `ncmFetchJson` / `ncmFetchJsonPost` / `ncmFetchJsonDelete` in `$lib/ncm/client.ts`; any `UNAUTHENTICATED` response triggers the global binding-invalidation orchestration. When unbound, all business endpoints return `401 UNAUTHENTICATED` + guidance copy (the same code as binding invalidation, so pages render guidance based on it).

## Endpoint list (12, as of 2026-08)

| Method & path | Purpose | Params |
| --- | --- | --- |
| GET /api/binding/status | Binding status (heartbeat) | — |
| GET /api/binding/qr | Start QR-code binding | — |
| GET /api/binding/qr/status | Poll QR-code status | key |
| DELETE /api/binding | Unbind (idempotent) | — |
| GET /api/playlists | My playlists (created / favorited groups) | — |
| GET /api/playlist/[id] | Playlist detail | — |
| GET /api/playlist/[id]/tracks | Playlist tracks (paged) | limit, offset |
| GET /api/search | Search | keywords, type, limit, offset |
| GET /api/songs/liked | Liked songs | — |
| POST /api/songs/like | Like (heart) write-back | body |
| GET /api/songs/lyric | Lyrics | id |
| GET /api/songs/url | Play URLs (batch-capable) | ids, level (audio-quality tier) |

## Upstream quirks (normalized in `mapNcmError`)

NetEase business-code classification: `-462`/`301`, HTTP 301, or login-related copy → UNAUTHENTICATED; `-460`/429 or rate-limit copy → RATE_LIMITED; `-110` or copyright copy → RESOURCE_UNAVAILABLE; everything else → UNKNOWN. The exact match strings live in `server/ncm/errors.ts` (they match against the upstream's Chinese copy). The hana-music-api failure object shape is `{ body: { code, msg }, cookie, status }`.
