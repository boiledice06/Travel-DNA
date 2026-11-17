# Travel Preference MVP — Project Context

Local path: `C:\Users\semin\travel-preference-mvp`

## Shipped today (start here)

| Doc | Purpose |
|-----|---------|
| **[mvp-overview.md](./mvp-overview.md)** | End-to-end how-it-works (Korean): TripProfile → Likert 5축 → DNA chat → constraints → seoul-find |
| **[ui-integration-guide.md](./ui-integration-guide.md)** | Separate frontend: API contract, CORS, screen sequence, fetch/curl |
| **[api-bundle-manifest.md](./api-bundle-manifest.md)** | Transferable zip/folder file list (`dist/travel-preference-mvp-api-bundle.zip`) |
| [seoul-flow-how-it-works.md](./seoul-flow-how-it-works.md) | Short Seoul flow primer |
| [run-shipped-flow.md](./run-shipped-flow.md) | Built-in UI run book |

Absolute docs root:  
`C:\Users\semin\AppData\Local\Cursor\AgentStores\cursor_agent_stores\bc-f697f031-e73b-4c7c-8d37-f8a4af0ddb54\files\docs\`

## Current planning

Product-shape plan (taste discovery → common industries → search passes; novelty/local/trend modules deferred):  
**[recommendation-plan.md](./recommendation-plan.md)**  
Absolute: `C:\Users\semin\AppData\Local\Cursor\AgentStores\cursor_agent_stores\bc-f697f031-e73b-4c7c-8d37-f8a4af0ddb54\files\docs\recommendation-plan.md`

The sections below are the earlier architecture dump (DNA schema + 4-step Places-oriented pipeline + extension hooks). Prefer the planning doc above for current intent and deferrals. Prefer **mvp-overview** for what actually ships.

## Goal

Quantify travel taste (Travel DNA) from natural-language likes/dislikes, then recommend places via a 4-step pipeline that maps abstract preference axes to map-API search queries.

## 1. Travel DNA (quantification)

From natural-language travel experiences, ABSA extracts emotion + cause into:

### Four pillars (ratios sum to 1.0)

- **Do & Play** — exploration / activity
- **See & Learn** — sightseeing / learning
- **Stay & Vibe** — space / mood
- **Eat & Local** — food / local

### Five macro axes (−1.0 … +1.0)

- **Authenticity**: landmark (−1) ↔ hidden/local (+1)
- **Energy & Pace**: static/rest (−1) ↔ dynamic/activity (+1)
- **Social Density**: quiet/private (−1) ↔ crowded/hotspot (+1)
- **Novelty**: classic/familiar (−1) ↔ unusual (+1)
- **Setting**: urban/indoor (−1) ↔ nature/outdoor (+1)

### Micro keywords (optional)

Specific entity tastes, e.g. `#고양이`, `#독립서점`, `#목조주택`.

## 2. Recommendation pipeline (4 steps)

1. **Slot allocation** — assign ~10 place slots by pillar ratios.
2. **Query assembly** — look up noun archetype from Setting + Energy + Novelty; add adjectives from Authenticity + Density; force-bind micro keywords on 1–2 slots.
3. **Places API + filters** — Google Places candidates; review-count filtering by Density/Authenticity.
4. **LLM review check** — light review validation + personalized “why this fits” copy on the map.

## 3. MVP vs extension hooks

**MVP:** mid-city Standard → Mid-Novelty spaces via predefined matrix + map API only.

**Hooks (do not rewrite core):**

- Authenticity < −0.6 → landmark DB
- Novelty ≥ 0.7 → local-language / Reddit 2-hop search
- Density/Energy > 0.6 + trend option → recent web/SNS discovery
