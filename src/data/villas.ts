import { defineVilla, type BuiltVilla } from "./dsl";

/* Coordinates are metres in each villa's own frame: x runs along the street,
   z runs from the front wall (z = 0) toward the back garden. */

const casaPalma = defineVilla(
  {
    id: "casa-palma", name: "Casa Palma", address: "2 Sabal Grove Lane",
    tagline: "Single-storey courtyard modern with a 10 m pool",
    blurb: "One long, low line of white stucco. The great room opens straight onto a covered lanai and a ten-metre pool, and the primary suite takes the quiet east wing.",
    price: 1_450_000, status: "Available", beds: 2, baths: 2.5, levels: 1, lot: 0, view: "Golf",
    style: { stucco: "#efebe3", trim: "#2b2b28", roof: "#d9d4ca", accent: "#c9a46a", wood: "#b08a62", fabric: "#d8d0c2", fabric2: "#6f7d6a", floor: "oak" },
    features: ["Pool & spa", "Covered lanai", "Den / office", "Golf course view", "Two-car garage"],
  },
  (b) => {
    b.room("garage", "Garage", "garage", [0, 0, 6, 6.5])
      .room("laundry", "Laundry", "laundry", [0, 6.5, 3, 8.5])
      .room("bath2", "Guest bath", "bath", [3, 6.5, 6, 8.5])
      .room("bed2", "Guest bedroom", "bedroom", [0, 8.5, 6, 14])
      .room("entry", "Foyer", "entry", [6, 0, 13, 3.5])
      .room("kitchen", "Kitchen", "kitchen", [6, 3.5, 13, 7.5])
      .room("living", "Great room", "living", [6, 7.5, 13, 14])
      .room("office", "Den", "office", [13, 0, 17, 4])
      .room("powder", "Powder room", "powder", [17, 0, 20, 4])
      .room("hall", "Hall", "hall", [13, 4, 20, 5.5])
      .room("primary", "Primary bedroom", "primary", [13, 5.5, 20, 11])
      .room("pbath", "Primary bath", "bath", [13, 11, 17, 14])
      .room("closet", "Walk-in closet", "closet", [17, 11, 20, 14])
      .room("driveway", "Driveway", "driveway", [0, -8, 6, 0])
      .room("front", "Front garden", "garden", [6, -8, 20, 0])
      .room("lanai", "Covered lanai", "terrace", [6, 14, 13, 18], { covered: true })
      .room("pooldeck", "Pool deck", "pooldeck", [0, 18, 20, 27]);
    b.open("kitchen", "living");
    b.ext("garage", "front", { kind: "garage", width: 4.8 })
      .ext("entry", "front", { kind: "double", at: 9.5 })
      .ext("living", "back", { kind: "slider", width: 5, at: 9.5 })
      .door("garage", "entry", { at: 1.2 })
      .door("garage", "laundry", { at: 1.5 })
      .door("bath2", "bed2", { at: 5.4, width: 0.8 })
      .door("bed2", "living", { at: 9.4 })
      .door("entry", "kitchen", { kind: "opening", width: 3.2, at: 9.5 })
      .door("entry", "office", { at: 2 })
      .door("kitchen", "hall", { kind: "opening", width: 1.3 })
      .door("hall", "powder", { at: 18.5, width: 0.8 })
      .door("hall", "primary", { at: 16.5, width: 1.0 })
      .door("primary", "pbath", { at: 15 })
      .door("primary", "closet", { at: 18.5, width: 0.8 });
    b.block(0, [0, 0, 20, 14], "flat");
    b.setPool({ x0: 5, z0: 19.5, x1: 15, z1: 23.5, depth: 1.6, spa: { x0: 15.6, z0: 19.5, x1: 17.6, z1: 21.5 } });

    b.item("sedan", "garage", { x: 3, z: 3.3, rot: 90, tone: "#3c4a57" })
      .item("shelving", "garage", { wall: "left", along: 3.6 })
      .item("laundry", "laundry", { wall: "left", along: 1 })
      .item("vanity", "bath2", { wall: "front", along: 1.0 })
      .item("toilet", "bath2", { wall: "left", along: 1.5 })
      .item("shower", "bath2", { wall: "right", along: 0.65, size: [1.0, 1.0, 2.1] })
      .item("bed-queen", "bed2", { wall: "left", along: 2.75 })
      .item("nightstand", "bed2", { wall: "left", along: 1.5 })
      .item("nightstand", "bed2", { wall: "left", along: 4.0 })
      .item("wardrobe", "bed2", { wall: "right", along: 4.0 })
      .item("rug", "bed2", { x: 2.0, z: 2.75, rot: 90, size: [3.0, 2.2, 0.012] })
      .item("console", "entry", { wall: "left", along: 2.4 })
      .item("plant", "entry", { x: 6.2, z: 0.6 })
      .item("rug", "entry", { x: 3.5, z: 1.9, size: [2.4, 1.5, 0.012] })
      .item("kitchen-run", "kitchen", { wall: "left", along: 2.45, size: [3.0, 0.65, 0.92] })
      .item("fridge", "kitchen", { wall: "left", along: 0.5 })
      .item("island", "kitchen", { x: 3.6, z: 2.0 })
      .item("dining-table", "living", { x: 3.5, z: 1.5 })
      .item("media-console", "living", { wall: "left", along: 4.6 })
      .item("sofa", "living", { x: 4.4, z: 4.6, rot: -90 })
      .item("coffee-table", "living", { x: 2.9, z: 4.6, rot: 90 })
      .item("armchair", "living", { x: 2.6, z: 2.9, rot: 20 })
      .item("rug", "living", { x: 3.3, z: 4.6, rot: 90, size: [2.8, 2.2, 0.012] })
      .item("plant", "living", { x: 6.4, z: 0.5 })
      .item("desk", "office", { wall: "front", along: 2 })
      .item("desk-chair", "office", { x: 2, z: 1.3, rot: 180 })
      .item("bookshelf", "office", { wall: "back", along: 2 })
      .item("vanity", "powder", { wall: "left", along: 2.0, size: [0.9, 0.5, 0.86] })
      .item("toilet", "powder", { wall: "right", along: 1.2 })
      .item("console", "hall", { wall: "back", along: 5.6, size: [1.2, 0.35, 0.8] })
      .item("bed-king", "primary", { wall: "right", along: 2.75 })
      .item("nightstand", "primary", { wall: "right", along: 1.45 })
      .item("nightstand", "primary", { wall: "right", along: 4.05 })
      .item("dresser", "primary", { wall: "left", along: 2.75 })
      .item("armchair", "primary", { x: 1.1, z: 4.6, rot: 135 })
      .item("rug", "primary", { x: 4.4, z: 2.75, rot: 90, size: [3.0, 2.4, 0.012] })
      .item("vanity-double", "pbath", { wall: "left", along: 1.5 })
      .item("tub", "pbath", { wall: "back", along: 2.4 })
      .item("shower", "pbath", { wall: "right", along: 0.7, size: [1.0, 1.0, 2.1] })
      .item("toilet", "pbath", { wall: "back", along: 0.85 })
      .item("wardrobe", "closet", { wall: "right", along: 1.3 })
      .item("shelving", "closet", { wall: "back", along: 1.2, size: [1.8, 0.5, 2.2] })
      .item("suv", "driveway", { x: 3, z: 4.2, rot: 90, tone: "#d9d6cf" })
      .item("outdoor-dining", "lanai", { x: 3.5, z: 2.0 })
      .item("outdoor-sofa", "pooldeck", { x: 18.0, z: 3.0, rot: -90 })
      .item("firepit", "pooldeck", { x: 16.4, z: 3.0 })
      .item("lounger", "pooldeck", { x: 6.5, z: 7.1 })
      .item("lounger", "pooldeck", { x: 7.6, z: 7.1 })
      .item("lounger", "pooldeck", { x: 8.7, z: 7.1 })
      .item("parasol", "pooldeck", { x: 10.2, z: 7.0 })
      .item("grill", "pooldeck", { x: 2.0, z: 2.2, rot: 90 });
  },
);

