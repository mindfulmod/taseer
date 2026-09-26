# Phase 1 implementation

Implemented on `codex/phase-1`, based on production commit
`68178539be890ba683b9d83030a2c3ded8813945`. No deployment or data-classification changes.

## Changes

- Shared artwork loading/ready/error states across food rows, recent items, chips,
  compare items and heroes. Fallback emoji are hidden while loading and always
  decorative to assistive technology. Visible thumbnails load eagerly; offscreen
  art stays lazy. Heroes load eagerly with high priority and reuse a decoded
  thumbnail while loading when one is available.
- Content-versioned food image cache, retained across shell releases and limited
  to 256 files. Legacy cached bytes migrate only when their hash matches current
  artwork. Cache cleanup is restricted to this app's scope. Changed artwork gets
  a new URL version. Worker logic itself now contributes to the release stamp.
- One 32-row initial budget per list, shared across its groups. Mobile builds only
  the selected Eat/Avoid list; desktop builds both, with 32 rows per column.
  Resizing updates the columns. Explicit pagination keeps every food accessible
  and places keyboard focus on the first newly revealed item.
- Find shows categories before secondary exploration. Remedy screens retain
  preparations in a compact disclosure so food recommendations appear sooner.
- Food headlines show whether the histamine reading matches, differs from, or is
  absent from the SIGHI reference. The source-status button focuses its detail.
- CI verifies both image sets for coverage, correct IDs, pixel decodability,
  dimensions and size limits, and checks generated artwork versions. Pillow is
  only a build-time dependency; the app still has no runtime dependencies.

## Verification

- Ten Node regression tests pass, covering mobile/desktop row budgets and sorting,
  complete deferred pagination, source labels, image decoding states and preview
  failures, shell updates, offline cache hits, changed artwork, legacy migration,
  isolation from other app caches, failed responses and bounded storage.
- Dataset validation, generated-data freshness, palette, type scale, 60-screen
  accessibility-pattern checks and whitespace checks pass. Service-worker stamping
  is idempotent. All 2,000 heroes and 2,000 thumbnails decode and meet their budgets.
- Browser inspection: 390 × 844 mobile, 1280 × 900 desktop, light and dark themes;
  live search, Eat/Avoid switching, responsive column changes, pagination and focus,
  food hero presentation, source-detail navigation and Find category ordering.
- Controlled network fixture held artwork requests pending: loading tiles showed
  no fallback emoji, while names and controls remained usable. The first food row
  stayed at 521.46px before and after images arrived (no image-induced layout shift
  in this scenario).
- With the fixture network disconnected, the cached shell and viewed thumbnails
  loaded on refresh. Uncached images used a decorative error fallback; list search
  still worked. The production-like loopback origin avoided localhost's intentional
  development cache-busting behavior.

At 390 × 844 with the notice visible, the initial remedy food-row count changed
from 480 to 32. The first food moved from approximately 913px down to 521px.
These are measured DOM/layout improvements, not a claim of a particular load-time
speedup. Cache upgrades are covered by lifecycle tests; a full installed-device
release upgrade should also be checked when this branch is deployed.

## Remaining scope

Preparation image generation, alias explanations, thermal-dot legends, history/
scroll restoration and preparation-time cleanup remain Phase 2. The 44 preparations
still use their existing emoji when their disclosure or detail page is opened.
