Not built. Part of the hierarchical bot proposal (shape.md). The game rules that give an edge, and whether the bot uses them.

# Mechanics

The bot is `packages/ai/src`. The legacy bot (`packages/ai/src/legacy/`) is not part of this study. One tick is 100 ms. Sim files are under `packages/sim/src`. Unit numbers are from `packages/sim/data/unitStats.json`.

## Economy

- **A harvester earns only inside a field disc, and earns 5 times more sieged.** Mobile: 1 credit per tick. Sieged: 5 credits per tick (`systems/harvest.ts`, `units.ts` `workRateOf`). Deploy takes 15 ticks. There is no trip back to the factory. The factory can stand anywhere.
  Edge: a sieged harvester pays back its 300 credits in 60 ticks of work. Harvester count is the economy.
  Bot: uses (`plan/economy.ts` sends each harvester to a field with `siege: true`).
- **Fields hold 5000 credits and refill very slowly.** A field refills 1 credit every 10 ticks (`systems/fieldRegen.ts`, `world.ts` `FIELD_AMOUNT`). One sieged harvester empties a full field in 1000 ticks. Field radius is 400 to 700.
  Edge: credits on the map are finite. Early claims of many fields decide the late game. Two harvesters on one field double its rate until it is dry.
  Bot: partly. The commander asks for up to 3 harvesters per field (`command/field.ts` `MAX_SLOTS`). The economy plan puts only 1 on each field (`plan/economy.ts` `PER_FIELD = 1`). Extra harvesters wait at staging. A harvester on a dry field waits for the refill (`drainedField`).
- **Start credits are 600.** (`stats.ts` `START_CREDITS`).
  Edge: the first two buys set the income curve. Two harvesters first is the fastest start.
  Bot: partly. The first buy comes from goal scores (`plans/asks/economy.ts`, `produce/choose.ts`). No opening rule exists.
- **The start spot is chosen before the round.** (`start/pickStartSpot.ts` reads field wealth and distance to enemy spots.)
  Edge: rich, far ground gives more income and more time.
  Bot: uses (`start/pickStartSpot.ts`).
- **Scrap pays back 50% of the dead unit's cost.** A dead unit leaves scrap with `scrapHp` hp. An engineer with a reclaim order takes `workRate` hp per tick (3 mobile, 2 sieged) and pays its owner (`features/reclaim.ts`, `systems/repair.ts`, `stats.ts` `RECLAIM_PERCENT`). Scrap of either side is free to take. Values: factory 2250 credits, artillery 200, harvester 150, tank 125, engineer 100. A mobile engineer takes a factory scrap in 334 ticks (6.7 credits per tick). That is more than one sieged harvester.
  Edge: a won fight and a killed factory pay back. Scrap on a battlefield is a second income.
  Bot: no. The bot never sends a reclaim intent.
- **Shells and crushing destroy scrap.** Scrap that splash takes to 0 hp turns to wreckage and pays nothing (`systems/reap.ts`, `features/featureDamage.ts`).
  Edge: a player can deny scrap to the enemy by shelling it.
  Bot: no.

## Production

- **A sieged factory builds 4 times faster.** Mobile: 1 work per tick. Sieged: 4 work per tick (`systems/production.ts`, `units.ts`). Deploy takes 30 ticks. Tank: 240 work. Factory: 1200 work.
  Edge: a sieged factory makes a tank in 60 ticks, a mobile one in 240.
  Bot: uses (`plan/base.ts` `standAt` sieges the factory at its site).
- **Cost is paid at enqueue, and a cancel refunds it in full.** (`jobs.ts` `enqueueJob`, `intents/cancel.ts`.)
  Edge: a long queue locks credits. A cancel frees them at no loss.
  Bot: uses. It keeps 2 jobs per factory and cancels stale jobs, never the head job (`produce/produce.ts`, `produce/stale.ts`).
- **Engineers speed up a factory job.** A sieged engineer adds 2 work per tick. A mobile engineer adds 1 work every 4 ticks (`boost.ts`, `stats.ts` `BOOST_SIEGED`, `BOOST_MOBILE_EVERY`). An engineer boosts only when no hurt friendly is in reach (`systems/repair.ts`).
  Edge: two sieged engineers make a sieged factory 2 times faster.
  Bot: uses. Engineers not guarding the squad siege on a ring round the factories, spread evenly, within work range (`plan/support.ts`). The ask counts them (`plans/asks/buildSpeed.ts`). Fixed: 160-40 against legacy on seeds 501-600, from 140-60.