const villaSable = defineVilla(
  {
    id: "villa-sable", name: "Villa Sable", address: "3 Sabal Grove Lane",
    tagline: "Two-storey modern with a cantilevered primary suite",
    blurb: "A dark-framed glass box over a white base. Downstairs is one 16-metre room from kitchen to living; upstairs the primary suite steps out onto a balcony over the pool.",
    price: 2_100_000, status: "Available", beds: 4, baths: 3.5, levels: 2, lot: 3, view: "Lake",
    style: { stucco: "#f2f0ec", trim: "#1f2124", roof: "#c9c5bd", accent: "#a88a5c", wood: "#8a6a4b", fabric: "#c8c2b6", fabric2: "#3e4a5a", floor: "walnut" },
    features: ["Pool", "Primary balcony", "Home office", "Lake view", "Walk-in pantry"],
  },
  (b) => {
    b.room("garage", "Garage", "garage", [0, 0, 6, 7])
      .room("laundry", "Mudroom & laundry", "laundry", [0, 7, 6, 9])
      .room("powder", "Powder room", "powder", [0, 9, 3, 12])
      .room("pantry", "Pantry", "pantry", [3, 9, 6, 12], { windows: false })
      .room("entry", "Foyer", "entry", [6, 0, 10, 5])
      .room("stair", "Stair hall", "stair", [10, 0, 13, 5])
      .room("office", "Office", "office", [13, 0, 17, 5])
      .room("guest", "Guest bedroom", "bedroom", [17, 0, 22, 5])
      .room("kitchen", "Kitchen", "kitchen", [6, 5, 12, 12])
      .room("dining", "Dining", "dining", [12, 5, 16, 12])
      .room("living", "Living room", "living", [16, 5, 22, 12])
      .room("bed2", "Bedroom 2", "bedroom", [6, 0, 10, 6], { level: 1 })
      .room("bath2", "Bath 2", "bath", [6, 6, 10, 8], { level: 1 })
      .room("bed3", "Bedroom 3", "bedroom", [6, 8, 13, 12], { level: 1 })
      .room("landing", "Landing", "landing", [10, 0, 13, 5], { level: 1 })
      .room("hall", "Upper hall", "hall", [10, 5, 13, 8], { level: 1 })
      .room("closet", "Dressing room", "closet", [13, 0, 17, 5], { level: 1 })
      .room("pbath", "Primary bath", "bath", [17, 0, 22, 5], { level: 1 })
      .room("primary", "Primary bedroom", "primary", [13, 5, 22, 12], { level: 1 })
      .room("balcony", "Balcony", "balcony", [13, 12, 22, 14.5], { level: 1 })
      .room("driveway", "Driveway", "driveway", [0, -8, 6, 0])
      .room("front", "Front garden", "garden", [6, -8, 22, 0])
      .room("terrace", "Terrace", "terrace", [6, 12, 22, 16])
      .room("pooldeck", "Pool deck", "pooldeck", [0, 16, 22, 27]);
    b.open("kitchen", "dining").open("dining", "living").open("entry", "stair").open("landing", "hall");
    b.ext("garage", "front", { kind: "garage" })
      .ext("entry", "front", { kind: "double", at: 8 })
      .ext("living", "back", { kind: "slider", width: 5, at: 19 })
      .ext("dining", "back", { kind: "slider", width: 3, at: 14 })
      .ext("primary", "back", { kind: "slider", width: 4, at: 17.5 })
      .door("garage", "laundry", { at: 1.5 })
      .door("laundry", "kitchen", { at: 8, width: 0.8 })
      .door("powder", "laundry", { at: 1.5, width: 0.8 })
      .door("pantry", "kitchen", { at: 10.5, width: 0.8 })
      .door("entry", "kitchen", { kind: "opening", width: 2.4, at: 8 })
      .door("office", "stair", { at: 2.5 })
      .door("guest", "living", { at: 19 })
      .door("bed2", "hall", { at: 5.5, width: 0.8 })
      .door("bath2", "hall", { at: 7, width: 0.8 })
      .door("bed3", "hall", { at: 11.5 })
      .door("primary", "hall", { at: 6.5 })
      .door("closet", "primary", { at: 15 })
      .door("pbath", "primary", { at: 18.5 });
    b.stair(0, [10.2, 0.4, 11.4, 4.8], "+z");
    b.block(0, [0, 0, 6, 12], "flat").block(1, [6, 0, 22, 12], "flat");
    b.setPool({ x0: 4, z0: 17.5, x1: 18, z1: 22, depth: 1.7 });

    b.item("suv", "garage", { x: 3, z: 3.5, rot: 90, tone: "#22262b" })
      .item("shelving", "garage", { wall: "left", along: 3.5 })
      .item("laundry", "laundry", { wall: "front", along: 4.0 })
      .item("bench", "laundry", { wall: "back", along: 4.6 })
      .item("toilet", "powder", { wall: "left", along: 1.5 })
      .item("vanity", "powder", { wall: "back", along: 1.8, size: [0.9, 0.5, 0.86] })
      .item("pantry", "pantry", { wall: "left", along: 1.5, size: [2.4, 0.45, 2.1] })
      .item("pantry", "pantry", { wall: "back", along: 1.6, size: [2.0, 0.45, 2.1] })
      .item("console", "entry", { wall: "left", along: 2.5 })
      .item("plant", "entry", { x: 0.5, z: 0.6 })
      .item("rug", "entry", { x: 2, z: 2.4, size: [2.2, 1.6, 0.012] })
      .item("desk", "office", { wall: "front", along: 2 })
      .item("desk-chair", "office", { x: 2, z: 1.3, rot: 180 })
      .item("bookshelf", "office", { wall: "right", along: 2.5 })
      .item("bed-queen", "guest", { wall: "right", along: 2.5 })
      .item("nightstand", "guest", { wall: "right", along: 1.3 })
      .item("nightstand", "guest", { wall: "right", along: 3.7 })
      .item("dresser", "guest", { wall: "left", along: 2.3 })
      .item("kitchen-run", "kitchen", { wall: "back", along: 3.4, size: [4.0, 0.65, 0.92] })
      .item("fridge", "kitchen", { wall: "back", along: 0.6 })
      .item("island", "kitchen", { x: 3.2, z: 3.6 })
      .item("dining-table", "dining", { x: 2, z: 3.5, rot: 90 })
      .item("media-console", "living", { wall: "right", along: 3.2 })
      .item("sofa", "living", { x: 2.4, z: 3.2, rot: 90 })
      .item("coffee-table", "living", { x: 3.6, z: 3.2, rot: 90 })
      .item("armchair", "living", { x: 3.6, z: 1.3 })
      .item("rug", "living", { x: 3.3, z: 3.2, rot: 90, size: [2.8, 2.2, 0.012] })
      .item("plant", "living", { x: 5.4, z: 6.4 })
      .item("bed-queen", "bed2", { wall: "left", along: 3 })
      .item("nightstand", "bed2", { wall: "left", along: 1.7 })
      .item("nightstand", "bed2", { wall: "left", along: 4.3 })
      .item("wardrobe", "bed2", { wall: "back", along: 2 })
      .item("vanity", "bath2", { wall: "front", along: 1.5 })
      .item("toilet", "bath2", { wall: "left", along: 1.4 })
      .item("shower", "bath2", { wall: "back", along: 2.6 })
      .item("bed-queen", "bed3", { wall: "left", along: 2 })
      .item("nightstand", "bed3", { wall: "left", along: 0.75 })
      .item("nightstand", "bed3", { wall: "left", along: 3.25 })
      .item("desk", "bed3", { wall: "right", along: 2, size: [1.4, 0.65, 0.75] })
      .item("wardrobe", "closet", { wall: "left", along: 2.5 })
      .item("wardrobe", "closet", { wall: "right", along: 2.5 })
      .item("tub", "pbath", { wall: "right", along: 2.5 })
      .item("vanity-double", "pbath", { wall: "front", along: 2.4 })
      .item("shower", "pbath", { wall: "left", along: 1.2 })
      .item("toilet", "pbath", { wall: "left", along: 3.4 })
      .item("bed-king", "primary", { wall: "right", along: 3.5 })
      .item("nightstand", "primary", { wall: "right", along: 2.2 })
      .item("nightstand", "primary", { wall: "right", along: 4.8 })
      .item("dresser", "primary", { wall: "left", along: 4.6 })
      .item("armchair", "primary", { x: 2.0, z: 5.6, rot: 150 })
      .item("rug", "primary", { x: 6.2, z: 3.5, rot: 90, size: [3.2, 2.6, 0.012] })
      .item("lounger", "balcony", { x: 6.0, z: 1.25, rot: 90 })
      .item("plant", "balcony", { x: 8.4, z: 0.6 })
      .item("outdoor-dining", "terrace", { x: 4, z: 2 })
      .item("outdoor-sofa", "terrace", { x: 12, z: 2.6, rot: 180 })
      .item("coffee-table", "terrace", { x: 12, z: 1.5 })
      .item("grill", "terrace", { x: 1.4, z: 2, rot: 90 })
      .item("lounger", "pooldeck", { x: 19.6, z: 2.6, rot: -90 })
      .item("lounger", "pooldeck", { x: 19.6, z: 3.7, rot: -90 })
      .item("lounger", "pooldeck", { x: 19.6, z: 4.8, rot: -90 })
      .item("parasol", "pooldeck", { x: 19.6, z: 7.2 })
      .item("suv", "driveway", { x: 3, z: 4, rot: 90, tone: "#f1efe9" });
  },
);

