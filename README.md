# Skrovbyggaren

Stormworks-inspirerad skrovdesigner i planvy. Rita skrovets form på ett rutnät där varje cell motsvarar ett 0,25 m-block.

## Starta

```bash
npm install
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) — du hamnar direkt i designern.

## Funktioner

- **Kub** och **Wedge** (1×1, 1×2, 1×4) — alltid tillgängliga som verktyg
- Wedges ritas som trianglar; långa wedges som en sammanhängande bit
- **Symmetri** speglar över skrovets mittlinje (port/styrbord)
- **Placering:** kuber målas med drag; wedges placeras med förhandsvisning (håll musknapp, släpp)
- **Pan/zoom:** mittenmus eller Space+dra, scroll eller ±-knappar
- **Ångra:** Ctrl+Z / Ctrl+Y
- **Rotation:** R cyklar wedge-lutning/orientering
- Inställningar och rutnät sparas i localStorage

## Tangenter

| Tangent | Åtgärd |
|---------|--------|
| `1` | Kub |
| `2` | Wedge |
| `3` | Radera |
| `R` | Rotera wedge |
| Ctrl+Z | Ångra |
| Ctrl+Y | Gör om |

## Tech

Vite + React + TypeScript + Tailwind CSS + Zustand + Canvas
