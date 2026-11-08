Source: apps/client/src/ui/pickView.ts, apps/client/src/game/placement.ts, apps/client/src/game/picking.ts

# Pick screen

Shown on `screens.picking(placement)` (`client/game/placement.md`). The terrain is drawn full screen (`client/app/pick-scene.md`). A 240 px panel sits at the top centre. The player pans and zooms with the normal controls and left-clicks the ground to choose a spot. The click calls `placement.onPick`; a new click moves the spot.

## PickView

`new PickView()`. `Screens` builds it. It reads a `Placement`.

- `show(placement)` shows the panel and the marker layer. `hide()` also removes the markers.
- `update(now, cam, terrain)` runs every frame of the pick screen, called by the frame loop through `Screens.drawPick`. It reads `placement.view(now)`, writes the title and countdown (hidden when empty), rebuilds the list only when the rows change, and moves the markers.
- The list shows each name in its team colour with a check once picked. The local row has class `me`.
- A marker is a DOM dot with the name below. `project` (`game/picking.ts`) turns the spot, at ground height, into screen pixels. Behind the camera it hides. The local marker is larger with a gold ring.
- `#pick-leave` calls `placement.leave()`.

## What the host supplies

The view model is the host's. `PickView` does not know where the data comes from. For the skirmish it is constant (`client/game/skirmish/placement.md`).
