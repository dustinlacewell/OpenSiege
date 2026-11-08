import type { FeatureKind, MapFeatureKind } from "@mf/sim";

/** The feature kinds a dead unit leaves. */
export type WreckForm = Exclude<FeatureKind, MapFeatureKind>;

export const WRECK_FORMS: readonly WreckForm[] = ["scrap", "wreckage"];

/** True for scrap and wreckage, false for map features. */
export function isWreck(kind: FeatureKind): kind is WreckForm {
  return (WRECK_FORMS as readonly FeatureKind[]).includes(kind);
}
