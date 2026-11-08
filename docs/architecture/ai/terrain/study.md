Source: packages/ai/src/terrain/study.ts, packages/ai/src/terrain/grid.ts, packages/ai/src/terrain/layers.ts, packages/ai/src/terrain/terminals.ts, packages/ai/src/terrain/path.ts, packages/ai/src/terrain/heap.ts

# Map study

The map study is what the bot knows of the ground. `studyMap(world)` builds it once per match. `createBot` makes it on the first live think and keeps it in its closure. `decide` passes it to `buildBoard`, which puts it on the board as `board.study` (`../board.md`).

Only craters change the terrain after the start. The study ignores them.

## Grid

The study grid has cells of 250 (`STUDY_CELL`), row-major. A 16000 x 12000 map is 64 x 48 cells. `grid.ts` holds the cell helpers and the 8-neighbour walk. An orthogonal step costs 10 and a diagonal 14. A diagonal step needs both orthogonal cells open, so no road cuts a blocked corner.

## Layers

Each layer is a typed array with one value per cell.

- `passable`: 1 where a tank drives. The study builds the sim's own nav state (`createSimState`) and reads the "light" grid. A study cell is passable when more than half the nav cells inside it are open. Water is open in the sim, so it is open here.
- `width`: steps to the nearest blocked cell or the map edge. Blocked cells are 0. A low width is a narrow pass.
- `height`: `heightAt` at the cell centre.
- `flow`: 0..1, the traffic through the cell (`flow.md`).

## Terminals

Flow runs between terminals (`terminals.ts`). Fields within 1500 of each other merge into one cluster. A cluster terminal stands at the mean place of its fields and weighs the credits in them. Each player's first factory is a spawn terminal. A spawn weighs the mean cluster wealth.

## Road

`studyPath(study, a, b)` gives the cell centres of the shortest passable road from a to b. `studyCells` gives the cells. Both use A* with the octile distance. Each end snaps to the nearest passable cell. With no road the result is empty.

## Cost

A 16000 x 12000 map with 30 fields studies in about 25 ms. A 16000 x 16000 map with 40 fields takes about 70 ms.
