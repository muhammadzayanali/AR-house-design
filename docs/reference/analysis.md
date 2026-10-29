# Reference vs current result

Studied `house-reference.png` (cutaway modern villa on a dark studio ground). `current-result.png` was not present as a separate upload; the live result screen (before this pass) is the floating `max-w-md` card in `ARExperience` over a bright-blue viewer. Gaps below are from that screen plus the procedural massing.

## Reference traits

- **Massing:** two storeys. Ground floor is a long plaster bar. Upper floor is a smaller box set back, so the mid slab reads as a cantilever.
- **Cantilever slab:** thick light-grey concrete band (~0.3 m visually) with a crisp shadow line under the overhang. Thin roof parapet on the upper box.
- **Materials:** warm off-white plaster, cooler concrete edges, dark metal frames. Not flat primary colours.
- **Glazing:** floor-to-ceiling panels with slim dark mullions. Glass is slightly warm, not cyan.
- **Interior glow:** the hero. Dining table and chairs, sofa, and ceiling spots are visible through the glass. Evening light is the point of the shot.
- **Furniture / fittings:** dining set, lounge seating, a lounge chair on the terrace, a vertical downpipe, a glass terrace rail on the left.
- **Lighting:** soft studio key from the front-left, dark neutral background (not sky blue), contact shadow under the plinth.
- **Camera:** near-elevation, almost orthographic 3/4, house fills the frame, ground plane is a thin site, not a huge lawn card.
- **Site:** a shallow plinth / paved edge, not a giant green box or skewed wedge.

## 10 biggest gaps (before this pass)

1. Details sit in a phone-width card that covers the lower half of the model on every viewport.
2. Desktop does not use a two-column layout; the same card floats on a wide page.
3. “Home” is a tiny text link. There is no clear back control.
4. Cost is shown as a bare PKR figure, easy to read as a quote.
5. “Evening” is a single pill, easy to miss, and interior glow is weak.
6. Ground is a large flat box; Italian/modern site slabs can read as skewed wedges.
7. Cantilever edge is too thin; parapet, door, canopy, AC units, and stone/timber strips are missing or token.
8. Glass has little warm interior (no readable dining set / downlights in evening).
9. No lawn, kerb, boundary wall, gate, driveway, or trees tied to the plot.
10. Camera sits in a bright blue fog instead of a dark studio / blurred environment, so the massing looks like a diagram.

## Extra improvements chosen

- Bottom sheet with peek / half / full, and `camera.setViewOffset` so the house stays in the visible band.
- Day / Evening segmented control that drives exposure and interior emissive.
- Honest chips: “Generated massing model” and “Preliminary estimate”.
- Plot ground from a wound `Shape` (rectangle or measured polygon), not a stretched box.