- **No factory means the player is out.** All other units are removed at once (`systems/elimination.ts`).
  Edge: factories are lives. A second factory is insurance and doubles the build rate.
  Bot: uses (`plans/asks/base.ts`, `command/protect.ts`, `worth/unit.ts` `factoryWorth`).
- **The factory is a mobile unit.** Speed 12, heavy class, 2000 hp, 60% damage taken when sieged (`unitStats.json`).
  Edge: the base can move to the fields, or away from guns.
  Bot: uses (`plan/base.ts` moves the site behind the front and away from shelling).
- **New units guard the factory unless a rally is set.** Harvesters with no rally stay idle (`systems/production.ts` `firstOrders`).
  Edge: none by itself.
  Bot: uses (`plan/base.ts` sets the rally on staging).

## Combat

- **Height adds range.** Effective range is base range plus the shooter's height above the target, capped at +50% (`weapons.ts` `effectiveRange`, `targeting.ts`). Terrain peaks at 900. A sieged tank on a hill reaches 1200, a sieged gun 3300.
  Edge: a unit on high ground hits first, and the low unit cannot answer.
  Bot: partly. The map study measures the height edge, and the held line at staging picks a cell with edge toward the front (`terrain/edge.ts`, `terrain/hold.ts`). Threat reach still uses base range only (`assess/threat.ts` `reachOf`).
- **Direct fire needs a clear arc.** A tank shell flies the lowest arc within 20 degrees that clears the terrain (`launch.ts` `solveDirect`, `arc.ts`). Rocks, boulders and scrap stop a direct shell (`features/featureHit.ts`, `systems/projectiles.ts`). With no arc, a unit does not fire (`fireable.ts` `canFire`).
  Edge: a ridge or a rock line is cover from tanks.
  Bot: no. The bot does not know cover. The sim drives an attacking unit closer until it has an arc (`systems/movement.ts` `closeForArc`).
- **Artillery lobs over hills and features.** A ballistic shell takes the first arc that clears the terrain. Features do not stop it (`launch.ts` `solveBallistic`, `systems/projectiles.ts`).
  Edge: artillery hits units in cover from tanks.
  Bot: partly. The sim does the aim. The bot does not place guns for it.
- **Artillery shells are slow.** Shell speed 55 per tick. A shot at 2200 flies 40 ticks. A mobile tank drives 1200 in that time. Splash is 180 (`unitStats.json`, `launch.ts`).
  Edge: artillery kills still targets: sieged units, harvesters, factories. It misses mobile ones.
  Bot: no. The sim picks the nearest target (`systems/combat.ts`). The bot does not steer guns onto still targets. The power model gives sieged artillery a flat 1.5 splash bonus (`assess/power.ts`).
- **Artillery has a minimum range of 300.** (`weapons.ts`, `holdBand.ts`.) Mobile artillery has 600 range, 15 damage, 20 ticks reload.
  Edge: a tank that closes inside 300 is safe from that gun.
  Bot: no. The power model ignores minimum range. The guns trail the squad by 500 (`plan/artillery.ts`).
- **Splash and death blasts hurt every unit, own team included.** (`blast.ts`, `systems/deaths.ts`.) Death blasts: factory 500 within 180, harvester 150 within 100, tank 125 within 80.
  Edge: a tight clump takes extra damage. A dying factory hurts its own guard.
  Bot: no. The squad gathers to 700 spread with no minimum gap (`plan/squads.ts`).
- **Range numbers.** Mobile tank 700. Sieged tank 800. Mobile artillery 600. Sieged artillery 2200 (`unitStats.json`).
  Edge: a sieged tank hits a mobile tank for 100 units of approach before the mobile tank can answer.
  Bot: partly. The siege decision compares power, not range (`plan/siege.ts`). It checks only enemy guns that outrange it (`outranges`).
- **Attack-move engages within range plus 300 and breaks off past range plus 600 or 900 from the anchor.** (`systems/engage.ts`, `stats.ts` `ENGAGE_START`, `ENGAGE_END`, `ENGAGE_LEASH`.)
  Edge: none by itself. It sets how far a squad chases.
  Bot: uses (`emit/emit.ts` sends `attack: true` moves).
- **A unit loses a target it cannot detect.** An attack becomes a move to the last spot (`systems/lostTargets.ts`).
  Edge: a jammer or a hill breaks enemy focus fire.
  Bot: no. The bot does not try to break detection.

