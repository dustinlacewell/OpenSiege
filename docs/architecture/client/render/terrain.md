Source: apps/client/src/render/terrain.ts, apps/client/src/render/terrainMesh.ts, apps/client/src/render/surround.ts, apps/client/src/render/terrainSampling.ts, apps/client/src/render/lightFrustum.ts, packages/sim/src/terrain.ts, packages/sim/src/mapSize.ts

# Terrain mesh

The sim height map is coarse. The drawn ground is a finer mesh built from it.

## Sim map versus render mesh

- Sim: `terrain.cols` by `terrain.rows` vertices, `terrain.cell` units apart (`sim/terrain.md`). The map is `(cols - 1) * cell` wide and `(rows - 1) * cell` high. `heightAt` is bilinear between the vertices.
- Render: `SUBDIV` = 4 mesh vertices per sim cell on each axis. Spacing is `cell / 4` units. That is `4 * (cols - 1) + 1` vertices on x and `4 * (rows - 1) + 1` on y over the map. The default map (cell 125, 129 by 129) has a spacing of 31.25 and 513 per axis.
- Mesh vertex height is `heightAt(x, y)` from the sim. So every mesh vertex lies on the sim ground, and units and picking agree with the picture.
- Mesh normals are not from the bilinear surface. They come from a Catmull-Rom surface (`smoothHeightAt`) through the sim vertices, by central differences one mesh step apart (`smoothNormal`). That gives smooth shading with no creases at sim cell borders.
- `smoothHeightAt` is for shading only. Never use it for positions or gameplay.

## Mirrored surround

Outside the map, the ground is the whole map reflected across each edge, and those copies reflected again, out into the distance. Corners flip on both axes. A reflection meets its neighbour edge to edge, so any rectangle tiles with no seam.

- A second vertex buffer, at sim resolution (`subdiv` 1), draws the copies: `ringsFor` rings round the map, enough to reach `SURROUND_REACH` (48000 units) past its shorter side, at most `MAX_RINGS` (8). These live in `surround.ts`; the water sizes its grid from them. One instanced draw per ring; ring r has 8r tiles.
- Detail drops by ring (`surroundLod.ts`): ring r uses every `strideForRing(r)`-th vertex (2, 4, 8, then 16). Each index list keeps every vertex on the tile's border and zips a strip between it and the coarse inside, so tiles of any stride, and the map itself, meet with no crack. About 170k triangles on the default map.
- The vertex shader walks instance `k` round its ring and reflects odd tiles (`mirrored`). It negates the normal on a flipped axis. `v_src` is the point on the real map, so paint and scorch read the mirrored spot.
- Along an edge, bilinear heights are linear between sim vertices at any subdivision. The fine and coarse meshes meet with no gap.
- `smoothNormal` reads vertex heights reflected across the edge, so normals on the edge match the copy beyond it.
- Only the map casts shadows. Crystals, features and ground cover are on the map only. The shader still dims the outside.

## Mesh data

`buildTerrainMesh(terrain, subdiv)` returns `{ vertices, indices, xs, ys, subdiv }`, over exactly the map.

- Vertex: position (3) and normal (3), interleaved. Layout `[3, 3]`, locations 0 and 1.
- Indices: two triangles per cell, `UNSIGNED_INT`.

## TerrainPass

- Builds both meshes once per `Terrain` object and uploads each to a VAO. If `draw` or `drawDepth` gets a different `Terrain` object (a new world), the old buffers are deleted and a new mesh is built.
- `updateMesh(terrain, rect)` rewrites, in the kept CPU copy, every mesh vertex that reads the sim vertices in `rect` (3 sim cells of reach, for the bicubic normal), in both meshes. Then it uploads each mesh's rows with one `bufferSubData`. The map editor calls it after it changed heights in place (`client/dev/map-editor.md`). In play, `Renderer.refreshTerrain` calls it with the box `TerrainWatch` takes each frame (`client/game/terrain-watch.md`).
- `draw(terrain, fields, cam, sun, time)`: opaque state, scene uniforms, the detail texture on unit 0, map size, max height, sea level, time, and the field array. The shadow map uses unit 1. The fog of war never touches the terrain (`client/game/vision.md`).
- `drawDepth(terrain, lightViewProj)`: the map mesh only, depth program.
- Field upload: up to `MAX_FIELDS` (64, from `@mf/sim`) fields as `vec4(x, y, radius, amount / FIELD_AMOUNT)`.

Shading is in `client/render/terrain-shading.md`.

## Invariants

- The mesh does not change while the terrain is the same object, unless `updateMesh` is called. Blasts change heights in the sim, in place; the mesh follows through `TerrainWatch` during play, and through the editor's own calls while editing.
- Do not edit a vertex from `heightAt` to a different source. Units would float or sink.
- The mesh size follows the terrain's `cols`, `rows` and `cell`. `MARGIN` in `lightFrustum.ts` is a fixed 1500 units.
