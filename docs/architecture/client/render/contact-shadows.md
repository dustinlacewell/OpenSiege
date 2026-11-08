Source: apps/client/src/render/contactShadows.ts

# Contact shadows

`ContactShadowsPass` draws a soft dark patch under each unit. The sun's shadow map does the real shadows. This pass grounds the unit.

## How

- One instanced quad per pose. Stride 7: `x, y, z, yaw | pitch, roll, radius`.
- The quad is `1.15 · radius` by `0.95 · radius`, lifted 1.5 above the ground, tilted by the unit's pitch and roll, then rotated by yaw. It uses `POSE_GLSL` from `unitShader.ts`.
- The fragment is black with alpha `a² · 0.35`, where `a` falls off from the centre.
- Draw state: `decal` (depth test, no depth write, polygon offset).

## Place in the frame

After the terrain, scatter and features, before the ground marks and units. It reads `poses` and `cam`.

## Rules

- It uploads its own buffer each frame in `draw`. It fills from the pose table.
- Radius comes from `UNIT_STATS[kind].radius`. A new kind works without change.
- It does not cast or receive shadow-map shadows.
