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

// Default & adjustable cell size limits (width in cols, height in rows) for each modular object
export interface PieceSize {
  cols: number;
  rows: number;
}

export const TOOL_SIZE_LIMITS: Record<
  WallTool,
  { minCols: number; maxCols: number; minRows: number; maxRows: number; defaultSize: PieceSize }
> = {
  hook: {
    minCols: 1,
    maxCols: 3,
    minRows: 1,
    maxRows: 1,
    defaultSize: { cols: 1, rows: 1 },
  },
  shelf: {
    minCols: 4,
    maxCols: 6,
    minRows: 2,
    maxRows: 2,
    defaultSize: { cols: 4, rows: 2 },
  },
  cabinet: {
    minCols: 4,
    maxCols: 6,
    minRows: 2,
    maxRows: 4,
    defaultSize: { cols: 4, rows: 2 },
  },
};

const INITIAL_RANDOM_COUNT = 7;

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
  hoverHeat: number;
}

interface PlacedItem {
  id: number;
  type: WallTool;
  gx1: number;
  gx2: number;
  gy1: number;
  gy2: number;
  lift: number;
  seed: number;
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
  toolSizes: Record<WallTool, PieceSize>;
  adjustToolSize: (tool: WallTool, axis: 'cols' | 'rows', delta: -1 | 1) => void;
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
  const [toolSizes, setToolSizes] = useState<Record<WallTool, PieceSize>>({
    hook: { ...TOOL_SIZE_LIMITS.hook.defaultSize },
    shelf: { ...TOOL_SIZE_LIMITS.shelf.defaultSize },
    cabinet: { ...TOOL_SIZE_LIMITS.cabinet.defaultSize },
  });
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

  const adjustToolSize = useCallback(
    (tool: WallTool, axis: 'cols' | 'rows', delta: -1 | 1) => {
      setToolSizes((prev) => {
        const limits = TOOL_SIZE_LIMITS[tool];
        const current = prev[tool];
        const nextVal =
          axis === 'cols'
            ? Math.max(limits.minCols, Math.min(limits.maxCols, current.cols + delta))
            : Math.max(limits.minRows, Math.min(limits.maxRows, current.rows + delta));
        if (nextVal === current[axis]) return prev;
        return {
          ...prev,
          [tool]: {
            ...current,
            [axis]: nextVal,
          },
        };
      });
    },
    []
  );

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
    toolSizes,
    adjustToolSize,
    activePillar,
    setActivePillar,
    motionOn,
    toggleMotion,
    rearrange,
    clearWall,
    registerActions,
  };
}

/**
 * Returns true for desktop web browsers (macOS, Windows, Linux with fine pointer and wide viewport)
 * and false for iOS (iPhone/iPad), Android, mobile UAs, or narrow mobile-width viewports.
 */
export function isDesktopInteractiveWall(): boolean {
  if (typeof window === 'undefined') return true;
  const ua = navigator.userAgent || '';
  const isIOSDevice =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const isMobileUA = /Android|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const hasFinePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
  const isWideViewport = window.innerWidth >= 900;

  return !isIOSDevice && !isMobileUA && hasFinePointer && isWideViewport;
}