## Siege

- **A sieged tank is 1.7 times as strong.** Damage 45 against 30, range 800 against 700, damage taken 50% (`unitStats.json`, `damage.ts`). Deploy and pack take 10 ticks each.
  Edge: a sieged line beats an equal mobile force that walks into it.
  Bot: uses (`plan/siege.ts` `shouldSiege`, `assess/power.ts` counts siege armor).
- **A sieged gun reaches 2200 with 36 damage.** Mobile: 600 and 15. Deploy and pack take 25 ticks each.
  Edge: guns must deploy to matter. Each move costs 50 ticks of no fire.
  Bot: uses (`plan/artillery.ts` deploys when a known enemy is within 90% of 2200).
- **A sieged unit cannot move and cannot be pushed.** (`systems/separation.ts` `roleOf`, `systems/modes.ts`.) A move order packs it first.
  Edge: a sieged line blocks a road. A flanking enemy gets free shots during the pack.
  Bot: partly. Choices hold for 80 ticks to stop flip-flop (`plan/follow.ts`). Squads do not siege when the enemy moves away (`plan/siege.ts` `receding`).
- **A sieged mine is invisible.** Enemies cannot detect it by sight or radar (`detection.ts` `classify`, `siegeHidden`). Its blast is 600 within 200. A mobile mine blasts for 500 (`systems/deaths.ts` `deathDamageOf`).
  Edge: a 150-credit mine can kill a 250-credit tank, and the enemy cannot shoot it first.
  Bot: no. The bot never builds mines. It learns of an enemy mine only from losses (`danger/scar.ts`).

## Terrain

- **Slope changes speed.** Uphill speed falls to 45% at a 40% grade. Downhill speed rises to 115%. Climbers keep 85% uphill (`slope.ts`, `nav/moveClass.ts`).
  Edge: a defender on a hill gets reinforcements faster than the attacker climbs.
  Bot: no.
- **Steep cells block movement.** Light units stop above 38% grade, heavy above 36%, climbers above 80% (`nav/moveClass.ts`). The sim plans routes around blocked cells (`nav/route.ts`).
  Edge: cliffs make choke points. Mines (climbers) take routes tanks cannot.
  Bot: partly. The map study knows blocked ground, pass width and traffic flow (`terrain/study.ts`, `terrain/flow.ts`). Only the staging spot uses it. Other goals are straight lines, and danger is measured on straight lines (`danger/query.ts` `dangerAlong`).
- **Water halves speed.** Every unit keeps 50% speed in water. Sea level is the lowest vertex plus 60 (`terrain/water.ts`, `systems/movement.ts`).
  Edge: a unit in water is a slow target. A river crossing is a trap.
  Bot: partly. The start spot avoids water (`start/pickStartSpot.ts`). Plans do not.
- **Trees slow units to 55%.** Heavy units (the factory) crush them. Trees do not block shots or sight (`features/featureStats.ts`, `features/featureSlow.ts`, `systems/crush.ts`).
  Edge: forests slow an attack.
  Bot: no.
- **Rocks and boulders block movement and direct shots.** Rocks cannot be destroyed. Boulders have 400 hp. Scrap blocks too (`features/featureStats.ts`).
  Edge: they are cover from tanks, and wrecks build new cover in a fight.
  Bot: no.
- **Blasts dig craters.** A blast lowers the ground by up to 24 (`terrain/crater.ts`).
  Edge: small. Long shelling can lower a hill.
  Bot: no.

## Sight and detection

- **Sight needs a clear terrain line.** A unit sees an enemy within `sight` only if no terrain rises above the line from its eye (ground plus model height) to the enemy's top (`detection.ts` `sees`, `lineOfSight.ts`). Sight: factory 900, tank 900, artillery 800, engineer 800, others 700.
  Edge: a hill hides an army. A unit on a hill sees farther over ridges.
  Bot: partly. The bot reads sim detection (`perception/picture.ts`). It ignores the terrain line when it clears ghosts and marks cells explored (`memory/ghosts.ts` `seenEmpty`, `memory/explored.ts`). A ghost behind a hill is forgotten as if seen empty.
