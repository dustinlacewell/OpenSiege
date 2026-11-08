// What a map tile shows. Pure.

/** What the map tile shows: the preview image, the name alone, or the random mark. */
export type MapTile =
  | { kind: "preview"; name: string; url: string }
  | { kind: "named"; name: string }
  | { kind: "random" };

/** A map as the tile reads it: its name and the preview image url, if it has one. */
export interface TileMap {
  name: string;
  preview: string | null;
}

export function mapTile(map: TileMap | null): MapTile {
  if (!map) return { kind: "random" };
  return map.preview ? { kind: "preview", name: map.name, url: map.preview } : { kind: "named", name: map.name };
}
