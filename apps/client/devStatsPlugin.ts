import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { parseUnitStats, serializeUnitStats } from "../../packages/sim/src/statsData.ts";
import { devJsonPlugin } from "./devJsonPlugin.ts";

/**
 * The unit stat editor's route: `/__dev/unit-stats` reads and writes `unitStats.json`. A PUT body is checked
 * with the sim's own rules (`parseUnitStats`) before it is written.
 */
export function devStatsPlugin(): Plugin {
  return devJsonPlugin({
    name: "dev-unit-stats",
    route: "/__dev/unit-stats",
    file: fileURLToPath(new URL("../../packages/sim/data/unitStats.json", import.meta.url)),
    parse(json) {
      const parsed = parseUnitStats(json);
      return parsed.ok ? { ok: true, value: parsed.stats } : { ok: false, errors: parsed.errors };
    },
    serialize: serializeUnitStats,
  });
}
