# Casegoods — Interactive Modular Mortise Wall Handoff Package

This file is a self-contained implementation spec and drop-in module for adding the **Casegoods Interactive Modular Mortise Wall** (background + interactive **Wall Hook**, **Shelf + Closet Rod**, and **Two-Drawer Cabinet** pieces + compact toolbar) behind the existing Casegoods landing page (`https://casegoods.ai.studio/`).

---

## 1. Integration Rules (Important for the Receiving App)

1. **Preserve the Existing Site:** Keep all existing routes, navigation links, portfolio items, visualizer views, modals, business card / QR drawer, and copy untouched. Only mount this interactive modular wall behind the landing page and dock the compact `.wall-toolbar` beneath the three primary pillar bars (`01`, `02`, `06`).
2. **Strict 6-Color Brand Palette:**
   - Canvas White: `#FFFFFF`
   - Drafting Black: `#000000`
   - Neutral Gray: `#CBCBCB`
   - Bauhaus Orange (`01`): `#EF6922`
   - Fabrication Blue (`02`): `#27AAE0`
   - Flex Yellow (`06`): `#FDCB33`
3. **No Literal CAD Aesthetics:** Do **not** add background grid lines, crosshairs, dimension callouts, coordinate telemetry, or HUD overlays. The wall should read as a clean, tactile architectural gallery surface.
4. **Click Pass-Through Layering:**
   - The `<canvas>` sits at `position: fixed; inset: 0; z-index: 0;`.
   - The landing page layout shell sits at `position: relative; z-index: 1; pointer-events: none;`.
   - Give every real UI block (header, brand plate, manifesto bar, pillar buttons, toolbar, footer, and any modals/dialogs) `pointer-events: auto` and class `ui-surface` (or let the click handler ignore `button, a, input, select, textarea, [role="dialog"]`). That way clicks on open background space place/toggle hardware while every UI control works normally.
5. **Clearance Zones:** Pass the CSS selectors (or refs) of your existing top bar, centered landing stack, and footer into the component so the mortise slots behind the centered hero remain subtle (`24%` opacity) and presets/placement automatically frame the open left and right flanks.

---

## 2. Exact Product Geometry Specifications (From Shop SVGs)

All dimensions are proportional to the real CNC mortise pattern (`peg_pattern.svg`, `wall2.svg`, `wall3.svg`):

- **Mortise Wall Pattern (`peg_pattern.svg`)**
  - Vertical rounded mortise slot: `63 × 117` units (`7:13` ratio), corner radius `18`
  - Grid pitch: `ΔX = 306`, `ΔY = 387` (`34:43` ratio), anchored symmetrically from viewport center
  - Responsive scale: `scale = Math.max(0.22, Math.min(0.305, viewportWidth / 4600))`
- **Wall Hook (`wall2.svg`)**
  - `3/4"` Baltic birch ply width: `0.857 × slotW`, corner radius `0.143 × slotW`
  - Upper mortise cleat height: `0.768 × slotH`; projecting lower angled nose height: `1.382 × slotH`
  - Crisp front-elevation step seam at the projecting shoulder + subtle bevel highlight + Bauhaus `#000000` cast drop shadow
- **Shelf + Closet Rod (`wall2.svg`)**
  - Spans 2+ adjacent columns across 2 vertical mortise rows (`gy` to `gy + 1`)
  - Twin vertical cheek brackets (`0.857 × slotW` thick) with exact half-lap dado notches interlocking the horizontal shelf board flush with the bottom of the upper mortise row
  - Suspended `1-1/4"` cylindrical closet rod (`#FFFFFF` body with `#CBCBCB` lower shadow strip and black socket ticks) spanning between the lower halves of the brackets
  - Adjacent same-color shelves on the same row automatically merge into a continuous longer shelf
- **Two-Drawer Cabinet (`wall3.svg`)**
  - Prefers a `3-column × 2-row` footprint (authentic ~`1.06:1` near-square proportion on desktop flanks), falling back gracefully to `2-column × 2-row` where flank width is tighter
  - Exposed `3/4"` ply outer carcass (`left, right, top, bottom`) with half-lap rabbet corner joint lines centered on the outer mortise columns
  - Equal `50/50` flush inset upper & lower drawer fronts divided by a crisp horizontal center seam
  - Signature centered rounded-square recessed finger-pull cutout (`#FFFFFF` recess, `#CBCBCB` inner top/bottom pocket shading) sliced horizontally by the active-color center divider rail

---

## 3. Drop-In CSS (`mortise-wall.css`)

Add these rules to your global stylesheet (or import as a CSS file):

```css
:root {
  --cg-white: #FFFFFF;
  --cg-black: #000000;
  --cg-gray: #CBCBCB;
  --cg-orange: #EF6922;
  --cg-blue: #27AAE0;
  --cg-yellow: #FDCB33;
  --radius-cg: 9px;
  --pillar-active: var(--cg-orange);
}

body.wall-slot-hover {
  cursor: pointer;
}

.mortise-wall-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  display: block;
}

/* Apply to your landing page wrapper so clicks pass through open margins to the wall */
.mortise-page-shell {
  position: relative;
  z-index: 1;
  pointer-events: none;
}

/* Apply to header, brand plate, manifesto, pillar bars, toolbar, footer, and modals */
.ui-surface {
  pointer-events: auto;
}

/* Compact Bauhaus Wall Control Strip */
.wall-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  padding: 9px 12px;
  background-color: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: 1px solid var(--cg-gray);
  border-radius: var(--radius-cg);
}

.wall-tool-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.wall-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 11px;
  border: 1.5px solid var(--cg-gray);
  border-radius: 6px;
  background-color: var(--cg-white);
  color: var(--cg-black);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease, transform 120ms ease;
}

.wall-tool-btn:hover {
  border-color: var(--cg-black);
}

.wall-tool-btn[aria-pressed="true"] {
  border-color: var(--cg-black);
  background-color: var(--pillar-active);
  color: var(--cg-black);
  box-shadow: 2px 2px 0 var(--cg-black);
  transform: translate(-1px, -1px);
}

.wall-tool-icon {
  width: 16px;
  height: 16px;
  display: block;
  flex-shrink: 0;
}

.mortise-actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.swatch-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.swatch-btn {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 2px solid var(--cg-black);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 140ms ease, box-shadow 140ms ease;
}

.swatch-btn[data-swatch="01"] { background-color: var(--cg-orange); }
.swatch-btn[data-swatch="02"] { background-color: var(--cg-blue); }
.swatch-btn[data-swatch="06"] { background-color: var(--cg-yellow); }

.swatch-btn[aria-pressed="true"] {
  transform: translateY(-2px);
  box-shadow: 0 2px 0 var(--cg-black);
}

.text-action-link {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cg-black);
  background: none;
  border: 0;
  padding: 3px 2px;
  border-bottom: 1px solid transparent;
  cursor: pointer;
  transition: border-color 140ms ease;
  white-space: nowrap;
}

.text-action-link:hover {
  border-bottom-color: var(--cg-black);
}
```

---

## 4. Drop-In React + TypeScript Module (`MortiseWallSystem.tsx`)

