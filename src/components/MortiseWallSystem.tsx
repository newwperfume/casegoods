import React, { useEffect, useRef, useState, useCallback } from 'react';
import balticBirchEdgeUrl from '../assets/images/baltic_birch_edge_1795173686278.jpg';

const MAPLE_TEXTURE_URL =
  '/assets/aistudio/watermarked_img_13606778923742787615_7e162b39.webp';

// Consistent directional studio light from upper-left projecting 3D wall depth Z down & right
const LIGHT_KX = 0.54;
const LIGHT_KY = 0.64;

export type PillarColorKey = '01' | '02' | '06';
export type WallTool = 'hook' | 'shelf' | 'cabinet';

const COLORS = {
  white: '#FFFFFF',
  black: '#000000',
  gray: '#CBCBCB',
  orange: '#EF6922',
  blue: '#27AAE0',
  yellow: '#FDCB33',
} as const;

export const PILLAR_COLORS: Record<PillarColorKey, string> = {
  '01': COLORS.orange,
  '02': COLORS.blue,
  '06': COLORS.yellow,
};

// Exact geometry from peg_pattern.svg
const SVG_SLOT_W = 63;
const SVG_SLOT_H = 117;
const SVG_SLOT_R = 18;
const SVG_PITCH_X = 306;
const SVG_PITCH_Y = 387;

// Both Shelf + Rod and Sliding-Door Cabinet span 4 mortise slots (gx2 - gx1 === 3)
const MIN_SHELF_SPAN = 3;
const MIN_CABINET_SPAN = 3;

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
 * Shared state hook so the landing page's pillar bars, top nav, and toolbar stay in sync.
 */
