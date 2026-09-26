# Taseer live audit and two-phase plan

Audit date: September 25, 2026. Target: https://mindfulmod.github.io/taseer/.
GitHub baseline: `68178539be890ba683b9d83030a2c3ded8813945` on `main`.

## Recommendation

Keep the painted food illustrations, warm palette, three-tab navigation, and separate traditional classifications. Improve the existing app in two releases: first make artwork and the primary task appear reliably and promptly; then complete preparation imagery and refine deeper browsing, detail, and return flows.

The food catalogue does not need a new image-generation campaign. All 2,000 food records have hero images and thumbnails in current GitHub. The visible emoji problem has two distinct causes: transient emoji fallbacks under loading food images, and 44 preparation records whose renderers only support emoji.

This is an audit and implementation plan; application code and the deployment have not been changed.

## What was verified

- Inspected the live home, Too hot recommendations, food detail, Find, alias search, and preparation detail at desktop size and a 390 × 844 phone viewport. The observed session used dark mode; light-theme styling was inspected in source, not visually certified.
- Cloned current GitHub into a temporary audit directory. The working Foodex checkout is older (`79e4f4a`), so it was not used as the production baseline.
- Compared live `index.html`, `components.js`, `views.js`, `foods.js`, and `sw.js` byte-for-byte against current GitHub: all matched.
- Ran dataset validation and the current image checker successfully. Separately counted thumbnails because the current checker does not validate them.
- Inspected loading markup, CSS, routing, pagination, data provenance, the service worker, art specification, and deployment checks.

These are observed UI and source findings, not a controlled performance benchmark. Offline/update behavior below is a code finding pending runtime reproduction. The inventory confirms repository coverage; it is not an HTTP check or visual quality review of all 4,000 image files.

## Findings, ordered by impact

### 1. Emoji flashes are explicitly built into food rendering

`artGlyph()` prints `food.emoji` immediately, then places an image over it. `.glyph__art` absolutely positions that image on top. Until its bytes arrive and decode, the emoji is visible. Every thumbnail uses `loading="lazy"`, including first-screen rows and recent items. If loading fails, `onerror` removes the image, leaving the emoji permanently.

Food heroes also use `loading="lazy"`. On the live Banana page, the initial screenshot showed an empty hero area; a later inspection confirmed the full 640px image had loaded.

The fix is an explicit loading/ready/error state, with a reserved, quietly tinted image area while loading. Reveal artwork when ready; reserve any emoji fallback for genuine failure or offline absence. An unavailable connection cannot show uncached artwork, so the error state still matters. Hide decorative fallback emoji from assistive technology; they are currently announced even when an illustration covers them.

Eager-load the active hero and a small first-screen thumbnail set. Keep later thumbnails lazy. Give high fetch priority only to the main hero or genuinely critical asset. Reuse an already loaded thumbnail while its matching hero loads. Avoid blocking the whole app until images finish.

### 2. Food artwork is complete; preparation artwork is not

| Asset family | Coverage | Actual file bytes |
|---|---:|---:|
| Food heroes | 2,000 / 2,000 | 36.4 MiB |
| Food thumbnails | 2,000 / 2,000 | 19.9 MiB |
| Preparations with image support in their renderers | 0 / 44 | Emoji-only rendering |

The largest food hero is 43.2 KiB; the largest thumbnail is 22.8 KiB. No missing IDs or extra filenames were found in either food image directory.

`prepTile()` uses only `prep.emoji`; `prepView()` does the same for its heading illustration. Dropping new files into a directory would not make those images appear. Preparation records and renderers need an explicit art mapping.

Eight preparation IDs match an existing food ID after removing `prep-`: barley water, doogh, smashed cucumber, shorbat adas, sooji halwa, khichdi, poha, and fennel tea. These are reuse candidates, not automatically correct images. Additional name/content matches may be usable. Check the finished dish against ingredients and method before deciding which art to reuse or generate.

### 3. Primary content appears too late on mobile

On the 390 × 844 Too hot screen, the first food row starts about 913px from the top. Four preparation cards occupy the space before food recommendations. On Find, eight secondary destinations appear ahead of the eight food categories; the categories are absent from its first viewport.

Move categories directly below Find's search field and group the explanatory destinations below them. On remedy screens, show the first useful foods earlier and retain preparations in a compact, clearly visible section after the first food group or through a short, explicitly labelled preview. Keep the preparation feature discoverable.

