# Svelte AI toolchain

Where the official Svelte AI setup ([sveltejs/ai-tools](https://github.com/sveltejs/ai-tools)) lives in this project and how to use it. **Read this before creating, modifying, or analyzing any `.svelte`, `.svelte.ts` / `.svelte.js` file.**

## What lives where

- **MCP**: `.omp/mcp.json` — stdio running `npx -y @sveltejs/mcp`, providing the `list-sections` / `get-documentation` / `svelte-autofixer` / `playground-link` tools (code changes MUST pass `svelte-autofixer`, looping until it reports no issues)
- **Subagent**: `.omp/agents/svelte-file-editor.md` — a dedicated Svelte file editor agent; delegate larger create/modify/review work to it — it fetches documentation and runs the autofixer loop in its own context, without consuming the main session's
- **Skills** (user-level `~/.claude/skills/`, active in every session, not part of this repo): `svelte-code-writer` (the `npx @sveltejs/mcp` CLI equivalent for when MCP tools are unavailable), `svelte-core-bestpractices` (Svelte 5 best practices)

## MCP tool usage conventions (official AGENTS.md prompt, model-facing)

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
