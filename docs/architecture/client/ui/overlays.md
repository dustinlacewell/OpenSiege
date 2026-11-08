Source: apps/client/src/ui/overlays.ts

# Eliminated banner

`#dead-banner`, a small `hud` line under the top bar: "Eliminated. Spectating until the match ends." `update(dead)` shows it when the model says the player is dead. It takes no pointer events, so the player can still pan and watch. `Hud` hides it when there is no world. There is no respawn.

It uses `ui/dom.ts` helpers. It sits inside `#game-hud`, so it never shows outside a match (`client/ui/screens.md`).