Preserve the concise traditional-information notice, but reduce surrounding spacing where it crowds the actual task. Validate with the notice visible, not only after dismissal.

### 4. Pagination still renders hundreds of food rows immediately

The live Too hot route creates 480 food rows and 485 images on the inspected phone viewport. The reason is structural: pagination allows 60 rows per commonness group, and both Eat and Avoid columns are built. Four groups × two columns can therefore generate 480 rows before any user request for more.

Use an initial total rendering budget per active list, defer later groups, and defer the inactive mobile tab. Preserve counts and grouping. Start with a proposed budget of roughly 24–40 food rows on mobile and validate it; desktop may use a separate budget for the two visible columns. Preserve keyboard access and explicit “Show more” controls.

### 5. Shell updates throw away the image cache

The image cache name includes the shell version. Activation deletes caches whose names do not start with the new version. As a result, a routine shell update deletes previously cached food artwork. This works against fast repeat visits and offline artwork retention.

Separate artwork versioning from shell versioning. Use a Taseer-owned cache prefix, a content/version manifest for changed assets, and bounded cleanup. Restrict cleanup to this app's caches: the current deletion predicate ranges over all cache names on the origin. Test upgrades with retained and changed images, not just a fresh install.

Do not precache the entire image library: heroes and thumbnails together are about 56.2 MiB. Cache a small critical set and viewed images; consider any full offline image download only as an explicit later feature.

### 6. Important meaning is less visible than decorative polish

- Food rows show three colored dots, with screen-reader labels but no visible explanation of the TCM/Ayurveda/Unani order. Add a compact legend and an accessible way to inspect readings; do not rely on color or hover alone.
- Searching “karela” correctly finds Bitter gourd. Showing the matched alias under its name would explain the result more directly than a truncated description.
- Banana's headline histamine rating is `1 · Usually fine`, while a lower panel reports the stored SIGHI reference as `2`. Put source status beside the headline verdict and link to the detail.
- Current data classifies 71 foods as matching its stored SIGHI reference, 5 as differing with an explanation, 111 as differing without review, and 1,813 as derived without a direct SIGHI entry. These are app-data states, not an independent clinical verification. Do not present every derived rating as directly sourced SIGHI evidence.

### 7. Returning and preparation details need small functional refinements

The router resets scroll on route changes and resets all pagers. Returning from a food can therefore lose the user's position and loaded rows. A preparation opened from Too hot has a “Lists” back link, which takes the user to a different parent than the one they came from.

Restore list position, filters, expanded pages, and focus on Back. Keep a useful fallback for a directly opened link. Make the “All 14” preparation link preserve the selected body state; currently it opens the general lists page.

Preparation time labels also need consistency: Cucumber-mint water advertises 5 minutes, but its instructions include a 20-minute rest. Introduce active/rest/total time where needed and audit the 44 records.

## Phase 1 — reliable artwork and a faster primary flow

**Outcome:** the app feels intentionally illustrated from its first usable frame, and users reach foods sooner.

1. Start from current production `main`, preserving unrelated local work. Capture reproducible cold/warm load baselines before changing anything.
2. Build one shared artwork component with loading, ready, and error states; explicit dimensions; decorative accessibility treatment; and critical-versus-lazy loading options. Integrate it into food rows, chips, recent items, and heroes.
3. Eager-load only the initial visible artwork and current hero. Consider minimal home-art preload hints after checking the baseline waterfall. Do not mark all thumbnails high priority.
4. Separate image-cache lifetime from shell releases and constrain cache cleanup. Ensure changed artwork can still refresh.
5. Reduce initial list construction; defer inactive mobile content and later groups.
6. Make the focused hierarchy changes: Find categories immediately after search; recommendations before a long preparation block; balanced spacing around notices and controls.
7. Surface the existing source-status distinction next to the headline histamine verdict. Preserve classification values; adjudicating them is separate content work.
8. Extend image checks to hero/thumbnail completeness, decodability, dimensions, and budgets. Fail CI for missing required assets rather than merely printing coverage.

**Likely files:** `assets/js/components.js`, `assets/js/views.js`, `assets/js/app.js`, `assets/app.css`, `index.html`, `sw.js`, `scripts/check-images.mjs`, and the Pages workflow. Update the art/image documentation to reflect intentional loading states and the actual 2,000-food catalogue.

**Release criteria:**

