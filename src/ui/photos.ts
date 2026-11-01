import { useEffect, useMemo, useState } from "react";

/** Photoreal versions of the 3D renders (scripts/photos.mjs) live in /public/photos and are listed in
 *  index.json ({villaId | "estate": files}) and rooms.json ({villaId: {roomId: file}}). Until they exist,
 *  everything falls back to the stills rendered straight from the 3D model (scripts/stills.mjs). */
type Index = Record<string, string[]>;
type Rooms = Record<string, Record<string, string>>;
type Photos = { index: Index; rooms: Rooms };

const BASE = import.meta.env.BASE_URL;
export const photoUrl = (file: string) => `${BASE}photos/${file}`;
export const stillUrl = (name: string) => `${BASE}stills/${name}.jpg`;

const json = <T,>(f: string) => fetch(`${BASE}photos/${f}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<T>;
let cache: Photos | null = null;
let loading: Promise<Photos> | null = null;
function load() {
  loading ??= Promise.all([json<Index>("index.json"), json<Rooms>("rooms.json")]).then(([index, rooms]) => (cache = { index, rooms }));
  return loading;
}

function usePhotoData() {
  const [data, setData] = useState(cache);
  useEffect(() => {
    let live = true;
    if (!cache) load().then((d) => live && setData(d));
    return () => { live = false; };
  }, []);
  return data;
}

/** Every photo of a villa (front first), or its 3D still. */
export function usePhotos(id: string) {
  const d = usePhotoData();
  if (!d) return [];
  const own = (d.index[id] ?? []).map(photoUrl);
  return own.length ? own : [stillUrl(id)];
}

/** One named shot such as "casa-palma-front" or "estate-gate", or null while loading or missing. */
export function usePhoto(name: string) {
  const d = usePhotoData();
  if (!d) return undefined;
  const all = Object.values(d.index).flat();
  return all.includes(`${name}.jpg`) ? photoUrl(`${name}.jpg`) : null;
}

/** The estate photos for the landing hero, in order. */
export function useEstatePhotos() {
  const d = usePhotoData();
  return useMemo(() => {
    if (!d) return [];
    const fronts = Object.entries(d.index).filter(([k]) => k !== "estate").map(([, f]) => f.find((x) => x.endsWith("-front.jpg"))).filter(Boolean) as string[];
    const estate = d.index.estate ?? [];
    // Arrival first, then the homes, then the skyline over the water.
    return [...estate.filter((f) => /gate|street/.test(f)), ...fronts, ...estate.filter((f) => /skyline/.test(f))].map(photoUrl);
  }, [d]);
}

/** The photo of one room, if one was made. */
export function useRoomPhoto(villaId: string, roomId: string | null | undefined) {
  const d = usePhotoData();
  const f = roomId ? d?.rooms[villaId]?.[roomId] : undefined;
  return f ? photoUrl(f) : null;
}

/** {roomId: photo url} for every room of a villa that has a photo. */
export function useRoomPhotos(villaId: string) {
  const d = usePhotoData();
  return useMemo(() => Object.fromEntries(Object.entries(d?.rooms[villaId] ?? {}).map(([r, f]) => [r, photoUrl(f)])), [d, villaId]);
}

/** True once real photographs exist (not just the 3D stills). */
export function useHasPhotos() {
  const d = usePhotoData();
  return !!d && Object.keys(d.index).length > 0;
}

const SHOT: Record<string, string> = { front: "From the street at dusk", rear: "The garden side at dusk", aerial: "From above" };
/** Captions for a villa's photos: the shot, or the room it shows. */
export function captionPhotos(v: { name: string; rooms: { id: string; name: string }[] }, list: string[], rooms: Record<string, string>) {
  const roomOf = Object.fromEntries(Object.entries(rooms).map(([r, url]) => [url, r]));
  return list.map((src) => {
    const kind = src.match(/-([a-z]+)\.jpg$/)?.[1] ?? "";
    const room = v.rooms.find((r) => r.id === roomOf[src]);
    return { src, caption: `${v.name}: ${room?.name ?? SHOT[kind] ?? "From the street"}` };
  });
}
