import { footprintInside } from "../frontend/lib/ar/plotClamp.ts";

const ell = [
  { x: 0, z: 0 },
  { x: 8, z: 0 },
  { x: 8, z: 3 },
  { x: 3, z: 3 },
  { x: 3, z: 8 },
  { x: 0, z: 8 },
];

if (!footprintInside(ell, 1.5, 1.5, 0, 2, 2)) {
  throw new Error("a 2 m house in the corner of the L should fit");
}
if (footprintInside(ell, 6.2, 6.2, 0, 2, 2)) {
  throw new Error("the notch of the L must reject the house");
}
if (footprintInside(ell, 5.5, 1.2, 0, 2, 2) !== true) {
  throw new Error("the east wing of the L should accept a 2 m house");
}
console.log("L-shaped plot clamp tests passed");
