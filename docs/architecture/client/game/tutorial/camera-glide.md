Source: apps/client/src/game/guideCamera.ts, apps/client/src/app/frameLoop.ts

# Tutorial camera glide

When a tutorial step starts, the camera glides to what the step points at. While the step's `follow` list is not empty, the camera tracks those units.

- `lookPoint(view, world)` is pure. It returns the middle of the step's living focus units, since those are what the player clicks. With no living focus unit, it returns the middle of the zones; with no zone either, the middle of the gesture ends. With nothing to look at, it returns null and the camera stays put.
- `GuideCamera.update(view, world, cam, dt)` runs once per frame in the loop, after `goHome`. A new step index starts a glide. Each frame the camera covers `1 - e^(-4·dt)` of the remaining distance, through `centerOn`, so it stays on the map.
- The glide ends when the camera is within 15 world units of the target.
- The glide also ends when the player pans. The glide remembers where it left the camera. If the camera has moved since, the player moved it, and the glide stops.
- A follow starts when `view.follow` goes from empty to not empty. It takes the camera again, even after a pan earlier in the step. Each frame its target is the middle of the living followed units. It does not end on arrival. A pan ends it. When the list goes empty, the camera finishes its glide to the last target and stops.
- A normal match has no guide view, so nothing glides.
