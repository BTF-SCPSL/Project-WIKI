# Fumadocs Editor (editable vendored source)

This directory is a complete editable snapshot of [fuma-nama/fumadocs-editor](https://github.com/fuma-nama/fumadocs-editor), pinned to commit `46c7086bca2f77bd92fb51cc19871bf48c00e537` (2026-10-01). Its original MIT license is preserved in `LICENSE`.

Unlike an npm dependency or Git submodule, the source is stored directly in Project-WIKI and can be changed and committed normally.

## Development

Use **Node.js 24+** and the pinned **pnpm 11.5.3** from `editor/package.json`:

```bash
cd editor
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Other commands: `pnpm build`, `pnpm test`, and `pnpm --filter playground studio`.

- `packages/core`: parser, serializer, sync protocol
- `packages/ui`: React visual editor
- `packages/studio`: Studio UI and CLI
- `apps/playground`: manual testing
- `apps/docs`: editor documentation

**Important:** this is a **source-code import only**, not an automatic integration into the BTF Wiki runtime. The root monorepo has its own pnpm workspace and lockfile; treat `editor/` as a nested independent workspace. Browser editing on a public wiki requires a separately protected authoring route, permission checks, durable storage and synchronization/revalidation. Do not expose unauthenticated Studio or write APIs.

Upstream repository: https://github.com/fuma-nama/fumadocs-editor
