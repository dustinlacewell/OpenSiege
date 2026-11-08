Source: apps/client/src/render/portraits.ts, apps/client/src/render/portraitView.ts, apps/client/src/render/portraitImage.ts

# Unit portraits

`PortraitRenderer` draws one 256 by 256 headshot per unit kind. It uses the game's own model, unit shader, lighting and tone map. The HUD shows the images (`client/ui/hud.md`).

## When it draws

`Renderer.prepare` calls `portraits.update(teams.of(f.me))` each frame, after `teams.use` and before `units.prepare`. It re-renders all kinds only when the local player's team colour changed. The first world frame renders them; a new colour (new session) renders them again.

It must run before `units.prepare`, because `UnitsPass.drawOne` overwrites that kind's instance buffer.

## Steps per kind (`capture`)

1. `portraitView(kind)`: the camera and hull yaw.
2. Its own `HdrTarget` at 256: multisampled linear HDR. Cleared to a dark neutral `BACKDROP`.
3. `UnitsPass.drawOne(kind, pose, team, view, sun)`: one instance, mobile pose (siege 0), turret aimed with the hull. Same program as the scene (`UNIT_VS`, `UNIT_FS`, `applyScene`).
4. `hdr.resolve()`, then `PostPass.draw(texture, 256, 256)` into an `RGBA8` framebuffer. Same exposure, ACES curve, vignette and dither as the game.
5. `readPixels`, then `portraitCanvas`: flip rows onto a 2D canvas and add a soft radial vignette.
6. `toBlob` → `URL.createObjectURL`. The old URL is revoked. A late blob from an older render is dropped (`generation`).

After all kinds, `restore` binds the canvas framebuffer, sets the canvas viewport, and unbinds the program and VAO.

## No shadow, no fog

- Sun: a `SunLight` with a zero `shadowMat` and the real shadow texture. Every point lands outside the map, so `sunShadow` returns 1 (lit). Terrain never shadows a portrait.
- Fog: `PortraitView.dist` is 1e7. Fog starts at `1.3 · dist`, so it never starts.

## portraitView.ts (pure)

`portraitView(kind)` frames the unit on `UNIT_STATS` radius and height.

- Field of view 28°. Pitch 0.42 rad above the horizon.
- The camera stands 0.5 rad round from the sun's bearing, so the lit side faces it.
- The hull turns its front 0.65 rad away from the camera: a three-quarter front view.
- Distance fits a sphere of `hypot(1.2 · radius, 0.6 · height)`. The target is at `0.4 · height`.
- The camera basis is the same as `camera.ts`, so the image is not mirrored against the game.

## Seam

`url(kind)` returns the URL, or `""` before the first render. It satisfies `Portraits` in `ui/portraits.ts` by shape. `startClient` passes `renderer.portraits` to `Hud`. `ui/` never imports this file.

## Recipe: change the look

- Framing: the constants in `portraitView.ts`.
- Backdrop: `BACKDROP` (linear HDR) in `portraits.ts`, and the vignette in `portraitImage.ts`.
- A new kind appears by itself: the kind list is the sim's `UNIT_KINDS`.
- A raised mast shows folded: the headshot uses the mobile pose (siege 0) and time 0.
