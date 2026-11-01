/** Every piece of furniture has a true size in metres: width (x), depth (z), height (y). */
export interface CatalogEntry {
  label: string;
  size: [number, number, number];
  /** Blocks walking. */
  solid?: boolean;
}

export const CATALOG: Record<string, CatalogEntry> = {
  "bed-king": { label: "King bed", size: [1.93, 2.13, 1.1], solid: true },
  "bed-queen": { label: "Queen bed", size: [1.6, 2.1, 1.05], solid: true },
  "bed-twin": { label: "Twin bed", size: [1.0, 2.0, 0.95], solid: true },
  nightstand: { label: "Nightstand", size: [0.5, 0.42, 0.56], solid: true },
  wardrobe: { label: "Wardrobe", size: [2.0, 0.62, 2.2], solid: true },
  dresser: { label: "Dresser", size: [1.4, 0.5, 0.8], solid: true },
  desk: { label: "Desk", size: [1.5, 0.7, 0.75], solid: true },
  "desk-chair": { label: "Desk chair", size: [0.62, 0.62, 1.02] },
  sofa: { label: "Three-seat sofa", size: [2.4, 0.95, 0.8], solid: true },
  "sofa-l": { label: "Corner sofa", size: [3.0, 2.0, 0.8], solid: true },
  armchair: { label: "Armchair", size: [0.85, 0.85, 0.8], solid: true },
  "coffee-table": { label: "Coffee table", size: [1.2, 0.7, 0.4], solid: true },
  "media-console": { label: "Media console, 65\" TV", size: [2.0, 0.45, 1.36], solid: true },
  rug: { label: "Rug", size: [2.6, 1.8, 0.012] },
  "dining-table": { label: "Dining table, seats 6", size: [2.0, 1.0, 0.75], solid: true },
  "dining-round": { label: "Round table, seats 4", size: [1.2, 1.2, 0.75], solid: true },
  "kitchen-run": { label: "Base cabinets & worktop", size: [3.6, 0.65, 0.92], solid: true },
  island: { label: "Kitchen island", size: [2.6, 1.1, 0.92], solid: true },
  fridge: { label: "Refrigerator", size: [0.91, 0.75, 1.83], solid: true },
  pantry: { label: "Pantry shelving", size: [1.8, 0.45, 2.1], solid: true },
  toilet: { label: "Toilet", size: [0.4, 0.7, 0.78] },
  vanity: { label: "Vanity", size: [1.2, 0.55, 0.86], solid: true },
  "vanity-double": { label: "Double vanity", size: [1.8, 0.55, 0.86], solid: true },
  shower: { label: "Walk-in shower", size: [1.4, 1.0, 2.1], solid: true },
  tub: { label: "Freestanding tub", size: [1.7, 0.8, 0.6], solid: true },
  laundry: { label: "Washer & dryer", size: [1.3, 0.7, 0.9], solid: true },
  sedan: { label: "Sedan", size: [4.85, 1.9, 1.45], solid: true },
  suv: { label: "SUV", size: [5.0, 2.0, 1.75], solid: true },
  shelving: { label: "Storage shelving", size: [2.0, 0.5, 2.0], solid: true },
  bookshelf: { label: "Bookshelf", size: [1.2, 0.36, 2.0], solid: true },
  console: { label: "Console table", size: [1.4, 0.4, 0.8], solid: true },
  bench: { label: "Bench", size: [1.4, 0.45, 0.46], solid: true },
  plant: { label: "Potted olive tree", size: [0.6, 0.6, 1.7], solid: true },
  lounger: { label: "Sun lounger", size: [0.72, 2.0, 0.36], solid: true },
  "outdoor-dining": { label: "Outdoor table, seats 6", size: [2.2, 1.0, 0.75], solid: true },
  "outdoor-sofa": { label: "Outdoor sofa", size: [2.2, 0.9, 0.72], solid: true },
  firepit: { label: "Fire table", size: [1.2, 1.2, 0.45], solid: true },
  parasol: { label: "Parasol", size: [3.0, 3.0, 2.6] },
  grill: { label: "Outdoor kitchen", size: [2.2, 0.7, 0.92], solid: true },
  "media-screen": { label: "Projection screen, 120\"", size: [2.7, 0.2, 1.6], solid: true },
};