const theCypress = defineVilla(
  {
    id: "the-cypress", name: "The Cypress", address: "6 Sabal Grove Lane",
    tagline: "Single-storey ranch under a clay-tile hip roof",
    blurb: "A classic Florida plan under one generous tile roof: bedrooms down a quiet hall, a kitchen big enough for the whole family, and a screened lanai on the golf course.",
    price: 1_180_000, status: "Sold", beds: 3, baths: 2, levels: 1, lot: 2, view: "Golf",
    style: { stucco: "#ead9bf", trim: "#f5efe4", roof: "#b5643f", accent: "#7a8f5c", wood: "#a07850", fabric: "#c9b79a", fabric2: "#8a5a44", floor: "travertine" },
    features: ["Clay tile roof", "Front porch", "Covered lanai", "Golf course view", "Two-car garage"],
  },
  (b) => {
    b.room("bed2", "Bedroom 2", "bedroom", [0, 0, 4.5, 4])
      .room("bath2", "Hall bath", "bath", [0, 4, 4.5, 6.5])
      .room("bed3", "Bedroom 3", "bedroom", [0, 6.5, 4.5, 10.5])
      .room("hall", "Hall", "hall", [4.5, 0, 7, 10.5])
      .room("primary", "Primary bedroom", "primary", [0, 10.5, 7, 16])
      .room("entry", "Foyer", "entry", [7, 0, 12, 4])
      .room("living", "Family room", "living", [7, 4, 12, 11])
      .room("pbath", "Primary bath", "bath", [7, 11, 12, 13.5])
      .room("closet", "Walk-in closet", "closet", [7, 13.5, 12, 16])
      .room("garage", "Garage", "garage", [12, 0, 18, 7])
      .room("kitchen", "Kitchen & breakfast", "kitchen", [12, 7, 18, 16])
      .room("porch", "Front porch", "terrace", [7, -2.5, 12, 0], { covered: true })
      .room("driveway", "Driveway", "driveway", [12, -8, 18, 0])
      .room("front", "Front garden", "garden", [0, -8, 7, 0])
      .room("lanai", "Covered lanai", "terrace", [7, 16, 18, 20], { covered: true })
      .room("garden", "Back garden", "garden", [0, 16, 7, 24]);
    b.open("living", "kitchen");
    b.ext("entry", "front", { kind: "double", at: 9.5 })
      .ext("garage", "front", { kind: "garage", at: 15 })
      .ext("kitchen", "back", { kind: "slider", at: 15, width: 3.5 })
      .ext("primary", "back", { kind: "slider", at: 5.2, width: 2.4 })
      .door("garage", "entry", { at: 2.5 })
      .door("garage", "kitchen", { at: 13 })
      .door("entry", "hall", { at: 2.5 })
      .door("hall", "living", { kind: "opening", at: 7.5, width: 2 })
      .door("entry", "living", { kind: "opening", at: 9.5, width: 3 })
      .door("bed2", "hall", { at: 2 })
      .door("bath2", "hall", { at: 5.25, width: 0.8 })
      .door("bed3", "hall", { at: 8.5 })
      .door("primary", "hall", { at: 5.75 })
      .door("pbath", "primary", { at: 12.25, width: 0.8 })
      .door("closet", "primary", { at: 14.75, width: 0.8 });
    b.block(0, [0, 0, 18, 16], "hip");

    b.item("bed-queen", "bed2", { wall: "left", along: 2 })
      .item("nightstand", "bed2", { wall: "left", along: 0.7 })
      .item("dresser", "bed2", { wall: "back", along: 2.5 })
      .item("vanity", "bath2", { wall: "left", along: 1.25 })
      .item("toilet", "bath2", { wall: "front", along: 2.2 })
      .item("tub", "bath2", { wall: "back", along: 2.6 })
      .item("bed-twin", "bed3", { wall: "left", along: 1.0 })
      .item("bed-twin", "bed3", { wall: "left", along: 3.0 })
      .item("nightstand", "bed3", { wall: "left", along: 2.0 })
      .item("desk", "bed3", { wall: "front", along: 3.4, size: [1.2, 0.6, 0.75] })
      .item("bed-king", "primary", { wall: "back", along: 3.5 })
      .item("nightstand", "primary", { wall: "back", along: 2.2 })
      .item("nightstand", "primary", { wall: "back", along: 4.8 })
      .item("dresser", "primary", { wall: "front", along: 2.2 })
      .item("armchair", "primary", { x: 1.0, z: 1.6, rot: 45 })
      .item("rug", "primary", { x: 3.5, z: 3.2, size: [3.0, 2.4, 0.012] })
      .item("console", "entry", { wall: "right", along: 0.9 })
      .item("plant", "entry", { x: 0.5, z: 0.6 })
      .item("rug", "entry", { x: 2.5, z: 2, size: [2.4, 1.6, 0.012] })
      .item("media-console", "living", { wall: "right", along: 1.5 })
      .item("sofa", "living", { x: 1.4, z: 1.6, rot: 90 })
      .item("coffee-table", "living", { x: 2.7, z: 1.6, rot: 90 })
      .item("rug", "living", { x: 2.5, z: 1.6, rot: 90, size: [2.6, 2.0, 0.012] })
      .item("dining-table", "living", { x: 2.5, z: 5.3 })
      .item("vanity-double", "pbath", { wall: "back", along: 3.0 })
      .item("tub", "pbath", { wall: "front", along: 3.2 })
      .item("toilet", "pbath", { wall: "right", along: 1.25 })
      .item("wardrobe", "closet", { wall: "back", along: 1.4 })
      .item("wardrobe", "closet", { wall: "back", along: 3.6 })
      .item("sedan", "garage", { x: 3, z: 3.6, rot: 90, tone: "#7b2f2a" })
      .item("shelving", "garage", { wall: "right", along: 3.5 })
      .item("kitchen-run", "kitchen", { wall: "right", along: 3.5, size: [4.2, 0.65, 0.92] })
      .item("fridge", "kitchen", { wall: "right", along: 0.8 })
      .item("island", "kitchen", { x: 3.0, z: 3.6, rot: 90 })
      .item("dining-round", "kitchen", { x: 3.0, z: 7.2 })
      .item("bench", "porch", { wall: "front", along: 3.6, off: 0.3, rot: 180 })
      .item("plant", "porch", { x: 0.6, z: 1.6 })
      .item("sedan", "driveway", { x: 3, z: 4.4, rot: 90, tone: "#9aa3a8" })
      .item("outdoor-dining", "lanai", { x: 3.6, z: 2 })
      .item("outdoor-sofa", "lanai", { x: 8.5, z: 3.0, rot: 180 })
      .item("firepit", "lanai", { x: 8.5, z: 1.6 })
      .item("bench", "garden", { x: 3.5, z: 6.5, rot: 180 });
  },
);

