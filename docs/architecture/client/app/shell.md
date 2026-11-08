Source: apps/client/src/app/shell.html, apps/client/src/app/shell.css

# Page shell

The shell is the markup and the styles of everything the client draws except the start screen. `startClient` imports `shell.html` as raw text (`?raw`) and inserts it at the top of `<body>`. `shell.css` loads with it. A page that uses the client imports the styles from `@mf/client/shell.css`.

The element ids the code looks up, and the style classes, are listed in `client/ui/markup.md`.

## Contents of shell.html

- The WebGL canvas `#game`, the Controls button `#help-button` and the Settings button `#settings-button`.
- The settings modal `#settings` and the pause menu `#pause`.
- The game HUD `#game-hud`: top bar, tutorial prompt, leaderboard, console (minimap, unit panel, command card) and the eliminated banner.
- The pick layer `#pick-marks` and the pick panel `#pick`.
- The end card `#end`.

## Rules

- The shell holds no start screen and no skirmish card. A page lays its own screens over the canvas, in the same `.screen` class.
- `byId` throws at startup if an id is missing.
- Do not put game logic in the markup.
