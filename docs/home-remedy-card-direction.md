# Illustrated remedy cards

The home entry points now borrow their visual language from Taseer's painted
food library: cucumber-mint water for cooling, ginger tea for warming, pear and
rice for reactions, and a produce basket for browsing. These illustrate the
existing destinations; they do not change classifications or make new promises.

The temperature pair has a separate illustrated upper surface and a clear lower
text block. Smaller companion cards keep reactions and browsing visible without
giving all four choices identical weight. On desktop the companions stack to
the right. Each card remains one native button with its original destination
and complete text label. Matching remedy headers use the same new artwork.

## Assets and generation

Generated using the built-in image generation tool. Final transparent WebP files
are in `assets/ui/states/`: `too-hot.webp`, `too-cold.webp`, `reactive.webp`, and
`browse.webp`. Each is 400×400; together 124,412 bytes (121.5 KiB). Alpha was
preserved while downsampling and encoding. All four are included in the offline
shell. Original generated PNGs remain in the default generated-images folder.

## Exact prompts

Every prompt consists of the following shared text, followed by ` Subject: `
and its individual subject paragraph below.

> Create one premium editorial food illustration for Taseer, a warm traditional-food app. Transparent background with genuine alpha, no background rectangle or scene. Soft hand-painted gouache and watercolor, matte, delicately irregular edges, restrained detail, no outlines, no photorealism, no glossy 3D, no cartoon face. Three-quarter view, soft light upper left, small natural contact shadow. A compact beautifully composed still life centered in a square, all objects fully visible with generous 12% transparent margins. Earthy muted colors on the subjects, cream pottery, matching a refined illustrated cookbook. No text, no lettering, no symbols, no branding, no border. Asset should read clearly at 140px.

### too-hot.webp

A low clear tumbler of water with two cucumber slices, a short whole cucumber and a few fresh mint leaves beside it. Cool sage greens, clear water, delicate highlights. Refreshing and calm, simple silhouette. No ice cubes.

### too-cold.webp

A small wide cream ceramic cup of amber ginger tea on a matching saucer, a knuckle of fresh ginger and two ginger slices beside it, two fine soft curls of visible steam above. Warm ochre and muted terracotta accents. Cozy, tactile and elegant.

### reactive.webp

One lovely ripe pale green pear beside a small cream ceramic bowl containing plain cooked white rice. A single small pear leaf. Quiet and simple, softly painted, no herbs or extra garnish.

### browse.webp

A low woven market basket holding a golden pear, leafy greens, one small red apple and a modest bunch of carrots. Balanced earthy colors, compact silhouette, a handful of produce only. No handle rising above the food.

## Verification

- Reviewed screenshots at 390×844 and 1280×900 in light and dark, and at 320px in light.
- All four new images decoded in the browser; all four home buttons reached their original destination.
- No horizontal overflow on the 320px home or its four destinations.
- Palette, type scale, 107-screen structural accessibility check and all 15 existing tests passed.
- Service worker stamped after final shell changes. Local preview only; not deployed.
