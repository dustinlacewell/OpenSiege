// The client's entry: mounts the game shell and runs the frame loop. A host feeds it the match and takes its intents.
import { TICK_MS, type Intent } from "@mf/sim";
import { AudioEngine } from "../audio/audioEngine.ts";
import { DEFAULT_TUNING } from "../audio/defaultTuning.ts";
import { unlockOnGesture } from "../audio/unlock.ts";
import { withActionSounds, withIntentSounds } from "../audio/uiHooks.ts";
import { WorldSounds } from "../audio/worldSounds.ts";
import { AutoSiege } from "../game/autoSiege.ts";
import { createCamera } from "../game/camera.ts";
import { Session } from "../game/session.ts";
import { GuideSlot } from "../game/tutorial/guide.ts";
import { Vision } from "../game/vision.ts";
import { createActions } from "../input/actions.ts";
import { Input } from "../input/input.ts";
import { Renderer } from "../render/renderer.ts";
import { localStorageSlot } from "../settings/localStorageSlot.ts";
import { SettingsStore } from "../settings/settingsStore.ts";
import { byId } from "../ui/dom.ts";
import { Hud } from "../ui/hud.ts";
import { escapeAction } from "../ui/pauseModel.ts";
import { PauseOverlay } from "../ui/pauseOverlay.ts";
import { Screens } from "../ui/screens.ts";
import { SettingsModal } from "../ui/settingsModal.ts";
import { ClientLink } from "./clientLink.ts";
import { startLoop } from "./frameLoop.ts";
import type { MatchHost } from "./matchHost.ts";
import shellHtml from "./shell.html?raw";
import "./shell.css";

export type { EndKind, MatchHost, MatchLink } from "./matchHost.ts";
export type { Placement, PlacementMark, PlacementRow, PlacementView } from "../game/placement.ts";

export interface ClientOptions {
  /** The label of the end card's button after a match. */
  endLabel?: string;
}

export interface RunningClient {
  /** Stops the frame loop and drops the match. */
  stop(): void;
}

const DEFAULT_END_LABEL = "Continue";

/**
 * Mounts the shell markup at the top of the page, builds the client and runs it. `host` runs the match.
 * The canvas shows the backdrop whenever no match or placement is on; a page lays its own screens over it.
 */
export function startClient(host: MatchHost, options: ClientOptions = {}): RunningClient {
  document.body.insertAdjacentHTML("afterbegin", shellHtml);
  const canvas = byId<HTMLCanvasElement>("game");
  const settings = new SettingsStore(localStorageSlot("mobilefront.settings"));
  const settingsModal = new SettingsModal(settings);
  byId("help-button").addEventListener("click", () => settingsModal.open("controls"));
  byId("settings-button").addEventListener("click", () => settingsModal.open("graphics"));
  const session = new Session();
  const cam = createCamera(canvas.clientWidth, canvas.clientHeight);
  const vision = new Vision();
  /** The one guide input, HUD and loop ask. NO_GUIDE outside the tutorial. */
  const guide = new GuideSlot();

  /** Nothing goes out while a spectator looks through another player's eyes. */
  const sendIntent = (intent: Intent) => {
    if (!session.viewing) host.intent(session.self, intent);
  };
  const pause = new PauseOverlay({
    onResume: () => pause.hide(),
    onSettings: () => settingsModal.open("graphics"),
    onLeave: () => host.leave(),
  });
  /** Esc with no target mode to leave: close the settings modal, else the pause menu, else open it in a match. */
  const onIdleEscape = () => {
    const action = escapeAction({ settingsOpen: settingsModal.isOpen(), pauseOpen: pause.isOpen(), inMatch: screens.inMatch() });
    if (action === "closeSettings") settingsModal.close();
    else if (action === "resume") pause.hide();
    else if (action === "pause") pause.show();
  };
  const screens = new Screens({
    me: () => session.selfName,
    endLabel: options.endLabel ?? DEFAULT_END_LABEL,
    onBack: () => host.leave(),
    onScreen: () => pause.hide(),
  });
  const link = new ClientLink({ host, session, cam, guide, screens, now: () => performance.now() });

  const audio = new AudioEngine(DEFAULT_TUNING);
  unlockOnGesture(audio);
  const actions = withActionSounds(
    createActions(session, cam, vision, withIntentSounds(sendIntent, session, audio), (x, y) => link.pick(x, y), onIdleEscape, () => settings.get().simpleGroups, guide),
    session,
    audio,
  );
  const input = new Input(canvas, cam, actions);
  const renderer = new Renderer(canvas);
  const hud = new Hud(session, cam, actions, renderer.portraits, vision, guide);

  host.attach(link);
  const cancelLoop = startLoop({
    canvas, session, cam, input, renderer, hud, vision, guide,
    sounds: new WorldSounds(audio, () => audio.tuning, (x, y) => vision.sees(x, y)),
    autoSiege: new AutoSiege(sendIntent, () => (settings.get().autoSiegeSeconds * 1000) / TICK_MS),
    autoSiegeOn: () => !link.tutoring && settings.get().autoSiege,
    renderScale: () => settings.get().renderScale,
    drawPick: (now, c, terrain) => screens.drawPick(now, c, terrain),
  });
  return {
    stop() {
      cancelLoop();
      link.stop();
    },
  };
}