const villaCoral = defineVilla(
  {
    id: "villa-coral", name: "Villa Coral", address: "4 Sabal Grove Lane",
    tagline: "Two-storey Mediterranean with a roof terrace",
    blurb: "Coral stucco, a terracotta hip roof and five bedrooms. A loggia and a twelve-metre pool face the fairway, and the garage roof is a terrace for sunsets over the 7th green.",
    price: 2_650_000, status: "Reserved", beds: 5, baths: 3, levels: 2, lot: 1, view: "Golf",
    style: { stucco: "#e9c6a8", trim: "#f4ece0", roof: "#a8553a", accent: "#2f6f73", wood: "#6e4a32", fabric: "#e6dccb", fabric2: "#2f6f73", floor: "travertine" },
    features: ["Pool & spa", "Roof terrace", "Loggia", "Ground-floor guest suite", "Golf course view"],
  },
  (b) => {
    b.room("office", "Library", "office", [0, 0, 6, 4.5])
      .room("entry", "Foyer", "entry", [6, 0, 10, 4.5])
      .room("stair", "Stair hall", "stair", [10, 0, 14, 4.5])
      .room("living", "Living room", "living", [0, 4.5, 6, 13])
      .room("dining", "Dining", "dining", [6, 4.5, 10, 13])
      .room("kitchen", "Kitchen", "kitchen", [10, 4.5, 14, 13])
      .room("garage", "Garage", "garage", [14, 0, 20, 7])
      .room("laundry", "Laundry", "laundry", [14, 7, 20, 9])
      .room("bath5", "Guest bath", "bath", [14, 9, 16, 13])
      .room("bed5", "Guest suite", "bedroom", [16, 9, 20, 13])
      .room("bed2", "Bedroom 2", "bedroom", [0, 0, 5, 4.5], { level: 1 })
      .room("bed3", "Bedroom 3", "bedroom", [5, 0, 10, 4.5], { level: 1 })
      .room("hall", "Upper hall", "hall", [0, 4.5, 10, 6], { level: 1 })
      .room("landing", "Landing", "landing", [10, 0, 14, 6], { level: 1 })
      .room("primary", "Primary bedroom", "primary", [0, 6, 7, 13], { level: 1 })
      .room("bath2", "Bath 2", "bath", [7, 6, 10, 9], { level: 1 })
      .room("pbath", "Primary bath", "bath", [7, 9, 10, 13], { level: 1 })
      .room("bed4", "Bedroom 4", "bedroom", [10, 6, 14, 13], { level: 1 })
      .room("roofdeck", "Roof terrace", "terrace", [14, 0, 20, 13], { level: 1 })
      .room("driveway", "Driveway", "driveway", [14, -8, 20, 0])
      .room("front", "Front garden", "garden", [0, -8, 14, 0])
      .room("loggia", "Loggia", "terrace", [0, 13, 10, 17], { covered: true })
      .room("pooldeck", "Pool deck", "pooldeck", [0, 17, 20, 27]);
    b.open("living", "dining").open("dining", "kitchen").open("entry", "stair").open("hall", "landing");
    b.ext("entry", "front", { kind: "double", at: 8 })
      .ext("garage", "front", { kind: "garage", at: 17 })
      .ext("living", "back", { kind: "slider", at: 3, width: 4 })
      .ext("dining", "back", { kind: "slider", at: 8, width: 3 })
      .ext("bed4", "right", { kind: "slider", at: 9.5, width: 2.4 })
      .door("office", "entry", { at: 2.25 })
      .door("entry", "dining", { kind: "opening", at: 8, width: 2.4 })
      .door("stair", "kitchen", { kind: "opening", at: 13, width: 1.4 })
      .door("garage", "laundry", { at: 15.2 })
      .door("laundry", "kitchen", { at: 8, width: 0.8 })
      .door("bed5", "laundry", { at: 17 })
      .door("bath5", "bed5", { at: 11, width: 0.8 })
      .door("bed2", "hall", { at: 2.5 })
      .door("bed3", "hall", { at: 7.5 })
      .door("bed4", "landing", { at: 12.5 })
      .door("primary", "hall", { at: 3.5 })
      .door("bath2", "hall", { at: 8.5, width: 0.8 })
      .door("pbath", "primary", { at: 11, width: 0.8 });
    b.stair(0, [10.2, 0.2, 11.4, 4.4], "+z");
    b.block(1, [0, 0, 14, 13], "hip").block(0, [14, 0, 20, 13], "roofdeck");
    b.setPool({ x0: 3, z0: 18.5, x1: 15, z1: 23, depth: 1.8, spa: { x0: 15.6, z0: 18.5, x1: 18, z1: 20.9 } });

    b.item("desk", "office", { wall: "front", along: 3 })
      .item("desk-chair", "office", { x: 3, z: 1.3, rot: 180 })
      .item("bookshelf", "office", { wall: "back", along: 1.2 })
      .item("bookshelf", "office", { wall: "back", along: 2.5 })
      .item("armchair", "office", { x: 4.6, z: 3.4, rot: -30 })
      .item("plant", "entry", { x: 3.4, z: 0.6 })
      .item("rug", "entry", { x: 2, z: 2.2, size: [2.4, 1.8, 0.012] })
      .item("media-console", "living", { wall: "left", along: 3.5 })
      .item("sofa", "living", { x: 3.6, z: 3.5, rot: -90 })
      .item("coffee-table", "living", { x: 2.2, z: 3.5, rot: 90 })
      .item("armchair", "living", { x: 2.2, z: 1.4 })
      .item("rug", "living", { x: 2.6, z: 3.5, rot: 90, size: [3.0, 2.2, 0.012] })
      .item("dining-table", "dining", { x: 2, z: 4.2, rot: 90 })
      .item("kitchen-run", "kitchen", { wall: "right", along: 6.3, size: [3.4, 0.65, 0.92] })
      .item("fridge", "kitchen", { wall: "right", along: 2.2 })
      .item("island", "kitchen", { x: 1.6, z: 5.6, rot: 90, size: [2.6, 1.0, 0.92] })
      .item("sedan", "garage", { x: 3, z: 3.5, rot: 90, tone: "#1e3b4a" })
      .item("laundry", "laundry", { wall: "front", along: 4.8 })
      .item("vanity", "bath5", { wall: "back", along: 1.0 })
      .item("toilet", "bath5", { wall: "left", along: 1.0 })
      .item("bed-queen", "bed5", { wall: "back", along: 2.2 })
      .item("nightstand", "bed5", { wall: "back", along: 1.0 })
      .item("nightstand", "bed5", { wall: "back", along: 3.4 })
      .item("bed-queen", "bed2", { wall: "left", along: 2.25 })
      .item("nightstand", "bed2", { wall: "left", along: 1.0 })
      .item("wardrobe", "bed2", { wall: "right", along: 2.25 })
      .item("bed-queen", "bed3", { wall: "front", along: 2.5 })
      .item("nightstand", "bed3", { wall: "front", along: 1.2 })
      .item("nightstand", "bed3", { wall: "front", along: 3.8 })
      .item("desk", "bed3", { wall: "right", along: 2.5, size: [1.4, 0.65, 0.75] })
      .item("console", "hall", { wall: "front", along: 5.4 })
      .item("bed-king", "primary", { wall: "left", along: 3.5 })
      .item("nightstand", "primary", { wall: "left", along: 2.2 })
      .item("nightstand", "primary", { wall: "left", along: 4.8 })
      .item("dresser", "primary", { wall: "right", along: 1.6 })
      .item("armchair", "primary", { x: 4.8, z: 5.8, rot: 200 })
      .item("rug", "primary", { x: 2.6, z: 3.5, rot: 90, size: [3.2, 2.6, 0.012] })
      .item("vanity", "bath2", { wall: "right", along: 1.2 })
      .item("toilet", "bath2", { wall: "back", along: 0.6 })
      .item("shower", "bath2", { wall: "back", along: 2.2, size: [1.0, 1.0, 2.1] })
      .item("tub", "pbath", { wall: "back", along: 1.5 })
      .item("vanity-double", "pbath", { wall: "right", along: 1.9 })
      .item("toilet", "pbath", { wall: "front", along: 2.2 })
      .item("bed-queen", "bed4", { wall: "back", along: 2 })
      .item("nightstand", "bed4", { wall: "back", along: 0.75 })
      .item("nightstand", "bed4", { wall: "back", along: 3.25 })
      .item("desk", "bed4", { wall: "left", along: 1.8, size: [1.4, 0.65, 0.75] })
      .item("lounger", "roofdeck", { x: 1.4, z: 9.5 })
      .item("lounger", "roofdeck", { x: 2.5, z: 9.5 })
      .item("outdoor-sofa", "roofdeck", { x: 4.6, z: 4.0, rot: -90 })
      .item("coffee-table", "roofdeck", { x: 3.3, z: 4.0, rot: 90 })
      .item("parasol", "roofdeck", { x: 4.2, z: 9.6 })
      .item("plant", "roofdeck", { x: 0.6, z: 0.6 })
      .item("plant", "roofdeck", { x: 5.4, z: 0.6 })
      .item("outdoor-dining", "loggia", { x: 5, z: 2 })
      .item("grill", "loggia", { x: 1.3, z: 2, rot: 90 })
      .item("lounger", "pooldeck", { x: 5, z: 7.3 })
      .item("lounger", "pooldeck", { x: 6.1, z: 7.3 })
      .item("lounger", "pooldeck", { x: 7.2, z: 7.3 })
      .item("lounger", "pooldeck", { x: 8.3, z: 7.3 })
      .item("parasol", "pooldeck", { x: 10, z: 7.3 })
      .item("suv", "driveway", { x: 3, z: 4.2, rot: 90, tone: "#5b6b4e" });
  },
);

