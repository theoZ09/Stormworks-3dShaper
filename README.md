# Hull Builder

Stormworks-inspired hull designer in plan view. Draw the hull shape on a grid where each cell is a 0.25 m block.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you land directly in the designer.

## Features

- **Cube** and **Wedge** (1×1, 1×2, 1×4) — always available as tools
- Wedges are drawn as triangles; long wedges as a single continuous piece
- **Symmetry** mirrors across the hull centerline (port/starboard)
- **Placement:** cubes are painted with drag; wedges are placed with preview (hold mouse button, release)
- **Pan/zoom:** middle mouse or Space+drag, scroll or ± buttons
- **Undo:** Ctrl+Z / Ctrl+Y
- **Rotation:** R cycles wedge tilt/orientation
- Settings and grid are saved in localStorage

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` | Cube |
| `2` | Wedge |
| `3` | Erase |
| `R` | Rotate wedge |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |

## Tech

Vite + React + TypeScript + Tailwind CSS + Zustand + Canvas
