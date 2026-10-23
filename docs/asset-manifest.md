# Visual asset manifest

All assets below are local project assets. New raster illustrations were generated with the built-in ImageGen tool on 2026-10-23; they are original decorative assets, not UI or text replacements.

| File | Source / prompt intent | Size | Usage | Status |
| --- | --- | --- | --- | --- |
| `public/assets/stickers/knock-hand-sticker.png` | ImageGen; naive hand-drawn index-finger tap, warm peach/coral palette, thick white die-cut edge, transparent background | 1312 × 1199 PNG, RGBA, 773 KB | `src/main.jsx` `.knock-hand-sticker` inside the live box stage; animated twice after “敲两下” | Integrated; full interaction and mobile-size QA remains open |
| `public/assets/stickers/unknown-presence-sticker.png` | ImageGen; abstract cloud-like unknown presence, pastel coral/lavender/yellow/sage, no face or species, white sticker edge, transparent background | 1374 × 1145 PNG, RGBA, 1.30 MB | Today's Note and Personality Profile in the phone prototype | Integrated; visibility verified in fresh 1440 × 1000 production-preview screenshot; mobile-size QA remains open |
| `public/assets/stickers/wait-hourglass-sticker.png` | ImageGen; patient hourglass with a small warm light mote, colored-pencil/riso texture, transparent background; resized for UI delivery | 480 × 720 PNG, RGBA, 429 KB | Wait action button and temporary waiting response beside the 3D box | Integrated; transparent alpha verified |
| `public/assets/stickers/gentle-touch-sticker.png` | ImageGen; softly curled index finger, peach/coral pencil texture, white die-cut edge, transparent background; resized for UI delivery | 480 × 720 PNG, RGBA, 408 KB | Touch action button and temporary touch response beside the 3D box | Integrated; transparent alpha verified |
| `public/assets/stickers/listening-ear-sticker.png` | ImageGen; ear with three gentle sound waves, warm pastel pencil/riso texture, white die-cut edge, transparent background; resized for UI delivery | 720 × 658 PNG, RGBA, 581 KB | Listen action button and temporary listening response beside the 3D box | Integrated; transparent alpha verified |
| `public/assets/knock-knock-logo.svg` | User-provided `knock-knock-logo.svg`, copied as supplied | 1254 × 1254 SVG, single-color path | Header brand icon; paired with the existing live-text wordmark | Integrated |

## Native vector / code visuals

- KNOCK KNOCK brand icon: user-provided editable SVG in `public/assets/knock-knock-logo.svg`; wordmark remains live text in `BrandMark`.
- Mini box illustration: inline SVG in `MiniBoxArt`; continuous rounded shell, no separate lid or signal dot.
- App icons, organically curved island route/map, progress, stamp perforation and UI states remain SVG/DOM/CSS so they stay crisp and accessible.

## Existing assets not reused in this pass

- `public/assets/hand-reaching.png` is a red glowing hand, not the requested calm die-cut tap sticker.
- `public/assets/personality-stickers.png` includes recognizable animal drawings, which would imply an identity the product must leave unknown.
- Other legacy collage sheets have not been assumed reusable; each should be inspected and cropped deliberately before integration.
