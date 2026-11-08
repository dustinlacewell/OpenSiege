import { emptyMap, propsOf, type EditorMap, type MapEntry, type MapProps } from "@mf/map";
import { mapSize } from "@mf/sim";
import { createCamera, MAX_DIST, setCameraMap, setDistance, type Camera } from "../../game/camera.ts";
import { byId } from "../../ui/dom.ts";
import { BrushInput } from "./brushInput.ts";
import { CameraInput } from "./cameraInput.ts";
import { Editor } from "./editor.ts";
import { EditorKeys } from "./keys.ts";
import { LevelSelectView } from "./levelSelectView.ts";
import { startLoop } from "./loop.ts";
import { fileNameFor, listMaps, loadMap, saveMap, savePreview } from "./mapLibrary.ts";
import { PreviewSchedule } from "./previewSchedule.ts";
import { PropertiesView } from "./propertiesView.ts";
import { nudgeFalloff, nudgeStrength, resizeBrush, scaleBrush, scaleDensity } from "./settings.ts";
import { snapCamera } from "./cameraEase.ts";
import { FpsMeter } from "./fpsMeter.ts";
import { ToolbarView } from "./toolbarView.ts";
import { ToolPanelView } from "./toolPanelView.ts";
import { Viewport } from "./viewport.ts";
import "./editor.css";

// The dev-only map editor, served at /map-editor.html by the Vite dev server.
if (!import.meta.env.DEV) throw new Error("The map editor runs on the dev server only.");

/** How far the camera starts, as a share of the farthest zoom. */
const START_DIST = 0.8 * MAX_DIST;

/** What the New form starts with. */
const NEW_PROPS: MapProps = { name: "New map", width: 16000, height: 16000, cell: 125, baseHeight: 300 };

/** The open map's file in the library, whether it has edits not on disk, and whether the file exists yet. */
interface OpenFile {
  file: string;
  unsaved: boolean;
  onDisk: boolean;
}

/** What the editor reaches outside itself. */
interface Shell {
  current: OpenFile;
  form: PropertiesView;
  previews: PreviewSchedule;
  showLevels(): void;
}

/** The page opens on the level list. The first map picked starts the editor; later picks load into it. */
function main(): void {
  const canvas = byId<HTMLCanvasElement>("view");
  const viewport = new Viewport(canvas);
  const form = new PropertiesView(document.body);
  const current: OpenFile = { file: "", unsaved: false, onDisk: false };
  const previews = new PreviewSchedule();
  let editor: Editor | null = null;
  let entries: MapEntry[] = [];

  /** A map from disk gets a fresh preview at once; a new one gets its first on Save. */
  const open = (map: EditorMap, file: string, onDisk: boolean): void => {
    current.file = file;
    current.unsaved = !onDisk;
    current.onDisk = onDisk;
    levels.hide();
    if (editor) editor.load(map);
    else editor = startEditor(canvas, viewport, map, shell);
    if (onDisk) previews.soon();
  };
  const leaveOk = (): boolean => !current.unsaved || window.confirm("The open map has unsaved edits. Drop them?");
  const levels = new LevelSelectView(byId("app"), {
    onOpen: (file) => {
      if (!leaveOk()) return;
      void loadMap(file).then((r) => (r.ok ? open(r.value, file, true) : levels.showErrors(r.errors)));
    },
    onNew: () => {
      if (!leaveOk()) return;
      void form.ask(NEW_PROPS, "new").then((p) => p && open(emptyMap(p), fileNameFor(p.name, entries.map((e) => e.file)), false));
    },
    onClose: () => levels.hide(),
  });
  const shell: Shell = {
    current,
    form,
    previews,
    showLevels: () => {
      void listMaps().then((r) => {
        entries = r.ok ? r.value : [];
        levels.show(entries, editor !== null, r.ok ? [] : r.errors);
      });
    },
  };
  shell.showLevels();
}

