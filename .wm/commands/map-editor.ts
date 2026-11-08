import { cmd } from "@ldlework/workmark/define";

/** Run the Vite dev client and open the map editor page on whichever port Vite gets. */
export default cmd({
  interactive: true,
  handler: (_, { sh }) => sh("pnpm exec vite apps/client --open /map-editor.html"),
});
