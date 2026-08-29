# Build & Deploy

## Environment

- Node ≥ 24 (enforced via the `package.json` `engines` field); the pnpm version is pinned by `packageManager` (works out of the box under corepack).
- No required environment variables (`.env.example` states this explicitly): NetEase Cloud credentials are written by the app to `.data/credential.json` on first QR-code binding (git-ignored; deleting the file returns the app to the unbound state, and re-scanning heals it).
- `DATA_DIR` is the only runtime directory switch: it overrides the data directory holding credentials (default `.data`, also the Docker volume mount point).

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server (Vite 8) |
| `pnpm build` | Build, output goes to `build/` (`@sveltejs/adapter-node`) |
| `PORT=3000 node build` | Run the build output |

## Dependencies & catalog

- All dependency versions live in the `catalog:` section of `pnpm-workspace.yaml`; `package.json` always says `"catalog:"`. Version changes are made in the catalog only — one place.
- CI/frozen pitfall: when `CI` is present in the environment, `pnpm install` defaults to a frozen lockfile. After touching the catalog, run `pnpm install --no-frozen-lockfile` first to refresh `pnpm-lock.yaml`, otherwise installation fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.

## Dev server

Vite 8 binds only to IPv6 `::1` by default: `curl http://127.0.0.1:5173` fails or times out — use `http://localhost:5173`.

## Docker

The `Dockerfile` has three stages (deps → build → run), all pinned to Node 24. Note that the run stage runs `pnpm install --prod --frozen-lockfile` separately: adapter-node externalizes dependencies, so copying the `build/` output alone is not enough — the runtime image must include production dependencies. Port 3000; credential persistence works by mounting a volume at `DATA_DIR`.
