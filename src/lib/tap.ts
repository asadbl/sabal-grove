/** A pointer that travelled this far between down and up was orbiting the camera, not tapping. */
export const isDrag = (e: { delta: number }) => e.delta > 8;