const heronHouse = defineVilla(
  {
    id: "heron-house", name: "Heron House", address: "5 Sabal Grove Lane",
    tagline: "Compact gabled cottage by the lake",
    blurb: "The smallest home on the street and the easiest to love: a vaulted living room under a simple gable, a den for guests, a carport, and a terrace that runs down to the water.",
    price: 895_000, status: "Available", beds: 2, baths: 1, levels: 1, lot: 4, view: "Lake",
    style: { stucco: "#dfe6e2", trim: "#ffffff", roof: "#5d6a70", accent: "#d08b5b", wood: "#c19a6b", fabric: "#e8e2d6", fabric2: "#47708a", floor: "oak" },
    features: ["Carport", "Front porch", "Den", "Lake view", "Lowest upkeep"],
  },
  (b) => {
    b.room("bed2", "Bedroom 2", "bedroom", [0, 0, 5, 4.5])
      .room("bath2", "Bath", "bath", [0, 4.5, 3, 7])
      .room("laundry", "Laundry", "laundry", [3, 4.5, 5, 7], { windows: false })
      .room("primary", "Primary bedroom", "primary", [0, 7, 5, 12])
      .room("entry", "Entry", "entry", [5, 0, 9, 3])
      .room("den", "Den", "office", [9, 0, 14, 3])
      .room("kitchen", "Kitchen", "kitchen", [5, 3, 9, 7])
      .room("dining", "Dining", "dining", [5, 7, 9, 12])
      .room("living", "Living room", "living", [9, 3, 14, 12])
      .room("carport", "Carport", "driveway", [14, 0, 18, 7], { covered: true })
      .room("driveway", "Driveway", "driveway", [14, -8, 18, 0])
      .room("porch", "Front porch", "terrace", [5, -2, 9, 0], { covered: true })
      .room("front", "Front garden", "garden", [0, -8, 5, 0])
      .room("terrace", "Lake terrace", "terrace", [3, 12, 16, 17]);
    b.open("kitchen", "dining").open("dining", "living").open("kitchen", "living");
    b.ext("entry", "front", { kind: "door", at: 7, width: 1.0 })
      .ext("living", "back", { kind: "slider", at: 11.5, width: 3.6 })
      .ext("dining", "back", { kind: "window", at: 7, width: 2.4, sill: 0.6 })
      .door("entry", "kitchen", { kind: "opening", width: 2.4 })
      .door("den", "living", { at: 11.5 })
      .door("bed2", "bath2", { at: 1.5, width: 0.8 })
      .door("primary", "bath2", { at: 1.5, width: 0.8 })
      .door("bed2", "entry", { at: 1.5, width: 0.8 })
      .door("primary", "dining", { at: 8 })
      .door("laundry", "kitchen", { at: 5.75, width: 0.8 });
    b.block(0, [0, 0, 14, 12], "gable");

    b.item("bed-queen", "bed2", { wall: "left", along: 2.25 })
      .item("nightstand", "bed2", { wall: "left", along: 1.0 })
      .item("nightstand", "bed2", { wall: "left", along: 3.5 })
      .item("dresser", "bed2", { wall: "back", along: 4.0 })
      .item("toilet", "bath2", { wall: "left", along: 1.25 })
      .item("vanity", "bath2", { wall: "front", along: 2.35, size: [0.9, 0.5, 0.86] })
      .item("shower", "bath2", { wall: "right", along: 1.8, size: [1.2, 0.9, 2.1] })
      .item("laundry", "laundry", { wall: "front", along: 1.0 })
      .item("bed-king", "primary", { wall: "left", along: 2.5 })
      .item("nightstand", "primary", { wall: "left", along: 1.2 })
      .item("nightstand", "primary", { wall: "left", along: 3.8 })
      .item("wardrobe", "primary", { wall: "right", along: 3.6 })
      .item("console", "entry", { wall: "right", along: 1.5 })
      .item("desk", "den", { wall: "front", along: 2.5 })
      .item("desk-chair", "den", { x: 2.5, z: 1.3, rot: 180 })
      .item("bookshelf", "den", { wall: "right", along: 1.5 })
      .item("kitchen-run", "kitchen", { wall: "left", along: 1.0, size: [2.0, 0.65, 0.92] })
      .item("fridge", "kitchen", { wall: "left", along: 3.55 })
      .item("island", "kitchen", { x: 2.5, z: 2.0, rot: 90, size: [2.0, 0.9, 0.92] })
      .item("dining-table", "dining", { x: 2, z: 2.5, rot: 90, size: [1.8, 0.95, 0.75] })
      .item("media-console", "living", { wall: "right", along: 4.5 })
      .item("sofa", "living", { x: 1.6, z: 4.5, rot: 90 })
      .item("coffee-table", "living", { x: 3.0, z: 4.5, rot: 90 })
      .item("armchair", "living", { x: 3.0, z: 2.2 })
      .item("rug", "living", { x: 2.8, z: 4.5, rot: 90, size: [2.8, 2.0, 0.012] })
      .item("plant", "living", { x: 4.4, z: 8.4 })
      .item("sedan", "carport", { x: 2, z: 3.5, rot: 90, tone: "#c8b48a" })
      .item("bench", "porch", { wall: "front", along: 2.6, off: 0.2, rot: 180, size: [1.2, 0.45, 0.46] })
      .item("outdoor-dining", "terrace", { x: 4.0, z: 2.4 })
      .item("outdoor-sofa", "terrace", { x: 9.0, z: 3.0, rot: 180 })
      .item("firepit", "terrace", { x: 9.0, z: 1.6 })
      .item("lounger", "terrace", { x: 12.0, z: 2.5 });
  },
);