export function useMortiseWallController(
  initialPillar: PillarColorKey = '01'
): MortiseWallController {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [activeTool, setActiveTool] = useState<WallTool>('hook');
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
    document.documentElement.style.setProperty('--pillar-active', PILLAR_COLORS[activePillar]);
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
  heroSelector = '#hero-center-stack',
  headerSelector = 'header',
  footerSelector = 'footer',
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
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const hasFinePointer =
      window.matchMedia && window.matchMedia('(pointer: fine)').matches;

    let cssW = window.innerWidth;
    let cssH = window.innerHeight;
    let dpr = 1;
    let presetIdx = 0;
    let hasUserEdited = false;

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
    let disposed = false;

    // Preload real Maple grain texture & 13-ply Baltic Birch edge texture
    let mapleReady = false;
    let birchReady = false;

    const onAssetLoaded = (markReady: () => void) => () => {
      markReady();
      if (!disposed && !stateRef.current.motionOn) renderFrame(performance.now());
    };

    const mapleImg = new Image();
    mapleImg.decoding = 'async';
    mapleImg.onload = onAssetLoaded(() => {
      mapleReady = true;
    });
    mapleImg.src = MAPLE_TEXTURE_URL;

    const birchImg = new Image();
    birchImg.decoding = 'async';
    birchImg.onload = onAssetLoaded(() => {
      birchReady = true;
    });
    birchImg.src = balticBirchEdgeUrl;

    const keyOf = (gx: number, gy: number) => `${gx},${gy}`;

    const slotByCoord = (gx: number, gy: number): SlotNode | null => {
      const cols = gridMeta.maxGx - gridMeta.minGx + 1;
      const c = gx - gridMeta.minGx;
      const r = gy - gridMeta.minGy;
      if (c < 0 || c >= cols || gy < gridMeta.minGy || gy > gridMeta.maxGy) return null;
      return slots[r * cols + c] || null;
    };

    const measureClearanceZones = () => {
      const heroEl = heroSelector ? document.querySelector(heroSelector) : null;
      if (heroEl) {
        const hr = heroEl.getBoundingClientRect();
        heroRect = {
          left: hr.left - 12,
          right: hr.right + 12,
          top: hr.top - 12,
          bottom: hr.bottom + 12,
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
      const headerEl = headerSelector ? document.querySelector(headerSelector) : null;
      const footerEl = footerSelector ? document.querySelector(footerSelector) : null;
      topSafeY = headerEl ? headerEl.getBoundingClientRect().bottom + 12 : 24;
      bottomSafeY = footerEl ? footerEl.getBoundingClientRect().top - 14 : cssH - 48;
    };

    const isSlotBlocked = (cx: number, cy: number, slotW: number, slotH: number) => {
      const halfW = slotW * 0.5 + 8;
      const halfH = slotH * 0.5 + 8;
      if (cy - halfH < topSafeY || cy + halfH > bottomSafeY) return true;
      return (
        cx + halfW > heroRect.left &&
        cx - halfW < heroRect.right &&
        cy + halfH > heroRect.top &&
        cy - halfH < heroRect.bottom
      );
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
        if (u.cx < 18 || u.cx > cssW - 18) return false;
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
      const t = Math.max(7.5, m.slotW * 0.52);
      for (let i = cabinetsList.length - 1; i >= 0; i--) {
        const cab = cabinetsList[i];
        if (!isSpanVisible(cab)) continue;
        const leftX = m.centerX + cab.gx1 * m.pitchX - t * 0.55;
        const rightX = m.centerX + cab.gx2 * m.pitchX + t * 0.55;
        const topY = m.centerY + cab.gy * m.pitchY - m.slotH * 0.62;
        const botY = m.centerY + (cab.gy + 1) * m.pitchY + m.slotH * 0.62;
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

    const getFourSlotCandidateForSlot = (s: SlotNode | null) => {
      if (!s || s.blocked) return null;
      // Exactly 4 mortise slots wide (gx2 - gx1 === 3)
      const cands = [
        { gx1: s.gx - 1, gx2: s.gx + 2, gy: s.gy },
        { gx1: s.gx - 2, gx2: s.gx + 1, gy: s.gy },
        { gx1: s.gx, gx2: s.gx + 3, gy: s.gy },
        { gx1: s.gx - 3, gx2: s.gx, gy: s.gy },
        { gx1: s.gx - 1, gx2: s.gx + 2, gy: s.gy - 1 },
        { gx1: s.gx - 2, gx2: s.gx + 1, gy: s.gy - 1 },
        { gx1: s.gx, gx2: s.gx + 3, gy: s.gy - 1 },
        { gx1: s.gx - 3, gx2: s.gx, gy: s.gy - 1 },
      ];
      return cands.find((c) => canPlaceSpan(c.gx1, c.gx2, c.gy)) || null;
    };

    const getShelfCandidateForSlot = (s: SlotNode | null) =>
      getFourSlotCandidateForSlot(s);

    const getCabinetCandidateForSlot = (s: SlotNode | null) =>
      getFourSlotCandidateForSlot(s);

    const addOrMergeShelf = (
      gx1: number,
      gx2: number,
      gy: number,
      colorKey: PillarColorKey,
      withAnim: boolean
    ) => {
      if (gx2 - gx1 < MIN_SHELF_SPAN) return;
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
        const touchesAdjacent =
          sameRow &&
          sh.gx1 <= mergedGx2 + 1 &&
          sh.gx2 >= mergedGx1 - 1;

        if (touchesAdjacent) {
          mergedGx1 = Math.min(mergedGx1, sh.gx1);
          mergedGx2 = Math.max(mergedGx2, sh.gx2);
        } else if (overlapsVert && overlapsHoriz) {
          continue;
        } else {
          remaining.push(sh);
        }
      }
      remaining.push({
        gx1: mergedGx1,
        gx2: mergedGx2,
        gy,
        colorKey,
        lift: withAnim ? 0.08 : 1,
      });
      shelvesList = remaining;
    };

    const addCabinet = (
      gx1: number,
      gx2: number,
      gy: number,
      colorKey: PillarColorKey,
      withAnim: boolean
    ) => {
      if (gx2 - gx1 < MIN_CABINET_SPAN) return;
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
      const sideMargin = Math.max(0, heroRect.left);
      // Scale mortise grid so desktop flanks comfortably fit 4-slot-wide cabinets & shelves
      const baseScale = Math.max(0.22, Math.min(0.295, cssW / 4800));
      const scale =
        sideMargin >= 200
          ? Math.max(0.18, Math.min(baseScale, (sideMargin - 20) / (4.35 * SVG_PITCH_X)))
          : baseScale;
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
            blocked: isSlotBlocked(cx, cy, slotW, slotH),
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

    /**
     * Renders the 13-ply Baltic Birch plywood edge image cleanly across the thickness
     * of an exposed plywood board edge (horizontal plies for horizontal boards,
     * rotated 90 deg for vertical side panels, cheek brackets, and hook edges).
     */
    const drawBirchEdge = (
      x: number,
      y: number,
      w: number,
      h: number,
      orientation: 'horizontal' | 'vertical',
      seed = 0
    ) => {
      if (w <= 0.2 || h <= 0.2) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      if (!birchReady || birchImg.naturalWidth === 0 || birchImg.naturalHeight === 0) {
        ctx.fillStyle = '#E8D5B5';
        ctx.fillRect(x, y, w, h);
        ctx.restore();
        return;
      }

      const iw = birchImg.naturalWidth;
      const ih = birchImg.naturalHeight;
      const drawTiledHorizontal = (dx: number, dy: number, dw: number, dh: number) => {
        // Keep all 13 plies mapped cleanly across board thickness dh, tiling along length dw
        const naturalTileW = Math.max(dh * (iw / ih) * 1.45, dh * 2.2);
        const shift = ((Math.abs(seed) * 19.7) % 1) * naturalTileW;
        for (let tx = dx - shift; tx < dx + dw; tx += naturalTileW) {
          ctx.drawImage(birchImg, 0, 0, iw, ih, tx, dy, naturalTileW + 0.5, dh);
        }
      };

      if (orientation === 'horizontal') {
        drawTiledHorizontal(x, y, w, h);
      } else {
        ctx.translate(x + w * 0.5, y + h * 0.5);
        ctx.rotate(Math.PI * 0.5);
        drawTiledHorizontal(-h * 0.5, -w * 0.5, h, w);
      }

      ctx.restore();
    };

    /**
     * Renders the uploaded Hard Maple wood grain texture into a rectangular face
     * with aspect-preserving cover-crop, subtle per-piece grain offset, and optional
     * translucent Casegoods pillar-color stain so both grain and swatch colors shine.
     */
    const drawMapleFace = (
      x: number,
      y: number,
      w: number,
      h: number,
      orientation: 'horizontal' | 'vertical',
      tintHex?: string,
      tintAlpha = 0,
      seed = 0
    ) => {
      if (w <= 0.2 || h <= 0.2) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      if (!mapleReady || mapleImg.naturalWidth === 0 || mapleImg.naturalHeight === 0) {
        ctx.fillStyle = '#EAD8BD';
        ctx.fillRect(x, y, w, h);
      } else {
        const iw = mapleImg.naturalWidth;
        const ih = mapleImg.naturalHeight;
        const drawCover = (dx: number, dy: number, dw: number, dh: number) => {
          const imgRatio = iw / ih;
          const boxRatio = dw / Math.max(1, dh);
          let rw: number;
          let rh: number;
          if (boxRatio > imgRatio) {
            rw = dw;
            rh = dw / imgRatio;
          } else {
            rh = dh;
            rw = dh * imgRatio;
          }
          // Slightly overscale so deterministic grain offset varies each panel naturally
          const overscale = 1.24;
          rw *= overscale;
          rh *= overscale;
          const extraX = Math.max(0, rw - dw);
          const extraY = Math.max(0, rh - dh);
          const offX = ((Math.abs(seed * 37.3) % 100) / 100) * extraX;
          const offY = ((Math.abs(seed * 71.9) % 100) / 100) * extraY;
          ctx.drawImage(mapleImg, dx - offX, dy - offY, rw, rh);
        };

        if (orientation === 'horizontal') {
          drawCover(x, y, w, h);
        } else {
          ctx.save();
          ctx.translate(x + w * 0.5, y + h * 0.5);
          ctx.rotate(Math.PI * 0.5);
          drawCover(-h * 0.5, -w * 0.5, h, w);
          ctx.restore();
        }
      }

      if (tintHex && tintAlpha > 0) {
        // Multiply glaze keeps dark maple fibers razor-sharp while honoring pillar swatch color
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = tintAlpha;
        ctx.fillStyle = tintHex;
        ctx.fillRect(x, y, w, h);

        // Gentle surface tint keeps bright Casegoods Blue/Yellow/Orange luminous
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = tintAlpha * 0.24;
        ctx.fillStyle = tintHex;
        ctx.fillRect(x, y, w, h);
      }

      ctx.restore();
    };

    /**
     * Fills the current canvas path as a realistic directional studio cast shadow:
     * sharper & slightly richer near wall contact, softening & lightening along the light vector.
     */
    const fillDirectionalCastShadow = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      lift: number,
      blurPx: number
    ) => {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, `rgba(18, 20, 24, ${(0.22 * lift).toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(18, 20, 24, ${(0.145 * lift).toFixed(3)})`);
      grad.addColorStop(1, `rgba(18, 20, 24, ${(0.075 * lift).toFixed(3)})`);

      ctx.shadowColor = `rgba(18, 20, 24, ${(0.12 * lift).toFixed(3)})`;
      ctx.shadowBlur = blurPx;
      ctx.shadowOffsetX = 1.5 * lift;
      ctx.shadowOffsetY = 2 * lift;
      ctx.fillStyle = grad;
      ctx.fill('nonzero');
    };

    /**
     * True 3D cast shadow of the CNC-cut J-profile Wall Hook under upper-left directional light.
     * Reveals the projecting hook saddle/notch and upturned front catch nose on the white wall.
     */
    const drawWallHookIsoShadow = (
      cx: number,
      cy: number,
      m: GridMeta,
      lift: number
    ) => {
      if (lift <= 0.02) return;
      const hookW = m.slotW * 0.857;
      const upperH = m.slotH * 0.768;
      const lowerH = m.slotH * 1.382;
      const totalH = upperH + lowerH;
      const hx = cx - hookW * 0.5;
      const hy = cy + m.slotH * 0.04 - (1 - lift) * 6;
      const rightEdge = hx + hookW;

      // Real 3D wall projection depth of the CNC J-hook (~0.66 of total vertical height)
      const depth = totalH * 0.66 * lift;
      const projX = (x: number, zFrac: number) => x + depth * zFrac * LIGHT_KX;
      const projY = (yFrac: number, zFrac: number) =>
        hy + totalH * yFrac + depth * zFrac * LIGHT_KY;

      ctx.save();
      ctx.beginPath();
      // Wall-contact top-right corner of the upper mounting cleat
      ctx.moveTo(rightEdge, hy);
      // Cleat projects slightly forward from the wall, then drops along the inner back spine
      ctx.lineTo(projX(rightEdge, 0.22), projY(0.06, 0.22));
      ctx.lineTo(projX(rightEdge, 0.26), projY(0.48, 0.26));
      // Smoothly rounds through the recessed U-shaped coat-hanging saddle notch
      ctx.quadraticCurveTo(
        projX(rightEdge, 0.44),
        projY(0.68, 0.44),
        projX(rightEdge, 0.68),
        projY(0.56, 0.68)
      );
      // Rises forward to the upturned rounded front catch nose tip
      ctx.quadraticCurveTo(
        projX(rightEdge, 0.94),
        projY(0.32, 0.94),
        projX(rightEdge, 1.0),
        projY(0.36, 1.0)
      );
      // Curves down around the front outer hook nose
      ctx.quadraticCurveTo(
        projX(rightEdge, 1.04),
        projY(0.62, 1.04),
        projX(rightEdge, 0.82),
        projY(0.84, 0.82)
      );
      // Sweeps diagonally back along the lower underside to bottom-left wall contact
      ctx.lineTo(projX(hx, 0.42), projY(0.98, 0.42));
      ctx.lineTo(hx, hy + totalH);
      ctx.lineTo(hx, hy);
      ctx.closePath();

      fillDirectionalCastShadow(
        hx,
        hy,
        projX(rightEdge, 1.0),
        projY(1.0, 0.85),
        lift,
        5
      );
      ctx.restore();
    };

    /**
     * Helper to append a clockwise 3D extruded rectangle cast shadow into the active canvas path
     * (used for vertical cheek brackets and horizontal shelf board without double-darkening seams).
     */
    const appendExtrudedBoxShadowPath = (
      x: number,
      y: number,
      w: number,
      h: number,
      dx: number,
      dy: number,
      cornerR = 0
    ) => {
      const r = Math.min(cornerR, w * 0.45, h * 0.45);
      const x2 = x + w;
      const y2 = y + h;
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y);
      if (r > 0.5) {
        ctx.lineTo(x2 + dx - r * 0.35, y + dy);
        ctx.quadraticCurveTo(x2 + dx, y + dy, x2 + dx, y + dy + r);
        ctx.lineTo(x2 + dx, y2 + dy - r);
        ctx.quadraticCurveTo(x2 + dx, y2 + dy, x2 + dx - r, y2 + dy);
        ctx.lineTo(x + dx + r, y2 + dy);
        ctx.quadraticCurveTo(x + dx, y2 + dy, x + dx, y2 + dy - r * 0.35);
      } else {
        ctx.lineTo(x2 + dx, y + dy);
        ctx.lineTo(x2 + dx, y2 + dy);
        ctx.lineTo(x + dx, y2 + dy);
      }
      ctx.lineTo(x, y2);
      ctx.closePath();
    };

    /**
     * True 3D cast shadow of the Shelf + Closet Rod under upper-left directional light:
     * twin protruding cheek brackets + deep horizontal shelf overhang + detached floating chrome rod shadow.
     */
    const drawShelfIsoShadow = (
      gx1: number,
      gx2: number,
      gy: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number
    ) => {
      if (lift <= 0.02) return;
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
      const shelfFullW = Math.max(0, rightCx - leftCx);
      const rodDiam = Math.min(t * 1.48, bracketH * 0.24);
      const rodBotY = botY - bracketH * 0.16;
      const rodTopY = rodBotY - rodDiam;

      // Real 3D shelf projection depth (~0.68 of bracket height); rod suspended at ~64% depth out from wall
      const shelfDepth = bracketH * 0.68 * lift;
      const dx = shelfDepth * LIGHT_KX;
      const dy = shelfDepth * LIGHT_KY;

      const rodDepth = shelfDepth * 0.64;
      const rdx = rodDepth * LIGHT_KX;
      const rdy = rodDepth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();

      // 1. Left & right protruding vertical cheek bracket shadows
      appendExtrudedBoxShadowPath(leftX, topY, t, bracketH, dx, dy, r * 2.2);
      appendExtrudedBoxShadowPath(rightX, topY, t, bracketH, dx, dy, r * 2.2);

      // 2. Deep horizontal shelf board overhang shadow (from wall z=0 to front edge z=shelfDepth)
      appendExtrudedBoxShadowPath(leftCx, shelfTopY, shelfFullW, shelfH, dx, dy, 0);

      // 3. Detached cylindrical chrome closet rod shadow floating cleanly out at z=rodDepth
      if (innerSpan > 1) {
        const rx = innerLeft + rdx;
        const ry = rodTopY + rdy;
        const rh = rodDiam * 0.88;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + innerSpan, ry);
        ctx.lineTo(rx + innerSpan, ry + rh);
        ctx.lineTo(rx, ry + rh);
        ctx.closePath();
      }

      fillDirectionalCastShadow(
        leftX,
        topY,
        rightX + t + dx,
        botY + dy,
        lift,
        7
      );
      ctx.restore();
    };

    /**
     * True 3D cast shadow of the deep Sliding-Door Cabinet box under upper-left directional light:
     * extruded 6-vertex architectural shadow revealing cabinet depth off the mortise wall.
     */
    const drawCabinetIsoShadow = (
      gx1: number,
      gx2: number,
      gy: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number
    ) => {
      if (lift <= 0.02) return;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy * m.pitchY + oy;
      const lowerCy = m.centerY + (gy + 1) * m.pitchY + oy;

      const spanW = Math.max(m.pitchX, rightCx - leftCx);
      const t = Math.max(7.5, Math.min(11.5, spanW * 0.05));
      const liftOffset = (1 - lift) * 7;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;
      const cabW = rightX - leftX;
      const topY = upperCy - m.slotH * 0.62 - liftOffset;
      const botY = lowerCy + m.slotH * 0.62 - liftOffset;
      const cabH = botY - topY;

      // Real 3D cabinet box projection depth (~0.48 of cabinet height per Rhino CAD proportions)
      const cabDepth = cabH * 0.48 * lift;
      const dx = cabDepth * LIGHT_KX;
      const dy = cabDepth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();
      appendExtrudedBoxShadowPath(leftX, topY, cabW, cabH, dx, dy, 0);
      fillDirectionalCastShadow(
        leftX + cabW * 0.2,
        topY + cabH * 0.2,
        rightX + dx,
        botY + dy,
        lift,
        9
      );
      ctx.restore();
    };

    const drawWallHook = (
      cx: number,
      cy: number,
      m: GridMeta,
      lift: number,
      isGhost: boolean,
      seed = 0
    ) => {
      const hookW = m.slotW * 0.857;
      const r = m.slotW * 0.143;
      const upperH = m.slotH * 0.768;
      const lowerH = m.slotH * 1.382;
      const totalH = upperH + lowerH;
      const hx = cx - hookW * 0.5;
      const hy = cy + m.slotH * 0.04 - (1 - lift) * 6;
      const seamY = hy + upperH;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.48;
        ctx.setLineDash([4, 3]);
      }

      if (isGhost) {
        drawRoundRect(hx, hy, hookW, totalH, r);
        ctx.fillStyle = '#E8D5B5';
        ctx.fill();
      } else {
        ctx.save();
        drawRoundRect(hx, hy, hookW, totalH, r);
        ctx.clip();

        // Continuous exposed 3/4" Baltic Birch multi-ply edge on both upper & lower hook faces
        drawBirchEdge(hx, hy, hookW, totalH, 'vertical', seed + 1.1);

        // Subtle lighting cues on lower angled hook bevel so the 3D bend reads crisply
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(hx + 1.5, seamY + 1.2, hookW - 3, Math.max(2.6, lowerH * 0.12));
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.26)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hx + hookW * 0.26, hy + totalH - Math.max(4, r * 1.3));
        ctx.lineTo(hx + hookW * 0.74, hy + totalH - Math.max(4, r * 1.3));
        ctx.stroke();

        ctx.restore();
      }

      // Crisp architectural outline
      drawRoundRect(hx, hy, hookW, totalH, r);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.5 : 1.85;
      ctx.stroke();

      // Horizontal bend transition crease between upper neck & lower hook edge
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(hx, seamY);
      ctx.lineTo(hx + hookW, seamY);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.2 : 1.65;
      ctx.stroke();

      ctx.restore();
    };

    const drawShelfWithRod = (
      gx1: number,
      gx2: number,
      gy: number,
      m: GridMeta,
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
      const seed = gx1 * 7 + gx2 * 13 + gy * 19;

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
      const shelfFullW = Math.max(0, rightCx - leftCx);
      const rodDiam = Math.min(t * 1.48, bracketH * 0.24);
      const rodBotY = botY - bracketH * 0.16;
      const rodTopY = rodBotY - rodDiam;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      // 1. Cylindrical Closet Rod — Subtle Satin-Polished Chrome tubular steel
      if (isGhost) {
        ctx.fillStyle = '#E4E8EC';
        ctx.fillRect(innerLeft, rodTopY, innerSpan, rodDiam);
      } else {
        const chromeGrad = ctx.createLinearGradient(0, rodTopY, 0, rodBotY);
        chromeGrad.addColorStop(0.0, '#CFD4DA');
        chromeGrad.addColorStop(0.2, '#EEF1F4');
        chromeGrad.addColorStop(0.33, '#FAFBFD');
        chromeGrad.addColorStop(0.56, '#D6DBE0');
        chromeGrad.addColorStop(0.78, '#B6BDC5');
        chromeGrad.addColorStop(0.92, '#D5DAE0');
        chromeGrad.addColorStop(1.0, '#A5ADB6');
        ctx.fillStyle = chromeGrad;
        ctx.fillRect(innerLeft, rodTopY, innerSpan, rodDiam);

        // Very subtle horizontal sheen variation along the tube
        const sheenGrad = ctx.createLinearGradient(innerLeft, 0, innerRight, 0);
        sheenGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.07)');
        sheenGrad.addColorStop(0.22, 'rgba(255, 255, 255, 0.16)');
        sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
        sheenGrad.addColorStop(0.78, 'rgba(255, 255, 255, 0.15)');
        sheenGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.07)');
        ctx.fillStyle = sheenGrad;
        ctx.fillRect(innerLeft, rodTopY, innerSpan, rodDiam);
      }
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.85;
      ctx.beginPath();
      ctx.moveTo(innerLeft, rodTopY);
      ctx.lineTo(innerRight, rodTopY);
      ctx.moveTo(innerLeft, rodBotY);
      ctx.lineTo(innerRight, rodBotY);
      ctx.stroke();

      // 2. Left & Right Vertical Cheek Brackets — exposed 3/4" Vertical Baltic Birch multi-ply edge
      const drawCheekBracket = (bx: number, bSeed: number) => {
        if (isGhost) {
          drawRoundRect(bx, topY, t, bracketH, r);
          ctx.fillStyle = '#E8D5B5';
          ctx.fill();
          ctx.stroke();
          return;
        }
        ctx.save();
        drawRoundRect(bx, topY, t, bracketH, r);
        ctx.clip();
        drawBirchEdge(bx, topY, t, bracketH, 'vertical', bSeed);
        ctx.restore();

        drawRoundRect(bx, topY, t, bracketH, r);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = 1.85;
        ctx.stroke();
      };

      drawCheekBracket(leftX, seed + 5);
      drawCheekBracket(rightX, seed + 9);

      // 3. Continuous Horizontal Shelf Board seated into half-lap dados (leftCx..rightCx)
      //    Clean uninterrupted 13-ply horizontal Baltic Birch edge — no top color stripe or extra black dividers
      ctx.setLineDash([]);
      if (isGhost) {
        ctx.fillStyle = '#E8D5B5';
        ctx.fillRect(leftCx, shelfTopY, shelfFullW, shelfH);
      } else {
        drawBirchEdge(leftCx, shelfTopY, shelfFullW, shelfH, 'horizontal', seed + 1);
      }
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.3 : 1.75;
      ctx.strokeRect(leftCx, shelfTopY, shelfFullW, shelfH);

      if (!isGhost) {
        // Subtle ambient-occlusion shadow where the rod seats into each cheek bracket
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.fillRect(innerLeft, rodTopY + 0.8, 2, rodDiam - 1.6);
        ctx.fillRect(innerRight - 2, rodTopY + 0.8, 2, rodDiam - 1.6);
      }
      ctx.restore();
    };

    const drawSlidingDoorCabinet = (
      gx1: number,
      gx2: number,
      gy: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean
    ) => {
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy * m.pitchY + oy;
      const lowerCy = m.centerY + (gy + 1) * m.pitchY + oy;
      const seed = gx1 * 11 + gx2 * 17 + gy * 23;

      const spanW = Math.max(m.pitchX, rightCx - leftCx);
      // Carcass wall thickness & rabbet corner joinery matching Rhino CAD (CASEGOODS2.svg)
      const t = Math.max(7.5, Math.min(11.5, spanW * 0.05));
      const liftOffset = (1 - lift) * 7;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;
      const cabW = rightX - leftX;
      const topY = upperCy - m.slotH * 0.62 - liftOffset;
      const botY = lowerCy + m.slotH * 0.62 - liftOffset;
      const cabH = botY - topY;

      const innerX = leftX + t;
      const innerY = topY + t;
      const innerW = Math.max(18, cabW - t * 2);
      const innerH = Math.max(24, cabH - t * 2);

      // Bypass sliding door vertical overlap seam (front left door overlaps ~3% past midpoint per CAD: 53.03%)
      const seamX = innerX + innerW * 0.5303;
      const leftDoorW = Math.max(0, seamX - innerX);
      const rightDoorW = Math.max(0, innerX + innerW - seamX);

      // Circular finger-pull cutouts positioned symmetrically in upper-left & upper-right door corners per CAD
      const pullR = Math.max(4.6, Math.min(innerH * 0.068, innerW * 0.042));
      const pullInsetX = Math.max(pullR + 5, innerW * 0.125);
      const pullInsetY = Math.max(pullR + 5, innerH * 0.2);
      const leftPullCx = innerX + pullInsetX;
      const rightPullCx = innerX + innerW - pullInsetX;
      const pullCy = innerY + pullInsetY;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      if (isGhost) {
        ctx.fillStyle = '#EAD8BD';
        ctx.fillRect(leftX, topY, cabW, cabH);
      } else {
        // 1. Outer Carcass Exposed 13-Ply Baltic Birch Edges with True Half-Lap Rabbet Orientation
        drawBirchEdge(leftX, topY, t * 0.5, cabH, 'vertical', seed + 1);
        drawBirchEdge(leftCx, innerY, t * 0.5, innerH, 'vertical', seed + 1.4);
        drawBirchEdge(rightCx, topY, t * 0.5, cabH, 'vertical', seed + 2);
        drawBirchEdge(innerX + innerW, innerY, t * 0.5, innerH, 'vertical', seed + 2.4);

        // Top & bottom horizontal carcass panels seated into half-lap rabbets (leftCx..rightCx)
        drawBirchEdge(leftCx, topY, rightCx - leftCx, t, 'horizontal', seed + 3);
        drawBirchEdge(leftCx, innerY + innerH, rightCx - leftCx, t, 'horizontal', seed + 4);

        // 2. Left (Front) & Right (Rear) Bypass Sliding Doors — Pure Natural Hard Maple horizontal grain
        drawMapleFace(innerX, innerY, leftDoorW, innerH, 'horizontal', undefined, 0, seed + 5);
        drawMapleFace(seamX, innerY, rightDoorW, innerH, 'horizontal', undefined, 0, seed + 9);

        // Subtle shadow cast by front left door onto rear right door
        const overlapShadowW = Math.max(2.6, Math.min(5.5, t * 0.48));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(seamX, innerY, Math.min(overlapShadowW, rightDoorW), innerH);
        // Subtle recessed shadow along rear door top sliding track
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(seamX, innerY, rightDoorW, Math.max(2.2, t * 0.26));
        // Subtle top-edge highlight on front left door
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(innerX + 1, innerY + 1, Math.max(0, leftDoorW - 2), Math.max(1.8, t * 0.2));
      }

      // Outer Carcass Crisp Architectural Ink Frame
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.9;
      ctx.strokeRect(leftX, topY, cabW, cabH);

      // Half-Lap Rabbet Corner Joinery + Inner Carcass Frame Lines (exact CAD corner lines)
      ctx.setLineDash([]);
      ctx.beginPath();
      // Left & right rabbet vertical cuts at top and bottom panels
      ctx.moveTo(leftCx, topY);
      ctx.lineTo(leftCx, innerY);
      ctx.moveTo(rightCx, topY);
      ctx.lineTo(rightCx, innerY);
      ctx.moveTo(leftCx, innerY + innerH);
      ctx.lineTo(leftCx, botY);
      ctx.moveTo(rightCx, innerY + innerH);
      ctx.lineTo(rightCx, botY);
      // Inner top & bottom carcass lines extending to rabbet mid-lines
      ctx.moveTo(leftCx, innerY);
      ctx.lineTo(rightCx, innerY);
      ctx.moveTo(leftCx, innerY + innerH);
      ctx.lineTo(rightCx, innerY + innerH);
      // Inner left & right carcass walls
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(innerX, innerY + innerH);
      ctx.moveTo(innerX + innerW, innerY);
      ctx.lineTo(innerX + innerW, innerY + innerH);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.05 : 1.35;
      ctx.stroke();

      // Vertical Bypass Sliding Door Center Overlap Seam
      ctx.beginPath();
      ctx.moveTo(seamX, innerY);
      ctx.lineTo(seamX, innerY + innerH);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.15 : 1.65;
      ctx.stroke();

      // Circular Finger-Pull Cutouts (Upper-Left & Upper-Right)
      const pullCenters = [leftPullCx, rightPullCx];
      for (let i = 0; i < pullCenters.length; i++) {
        const px = pullCenters[i];

        ctx.beginPath();
        ctx.arc(px, pullCy, pullR, 0, Math.PI * 2);
        ctx.fillStyle = isGhost ? COLORS.white : '#F5F2EC';
        ctx.fill();

        if (!isGhost) {
          // Recessed interior Baltic Birch rim shadow along upper crescent of finger cutout
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, pullCy, pullR, 0, Math.PI * 2);
          ctx.clip();
          drawBirchEdge(
            px - pullR,
            pullCy - pullR,
            pullR * 2,
            Math.max(2.6, pullR * 0.56),
            'horizontal',
            seed + i * 3
          );
          ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
          ctx.fillRect(px - pullR, pullCy - pullR, pullR * 2, Math.max(2.6, pullR * 0.56));
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(px, pullCy, pullR, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.1 : 1.55;
        ctx.stroke();
      }

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
        if (cx > 18 && cx < heroRect.left - gridMeta.slotW * 0.55) leftOpenGx.push(gx);
        if (cx < cssW - 18 && cx > heroRect.right + gridMeta.slotW * 0.55) rightOpenGx.push(gx);
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
      const shelfMidRow = Math.max(
        openGy[0],
        Math.min(openGy[openGy.length - 2] ?? openGy[0], rMid)
      );
      const cabBotRow = openGy.length >= 4 ? openGy[openGy.length - 2] : shelfMidRow;

      const placeHook = (
        gx: number | undefined,
        gy: number | undefined,
        colorKey: PillarColorKey
      ) => {
        if (gx === undefined || gy === undefined) return;
        const s = slotByCoord(gx, gy);
        if (!s || s.blocked) return;
        if (
          isSlotOccupiedByList(shelvesList, gx, gy) ||
          isSlotOccupiedByList(cabinetsList, gx, gy)
        ) {
          return;
        }
        hooksMap.set(keyOf(gx, gy), colorKey);
        s.lift = withPulse ? 0.08 : 1;
      };
      const placeShelf = (
        gx1: number | undefined,
        gx2: number | undefined,
        gy: number | undefined,
        colorKey: PillarColorKey
      ) => {
        if (gx1 === undefined || gx2 === undefined || gy === undefined) return;
        if (gx2 - gx1 < MIN_SHELF_SPAN) return;
        if (!canPlaceSpan(gx1, gx2, gy)) return;
        addOrMergeShelf(gx1, gx2, gy, colorKey, withPulse);
      };
      const placeCabinet = (
        gx1: number | undefined,
        gx2: number | undefined,
        gy: number | undefined,
        colorKey: PillarColorKey
      ) => {
        if (gx1 === undefined || gx2 === undefined || gy === undefined) return;
        if (gx2 - gx1 < MIN_CABINET_SPAN) return;
        if (!canPlaceSpan(gx1, gx2, gy)) return;
        addCabinet(gx1, gx2, gy, colorKey, withPulse);
      };

      const mode = idx % 3;
      if (leftOpenGx.length >= 2 && rightOpenGx.length >= 2) {
        const lInner = leftOpenGx[leftOpenGx.length - 1];
        const lMid = leftOpenGx[Math.max(0, leftOpenGx.length - 2)];
        const lOuter = leftOpenGx[Math.max(0, leftOpenGx.length - 3)];
        const lSpan4Start = leftOpenGx[Math.max(0, leftOpenGx.length - 4)];
        const rInner = rightOpenGx[0];
        const rMid = rightOpenGx[Math.min(rightOpenGx.length - 1, 1)];
        const rOuter = rightOpenGx[Math.min(rightOpenGx.length - 1, 2)];
        const rSpan4End = rightOpenGx[Math.min(rightOpenGx.length - 1, 3)];

        const leftHas4 = leftOpenGx.length >= 4;
        const rightHas4 = rightOpenGx.length >= 4;

        if (mode === 0) {
          if (leftHas4) placeShelf(lSpan4Start, lInner, shelfTopRow, '01');
          else placeHook(lInner, shelfTopRow, '01');
          if (leftHas4 && cabBotRow >= shelfTopRow + 2) {
            placeCabinet(lSpan4Start, lInner, cabBotRow, '06');
          } else {
            placeHook(lOuter, rBot, '06');
          }

          if (rightHas4) placeShelf(rInner, rSpan4End, shelfMidRow, '02');
          else placeHook(rInner, shelfMidRow, '02');
          placeHook(rMid, shelfTopRow, '06');
          placeHook(rOuter, rBot, '01');
        } else if (mode === 1) {
          if (leftHas4) placeCabinet(lSpan4Start, lInner, cabBotRow, '02');
          else placeHook(lMid, rBot, '02');
          placeHook(lInner, shelfTopRow, '01');

          if (rightHas4) placeShelf(rInner, rSpan4End, shelfTopRow, '01');
          else placeHook(rInner, shelfTopRow, '01');
          if (rightHas4 && cabBotRow >= shelfTopRow + 2) {
            placeCabinet(rInner, rSpan4End, cabBotRow, '06');
          } else {
            placeHook(rInner, rBot, '02');
            placeHook(rOuter, rBot, '06');
          }
        } else {
          placeHook(lOuter, rTop, '06');
          placeHook(lInner, rMid, '01');
          placeHook(lMid, rBot, '02');

          if (rightHas4) placeShelf(rInner, rSpan4End, shelfTopRow, '06');
          else placeHook(rInner, shelfTopRow, '06');
          if (rightHas4 && cabBotRow >= shelfTopRow + 2) {
            placeCabinet(rInner, rSpan4End, cabBotRow, '02');
          } else {
            placeHook(rOuter, rBot, '02');
          }
        }
      } else if (leftOpenGx.length === 1 && rightOpenGx.length === 1) {
        const lx = leftOpenGx[0];
        const rx = rightOpenGx[0];
        if (mode === 0) {
          placeHook(lx, rTop, '01');
          placeHook(lx, rBot, '02');
          placeHook(rx, rMid, '06');
        } else if (mode === 1) {
          placeHook(lx, rMid, '06');
          placeHook(rx, rTop, '01');
          placeHook(rx, rBot, '02');
        } else {
          placeHook(lx, rTop, '02');
          placeHook(rx, rMid, '01');
          placeHook(lx, rBot, '06');
        }
      } else {
        // Portrait / narrow mobile layout: populate open mortise wall BOTH above and below the centered stack
        const fullOpenGx: number[] = [];
        for (let gx = gridMeta.minGx; gx <= gridMeta.maxGx; gx++) {
          const cx = gridMeta.centerX + gx * gridMeta.pitchX;
          if (cx > 18 && cx < cssW - 18) fullOpenGx.push(gx);
        }

        const aboveOpenGy: number[] = [];
        const belowOpenGy: number[] = [];
        for (let gy = gridMeta.minGy; gy <= gridMeta.maxGy; gy++) {
          const cy = gridMeta.centerY + gy * gridMeta.pitchY;
          if (cy - gridMeta.slotH * 0.55 > topSafeY && cy + gridMeta.slotH * 0.55 < heroRect.top - 8) {
            aboveOpenGy.push(gy);
          }
          if (
            cy > heroRect.bottom + gridMeta.slotH * 0.65 &&
            cy < bottomSafeY - gridMeta.slotH * 1.15
          ) {
            belowOpenGy.push(gy);
          }
        }

        // Fill above the centered card (4-slot-wide spans)
        if (fullOpenGx.length >= 4 && aboveOpenGy.length >= 2) {
          const topRow = aboveOpenGy[0];
          const startIdx = Math.floor((fullOpenGx.length - 4) / 2);
          const gxStart = fullOpenGx[startIdx];
          const gxEnd = fullOpenGx[startIdx + 3];
          const leftEdge = fullOpenGx[0];
          const rightEdge = fullOpenGx[fullOpenGx.length - 1];

          placeShelf(gxStart, gxEnd, topRow, mode === 0 ? '01' : mode === 1 ? '06' : '02');
          const topCy = gridMeta.centerY + topRow * gridMeta.pitchY;
          if (topCy + gridMeta.slotH * 2.25 < heroRect.top - 4) {
            if (leftEdge < gxStart) placeHook(leftEdge, topRow, '06');
            if (rightEdge > gxEnd) placeHook(rightEdge, topRow, '02');
          }
        } else if (fullOpenGx.length >= 2 && aboveOpenGy.length >= 1) {
          const topRow = aboveOpenGy[0];
          const topCy = gridMeta.centerY + topRow * gridMeta.pitchY;
          if (topCy + gridMeta.slotH * 2.25 < heroRect.top - 4) {
            const colors: PillarColorKey[] = ['01', '02', '06'];
            placeHook(fullOpenGx[0], topRow, colors[mode % 3]);
            placeHook(fullOpenGx[fullOpenGx.length - 1], topRow, colors[(mode + 2) % 3]);
            if (fullOpenGx.length >= 4) {
              placeHook(fullOpenGx[Math.floor(fullOpenGx.length / 2)], topRow, colors[(mode + 1) % 3]);
            }
          }
        }

        // Fill below the centered card (4-slot-wide spans)
        if (fullOpenGx.length >= 4 && belowOpenGy.length >= 2) {
          const row0 = belowOpenGy[0];
          const startIdx = Math.floor((fullOpenGx.length - 4) / 2);
          const gxStart = fullOpenGx[startIdx];
          const gxEnd = fullOpenGx[startIdx + 3];
          const leftEdge = fullOpenGx[0];
          const rightEdge = fullOpenGx[fullOpenGx.length - 1];

          if (mode === 0) {
            placeShelf(gxStart, gxEnd, row0, '02');
            if (leftEdge < gxStart) placeHook(leftEdge, row0, '01');
            if (rightEdge > gxEnd) placeHook(rightEdge, row0, '06');
          } else if (mode === 1) {
            placeCabinet(gxStart, gxEnd, row0, '01');
            if (leftEdge < gxStart) placeHook(leftEdge, row0, '06');
            if (rightEdge > gxEnd) placeHook(rightEdge, row0, '02');
          } else {
            placeShelf(gxStart, gxEnd, row0, '06');
            if (leftEdge < gxStart) placeHook(leftEdge, row0, '02');
            if (rightEdge > gxEnd) placeHook(rightEdge, row0, '01');
          }
        } else if (fullOpenGx.length >= 2 && belowOpenGy.length >= 1) {
          const row0 = belowOpenGy[0];
          const colors: PillarColorKey[] = ['01', '02', '06'];
          placeHook(fullOpenGx[0], row0, colors[mode % 3]);
          placeHook(fullOpenGx[fullOpenGx.length - 1], row0, colors[(mode + 1) % 3]);
          if (fullOpenGx.length >= 4) {
            placeHook(fullOpenGx[Math.floor(fullOpenGx.length / 2)], row0, colors[(mode + 2) % 3]);
          }
        }
      }

      // On wider viewports with generous space directly above the centered card, fill top center too
      if (leftOpenGx.length >= 1 && rightOpenGx.length >= 1) {
        const centerOpenGx: number[] = [];
        for (let gx = gridMeta.minGx; gx <= gridMeta.maxGx; gx++) {
          const cx = gridMeta.centerX + gx * gridMeta.pitchX;
          if (cx >= heroRect.left && cx <= heroRect.right) centerOpenGx.push(gx);
        }
        const aboveOpenGy: number[] = [];
        for (let gy = gridMeta.minGy; gy <= gridMeta.maxGy; gy++) {
          const cy = gridMeta.centerY + gy * gridMeta.pitchY;
          if (cy - gridMeta.slotH * 0.55 > topSafeY && cy + gridMeta.slotH * 0.55 < heroRect.top - 8) {
            aboveOpenGy.push(gy);
          }
        }
        if (aboveOpenGy.length >= 2 && centerOpenGx.length >= 4) {
          const topRow = aboveOpenGy[0];
          const startIdx = Math.floor((centerOpenGx.length - 4) / 2);
          const gx1 = centerOpenGx[startIdx];
          const gx2 = centerOpenGx[startIdx + 3];
          placeShelf(gx1, gx2, topRow, mode === 0 ? '02' : mode === 1 ? '06' : '01');
        } else if (aboveOpenGy.length >= 1 && centerOpenGx.length >= 2) {
          const topRow = aboveOpenGy[0];
          const topCy = gridMeta.centerY + topRow * gridMeta.pitchY;
          if (topCy + gridMeta.slotH * 2.25 < heroRect.top - 4) {
            placeHook(centerOpenGx[0], topRow, '01');
            placeHook(centerOpenGx[centerOpenGx.length - 1], topRow, '06');
          }
        }
      }

      if (withPulse) triggerRipple(0.5, 0.5);
    };

    const renderFrame = (now: number) => {
      const m = gridMeta;
      const { activeTool, motionOn, isModalOpen: modalActive } = stateRef.current;
      const influenceR = Math.max(m.pitchX, m.pitchY) * 2.15;
      const rippleAge = (now - rippleTime) / 1000;
      const effectiveOverUI = pointerOverUI || modalActive;

      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, cssW, cssH);

      hoveredIdx = -1;
      hoveredShelfCandidate = null;
      hoveredCabinetCandidate = null;
      hoveredExistingCabinetIdx =
        !effectiveOverUI && pointerX > -1000 ? findCabinetAtPoint(pointerX, pointerY) : -1;
      hoveredExistingShelfIdx =
        !effectiveOverUI && hoveredExistingCabinetIdx === -1 && pointerX > -1000
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

        if (pointerX > -1000 && !modalActive) {
          const dx = s.cx - pointerX;
          const dy = s.cy - pointerY;
          const dist = Math.hypot(dx, dy);

          if (
            !s.blocked &&
            !effectiveOverUI &&
            dist < Math.max(m.pitchX, m.pitchY) * 0.5 &&
            dist < closestDist
          ) {
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
          s.ox = 0;
          s.oy = 0;
          s.vx = 0;
          s.vy = 0;
          s.rot = 0;
          s.vrot = 0;
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

      const hoveringExistingBlock =
        hoveredExistingShelfIdx !== -1 || hoveredExistingCabinetIdx !== -1;
      if (activeTool === 'shelf' && hoveredIdx !== -1 && !hoveringExistingBlock) {
        hoveredShelfCandidate = getShelfCandidateForSlot(slots[hoveredIdx]);
      } else if (activeTool === 'cabinet' && hoveredIdx !== -1 && !hoveringExistingBlock) {
        hoveredCabinetCandidate = getCabinetCandidateForSlot(slots[hoveredIdx]);
      }

      document.body.classList.toggle(
        'wall-slot-hover',
        !effectiveOverUI && (hoveringExistingBlock || hoveredIdx !== -1)
      );

      const isShelfBracketSlot = (gx: number, gy: number) => {
        for (let i = 0; i < shelvesList.length; i++) {
          const sh = shelvesList[i];
          if (!isSpanVisible(sh)) continue;
          if ((gy === sh.gy || gy === sh.gy + 1) && (gx === sh.gx1 || gx === sh.gx2)) {
            return true;
          }
        }
        return false;
      };

      // Draw mortise slots (never render any slot behind text or UI clearance zones)
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.blocked) continue;
        const hasHook = hooksMap.has(keyOf(s.gx, s.gy));
        const hasShelf = isSlotOccupiedByList(shelvesList, s.gx, s.gy);
        const hasShelfBracket = isShelfBracketSlot(s.gx, s.gy);
        const hasCabinet = isSlotOccupiedByList(cabinetsList, s.gx, s.gy);
        const isHov = i === hoveredIdx && !hoveringExistingBlock;
        const x = -m.slotW * 0.5;
        const y = -m.slotH * 0.5;

        ctx.save();
        ctx.translate(s.cx + s.ox, s.cy + s.oy);
        ctx.rotate(s.rot);

        if (!hasHook && !hasShelf && !hasCabinet && (s.hoverHeat > 0.06 || isHov)) {
          drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
          ctx.fillStyle = '#DEC7A4';
          ctx.globalAlpha = isHov ? 0.42 : s.hoverHeat * 0.24;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.save();
        drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
        ctx.clip();
        ctx.strokeStyle = 'rgba(203, 203, 203, 0.72)';
        ctx.lineWidth = 1.75;
        drawRoundRect(x + 1.4, y + 1.4, m.slotW, m.slotH, m.slotR);
        ctx.stroke();
        ctx.restore();

        drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
        ctx.strokeStyle =
          hasHook || hasShelfBracket || hasCabinet
            ? COLORS.black
            : isHov || s.hoverHeat > 0.38
              ? COLORS.black
              : COLORS.gray;
        ctx.lineWidth = isHov ? 1.9 : 1.4;
        ctx.stroke();
        ctx.restore();
      }

      // Pass 1: Subtle 3D isometric Rhino line-drawing shadows projected down & right behind each piece
      for (const s of slots) {
        if (s.blocked) continue;
        if (hooksMap.has(keyOf(s.gx, s.gy))) {
          drawWallHookIsoShadow(s.cx + s.ox, s.cy + s.oy, m, s.lift);
        }
      }

      const shelfOffsets: Array<{ sh: SpanPlacement; ox: number; oy: number }> = [];
      for (const sh of shelvesList) {
        if (sh.gx2 - sh.gx1 < MIN_SHELF_SPAN || !isSpanVisible(sh)) continue;
        let avgOx = 0;
        let avgOy = 0;
        let count = 0;
        for (let gx = sh.gx1; gx <= sh.gx2; gx++) {
          const ks = slotByCoord(gx, sh.gy);
          if (ks) {
            avgOx += ks.ox;
            avgOy += ks.oy;
            count++;
          }
        }
        const ox = count ? avgOx / count : 0;
        const oy = count ? avgOy / count : 0;
        shelfOffsets.push({ sh, ox, oy });
        drawShelfIsoShadow(sh.gx1, sh.gx2, sh.gy, m, sh.lift, ox, oy);
      }

      const cabOffsets: Array<{ cab: SpanPlacement; ox: number; oy: number }> = [];
      for (const cab of cabinetsList) {
        if (cab.gx2 - cab.gx1 < MIN_CABINET_SPAN || !isSpanVisible(cab)) continue;
        let avgOx = 0;
        let avgOy = 0;
        let count = 0;
        for (let gx = cab.gx1; gx <= cab.gx2; gx++) {
          const ks = slotByCoord(gx, cab.gy);
          if (ks) {
            avgOx += ks.ox;
            avgOy += ks.oy;
            count++;
          }
        }
        const ox = count ? avgOx / count : 0;
        const oy = count ? avgOy / count : 0;
        cabOffsets.push({ cab, ox, oy });
        drawCabinetIsoShadow(cab.gx1, cab.gx2, cab.gy, m, cab.lift, ox, oy);
      }

      // Pass 2: Draw installed front-elevation hooks, shelves, and cabinets cleanly on top of isometric shadows
      for (const s of slots) {
        if (s.blocked) continue;
        if (hooksMap.has(keyOf(s.gx, s.gy))) {
          drawWallHook(
            s.cx + s.ox,
            s.cy + s.oy,
            m,
            s.lift,
            false,
            s.gx * 13 + s.gy * 29
          );
        }
      }

      for (const { sh, ox, oy } of shelfOffsets) {
        drawShelfWithRod(sh.gx1, sh.gx2, sh.gy, m, sh.lift, ox, oy, false);
      }

      for (const { cab, ox, oy } of cabOffsets) {
        drawSlidingDoorCabinet(cab.gx1, cab.gx2, cab.gy, m, cab.lift, ox, oy, false);
      }

      // Ghost hover preview
      if (!effectiveOverUI && !hoveringExistingBlock && hoveredIdx !== -1) {
        const hs = slots[hoveredIdx];
        if (activeTool === 'hook') {
          if (
            !hooksMap.has(keyOf(hs.gx, hs.gy)) &&
            !isSlotOccupiedByList(shelvesList, hs.gx, hs.gy) &&
            !isSlotOccupiedByList(cabinetsList, hs.gx, hs.gy)
          ) {
            drawWallHook(hs.cx + hs.ox, hs.cy + hs.oy, m, 1, true);
          }
        } else if (activeTool === 'shelf' && hoveredShelfCandidate) {
          drawShelfWithRod(
            hoveredShelfCandidate.gx1,
            hoveredShelfCandidate.gx2,
            hoveredShelfCandidate.gy,
            m,
            1,
            hs.ox * 0.4,
            hs.oy * 0.4,
            true
          );
        } else if (activeTool === 'cabinet' && hoveredCabinetCandidate) {
          drawSlidingDoorCabinet(
            hoveredCabinetCandidate.gx1,
            hoveredCabinetCandidate.gx2,
            hoveredCabinetCandidate.gy,
            m,
            1,
            hs.ox * 0.35,
            hs.oy * 0.35,
            true
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
      if (!hasUserEdited) {
        applyPreset(presetIdx, false);
      }
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    controller.registerActions({
      rearrange: () => {
        hasUserEdited = false;
        presetIdx = (presetIdx + 1) % 3;
        applyPreset(presetIdx, true);
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      },
      clearWall: () => {
        hasUserEdited = true;
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
      document.body.classList.remove('wall-slot-hover');
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    const onClick = (e: MouseEvent) => {
      if (stateRef.current.isModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.('.ui-surface, [role="dialog"], button, a, input, select, textarea')
      ) {
        return;
      }

      const clickX = e.clientX;
      const clickY = e.clientY;
      const { activePillar, activeTool } = stateRef.current;

      const hitCabIdx = findCabinetAtPoint(clickX, clickY);
      if (hitCabIdx !== -1) {
        hasUserEdited = true;
        cabinetsList.splice(hitCabIdx, 1);
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
        if (!stateRef.current.motionOn) renderFrame(performance.now());
        return;
      }

      const hitShelfIdx = findShelfAtPoint(clickX, clickY);
      if (hitShelfIdx !== -1) {
        hasUserEdited = true;
        shelvesList.splice(hitShelfIdx, 1);
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
        if (!stateRef.current.motionOn) renderFrame(performance.now());
        return;
      }

      if (activeTool === 'hook') {
        const hitHook = findHookAtPoint(clickX, clickY);
        if (hitHook) {
          hasUserEdited = true;
          hooksMap.delete(keyOf(hitHook.gx, hitHook.gy));
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
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      if (!best) return;

      if (activeTool === 'hook') {
        hasUserEdited = true;
        const k = keyOf(best.gx, best.gy);
        if (hooksMap.has(k)) hooksMap.delete(k);
        else {
          hooksMap.set(k, activePillar);
          best.lift = 0.08;
        }
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
      } else if (activeTool === 'shelf') {
        const cand = getShelfCandidateForSlot(best);
        if (cand) {
          hasUserEdited = true;
          addOrMergeShelf(cand.gx1, cand.gx2, cand.gy, activePillar, true);
          triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
        }
      } else if (activeTool === 'cabinet') {
        const cand = getCabinetCandidateForSlot(best);
        if (cand) {
          hasUserEdited = true;
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

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        rebuildGrid();
        if (!hasUserEdited) {
          applyPreset(presetIdx, false);
        }
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      });
      const heroEl = heroSelector ? document.querySelector(heroSelector) : null;
      const headerEl = headerSelector ? document.querySelector(headerSelector) : null;
      const footerEl = footerSelector ? document.querySelector(footerSelector) : null;
      if (heroEl) resizeObserver.observe(heroEl);
      if (headerEl) resizeObserver.observe(headerEl);
      if (footerEl) resizeObserver.observe(footerEl);
    }

    const onScroll = () => {
      rebuildGrid();
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    window.addEventListener('resize', sizeCanvas);
    window.addEventListener('scroll', onScroll, { passive: true });
    if (hasFinePointer) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.addEventListener('pointerleave', onPointerLeave);
    }
    document.addEventListener('click', onClick);

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      document.body.classList.remove('wall-slot-hover');
      window.removeEventListener('resize', sizeCanvas);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('click', onClick);
    };
  }, [controller, heroSelector, headerSelector, footerSelector]);

  useEffect(() => {
    syncLoopRef.current();
  }, [controller.motionOn, controller.activePillar, controller.activeTool, isModalOpen]);

  return <canvas ref={canvasRef} className="mortise-wall-canvas" aria-hidden="true" />;
};

export const MortiseWallToolbar: React.FC<{ controller: MortiseWallController }> = ({
  controller,
}) => {
  const { activeTool, setActiveTool, rearrange, clearWall } = controller;

  return (
    <div className="wall-toolbar ui-surface" aria-label="Interactive modular wall controls">
      <div className="wall-tool-group" role="group" aria-label="Select modular piece to place">
        <button
          type="button"
          className="wall-tool-btn"
          aria-pressed={activeTool === 'hook'}
          onClick={() => setActiveTool('hook')}
        >
          <svg
            className="wall-tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="8.5" y="2.5" width="7" height="19" rx="1.6" />
            <line x1="8.5" y1="10" x2="15.5" y2="10" />
          </svg>
          <span>Hook</span>
        </button>

        <button
          type="button"
          className="wall-tool-btn"
          aria-pressed={activeTool === 'shelf'}
          onClick={() => setActiveTool('shelf')}
        >
          <svg
            className="wall-tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
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
          aria-pressed={activeTool === 'cabinet'}
          onClick={() => setActiveTool('cabinet')}
        >
          <svg
            className="wall-tool-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2.5" y="4.5" width="19" height="15" rx="0.8" />
            <line x1="12.6" y1="4.5" x2="12.6" y2="19.5" />
            <circle cx="6.2" cy="8.5" r="1.45" />
            <circle cx="17.8" cy="8.5" r="1.45" />
          </svg>
          <span>Cabinet</span>
        </button>
      </div>

      <div className="mortise-actions">
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
