import {
  Armchair, Bath, BedDouble, Car, CookingPot, DoorOpen, Footprints, Laptop, Package, Shirt, Sofa, Trees, Tv,
  UtensilsCrossed, WashingMachine, WavesLadder, type LucideIcon,
} from "lucide-react";
import type { RoomType } from "../data/types";

export const ROOM_ICON: Record<RoomType, LucideIcon> = {
  living: Sofa, kitchen: CookingPot, dining: UtensilsCrossed, bedroom: BedDouble, primary: BedDouble,
  bath: Bath, powder: Bath, office: Laptop, hall: DoorOpen, entry: DoorOpen, stair: Footprints, landing: Footprints,
  garage: Car, laundry: WashingMachine, closet: Shirt, media: Tv, pantry: Package, terrace: Armchair,
  balcony: Armchair, pooldeck: WavesLadder, driveway: Car, garden: Trees,
};
