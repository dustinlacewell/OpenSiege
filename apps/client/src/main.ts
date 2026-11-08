import { LocalHost } from "./app/localHost.ts";
import { loadLibrary } from "./app/mapAssets.ts";
import { startClient } from "./app/start.ts";
import { skirmishDraws } from "./game/skirmish/mapLibrary.ts";
import { localStorageSlot } from "./settings/localStorageSlot.ts";
import { byId } from "./ui/dom.ts";
import { StartScreen } from "./ui/startScreen.ts";

const host = new LocalHost({ onHome: () => start.show() });
/** Starts an offline match and takes the start screen away, unless it did not start. */
const play = (begin: () => void) => {
  begin();
  if (host.active()) start.hide();
};
startClient(host);
const start = new StartScreen(
  byId("start"),
  { draws: skirmishDraws(await loadLibrary()), nameSlot: localStorageSlot("mobilefront.name") },
  {
    onPlay: (setup) => play(() => host.skirmish(setup)),
    onTutorial: () => play(() => host.tutorial()),
    onSandbox: () => play(() => host.sandbox()),
  },
);