const villaLaguna = defineVilla(
  {
    id: "villa-laguna", name: "Villa Laguna", address: "7 Sabal Grove Lane",
    tagline: "Lakefront glass house with an 18-metre infinity pool",
    blurb: "The largest pool on the street spills toward the lake. A cinema room, a guest suite with its own bath, and a primary suite that opens onto a 48 m² terrace.",
    price: 2_400_000, status: "Available", beds: 4, baths: 3, levels: 2, lot: 5, view: "Lake",
    style: { stucco: "#f4f1ea", trim: "#3b3a36", roof: "#c4beb3", accent: "#4f8a8b", wood: "#9b7653", fabric: "#ece6da", fabric2: "#4f8a8b", floor: "oak" },
    features: ["Infinity pool", "Cinema room", "Primary terrace", "Lake view", "Guest suite"],
  },
  (b) => {
    b.room("garage", "Garage", "garage", [0, 0, 6, 7])
      .room("media", "Cinema room", "media", [0, 7, 6, 14], { windows: false })
      .room("entry", "Foyer", "entry", [6, 0, 10, 5])
      .room("stair", "Stair hall", "stair", [10, 0, 13, 5])
      .room("gbath", "Guest bath", "bath", [13, 0, 15, 5])
      .room("guest", "Guest suite", "bedroom", [15, 0, 18, 5])
      .room("kitchen", "Kitchen", "kitchen", [6, 5, 11, 14])
      .room("living", "Living & dining", "living", [11, 5, 18, 14])
      .room("bed2", "Bedroom 2", "bedroom", [6, 0, 10, 5], { level: 1 })
      .room("landing", "Landing", "landing", [10, 0, 13, 5], { level: 1 })
      .room("pbath", "Primary bath", "bath", [13, 0, 18, 3.5], { level: 1 })
      .room("primary", "Primary bedroom", "primary", [13, 3.5, 18, 10], { level: 1 })
      .room("hall", "Upper hall", "hall", [10, 5, 13, 7], { level: 1 })
      .room("bath2", "Bath 2", "bath", [6, 5, 10, 7], { level: 1 })
      .room("bed3", "Bedroom 3", "bedroom", [6, 7, 13, 10], { level: 1 })
      .room("balcony", "Primary terrace", "balcony", [6, 10, 18, 14], { level: 1 })
      .room("driveway", "Driveway", "driveway", [0, -8, 6, 0])
      .room("front", "Front garden", "garden", [6, -8, 18, 0])
      .room("pooldeck", "Pool deck", "pooldeck", [0, 14, 18, 28]);
    b.open("kitchen", "living").open("entry", "stair").open("landing", "hall");
    b.ext("garage", "front", { kind: "garage" })
      .ext("entry", "front", { kind: "double", at: 8 })
      .ext("living", "back", { kind: "slider", at: 14.5, width: 6 })
      .ext("primary", "back", { kind: "slider", at: 15.5, width: 3.5 })
      .ext("bed3", "back", { kind: "slider", at: 9.5, width: 2.4 })
      .door("garage", "entry", { at: 2.5 })
      .door("media", "kitchen", { kind: "double", at: 8.5, width: 1.6 })
      .door("entry", "kitchen", { kind: "opening", at: 8, width: 2.4 })
      .door("guest", "living", { at: 16.5 })
      .door("gbath", "guest", { at: 2.5, width: 0.8 })
      .door("bed2", "landing", { at: 2.5 })
      .door("bath2", "hall", { at: 6, width: 0.8 })
      .door("bed3", "hall", { at: 11.5 })
      .door("primary", "hall", { at: 6 })
      .door("pbath", "primary", { at: 15.5 });
    b.stair(0, [11.6, 0.3, 12.8, 4.7], "+z");
    b.block(0, [0, 0, 6, 14], "flat").block(0, [6, 10, 18, 14], "roofdeck").block(1, [6, 0, 18, 10], "flat");
    b.setPool({ x0: 1.5, z0: 17, x1: 16.5, z1: 23.5, depth: 1.8 });

    b.item("suv", "garage", { x: 3, z: 3.5, rot: 90, tone: "#43484d" })
      .item("media-screen", "media", { wall: "left", along: 3.5 })
      .item("sofa-l", "media", { x: 3.9, z: 3.5, rot: -90 })
      .item("rug", "media", { x: 2.6, z: 3.5, rot: 90, size: [3.6, 2.6, 0.012] })
      .item("plant", "entry", { x: 3.4, z: 0.6 })
      .item("rug", "entry", { x: 2, z: 2.5, size: [2.4, 1.8, 0.012] })
      .item("vanity", "gbath", { wall: "left", along: 1.0, size: [0.9, 0.5, 0.86] })
      .item("toilet", "gbath", { wall: "left", along: 3.0 })
      .item("shower", "gbath", { wall: "back", along: 1.0, size: [1.0, 1.0, 2.1] })
      .item("bed-queen", "guest", { wall: "right", along: 2.5 })
      .item("nightstand", "guest", { wall: "right", along: 1.2 })
      .item("nightstand", "guest", { wall: "right", along: 3.8 })
      .item("kitchen-run", "kitchen", { wall: "back", along: 2.6, size: [4.2, 0.65, 0.92] })
      .item("fridge", "kitchen", { wall: "left", along: 0.7 })
      .item("island", "kitchen", { x: 2.6, z: 5.2 })
      .item("dining-table", "living", { x: 1.6, z: 2.2, rot: 90 })
      .item("media-console", "living", { wall: "right", along: 5.6 })
      .item("sofa", "living", { x: 4.0, z: 5.5, rot: 90 })
      .item("coffee-table", "living", { x: 5.2, z: 5.5, rot: 90 })
      .item("armchair", "living", { x: 5.4, z: 3.4 })
      .item("rug", "living", { x: 4.9, z: 5.5, rot: 90, size: [3.0, 2.4, 0.012] })
      .item("bed-queen", "bed2", { wall: "left", along: 2.5 })
      .item("nightstand", "bed2", { wall: "left", along: 1.2 })
      .item("nightstand", "bed2", { wall: "left", along: 3.8 })
      .item("wardrobe", "bed2", { wall: "back", along: 2 })
      .item("vanity", "bath2", { wall: "front", along: 1.5 })
      .item("toilet", "bath2", { wall: "back", along: 0.6 })
      .item("shower", "bath2", { wall: "back", along: 2.6, size: [1.4, 0.9, 2.1] })
      .item("bed-queen", "bed3", { wall: "left", along: 1.5 })
      .item("nightstand", "bed3", { wall: "left", along: 0.45 })
      .item("desk", "bed3", { wall: "front", along: 4.0, size: [1.4, 0.65, 0.75] })
      .item("tub", "pbath", { wall: "front", along: 2.5 })
      .item("vanity-double", "pbath", { wall: "right", along: 2.0 })
      .item("shower", "pbath", { wall: "left", along: 1.5 })
      .item("toilet", "pbath", { wall: "back", along: 0.55 })
      .item("bed-king", "primary", { wall: "right", along: 3.0 })
      .item("nightstand", "primary", { wall: "right", along: 1.75 })
      .item("nightstand", "primary", { wall: "right", along: 4.25 })
      .item("dresser", "primary", { wall: "left", along: 4.5 })
      .item("rug", "primary", { x: 2.8, z: 3.0, rot: 90, size: [3.0, 2.4, 0.012] })
      .item("outdoor-sofa", "balcony", { x: 9, z: 1.5, rot: 0 })
      .item("coffee-table", "balcony", { x: 9, z: 2.6 })
      .item("lounger", "balcony", { x: 3.0, z: 2.0 })
      .item("lounger", "balcony", { x: 4.1, z: 2.0 })
      .item("plant", "balcony", { x: 11.4, z: 3.4 })
      .item("lounger", "pooldeck", { x: 4, z: 11.6 })
      .item("lounger", "pooldeck", { x: 5.1, z: 11.6 })
      .item("lounger", "pooldeck", { x: 6.2, z: 11.6 })
      .item("lounger", "pooldeck", { x: 7.3, z: 11.6 })
      .item("parasol", "pooldeck", { x: 9.0, z: 11.6 })
      .item("outdoor-dining", "pooldeck", { x: 13.5, z: 1.6 })
      .item("grill", "pooldeck", { x: 17.2, z: 1.6, rot: -90 })
      .item("sedan", "driveway", { x: 3, z: 4.3, rot: 90, tone: "#b0b4b8" });
  },
);

export const VILLAS: BuiltVilla[] = [casaPalma, villaCoral, theCypress, villaSable, heronHouse, villaLaguna];

export const villaById = (id: string) => VILLAS.find((v) => v.id === id);
