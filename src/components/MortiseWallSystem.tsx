import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import balticBirchEdgeUrl from '../assets/images/baltic_birch_edge_1795173686278.jpg';

const MAPLE_TEXTURE_URL =
  '/assets/aistudio/watermarked_img_13606778923742787615_7e162b39.webp';

// Consistent directional studio light from upper-left projecting 3D wall depth Z down & right
const LIGHT_KX = 0.54;
const LIGHT_KY = 0.64;

export type PillarColorKey = '01' | '02' | '06';
export type WallTool =
  | 'hook'
  | 'shelf'
  | 'cabinet'
  | 'cubby'
  | 'wallShelf'
  | 'cradle'
  | 'sconce';

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

export const TOOL_LABELS: Record<WallTool, string> = {
  hook: 'Hook',
  shelf: 'Shelf + Rod',
  cabinet: 'Cabinet',
  cubby: 'Open Cube',
  wallShelf: 'Wall Shelf',
  cradle: 'Vinyl Box',
  sconce: 'Wall Sconce',
};

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
  cubby: {
    minCols: 3,
    maxCols: 5,
    minRows: 3,
    maxRows: 4,
    defaultSize: { cols: 3, rows: 3 },
  },
  wallShelf: {
    minCols: 3,
    maxCols: 5,
    minRows: 2,
    maxRows: 2,
    defaultSize: { cols: 4, rows: 2 },
  },
  cradle: {
    minCols: 4,
    maxCols: 6,
    minRows: 2,
    maxRows: 2,
    defaultSize: { cols: 5, rows: 2 },
  },
  sconce: {
    minCols: 2,
    maxCols: 6,
    minRows: 1,
    maxRows: 1,
    defaultSize: { cols: 4, rows: 1 },
  },
};

