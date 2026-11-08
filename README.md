# OpenSiege

A real-time strategy game. It runs in the browser. You play it offline against computer players.

## Run it

You need Node 24 and pnpm.

```
pnpm install
pnpm --filter @mf/client exec vite
```

Open http://localhost:5173. Pick a map, add bots, press Play.

## Check it

```
pnpm exec tsc -p tsconfig.json
node --experimental-transform-types --test "packages/*/test/*.test.ts" "apps/*/test/*.test.ts"
```

## Layout

- `packages/sim`: the game rules. Pure TypeScript.
- `packages/ai`: the computer players.
- `packages/map`: map files and map tools.
- `packages/protocol`: the match messages.
- `apps/client`: the browser client.
- `docs/architecture`: how it all fits together.

## License

GNU Affero General Public License v3.0 only. See `LICENSE`.
