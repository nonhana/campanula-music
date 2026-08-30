# Code style & project conventions

Conventions beyond the tooling defaults. Formatting and linting are entirely ESLint's job (`@antfu/eslint-config`, `eslint.config.mjs` with the svelte/unocss/pnpm features enabled): the project does not use Prettier/Biome, and `.vscode/settings.json` is configured for `source.fixAll.eslint` on save with `organizeImports` off.

## General

- Keep a change limited to the requested behavior; do not reformat, rename, or add defensive fallbacks outside that scope.
- Do not extract a helper, class, or interface for a single caller; extract only once at least three callers need the same abstraction.
- Prefer the existing component, `$lib/stores` store, or server utility over adding a new layer.
- Never duplicate a utility: a helper needed by two or more files belongs in `$lib/` or its owning domain module — search the existing ones first.
- When framework or installed-library functionality meets the need, always use it; never reimplement it with project-local code.
- In TypeScript, redundant type annotations on inferable positions are forbidden: write `serve({}, (info) => {})`, not `serve({}, (info: AddressInfo) => {})`.
- Unless absolutely necessary, prefer arrow functions over function declarations. Exemption: module-level exports may use function declarations (hoisting + named-export readability — reference: `src/lib/server/ncm/raw.ts`); inside components everything is an arrow function.

## Language & copy

- Code comments, JSDoc, UI copy, and commit messages: Chinese only.
- Comments are the exception, not the default: brief, unambiguous single-line comments only where truly necessary (e.g. an ESLint rule override, or the purpose of a general-purpose utility), treating the code itself as the SSOT. When present they explain the "why" (root cause, trade-offs, pitfalls), never restate what the code does; file headers keep the project's block-comment convention declaring responsibility and key decisions (reference examples: `src/lib/server/ncm/raw.ts`, `src/lib/ncm/client.ts`).

## Svelte 5 components

- Runes mode (`$props`/`$state`/`$derived`), `<script lang='ts'>`; declare props as an `interface Props` before destructuring.
- Icons use `@lucide/svelte` (Svelte 5 Component form; render dynamic icons directly as `<Icon class='...' />` — no `svelte:component` needed).

## Styling (UnoCSS)

- presetWind3 + attributify; theme colors always go through skin-token semantic classes (`bg-primary/50`, `text-app-text`, etc.; actual values come from the `--skin-*` variables scoped under `[data-skin]`) — never hardcode color values.
- `preset-rem-to-px` is active: write utility classes with px semantics.
- Available extras: `presetScrollbar`, `transformerDirectives` (`@apply`), `transformerVariantGroup`; the `title` shortcut is predefined.

## Dependency management

- Versions are maintained only in the `catalog:` of `pnpm-workspace.yaml` (ESLint's `yaml/sort-keys` rule governs key order; insert new packages alphabetically), and `package.json` says `"catalog:"`.
