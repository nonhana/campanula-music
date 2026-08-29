# Project Rules

Binding rules for every agent working in this repository.

## How this file works

- When the user points out and corrects an agent mistake during execution, the agent must record the lesson here as a new rule before continuing the task.
- Rules apply immediately to all subsequent work; they win over agent style preferences.
- Never delete or weaken a rule without an explicit user instruction.

## Rules

### 1. Agent documentation must be in English

All agent documentation — every file under `agent-docs/`, this file, and the root `AGENTS.md` breadcrumb — must be written in English. Chinese is forbidden in these files.

- Added: 2026-08-30, by user decision.
- Scope note: this governs documentation only. Code comments, JSDoc, UI copy, and commit messages remain Chinese (see `agent-docs/CODE_STYLE.md`).
