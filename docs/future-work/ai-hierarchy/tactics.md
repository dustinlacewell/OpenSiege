Not built. Part of the hierarchical bot proposal (`shape.md`).

# Tactics

Tactics turn a unit's role in its plan into a task. One rule set per role. Each rule is a pure function of the unit, its plan's state and the board.

## Roles

- **Line (tanks).** Attack-move to the plan goal. Focus fire on the highest-value target in reach. The squad retreats as one when its power falls below the retreat ratio of the enemy power near it. It re-engages only after it passes the attack ratio again.
- **Gun (artillery).** Stay behind the line, out of the enemy's direct range and outside its own minimum range of the target. Siege when the plan holds still.
- **Medic (engineers).** Repair the lowest-hp ally in reach, with factories first. When nobody is hurt, reclaim the nearest scrap that no threat covers. When nothing else, boost the nearest factory.
- **Eye (radar trucks).** Siege behind the line, so the radar reaches past it.
- **Veil (jammers).** Siege between the line and the enemy, so the enemy radar loses the squad.
- **Mine.** Go to its spot on the approach, then siege. It stays hidden there.
- **Charge (mobile mine).** In a raid, drive into a clump of harvesters or guns. A mobile mine is the fastest unit (40), and its blast (500 within 200) hurts every unit near it. It has only 80 hp, so it never charges sieged tanks: they kill it before it closes in.
- **Worker (harvesters).** Siege in the field. Run when the field plan evacuates.
- **Guard (reserve tanks).** Guard the factory, so they follow it when it moves.
