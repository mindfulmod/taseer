# Taseer (working repo: Foodex)

Fast, graphical, offline-first PWA answering two questions about any food: **does it run hot or cold** (TCM · Ayurveda · Unani, shown as honest per-system badges) and **is it a histamine risk** (SIGHI 0–3 + mechanism tags) — built around a remedy finder: *"my body feels hot → cooling foods I actually have, now."*

## Specs (source of truth)

| Doc | Covers |
|---|---|
| [specs/01-product-spec.md](specs/01-product-spec.md) | Soul, core loop, verdicts, cards, browse, personal layer, safety, v2 parking lot |
| [specs/02-data-spec.md](specs/02-data-spec.md) | Curation model (Claude classifies, owner spot-checks), schema, sources, staged 250→1000 rollout |
| [specs/03-design-system.md](specs/03-design-system.md) | Temperature-as-color identity, badges, screens, light/dark |

## Locked decisions at a glance (2026-08-02)

Remedy-finder-first · four body states · eat+avoid lists · per-system badges (no synthesized verdict) · SIGHI histamine layer · common-kitchen ranking · dish-level verdicts with ingredient chips · alias search + miss log · static PWA, no backend, no accounts · localStorage favorites/triggers/history · staged data rollout starting ~250 foods · traditional-info safety framing · name **Taseer**.

**Parked to v2 (dated, deliberate):** AI live lookup · eating log · native-script names · full recipe lane.
