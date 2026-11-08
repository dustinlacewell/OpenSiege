Not built. Concept only.

# Editor MapSpec: materials and palette

The sim `MapSpec` is built (`sim/map-spec.md`). It holds width, height, cell, heights, rng, fields and features. The editor adds two fields to it. Neither exists yet.

- `materials`: weights per cell (see `material-layer.md`). Visual only. The sim never reads it.
- `palette`: ground colours per material.

## Depends on

- A map file a match loads instead of a seed (`editor-app.md`).
- The editor's own mirrored surround (`mirrored-surround.md`).
