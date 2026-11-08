import { defineConfig } from "vite";
import { devMapsPlugin } from "./devMapsPlugin.ts";
import { devSoundPlugin } from "./devSoundPlugin.ts";
import { devStatsPlugin } from "./devStatsPlugin.ts";

export default defineConfig({
  plugins: [devStatsPlugin(), devSoundPlugin(), devMapsPlugin()],
});
