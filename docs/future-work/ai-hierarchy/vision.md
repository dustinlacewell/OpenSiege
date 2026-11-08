Not built. Part of the hierarchical bot proposal (`shape.md`).

# How the bot wins

## The game, read as an economy

- A player is out when all its factories are dead. Each factory is a life.
- A sieged harvester earns 5 credits a tick. It costs 300, so it pays for itself 60 ticks after it starts work.
- A field holds 5000 and regrows slowly. One sieged harvester drains it in 1000 ticks. The map holds about 200 000 credits in all. The fields are a race.
- Every unit but the factory costs about 1 credit per tick of build work. So build speed is spend speed.
- A sieged factory builds at 4 a tick. Each sieged engineer on it adds 2 for 200 credits. Engineers are the cheap way to spend income. A new factory is bought for the extra life, not for its build speed.
- A factory moves at 12. A tank moves at 30. A factory cannot outrun tanks.
- Power follows the square law: a force twice as strong wins and keeps most of itself. Split forces lose.

## The plan to win

1. **Out-earn.** Put harvesters on fresh fields near a factory, sieged. Keep build speed at or above income with engineers.
2. **Follow the crystals.** The factory moves to stay near fresh fields, before danger arrives. Its radar and its reserve then cover the harvesters.
3. **Keep the lives.** A factory under tank attack stays sieged. Its engineers heal it, it builds defenders, and the army comes back. A factory moves away only from slow attackers, such as sieged artillery. A second factory comes when one life is at real risk. Factories keep apart.
4. **Trade well.** Keep one main army. Fight only when the square law favours it. Retreat before losing.
5. **Starve the enemy.** Kill enemy harvesters where the enemy is weak. Mine the fields the enemy works.
6. **Take the lives.** When ahead, push to the enemy factories. Artillery out-ranges their guards. Tanks catch a factory that runs.

## One measure: credits

Every score is an expected change in the team's balance, in credits. The balance is own team worth minus enemy worth.

### Worth

- **A unit** is worth its cost times its hp fraction.
- **Lost income.** A dead harvester also costs the income it would earn until a new one replaces it: the build time plus the trip, about 250 ticks, or about 1250 credits. Income is not counted over a long horizon. This keeps a harvester near the worth of a few tanks, not of a factory.
- **A factory** is worth its cost, plus the build work lost until a new factory replaces it, plus a life premium.
- **The life premium** of a factory is the player's total worth divided by its lives. Losing the last life loses everything, so the last factory is worth the whole player. No knob sets it.

### The enemy under fog

The bot cannot see the enemy's worth. It estimates it:

- Enemy worth is the larger of what it has seen and a guess from time: the start credits plus elapsed ticks times a typical income, minus the enemy worth the bot has killed.
- Enemy lives are the distinct factories it remembers, at least 1.

### Chance

A fight's chance comes from the power ratio `r` = own power ÷ enemy power: `p = r² ÷ (1 + r²)`. Enemy power comes from the danger map. The expected loss of a goal is the worth it puts at risk times `1 − p`.

## Phases come out of the scores

The bot needs no phase switch.

- Early, harvesters score highest, because they pay back fast.
- Mid, army scores rise, because fields need cover and enemy harvesters are worth killing.
- Late, the enemy's last factory carries the enemy's whole worth, so hunting it rises to the top.
