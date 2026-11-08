Not built. Concept only.

# Material layer and palette

Ground colour today is procedural noise from height and slope (`ground()` in `terrainShader.ts`). No data backs it. A painted palette needs data.

## Data

- A weight map: per terrain cell, a few material weights (for example grass, dirt, rock, sand). Four weights fit one RGBA8 texture.
- A palette: the colour set and noise settings for each material.

## Render

- Upload the weight map as a texture. Sample it with linear filtering.
- `ground()` blends the materials by weight. The procedural noise stays as detail on top.
- Mirror-repeat sampling lets the surround reuse it (`mirrored-surround.md`).
- The editor updates a dirty rectangle of the texture while you paint.

## Sim

The material layer is visual only. The sim never reads it.