/** Builds the editor around its first map and starts the frame loop. */
function startEditor(canvas: HTMLCanvasElement, viewport: Viewport, map: EditorMap, shell: Shell): Editor {
  const editor = new Editor(viewport, map, Math.random);
  const cam = createCamera(canvas.clientWidth, canvas.clientHeight);
  const target = createCamera(canvas.clientWidth, canvas.clientHeight);
  trackUnsaved(editor, shell);
  setupToolbar(editor, shell);
  setupPanel(editor);
  const keys = setupKeys(editor);
  setupFraming(editor, cam, target);
  const camera = new CameraInput(canvas, target, keys, () => editor.scene.terrain, {
    scale: (f) => editor.update(scaleBrush(editor.settings, f)),
    strength: (d) => editor.update(nudgeStrength(editor.settings, d)),
    falloff: (d) => editor.update(nudgeFalloff(editor.settings, d)),
    density: (f) => editor.update(scaleDensity(editor.settings, f)),
  });
  const brush = new BrushInput(canvas, cam, () => editor.scene.terrain, editor);
  const fps = new FpsMeter(byId("fps"));
  const preview = { schedule: shell.previews, onShot: (shot: HTMLCanvasElement) => uploadPreview(shell.current, shot) };
  startLoop({ canvas, cam, target, viewport, editor, camera, brush, fps, preview });
  return editor;
}

/** Only a map with a file gets a preview beside it. A failed upload is dropped: the next shot tries again. */
function uploadPreview(current: OpenFile, shot: HTMLCanvasElement): void {
  if (current.onDisk) void savePreview(current.file, shot);
}

/** Registered first, so the toolbar's refresh on the same change sees the flag. Any change is due a preview. */
function trackUnsaved(editor: Editor, shell: Shell): void {
  editor.listen((c) => {
    if (c === "edit" || c === "props") shell.current.unsaved = true;
    if (c === "edit" || c === "load") shell.previews.touch();
  });
}

/** Maps, Properties, Save, undo and redo, the map title. */
function setupToolbar(editor: Editor, shell: Shell): void {
  const { current } = shell;
  const toolbar = new ToolbarView(byId("toolbar"), {
    onLevels: () => shell.showLevels(),
    onProps: () => {
      void shell.form.ask(propsOf(editor.map), "edit").then((p) => {
        if (!p) return;
        current.unsaved = true;
        editor.setProps(p);
      });
    },
    onSave: () => {
      void saveMap(current.file, editor.map).then((r) => {
        if (!r.ok) return toolbar.showStatus("Save failed.", r.errors);
        current.unsaved = false;
        current.onDisk = true;
        shell.previews.soon();
        toolbar.showStatus(`Saved maps/${current.file}.`);
        refresh();
      });
    },
    onUndo: () => editor.undo(),
    onRedo: () => editor.redo(),
  });
  const refresh = (): void => {
    const m = editor.map;
    const { width, height, cell } = m.spec;
    const s = editor.session;
    toolbar.update({
      title: `${m.name}  ${current.file}  ${width} x ${height}, cell ${cell}, base ${m.baseHeight}`,
      unsaved: current.unsaved,
      canUndo: s.undo.length > 0,
      canRedo: s.redo.length > 0,
    });
  };
  editor.listen((c) => {
    if (c === "load") toolbar.showStatus("");
    refresh();
  });
  refresh();
}

/** The tool panel follows the settings and the palette. */
function setupPanel(editor: Editor): void {
  const panel = new ToolPanelView(byId("panel"), {
    onChange: (patch) => editor.update(patch),
    onColor: (k, color) => editor.setColor(k, color),
  });
  editor.listen((c) => {
    if (c === "load") panel.setPalette(editor.map.palette);
    panel.update(editor.settings);
  });
  panel.setPalette(editor.map.palette);
  panel.update(editor.settings);
}

function setupKeys(editor: Editor): EditorKeys {
  return new EditorKeys({
    undo: () => editor.undo(),
    redo: () => editor.redo(),
    resize: (dir) => editor.update(resizeBrush(editor.settings, dir)),
    channel: (k) => {
      if (editor.settings.tool === "paint") editor.update({ channel: k });
    },
  });
}

/** The camera frames the whole map at start and on every new or resized map, with no easing. */
function setupFraming(editor: Editor, cam: Camera, target: Camera): void {
  const frame = (): void => {
    setCameraMap(target, mapSize(editor.scene.terrain));
    setDistance(target, START_DIST);
    target.yaw = 0;
    target.tilt = 0;
    snapCamera(cam, target);
  };
  editor.listen((c) => {
    if (c === "load") frame();
  });
  frame();
}

main();