export function useDesktopInteractiveWall(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isDesktopInteractiveWall());

  useEffect(() => {
    const update = () => setEnabled(isDesktopInteractiveWall());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return enabled;
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
  /** Override whether click-to-add and drag-to-move are enabled (defaults to desktop browsers only) */
  interactive?: boolean;
}

export const MortiseWallCanvas: React.FC<MortiseWallCanvasProps> = ({
  controller,
  heroSelector = '#hero-center-stack',
  headerSelector = 'header',
  footerSelector = 'footer',
  isModalOpen = false,
  interactive,
}) => {
  const desktopInteractive = useDesktopInteractiveWall();
  const canInteract = interactive ?? desktopInteractive;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const syncLoopRef = useRef<() => void>(() => {});
  const stateRef = useRef({
    activeTool: controller.activeTool,
    toolSizes: controller.toolSizes,
    activePillar: controller.activePillar,
    motionOn: controller.motionOn,
    isModalOpen,
    canInteract,
  });

  stateRef.current = {
    activeTool: controller.activeTool,
    toolSizes: controller.toolSizes,
    activePillar: controller.activePillar,
    motionOn: controller.motionOn,
    isModalOpen,
    canInteract,
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
    let hasUserEdited = false;
    let hasInitializedRandom = false;
    let nextItemId = 1;

    // Unlimited additive list of placed items — nothing is removed until Clear (or Reload/Rearrange)
    let placedItems: PlacedItem[] = [];
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
    let hoveredItemId: number | null = null;
    let hoveredPlacementCandidate: {
      gx1: number;
      gx2: number;
      gy1: number;
      gy2: number;
    } | null = null;
    let dragSession: {
      itemId: number;
      pointerId: number;
      startX: number;
      startY: number;
      grabOffsetX: number;
      grabOffsetY: number;
      cols: number;
      rows: number;
      active: boolean;
      snapRect: { gx1: number; gx2: number; gy1: number; gy2: number };
    } | null = null;
    let suppressNextClick = false;
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

    const isItemVisible = (item: { gx1: number; gx2: number; gy1: number; gy2: number }) => {
      for (let gy = item.gy1; gy <= item.gy2; gy++) {
        for (let gx = item.gx1; gx <= item.gx2; gx++) {
          const s = slotByCoord(gx, gy);
          if (!s || s.blocked) return false;
        }
      }
      return true;
    };

    const canPlaceRect = (gx1: number, gx2: number, gy1: number, gy2: number) => {
      for (let gy = gy1; gy <= gy2; gy++) {
        for (let gx = gx1; gx <= gx2; gx++) {
          const s = slotByCoord(gx, gy);
          if (!s || s.blocked) return false;
          if (s.cx < 14 || s.cx > cssW - 14) return false;
        }
      }
      return true;
    };

    /**
     * Finds the best valid (cols x rows) grid rectangle anchored on or around the hovered/clicked slot.
     * Supports any width/height cell variance for Hooks, Shelves + Rods, and Cabinets.
     */
    const getCandidateForSlot = (
      s: SlotNode | null,
      cols: number,
      rows: number
    ): { gx1: number; gx2: number; gy1: number; gy2: number } | null => {
      if (!s || s.blocked) return null;
      const dxOrder: number[] = [];
      const centerShiftX = Math.floor((cols - 1) / 2);
      dxOrder.push(-centerShiftX);
      for (let step = 1; step < cols; step++) {
        const leftShift = -centerShiftX - step;
        const rightShift = -centerShiftX + step;
        if (leftShift >= -(cols - 1) && leftShift <= 0) dxOrder.push(leftShift);
        if (rightShift >= -(cols - 1) && rightShift <= 0) dxOrder.push(rightShift);
      }

      const dyOrder: number[] = [];
      for (let dy = 0; dy >= -(rows - 1); dy--) {
        dyOrder.push(dy);
      }

      for (const dy of dyOrder) {
        for (const dx of dxOrder) {
          const gx1 = s.gx + dx;
          const gx2 = gx1 + cols - 1;
          const gy1 = s.gy + dy;
          const gy2 = gy1 + rows - 1;
          if (canPlaceRect(gx1, gx2, gy1, gy2)) {
            return { gx1, gx2, gy1, gy2 };
          }
        }
      }
      return null;
    };

    /**
     * Appends a new piece to the mortise wall without removing or overwriting any previously placed items.
     */
    const addPlacedItem = (
      type: WallTool,
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      withAnim: boolean
    ) => {
      const id = nextItemId++;
      placedItems.push({
        id,
        type,
        gx1,
        gx2,
        gy1,
        gy2,
        lift: withAnim ? 0.08 : 1,
        seed: id * 17 + gx1 * 7 + gx2 * 11 + gy1 * 13 + gy2 * 19,
      });
    };

    /**
     * Hit-tests placed hardware top-most first so users can grab and drag any piece to move it.
     */
    const findItemAtPoint = (px: number, py: number): PlacedItem | null => {
      const m = gridMeta;
      for (let i = placedItems.length - 1; i >= 0; i--) {
        const item = placedItems[i];
        if (!isItemVisible(item)) continue;

        const leftCx = m.centerX + item.gx1 * m.pitchX;
        const rightCx = m.centerX + item.gx2 * m.pitchX;
        const upperCy = m.centerY + item.gy1 * m.pitchY;
        const lowerCy = m.centerY + item.gy2 * m.pitchY;

        if (item.type === 'hook') {
          const cols = Math.max(1, item.gx2 - item.gx1 + 1);
          const rows = Math.max(1, item.gy2 - item.gy1 + 1);
          const hookW = m.slotW * 0.857;
          const upperH = m.slotH * 0.768;
          const lowerH = m.slotH * 1.382;
          const extraH = Math.max(0, rows - 1) * m.pitchY;
          const totalH = upperH + extraH + lowerH;
          const hy = upperCy + m.slotH * 0.04;

          if (cols > 1) {
            const railX = leftCx - hookW * 0.5;
            const railW = rightCx - leftCx + hookW;
            const railH = upperH + extraH * 0.38;
            if (
              px >= railX - 5 &&
              px <= railX + railW + 5 &&
              py >= hy - 5 &&
              py <= hy + railH + 5
            ) {
              return item;
            }
          }

          for (let gx = item.gx1; gx <= item.gx2; gx++) {
            const cx = m.centerX + gx * m.pitchX;
            const hx = cx - hookW * 0.5;
            if (
              px >= hx - 7 &&
              px <= hx + hookW + 7 &&
              py >= hy - 5 &&
              py <= hy + totalH + 5
            ) {
              return item;
            }
          }
        } else if (item.type === 'shelf') {
          const t = m.slotW * 0.857;
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const topY = upperCy + m.slotH * 0.04;
          const botY = lowerCy + m.slotH * 0.11;
          if (px >= leftX - 5 && px <= rightX + 5 && py >= topY - 5 && py <= botY + 5) {
            return item;
          }
        } else {
          const t = Math.max(7.5, Math.min(11.5, m.pitchX * 0.145));
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const topY = upperCy - m.slotH * 0.62;
          const botY = lowerCy + m.slotH * 0.62;
          if (px >= leftX - 4 && px <= rightX + 4 && py >= topY - 4 && py <= botY + 4) {
            return item;
          }
        }
      }
      return null;
    };

    /**
     * Finds the closest valid (cols x rows) mortise grid rectangle near floating grid coords
     * while dragging an existing item across the wall.
     */
    const findNearestValidRect = (
      floatGx1: number,
      floatGy1: number,
      cols: number,
      rows: number
    ): { gx1: number; gx2: number; gy1: number; gy2: number } | null => {
      const baseGx = Math.round(floatGx1);
      const baseGy = Math.round(floatGy1);
      if (canPlaceRect(baseGx, baseGx + cols - 1, baseGy, baseGy + rows - 1)) {
        return {
          gx1: baseGx,
          gx2: baseGx + cols - 1,
          gy1: baseGy,
          gy2: baseGy + rows - 1,
        };
      }

      let bestRect: { gx1: number; gx2: number; gy1: number; gy2: number } | null = null;
      let bestDist = Infinity;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const gx1 = baseGx + dx;
          const gy1 = baseGy + dy;
          const gx2 = gx1 + cols - 1;
          const gy2 = gy1 + rows - 1;
          if (!canPlaceRect(gx1, gx2, gy1, gy2)) continue;
          const d = Math.hypot(gx1 - floatGx1, gy1 - floatGy1);
          if (d < bestDist) {
            bestDist = d;
            bestRect = { gx1, gx2, gy1, gy2 };
          }
        }
      }
      return bestRect;
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
     * True 3D cast shadow of the CNC-cut J-profile Wall Hook (single or multi-cell hook rail)
     * under upper-left directional light. Reveals projecting hook saddles and upturned catch noses.
     */
    const drawWallHookIsoShadow = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number
    ) => {
      if (lift <= 0.02) return;
      const cols = Math.max(1, gx2 - gx1 + 1);
      const rows = Math.max(1, gy2 - gy1 + 1);
      const hookW = m.slotW * 0.857;
      const upperH = m.slotH * 0.768;
      const lowerH = m.slotH * 1.382;
      const extraH = Math.max(0, rows - 1) * m.pitchY;
      const totalH = upperH + extraH + lowerH;
      const bendY = upperH + extraH;
      const liftOffset = (1 - lift) * 6;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const hy = upperCy + m.slotH * 0.04 - liftOffset;

      // Real 3D wall projection depth of the CNC J-hook (~0.66 of standard single-cell height)
      const baseH = upperH + lowerH;
      const depth = baseH * 0.66 * lift;
      const projX = (x: number, zFrac: number) => x + depth * zFrac * LIGHT_KX;
      const projY = (yPx: number, zFrac: number) => hy + yPx + depth * zFrac * LIGHT_KY;

      ctx.save();
      ctx.beginPath();

      // If multi-column hook rail (cols > 1), include the subtle backplate rail shadow first
      if (cols > 1) {
        const leftCx = m.centerX + gx1 * m.pitchX + ox;
        const rightCx = m.centerX + gx2 * m.pitchX + ox;
        const railX = leftCx - hookW * 0.5;
        const railW = rightCx - leftCx + hookW;
        const railH = upperH + extraH * 0.38;
        const railDepth = m.slotH * 0.34 * lift;
        appendExtrudedBoxShadowPath(
          railX,
          hy,
          railW,
          railH,
          railDepth * LIGHT_KX,
          railDepth * LIGHT_KY,
          m.slotW * 0.143
        );
      }

      for (let gx = gx1; gx <= gx2; gx++) {
        const cx = m.centerX + gx * m.pitchX + ox;
        const hx = cx - hookW * 0.5;
        const rightEdge = hx + hookW;

        ctx.moveTo(rightEdge, hy);
        ctx.lineTo(projX(rightEdge, 0.22), projY(upperH * 0.17, 0.22));
        ctx.lineTo(projX(rightEdge, 0.26), projY(bendY + lowerH * 0.19, 0.26));
        ctx.quadraticCurveTo(
          projX(rightEdge, 0.44),
          projY(bendY + lowerH * 0.5, 0.44),
          projX(rightEdge, 0.68),
          projY(bendY + lowerH * 0.31, 0.68)
        );
        ctx.quadraticCurveTo(
          projX(rightEdge, 0.94),
          projY(bendY - lowerH * 0.06, 0.94),
          projX(rightEdge, 1.0),
          projY(bendY + lowerH * 0.01, 1.0)
        );
        ctx.quadraticCurveTo(
          projX(rightEdge, 1.04),
          projY(bendY + lowerH * 0.41, 1.04),
          projX(rightEdge, 0.82),
          projY(bendY + lowerH * 0.75, 0.82)
        );
        ctx.lineTo(projX(hx, 0.42), projY(totalH - lowerH * 0.03, 0.42));
        ctx.lineTo(hx, hy + totalH);
        ctx.lineTo(hx, hy);
        ctx.closePath();
      }

      const firstHx = m.centerX + gx1 * m.pitchX + ox - hookW * 0.5;
      const lastRight = m.centerX + gx2 * m.pitchX + ox + hookW * 0.5;
      fillDirectionalCastShadow(
        firstHx,
        hy,
        projX(lastRight, 1.0),
        projY(totalH, 0.85),
        lift,
        5
      );
      ctx.restore();
    };

    /**
     * Helper to append a clockwise 3D extruded rectangle cast shadow into the active canvas path
     * (used for vertical cheek brackets, hook rails, and horizontal shelf boards without double-darkening seams).
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
      gy1: number,
      gy2: number,
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
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;

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
      const rodDiam = Math.min(t * 1.48, m.pitchY * 0.25);
      const rodBotY = botY - Math.min(bracketH * 0.16, m.pitchY * 0.18);
      const rodTopY = rodBotY - rodDiam;

      // Grounded 3D shelf projection depth stays realistic even on taller 3-row shelves
      const shelfDepth = Math.min(bracketH, m.pitchY * 1.15) * 0.68 * lift;
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
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number
    ) => {
      if (lift <= 0.02) return;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;

      const t = Math.max(7.5, Math.min(11.5, m.pitchX * 0.145));
      const liftOffset = (1 - lift) * 7;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;
      const cabW = rightX - leftX;
      const topY = upperCy - m.slotH * 0.62 - liftOffset;
      const botY = lowerCy + m.slotH * 0.62 - liftOffset;
      const cabH = botY - topY;

      // Realistic 3D wall projection depth (capped cleanly for tall 3- and 4-row cabinets)
      const cabDepth = Math.min(cabH, m.pitchY * 1.45) * 0.48 * lift;
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
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean,
      seed = 0
    ) => {
      const cols = Math.max(1, gx2 - gx1 + 1);
      const rows = Math.max(1, gy2 - gy1 + 1);
      const hookW = m.slotW * 0.857;
      const r = m.slotW * 0.143;
      const upperH = m.slotH * 0.768;
      const lowerH = m.slotH * 1.382;
      const extraH = Math.max(0, rows - 1) * m.pitchY;
      const totalH = upperH + extraH + lowerH;
      const liftOffset = (1 - lift) * 6;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const hy = upperCy + m.slotH * 0.04 - liftOffset;
      const seamY = hy + upperH + extraH;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.48;
        ctx.setLineDash([4, 3]);
      }

      // Multi-column horizontal CNC Maple mounting rail connecting the hooks when cols > 1
      if (cols > 1) {
        const leftCx = m.centerX + gx1 * m.pitchX + ox;
        const rightCx = m.centerX + gx2 * m.pitchX + ox;
        const railX = leftCx - hookW * 0.5;
        const railW = rightCx - leftCx + hookW;
        const railH = upperH + extraH * 0.38;

        if (isGhost) {
          drawRoundRect(railX, hy, railW, railH, r);
          ctx.fillStyle = '#EAD8BD';
          ctx.fill();
        } else {
          ctx.save();
          drawRoundRect(railX, hy, railW, railH, r);
          ctx.clip();
          drawMapleFace(railX, hy, railW, railH, 'horizontal', undefined, 0, seed + 3.7);
          ctx.restore();
        }

        drawRoundRect(railX, hy, railW, railH, r);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.4 : 1.85;
        ctx.stroke();
      }

      // Individual CNC-cut 13-ply Baltic Birch J-hooks at each column in gx1..gx2
      for (let gx = gx1; gx <= gx2; gx++) {
        const cx = m.centerX + gx * m.pitchX + ox;
        const hx = cx - hookW * 0.5;
        const colSeed = seed + gx * 7.3;

        if (isGhost) {
          drawRoundRect(hx, hy, hookW, totalH, r);
          ctx.fillStyle = '#E8D5B5';
          ctx.fill();
        } else {
          ctx.save();
          drawRoundRect(hx, hy, hookW, totalH, r);
          ctx.clip();

          // Continuous exposed 3/4" Baltic Birch multi-ply edge on both upper & lower hook faces
          drawBirchEdge(hx, hy, hookW, totalH, 'vertical', colSeed + 1.1);

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
        if (isGhost) ctx.setLineDash([4, 3]);
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
      }

      ctx.restore();
    };

    const drawShelfWithRod = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean,
      seed = 0
    ) => {
      const t = m.slotW * 0.857;
      const r = m.slotW * 0.143;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const grainSeed = seed || gx1 * 7 + gx2 * 13 + gy1 * 19 + gy2 * 23;

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
      const rodDiam = Math.min(t * 1.48, m.pitchY * 0.25);
      const rodBotY = botY - Math.min(bracketH * 0.16, m.pitchY * 0.18);
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

      drawCheekBracket(leftX, grainSeed + 5);
      drawCheekBracket(rightX, grainSeed + 9);

      // 3. Continuous Horizontal Shelf Board seated into half-lap dados (leftCx..rightCx)
      //    Clean uninterrupted 13-ply horizontal Baltic Birch edge — no top color stripe or extra black dividers
      ctx.setLineDash([]);
      if (isGhost) {
        ctx.fillStyle = '#E8D5B5';
        ctx.fillRect(leftCx, shelfTopY, shelfFullW, shelfH);
      } else {
        drawBirchEdge(leftCx, shelfTopY, shelfFullW, shelfH, 'horizontal', grainSeed + 1);
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
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean,
      seed = 0
    ) => {
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const grainSeed = seed || gx1 * 11 + gx2 * 17 + gy1 * 23 + gy2 * 29;

      // Uniform 3/4" carcass plywood thickness across all variable widths & heights
      const t = Math.max(7.5, Math.min(11.5, m.pitchX * 0.145));
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

      // Circular finger-pull cutouts positioned cleanly in upper-left & upper-right door corners
      const pullR = Math.max(4.6, Math.min(m.pitchY * 0.1, innerH * 0.075, innerW * 0.042));
      const pullInsetX = Math.max(pullR + 5, Math.min(innerW * 0.125, m.pitchX * 0.42));
      const pullInsetY = Math.max(pullR + 6, Math.min(innerH * 0.2, m.pitchY * 0.36));
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
        drawBirchEdge(leftX, topY, t * 0.5, cabH, 'vertical', grainSeed + 1);
        drawBirchEdge(leftCx, innerY, t * 0.5, innerH, 'vertical', grainSeed + 1.4);
        drawBirchEdge(rightCx, topY, t * 0.5, cabH, 'vertical', grainSeed + 2);
        drawBirchEdge(innerX + innerW, innerY, t * 0.5, innerH, 'vertical', grainSeed + 2.4);

        // Top & bottom horizontal carcass panels seated into half-lap rabbets (leftCx..rightCx)
        drawBirchEdge(leftCx, topY, rightCx - leftCx, t, 'horizontal', grainSeed + 3);
        drawBirchEdge(leftCx, innerY + innerH, rightCx - leftCx, t, 'horizontal', grainSeed + 4);

        // 2. Left (Front) & Right (Rear) Bypass Sliding Doors — Pure Natural Hard Maple horizontal grain
        drawMapleFace(innerX, innerY, leftDoorW, innerH, 'horizontal', undefined, 0, grainSeed + 5);
        drawMapleFace(seamX, innerY, rightDoorW, innerH, 'horizontal', undefined, 0, grainSeed + 9);

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
            grainSeed + i * 3
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

    /**
     * Generates a fresh randomized composition of `targetCount` (default 7) varied modular items
     * across available open mortise wall cells on every page reload or Rearrange click.
     */
    const applyRandomArrangement = (
      targetCount = INITIAL_RANDOM_COUNT,
      withPulse = false
    ) => {
      placedItems = [];
      const openSlots = slots.filter(
        (s) => !s.blocked && s.cx >= 14 && s.cx <= cssW - 14
      );
      if (openSlots.length === 0) return;

      const usedCells = new Set<string>();
      const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

      const isRectFree = (gx1: number, gx2: number, gy1: number, gy2: number) => {
        if (!canPlaceRect(gx1, gx2, gy1, gy2)) return false;
        for (let gy = gy1; gy <= gy2; gy++) {
          for (let gx = gx1; gx <= gx2; gx++) {
            if (usedCells.has(keyOf(gx, gy))) return false;
          }
        }
        return true;
      };

      const markRectUsed = (gx1: number, gx2: number, gy1: number, gy2: number) => {
        for (let gy = gy1; gy <= gy2; gy++) {
          for (let gx = gx1; gx <= gx2; gx++) {
            usedCells.add(keyOf(gx, gy));
          }
        }
      };

      const tryPlaceRandomOfSize = (
        type: WallTool,
        cols: number,
        rows: number,
        preferSide?: 'left' | 'right'
      ): boolean => {
        const candidates: Array<{ gx1: number; gx2: number; gy1: number; gy2: number }> = [];
        const preferred: Array<{ gx1: number; gx2: number; gy1: number; gy2: number }> = [];

        for (let i = 0; i < openSlots.length; i++) {
          const s = openSlots[i];
          const gx1 = s.gx;
          const gx2 = s.gx + cols - 1;
          const gy1 = s.gy;
          const gy2 = s.gy + rows - 1;
          if (!isRectFree(gx1, gx2, gy1, gy2)) continue;
          const rect = { gx1, gx2, gy1, gy2 };
          candidates.push(rect);
          if (preferSide) {
            const midX = mMidX(gx1, gx2);
            if (
              (preferSide === 'left' && midX < cssW * 0.5) ||
              (preferSide === 'right' && midX >= cssW * 0.5)
            ) {
              preferred.push(rect);
            }
          }
        }

        const pool = preferred.length > 0 ? preferred : candidates;
        if (pool.length === 0) return false;
        const chosen = pickRandom(pool);
        addPlacedItem(type, chosen.gx1, chosen.gx2, chosen.gy1, chosen.gy2, withPulse);
        markRectUsed(chosen.gx1, chosen.gx2, chosen.gy1, chosen.gy2);
        return true;
      };

      const mMidX = (gx1: number, gx2: number) =>
        gridMeta.centerX + ((gx1 + gx2) * 0.5) * gridMeta.pitchX;

      // Build a balanced, genuinely randomized 7-item recipe (cabinets + shelves + varied hooks)
      const cabCount = Math.random() < 0.55 ? 2 : 1;
      const shelfCount = Math.random() < 0.55 ? 2 : 1;
      const hookCount = Math.max(1, targetCount - cabCount - shelfCount);

      const largeSpecs: Array<{
        type: WallTool;
        sizes: Array<{ cols: number; rows: number }>;
      }> = [];

      // Cabinet: grows in both width and height, never less than 4 mortises wide x 2 tall
      const cabinetSizePool: Array<{ cols: number; rows: number }> = [
        { cols: 4, rows: 2 },
        { cols: 5, rows: 2 },
        { cols: 6, rows: 2 },
        { cols: 4, rows: 3 },
        { cols: 5, rows: 3 },
        { cols: 4, rows: 4 },
      ];
      // Shelf + Rod: grows in width only (fixed at 2 mortises tall, min 4 wide)
      const shelfSizePool: Array<{ cols: number; rows: number }> = [
        { cols: 4, rows: 2 },
        { cols: 5, rows: 2 },
        { cols: 6, rows: 2 },
      ];
      // Hook: grows in width only (fixed at 1 mortise tall)
      const hookSizePool: Array<{ cols: number; rows: number }> = [
        { cols: 1, rows: 1 },
        { cols: 1, rows: 1 },
        { cols: 2, rows: 1 },
        { cols: 3, rows: 1 },
      ];

      for (let i = 0; i < cabCount; i++) {
        const primary = pickRandom(cabinetSizePool);
        largeSpecs.push({
          type: 'cabinet',
          sizes: [primary, { cols: 4, rows: 2 }],
        });
      }
      for (let i = 0; i < shelfCount; i++) {
        const primary = pickRandom(shelfSizePool);
        largeSpecs.push({
          type: 'shelf',
          sizes: [primary, { cols: 4, rows: 2 }],
        });
      }

      // Shuffle order of large pieces and alternate preferred left/right flanks for visual balance
      for (let i = largeSpecs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [largeSpecs[i], largeSpecs[j]] = [largeSpecs[j], largeSpecs[i]];
      }

      let leftCount = 0;
      let rightCount = 0;
      const nextSide = (): 'left' | 'right' => {
        if (leftCount < rightCount) return 'left';
        if (rightCount < leftCount) return 'right';
        return Math.random() < 0.5 ? 'left' : 'right';
      };

      const recordLastSide = () => {
        const last = placedItems[placedItems.length - 1];
        if (!last) return;
        if (mMidX(last.gx1, last.gx2) < cssW * 0.5) leftCount++;
        else rightCount++;
      };

      for (const spec of largeSpecs) {
        let placed = false;
        const side = nextSide();
        for (const sz of spec.sizes) {
          if (tryPlaceRandomOfSize(spec.type, sz.cols, sz.rows, side)) {
            placed = true;
            recordLastSide();
            break;
          }
        }
        if (!placed) {
          // Graceful fallback on narrow screens so we still reach 7 total items
          const fallbackSize = pickRandom(hookSizePool);
          if (
            tryPlaceRandomOfSize('hook', fallbackSize.cols, fallbackSize.rows, side) ||
            tryPlaceRandomOfSize('hook', 1, 1)
          ) {
            recordLastSide();
          }
        }
      }

      // Place remaining varied hooks up to targetCount (7)
      let remaining = Math.max(hookCount, targetCount - placedItems.length);
      let guard = 0;
      while (placedItems.length < targetCount && remaining > 0 && guard < 24) {
        guard++;
        const side = nextSide();
        const sz = pickRandom(hookSizePool);
        if (
          tryPlaceRandomOfSize('hook', sz.cols, sz.rows, side) ||
          tryPlaceRandomOfSize('hook', 1, 1, side) ||
          tryPlaceRandomOfSize('hook', 1, 1)
        ) {
          recordLastSide();
          remaining--;
        } else {
          break;
        }
      }

      if (withPulse) triggerRipple(0.5, 0.5);
    };

    const renderFrame = (now: number) => {
      const m = gridMeta;
      const {
        activeTool,
        toolSizes,
        motionOn,
        isModalOpen: modalActive,
        canInteract: interactiveActive,
      } = stateRef.current;
      const influenceR = Math.max(m.pitchX, m.pitchY) * 2.15;
      const rippleAge = (now - rippleTime) / 1000;
      const effectiveOverUI = pointerOverUI || modalActive || !interactiveActive;

      ctx.fillStyle = COLORS.white;
      ctx.fillRect(0, 0, cssW, cssH);

      const activeDrag = dragSession && dragSession.active ? dragSession : null;
      const draggedItemId = activeDrag ? activeDrag.itemId : null;

      // Index occupied mortise slots & highlighted anchor slots from all grounded placed items
      const occupiedKeys = new Set<string>();
      const anchorKeys = new Set<string>();
      const visibleItems: Array<{ item: PlacedItem; ox: number; oy: number }> = [];
      let draggedItem: PlacedItem | null = null;

      for (let i = 0; i < placedItems.length; i++) {
        const item = placedItems[i];
        item.lift = motionOn ? item.lift + (1 - item.lift) * 0.2 : 1;
        if (item.id === draggedItemId) {
          draggedItem = item;
          continue;
        }
        if (!isItemVisible(item)) continue;

        for (let gy = item.gy1; gy <= item.gy2; gy++) {
          for (let gx = item.gx1; gx <= item.gx2; gx++) {
            const k = keyOf(gx, gy);
            occupiedKeys.add(k);
            if (item.type === 'shelf') {
              if (gx === item.gx1 || gx === item.gx2) anchorKeys.add(k);
            } else {
              anchorKeys.add(k);
            }
          }
        }
      }

      hoveredIdx = -1;
      hoveredPlacementCandidate = null;
      const hitItem =
        !activeDrag && !effectiveOverUI && pointerX > -1000
          ? findItemAtPoint(pointerX, pointerY)
          : null;
      hoveredItemId = hitItem ? hitItem.id : null;
      let closestDist = 9999;

      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        const isOccupied = !s.blocked && occupiedKeys.has(keyOf(s.gx, s.gy));

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
            !activeDrag &&
            hoveredItemId === null &&
            dist < Math.max(m.pitchX, m.pitchY) * 0.56 &&
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
        } else {
          s.vx = (s.vx + (targetOx - s.ox) * 0.13) * 0.78;
          s.vy = (s.vy + (targetOy - s.oy) * 0.13) * 0.78;
          s.ox += s.vx;
          s.oy += s.vy;
          s.vrot = (s.vrot + (targetRot - s.rot) * 0.14) * 0.76;
          s.rot += s.vrot;
          s.hoverHeat += (targetHeat - s.hoverHeat) * 0.16;
        }
      }

      const activeSize = toolSizes[activeTool];
      if (!effectiveOverUI && !activeDrag && hoveredItemId === null && hoveredIdx !== -1) {
        hoveredPlacementCandidate = getCandidateForSlot(
          slots[hoveredIdx],
          activeSize.cols,
          activeSize.rows
        );
      }

      document.body.classList.toggle(
        'wall-piece-hover',
        !effectiveOverUI && !activeDrag && hoveredItemId !== null
      );
      document.body.classList.toggle(
        'wall-slot-hover',
        !effectiveOverUI &&
          !activeDrag &&
          hoveredItemId === null &&
          hoveredPlacementCandidate !== null
      );

      // Draw mortise slots (never render any slot behind text or UI clearance zones)
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.blocked) continue;
        const k = keyOf(s.gx, s.gy);
        const isOccupied = occupiedKeys.has(k);
        const isAnchored = anchorKeys.has(k);
        const isHov = i === hoveredIdx;
        const isDragSnapSlot =
          activeDrag !== null &&
          s.gx >= activeDrag.snapRect.gx1 &&
          s.gx <= activeDrag.snapRect.gx2 &&
          s.gy >= activeDrag.snapRect.gy1 &&
          s.gy <= activeDrag.snapRect.gy2;
        const x = -m.slotW * 0.5;
        const y = -m.slotH * 0.5;

        ctx.save();
        ctx.translate(s.cx + s.ox, s.cy + s.oy);
        ctx.rotate(s.rot);

        if ((!isOccupied && (s.hoverHeat > 0.06 || isHov)) || isDragSnapSlot) {
          drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
          ctx.fillStyle = '#DEC7A4';
          ctx.globalAlpha = isDragSnapSlot ? 0.55 : isHov ? 0.42 : s.hoverHeat * 0.24;
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
          isAnchored || isDragSnapSlot
            ? COLORS.black
            : isHov || s.hoverHeat > 0.38
              ? COLORS.black
              : COLORS.gray;
        ctx.lineWidth = isHov || isDragSnapSlot ? 1.9 : 1.4;
        ctx.stroke();
        ctx.restore();
      }

      // Compute gentle spring offsets & draw Pass 1 (directional 3D cast shadows) for grounded items
      for (let i = 0; i < placedItems.length; i++) {
        const item = placedItems[i];
        if (item.id === draggedItemId || !isItemVisible(item)) continue;
        let avgOx = 0;
        let avgOy = 0;
        let count = 0;
        for (let gx = item.gx1; gx <= item.gx2; gx++) {
          const ks = slotByCoord(gx, item.gy1);
          if (ks) {
            avgOx += ks.ox;
            avgOy += ks.oy;
            count++;
          }
        }
        const ox = count ? avgOx / count : 0;
        const oy = count ? avgOy / count : 0;
        visibleItems.push({ item, ox, oy });

        if (item.type === 'hook') {
          drawWallHookIsoShadow(
            item.gx1,
            item.gx2,
            item.gy1,
            item.gy2,
            m,
            item.lift,
            ox,
            oy
          );
        } else if (item.type === 'shelf') {
          drawShelfIsoShadow(
            item.gx1,
            item.gx2,
            item.gy1,
            item.gy2,
            m,
            item.lift,
            ox,
            oy
          );
        } else {
          drawCabinetIsoShadow(
            item.gx1,
            item.gx2,
            item.gy1,
            item.gy2,
            m,
            item.lift,
            ox,
            oy
          );
        }
      }

      // Pass 2: Draw grounded front-elevation hardware cleanly on top of directional cast shadows
      for (let i = 0; i < visibleItems.length; i++) {
        const { item, ox, oy } = visibleItems[i];
        if (item.type === 'hook') {
          drawWallHook(
            item.gx1,
            item.gx2,
            item.gy1,
            item.gy2,
            m,
            item.lift,
            ox,
            oy,
            false,
            item.seed
          );
        } else if (item.type === 'shelf') {
          drawShelfWithRod(
            item.gx1,
            item.gx2,
            item.gy1,
            item.gy2,
            m,
            item.lift,
            ox,
            oy,
            false,
            item.seed
          );
        } else {
          drawSlidingDoorCabinet(
            item.gx1,
            item.gx2,
            item.gy1,
            item.gy2,
            m,
            item.lift,
            ox,
            oy,
            false,
            item.seed
          );
        }
      }

      // Pass 3: While dragging an existing item, show its magnetic snap target + lifted floating piece
      if (activeDrag && draggedItem) {
        const snap = activeDrag.snapRect;
        if (draggedItem.type === 'hook') {
          drawWallHook(snap.gx1, snap.gx2, snap.gy1, snap.gy2, m, 1, 0, 0, true);
        } else if (draggedItem.type === 'shelf') {
          drawShelfWithRod(snap.gx1, snap.gx2, snap.gy1, snap.gy2, m, 1, 0, 0, true);
        } else {
          drawSlidingDoorCabinet(snap.gx1, snap.gx2, snap.gy1, snap.gy2, m, 1, 0, 0, true);
        }

        const dragOx = pointerX - activeDrag.startX;
        const dragOy = pointerY - activeDrag.startY - 3;
        const elevatedLift = 1.14;

        if (draggedItem.type === 'hook') {
          drawWallHookIsoShadow(
            draggedItem.gx1,
            draggedItem.gx2,
            draggedItem.gy1,
            draggedItem.gy2,
            m,
            elevatedLift,
            dragOx,
            dragOy
          );
          drawWallHook(
            draggedItem.gx1,
            draggedItem.gx2,
            draggedItem.gy1,
            draggedItem.gy2,
            m,
            1,
            dragOx,
            dragOy,
            false,
            draggedItem.seed
          );
        } else if (draggedItem.type === 'shelf') {
          drawShelfIsoShadow(
            draggedItem.gx1,
            draggedItem.gx2,
            draggedItem.gy1,
            draggedItem.gy2,
            m,
            elevatedLift,
            dragOx,
            dragOy
          );
          drawShelfWithRod(
            draggedItem.gx1,
            draggedItem.gx2,
            draggedItem.gy1,
            draggedItem.gy2,
            m,
            1,
            dragOx,
            dragOy,
            false,
            draggedItem.seed
          );
        } else {
          drawCabinetIsoShadow(
            draggedItem.gx1,
            draggedItem.gx2,
            draggedItem.gy1,
            draggedItem.gy2,
            m,
            elevatedLift,
            dragOx,
            dragOy
          );
          drawSlidingDoorCabinet(
            draggedItem.gx1,
            draggedItem.gx2,
            draggedItem.gy1,
            draggedItem.gy2,
            m,
            1,
            dragOx,
            dragOy,
            false,
            draggedItem.seed
          );
        }
      }

      // Ghost hover preview showing exact adjusted (cols x rows) footprint before placing a new item
      if (
        !effectiveOverUI &&
        !activeDrag &&
        hoveredItemId === null &&
        hoveredPlacementCandidate &&
        hoveredIdx !== -1
      ) {
        const hs = slots[hoveredIdx];
        const cand = hoveredPlacementCandidate;
        if (activeTool === 'hook') {
          drawWallHook(
            cand.gx1,
            cand.gx2,
            cand.gy1,
            cand.gy2,
            m,
            1,
            hs.ox * 0.45,
            hs.oy * 0.45,
            true
          );
        } else if (activeTool === 'shelf') {
          drawShelfWithRod(
            cand.gx1,
            cand.gx2,
            cand.gy1,
            cand.gy2,
            m,
            1,
            hs.ox * 0.4,
            hs.oy * 0.4,
            true
          );
        } else if (activeTool === 'cabinet') {
          drawSlidingDoorCabinet(
            cand.gx1,
            cand.gx2,
            cand.gy1,
            cand.gy2,
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

    const countVisiblePlacedItems = () => {
      let n = 0;
      for (let i = 0; i < placedItems.length; i++) {
        if (isItemVisible(placedItems[i])) n++;
      }
      return n;
    };

    const sizeCanvas = () => {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGrid();
      if (!hasInitializedRandom) {
        hasInitializedRandom = true;
        applyRandomArrangement(INITIAL_RANDOM_COUNT, false);
      } else if (!hasUserEdited && countVisiblePlacedItems() < 3) {
        applyRandomArrangement(INITIAL_RANDOM_COUNT, false);
      }
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    const cancelActiveDrag = () => {
      if (dragSession) {
        dragSession = null;
        document.body.classList.remove('wall-dragging');
      }
    };

    controller.registerActions({
      rearrange: () => {
        cancelActiveDrag();
        hasUserEdited = false;
        applyRandomArrangement(INITIAL_RANDOM_COUNT, true);
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      },
      clearWall: () => {
        cancelActiveDrag();
        hasUserEdited = true;
        placedItems = [];
        triggerRipple(0.5, 0.5);
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      },
      triggerRipple,
    });

    const onPointerDown = (e: PointerEvent) => {
      if (stateRef.current.isModalOpen || !stateRef.current.canInteract) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.('.ui-surface, [role="dialog"], button, a, input, select, textarea')
      ) {
        return;
      }

      pointerX = e.clientX;
      pointerY = e.clientY;
      pointerOverUI = false;

      const hit = findItemAtPoint(e.clientX, e.clientY);
      if (!hit) return;

      const topLeftCx = gridMeta.centerX + hit.gx1 * gridMeta.pitchX;
      const topLeftCy = gridMeta.centerY + hit.gy1 * gridMeta.pitchY;

      dragSession = {
        itemId: hit.id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabOffsetX: e.clientX - topLeftCx,
        grabOffsetY: e.clientY - topLeftCy,
        cols: hit.gx2 - hit.gx1 + 1,
        rows: hit.gy2 - hit.gy1 + 1,
        active: false,
        snapRect: {
          gx1: hit.gx1,
          gx2: hit.gx2,
          gy1: hit.gy1,
          gy2: hit.gy2,
        },
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (stateRef.current.isModalOpen || !stateRef.current.canInteract) {
        pointerOverUI = true;
        cancelActiveDrag();
        return;
      }

      const isDraggingThisPointer = dragSession && dragSession.pointerId === e.pointerId;
      if (!hasFinePointer && !isDraggingThisPointer) return;

      pointerX = e.clientX;
      pointerY = e.clientY;
      const target = e.target as HTMLElement | null;
      pointerOverUI = isDraggingThisPointer
        ? false
        : Boolean(target?.closest?.('.ui-surface, [role="dialog"]'));

      if (isDraggingThisPointer && dragSession) {
        if (
          !dragSession.active &&
          Math.hypot(e.clientX - dragSession.startX, e.clientY - dragSession.startY) >= 5
        ) {
          dragSession.active = true;
          hasUserEdited = true;
          suppressNextClick = true;

          // Bring dragged piece to the front layer so it glides cleanly above other pieces
          const idx = placedItems.findIndex((it) => it.id === dragSession?.itemId);
          if (idx !== -1 && idx < placedItems.length - 1) {
            const [picked] = placedItems.splice(idx, 1);
            placedItems.push(picked);
          }

          document.body.classList.add('wall-dragging');
          document.body.classList.remove('wall-piece-hover', 'wall-slot-hover');
        }

        if (dragSession.active) {
          const floatGx1 =
            (e.clientX - dragSession.grabOffsetX - gridMeta.centerX) / gridMeta.pitchX;
          const floatGy1 =
            (e.clientY - dragSession.grabOffsetY - gridMeta.centerY) / gridMeta.pitchY;
          const nextSnap = findNearestValidRect(
            floatGx1,
            floatGy1,
            dragSession.cols,
            dragSession.rows
          );
          if (nextSnap) {
            dragSession.snapRect = nextSnap;
          }
          if (!stateRef.current.motionOn) renderFrame(performance.now());
          else ensureLoop();
          return;
        }
      }

      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    const finishDrag = (e: PointerEvent, commit: boolean) => {
      if (!dragSession || dragSession.pointerId !== e.pointerId) return;
      const session = dragSession;
      dragSession = null;
      document.body.classList.remove('wall-dragging');

      if (session.active) {
        if (commit) {
          const item = placedItems.find((it) => it.id === session.itemId);
          if (item) {
            item.gx1 = session.snapRect.gx1;
            item.gx2 = session.snapRect.gx2;
            item.gy1 = session.snapRect.gy1;
            item.gy2 = session.snapRect.gy2;
            item.lift = 0.72;
            triggerRipple(
              e.clientX / Math.max(1, cssW),
              e.clientY / Math.max(1, cssH)
            );
          }
        }
        window.setTimeout(() => {
          suppressNextClick = false;
        }, 80);
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      }
    };

    const onPointerUp = (e: PointerEvent) => finishDrag(e, true);
    const onPointerCancel = (e: PointerEvent) => finishDrag(e, false);

    const onTouchMove = (e: TouchEvent) => {
      if (dragSession?.active) {
        e.preventDefault();
      }
    };

    const onPointerLeave = () => {
      if (dragSession?.active) return;
      pointerX = -9999;
      pointerY = -9999;
      pointerOverUI = false;
      hoveredIdx = -1;
      hoveredItemId = null;
      hoveredPlacementCandidate = null;
      document.body.classList.remove('wall-slot-hover', 'wall-piece-hover');
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    const onClick = (e: MouseEvent) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (stateRef.current.isModalOpen || !stateRef.current.canInteract) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.('.ui-surface, [role="dialog"], button, a, input, select, textarea')
      ) {
        return;
      }

      const clickX = e.clientX;
      const clickY = e.clientY;

      // Clicking directly on an existing piece without dragging does NOT delete or clone it
      const hitExisting = findItemAtPoint(clickX, clickY);
      if (hitExisting) {
        hitExisting.lift = 0.84;
        if (!stateRef.current.motionOn) renderFrame(performance.now());
        else ensureLoop();
        return;
      }

      const { activeTool, toolSizes } = stateRef.current;

      let best: SlotNode | null = null;
      let bestDist = Math.max(gridMeta.pitchX, gridMeta.pitchY) * 0.62;
      for (const s of slots) {
        if (s.blocked) continue;
        const d = Math.hypot(s.cx - clickX, s.cy - clickY);
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      if (!best) return;

      // Purely additive placement — unlimited items stay on the wall until Clear is clicked
      const size = toolSizes[activeTool];
      const cand = getCandidateForSlot(best, size.cols, size.rows);
      if (cand) {
        hasUserEdited = true;
        addPlacedItem(activeTool, cand.gx1, cand.gx2, cand.gy1, cand.gy2, true);
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
      }

      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    sizeCanvas();
    renderFrame(performance.now());
    if (stateRef.current.motionOn) ensureLoop();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        rebuildGrid();
        if (!hasUserEdited && countVisiblePlacedItems() < 3) {
          applyRandomArrangement(INITIAL_RANDOM_COUNT, false);
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
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    if (hasFinePointer) {
      document.addEventListener('pointerleave', onPointerLeave);
    }
    document.addEventListener('click', onClick);

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      document.body.classList.remove('wall-slot-hover', 'wall-piece-hover', 'wall-dragging');
      window.removeEventListener('resize', sizeCanvas);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('click', onClick);
    };
  }, [controller, heroSelector, headerSelector, footerSelector]);

  useEffect(() => {
    syncLoopRef.current();
  }, [
    controller.motionOn,
    controller.activePillar,
    controller.activeTool,
    controller.toolSizes,
    isModalOpen,
    canInteract,
  ]);

  return <canvas ref={canvasRef} className="mortise-wall-canvas" aria-hidden="true" />;
};

export const MortiseWallToolbar: React.FC<{
  controller: MortiseWallController;
  variant?: 'default' | 'compact';
}> = ({ controller, variant = 'default' }) => {
  const isDesktopInteractive = useDesktopInteractiveWall();
  const { activeTool, setActiveTool, toolSizes, adjustToolSize, rearrange, clearWall } =
    controller;
  const currentSize = toolSizes[activeTool];
  const currentLimits = TOOL_SIZE_LIMITS[activeTool];
  const activeLabel =
    activeTool === 'hook' ? 'Hook' : activeTool === 'shelf' ? 'Shelf + Rod' : 'Cabinet';

  if (!isDesktopInteractive) return null;

  return (
    <div
      className={`wall-toolbar ui-surface${variant === 'compact' ? ' wall-toolbar--compact' : ''}`}
      aria-label="Interactive modular wall controls"
    >
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
          <span className="wall-tool-size">
            {toolSizes.hook.cols}×{toolSizes.hook.rows}
          </span>
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
          <span className="wall-tool-size">
            {toolSizes.shelf.cols}×{toolSizes.shelf.rows}
          </span>
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
          <span className="wall-tool-size">
            {toolSizes.cabinet.cols}×{toolSizes.cabinet.rows}
          </span>
        </button>
      </div>

      <div
        className="wall-size-controls"
        role="group"
        aria-label={`Adjust ${activeLabel} cell width and height`}
      >
        <div className="wall-size-stepper">
          <span className="wall-size-axis" title="Width in mortise cells">
            W
          </span>
          <button
            type="button"
            className="wall-size-step-btn"
            aria-label={`Make ${activeLabel} 1 cell narrower`}
            disabled={currentSize.cols <= currentLimits.minCols}
            onClick={() => adjustToolSize(activeTool, 'cols', -1)}
          >
            −
          </button>
          <span className="wall-size-val" aria-live="polite">
            {currentSize.cols}
          </span>
          <button
            type="button"
            className="wall-size-step-btn"
            aria-label={`Make ${activeLabel} 1 cell wider`}
            disabled={currentSize.cols >= currentLimits.maxCols}
            onClick={() => adjustToolSize(activeTool, 'cols', 1)}
          >
            +
          </button>
        </div>

        {currentLimits.maxRows > currentLimits.minRows && (
          <div className="wall-size-stepper">
            <span className="wall-size-axis" title="Height in mortise cells">
              H
            </span>
            <button
              type="button"
              className="wall-size-step-btn"
              aria-label={`Make ${activeLabel} 1 cell shorter`}
              disabled={currentSize.rows <= currentLimits.minRows}
              onClick={() => adjustToolSize(activeTool, 'rows', -1)}
            >
              −
            </button>
            <span className="wall-size-val" aria-live="polite">
              {currentSize.rows}
            </span>
            <button
              type="button"
              className="wall-size-step-btn"
              aria-label={`Make ${activeLabel} 1 cell taller`}
              disabled={currentSize.rows >= currentLimits.maxRows}
              onClick={() => adjustToolSize(activeTool, 'rows', 1)}
            >
              +
            </button>
          </div>
        )}
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
