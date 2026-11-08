Source: packages/ai/src/terrain/hold.ts

# Hold spot

`holdSpot(study, site, front)` picks where the idle tanks hold the line. The base plan uses it as the staging spot (`../base.md`).

1. Take the study road from the site to the front (`study.md`).
2. Keep the road cells from 500 to the lesser of 3000 and 60% of the road length, measured along the road from the site. So the line stays on our side.
3. Score each cell and take the best:
   - plus its flow (`flow.md`), times `FLOW_W`;
   - plus its height edge facing the front over the tank siege range of 800 (`height-edge.md`), divided by 800, times `EDGE_W`;
   - minus its width divided by the widest kept cell, times `WIDTH_W`. Wide ground is harder to hold.

All three weights are 1. With these, the bot scored 164-36 against legacy on seeds 501-600, from 160-40 with the 700-step rule.

The result is undefined when the road is too short to hold a cell or there is no road. The base plan then uses the default rule.

A ridge crest on the road wins over flat ground. Behind a wall with one gap, the spot lands just before the gap on our side.
