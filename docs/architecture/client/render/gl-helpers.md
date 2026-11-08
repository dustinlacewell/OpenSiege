Source: apps/client/src/render/gl.ts, apps/client/src/render/glState.ts, apps/client/src/render/fullscreen.ts, apps/client/src/render/tilingTexture.ts, apps/client/src/render/instances.ts

# GL helpers

Small shared pieces every pass uses.

## gl.ts

- `createContext(canvas)`: WebGL2, no antialias, no depth, no alpha.
- `createProgram(gl, vs, fs)`: compiles and links. Throws with the info log and the source on failure.
- `uniform(gl, program, name)`: `getUniformLocation`. Returns null for an unused uniform. Setting a null location is a no-op.
- `createQuad(gl)`: static buffer of a -1..1 quad as two triangles (6 vertices).
- `staticBuffer(gl, target, data)`: creates, fills with `STATIC_DRAW`, leaves bound.
- `vertexLayout(gl, sizes)`: interleaved float attributes at locations 0, 1, 2... for the bound buffer and VAO.
- `fitCanvas(canvas, dpr)`: sets the drawing buffer to CSS size times `dpr`. Returns true if it changed.

## glState.ts

One function per blend and depth state. Each pass calls one before drawing.

| Function | Depth test | Depth write | Blend | Used for |
|---|---|---|---|---|
| `opaque` | yes | yes | off | terrain, units |
| `shadowCaster` | yes | yes | off, polygon offset | shadow map |
| `decal` | yes | no | alpha, offset toward camera | contact shadows, order lines |
| `translucent` | yes | no | alpha | smoke puffs |
| `surface` | yes | yes | alpha | water |
| `stamp` | no | no | one, one − src colour (saturating add) | decal map stamps |
| `accumulate` | no | no | one, one (signed sum) | ripple splats |
| `additive` | yes | no | one, one | billboards |
| `overlay` | no | no | alpha | ground rings, screen bars |
| `fullscreen` | no | no | off | sky, post, tiling textures |

## fullscreen.ts

`FULLSCREEN_VS` makes one triangle from `gl_VertexID` and outputs `v_ndc`. `FullscreenTriangle.draw()` binds an attribute-less VAO and draws 3 vertices.

## tilingTexture.ts

`createTilingTexture(gl, tri, fs, size)` draws a square `RGBA8` texture once with a fullscreen fragment shader that reads `u_size`. Then it makes full mipmaps and sets `REPEAT` wrap and anisotropic filtering (up to 16). The ground detail texture and the water normal texture use it.

## instances.ts

- `InstanceBuffer(gl, stride, capacity)`: see `client/render/units.md`.
- `bindQuad(gl, quad)`: binds the shared quad as attribute 0 of the current VAO.

Attribute location convention for quad passes: corner at 0, instance data from 1 up. For units, mesh data is 0 to 2 and instance data 3 to 5.

## Rules

- Each pass builds its program, VAO and buffers in its constructor, never per frame.
- Free GL objects when replacing them (the terrain mesh and the HDR target do).
- Keep `STRIDE` constants, instance writers and `bindAttributes` sizes in step.
