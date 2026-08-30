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
| INVALID_PARAMS | Route-level parameter validation rejected (emitted by routes, never by upstream mapping) | 400 |
| UNKNOWN | Fallback | 500 |

- When the facade carries an upstream `status ≥ 400`, pass that status through; otherwise use the fallback table above.
- The upstream often returns "HTTP 200 + business failure code"; such responses must be classified by business code into an error status — passing 200 through would make clients misjudge success via `res.ok`. The enforcement mechanism is `assertOkBody` in `server/ncm/raw.ts`: every facade call re-checks the response body and throws `mapNcmError` when `body.code !== 200` (two deliberate exceptions carry inline comments: batch cover fetch tolerates per-item failure, QR polling maps the 800–803 polling codes).
- The code table is synced in four places (`satisfies`/`Record` typing guarantees compile-time errors): `$lib/types/ncm.d.ts` (definition), `server/ncm/errors.ts` (classification enum), `lib/ncm/client.ts` (allowlist via `satisfies`; non-allowlisted codes degrade to UNKNOWN, but the server message is still passed through for display), `server/ncm/http.ts` (`ERROR_STATUS` fallback mapping).

## Client calls

Pages request `/api/*` only through `ncmFetchJson` / `ncmFetchJsonPost` / `ncmFetchJsonDelete` in `$lib/ncm/client.ts`; any `UNAUTHENTICATED` response triggers the global binding-invalidation orchestration.

## Unbound access tiers (fixed contract, one row per endpoint)

Binding is checked per request via `resolveBoundUser`; there is no global auth middleware. Behavior when unbound is tiered:

| Tier | Endpoints | Unbound behavior |
| --- | --- | --- |
| Account domain | GET /api/playlists · GET /api/songs/liked · POST /api/songs/like | `401 UNAUTHENTICATED` + per-endpoint guidance copy (same code as binding invalidation, so pages render guidance from it); the account cookie is required for the call itself |
| Public domain | GET /api/search · GET /api/songs/lyric · GET /api/songs/url · GET /api/playlist/[id] · GET /api/playlist/[id]/tracks | Anonymous access allowed: the facade is called with `bound?.cookie ?? ''` (empty cookie = upstream's logged-out subset); results may be degraded (trial-only audio, restricted lyric fields, partial track completion) but never rejected |
| Binding domain | GET /api/binding/status · GET /api/binding/qr · GET /api/binding/qr/status · DELETE /api/binding | Manage the binding state itself; never gated on being bound |

Parameter validation is identical in both tiers once a request reaches validation: invalid params return `400 INVALID_PARAMS` through `ncmErrorJson`. Public-domain endpoints validate regardless of binding state; account-domain endpoints gate on binding first (401 when unbound), so their validation is only reachable when bound.

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
