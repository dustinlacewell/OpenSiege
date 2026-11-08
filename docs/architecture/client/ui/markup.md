Source: apps/client/index.html, apps/client/src/app/shell.html, apps/client/src/app/shell.css, apps/client/src/ui/skirmish/skirmish.css

# Page markup and styles

`index.html` holds only `<div id="start" class="screen backdrop">` and the module script `/src/main.ts`. The rest of the markup is `app/shell.html`, which `startClient` inserts at the top of `<body>` (`client/app/shell.md`). The styles are in `app/shell.css` (shared) and `ui/skirmish/skirmish.css` (the setup card). A page may add its own CSS.

## Element ids the code looks up

- `game`: the WebGL canvas. Fixed, fills the window.
- `help-button`, `settings-button`: the Controls and Settings buttons. `settings`, `settings-panel`, `settings-tabs`, `settings-fields`, `settings-controls`, `settings-close`: the settings modal (`client/ui/settings.md`).
- `pause`, `pause-panel`, `pause-resume`, `pause-settings`, `pause-leave`: the pause menu.
- `game-hud`: the wrapper around every HUD element below, up to `dead-banner` (`hidden` at start, `client/ui/screens.md`).
- `topbar`, `credits`, `units`: the top bar and its two numbers.
- `guide`, `guide-prompt`, `guide-foot`, `guide-step`, `guide-continue`: the tutorial prompt panel and its Continue button (both `hidden` at start, `client/ui/guide-panel.md`).
- `leaderboard`, `lb-list`: the player list (an `<ol>`).
- `minimap`: the 2D canvas, `width` and `height` attributes 200. It sits in `#minimap-box`.
- Unit panel (`#unit-panel`): `unit-single`, `single-portrait`, `single-name`, `single-hp-fill`, `single-hp`, `single-mode`, `single-activity`, `single-readouts`, `unit-multi`, `queue` (inside `#queue-band`).
- Command card (`#command-card`): `palette`, `cmd-siege`, `cmd-siege-label`, `cmd-stop`, `cmd-guard`, `cmd-attack`, `tip-target`, `tip-target-text`, `tip-body`, `tip-name`, `tip-cost`, `tip-time`, `palette-pages`.
- `dead-banner`: the "eliminated, spectating" line (`hidden` at start).
- `start`: the start screen, in `index.html`. The setup card builds its own elements; `skirmish` and `skirmish-map` are its ids (`client/ui/start-screen.md`, `client/ui/skirmish/setup-card.md`).
- Each map tile (`#skirmish-map`) is a `.map-frame` with a `.map-preview` image, a `.map-random` mark and a `.map-name` chip (`client/ui/map-tile.md`).
- `pick`, `pick-title`, `pick-count`, `pick-list`, `pick-leave`, `pick-marks`: the pick panel and the layer for the spot markers (`hidden` at start, `client/ui/pick.md`).
- `end`, `end-panel`, `end-title`, `end-winner`, `end-back`: the end card (`hidden` at start, `client/ui/screens.md`).

`byId` throws at startup if an id is missing.

## Styles

- Panels share class `hud`. The console boxes add `box`: absolute in the fixed `#console`, 216 px tall, 7 px padding.
- `#console` takes no pointer events. Its boxes do.
- Shared pieces: `frame` (a dark bordered image frame), `hp-fill` (`high`, `mid`, `low`).
- Unit panel classes: `unit-name`, `hp-bar`, `hp-text`, `unit-mode` (plus the mode name), `unit-activity`, `readouts`, `readout`, `u-tile` (`more`), `u-bar`, `u-more`, `u-group`.
- Unit panel heights: `#unit-view` 124 px, gap 8, `#queue-band` 68 px. That fills the 200 px inside.
- Queue classes: `q-row`, `q-tag` (`fast`, `slow`, `paused`), `q-tiles`, `q-tile` (`head`, `empty`, `more`, `locked`), `q-fill`, `q-count`, `q-time`, `q-more`.
- Command card classes: `slot` (`off`, `empty`, `locked`, `quota-locked`, `focus`), `slot-cost`, `slot-key`, `cmd-btn` (`on`, `locked`, `focus`), `tip-line`, `tip-hint`, `page-tab` (`on`).
- Guide classes on `.slot`, `.cmd-btn` and `.q-tile`: `locked` is dimmed and grey with a not-allowed cursor. `.slot.quota-locked` dims the quota badge. `focus` is a 2 px gold outline that pulses (`@keyframes focus-pulse`, 1.2 s).
- `#guide` is 420 by 72 px at the top centre, 48 px down, with a gold border. The prompt wraps inside; overflow is cut. It takes no pointer events, except `#guide-continue`.
- `#cmd-actions` is a fixed 2 by 2 grid of 56 by 48 px buttons: Siege and Stop, then Guard and Attack.
- `#tip-target` sits before `#tip-body` in `#tip`. While it shows, a CSS sibling rule hides `#tip-body`.
- Screens: `.screen` is a full-window centred layer. `.backdrop` adds the vignette (clear centre, dark edges) for the start screen. `.dim` is the flat dim layer under the end card.
- `.panel` is the screen panel, in the console colours. `.title` (84 px, `.small` 40 px) is the "OpenSiege" mark; its `span` is gold. `.tagline` is the line under it. `button.primary` is the gold action button. `button.quiet` is a text-only button that underlines on hover. `.segmented` is a joined row of toggle buttons (`on` is gold). `button.slide` is a two-label switch (`role="switch"`): `aria-checked` moves a gold thumb from the first `.slide-opt` to the second. `kbd` is a key cap.
- Roster classes (`client/ui/roster.md`): `section.team`, `.team-head` (a `button` when the player may join), `.team-count`, `ul.seats`, `li.me`, `li.bot`, `.bot-level` (the difficulty), `.bot-remove` (the × button), `.add-bot`, `.seat-tag`, `.seat-note`.
- `.dev-strip` is the muted link strip fixed at the bottom left.
- Fixed sizes: `#skirmish` 720 by 420 px (`#skirmish-map` 280 by 280 px). `#pick` 240 px wide at the top centre, `#end-panel` 320 px.
- Pick marks: `.pick-mark` (`me`) is a dot in the player colour (`--c`) with a name label. `#pick-marks` takes no pointer events, so clicks reach the canvas.
- `img:not([src])` is invisible, so a headshot that is not ready shows the frame only.
- `[hidden] { display: none !important }`.
- `user-select: none` on the page. The canvas takes the pointer.

## Rules

- Console sizes are fixed pixels. Content must fit them; it never resizes a box.
- New panels use class `hud` and a fixed position. They sit above the canvas.
- Do not put game logic in the markup.

## Recipe: add an element

1. Add it in the body with an id.
2. Add its styles in the `<style>` block.
3. Look it up with `byId` from a `ui/` class.

Put the markup in `app/shell.html` and the styles in `app/shell.css` when every page needs the element. Otherwise the page that owns it adds its own.
