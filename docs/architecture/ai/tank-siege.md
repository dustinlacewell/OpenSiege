Source: packages/ai/src/plan/siege.ts, packages/ai/src/plan/army.ts

# Tank siege

Siege takes a tank 1 s. A sieged tank does 45 damage at range 800, against 30 at range 700 when mobile, and takes half damage. That roughly triples its fight value. So in contact, siege almost always improves the outcome.

## Squads

`shouldSiege(state, centre, known, tick)` is a pure function. It is true when the squad is attacking or defending, and a known armed enemy (tank, artillery, or a contact of unknown kind) was seen within tank siege range (800) of the squad centre in the last `HOLD` (50) ticks.

While it is true, every member gets `siege on`. When it turns false, the members get their goto again, and the emitter packs them before the move. A retreating or gathering squad never sieges. A squad that starts to retreat packs and leaves at once.

The siege task wins over focus fire (`ai/army.md`).

## Pool

Idle pool tanks are the held line at staging, which faces the front. Their goto to staging has `siege` set, so they deploy on arrival. During a raid the pool drives to the raid without `siege`.