Zero external dependencies beyond `react`. Mount `<MortiseWallCanvas ... />` at the root of your landing page and render `<MortiseWallToolbar ... />` underneath your three color pillar bars (connecting `activePillar` to your pillar hover/focus state if desired).

```tsx
import React, { useEffect, useRef, useState, useCallback } from "react";

export type PillarColorKey = "01" | "02" | "06";
export type WallTool = "hook" | "shelf" | "cabinet";

const COLORS = {
  white: "#FFFFFF",
  black: "#000000",
  gray: "#CBCBCB",
  orange: "#EF6922",
  blue: "#27AAE0",
  yellow: "#FDCB33",
} as const;

export const PILLAR_COLORS: Record<PillarColorKey, string> = {
  "01": COLORS.orange,
  "02": COLORS.blue,
  "06": COLORS.yellow,
};

// Exact geometry from peg_pattern.svg
const SVG_SLOT_W = 63;
const SVG_SLOT_H = 117;
const SVG_SLOT_R = 18;
const SVG_PITCH_X = 306;
const SVG_PITCH_Y = 387;

interface SlotNode {
  gx: number;
  gy: number;
  cx: number;
  cy: number;
  blocked: boolean;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  lift: number;
  hoverHeat: number;
}

interface SpanPlacement {
  gx1: number;
  gx2: number;
  gy: number;
  colorKey: PillarColorKey;
  lift: number;
}

interface GridMeta {
  minGx: number;
  maxGx: number;
  minGy: number;
  maxGy: number;
  slotW: number;
  slotH: number;
  slotR: number;
  pitchX: number;
  pitchY: number;
  centerX: number;
  centerY: number;
}

export interface MortiseWallController {
  activeTool: WallTool;
  setActiveTool: (tool: WallTool) => void;
  activePillar: PillarColorKey;
  setActivePillar: (pillar: PillarColorKey, rippleOrigin?: { x: number; y: number }) => void;
  motionOn: boolean;
  toggleMotion: () => void;
  rearrange: () => void;
  clearWall: () => void;
  registerActions: (actions: {
    rearrange: () => void;
    clearWall: () => void;
    triggerRipple: (nx: number, ny: number) => void;
  }) => void;
}

/**
 * Shared state hook so your landing page's pillar bars, top nav, and toolbar stay in sync.
 */
export function useMortiseWallController(initialPillar: PillarColorKey = "01"): MortiseWallController {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [activeTool, setActiveTool] = useState<WallTool>("hook");
  const [activePillar, setActivePillarState] = useState<PillarColorKey>(initialPillar);
  const [motionOn, setMotionOn] = useState<boolean>(!prefersReduced);

  const actionsRef = useRef<{
    rearrange: () => void;
    clearWall: () => void;
    triggerRipple: (nx: number, ny: number) => void;
  }>({
    rearrange: () => {},
    clearWall: () => {},
    triggerRipple: () => {},
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--pillar-active", PILLAR_COLORS[activePillar]);
  }, [activePillar]);

  const setActivePillar = useCallback(
    (pillar: PillarColorKey, rippleOrigin?: { x: number; y: number }) => {
      setActivePillarState((prev) => {
        if (prev !== pillar && rippleOrigin) {
          actionsRef.current.triggerRipple(rippleOrigin.x, rippleOrigin.y);
        }
        return pillar;
      });
    },
    []
  );

  const toggleMotion = useCallback(() => setMotionOn((v) => !v), []);
  const rearrange = useCallback(() => actionsRef.current.rearrange(), []);
  const clearWall = useCallback(() => actionsRef.current.clearWall(), []);
  const registerActions = useCallback((actions: typeof actionsRef.current) => {
    actionsRef.current = actions;
  }, []);

  return {
    activeTool,
    setActiveTool,
    activePillar,
    setActivePillar,
    motionOn,
    toggleMotion,
    rearrange,
    clearWall,
    registerActions,
  };
}

interface MortiseWallCanvasProps {
  controller: MortiseWallController;
  /** CSS selector for the centered landing stack to keep unobstructed (e.g. "#hero-center-stack") */
  heroSelector?: string;
  /** CSS selector for the top header bar (e.g. "header") */
  headerSelector?: string;
  /** CSS selector for the bottom footer (e.g. "footer") */
  footerSelector?: string;
  /** Set true while a modal or drawer is open to pause background clicks/hover */
  isModalOpen?: boolean;
}

export const MortiseWallCanvas: React.FC<MortiseWallCanvasProps> = ({
  controller,
  heroSelector = "#hero-center-stack",
  headerSelector = "header",
  footerSelector = "footer",
  isModalOpen = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const syncLoopRef = useRef<() => void>(() => {});
  const stateRef = useRef({
    activeTool: controller.activeTool,
    activePillar: controller.activePillar,
    motionOn: controller.motionOn,
    isModalOpen,
  });

  stateRef.current = {
    activeTool: controller.activeTool,
    activePillar: controller.activePillar,
    motionOn: controller.motionOn,
    isModalOpen,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hasFinePointer =
      window.matchMedia && window.matchMedia("(pointer: fine)").matches;

    let cssW = window.innerWidth;
    let cssH = window.innerHeight;
    let dpr = 1;
    let presetIdx = 0;

    const hooksMap = new Map<string, PillarColorKey>();
    let shelvesList: SpanPlacement[] = [];
    let cabinetsList: SpanPlacement[] = [];
    let slots: SlotNode[] = [];

    let gridMeta: GridMeta = {
      minGx: 0,
      maxGx: 0,
      minGy: 0,
      maxGy: 0,
      slotW: 19,
      slotH: 35,
      slotR: 5.4,
      pitchX: 92,
      pitchY: 116,
      centerX: 720,
      centerY: 450,
    };

    let heroRect = { left: 0, right: 0, top: 0, bottom: 0 };
    let topSafeY = 72;
    let bottomSafeY = cssH - 80;

    let pointerX = -9999;
    let pointerY = -9999;
    let pointerOverUI = false;
    let hoveredIdx = -1;
    let hoveredShelfCandidate: { gx1: number; gx2: number; gy: number } | null = null;
    let hoveredCabinetCandidate: { gx1: number; gx2: number; gy: number } | null = null;
    let hoveredExistingShelfIdx = -1;
    let hoveredExistingCabinetIdx = -1;
    let rippleTime = -9999;
    let rippleX = 0.5;
    let rippleY = 0.5;
    let rafId = 0;

    const keyOf = (gx: number, gy: number) => `${gx},${gy}`;

    const slotByCoord = (gx: number, gy: number): SlotNode | null => {
      const cols = gridMeta.maxGx - gridMeta.minGx + 1;
      const c = gx - gridMeta.minGx;
      const r = gy - gridMeta.minGy;
      if (c < 0 || c >= cols || gy < gridMeta.minGy || gy > gridMeta.maxGy) return null;
      return slots[r * cols + c] || null;
    };

    const measureClearanceZones = () => {
      const heroEl = document.querySelector(heroSelector);
      if (heroEl) {
        const hr = heroEl.getBoundingClientRect();
        heroRect = {
          left: hr.left - 18,
          right: hr.right + 18,
          top: hr.top - 14,
          bottom: hr.bottom + 14,
        };
      } else {
        const halfW = Math.min(310, cssW * 0.34);
        heroRect = {
          left: cssW * 0.5 - halfW,
          right: cssW * 0.5 + halfW,
          top: cssH * 0.18,
          bottom: cssH * 0.82,
        };
      }
      const headerEl = document.querySelector(headerSelector);
      const footerEl = document.querySelector(footerSelector);
      topSafeY = headerEl ? headerEl.getBoundingClientRect().bottom + 10 : 64;
      bottomSafeY = footerEl ? footerEl.getBoundingClientRect().top - 10 : cssH - 64;
    };

    const isSlotBlocked = (cx: number, cy: number) => {
      if (cy < topSafeY || cy > bottomSafeY) return true;
      return cx > heroRect.left && cx < heroRect.right && cy > heroRect.top && cy < heroRect.bottom;
    };

    const isSpanVisible = (span: SpanPlacement) => {
      for (let gx = span.gx1; gx <= span.gx2; gx++) {
        const u = slotByCoord(gx, span.gy);
        const l = slotByCoord(gx, span.gy + 1);
        if (!u || u.blocked || !l || l.blocked) return false;
      }
      return true;
    };

    const isSlotOccupiedByList = (list: SpanPlacement[], gx: number, gy: number) => {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!isSpanVisible(item)) continue;
        if ((gy === item.gy || gy === item.gy + 1) && gx >= item.gx1 && gx <= item.gx2) {
          return true;
        }
      }
      return false;
    };

    const canPlaceSpan = (gx1: number, gx2: number, gy: number) => {
      for (let gx = gx1; gx <= gx2; gx++) {
        const u = slotByCoord(gx, gy);
        const l = slotByCoord(gx, gy + 1);
        if (!u || u.blocked || !l || l.blocked) return false;
      }
      return true;
    };

    const findShelfAtPoint = (px: number, py: number) => {
      const m = gridMeta;
      const t = m.slotW * 0.857;
      for (let i = shelvesList.length - 1; i >= 0; i--) {
        const sh = shelvesList[i];
        if (!isSpanVisible(sh)) continue;
        const leftX = m.centerX + sh.gx1 * m.pitchX - t * 0.65;
        const rightX = m.centerX + sh.gx2 * m.pitchX + t * 0.65;
        const topY = m.centerY + sh.gy * m.pitchY;
        const botY = m.centerY + (sh.gy + 1) * m.pitchY + m.slotH * 0.2;
        if (px >= leftX && px <= rightX && py >= topY && py <= botY) return i;
      }
      return -1;
    };

    const findCabinetAtPoint = (px: number, py: number) => {
      const m = gridMeta;
      const t = m.slotW * 0.857;
      for (let i = cabinetsList.length - 1; i >= 0; i--) {
        const cab = cabinetsList[i];
        if (!isSpanVisible(cab)) continue;
        const leftX = m.centerX + cab.gx1 * m.pitchX - t * 0.55;
        const rightX = m.centerX + cab.gx2 * m.pitchX + t * 0.55;
        const topY = m.centerY + cab.gy * m.pitchY - m.slotH * 0.28;
        const botY = m.centerY + (cab.gy + 1) * m.pitchY + m.slotH * 0.58;
        if (px >= leftX && px <= rightX && py >= topY && py <= botY) return i;
      }
      return -1;
    };

    const findHookAtPoint = (px: number, py: number) => {
      const m = gridMeta;
      const hookW = m.slotW * 0.857;
      const totalH = m.slotH * (0.768 + 1.382);
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.blocked || !hooksMap.has(keyOf(s.gx, s.gy))) continue;
        if (
          px >= s.cx - hookW * 0.68 &&
          px <= s.cx + hookW * 0.68 &&
          py >= s.cy - m.slotH * 0.1 &&
          py <= s.cy + m.slotH * 0.04 + totalH + 4
        ) {
          return s;
        }
      }
      return null;
    };

    const getShelfCandidateForSlot = (s: SlotNode | null) => {
      if (!s || s.blocked) return null;
      const cands = [
        { gx1: s.gx, gx2: s.gx + 1, gy: s.gy },
        { gx1: s.gx - 1, gx2: s.gx, gy: s.gy },
        { gx1: s.gx, gx2: s.gx + 1, gy: s.gy - 1 },
        { gx1: s.gx - 1, gx2: s.gx, gy: s.gy - 1 },
      ];
      return cands.find((c) => canPlaceSpan(c.gx1, c.gx2, c.gy)) || null;
    };

    const getCabinetCandidateForSlot = (s: SlotNode | null) => {
      if (!s || s.blocked) return null;
      const cands = [
        { gx1: s.gx - 1, gx2: s.gx + 1, gy: s.gy },
        { gx1: s.gx, gx2: s.gx + 2, gy: s.gy },
        { gx1: s.gx - 2, gx2: s.gx, gy: s.gy },
        { gx1: s.gx - 1, gx2: s.gx + 1, gy: s.gy - 1 },
        { gx1: s.gx, gx2: s.gx + 2, gy: s.gy - 1 },
        { gx1: s.gx - 2, gx2: s.gx, gy: s.gy - 1 },
        { gx1: s.gx, gx2: s.gx + 1, gy: s.gy },
        { gx1: s.gx - 1, gx2: s.gx, gy: s.gy },
        { gx1: s.gx, gx2: s.gx + 1, gy: s.gy - 1 },
        { gx1: s.gx - 1, gx2: s.gx, gy: s.gy - 1 },
      ];
      return cands.find((c) => canPlaceSpan(c.gx1, c.gx2, c.gy)) || null;
    };

    const addOrMergeShelf = (
      gx1: number,
      gx2: number,
      gy: number,
      colorKey: PillarColorKey,
      withAnim: boolean
    ) => {
      for (let gx = gx1; gx <= gx2; gx++) {
        hooksMap.delete(keyOf(gx, gy));
        hooksMap.delete(keyOf(gx, gy + 1));
      }
      cabinetsList = cabinetsList.filter(
        (cab) => !(Math.abs(cab.gy - gy) <= 1 && cab.gx1 <= gx2 && cab.gx2 >= gx1)
      );

      let mergedGx1 = gx1;
      let mergedGx2 = gx2;
      const remaining: SpanPlacement[] = [];
      for (let i = 0; i < shelvesList.length; i++) {
        const sh = shelvesList[i];
        const sameRow = sh.gy === gy;
        const overlapsVert = Math.abs(sh.gy - gy) <= 1;
        const overlapsHoriz = sh.gx1 <= mergedGx2 && sh.gx2 >= mergedGx1;
        const touchesSameColor =
          sameRow &&
          sh.colorKey === colorKey &&
          sh.gx1 <= mergedGx2 + 1 &&
          sh.gx2 >= mergedGx1 - 1;

        if (touchesSameColor) {
          mergedGx1 = Math.min(mergedGx1, sh.gx1);
          mergedGx2 = Math.max(mergedGx2, sh.gx2);
        } else if (overlapsVert && overlapsHoriz) {
          continue;
        } else {
          remaining.push(sh);
        }
      }
      remaining.push({ gx1: mergedGx1, gx2: mergedGx2, gy, colorKey, lift: withAnim ? 0.08 : 1 });
      shelvesList = remaining;
    };

    const addCabinet = (
      gx1: number,
      gx2: number,
      gy: number,
      colorKey: PillarColorKey,
      withAnim: boolean
    ) => {
      for (let gx = gx1; gx <= gx2; gx++) {
        hooksMap.delete(keyOf(gx, gy));
        hooksMap.delete(keyOf(gx, gy + 1));
      }
      shelvesList = shelvesList.filter(
        (sh) => !(Math.abs(sh.gy - gy) <= 1 && sh.gx1 <= gx2 && sh.gx2 >= gx1)
      );
      cabinetsList = cabinetsList.filter(
        (cab) => !(Math.abs(cab.gy - gy) <= 1 && cab.gx1 <= gx2 && cab.gx2 >= gx1)
      );
      cabinetsList.push({ gx1, gx2, gy, colorKey, lift: withAnim ? 0.08 : 1 });
    };

    const rebuildGrid = () => {
      measureClearanceZones();
      const scale = Math.max(0.22, Math.min(0.305, cssW / 4600));
      const slotW = SVG_SLOT_W * scale;
      const slotH = SVG_SLOT_H * scale;
      const slotR = SVG_SLOT_R * scale;
      const pitchX = SVG_PITCH_X * scale;
      const pitchY = SVG_PITCH_Y * scale;
      const centerX = cssW * 0.5;
      const centerY = cssH * 0.5;
      const halfCols = Math.ceil((cssW * 0.5) / pitchX) + 1;
      const halfRows = Math.ceil((cssH * 0.5) / pitchY) + 1;

      gridMeta = {
        minGx: -halfCols,
        maxGx: halfCols,
        minGy: -halfRows,
        maxGy: halfRows,
        slotW,
        slotH,
        slotR,
        pitchX,
        pitchY,
        centerX,
        centerY,
      };

      const prevByKey = new Map<string, SlotNode>();
      slots.forEach((s) => prevByKey.set(keyOf(s.gx, s.gy), s));

      const nextSlots: SlotNode[] = [];
      for (let gy = gridMeta.minGy; gy <= gridMeta.maxGy; gy++) {
        for (let gx = gridMeta.minGx; gx <= gridMeta.maxGx; gx++) {
          const k = keyOf(gx, gy);
          const prev = prevByKey.get(k);
          const cx = centerX + gx * pitchX;
          const cy = centerY + gy * pitchY;
          nextSlots.push({
            gx,
            gy,
            cx,
            cy,
            blocked: isSlotBlocked(cx, cy),
            ox: prev ? prev.ox : 0,
            oy: prev ? prev.oy : 0,
            vx: prev ? prev.vx : 0,
            vy: prev ? prev.vy : 0,
            rot: prev ? prev.rot : 0,
            vrot: prev ? prev.vrot : 0,
            lift: hooksMap.has(k) ? (prev ? prev.lift : 1) : 0,
            hoverHeat: prev ? prev.hoverHeat : 0,
          });
        }
      }
      slots = nextSlots;
    };

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w * 0.5, h * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const drawWallHook = (
      cx: number,
      cy: number,
      m: GridMeta,
      fillHex: string,
      lift: number,
      isGhost: boolean
    ) => {
      const hookW = m.slotW * 0.857;
      const r = m.slotW * 0.143;
      const upperH = m.slotH * 0.768;
      const lowerH = m.slotH * 1.382;
      const totalH = upperH + lowerH;
      const hx = cx - hookW * 0.5;
      const hy = cy + m.slotH * 0.04 - (1 - lift) * 6;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      } else {
        drawRoundRect(hx + 4.5 * lift, hy + 5.5 * lift, hookW, totalH, r);
        ctx.fillStyle = COLORS.black;
        ctx.fill();
      }

      drawRoundRect(hx, hy, hookW, totalH, r);
      ctx.fillStyle = fillHex;
      ctx.fill();
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.5 : 1.85;
      ctx.stroke();

      const seamY = hy + upperH;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(hx, seamY);
      ctx.lineTo(hx + hookW, seamY);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.2 : 1.65;
      ctx.stroke();

      if (!isGhost) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
        ctx.fillRect(hx + 2, seamY + 1.5, hookW - 4, Math.max(3, lowerH * 0.14));
        ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx + hookW * 0.26, hy + totalH - Math.max(4, r * 1.3));
        ctx.lineTo(hx + hookW * 0.74, hy + totalH - Math.max(4, r * 1.3));
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawShelfWithRod = (
      gx1: number,
      gx2: number,
      gy: number,
      m: GridMeta,
      fillHex: string,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean
    ) => {
      const t = m.slotW * 0.857;
      const r = m.slotW * 0.143;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy * m.pitchY + oy;
      const lowerCy = m.centerY + (gy + 1) * m.pitchY + oy;

      const liftOffset = (1 - lift) * 6;
      const topY = upperCy + m.slotH * 0.04 - liftOffset;
      const botY = lowerCy + m.slotH * 0.11 - liftOffset;
      const bracketH = botY - topY;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx - t * 0.5;
      const innerLeft = leftX + t;
      const innerRight = rightX;
      const innerSpan = Math.max(0, innerRight - innerLeft);
      const shelfTopY = upperCy + m.slotH * 0.5 - liftOffset;
      const shelfH = t;
      const rodDiam = Math.min(t * 1.48, bracketH * 0.24);
      const rodBotY = botY - bracketH * 0.16;
      const rodTopY = rodBotY - rodDiam;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.42;
        ctx.setLineDash([4, 3]);
      } else {
        const sx = 5 * lift;
        const sy = 6 * lift;
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(innerLeft + sx, shelfTopY + sy, innerSpan, shelfH);
        ctx.fillRect(innerLeft + sx * 0.85, rodTopY + sy * 0.9, innerSpan, rodDiam);
        drawRoundRect(leftX + sx, topY + sy, t, bracketH, r);
        ctx.fill();
        drawRoundRect(rightX + sx, topY + sy, t, bracketH, r);
        ctx.fill();
      }

      // Cylindrical Closet Rod
      ctx.fillStyle = COLORS.white;
      ctx.fillRect(innerLeft, rodTopY, innerSpan, rodDiam);
      if (!isGhost) {
        ctx.fillStyle = COLORS.gray;
        ctx.fillRect(innerLeft, rodTopY + rodDiam * 0.62, innerSpan, rodDiam * 0.38);
      }
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.85;
      ctx.beginPath();
      ctx.moveTo(innerLeft, rodTopY);
      ctx.lineTo(innerRight, rodTopY);
      ctx.moveTo(innerLeft, rodBotY);
      ctx.lineTo(innerRight, rodBotY);
      ctx.stroke();

      // Horizontal Shelf Board
      ctx.fillStyle = fillHex;
      ctx.fillRect(innerLeft, shelfTopY, innerSpan, shelfH);
      ctx.strokeRect(innerLeft, shelfTopY, innerSpan, shelfH);

      // Left & Right Cheek Brackets
      drawRoundRect(leftX, topY, t, bracketH, r);
      ctx.fillStyle = fillHex;
      ctx.fill();
      ctx.stroke();

      drawRoundRect(rightX, topY, t, bracketH, r);
      ctx.fillStyle = fillHex;
      ctx.fill();
      ctx.stroke();

      // Half-Lap Dado Interlock Lines
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.1 : 1.5;
      ctx.strokeRect(leftCx, shelfTopY, t * 0.5, shelfH);
      ctx.strokeRect(rightX, shelfTopY, t * 0.5, shelfH);

      if (!isGhost) {
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(innerLeft, rodTopY + 1, 2.5, rodDiam - 2);
        ctx.fillRect(innerRight - 2.5, rodTopY + 1, 2.5, rodDiam - 2);
      }
      ctx.restore();
    };

    const drawTwoDrawerCabinet = (
      gx1: number,
      gx2: number,
      gy: number,
      m: GridMeta,
      fillHex: string,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean
    ) => {
      const t = Math.max(7, m.slotW * 0.62);
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy * m.pitchY + oy;
      const lowerCy = m.centerY + (gy + 1) * m.pitchY + oy;

      const liftOffset = (1 - lift) * 7;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;
      const cabW = rightX - leftX;
      const topY = upperCy - m.slotH * 0.25 - liftOffset;
      const botY = lowerCy + m.slotH * 0.55 - liftOffset;
      const cabH = botY - topY;

      const innerX = leftX + t;
      const innerY = topY + t;
      const innerW = Math.max(12, cabW - t * 2);
      const innerH = Math.max(16, cabH - t * 2);
      const midY = innerY + innerH * 0.5;
      const midX = innerX + innerW * 0.5;

      const pullSize = Math.min(innerW * 0.28, innerH * 0.3);
      const pullR = pullSize * 0.2;
      const pullX = midX - pullSize * 0.5;
      const pullY = midY - pullSize * 0.5;
      const divHalf = Math.max(3.2, pullSize * 0.095);

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.42;
        ctx.setLineDash([4, 3]);
      } else {
        ctx.fillStyle = COLORS.black;
        ctx.fillRect(leftX + 6 * lift, topY + 7 * lift, cabW, cabH);
      }

      // Carcass & Drawer Fronts
      ctx.fillStyle = fillHex;
      ctx.fillRect(leftX, topY, cabW, cabH);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.9;
      ctx.strokeRect(leftX, topY, cabW, cabH);

      ctx.lineWidth = isGhost ? 1.1 : 1.5;
      ctx.strokeRect(innerX, innerY, innerW, innerH);

      // Half-Lap Rabbet Corner Joints
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(leftCx, topY);
      ctx.lineTo(leftCx, innerY);
      ctx.moveTo(rightCx, topY);
      ctx.lineTo(rightCx, innerY);
      ctx.moveTo(leftCx, innerY + innerH);
      ctx.lineTo(leftCx, botY);
      ctx.moveTo(rightCx, innerY + innerH);
      ctx.lineTo(rightCx, botY);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.0 : 1.35;
      ctx.stroke();

      // 50/50 Horizontal Drawer Split Seam
      ctx.beginPath();
      ctx.moveTo(innerX, midY);
      ctx.lineTo(pullX, midY);
      ctx.moveTo(pullX + pullSize, midY);
      ctx.lineTo(innerX + innerW, midY);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.2 : 1.75;
      ctx.stroke();

      // Centered Rounded-Square Recessed Finger Pull
      drawRoundRect(pullX, pullY, pullSize, pullSize, pullR);
      ctx.fillStyle = COLORS.white;
      ctx.fill();

      if (!isGhost) {
        ctx.save();
        drawRoundRect(pullX, pullY, pullSize, pullSize, pullR);
        ctx.clip();
        ctx.fillStyle = COLORS.gray;
        ctx.fillRect(pullX, pullY, pullSize, pullSize * 0.16);
        ctx.fillRect(pullX, midY + divHalf, pullSize, pullSize * 0.12);
        ctx.restore();
      }

      // Center Divider Rail Across Finger Pull
      ctx.fillStyle = fillHex;
      ctx.fillRect(pullX, midY - divHalf, pullSize, divHalf * 2);
      ctx.beginPath();
      ctx.moveTo(pullX, midY - divHalf);
      ctx.lineTo(pullX + pullSize, midY - divHalf);
      ctx.moveTo(pullX, midY + divHalf);
      ctx.lineTo(pullX + pullSize, midY + divHalf);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.1 : 1.5;
      ctx.stroke();

      drawRoundRect(pullX, pullY, pullSize, pullSize, pullR);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.2 : 1.75;
      ctx.stroke();
      ctx.restore();
    };

    const triggerRipple = (nx: number, ny: number) => {
      rippleX = nx;
      rippleY = ny;
      rippleTime = performance.now();
      ensureLoop();
    };

    const applyPreset = (idx: number, withPulse: boolean) => {
      hooksMap.clear();
      shelvesList = [];
      cabinetsList = [];

      const leftOpenGx: number[] = [];
      const rightOpenGx: number[] = [];
      for (let gx = gridMeta.minGx; gx <= gridMeta.maxGx; gx++) {
        const cx = gridMeta.centerX + gx * gridMeta.pitchX;
        if (cx > 26 && cx < heroRect.left - gridMeta.slotW * 0.6) leftOpenGx.push(gx);
        if (cx < cssW - 26 && cx > heroRect.right + gridMeta.slotW * 0.6) rightOpenGx.push(gx);
      }

      const openGy: number[] = [];
      for (let gy = gridMeta.minGy; gy <= gridMeta.maxGy; gy++) {
        const cy = gridMeta.centerY + gy * gridMeta.pitchY;
        if (cy > topSafeY + gridMeta.slotH * 0.6 && cy < bottomSafeY - gridMeta.slotH * 0.6) {
          openGy.push(gy);
        }
      }
      if (openGy.length === 0) return;

      const rTop = openGy.length >= 5 ? openGy[1] : openGy[0];
      const rMid = openGy[Math.floor((openGy.length - 1) * 0.5)];
      const rBot = openGy.length >= 5 ? openGy[openGy.length - 2] : openGy[openGy.length - 1];
      const shelfTopRow = openGy.length >= 4 ? openGy[0] : rTop;
      const shelfMidRow = Math.max(openGy[0], Math.min(openGy[openGy.length - 2] ?? openGy[0], rMid));
      const cabBotRow = openGy.length >= 4 ? openGy[openGy.length - 2] : shelfMidRow;

      const placeHook = (gx: number | undefined, gy: number | undefined, colorKey: PillarColorKey) => {
        if (gx === undefined || gy === undefined) return;
        const s = slotByCoord(gx, gy);
        if (!s || s.blocked) return;
        hooksMap.set(keyOf(gx, gy), colorKey);
        s.lift = withPulse ? 0.08 : 1;
      };
      const placeShelf = (gx1: number | undefined, gx2: number | undefined, gy: number | undefined, colorKey: PillarColorKey) => {
        if (gx1 === undefined || gx2 === undefined || gy === undefined) return;
        if (!canPlaceSpan(gx1, gx2, gy)) return;
        addOrMergeShelf(gx1, gx2, gy, colorKey, withPulse);
      };
      const placeCabinet = (gx1: number | undefined, gx2: number | undefined, gy: number | undefined, colorKey: PillarColorKey) => {
        if (gx1 === undefined || gx2 === undefined || gy === undefined) return;
        if (!canPlaceSpan(gx1, gx2, gy)) return;
        addCabinet(gx1, gx2, gy, colorKey, withPulse);
      };

      const mode = idx % 3;
      if (leftOpenGx.length >= 2 && rightOpenGx.length >= 2) {
        const lInner = leftOpenGx[leftOpenGx.length - 1];
        const lMid = leftOpenGx[Math.max(0, leftOpenGx.length - 2)];
        const lOuter = leftOpenGx[Math.max(0, leftOpenGx.length - 3)];
        const rInner = rightOpenGx[0];
        const rMid = rightOpenGx[Math.min(rightOpenGx.length - 1, 1)];
        const rOuter = rightOpenGx[Math.min(rightOpenGx.length - 1, 2)];

        const has3Cols = leftOpenGx.length >= 3 && rightOpenGx.length >= 3;
        const lCabStart = has3Cols ? lOuter : lMid;
        const rCabEnd = has3Cols ? rOuter : rMid;

        if (mode === 0) {
          placeShelf(lMid, lInner, shelfTopRow, "01");
          if (cabBotRow >= shelfTopRow + 2) placeCabinet(lCabStart, lInner, cabBotRow, "06");
          else placeHook(lOuter, rBot, "06");
          placeHook(rMid, shelfTopRow, "06");
          placeShelf(rInner, rMid, shelfMidRow, "02");
          placeHook(rOuter, rBot, "01");
        } else if (mode === 1) {
          placeHook(lInner, shelfTopRow, "01");
          placeCabinet(lCabStart, lInner, cabBotRow, "02");
          placeShelf(rInner, rMid, shelfTopRow, "01");
          if (cabBotRow >= shelfTopRow + 2) placeCabinet(rInner, rCabEnd, cabBotRow, "06");
          else {
            placeHook(rInner, rBot, "02");
            placeHook(rOuter, rBot, "06");
          }
        } else {
          placeHook(lOuter, rTop, "06");
          placeHook(lInner, rMid, "01");
          placeHook(lMid, rBot, "02");
          placeShelf(rInner, rMid, shelfTopRow, "06");
          if (cabBotRow >= shelfTopRow + 2) placeCabinet(rInner, rCabEnd, cabBotRow, "02");
          else placeHook(rOuter, rBot, "02");
        }
      } else if (leftOpenGx.length === 1 && rightOpenGx.length === 1) {
        const lx = leftOpenGx[0];
        const rx = rightOpenGx[0];
        if (mode === 0) {
          placeHook(lx, rTop, "01");
          placeHook(lx, rBot, "02");
          placeHook(rx, rMid, "06");
        } else if (mode === 1) {
          placeHook(lx, rMid, "06");
          placeHook(rx, rTop, "01");
          placeHook(rx, rBot, "02");
        } else {
          placeHook(lx, rTop, "02");
          placeHook(rx, rMid, "01");
          placeHook(lx, rBot, "06");
        }
      }

      if (withPulse) triggerRipple(0.5, 0.5);
    };

    const renderFrame = (now: number) => {
      const m = gridMeta;
      const { activePillar, activeTool, motionOn } = stateRef.current;
      const activeColor = PILLAR_COLORS[activePillar];
      const influenceR = Math.max(m.pitchX, m.pitchY) * 2.15;
      const rippleAge = (now - rippleTime) / 1000;

      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, cssW, cssH);

      hoveredIdx = -1;
      hoveredShelfCandidate = null;
      hoveredCabinetCandidate = null;
      hoveredExistingCabinetIdx =
        !pointerOverUI && pointerX > -1000 ? findCabinetAtPoint(pointerX, pointerY) : -1;
      hoveredExistingShelfIdx =
        !pointerOverUI && hoveredExistingCabinetIdx === -1 && pointerX > -1000
          ? findShelfAtPoint(pointerX, pointerY)
          : -1;

      let closestDist = 9999;

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const hasHook = !s.blocked && hooksMap.has(keyOf(s.gx, s.gy));
        const hasShelf = !s.blocked && isSlotOccupiedByList(shelvesList, s.gx, s.gy);
        const hasCabinet = !s.blocked && isSlotOccupiedByList(cabinetsList, s.gx, s.gy);
        const isOccupied = hasHook || hasShelf || hasCabinet;

        let targetOx = 0;
        let targetOy = 0;
        let targetRot = 0;
        let targetHeat = 0;

        if (pointerX > -1000) {
          const dx = s.cx - pointerX;
          const dy = s.cy - pointerY;
          const dist = Math.hypot(dx, dy);

          if (!s.blocked && !pointerOverUI && dist < Math.max(m.pitchX, m.pitchY) * 0.5 && dist < closestDist) {
            closestDist = dist;
            hoveredIdx = i;
          }

          if (motionOn && dist > 0.001 && dist < influenceR) {
            const t = 1 - dist / influenceR;
            const maxDisp = s.blocked ? 2.5 : isOccupied ? 3.2 : 10.2;
            const push = Math.pow(t, 1.35) * maxDisp;
            targetOx = (dx / dist) * push;
            targetOy = (dy / dist) * push;
            targetRot = isOccupied || s.blocked ? 0 : (dx / influenceR) * t * 0.16;
            targetHeat = s.blocked ? 0 : Math.min(1, t * 1.3);
          }
        }

        if (motionOn && rippleAge >= 0 && rippleAge < 1.1) {
          const rx = rippleX * cssW;
          const ry = rippleY * cssH;
          const rDist = Math.hypot(s.cx - rx, s.cy - ry);
          const diff = Math.abs(rDist - rippleAge * 780);
          if (diff < 82) {
            const wForce = (1 - diff / 82) * (1 - rippleAge / 1.1);
            const ang = Math.atan2(s.cy - ry, s.cx - rx);
            const scaleF = s.blocked ? 0.3 : 1;
            targetOx += Math.cos(ang) * wForce * 6.5 * scaleF;
            targetOy += Math.sin(ang) * wForce * 6.5 * scaleF;
            if (!s.blocked) targetHeat = Math.max(targetHeat, wForce * 0.8);
          }
        }

        if (!motionOn) {
          s.ox = 0; s.oy = 0; s.vx = 0; s.vy = 0; s.rot = 0; s.vrot = 0;
          s.hoverHeat = i === hoveredIdx ? 1 : 0;
          s.lift = hasHook ? 1 : 0;
        } else {
          s.vx = (s.vx + (targetOx - s.ox) * 0.13) * 0.78;
          s.vy = (s.vy + (targetOy - s.oy) * 0.13) * 0.78;
          s.ox += s.vx;
          s.oy += s.vy;
          s.vrot = (s.vrot + (targetRot - s.rot) * 0.14) * 0.76;
          s.rot += s.vrot;
          s.hoverHeat += (targetHeat - s.hoverHeat) * 0.16;
          s.lift += ((hasHook ? 1 : 0) - s.lift) * 0.22;
        }
      }

      for (const sh of shelvesList) sh.lift = motionOn ? sh.lift + (1 - sh.lift) * 0.2 : 1;
      for (const cab of cabinetsList) cab.lift = motionOn ? cab.lift + (1 - cab.lift) * 0.2 : 1;

      const hoveringExistingBlock = hoveredExistingShelfIdx !== -1 || hoveredExistingCabinetIdx !== -1;
      if (activeTool === "shelf" && hoveredIdx !== -1 && !hoveringExistingBlock) {
        hoveredShelfCandidate = getShelfCandidateForSlot(slots[hoveredIdx]);
      } else if (activeTool === "cabinet" && hoveredIdx !== -1 && !hoveringExistingBlock) {
        hoveredCabinetCandidate = getCabinetCandidateForSlot(slots[hoveredIdx]);
      }

      document.body.classList.toggle(
        "wall-slot-hover",
        !pointerOverUI && (hoveringExistingBlock || hoveredIdx !== -1)
      );

      // Draw mortise slots
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const hasHook = !s.blocked && hooksMap.has(keyOf(s.gx, s.gy));
        const hasShelf = !s.blocked && isSlotOccupiedByList(shelvesList, s.gx, s.gy);
        const hasCabinet = !s.blocked && isSlotOccupiedByList(cabinetsList, s.gx, s.gy);
        const isHov = i === hoveredIdx && !hoveringExistingBlock;
        const x = -m.slotW * 0.5;
        const y = -m.slotH * 0.5;

        ctx.save();
        ctx.translate(s.cx + s.ox, s.cy + s.oy);
        ctx.rotate(s.rot);

        if (s.blocked) {
          ctx.globalAlpha = 0.24;
          drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
          ctx.strokeStyle = COLORS.gray;
          ctx.lineWidth = 1.25;
          ctx.stroke();
          ctx.restore();
          continue;
        }

        if (!hasHook && !hasShelf && !hasCabinet && (s.hoverHeat > 0.06 || isHov)) {
          drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
          ctx.fillStyle = activeColor;
          ctx.globalAlpha = isHov ? 0.3 : s.hoverHeat * 0.2;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.save();
        drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
        ctx.clip();
        ctx.strokeStyle = "rgba(203, 203, 203, 0.72)";
        ctx.lineWidth = 1.75;
        drawRoundRect(x + 1.4, y + 1.4, m.slotW, m.slotH, m.slotR);
        ctx.stroke();
        ctx.restore();

        drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
        ctx.strokeStyle =
          hasHook || hasShelf || hasCabinet
            ? COLORS.black
            : isHov || s.hoverHeat > 0.38
              ? COLORS.black
              : COLORS.gray;
        ctx.lineWidth = isHov ? 1.9 : 1.4;
        ctx.stroke();
        ctx.restore();
      }

      // Draw installed hooks, shelves, and cabinets
      for (const s of slots) {
        if (s.blocked) continue;
        const colorKey = hooksMap.get(keyOf(s.gx, s.gy));
        if (colorKey) drawWallHook(s.cx + s.ox, s.cy + s.oy, m, PILLAR_COLORS[colorKey], s.lift, false);
      }

      for (const sh of shelvesList) {
        if (!isSpanVisible(sh)) continue;
        let avgOx = 0, avgOy = 0, count = 0;
        for (let gx = sh.gx1; gx <= sh.gx2; gx++) {
          const ks = slotByCoord(gx, sh.gy);
          if (ks) { avgOx += ks.ox; avgOy += ks.oy; count++; }
        }
        drawShelfWithRod(
          sh.gx1, sh.gx2, sh.gy, m, PILLAR_COLORS[sh.colorKey], sh.lift,
          count ? avgOx / count : 0, count ? avgOy / count : 0, false
        );
      }

      for (const cab of cabinetsList) {
        if (!isSpanVisible(cab)) continue;
        let avgOx = 0, avgOy = 0, count = 0;
        for (let gx = cab.gx1; gx <= cab.gx2; gx++) {
          const ks = slotByCoord(gx, cab.gy);
          if (ks) { avgOx += ks.ox; avgOy += ks.oy; count++; }
        }
        drawTwoDrawerCabinet(
          cab.gx1, cab.gx2, cab.gy, m, PILLAR_COLORS[cab.colorKey], cab.lift,
          count ? avgOx / count : 0, count ? avgOy / count : 0, false
        );
      }

      // Ghost hover preview
      if (!pointerOverUI && !hoveringExistingBlock && hoveredIdx !== -1) {
        const hs = slots[hoveredIdx];
        if (activeTool === "hook") {
          if (
            !hooksMap.has(keyOf(hs.gx, hs.gy)) &&
            !isSlotOccupiedByList(shelvesList, hs.gx, hs.gy) &&
            !isSlotOccupiedByList(cabinetsList, hs.gx, hs.gy)
          ) {
            drawWallHook(hs.cx + hs.ox, hs.cy + hs.oy, m, activeColor, 1, true);
          }
        } else if (activeTool === "shelf" && hoveredShelfCandidate) {
          drawShelfWithRod(
            hoveredShelfCandidate.gx1, hoveredShelfCandidate.gx2, hoveredShelfCandidate.gy,
            m, activeColor, 1, hs.ox * 0.4, hs.oy * 0.4, true
          );
        } else if (activeTool === "cabinet" && hoveredCabinetCandidate) {
          drawTwoDrawerCabinet(
            hoveredCabinetCandidate.gx1, hoveredCabinetCandidate.gx2, hoveredCabinetCandidate.gy,
            m, activeColor, 1, hs.ox * 0.35, hs.oy * 0.35, true
          );
        }
      }
    };

    const loop = (now: number) => {
      renderFrame(now);
      if (stateRef.current.motionOn) {
        rafId = window.requestAnimationFrame(loop);
      } else {
        rafId = 0;
      }
    };

    const ensureLoop = () => {
      if (!rafId && stateRef.current.motionOn) {
        rafId = window.requestAnimationFrame(loop);
      }
    };

    syncLoopRef.current = () => {
      if (stateRef.current.motionOn) ensureLoop();
      else renderFrame(performance.now());
    };

    const sizeCanvas = () => {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGrid();
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    controller.registerActions({
      rearrange: () => {
        presetIdx = (presetIdx + 1) % 3;
        applyPreset(presetIdx, true);
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      },
      clearWall: () => {
        hooksMap.clear();
        shelvesList = [];
        cabinetsList = [];
        triggerRipple(0.5, 0.5);
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      },
      triggerRipple,
    });

    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.isModalOpen) {
        pointerOverUI = true;
        return;
      }
      pointerX = e.clientX;
      pointerY = e.clientY;
      const target = e.target as HTMLElement | null;
      pointerOverUI = Boolean(target?.closest?.('.ui-surface, [role="dialog"]'));
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    const onPointerLeave = () => {
      pointerX = -9999;
      pointerY = -9999;
      pointerOverUI = false;
      hoveredIdx = -1;
      hoveredShelfCandidate = null;
      hoveredCabinetCandidate = null;
      hoveredExistingShelfIdx = -1;
      hoveredExistingCabinetIdx = -1;
      document.body.classList.remove("wall-slot-hover");
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    const onClick = (e: MouseEvent) => {
      if (stateRef.current.isModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.ui-surface, [role="dialog"], button, a, input, select, textarea')) {
        return;
      }

      const clickX = e.clientX;
      const clickY = e.clientY;
      const { activePillar, activeTool } = stateRef.current;

      const hitCabIdx = findCabinetAtPoint(clickX, clickY);
      if (hitCabIdx !== -1) {
        const hit = cabinetsList[hitCabIdx];
        if (hit.colorKey === activePillar) cabinetsList.splice(hitCabIdx, 1);
        else { hit.colorKey = activePillar; hit.lift = 0.25; }
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
        if (!stateRef.current.motionOn) renderFrame(performance.now());
        return;
      }

      const hitShelfIdx = findShelfAtPoint(clickX, clickY);
      if (hitShelfIdx !== -1) {
        const hit = shelvesList[hitShelfIdx];
        if (hit.colorKey === activePillar) shelvesList.splice(hitShelfIdx, 1);
        else { hit.colorKey = activePillar; hit.lift = 0.25; }
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
        if (!stateRef.current.motionOn) renderFrame(performance.now());
        return;
      }

      if (activeTool === "hook") {
        const hitHook = findHookAtPoint(clickX, clickY);
        if (hitHook) {
          const k = keyOf(hitHook.gx, hitHook.gy);
          if (hooksMap.get(k) === activePillar) hooksMap.delete(k);
          else { hooksMap.set(k, activePillar); hitHook.lift = 0.08; }
          triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
          if (!stateRef.current.motionOn) renderFrame(performance.now());
          return;
        }
      }

      let best: SlotNode | null = null;
      let bestDist = Math.max(gridMeta.pitchX, gridMeta.pitchY) * 0.56;
      for (const s of slots) {
        if (s.blocked) continue;
        const d = Math.hypot(s.cx - clickX, s.cy - clickY);
        if (d < bestDist) { bestDist = d; best = s; }
      }
      if (!best) return;

      if (activeTool === "hook") {
        const k = keyOf(best.gx, best.gy);
        if (hooksMap.get(k) === activePillar) hooksMap.delete(k);
        else { hooksMap.set(k, activePillar); best.lift = 0.08; }
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
      } else if (activeTool === "shelf") {
        const cand = getShelfCandidateForSlot(best);
        if (cand) {
          addOrMergeShelf(cand.gx1, cand.gx2, cand.gy, activePillar, true);
          triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
        }
      } else if (activeTool === "cabinet") {
        const cand = getCabinetCandidateForSlot(best);
        if (cand) {
          addCabinet(cand.gx1, cand.gx2, cand.gy, activePillar, true);
          triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
        }
      }

      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    sizeCanvas();
    applyPreset(0, false);
    renderFrame(performance.now());
    if (stateRef.current.motionOn) ensureLoop();

    window.addEventListener("resize", sizeCanvas);
    if (hasFinePointer) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("click", onClick);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      document.body.classList.remove("wall-slot-hover");
      window.removeEventListener("resize", sizeCanvas);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("click", onClick);
    };
  }, [controller, heroSelector, headerSelector, footerSelector]);

  useEffect(() => {
    syncLoopRef.current();
  }, [controller.motionOn, controller.activePillar, controller.activeTool]);

  return <canvas ref={canvasRef} className="mortise-wall-canvas" aria-hidden="true" />;
};

export const MortiseWallToolbar: React.FC<{ controller: MortiseWallController }> = ({ controller }) => {
  const { activeTool, setActiveTool, activePillar, setActivePillar, rearrange, clearWall } = controller;

  return (
    <div className="wall-toolbar ui-surface" aria-label="Interactive modular wall controls">
      <div className="wall-tool-group" role="group" aria-label="Select modular piece to place">
        <button
          type="button"
          className="wall-tool-btn"
          aria-pressed={activeTool === "hook"}
          onClick={() => setActiveTool("hook")}
        >
          <svg className="wall-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="8.5" y="2.5" width="7" height="19" rx="1.6" />
            <line x1="8.5" y1="10" x2="15.5" y2="10" />
          </svg>
          <span>Hook</span>
        </button>

        <button
          type="button"
          className="wall-tool-btn"
          aria-pressed={activeTool === "shelf"}
          onClick={() => setActiveTool("shelf")}
        >
          <svg className="wall-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="3" width="3.5" height="18" rx="1.2" />
            <rect x="18" y="3" width="3.5" height="18" rx="1.2" />
            <rect x="6" y="6.5" width="12" height="3.2" />
            <line x1="6" y1="15.5" x2="18" y2="15.5" strokeWidth="2.8" />
          </svg>
          <span>Shelf + Rod</span>
        </button>

        <button
          type="button"
          className="wall-tool-btn"
          aria-pressed={activeTool === "cabinet"}
          onClick={() => setActiveTool("cabinet")}
        >
          <svg className="wall-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3.5" width="18" height="17" rx="1" />
            <line x1="3" y1="12" x2="9" y2="12" />
            <line x1="15" y1="12" x2="21" y2="12" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" />
            <line x1="9" y1="12" x2="15" y2="12" />
          </svg>
          <span>Cabinet</span>
        </button>
      </div>

      <div className="mortise-actions">
        <div className="swatch-group" role="group" aria-label="Active hardware color">
          {(["01", "02", "06"] as PillarColorKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className="swatch-btn"
              data-swatch={key}
              aria-label={key === "01" ? "Orange color" : key === "02" ? "Blue color" : "Yellow color"}
              aria-pressed={activePillar === key}
              onClick={() => setActivePillar(key, { x: 0.5, y: 0.72 })}
            />
          ))}
        </div>
        <button type="button" className="text-action-link" onClick={rearrange}>
          Rearrange
        </button>
        <button type="button" className="text-action-link" onClick={clearWall}>
          Clear
        </button>
      </div>
    </div>
  );
};
```

---

## 5. Quick Wiring Example (React Landing Page)

```tsx
const wall = useMortiseWallController("01");

return (
  <>
    <MortiseWallCanvas
      controller={wall}
      heroSelector="#hero-center-stack"
      headerSelector="header"
      footerSelector="footer"
      isModalOpen={isAnyModalOpen}
    />
    <div className="mortise-page-shell">
      <header className="ui-surface">{/* existing header */}</header>
      <main>
        <section id="hero-center-stack">
          {/* existing brand lockup, manifesto bar, and 01 / 02 / 06 pillar bars (mark each with className="ui-surface") */}
          <MortiseWallToolbar controller={wall} />
        </section>
      </main>
      <footer className="ui-surface">{/* existing footer */}</footer>
    </div>
  </>
);
```

*(If your other app is plain HTML/CSS/JS rather than React, translate the exact same canvas renderer and toolbar markup from Sections 3–4 directly into your landing page script.)*