- No emoji-to-image flash for available food artwork during a cold or warm visit; stalled requests show a stable loading surface and failures resolve to a deliberate fallback.
- Text, navigation, and search remain usable while images load; no layout jump as art appears.
- At 390 × 844 with the notice visible, at least one food recommendation is visible initially; Find shows category choices before educational destinations.
- The initial mobile remedy DOM stays within the chosen food-row budget instead of building 480 rows.
- Viewed artwork survives a shell-only update and remains available offline; a changed artwork version refreshes correctly.
- Validate slow-network, failed-image, offline, warm-cache, and update scenarios; keyboard and screen-reader names; narrow mobile and desktop layouts; light/dark and reduced motion. Report actual before/after timings rather than promising an unmeasured speedup.
- Run dataset, data-bundle freshness, service-worker stamp, palette, type, and image checks. Add focused browser regression coverage for the image state and pagination/update behaviors.

## Phase 2 — finish preparation art and refine browsing/detail quality

**Outcome:** preparations look like part of the same product, and users can interpret and navigate the information more easily.

1. Create an explicit 44-row preparation artwork manifest: reuse candidate, needs generation, art reference, review status, hero, and thumbnail. Reuse only when the existing picture accurately depicts the preparation.
2. Produce a small calibration batch spanning a drink, soup, dry dish, and mixed plate. Match the existing matte gouache style, warm sand background, soft upper-left light, three-quarter viewpoint, and consistent framing. Review recognizable ingredients and regional preparation details.
3. Generate the remaining genuine gaps in small batches using the image-generation workflow. Aim for 640 × 427 WebP heroes within the established 45 KiB budget and optimized 320px square thumbnails. Review both at actual list size and full detail size. The number of new images is determined by the reuse audit, up to 44—not 2,000.
4. Connect mapped artwork to preparation cards and detail pages using Phase 1's loading component. Ship only coherent, reviewed batches; finish all 44 mappings before this phase closes.
5. Add the thermal-dot explanation and matched search aliases; refine detail hierarchy so headline readings, disagreement, and evidence status are understood together. Keep the three traditional readings separate.
6. Restore list scroll, loaded pages, filters, and focus after detail views. Preserve the origin when leaving a preparation and state context in “All preparations” navigation.
7. Correct active/rest/total preparation times and review truncated or overly categorical copy where it obscures the existing information.
8. Review contrast, touch targets, focus visibility, image consistency, and sticky navigation spacing across the changed screens. Preserve the established palette and lightweight stack.

**Release criteria:**

- All 44 preparations have a reviewed, semantically correct art mapping and render images in both list and detail views.
- Every required hero and thumbnail is checked by CI; no missing file is silently shipped.
- A person can tell why an alias search result matched and what the three tradition dots represent without relying on hover.
- Returning from a food or preparation restores its originating context; paginated items remain reachable.
- Preparation time labels match the instructions, including waiting time where applicable.
- Run the same visual, accessibility, network, and offline matrix for preparations and the changed navigation paths.

## Scope and sequencing

Ship Phase 1 independently; it addresses the reported flash without waiting for image generation. In Phase 2, audit reuse and calibrate the visual batch before generating the remainder. Keep the vanilla HTML/CSS/JS stack, offline data access, saved favourites/triggers, existing deep links, and established identity.

Do not hold either release for a framework rewrite, a new brand, or regenerating existing food art. An independent review of the 111 unresolved source differences deserves its own content queue; this UI plan surfaces those differences honestly and does not claim to resolve them.

## Source pointers

- [Production renderer and image behavior](https://github.com/mindfulmod/taseer/blob/68178539be890ba683b9d83030a2c3ded8813945/assets/js/components.js)
- [Screen hierarchy, preparation views, and grouped lists](https://github.com/mindfulmod/taseer/blob/68178539be890ba683b9d83030a2c3ded8813945/assets/js/views.js)
- [Caching and update lifecycle](https://github.com/mindfulmod/taseer/blob/68178539be890ba683b9d83030a2c3ded8813945/sw.js)
- [Source-status derivation](https://github.com/mindfulmod/taseer/blob/68178539be890ba683b9d83030a2c3ded8813945/assets/js/data.js)
- [Preparation records](https://github.com/mindfulmod/taseer/blob/68178539be890ba683b9d83030a2c3ded8813945/data/preparations.json)
- [Existing image checker](https://github.com/mindfulmod/taseer/blob/68178539be890ba683b9d83030a2c3ded8813945/scripts/check-images.mjs)
