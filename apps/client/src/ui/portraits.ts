import type { UnitKind } from "@mf/sim";

/** Unit headshot images. The renderer draws them; the HUD reads only their URLs. "" until ready. */
export interface Portraits {
  url(kind: UnitKind): string;
}
