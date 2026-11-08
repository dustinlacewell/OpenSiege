import { cmd } from "@ldlework/workmark/define";

/** Type-check every package. */
export default cmd({ handler: (_, { sh }) => sh("pnpm exec tsc -p tsconfig.json") });
