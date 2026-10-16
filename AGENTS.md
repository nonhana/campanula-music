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

Before implementing a ticket, read `docs/agents/delivery.md`: branch, test seam, screenshots, real-account rules, hand-off.

## Svelte MCP

Official prompt from https://svelte.dev/docs/ai/instructions, headings shifted one level down. The server is configured in `.omp/mcp.json`; the `svelte-file-editor` subagent lives in `.omp/agents/`.

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### Available Svelte MCP Tools:

#### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

#### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

#### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

#### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