const INITIAL_RANDOM_COUNT = 8;

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
  lit?: boolean;
  hasProps?: boolean;
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
  showProps: boolean;
  toggleProps: () => void;
  rearrange: () => void;
  clearWall: () => void;
  registerActions: (actions: {
    rearrange: () => void;
    clearWall: () => void;
    triggerRipple: (nx: number, ny: number) => void;
    setAllProps: (show: boolean) => void;
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
    cubby: { ...TOOL_SIZE_LIMITS.cubby.defaultSize },
    wallShelf: { ...TOOL_SIZE_LIMITS.wallShelf.defaultSize },
    cradle: { ...TOOL_SIZE_LIMITS.cradle.defaultSize },
    sconce: { ...TOOL_SIZE_LIMITS.sconce.defaultSize },
  });
  const [activePillar, setActivePillarState] = useState<PillarColorKey>(initialPillar);
  const [motionOn, setMotionOn] = useState<boolean>(!prefersReduced);
  const [showProps, setShowProps] = useState<boolean>(true);
  const showPropsRef = useRef<boolean>(true);

  const actionsRef = useRef<{
    rearrange: () => void;
    clearWall: () => void;
    triggerRipple: (nx: number, ny: number) => void;
    setAllProps: (show: boolean) => void;
  }>({
    rearrange: () => {},
    clearWall: () => {},
    triggerRipple: () => {},
    setAllProps: () => {},
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
  const toggleProps = useCallback(() => {
    const next = !showPropsRef.current;
    showPropsRef.current = next;
    setShowProps(next);
    actionsRef.current.setAllProps(next);
  }, []);
  const rearrange = useCallback(() => actionsRef.current.rearrange(), []);
  const clearWall = useCallback(() => actionsRef.current.clearWall(), []);
  const registerActions = useCallback((actions: typeof actionsRef.current) => {
    actionsRef.current = actions;
  }, []);

  return useMemo(
    () => ({
      activeTool,
      setActiveTool,
      toolSizes,
      adjustToolSize,
      activePillar,
      setActivePillar,
      motionOn,
      toggleMotion,
      showProps,
      toggleProps,
      rearrange,
      clearWall,
      registerActions,
    }),
    [
      activeTool,
      toolSizes,
      adjustToolSize,
      activePillar,
      setActivePillar,
      motionOn,
      toggleMotion,
      showProps,
      toggleProps,
      rearrange,
      clearWall,
      registerActions,
    ]
  );
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
    showProps: controller.showProps,
    isModalOpen,
    canInteract,
  });

  stateRef.current = {
    activeTool: controller.activeTool,
    toolSizes: controller.toolSizes,
    activePillar: controller.activePillar,
    motionOn: controller.motionOn,
    showProps: controller.showProps,
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

    // Preload real Baltic Birch face ply & 13-ply exposed edge textures
    // Build progressive 0.5x offscreen mipmap pyramids so small canvas strips never moiré/shimmer
    let mapleReady = false;
    let birchReady = false;
    let mapleMips: HTMLCanvasElement[] = [];
    let birchMips: HTMLCanvasElement[] = [];

    const buildMipPyramid = (
      img: HTMLImageElement,
      minHeight: number
    ): HTMLCanvasElement[] => {
      const mips: HTMLCanvasElement[] = [];
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= 0 || h <= 0) return mips;

      let prev: HTMLImageElement | HTMLCanvasElement = img;
      while (h > minHeight && mips.length < 6) {
        const nextW = Math.max(2, Math.round(w * 0.5));
        const nextH = Math.max(2, Math.round(h * 0.5));
        const off = document.createElement('canvas');
        off.width = nextW;
        off.height = nextH;
        const octx = off.getContext('2d');
        if (!octx) break;
        octx.imageSmoothingEnabled = true;
        octx.imageSmoothingQuality = 'high';
        octx.drawImage(prev, 0, 0, nextW, nextH);
        mips.push(off);
        prev = off;
        w = nextW;
        h = nextH;
      }
      return mips;
    };

    const pickMip = (
      img: HTMLImageElement,
      mips: HTMLCanvasElement[],
      targetPixelHeight: number
    ): HTMLImageElement | HTMLCanvasElement => {
      const desired = Math.max(8, targetPixelHeight * 1.4);
      let chosen: HTMLImageElement | HTMLCanvasElement = img;
      for (let i = 0; i < mips.length; i++) {
        if (mips[i].height >= desired) {
          chosen = mips[i];
        } else {
          break;
        }
      }
      return chosen;
    };

    const onAssetLoaded = (markReady: () => void) => () => {
      markReady();
      if (!disposed && !stateRef.current.motionOn) renderFrame(performance.now());
    };

    const mapleImg = new Image();
    mapleImg.decoding = 'async';
    mapleImg.onload = onAssetLoaded(() => {
      mapleMips = buildMipPyramid(mapleImg, 64);
      mapleReady = true;
    });
    mapleImg.src = MAPLE_TEXTURE_URL;

    const birchImg = new Image();
    birchImg.decoding = 'async';
    birchImg.onload = onAssetLoaded(() => {
      birchMips = buildMipPyramid(birchImg, 16);
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
        lit: type === 'sconce' ? true : undefined,
        hasProps:
          type === 'wallShelf' || type === 'cradle'
            ? stateRef.current.showProps
            : undefined,
      });
    };

    /**
     * Hit-tests placed hardware top-most first so users can grab and drag (or right-click remove) any piece.
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
        } else if (item.type === 'cradle') {
          const itemHasProps = item.hasProps ?? stateRef.current.showProps;
          const t = m.slotW * 0.857;
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const topY = itemHasProps ? upperCy - m.slotH * 0.34 : upperCy + m.slotH * 0.04;
          const botY = lowerCy + m.slotH * 0.11;
          if (px >= leftX - 5 && px <= rightX + 5 && py >= topY - 5 && py <= botY + 5) {
            return item;
          }
        } else if (item.type === 'cubby') {
          const t = Math.max(7.5, Math.min(11.5, m.pitchX * 0.145));
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const topY = upperCy - m.slotH * 0.62;
          const botY = lowerCy + m.slotH * 0.62;
          if (px >= leftX - 4 && px <= rightX + 4 && py >= topY - 4 && py <= botY + 4) {
            return item;
          }
        } else if (item.type === 'wallShelf') {
          const itemHasProps = item.hasProps ?? stateRef.current.showProps;
          const t = m.slotW * 0.857;
          const leftX = leftCx - t * 1.1;
          const rightX = rightCx + t * 1.1;
          const topY = itemHasProps ? upperCy - m.slotH * 0.45 : lowerCy - m.slotH * 0.65;
          const botY = lowerCy + m.slotH * 0.92;
          if (px >= leftX - 6 && px <= rightX + 6 && py >= topY - 5 && py <= botY + 5) {
            return item;
          }
        } else if (item.type === 'sconce') {
          const t = m.slotW * 0.857;
          const leftX = leftCx - t * 0.85;
          const rightX = rightCx + t * 0.85;
          const barH = Math.max(15, Math.min(21, m.slotH * 0.54));
          const topY = upperCy - barH * 0.5;
          const botY = upperCy + barH * 0.5;
          if (px >= leftX - 6 && px <= rightX + 6 && py >= topY - 7 && py <= botY + 7) {
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
      // Scale mortise grid so desktop flanks comfortably fit 5-hook-wide vinyl boxes, cabinets & shelves
      const baseScale = Math.max(0.22, Math.min(0.295, cssW / 4800));
      const scale =
        sideMargin >= 200
          ? Math.max(0.18, Math.min(baseScale, (sideMargin - 20) / (4.55 * SVG_PITCH_X)))
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

      const drawTiledHorizontal = (dx: number, dy: number, dw: number, dh: number) => {
        const src = pickMip(birchImg, birchMips, dh * dpr);
        const sw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
        const sh = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Keep all 13 plies mapped cleanly across board thickness dh, tiling along length dw
        const naturalTileW = Math.max(dh * (sw / Math.max(1, sh)) * 1.45, dh * 2.2);
        const shift = ((Math.abs(seed) * 19.7) % 1) * naturalTileW;
        for (let tx = dx - shift; tx < dx + dw; tx += naturalTileW) {
          ctx.drawImage(src, 0, 0, sw, sh, tx, dy, naturalTileW + 0.5, dh);
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
        const drawCover = (dx: number, dy: number, dw: number, dh: number) => {
          const src = pickMip(mapleImg, mapleMips, Math.max(dw, dh) * dpr);
          const iw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
          const ih = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          const imgRatio = iw / Math.max(1, ih);
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
          ctx.drawImage(src, dx - offX, dy - offY, rw, rh);
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

    /**
     * Shared geometry helper for the Pure 2D Baltic Birch Open Cube (min 3×3 hooks).
     * Uses the exact same outer carcass geometry & 3/4" birch thickness as the Sliding-Door Cabinet.
     */
    const getOpenCubeMetrics = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number
    ) => {
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const t = Math.max(7.5, Math.min(11.5, m.pitchX * 0.145));
      const liftOffset = (1 - lift) * 7;

      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;
      const boxW = rightX - leftX;
      const topY = upperCy - m.slotH * 0.62 - liftOffset;
      const botY = lowerCy + m.slotH * 0.62 - liftOffset;
      const boxH = botY - topY;

      return { t, leftX, rightX, topY, botY, boxW, boxH };
    };

    /**
     * 4. OPEN CUBE — Directional Hollow-Frame Cast Shadow
     * Extrudes all 4 individual carcass walls so light passes naturally through the open hollow center
     * while the top and left walls cast subtle directional shadows into the opening.
     */
    const drawOpenCubeIsoShadow = (
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
      const c = getOpenCubeMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const innerX = c.leftX + c.t;
      const innerW = Math.max(8, c.boxW - c.t * 2);
      const depth = Math.min(c.boxH, m.pitchY * 1.45) * 0.44 * lift;
      const dx = depth * LIGHT_KX;
      const dy = depth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();
      // Left vertical wall shadow
      appendExtrudedBoxShadowPath(c.leftX, c.topY, c.t, c.boxH, dx, dy, 0);
      // Right vertical wall shadow
      appendExtrudedBoxShadowPath(c.rightX - c.t, c.topY, c.t, c.boxH, dx, dy, 0);
      // Top horizontal board shadow (casts softly into upper interior cavity)
      appendExtrudedBoxShadowPath(innerX, c.topY, innerW, c.t, dx, dy, 0);
      // Bottom horizontal board shadow
      appendExtrudedBoxShadowPath(innerX, c.botY - c.t, innerW, c.t, dx, dy, 0);

      fillDirectionalCastShadow(
        c.leftX + c.t * 0.5,
        c.topY + c.t * 0.5,
        c.rightX + dx,
        c.botY + dy,
        lift,
        8
      );
      ctx.restore();
    };

    /**
     * 4. OPEN CUBE — Strict Pure 2D Orthographic Front Elevation (min 3×3 hooks)
     * Matches Cabinet carcass geometry exactly: pure 100% 13-ply Baltic Birch 4-sided frame with
     * butt-joint vertical sides and a completely open hollow back revealing the mortise wall behind it.
     */
    const drawOpenCube = (
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
      const grainSeed = seed || gx1 * 13 + gx2 * 19 + gy1 * 23 + gy2 * 31;
      const c = getOpenCubeMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const innerX = c.leftX + c.t;
      const innerY = c.topY + c.t;
      const innerW = Math.max(18, c.boxW - c.t * 2);
      const innerH = Math.max(18, c.boxH - c.t * 2);

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
        // Hollow 2D frame ghost fill (even-odd cutout keeps center transparent)
        ctx.beginPath();
        ctx.rect(c.leftX, c.topY, c.boxW, c.boxH);
        ctx.rect(innerX, innerY, innerW, innerH);
        ctx.fillStyle = '#EAD8BD';
        ctx.fill('evenodd');
      } else {
        // Exposed 13-Ply Baltic Birch 4-Sided Outer Carcass (Full-Height Vertical Sides + Inset Top/Bottom)
        drawBirchEdge(c.leftX, c.topY, c.t, c.boxH, 'vertical', grainSeed + 1);
        drawBirchEdge(c.rightX - c.t, c.topY, c.t, c.boxH, 'vertical', grainSeed + 2);
        drawBirchEdge(innerX, c.topY, innerW, c.t, 'horizontal', grainSeed + 3);
        drawBirchEdge(innerX, innerY + innerH, innerW, c.t, 'horizontal', grainSeed + 4);
      }

      // Crisp Architectural CAD Ink Outlines (Outer Frame)
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.9;
      ctx.strokeRect(c.leftX, c.topY, c.boxW, c.boxH);

      ctx.setLineDash([]);
      // Butt-joint vertical side seams
      ctx.beginPath();
      ctx.moveTo(innerX, c.topY);
      ctx.lineTo(innerX, c.botY);
      ctx.moveTo(innerX + innerW, c.topY);
      ctx.lineTo(innerX + innerW, c.botY);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.05 : 1.45;
      ctx.stroke();

      // Crisp open-cavity inner frame outline
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.15 : 1.7;
      ctx.strokeRect(innerX, innerY, innerW, innerH);

      ctx.restore();
    };

    /**
     * Shared geometry helper for the Baltic Birch Wall Shelf (Image 2) + Architectural Potted Plant.
     */
    const getWallShelfMetrics = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      seed: number
    ) => {
      const t = m.slotW * 0.857;
      const r = m.slotW * 0.143;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const liftOffset = (1 - lift) * 6;

      // Flat cantilevered shelf sits cleanly on lower row gy2, leaving gy1 clear for the potted plant
      const shelfTopY = lowerCy - m.slotH * 0.2 - liftOffset;
      const shelfH = Math.max(8, t * 0.96);
      const shelfBotY = shelfTopY + shelfH;
      const shelfLeftX = leftCx - t * 1.1;
      const shelfRightX = rightCx + t * 1.1;
      const shelfW = shelfRightX - shelfLeftX;

      // Twin CNC hook ears rising slightly above shelf & tapered under-shelf brackets below
      const earW = t * 0.86;
      const earH = m.slotH * 0.42;
      const earTopY = shelfTopY - earH;
      const corbelW = t * 0.88;
      const corbelH = m.slotH * 0.86;

      // Architectural potted plant resting directly on shelfTopY
      const spanInner = Math.max(36, rightCx - leftCx - earW * 2);
      const plantSideBias = Math.abs(seed) % 2 === 0 ? 0.38 : 0.62;
      const plantCx = leftCx + earW + spanInner * plantSideBias;
      const potW = Math.max(24, Math.min(44, m.pitchX * 0.56));
      const potH = Math.max(22, Math.min(38, m.pitchY * 0.36));
      const saucerH = 3.6;
      const potBotY = shelfTopY - saucerH;
      const potTopY = potBotY - potH;
      const foliageTopLimitY = upperCy - m.slotH * 0.38 - liftOffset;
      const plantVariant = Math.abs(seed) % 2;

      return {
        t,
        r,
        leftCx,
        rightCx,
        upperCy,
        lowerCy,
        shelfTopY,
        shelfH,
        shelfBotY,
        shelfLeftX,
        shelfRightX,
        shelfW,
        earW,
        earH,
        earTopY,
        corbelW,
        corbelH,
        plantCx,
        potW,
        potH,
        saucerH,
        potBotY,
        potTopY,
        foliageTopLimitY,
        plantVariant,
      };
    };

    /**
     * Traces clean architectural CAD-style plant foliage blades/leaves for both body and cast-shadow paths.
     */
    const getPlantLeaves = (
      plantCx: number,
      potTopY: number,
      potW: number,
      foliageTopLimitY: number,
      variant: number
    ) => {
      const availH = Math.max(32, potTopY - foliageTopLimitY);
      if (variant === 0) {
        // Variant A: Sculptural architectural Rubber / Fiddle-Leaf plant (stems + broad oval CAD leaves)
        const baseY = potTopY + 1;
        return {
          kind: 'broad' as const,
          leaves: [
            {
              sx: plantCx - potW * 0.12,
              sy: baseY,
              ex: plantCx - potW * 0.62,
              ey: baseY - availH * 0.44,
              rx: potW * 0.34,
              ry: availH * 0.16,
              ang: -0.58,
              fill: '#4C7357',
            },
            {
              sx: plantCx + potW * 0.12,
              sy: baseY,
              ex: plantCx + potW * 0.64,
              ey: baseY - availH * 0.48,
              rx: potW * 0.33,
              ry: availH * 0.16,
              ang: 0.56,
              fill: '#43684E',
            },
            {
              sx: plantCx - potW * 0.06,
              sy: baseY,
              ex: plantCx - potW * 0.42,
              ey: baseY - availH * 0.78,
              rx: potW * 0.32,
              ry: availH * 0.17,
              ang: -0.34,
              fill: '#5E8A6A',
            },
            {
              sx: plantCx + potW * 0.08,
              sy: baseY,
              ex: plantCx + potW * 0.4,
              ey: baseY - availH * 0.76,
              rx: potW * 0.3,
              ry: availH * 0.16,
              ang: 0.34,
              fill: '#6E9979',
            },
            {
              sx: plantCx,
              sy: baseY,
              ex: plantCx - potW * 0.02,
              ey: baseY - availH * 0.96,
              rx: potW * 0.29,
              ry: availH * 0.18,
              ang: -0.05,
              fill: '#578263',
            },
          ],
        };
      }

      // Variant B: Architectural Snake Plant (Sansevieria) — crisp overlapping tapered sword blades
      const baseY = potTopY + 1;
      return {
        kind: 'sword' as const,
        blades: [
          {
            bx: plantCx - potW * 0.24,
            tx: plantCx - potW * 0.44,
            ty: baseY - availH * 0.66,
            w: potW * 0.2,
            fill: '#466D52',
          },
          {
            bx: plantCx + potW * 0.24,
            tx: plantCx + potW * 0.44,
            ty: baseY - availH * 0.62,
            w: potW * 0.2,
            fill: '#4A7256',
          },
          {
            bx: plantCx - potW * 0.12,
            tx: plantCx - potW * 0.19,
            ty: baseY - availH * 0.92,
            w: potW * 0.22,
            fill: '#5D8969',
          },
          {
            bx: plantCx + potW * 0.12,
            tx: plantCx + potW * 0.21,
            ty: baseY - availH * 0.84,
            w: potW * 0.21,
            fill: '#6D9878',
          },
          {
            bx: plantCx,
            tx: plantCx + potW * 0.02,
            ty: baseY - availH * 1.02,
            w: potW * 0.23,
            fill: '#527C5E',
          },
        ],
      };
    };

    /**
     * 5. WALL SHELF — Cast Shadow
     * Flat cantilevered Baltic Birch shelf board + rear hook ears + under-shelf corbel brackets + potted plant shadow.
     */
    const drawWallShelfIsoShadow = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      seed = 0,
      showProps = true
    ) => {
      if (lift <= 0.02) return;
      const grainSeed = seed || gx1 * 11 + gx2 * 17 + gy1 * 23;
      const s = getWallShelfMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy, grainSeed);
      const shelfDepth = m.pitchY * 0.56 * lift;
      const dx = shelfDepth * LIGHT_KX;
      const dy = shelfDepth * LIGHT_KY;

      const corbelDepth = shelfDepth * 0.72;
      const cdx = corbelDepth * LIGHT_KX;
      const cdy = corbelDepth * LIGHT_KY;

      const plantDepth = shelfDepth * 0.52;
      const pdx = plantDepth * LIGHT_KX;
      const pdy = plantDepth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();

      // Rear mounting ears shadow
      appendExtrudedBoxShadowPath(
        s.leftCx - s.earW * 0.5,
        s.earTopY,
        s.earW,
        s.earH,
        dx * 0.22,
        dy * 0.22,
        s.r
      );
      appendExtrudedBoxShadowPath(
        s.rightCx - s.earW * 0.5,
        s.earTopY,
        s.earW,
        s.earH,
        dx * 0.22,
        dy * 0.22,
        s.r
      );

      // Under-shelf corbel brackets shadow
      appendExtrudedBoxShadowPath(
        s.leftCx - s.corbelW * 0.5,
        s.shelfBotY,
        s.corbelW,
        s.corbelH,
        cdx,
        cdy,
        s.r
      );
      appendExtrudedBoxShadowPath(
        s.rightCx - s.corbelW * 0.5,
        s.shelfBotY,
        s.corbelW,
        s.corbelH,
        cdx,
        cdy,
        s.r
      );

      // Main cantilevered horizontal shelf board shadow
      appendExtrudedBoxShadowPath(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH, dx, dy, 0);

      // Architectural potted plant cast shadow (when props enabled)
      if (showProps) {
        const potHalfTop = s.potW * 0.5;
        const potHalfBot = s.potW * 0.42;
        ctx.moveTo(s.plantCx - potHalfTop + pdx, s.potTopY + pdy);
        ctx.lineTo(s.plantCx + potHalfTop + pdx, s.potTopY + pdy);
        ctx.lineTo(s.plantCx + potHalfBot + pdx, s.shelfTopY + pdy);
        ctx.lineTo(s.plantCx - potHalfBot + pdx, s.shelfTopY + pdy);
        ctx.closePath();

        const foliage = getPlantLeaves(
          s.plantCx,
          s.potTopY,
          s.potW,
          s.foliageTopLimitY,
          s.plantVariant
        );
        if (foliage.kind === 'broad') {
          for (const lf of foliage.leaves) {
            ctx.moveTo(lf.ex + pdx + lf.rx, lf.ey + pdy);
            ctx.ellipse(lf.ex + pdx, lf.ey + pdy, lf.rx, lf.ry, lf.ang, 0, Math.PI * 2);
            ctx.closePath();
          }
        } else {
          for (const bl of foliage.blades) {
            ctx.moveTo(bl.bx - bl.w * 0.5 + pdx, s.potTopY + pdy);
            ctx.lineTo(bl.tx + pdx, bl.ty + pdy);
            ctx.lineTo(bl.bx + bl.w * 0.5 + pdx, s.potTopY + pdy);
            ctx.closePath();
          }
        }
      }

      fillDirectionalCastShadow(
        s.shelfLeftX,
        showProps ? s.foliageTopLimitY : s.earTopY,
        s.shelfRightX + dx,
        s.shelfBotY + s.corbelH + cdy,
        lift,
        7
      );
      ctx.restore();
    };

    /**
     * 5. WALL SHELF — Pure 2D Architectural Elevation (100% Baltic Birch + Architectural Potted Plant)
     * Matches uploaded Reference Image 2: horizontal cantilevered 13-ply Baltic Birch shelf,
     * twin rounded rear CNC hook ears peeking above, twin under-shelf CNC Baltic Birch corbel brackets,
     * and a clean CAD/Bauhaus-styled architectural potted plant resting on top of the shelf.
     */
    const drawWallShelf = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean,
      seed = 0,
      showProps = true
    ) => {
      const grainSeed = seed || gx1 * 11 + gx2 * 17 + gy1 * 23;
      const s = getWallShelfMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy, grainSeed);

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      // 1. Twin Rear Rounded-Top CNC Baltic Birch Mounting Ears Peeking Above the Shelf (per Image 2)
      const drawEar = (cx: number, bSeed: number) => {
        const ex = cx - s.earW * 0.5;
        const topR = Math.min(s.earW * 0.48, s.earH * 0.48);
        ctx.beginPath();
        ctx.moveTo(ex, s.shelfTopY + 0.5);
        ctx.lineTo(ex, s.earTopY + topR);
        ctx.quadraticCurveTo(ex, s.earTopY, ex + topR, s.earTopY);
        ctx.lineTo(ex + s.earW - topR, s.earTopY);
        ctx.quadraticCurveTo(ex + s.earW, s.earTopY, ex + s.earW, s.earTopY + topR);
        ctx.lineTo(ex + s.earW, s.shelfTopY + 0.5);
        ctx.closePath();

        if (isGhost) {
          ctx.fillStyle = '#E8D5B5';
          ctx.fill();
        } else {
          ctx.save();
          ctx.clip();
          drawBirchEdge(ex, s.earTopY, s.earW, s.earH + 1, 'vertical', bSeed);
          // Subtle shadow where ear meets back of shelf
          ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
          ctx.fillRect(ex, s.shelfTopY - 2.5, s.earW, 3);
          ctx.restore();
        }

        ctx.beginPath();
        ctx.moveTo(ex, s.shelfTopY);
        ctx.lineTo(ex, s.earTopY + topR);
        ctx.quadraticCurveTo(ex, s.earTopY, ex + topR, s.earTopY);
        ctx.lineTo(ex + s.earW - topR, s.earTopY);
        ctx.quadraticCurveTo(ex + s.earW, s.earTopY, ex + s.earW, s.earTopY + topR);
        ctx.lineTo(ex + s.earW, s.shelfTopY);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.25 : 1.7;
        ctx.stroke();
      };
      drawEar(s.leftCx, grainSeed + 3);
      drawEar(s.rightCx, grainSeed + 7);

      // 2. Twin Under-Shelf CNC Baltic Birch Corbel Brackets Directly Below the Shelf Board
      const drawCorbel = (cx: number, bSeed: number) => {
        const bx = cx - s.corbelW * 0.5;
        const botR = Math.min(s.corbelW * 0.32, s.corbelH * 0.25);
        ctx.beginPath();
        ctx.moveTo(bx, s.shelfBotY - 0.5);
        ctx.lineTo(bx + s.corbelW, s.shelfBotY - 0.5);
        ctx.lineTo(bx + s.corbelW, s.shelfBotY + s.corbelH - botR);
        ctx.quadraticCurveTo(
          bx + s.corbelW,
          s.shelfBotY + s.corbelH,
          bx + s.corbelW - botR,
          s.shelfBotY + s.corbelH
        );
        ctx.lineTo(bx + botR, s.shelfBotY + s.corbelH);
        ctx.quadraticCurveTo(
          bx,
          s.shelfBotY + s.corbelH,
          bx,
          s.shelfBotY + s.corbelH - botR
        );
        ctx.closePath();

        if (isGhost) {
          ctx.fillStyle = '#E8D5B5';
          ctx.fill();
        } else {
          ctx.save();
          ctx.clip();
          drawBirchEdge(bx, s.shelfBotY, s.corbelW, s.corbelH, 'vertical', bSeed);
          // Crisp contact shadow cast directly under the cantilevered shelf lip
          const underAO = ctx.createLinearGradient(0, s.shelfBotY, 0, s.shelfBotY + 8);
          underAO.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
          underAO.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = underAO;
          ctx.fillRect(bx, s.shelfBotY, s.corbelW, 8);
          ctx.restore();
        }

        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.25 : 1.7;
        ctx.stroke();
      };
      drawCorbel(s.leftCx, grainSeed + 11);
      drawCorbel(s.rightCx, grainSeed + 15);

      // 3. Architectural Potted Plant Sitting Flush on Top of the Wall Shelf (Optional Prop)
      if (showProps) {
      const foliage = getPlantLeaves(
        s.plantCx,
        s.potTopY,
        s.potW,
        s.foliageTopLimitY,
        s.plantVariant
      );

      // 3A. Foliage (drawn cleanly behind pot rim)
      if (foliage.kind === 'broad') {
        // Crisp stems
        for (const lf of foliage.leaves) {
          ctx.beginPath();
          ctx.moveTo(lf.sx, lf.sy);
          ctx.quadraticCurveTo(
            (lf.sx + lf.ex) * 0.5,
            (lf.sy + lf.ey) * 0.5 + 4,
            lf.ex,
            lf.ey
          );
          ctx.strokeStyle = COLORS.black;
          ctx.lineWidth = isGhost ? 1.1 : 1.55;
          ctx.stroke();
        }

        // Crisp sculptural architectural leaves with midrib vein & subtle studio shading
        for (const lf of foliage.leaves) {
          ctx.save();
          ctx.translate(lf.ex, lf.ey);
          ctx.rotate(lf.ang);

          ctx.beginPath();
          ctx.ellipse(0, 0, lf.rx, lf.ry, 0, 0, Math.PI * 2);
          ctx.fillStyle = isGhost ? '#B8CBB9' : lf.fill;
          ctx.fill();

          if (!isGhost) {
            ctx.save();
            ctx.clip();
            const leafGrad = ctx.createLinearGradient(-lf.rx, -lf.ry, lf.rx, lf.ry);
            leafGrad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
            leafGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
            leafGrad.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
            ctx.fillStyle = leafGrad;
            ctx.fillRect(-lf.rx, -lf.ry, lf.rx * 2, lf.ry * 2);
            ctx.restore();

            // Delicate CAD central leaf vein
            ctx.beginPath();
            ctx.moveTo(-lf.rx * 0.72, 0);
            ctx.lineTo(lf.rx * 0.62, 0);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.34)';
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.ellipse(0, 0, lf.rx, lf.ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = COLORS.black;
          ctx.lineWidth = isGhost ? 1.05 : 1.45;
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Architectural Snake Plant (Sansevieria) upright tapered blades
        for (const bl of foliage.blades) {
          const midX = (bl.bx + bl.tx) * 0.5;
          const midY = (s.potTopY + bl.ty) * 0.5;
          ctx.beginPath();
          ctx.moveTo(bl.bx - bl.w * 0.52, s.potTopY + 1);
          ctx.quadraticCurveTo(midX - bl.w * 0.62, midY, bl.tx, bl.ty);
          ctx.quadraticCurveTo(midX + bl.w * 0.62, midY, bl.bx + bl.w * 0.52, s.potTopY + 1);
          ctx.closePath();

          ctx.fillStyle = isGhost ? '#B8CBB9' : bl.fill;
          ctx.fill();

          if (!isGhost) {
            ctx.save();
            ctx.clip();
            const blGrad = ctx.createLinearGradient(
              bl.bx - bl.w,
              bl.ty,
              bl.bx + bl.w,
              s.potTopY
            );
            blGrad.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
            blGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
            blGrad.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
            ctx.fillStyle = blGrad;
            ctx.fillRect(
              Math.min(bl.bx, bl.tx) - bl.w,
              bl.ty,
              Math.abs(bl.bx - bl.tx) + bl.w * 2.5,
              s.potTopY - bl.ty + 2
            );
            ctx.restore();
          }

          ctx.strokeStyle = COLORS.black;
          ctx.lineWidth = isGhost ? 1.05 : 1.45;
          ctx.stroke();
        }
      }

      // 3B. Modern Cylindrical Matte Ceramic Planter Pot + Matching Slim Saucer
      const potHalfTop = s.potW * 0.5;
      const potHalfBot = s.potW * 0.42;
      const isTerracotta = Math.abs(grainSeed) % 3 === 0;
      const potBaseFill = isGhost ? '#EFECE6' : isTerracotta ? '#D2794B' : '#F3F1EB';

      // Slim ceramic saucer sitting flush on shelfTopY
      const saucerW = s.potW * 0.94;
      const saucerX = s.plantCx - saucerW * 0.5;
      const saucerY = s.shelfTopY - s.saucerH;
      drawRoundRect(saucerX, saucerY, saucerW, s.saucerH, 1.4);
      ctx.fillStyle = potBaseFill;
      ctx.fill();
      if (!isGhost) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(saucerX + saucerW * 0.52, saucerY, saucerW * 0.48, s.saucerH);
      }
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.05 : 1.45;
      ctx.stroke();

      // Tapered architectural ceramic vessel body
      const tracePotPath = () => {
        ctx.beginPath();
        ctx.moveTo(s.plantCx - potHalfTop, s.potTopY);
        ctx.lineTo(s.plantCx + potHalfTop, s.potTopY);
        ctx.lineTo(s.plantCx + potHalfBot, s.potBotY);
        ctx.lineTo(s.plantCx - potHalfBot, s.potBotY);
        ctx.closePath();
      };

      tracePotPath();
      ctx.fillStyle = potBaseFill;
      ctx.fill();

      if (!isGhost) {
        ctx.save();
        tracePotPath();
        ctx.clip();
        // Clean upper-left cylindrical gallery shading
        const potGrad = ctx.createLinearGradient(
          s.plantCx - potHalfTop,
          0,
          s.plantCx + potHalfTop,
          0
        );
        potGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.22)');
        potGrad.addColorStop(0.32, 'rgba(255, 255, 255, 0.06)');
        potGrad.addColorStop(0.72, 'rgba(0, 0, 0, 0.04)');
        potGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.18)');
        ctx.fillStyle = potGrad;
        ctx.fillRect(s.plantCx - potHalfTop, s.potTopY, s.potW, s.potH);

        // Subtle architectural grooved collar band near top rim
        const collarY = s.potTopY + Math.max(4.5, s.potH * 0.22);
        ctx.beginPath();
        ctx.moveTo(s.plantCx - potHalfTop, collarY);
        ctx.lineTo(s.plantCx + potHalfTop, collarY);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1.0;
        ctx.stroke();
        ctx.restore();
      }

      tracePotPath();
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.15 : 1.6;
      ctx.stroke();
      }

      // 4. Main Horizontal Cantilevered 13-Ply Baltic Birch Shelf Board (Front Edge)
      ctx.setLineDash([]);
      if (isGhost) {
        ctx.fillStyle = '#E8D5B5';
        ctx.fillRect(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH);
      } else {
        drawBirchEdge(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH, 'horizontal', grainSeed + 1);
        // Subtle crisp top sheen & bottom edge depth
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(s.shelfLeftX + 1, s.shelfTopY + 0.8, Math.max(0, s.shelfW - 2), 1.4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(s.shelfLeftX + 1, s.shelfBotY - 1.8, Math.max(0, s.shelfW - 2), 1.4);
      }
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.85;
      ctx.strokeRect(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH);

      ctx.restore();
    };

    /**
     * 6. VINYL BOX — Cast Shadow
     * 3-sided open-top Baltic Birch plywood U-box (left wall, right wall, bottom floor — exact Shelf + Rod height)
     * + cast shadow of the properly scaled edge-on 12" vinyl records standing inside.
     */
    const drawVinylBoxIsoShadow = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      showProps = true
    ) => {
      if (lift <= 0.02) return;
      const t = m.slotW * 0.857;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const liftOffset = (1 - lift) * 6;

      // Exact same topY and botY as Shelf + Rod
      const topY = upperCy + m.slotH * 0.04 - liftOffset;
      const botY = lowerCy + m.slotH * 0.11 - liftOffset;
      const boxH = botY - topY;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;
      const innerLeft = leftX + t;
      const innerRight = rightX - t;
      const innerBot = botY - t;
      const innerSpan = Math.max(0, innerRight - innerLeft);

      // 12" records peek cleanly above the open-top 3-sided U-box
      const recordTopY = upperCy - m.slotH * 0.32 - liftOffset;
      const recordH = Math.max(20, innerBot - recordTopY);
      const packedW = Math.max(0, innerSpan * 0.78);

      const boxDepth = Math.min(boxH, m.pitchY * 1.15) * 0.62 * lift;
      const dx = boxDepth * LIGHT_KX;
      const dy = boxDepth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();
      // Left & right vertical birch side walls
      appendExtrudedBoxShadowPath(leftX, topY, t, boxH, dx, dy, 0);
      appendExtrudedBoxShadowPath(rightX - t, topY, t, boxH, dx, dy, 0);
      // Bottom horizontal birch floor board
      appendExtrudedBoxShadowPath(innerLeft, innerBot, innerSpan, t, dx, dy, 0);
      // Standing edge-on 12" vinyl record stack shadow (when props enabled)
      if (showProps && packedW > 6) {
        appendExtrudedBoxShadowPath(innerLeft + 1, recordTopY, packedW, recordH, dx * 0.88, dy * 0.88, 0);
      }
      fillDirectionalCastShadow(leftX, showProps ? recordTopY : topY, rightX + dx, botY + dy, lift, 8);
      ctx.restore();
    };

    /**
     * 6. VINYL BOX — Pure 2D Architectural Elevation (3-Sided Open-Top Baltic Birch Box + Monotone 12" LPs)
     * 5 hooks wide by default, exact same height as Shelf + Rod. Three exposed 13-ply Baltic Birch boards only
     * (left wall, right wall, bottom floor — open top, no center divider) holding calm, monotone edge-on
     * 12" vinyl record sleeves side-by-side when props are enabled.
     */
    const drawVinylBox = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean,
      seed = 0,
      showProps = true
    ) => {
      const t = m.slotW * 0.857;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const liftOffset = (1 - lift) * 6;
      const grainSeed = seed || gx1 * 7 + gx2 * 13 + gy1 * 19 + gy2 * 23;

      // Exact same height (topY..botY) as Shelf + Rod
      const topY = upperCy + m.slotH * 0.04 - liftOffset;
      const botY = lowerCy + m.slotH * 0.11 - liftOffset;
      const boxH = botY - topY;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;

      const innerLeft = leftX + t;
      const innerRight = rightX - t;
      const innerBot = botY - t;
      const innerSpan = Math.max(0, innerRight - innerLeft);

      // Properly scaled 12" LP record height resting on bottom floor, rising cleanly proud through the open top
      const recordTopY = upperCy - m.slotH * 0.32 - liftOffset;
      const baseRecordH = Math.max(24, innerBot - recordTopY);

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      // 1. Calm Monotone Edge-On 12" Vinyl Record Sleeves Side-by-Side (Optional Prop)
      if (showProps && innerSpan > 22 && baseRecordH > 16) {
        // Understated architectural monotone paper & concrete-gray sleeve palette
        const spinePalette = [
          '#F5F4F0', // gallery white
          '#ECEBE6', // soft chalk
          '#E2E1DC', // warm light gray
          '#D8D7D2', // pale concrete
          '#F1F0EC', // bone white
          '#CECDC8', // stone gray
          '#E7E6E1', // parchment gray
          '#DCDBD6', // light architectural gray
        ] as const;

        const hash = (n: number) => {
          const v = Math.sin(n * 127.1 + grainSeed * 311.7) * 43758.5453;
          return v - Math.floor(v);
        };

        // Calm, steady edge-on LP spine thicknesses scaled cleanly to 3/4" birch thickness t
        const minSpineW = Math.max(3.2, t * 0.24);
        const spineRangeW = Math.max(1.3, t * 0.11);

        const drawSpineRect = (
          x: number,
          y: number,
          w: number,
          h: number,
          idx: number
        ) => {
          const fill = isGhost
            ? idx % 2 === 0
              ? '#ECEBE6'
              : '#DFDED9'
            : spinePalette[Math.abs(grainSeed + idx * 3) % spinePalette.length];
          ctx.fillStyle = fill;
          ctx.fillRect(x, y, w, h);

          if (!isGhost) {
            // Whisper-subtle upper-left paper edge highlight for crisp 2D depth
            ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
            ctx.fillRect(x + 0.5, y + 0.5, Math.max(0.75, w * 0.22), Math.max(0, h - 1));
          }

          ctx.strokeStyle = isGhost ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.72)';
          ctx.lineWidth = isGhost ? 0.7 : 0.85;
          ctx.strokeRect(x, y, w, h);
        };

        ctx.save();
        ctx.beginPath();
        ctx.rect(innerLeft + 0.5, recordTopY - 6, innerSpan - 1, innerBot - (recordTopY - 6));
        ctx.clip();

        // Pack tidy upright edge-on LP spines side-by-side from left wall across ~76% of open span
        const openGap = Math.max(24, innerSpan * 0.23);
        const limitX = innerRight - openGap;
        let cursor = innerLeft + 0.6;
        let idx = 0;

        while (cursor < limitX - minSpineW) {
          const rw = minSpineW + hash(idx * 7 + 11) * spineRangeW;
          const w = Math.min(rw, limitX - cursor);
          if (w < minSpineW * 0.85) break;
          const hJitter = (hash(idx * 13 + 5) - 0.5) * 0.9;
          const rh = Math.max(22, baseRecordH + hJitter);
          const ry = innerBot - rh;
          drawSpineRect(cursor, ry, w, rh, idx);
          cursor += w;
          idx++;
        }

        // 2 gently leaning edge-on 12" sleeves resting naturally against the upright stack
        let leanBaseX = cursor + 1.4;
        for (let li = 0; li < 2; li++) {
          const lw = minSpineW + hash((idx + li) * 11) * (spineRangeW * 0.7);
          const lh = baseRecordH - 0.6;
          const tiltRad = 0.14 + li * 0.06;
          const topShiftX = Math.sin(tiltRad) * lh;
          if (leanBaseX + lw + topShiftX > innerRight - 2.5) break;

          ctx.save();
          const bottomPivotX = leanBaseX + topShiftX;
          ctx.translate(bottomPivotX, innerBot);
          ctx.rotate(-tiltRad);
          drawSpineRect(0, -lh, lw, lh, idx + 5 + li);
          ctx.restore();

          leanBaseX += lw + 2.0;
        }

        // Subtle resting AO line right where the records sit on the bottom Baltic Birch shelf
        if (!isGhost) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(innerLeft, innerBot - 2.0, innerSpan, 2.0);
        }
        ctx.restore();
      }

      // 2. Bottom Horizontal Exposed 13-Ply Baltic Birch Floor Board (Open Top — No Top Board, No Divider)
      if (innerSpan > 2) {
        if (isGhost) {
          ctx.fillStyle = '#E8D5B5';
          ctx.fillRect(innerLeft, innerBot, innerSpan, t);
        } else {
          drawBirchEdge(innerLeft, innerBot, innerSpan, t, 'horizontal', grainSeed + 17);
        }
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.3 : 1.75;
        ctx.strokeRect(innerLeft, innerBot, innerSpan, t);
      }

      // 3. Full-Height Left & Right Vertical Exposed 13-Ply Baltic Birch Side Walls (3-Sided U-Profile)
      const drawSideWall = (bx: number, bSeed: number) => {
        if (isGhost) {
          ctx.fillStyle = '#E8D5B5';
          ctx.fillRect(bx, topY, t, boxH);
        } else {
          drawBirchEdge(bx, topY, t, boxH, 'vertical', bSeed);
        }
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.4 : 1.85;
        ctx.strokeRect(bx, topY, t, boxH);
      };
      drawSideWall(leftX, grainSeed + 5);
      drawSideWall(rightX - t, grainSeed + 9);

      ctx.restore();
    };

    /**
     * Shared geometry helper for the Sleek Linear Baltic Birch Wall Sconce (2..6 cols × 1 row, wire-free).
     * Thin architectural horizontal piece of wood with a full-length recessed LED light channel across the face.
     */
    const getWallSconceMetrics = (
      gx1: number,
      gx2: number,
      gy1: number,
      _gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number
    ) => {
      const t = m.slotW * 0.857;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const liftOffset = (1 - lift) * 5;

      const leftX = leftCx - t * 0.85;
      const rightX = rightCx + t * 0.85;
      const barW = Math.max(48, rightX - leftX);
      const barH = Math.max(15, Math.min(21, m.slotH * 0.54));
      const barTopY = upperCy - barH * 0.5 - liftOffset;
      const barBotY = barTopY + barH;

      // Full-length recessed frosted LED channel milled cleanly across the thin wood bar
      const endCap = Math.max(4.5, Math.min(7, barH * 0.34));
      const ledX = leftX + endCap;
      const ledW = Math.max(16, barW - endCap * 2);
      const ledH = Math.max(5.2, Math.min(7.5, barH * 0.36));
      const ledY = barTopY + (barH - ledH) * 0.5;

      return {
        leftCx,
        rightCx,
        upperCy,
        leftX,
        rightX,
        barW,
        barH,
        barTopY,
        barBotY,
        ledX,
        ledY,
        ledW,
        ledH,
      };
    };

    /**
     * 7A. WALL SCONCE — Sleek Linear Architectural Up & Down Grazing Wall Light Wash (Pass 0)
     * Casts a generous, unmistakable warm-white/soft-gold wash upward and downward across the full length
     * of the thin wood sconce bar when lit; turns completely off when clicked.
     */
    const drawWallSconceLightWash = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      lit: boolean
    ) => {
      if (!lit || lift <= 0.05) return;
      const sc = getWallSconceMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const upReach = Math.max(m.pitchY * 0.96, 78);
      const downReach = Math.max(m.pitchY * 1.18, 96);
      const flareUp = Math.min(26, sc.barW * 0.14);
      const flareDown = Math.min(32, sc.barW * 0.16);
      const midX = (sc.leftX + sc.rightX) * 0.5;

      ctx.save();

      // 1. Wide Architectural Upward Wall Grazing Wash
      ctx.beginPath();
      ctx.moveTo(sc.ledX - 3, sc.barTopY + 2);
      ctx.lineTo(sc.ledX + sc.ledW + 3, sc.barTopY + 2);
      ctx.lineTo(sc.ledX + sc.ledW + flareUp, sc.barTopY - upReach);
      ctx.quadraticCurveTo(midX, sc.barTopY - upReach - 14, sc.ledX - flareUp, sc.barTopY - upReach);
      ctx.closePath();

      const upGrad = ctx.createLinearGradient(0, sc.barTopY, 0, sc.barTopY - upReach - 10);
      upGrad.addColorStop(0.0, `rgba(253, 203, 51, ${(0.38 * lift).toFixed(3)})`);
      upGrad.addColorStop(0.28, `rgba(253, 203, 51, ${(0.2 * lift).toFixed(3)})`);
      upGrad.addColorStop(0.65, `rgba(253, 203, 51, ${(0.065 * lift).toFixed(3)})`);
      upGrad.addColorStop(1.0, 'rgba(253, 203, 51, 0)');
      ctx.fillStyle = upGrad;
      ctx.fill();

      // 2. Wide Architectural Downward Wall Grazing Wash
      ctx.beginPath();
      ctx.moveTo(sc.ledX - 3, sc.barBotY - 2);
      ctx.lineTo(sc.ledX + sc.ledW + 3, sc.barBotY - 2);
      ctx.lineTo(sc.ledX + sc.ledW + flareDown, sc.barBotY + downReach);
      ctx.quadraticCurveTo(midX, sc.barBotY + downReach + 16, sc.ledX - flareDown, sc.barBotY + downReach);
      ctx.closePath();

      const downGrad = ctx.createLinearGradient(0, sc.barBotY, 0, sc.barBotY + downReach + 12);
      downGrad.addColorStop(0.0, `rgba(253, 203, 51, ${(0.42 * lift).toFixed(3)})`);
      downGrad.addColorStop(0.26, `rgba(253, 203, 51, ${(0.22 * lift).toFixed(3)})`);
      downGrad.addColorStop(0.64, `rgba(253, 203, 51, ${(0.075 * lift).toFixed(3)})`);
      downGrad.addColorStop(1.0, 'rgba(253, 203, 51, 0)');
      ctx.fillStyle = downGrad;
      ctx.fill();

      // 3. Soft Tight Luminous Warm-White Halo Hugging the Full Linear Bar
      const haloPadY = sc.barH * 1.35;
      const haloGrad = ctx.createLinearGradient(0, sc.barTopY - haloPadY, 0, sc.barBotY + haloPadY);
      haloGrad.addColorStop(0.0, 'rgba(255, 244, 196, 0)');
      haloGrad.addColorStop(0.42, `rgba(255, 242, 180, ${(0.46 * lift).toFixed(3)})`);
      haloGrad.addColorStop(0.58, `rgba(255, 242, 180, ${(0.46 * lift).toFixed(3)})`);
      haloGrad.addColorStop(1.0, 'rgba(255, 244, 196, 0)');
      ctx.fillStyle = haloGrad;
      drawRoundRect(
        sc.leftX - 10,
        sc.barTopY - haloPadY,
        sc.barW + 20,
        sc.barH + haloPadY * 2,
        haloPadY
      );
      ctx.fill();

      ctx.restore();
    };

    /**
     * 7B. WALL SCONCE — Subtle Floating Linear Cast Shadow
     * Clean thin extruded directional cast shadow projecting the sleek Baltic Birch bar off the mortise wall.
     */
    const drawWallSconceIsoShadow = (
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
      const sc = getWallSconceMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const depth = sc.barH * 0.72 * lift;
      const dx = depth * LIGHT_KX;
      const dy = depth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();
      appendExtrudedBoxShadowPath(sc.leftX, sc.barTopY, sc.barW, sc.barH, dx, dy, 1.5);
      fillDirectionalCastShadow(sc.leftX, sc.barTopY, sc.rightX + dx, sc.barBotY + dy, lift, 6);
      ctx.restore();
    };

    /**
     * 7C. WALL SCONCE — Pure 2D Architectural Elevation (Sleek Wire-Free Baltic Birch Bar + Full-Length Recessed LED)
     * Ultra-clean thin linear piece of Baltic Birch wood with a continuous recessed frosted LED strip
     * running all the way across the front face; zero wires visible; click anywhere on the bar to toggle light.
     */
    const drawWallSconce = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean,
      seed = 0,
      lit = true
    ) => {
      const grainSeed = seed || gx1 * 17 + gx2 * 23 + gy1 * 31;
      const sc = getWallSconceMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const isLit = !isGhost && lit;
      const r = 1.6;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      // 1. Sleek Thin Horizontal Baltic Birch Wood Bar
      if (isGhost) {
        drawRoundRect(sc.leftX, sc.barTopY, sc.barW, sc.barH, r);
        ctx.fillStyle = '#EAD8BD';
        ctx.fill();
      } else {
        ctx.save();
        drawRoundRect(sc.leftX, sc.barTopY, sc.barW, sc.barH, r);
        ctx.clip();

        // Warm natural pale Baltic Birch horizontal wood grain
        drawMapleFace(sc.leftX, sc.barTopY, sc.barW, sc.barH, 'horizontal', undefined, 0, grainSeed + 3);

        // Subtle architectural gallery bevel highlight along top edge & crisp bottom depth shadow
        const bevelGrad = ctx.createLinearGradient(0, sc.barTopY, 0, sc.barBotY);
        bevelGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.28)');
        bevelGrad.addColorStop(0.24, 'rgba(255, 255, 255, 0.04)');
        bevelGrad.addColorStop(0.76, 'rgba(0, 0, 0, 0.03)');
        bevelGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.16)');
        ctx.fillStyle = bevelGrad;
        ctx.fillRect(sc.leftX, sc.barTopY, sc.barW, sc.barH);

        // Warm subtle spill along milled wood bezel directly hugging the recessed LED channel when ON
        if (isLit) {
          const bezelGlow = ctx.createLinearGradient(0, sc.barTopY, 0, sc.barBotY);
          bezelGlow.addColorStop(0.0, 'rgba(253, 203, 51, 0)');
          bezelGlow.addColorStop(0.32, 'rgba(253, 203, 51, 0.26)');
          bezelGlow.addColorStop(0.68, 'rgba(253, 203, 51, 0.26)');
          bezelGlow.addColorStop(1.0, 'rgba(253, 203, 51, 0)');
          ctx.fillStyle = bezelGlow;
          ctx.fillRect(sc.ledX - 2, sc.barTopY, sc.ledW + 4, sc.barH);
        }

        ctx.restore();
      }

      // Crisp Black CAD Outer Frame
      drawRoundRect(sc.leftX, sc.barTopY, sc.barW, sc.barH, r);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.35 : 1.85;
      ctx.stroke();

      // 2. Full-Length Recessed Frosted Acrylic LED Strip Channel
      const ledR = Math.min(1.2, sc.ledH * 0.25);
      ctx.setLineDash([]);
      drawRoundRect(sc.ledX, sc.ledY, sc.ledW, sc.ledH, ledR);

      if (isGhost) {
        ctx.fillStyle = '#FFF7D6';
        ctx.fill();
      } else if (isLit) {
        const ledGrad = ctx.createLinearGradient(0, sc.ledY, 0, sc.ledY + sc.ledH);
        ledGrad.addColorStop(0.0, '#FFE47E');
        ledGrad.addColorStop(0.3, '#FFFBE6');
        ledGrad.addColorStop(0.5, '#FFFFFF');
        ledGrad.addColorStop(0.7, '#FFFBE6');
        ledGrad.addColorStop(1.0, '#FFE06B');
        ctx.fillStyle = ledGrad;
        ctx.fill();
      } else {
        // Unlit matte frosted diffuser sitting recessed inside milled birch groove
        const offGrad = ctx.createLinearGradient(0, sc.ledY, 0, sc.ledY + sc.ledH);
        offGrad.addColorStop(0.0, '#C8C6C0');
        offGrad.addColorStop(0.28, '#E6E4DF');
        offGrad.addColorStop(1.0, '#F0EFEA');
        ctx.fillStyle = offGrad;
        ctx.fill();
      }

      // Crisp milled recess channel border lines
      ctx.strokeStyle = isLit ? 'rgba(0, 0, 0, 0.72)' : COLORS.black;
      ctx.lineWidth = isGhost ? 0.95 : 1.15;
      ctx.stroke();

      ctx.restore();
    };

    const drawItemShadow = (
      type: WallTool,
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      seed = 0,
      showProps = true
    ) => {
      switch (type) {
        case 'hook':
          drawWallHookIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy);
          break;
        case 'shelf':
          drawShelfIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy);
          break;
        case 'cabinet':
          drawCabinetIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy);
          break;
        case 'cubby':
          drawOpenCubeIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy);
          break;
        case 'wallShelf':
          drawWallShelfIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy, seed, showProps);
          break;
        case 'cradle':
          drawVinylBoxIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy, showProps);
          break;
        case 'sconce':
          drawWallSconceIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy);
          break;
      }
    };

    const drawItemBody = (
      type: WallTool,
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      isGhost: boolean,
      seed = 0,
      lit = true,
      showProps = true
    ) => {
      switch (type) {
        case 'hook':
          drawWallHook(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed);
          break;
        case 'shelf':
          drawShelfWithRod(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed);
          break;
        case 'cabinet':
          drawSlidingDoorCabinet(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed);
          break;
        case 'cubby':
          drawOpenCube(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed);
          break;
        case 'wallShelf':
          drawWallShelf(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, showProps);
          break;
        case 'cradle':
          drawVinylBox(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, showProps);
          break;
        case 'sconce':
          drawWallSconce(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, lit);
          break;
      }
    };

    const triggerRipple = (nx: number, ny: number) => {
      rippleX = nx;
      rippleY = ny;
      rippleTime = performance.now();
      ensureLoop();
    };

    /**
     * Generates a fresh randomized composition of `targetCount` (default 7) restrained Baltic Birch modular items
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

      const mMidX = (gx1: number, gx2: number) =>
        gridMeta.centerX + ((gx1 + gx2) * 0.5) * gridMeta.pitchX;

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

      // Balanced Baltic Birch architectural composition: Shelf + Rod, Cabinet, Open Cube, Wall Shelf w/ Plant, 5-Hook Vinyl Box & Hooks
      const cabinetSizePool: PieceSize[] = [
        { cols: 4, rows: 2 },
        { cols: 5, rows: 2 },
        { cols: 4, rows: 3 },
      ];
      const shelfSizePool: PieceSize[] = [
        { cols: 4, rows: 2 },
        { cols: 5, rows: 2 },
      ];
      const cubbySizePool: PieceSize[] = [
        { cols: 3, rows: 3 },
        { cols: 3, rows: 3 },
        { cols: 4, rows: 3 },
      ];
      const wallShelfSizePool: PieceSize[] = [
        { cols: 4, rows: 2 },
        { cols: 3, rows: 2 },
        { cols: 5, rows: 2 },
      ];
      const cradleSizePool: PieceSize[] = [
        { cols: 5, rows: 2 },
        { cols: 5, rows: 2 },
        { cols: 4, rows: 2 },
      ];
      const sconceSizePool: PieceSize[] = [
        { cols: 4, rows: 1 },
        { cols: 3, rows: 1 },
        { cols: 5, rows: 1 },
      ];
      const hookSizePool: PieceSize[] = [
        { cols: 1, rows: 1 },
        { cols: 2, rows: 1 },
        { cols: 3, rows: 1 },
      ];

      const recipeSpecs: Array<{
        type: WallTool;
        sizes: PieceSize[];
      }> = [
        { type: 'cabinet', sizes: [pickRandom(cabinetSizePool), { cols: 4, rows: 2 }] },
        { type: 'shelf', sizes: [pickRandom(shelfSizePool), { cols: 4, rows: 2 }] },
        { type: 'cradle', sizes: [pickRandom(cradleSizePool), { cols: 5, rows: 2 }, { cols: 4, rows: 2 }] },
        { type: 'cubby', sizes: [pickRandom(cubbySizePool), { cols: 3, rows: 3 }] },
        { type: 'wallShelf', sizes: [pickRandom(wallShelfSizePool), { cols: 3, rows: 2 }] },
        { type: 'sconce', sizes: [pickRandom(sconceSizePool), { cols: 3, rows: 1 }, { cols: 2, rows: 1 }] },
      ];

      // Shuffle order so left/right distribution feels organic on every Rearrange
      for (let i = recipeSpecs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [recipeSpecs[i], recipeSpecs[j]] = [recipeSpecs[j], recipeSpecs[i]];
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

      for (const spec of recipeSpecs) {
        if (placedItems.length >= targetCount) break;
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
          const fallbackSize = pickRandom(hookSizePool);
          if (
            tryPlaceRandomOfSize('hook', fallbackSize.cols, fallbackSize.rows, side) ||
            tryPlaceRandomOfSize('hook', 1, 1)
          ) {
            recordLastSide();
          }
        }
      }

      // Fill remaining slots up to targetCount with varied CNC J-Hooks
      let guard = 0;
      while (placedItems.length < targetCount && guard < 24) {
        guard++;
        const side = nextSide();
        const sz = pickRandom(hookSizePool);
        if (
          tryPlaceRandomOfSize('hook', sz.cols, sz.rows, side) ||
          tryPlaceRandomOfSize('hook', 1, 1, side) ||
          tryPlaceRandomOfSize('hook', 1, 1)
        ) {
          recordLastSide();
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
        showProps,
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
            if (item.type === 'shelf' || item.type === 'cradle') {
              if (gx === item.gx1 || gx === item.gx2) anchorKeys.add(k);
            } else if (item.type === 'wallShelf') {
              if (gy === item.gy2 && (gx === item.gx1 || gx === item.gx2)) anchorKeys.add(k);
            } else if (item.type === 'cubby') {
              if (
                (gx === item.gx1 || gx === item.gx2) &&
                (gy === item.gy1 || gy === item.gy2)
              ) {
                anchorKeys.add(k);
              }
            } else if (item.type === 'sconce') {
              if (gy === item.gy1 && (gx === item.gx1 || gx === item.gx2)) anchorKeys.add(k);
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
            // Mounted hardware stays rock-solid in its mortises (0 wobble) so birch/maple never shimmer around cursor
            const maxDisp = s.blocked ? 2.5 : isOccupied ? 0 : 10.2;
            const push = Math.pow(t, 1.35) * maxDisp;
            targetOx = (dx / dist) * push;
            targetOy = (dy / dist) * push;
            targetRot = isOccupied || s.blocked ? 0 : (dx / influenceR) * t * 0.16;
            targetHeat = s.blocked || isOccupied ? 0 : Math.min(1, t * 1.3);
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

      // Pass 0: Draw warm architectural Wall Sconce light washes onto the white mortise wall (behind slots & hardware)
      for (let i = 0; i < placedItems.length; i++) {
        const item = placedItems[i];
        if (item.id === draggedItemId || !isItemVisible(item) || item.type !== 'sconce') continue;
        drawWallSconceLightWash(
          item.gx1,
          item.gx2,
          item.gy1,
          item.gy2,
          m,
          item.lift,
          0,
          0,
          item.lit ?? true
        );
      }

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

      // Pass 1: Draw directional 3D cast shadows for all grounded items
      for (let i = 0; i < placedItems.length; i++) {
        const item = placedItems[i];
        if (item.id === draggedItemId || !isItemVisible(item)) continue;
        const ox = 0;
        const oy = 0;
        visibleItems.push({ item, ox, oy });
        drawItemShadow(
          item.type,
          item.gx1,
          item.gx2,
          item.gy1,
          item.gy2,
          m,
          item.lift,
          ox,
          oy,
          item.seed,
          item.hasProps ?? showProps
        );
      }

      // Pass 2: Draw grounded 2D front-elevation hardware cleanly on top of directional cast shadows
      for (let i = 0; i < visibleItems.length; i++) {
        const { item, ox, oy } = visibleItems[i];
        drawItemBody(
          item.type,
          item.gx1,
          item.gx2,
          item.gy1,
          item.gy2,
          m,
          item.lift,
          ox,
          oy,
          false,
          item.seed,
          item.lit ?? true,
          item.hasProps ?? showProps
        );
      }

      // Pass 3: While dragging an existing item, show its magnetic snap target + lifted floating piece
      if (activeDrag && draggedItem) {
        const snap = activeDrag.snapRect;
        const draggedProps = draggedItem.hasProps ?? showProps;
        drawItemBody(
          draggedItem.type,
          snap.gx1,
          snap.gx2,
          snap.gy1,
          snap.gy2,
          m,
          1,
          0,
          0,
          true,
          draggedItem.seed,
          draggedItem.lit ?? true,
          draggedProps
        );

        const dragOx = pointerX - activeDrag.startX;
        const dragOy = pointerY - activeDrag.startY - 3;
        const elevatedLift = 1.14;

        if (draggedItem.type === 'sconce') {
          drawWallSconceLightWash(
            draggedItem.gx1,
            draggedItem.gx2,
            draggedItem.gy1,
            draggedItem.gy2,
            m,
            1,
            dragOx,
            dragOy,
            draggedItem.lit ?? true
          );
        }

        drawItemShadow(
          draggedItem.type,
          draggedItem.gx1,
          draggedItem.gx2,
          draggedItem.gy1,
          draggedItem.gy2,
          m,
          elevatedLift,
          dragOx,
          dragOy,
          draggedItem.seed,
          draggedProps
        );
        drawItemBody(
          draggedItem.type,
          draggedItem.gx1,
          draggedItem.gx2,
          draggedItem.gy1,
          draggedItem.gy2,
          m,
          1,
          dragOx,
          dragOy,
          false,
          draggedItem.seed,
          draggedItem.lit ?? true,
          draggedProps
        );
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
        drawItemBody(
          activeTool,
          cand.gx1,
          cand.gx2,
          cand.gy1,
          cand.gy2,
          m,
          1,
          hs.ox * 0.4,
          hs.oy * 0.4,
          true,
          0,
          true,
          showProps
        );
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
      // Arrange exactly ONCE on initial page load/reload — never auto-rearrange again unless Rearrange is pressed
      if (!hasInitializedRandom) {
        hasInitializedRandom = true;
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
      setAllProps: (show: boolean) => {
        for (let i = 0; i < placedItems.length; i++) {
          const item = placedItems[i];
          if (item.type === 'wallShelf' || item.type === 'cradle') {
            item.hasProps = show;
          }
        }
        if (!stateRef.current.motionOn) renderFrame(performance.now());
        else ensureLoop();
      },
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

      // Clicking directly on an existing piece without dragging toggles Wall Sconce light or piece props
      const hitExisting = findItemAtPoint(clickX, clickY);
      if (hitExisting) {
        if (hitExisting.type === 'sconce') {
          hitExisting.lit = !(hitExisting.lit ?? true);
          hitExisting.lift = 0.88;
        } else if (hitExisting.type === 'wallShelf' || hitExisting.type === 'cradle') {
          hitExisting.hasProps = !(hitExisting.hasProps ?? stateRef.current.showProps);
          hitExisting.lift = 0.88;
        } else {
          hitExisting.lift = 0.84;
        }
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

      // Purely additive placement — unlimited items stay on the wall until removed or cleared
      const size = toolSizes[activeTool];
      const cand = getCandidateForSlot(best, size.cols, size.rows);
      if (cand) {
        hasUserEdited = true;
        addPlacedItem(activeTool, cand.gx1, cand.gx2, cand.gy1, cand.gy2, true);
        triggerRipple(clickX / Math.max(1, cssW), clickY / Math.max(1, cssH));
      }

      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    const onContextMenu = (e: MouseEvent) => {
      if (stateRef.current.isModalOpen || !stateRef.current.canInteract) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.('.ui-surface, [role="dialog"], button, a, input, select, textarea')
      ) {
        return;
      }

      const hit = findItemAtPoint(e.clientX, e.clientY);
      if (!hit) return;

      e.preventDefault();
      cancelActiveDrag();
      hasUserEdited = true;
      placedItems = placedItems.filter((it) => it.id !== hit.id);
      triggerRipple(e.clientX / Math.max(1, cssW), e.clientY / Math.max(1, cssH));
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    sizeCanvas();
    renderFrame(performance.now());
    if (stateRef.current.motionOn) ensureLoop();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        rebuildGrid();
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
    document.addEventListener('contextmenu', onContextMenu);

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
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [controller.registerActions, heroSelector, headerSelector, footerSelector]);

  useEffect(() => {
    syncLoopRef.current();
  }, [
    controller.motionOn,
    controller.showProps,
    controller.activePillar,
    controller.activeTool,
    controller.toolSizes,
    isModalOpen,
    canInteract,
  ]);

  return <canvas ref={canvasRef} className="mortise-wall-canvas" aria-hidden="true" />;
};

const renderToolIcon = (tool: WallTool) => {
  switch (tool) {
    case 'hook':
      return (
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
      );
    case 'shelf':
      return (
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
      );
    case 'cabinet':
      return (
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
      );
    case 'cubby':
      return (
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
          <rect x="3.5" y="3.5" width="17" height="17" rx="0.6" />
          <rect x="6.8" y="6.8" width="10.4" height="10.4" strokeWidth="1.35" />
        </svg>
      );
    case 'wallShelf':
      return (
        <svg
          className="wall-tool-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5.5 14 V11.5 C5.5 10.6 6.8 10.6 6.8 11.5 V14" />
          <path d="M17.2 14 V11.5 C17.2 10.6 18.5 10.6 18.5 11.5 V14" />
          <rect x="2.5" y="14" width="19" height="3.2" rx="0.5" />
          <line x1="6.1" y1="17.2" x2="6.1" y2="20.5" strokeWidth="2.1" />
          <line x1="17.9" y1="17.2" x2="17.9" y2="20.5" strokeWidth="2.1" />
          <path d="M9.6 14 L10.2 9.8 H13.8 L14.4 14" />
          <path d="M12 9.8 V5.2" />
          <path d="M12 8.2 C10.4 7.8 9.4 6.6 9.6 5.2 C11 5.4 11.8 6.5 12 8.2 Z" />
          <path d="M12 7.6 C13.5 7.2 14.5 6.1 14.3 4.8 C12.9 5 12.2 6 12 7.6 Z" />
        </svg>
      );
    case 'cradle':
      return (
        <svg
          className="wall-tool-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 7.5 V18.5 H21.5 V7.5" />
          <line x1="5.8" y1="5" x2="5.8" y2="18.5" />
          <line x1="8.6" y1="5" x2="8.6" y2="18.5" />
          <line x1="11.4" y1="5" x2="11.4" y2="18.5" />
          <line x1="14.2" y1="5" x2="14.2" y2="18.5" />
          <line x1="16.4" y1="5.6" x2="18.4" y2="18.5" />
        </svg>
      );
    case 'sconce':
      return (
        <svg
          className="wall-tool-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2.5" y="9.5" width="19" height="5" rx="0.8" />
          <line x1="5" y1="12" x2="19" y2="12" strokeWidth="1.35" />
          <line x1="8" y1="6.2" x2="8" y2="4.4" strokeWidth="1.3" />
          <line x1="12" y1="6.2" x2="12" y2="4" strokeWidth="1.3" />
          <line x1="16" y1="6.2" x2="16" y2="4.4" strokeWidth="1.3" />
          <line x1="8" y1="17.8" x2="8" y2="19.6" strokeWidth="1.3" />
          <line x1="12" y1="17.8" x2="12" y2="20" strokeWidth="1.3" />
          <line x1="16" y1="17.8" x2="16" y2="19.6" strokeWidth="1.3" />
        </svg>
      );
  }
};

const COMPACT_ROW_1_TOOLS: WallTool[] = ['hook', 'shelf', 'cabinet'];
const COMPACT_ROW_2_TOOLS: WallTool[] = ['cubby', 'wallShelf'];
const COMPACT_ROW_3_TOOLS: WallTool[] = ['cradle', 'sconce'];
const DESKTOP_ROW_1_TOOLS: WallTool[] = ['hook', 'shelf', 'cabinet'];
const DESKTOP_ROW_2_TOOLS: WallTool[] = ['cubby', 'wallShelf', 'cradle', 'sconce'];

export const MortiseWallToolbar: React.FC<{
  controller: MortiseWallController;
  variant?: 'default' | 'compact';
}> = ({ controller, variant = 'default' }) => {
  const isDesktopInteractive = useDesktopInteractiveWall();
  const {
    activeTool,
    setActiveTool,
    toolSizes,
    adjustToolSize,
    showProps,
    toggleProps,
    rearrange,
    clearWall,
  } = controller;
  const currentSize = toolSizes[activeTool];
  const currentLimits = TOOL_SIZE_LIMITS[activeTool];
  const activeLabel = TOOL_LABELS[activeTool];

  if (!isDesktopInteractive) return null;

  const renderToolButton = (tool: WallTool) => (
    <button
      key={tool}
      type="button"
      className="wall-tool-btn"
      aria-pressed={activeTool === tool}
      onClick={() => setActiveTool(tool)}
    >
      {renderToolIcon(tool)}
      <span>{TOOL_LABELS[tool]}</span>
      <span className="wall-tool-size">
        {toolSizes[tool].cols}×{toolSizes[tool].rows}
      </span>
    </button>
  );

  return (
    <div
      className={`wall-toolbar ui-surface${variant === 'compact' ? ' wall-toolbar--compact' : ''}`}
      aria-label="Interactive modular wall controls"
    >
      {variant === 'compact' ? (
        <div
          className="wall-tool-rows"
          role="group"
          aria-label="Select modular piece to place"
        >
          <div className="wall-tool-row--3">{COMPACT_ROW_1_TOOLS.map(renderToolButton)}</div>
          <div className="wall-tool-row--2">{COMPACT_ROW_2_TOOLS.map(renderToolButton)}</div>
          <div className="wall-tool-row--2">{COMPACT_ROW_3_TOOLS.map(renderToolButton)}</div>
        </div>
      ) : (
        <div
          className="wall-tool-rows"
          role="group"
          aria-label="Select modular piece to place"
        >
          <div className="wall-tool-row--3">{DESKTOP_ROW_1_TOOLS.map(renderToolButton)}</div>
          <div className="wall-tool-row--4">{DESKTOP_ROW_2_TOOLS.map(renderToolButton)}</div>
        </div>
      )}

      <div className="wall-controls-panel">
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

        {variant === 'default' && (
          <span className="wall-micro-hint">
            {activeTool === 'sconce'
              ? 'Click slot to add · Click sconce to toggle light · Drag to move · Right-click to remove'
              : activeTool === 'wallShelf' || activeTool === 'cradle'
                ? 'Click slot to add · Click piece to toggle props · Drag to move · Right-click to remove'
                : 'Click slot to add · Drag to move · Right-click piece to remove'}
          </span>
        )}

        <div className="mortise-actions">
          <button
            type="button"
            className="text-action-link"
            aria-pressed={showProps}
            onClick={toggleProps}
            title="Toggle shelf plant and vinyl record props on or off"
          >
            Props: {showProps ? 'On' : 'Off'}
          </button>
          <button type="button" className="text-action-link" onClick={rearrange}>
            Rearrange
          </button>
          <button type="button" className="text-action-link" onClick={clearWall}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
