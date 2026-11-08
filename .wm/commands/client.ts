import { cmd } from "@ldlework/workmark/define";

/** Run the Vite dev client on port 5173. It plays offline: skirmish against the AI, the tutorial and the dev sandbox. */
export default cmd({ interactive: true, handler: (_, { sh }) => sh("pnpm --filter @mf/client exec vite") });
