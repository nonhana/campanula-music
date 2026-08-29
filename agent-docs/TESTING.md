# Testing & Verification

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm test:run` | Full test suite (Vitest 4, jsdom environment) — use before commits/CI |
| `pnpm test` | Watch mode |
| `pnpm check` | Type checking via `svelte-kit sync && svelte-check` |
| `pnpm lint` / `pnpm lint:fix` | ESLint (also the only formatter in this repo) |
| `pnpm smoke` | Read-only smoke test: requests `/api/*` endpoints in order and asserts envelope-level invariants; exits non-zero on any failure. Requires `pnpm dev` running first; `SMOKE_BASE_URL` overrides the target (default `http://localhost:5173`) |

Standard verification combo for behavior changes: `pnpm check` + `pnpm test:run` + `pnpm lint`, all green.

## Test environment behavior (must-read before writing tests)

`src/test/setup.ts` provides three fallbacks; test code relies on them directly:

- `localStorage` is an in-memory Storage — Node 26's native `localStorage` global makes jsdom skip injecting its own Storage, so this manually substitutes it.
- `ResizeObserver` is a no-op implementation (ScrollContainer and friends instantiate it on mount).
- `IntersectionObserver` calls back once with `isIntersecting: true` in a microtask after `observe()` — this is why LazyImage is immediately visible in tests.

`vitest.config.ts` sets `resolve.conditions: ['browser']`: without it, svelte resolves conditional exports to the SSR entry and client APIs like `mount` become unavailable. Test files match `src/**/*.test.ts` and live next to the code under test.

## Fixture authenticity (hard rule)

Envelope mocks in server facade tests must use the JSON recorded from the real upstream in `src/lib/server/ncm/fixtures/`; hand-written fake shapes are forbidden. Lesson: in the P0-1 incident, fake envelopes left 331 all-green tests exercising the wrong shape (green tests ≠ correct shape).

## Verification red lines

- No verification may touch a real account: no like (heart) writes, no QR-scan writes.
- Before any unbind verification, back up `.data/credential.json` first.
- `pnpm smoke` is strictly read-only (GET endpoints only, no account writes).
