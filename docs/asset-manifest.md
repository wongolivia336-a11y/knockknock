# Visual asset manifest

All assets below are local project assets. New raster illustrations were generated with the built-in ImageGen tool on 2026-10-23; they are original decorative assets, not UI or text replacements.

| File | Source / prompt intent | Size | Usage | Status |
| --- | --- | --- | --- | --- |
| `public/assets/stickers/knock-hand-sticker.png` | ImageGen; naive hand-drawn index-finger tap, warm peach/coral palette, thick white die-cut edge, transparent background | 1312 × 1199 PNG, RGBA, 773 KB | `src/main.jsx` `.knock-hand-sticker` inside the live box stage; animated twice after “敲两下” | Integrated; full interaction and mobile-size QA remains open |
| `public/assets/stickers/unknown-presence-sticker.png` | ImageGen; abstract cloud-like unknown presence, pastel coral/lavender/yellow/sage, no face or species, white sticker edge, transparent background | 1374 × 1145 PNG, RGBA, 1.30 MB | Today's Note and Personality Profile in the phone prototype | Integrated; visibility verified in fresh 1440 × 1000 production-preview screenshot; mobile-size QA remains open |

## Native vector / code visuals

- KNOCK KNOCK brand mark: original inline SVG `BrandMark` in `src/main.jsx`; typography, gradients, strokes and tap marks are code-native.
- Mini box illustration: inline SVG in `MiniBoxArt`; continuous rounded shell, no separate lid or signal dot.
- App icons, island route/map, progress, stamp perforation and UI states remain SVG/DOM/CSS so they stay crisp and accessible.

## Existing assets not reused in this pass

- `public/assets/hand-reaching.png` is a red glowing hand, not the requested calm die-cut tap sticker.
- `public/assets/personality-stickers.png` includes recognizable animal drawings, which would imply an identity the product must leave unknown.
- Other legacy collage sheets have not been assumed reusable; each should be inspected and cropped deliberately before integration.

