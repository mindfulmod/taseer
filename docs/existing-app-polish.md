# Existing-app polish — September 26, 2026

The five prototype directions changed too much of Taseer's identity. This pass
refines the production stylesheet while preserving screen structure, navigation,
painted assets, warm palette, type stack, data and application behavior.

- Consistent radii: 12px controls/glyphs, 14px rows, 18px panels, 24px heroes.
- Rounded rectangular search and sort fields, a matching segmented control,
  and a tighter navigation container with 44px minimum desktop targets.
- Reduced raised shadows, flat content panels and restrained home state cards.
- Stronger secondary labels and search placeholders; quieter food-summary tint.
- Consistent 120ms press feedback and search focus styling; existing keyboard
  outlines and reduced-motion override remain in effect.
- Extra desktop banner clearance accommodates the larger navigation targets.

Validation: palette and type checks pass; structural accessibility check covers
107 rendered screens. Browser checks cover home, Find, remedy, food, preparation
library and Me at 320px and 1280px without horizontal overflow. Screenshots
reviewed home and food at 390×844 in light and dark, remedy in light, and Find
on desktop in both themes. Search returns Apple and the Eat/Avoid selection
changes successfully. Browser console has no captured errors.

Only ART.md, assets/app.css, the generated service-worker stamp, and this note
were changed in this pass. Earlier phase and prototype work remains separate in
the existing working tree. Preview: http://127.0.0.1:4192/ — not deployed.
