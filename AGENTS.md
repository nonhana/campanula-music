# Campanula Music — Agent Instructions

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `nonhana/campanula-music`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

**Decisions**: before stating or relying on a design decision (in a reply, a plan, or code), check `docs/adr/`; each filename names its decision. ADRs outrank recalled memories.

### Delivery

Before implementing a ticket, read `docs/agents/delivery.md`: branch, test seam, real-account rules, and hand-off with a trial checklist for the author (the author verifies by trying it; screenshots only on request).

## Svelte

When unsure about a Svelte 5 / SvelteKit API, look it up with the Svelte MCP (`.omp/mcp.json`): `list-sections`, then `get-documentation` for the relevant sections. The `svelte-file-editor` subagent lives in `.omp/agents/`.
