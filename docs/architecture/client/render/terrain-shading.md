Source: apps/client/src/render/terrainShader.ts, apps/client/src/render/causticShader.ts, apps/client/src/render/detailShader.ts, apps/client/src/render/detailTexture.ts, apps/client/src/render/materialTexture.ts, apps/client/src/render/materialPalette.ts, apps/client/src/render/crystalShader.ts

# Terrain shading

The terrain fragment shader builds ground colour from noise and the mesh normal, or from a painted material layer. It also paints resource fields as crystals.

## Detail texture

`createDetailTexture(gl, tri)` runs once at pass construction.

- A 1024 by 1024 `RGBA8` texture, drawn by `createTilingTexture` with `DETAIL_FS` (`client/render/gl-helpers.md`).
- Every noise is periodic, so the texture tiles.
- Channels: R and G are a detail normal slope (packed 0..1), B is soil and pebble height, A is independent mottling.
- Then full mipmaps, `REPEAT` wrap and anisotropic filtering (up to 16 if available).

## Ground colour (`ground(n)`)

The shader samples the detail texture at three scales: 61, 263 and 1370 world units per tile (the coarse one rotated). The soil comes first. `u_useMaterials` picks its source:

- Off (the game's default): `proceduralSoil` mixes lush and dry grass by height and low-frequency `macro` noise, then dirt by `macro` noise and by slope.
- On: `paintedSoil` blends the four `u_palette` colours by the weight map.

Both branches then apply the same steps:

- Rock: by slope.
- Detail shading: brightness from the detail height.
- Detail slopes perturb the normal. A small ambient occlusion comes from the detail height.

The procedural branch works in sRGB and converts once at the end. The painted branch works in linear, so it converts the rock colour and the shade factor instead. Both use the same 2.2 gamma.

## Painted materials

`TerrainPass.setMaterials({ texture, palette })` turns the painted branch on. `setMaterials(null)` turns it off. The pass does not own the texture. The flag is a uniform, so there is no shader recompile.

- `createMaterialTexture(gl, cols, rows)` makes one `RGBA8` texel per grid vertex. It uses `LINEAR` filtering and `CLAMP_TO_EDGE`.
- The weights layout is `(j * cols + i) * 4 + channel`, the same as `MaterialLayer` in `@mf/map`.
- `upload(weights)` sends the whole map. `uploadRect(weights, rect)` sends only an inclusive vertex rectangle. It sets `UNPACK_ROW_LENGTH`, `UNPACK_SKIP_PIXELS` and `UNPACK_SKIP_ROWS` so the source is the full array. `rectUploadPlan` clamps the rectangle to the grid.
- The shader maps world xy to texel centres: vertex `i` sits on texel centre `i`, so the map edge is vertex 0 and vertex `cols - 1`.
- The weights are normalised by their sum. All-zero weights read as material 0.
- `packPalette` turns the sRGB 0..255 palette into four linear vec3s on the CPU.

## Crystal fields

`CRYSTAL_GLSL` is pasted into the terrain shader. For each of up to `MAX_FIELDS` fields (64, set in `@mf/sim`; it is the GLSL array size) it:

- Uses distance to the field centre divided by radius. Halo to 1.5, crystals to 1.0.
- Strength scales with `amount / FIELD_AMOUNT`, so an emptied field fades out.
- Paints Voronoi shards with faceted normals, a pulsing inner glow, bright cracks, random sparkles and a specular glint.
- Returns emitted light that is added to the lit colour.

## Caustics

`CAUSTIC_GLSL` is pasted into the terrain shader. `caustics(...)` adds sunlight that the waves focus onto ground under water.

- Depth is `u_seaLevel - v_pos.z`. At or above the sea level it returns 0, so ground above water looks the same as before.
- Two layers of a tiling warped-sine pattern, 190 and 117 world units per tile, the second rotated. They move at different speeds with `u_time`.
- Strength: the sun diffuse (`n · sun` times the shadow) times the albedo. It rises over the first 4 units of depth and then falls as `exp(-depth / 45)`.
- The mirrored surround gets caustics too, since its heights are the map's.

## Final colour

`scorch(g)` first darkens the albedo from the decal map (`client/render/decal-map.md`). Then `lit(...)` plus `pointLights(...)` plus crystal glow plus caustics, a faint grid line every 1000 world units (fixed, whatever the map size), `mapEdge` (dims outside the rectangle `0..u_map` by 0.35 and draws a soft border), then `fogged` (the haze of distance, not the fog of war).

The fog of war never touches the terrain (`client/game/vision.md`).

## Uniforms

`u_map` (a `vec2`: map width and map height, set from `mapWidth(terrain)` and `mapHeight(terrain)`), `u_maxHeight` (TERRAIN_MAX_HEIGHT), `u_seaLevel` (`terrain.seaLevel`), `u_time`, `u_fields[MAX_FIELDS]`, `u_fieldCount`, `u_detail` (unit 0), `u_decals` (`DECAL_UNIT`, 5), `u_useMaterials`, `u_materials` (`MATERIAL_UNIT`, 6; null when off), `u_palette[4]`, plus the scene set (`client/render/scene-lighting.md`).

## Recipes

- Change the ground look: edit `ground()` and `proceduralSoil()` in `terrainShader.ts`.
- Paint the ground: make a material texture, `upload` the weights, call `setMaterials`. After a brush stroke, `uploadRect` with the dirty bounds.
- Change the fields: edit `crystalShader.ts`. The sim field count must stay at most `MAX_FIELDS` or the extra fields do not draw.
- Add a permanent ground mark: queue a stamp and burn it into the decal map (`client/render/decal-map.md`).
- Add a ground mark that changes each frame: add a uniform array like `u_fields` and pack it in `TerrainPass.draw`.
