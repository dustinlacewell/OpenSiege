import type { StatError } from "@mf/sim";
import { createHttpRemote } from "../tableEditor/store.ts";

// The dev server's stat file route (`apps/client/devStatsPlugin.ts`). The sim names a refused cell by `kind`; the editor by `column`.

export const unitRemote = createHttpRemote("/__dev/unit-stats", (e: StatError) => ({ column: e.kind, field: e.field, message: e.message }));
