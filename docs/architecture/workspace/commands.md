Source: wm.ts, .wm/commands/client.ts, .wm/commands/map-editor.ts, .wm/commands/typecheck.ts, tsconfig.json, tsconfig.base.json, apps/client/vite.config.ts, pnpm-workspace.yaml

# Workspace commands and TypeScript setup

## Commands

Run them with workmark: `wm <name>`. Each file in `.wm/commands` is one command, built with `cmd(...)` from the `define` module of the workmark package.

- `wm client`: runs `pnpm exec vite apps/client`. Dev client on port 5173. It plays offline: the skirmish, the tutorial and the dev sandbox.
- `wm map-editor`: runs the same Vite dev client and opens `/map-editor.html` (`client/dev/map-editor.md`).
- `wm typecheck`: runs `pnpm exec tsc -p tsconfig.json`. Checks every package.

`wm.ts` declares the project name `opensiege`.

To add a command, add a file in `.wm/commands` that exports `cmd({ handler })`.

## Packages

`pnpm-workspace.yaml` lists `packages/*` and `apps/*`. Package names: `@mf/sim`, `@mf/map`, `@mf/protocol`, `@mf/ai`, `@mf/client`.

The packages export `./src/index.ts` directly. There is no build step for them. Vite and tsx read the TypeScript source. `@mf/client` exports its entry (`startClient`), the shell styles, `LocalHost` and a few UI modules by path (its `package.json` `exports`).

## TypeScript rules that bite

`tsconfig.base.json` sets:

- `strict` and `noUncheckedIndexedAccess`: every array index is `T | undefined`. The code uses `!` after an index it knows is valid.
- `verbatimModuleSyntax`: type-only imports must say `import type` or `type X`.
- `allowImportingTsExtensions`: relative imports end in `.ts`.
- `noEmit`: `tsc` only checks.

`tsconfig.json` adds the DOM lib and Node types. It includes `packages/*/src`, `apps/*/src`, the Vite config of each app and `.wm`.

## Tests

Tests use Node's test runner through tsx. Run one folder: `pnpm exec tsx --test apps/client/test/*.test.ts`. The packages keep their tests in `packages/<name>/test`.