- **Radar detects through hills, and a radar contact can be shot.** Radar shows a contact with no kind (`detection.ts`). Targeting accepts any detected enemy, radar included (`targeting.ts` `detectedEnemy`). Radar: factory 2600, radar truck 1600 and 2600 sieged, artillery 1800, engineer 1800, tank 1600, harvester 1400.
  Edge: a sieged radar truck lets sieged guns shell to their full 2200 with no line of sight.
  Bot: partly. Radar contacts become ghosts, and guns deploy on them (`memory/ghosts.ts`, `plan/artillery.ts`). One radar truck follows the main squad and sieges 800 behind it (`plan/support.ts`). A contact of unknown kind counts as 0.6 of a tank (`assess/power.ts`).
- **A jammer hides its own team from radar.** Units within 800 of a friendly jammer (1100 sieged) cannot be detected by radar. Sight still detects them (`detection.ts` `jammed`).
  Edge: a jammed squad cannot be shelled from beyond sight range. Enemy guns lose their radar targets.
  Bot: no. The bot never builds jammers.
- **Height helps sight.** The eye stands on the ground under the unit (`detection.ts` `sees`).
  Edge: a spotter on a hill sees into valleys.
  Bot: no.

## Support units

- **Engineers heal.** Mobile: 3 hp per tick within 200. Sieged: 2 hp per tick within 600 (`systems/repair.ts`, `units.ts` `workReachOf`). Healing comes before boost. A guarding engineer heals the most hurt friendly within 700 of its target (`guard.ts` `guardPatient`).
  Edge: two engineers on a sieged line return hp faster than a tank deals it.
  Bot: partly. Two engineers guard the main squad's lead tank. The rest siege at the factories (`plan/support.ts`). The power model does not count healing.
- **Guards follow, engage and repair near their target.** A guard engages enemies within 700 of the unit it guards (`guard.ts`, `stats.ts` `GUARD_RANGE`).
  Edge: a guard keeps up with a moving factory with no new orders.
  Bot: partly. Engineers use guard (`plan/support.ts`). Tanks do not guard the factory.
- **Radar trucks and jammers.** See Sight and detection. Cost 250 each, 120 hp.
  Bot: radar partly, jammer no.
- **Mines.** Cost 150, 80 hp, speed 40 (the fastest unit), climber class. A mobile mine on an attack-move goes for the densest crowd of enemies (`systems/engage.ts` `densestEnemy`). It triggers at 110 (`systems/combat.ts`).
  Edge: a cheap, fast answer to clumped harvesters and guns.
  Bot: no.

## Movement

- **Turning slows a unit.** Speed falls to 50% at about 60 degrees off the heading, and to 12% beyond (`systems/movement.ts` `turnSpeedPct`). Turn rates differ: engineer 14, tank 8, artillery 5, factory 3.
  Edge: small. A slow-turning unit is easy to flank.
  Bot: no.
- **Speeds differ by kind.** Mine 40, engineer and radar truck 32, tank 30, artillery 20, harvester 18, factory 12 (`unitStats.json`).
  Edge: tanks can catch artillery and harvesters. Guns lag the squad.
  Bot: partly. The squad gathers when it is strung out past 1400 (`plan/squads.ts`). Guns trail 500 behind (`plan/artillery.ts`).
- **The sim routes moves around blocked ground.** (`nav/route.ts`, `nav/astar.ts`.) Attack, engage and guard drive straight at the target (`systems/movement.ts`).
  Edge: a route can be much longer than the straight line.
  Bot: partly. The staging spot walks the study road to the front (`terrain/path.ts`, `terrain/hold.ts`). Other distances and roads are straight lines (`plan/base.ts` `dangerAlong`, `plan/targets.ts`).

## Biggest gaps

- **Height and cover.** Partly done. Height adds up to 50% range, and ridges block tank fire. The held line at staging now picks ground by height edge, flow and width (`terrain/hold.ts`); squads and guns still do not, and the bot does not know cover.
- **Radar plus sieged guns, and jammers.** Shelling at 2200 on radar contacts wins fights at no risk; the bot does not build for it and has no jammer to stop it.
- **Mines.** A hidden 150-credit mine kills a 250-credit tank; the bot builds none and cannot detect enemy ones.
- **Reclaim.** Scrap pays 50% of cost, a factory 2250 credits; the bot takes none.
- **Harvesters per field.** The economy plan caps one harvester per field, so asked-for harvesters stand idle at staging. A cap of 3, the same as the ask, scored 96-104 against legacy on seeds 501-600, from 140-60, and was reverted.
- **Engineers never siege.** Fixed: the rest siege at the factories (`plan/support.ts`).
