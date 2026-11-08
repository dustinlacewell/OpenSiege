Source: packages/sim/src/features/featureIndex.ts, packages/sim/src/simState.ts

# Feature index

`FeatureIndex` is a static spatial hash over `world.features`, in `SimState.features` beside `nav`. It is derived: `createSimState` builds it from the world, so a late joiner builds the same one. It is not in `World`, the snapshot or the hash.

- `createFeatureIndex(features, m)` takes the map size `m`. Buckets are 500 world units: `ceil(width / 500)` by `ceil(height / 500)` (32 x 32 on the default map). A feature sits in the bucket of its centre. A feature that overhangs the edge sits in the edge bucket. Each bucket keeps id order.
- `query(x, y, r, out)` fills `out` with the features of the buckets that cover the square (x, y) ± (r + `MAX_FEATURE_RADIUS`), bucket by bucket, row by row. Every circle that touches the square ± r is in. The caller checks exact distance. The order is fixed.
- `remove(f)` drops one feature. `reap` calls it.
- `add(f)` appends one with an id above all in the index. Placement uses it for the spacing test. The sim never adds features while playing.

Users: `slowPercentAt`, `crush`, `featureHit`, `splashFeatures`, and `place.ts`. Each passes its own scratch array.
