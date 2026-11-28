import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import balticBirchEdgeUrl from '../assets/images/baltic_birch_edge_1795173686278.jpg';

const MAPLE_TEXTURE_URL =
  '/assets/textures/baltic-birch-grain.webp';

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

export type LightKelvin = 2700 | 3000 | 4000 | 5000;

export const LIGHT_KELVIN_OPTIONS: LightKelvin[] = [2700, 3000, 4000, 5000];

const LIGHT_KELVIN_PRESETS: Record<
  LightKelvin,
  {
    ambientRgb: string;
    coreRgb: string;
    midRgb: string;
    washRgb: string;
    rimRgb: string;
    diffuserMid: string;
    diffuserBot: string;
    uiBg: string;
  }
> = {
  2700: {
    ambientRgb: '255, 232, 150',
    coreRgb: '255, 248, 206',
    midRgb: '255, 226, 126',
    washRgb: '253, 198, 48',
    rimRgb: '255, 248, 212',
    diffuserMid: '#FFF5C4',
    diffuserBot: '#FDCB33',
    uiBg: '#FDCB33',
  },
  3000: {
    ambientRgb: '255, 242, 194',
    coreRgb: '255, 252, 232',
    midRgb: '255, 238, 174',
    washRgb: '255, 218, 118',
    rimRgb: '255, 252, 234',
    diffuserMid: '#FFFBE4',
    diffuserBot: '#FFE084',
    uiBg: '#FFE7A3',
  },
  4000: {
    ambientRgb: '234, 244, 255',
    coreRgb: '252, 254, 255',
    midRgb: '216, 234, 252',
    washRgb: '176, 210, 244',
    rimRgb: '255, 255, 255',
    diffuserMid: '#F7FBFF',
    diffuserBot: '#C5E0FA',
    uiBg: '#E3F0FB',
  },
  5000: {
    ambientRgb: '204, 234, 255',
    coreRgb: '240, 250, 255',
    midRgb: '166, 216, 250',
    washRgb: '92, 186, 240',
    rimRgb: '232, 248, 255',
    diffuserMid: '#E8F7FF',
    diffuserBot: '#7DD0F6',
    uiBg: '#8DD6F7',
  },
};

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
  cradle: 'Book Shelf',
  sconce: 'Wall Sconce',
};

export const TOOL_SIZE_LIMITS: Record<
  WallTool,
  { minCols: number; maxCols: number; minRows: number; maxRows: number; defaultSize: PieceSize }
> = {
  hook: {
    minCols: 1,
    maxCols: 6,
    minRows: 1,
    maxRows: 1,
    defaultSize: { cols: 1, rows: 1 },
  },
  shelf: {
    minCols: 4,
    maxCols: 9,
    minRows: 2,
    maxRows: 2,
    defaultSize: { cols: 5, rows: 2 },
  },
  cabinet: {
    minCols: 4,
    maxCols: 10,
    minRows: 2,
    maxRows: 6,
    defaultSize: { cols: 5, rows: 3 },
  },
  cubby: {
    minCols: 3,
    maxCols: 8,
    minRows: 2,
    maxRows: 5,
    defaultSize: { cols: 4, rows: 3 },
  },
  wallShelf: {
    minCols: 3,
    maxCols: 10,
    minRows: 2,
    maxRows: 2,
    defaultSize: { cols: 5, rows: 2 },
  },
  cradle: {
    minCols: 4,
    maxCols: 10,
    minRows: 2,
    maxRows: 2,
    defaultSize: { cols: 5, rows: 2 },
  },
  sconce: {
    minCols: 2,
    maxCols: 8,
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
  doorOpen?: boolean;
  doorProgress?: number;
  doorOpenSide?: 'left' | 'right';
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
  warmLightingOn: boolean;
  toggleWarmLighting: () => void;
  hasLightableItems: boolean;
  hasPropItems: boolean;
  lightKelvin: LightKelvin;
  setLightKelvin: (kelvin: LightKelvin) => void;
  rearrange: () => void;
  clearWall: () => void;
  syncWallState: (state: {
    hasLightableItems: boolean;
    hasPropItems: boolean;
    anyLit: boolean;
    anyPropsOn: boolean;
  }) => void;
  registerActions: (actions: {
    rearrange: () => void;
    clearWall: () => void;
    triggerRipple: (nx: number, ny: number) => void;
    setAllProps: (show: boolean) => void;
    setAllLighting: (on: boolean) => void;
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
  const [showProps, setShowProps] = useState<boolean>(false);
  const showPropsRef = useRef<boolean>(false);
  const [warmLightingOn, setWarmLightingOn] = useState<boolean>(false);
  const warmLightingRef = useRef<boolean>(false);
  const [hasLightableItems, setHasLightableItems] = useState<boolean>(false);
  const hasLightableItemsRef = useRef<boolean>(false);
  const [hasPropItems, setHasPropItems] = useState<boolean>(false);
  const hasPropItemsRef = useRef<boolean>(false);
  const [lightKelvin, setLightKelvinState] = useState<LightKelvin>(2700);

  const actionsRef = useRef<{
    rearrange: () => void;
    clearWall: () => void;
    triggerRipple: (nx: number, ny: number) => void;
    setAllProps: (show: boolean) => void;
    setAllLighting: (on: boolean) => void;
  }>({
    rearrange: () => {},
    clearWall: () => {},
    triggerRipple: () => {},
    setAllProps: () => {},
    setAllLighting: () => {},
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

  const syncWallState = useCallback(
    (wallState: {
      hasLightableItems: boolean;
      hasPropItems: boolean;
      anyLit: boolean;
      anyPropsOn: boolean;
    }) => {
      hasLightableItemsRef.current = wallState.hasLightableItems;
      setHasLightableItems(wallState.hasLightableItems);
      hasPropItemsRef.current = wallState.hasPropItems;
      setHasPropItems(wallState.hasPropItems);

      const nextLit = wallState.hasLightableItems && wallState.anyLit;
      warmLightingRef.current = nextLit;
      setWarmLightingOn(nextLit);

      const nextProps = wallState.hasPropItems && wallState.anyPropsOn;
      showPropsRef.current = nextProps;
      setShowProps(nextProps);
    },
    []
  );

  const toggleMotion = useCallback(() => setMotionOn((v) => !v), []);
  const toggleProps = useCallback(() => {
    if (!hasPropItemsRef.current) return;
    const next = !showPropsRef.current;
    showPropsRef.current = next;
    setShowProps(next);
    actionsRef.current.setAllProps(next);
  }, []);
  const toggleWarmLighting = useCallback(() => {
    if (!hasLightableItemsRef.current) return;
    const next = !warmLightingRef.current;
    warmLightingRef.current = next;
    setWarmLightingOn(next);
    actionsRef.current.setAllLighting(next);
  }, []);
  const setLightKelvin = useCallback((kelvin: LightKelvin) => {
    setLightKelvinState(kelvin);
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
      warmLightingOn,
      toggleWarmLighting,
      hasLightableItems,
      hasPropItems,
      lightKelvin,
      setLightKelvin,
      rearrange,
      clearWall,
      syncWallState,
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
      warmLightingOn,
      toggleWarmLighting,
      hasLightableItems,
      hasPropItems,
      lightKelvin,
      setLightKelvin,
      rearrange,
      clearWall,
      syncWallState,
      registerActions,
    ]
  );
}

/**
 * Enables the interactive mortise wall across both desktop and mobile viewports.
 */
export function isDesktopInteractiveWall(): boolean {
  return typeof window !== 'undefined';
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

const MOBILE_WALL_TOOLS: WallTool[] = ['hook', 'wallShelf', 'cubby', 'cabinet'];

const MOBILE_FIXED_SIZES: Record<WallTool, PieceSize> = {
  hook: { cols: 1, rows: 1 },
  wallShelf: { cols: 2, rows: 1 },
  cubby: { cols: 2, rows: 2 },
  cabinet: { cols: 3, rows: 2 },
  shelf: { cols: 2, rows: 1 },
  cradle: { cols: 2, rows: 2 },
  sconce: { cols: 2, rows: 1 },
};

function useIsMobileWall(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return mobile;
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
    warmLightingOn: controller.warmLightingOn,
    lightKelvin: controller.lightKelvin,
    isModalOpen,
    canInteract,
  });

  stateRef.current = {
    activeTool: controller.activeTool,
    toolSizes: controller.toolSizes,
    activePillar: controller.activePillar,
    motionOn: controller.motionOn,
    showProps: controller.showProps,
    warmLightingOn: controller.warmLightingOn,
    lightKelvin: controller.lightKelvin,
    isModalOpen,
    canInteract,
  };

  useEffect(() => {
    if (!desktopInteractive) return;
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
    let blockedRects: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    let heroCutout: {
      gxMin: number;
      gxMax: number;
      gyMin: number;
      gyMax: number;
    } | null = null;
    let heroAppliedDx = 0;
    let heroAppliedDy = 0;
    let topSafeY = 12;
    let bottomSafeY = cssH - 12;
    let edgeSafeX = 12;

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

    const TARGET_VERTICAL_ROWS = 14;
    let minVisibleGy = -7;
    let maxVisibleGy = 6;

    const measureClearanceZones = () => {
      const headerEl = headerSelector ? document.querySelector(headerSelector) : null;
      const footerEl = footerSelector ? document.querySelector(footerSelector) : null;
      const edgeY = Math.max(8, Math.min(14, cssH * 0.012));

      if (cssW < 768) {
        const topBoundEl = document.querySelector('[data-wall-top-bound]');
        const bottomBoundEl = document.querySelector('[data-wall-bottom-bound]');
        const topEdge = topBoundEl
          ? topBoundEl.getBoundingClientRect().bottom + 14
          : headerEl
          ? headerEl.getBoundingClientRect().bottom + 12
          : edgeY;
        const botEdge = bottomBoundEl
          ? bottomBoundEl.getBoundingClientRect().top - 14
          : cssH - edgeY;
        topSafeY = Math.max(edgeY, topEdge);
        bottomSafeY = Math.min(cssH - edgeY, Math.max(topSafeY + 180, botEdge));
        edgeSafeX = Math.max(10, Math.min(16, cssW * 0.025));
      } else {
        topSafeY = headerEl ? Math.max(edgeY, headerEl.getBoundingClientRect().bottom + 10) : edgeY;
        const footerTop = footerEl ? footerEl.getBoundingClientRect().top - 10 : cssH - edgeY;
        bottomSafeY = Math.min(cssH - edgeY, Math.max(topSafeY + 220, footerTop));
        edgeSafeX = Math.max(8, Math.min(14, cssW * 0.008));
      }

      const heroEl = heroSelector ? (document.querySelector(heroSelector) as HTMLElement | null) : null;
      if (heroEl) {
        const hr = heroEl.getBoundingClientRect();
        heroRect = {
          left: hr.left - 8,
          right: hr.right + 8,
          top: hr.top - 8,
          bottom: hr.bottom + 8,
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
    };

    const isSlotBlocked = (
      gx: number,
      gy: number,
      cx: number,
      cy: number,
      slotW: number,
      slotH: number
    ) => {
      if (gy < minVisibleGy || gy > maxVisibleGy) return true;
      if (cx - slotW * 0.5 < edgeSafeX || cx + slotW * 0.5 > cssW - edgeSafeX) return true;
      if (heroCutout) {
        return (
          gx >= heroCutout.gxMin &&
          gx <= heroCutout.gxMax &&
          gy >= heroCutout.gyMin &&
          gy <= heroCutout.gyMax
        );
      }
      const halfW = slotW * 0.5 + 3;
      const halfH = slotH * 0.5 + 3;
      if (cy - halfH < topSafeY || cy + halfH > bottomSafeY) return true;
      if (cssW < 768) {
        // Strict top/bottom thresholds already keep all mobile slots strictly between statement box and studio buttons
        return false;
      }
      if (blockedRects.length > 0) {
        return blockedRects.some(
          (r) =>
            cx + halfW > r.left &&
            cx - halfW < r.right &&
            cy + halfH > r.top &&
            cy - halfH < r.bottom
        );
      }
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
          if (s.cx - gridMeta.slotW * 0.5 < 4 || s.cx + gridMeta.slotW * 0.5 > cssW - 4) {
            return false;
          }
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

    const syncWallFlags = () => {
      let hasLightable = false;
      let hasProp = false;
      let anyLit = false;
      let anyPropsOn = false;
      for (let i = 0; i < placedItems.length; i++) {
        const item = placedItems[i];
        if (item.type === 'sconce' || item.type === 'cubby') {
          hasLightable = true;
          if (item.lit) anyLit = true;
        }
        if (
          item.type === 'wallShelf' ||
          item.type === 'cradle' ||
          item.type === 'shelf' ||
          item.type === 'hook'
        ) {
          hasProp = true;
          if (item.hasProps) anyPropsOn = true;
        }
      }
      controller.syncWallState({
        hasLightableItems: hasLightable,
        hasPropItems: hasProp,
        anyLit,
        anyPropsOn,
      });
    };

    /**
     * Appends a new piece to the mortise wall without removing or overwriting any previously placed items.
     * Lights and props always start off until toggled by clicking the placed object (or toolbar controls).
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
        lit: type === 'sconce' || type === 'cubby' ? false : undefined,
        hasProps:
          type === 'wallShelf' || type === 'cradle' || type === 'shelf' || type === 'hook'
            ? false
            : undefined,
        doorOpen: type === 'cabinet' ? false : undefined,
        doorProgress: type === 'cabinet' ? 0 : undefined,
        doorOpenSide: type === 'cabinet' ? 'left' : undefined,
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
          const itemHasProps = Boolean(item.hasProps);
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

          // Include hanging simple backpack / Stetson hat props in hit-testing so clicking them toggles props cleanly
          if (itemHasProps) {
            const props = getHookPropsLayout(
              item.gx1,
              item.gx2,
              item.gy1,
              item.gy2,
              m,
              1,
              0,
              0,
              item.seed
            );
            for (const p of props) {
              if (
                px >= p.cx - p.w * 0.5 - 3 &&
                px <= p.cx + p.w * 0.5 + 3 &&
                py >= p.topY - 3 &&
                py <= p.topY + p.h + 3
              ) {
                return item;
              }
            }
          }
        } else if (item.type === 'shelf') {
          const itemHasProps = Boolean(item.hasProps);
          const t = m.slotW * 0.857;
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const topY = upperCy + m.slotH * 0.04;
          const botY = lowerCy + m.slotH * 0.11;
          const rodDiam = Math.min(t * 1.48, m.pitchY * 0.25);
          const hangerExtraH = itemHasProps ? (rodDiam / 1.3125) * 3.8 : 0;
          if (px >= leftX - 5 && px <= rightX + 5 && py >= topY - 5 && py <= botY + 5) {
            return item;
          }
          if (
            itemHasProps &&
            px >= leftX + t &&
            px <= rightX - t &&
            py >= botY &&
            py <= botY + hangerExtraH
          ) {
            return item;
          }
        } else if (item.type === 'cradle') {
          const itemHasProps = Boolean(item.hasProps);
          const t = m.slotW * 0.857;
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const topY = itemHasProps ? upperCy - m.slotH * 0.34 : upperCy + m.slotH * 0.04;
          const botY = lowerCy + m.slotH * 0.11;
          if (px >= leftX - 5 && px <= rightX + 5 && py >= topY - 5 && py <= botY + 5) {
            return item;
          }
        } else if (item.type === 'cubby') {
          const t = m.slotW * 0.857;
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const topY = upperCy - m.slotH * 0.62;
          const botY = lowerCy + m.slotH * 0.62;
          if (px >= leftX - 4 && px <= rightX + 4 && py >= topY - 4 && py <= botY + 4) {
            return item;
          }
        } else if (item.type === 'wallShelf') {
          const itemHasProps = Boolean(item.hasProps);
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
          const leftX = leftCx - t * 0.5;
          const rightX = rightCx + t * 0.5;
          const cheekTopY = upperCy - m.slotH * 0.52;
          const cheekH = t * (0.78 + 1.0 + 3.15);
          const cheekBotY = cheekTopY + cheekH;
          if (px >= leftX - 6 && px <= rightX + 6 && py >= cheekTopY - 5 && py <= cheekBotY + 6) {
            return item;
          }
        } else {
          const t = m.slotW * 0.857;
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

      const isMobileBand = cssW < 768;
      const usableH = Math.max(180, bottomSafeY - topSafeY);
      const rowCount = isMobileBand
        ? Math.max(6, Math.min(10, Math.round(usableH / 58)))
        : TARGET_VERTICAL_ROWS;
      minVisibleGy = -Math.floor(rowCount / 2);
      maxVisibleGy = minVisibleGy + rowCount - 1;

      // Scale mortise grid evenly on both axes so exact rows span cleanly between topSafeY and bottomSafeY
      const scale = usableH / (rowCount * SVG_PITCH_Y);
      const slotW = SVG_SLOT_W * scale;
      const slotH = SVG_SLOT_H * scale;
      const slotR = SVG_SLOT_R * scale;
      const pitchX = SVG_PITCH_X * scale;
      const pitchY = SVG_PITCH_Y * scale;

      const midX = cssW * 0.5;
      const midY = (topSafeY + bottomSafeY) * 0.5;
      // Offset centerY by +0.5 * pitchY when rowCount is even so rows sit 100% symmetrically between topSafeY & bottomSafeY
      const centerY = rowCount % 2 === 0 ? midY + 0.5 * pitchY : midY;
      let centerX = midX;
      heroCutout = null;

      if (isMobileBand) {
        // Center columns symmetrically left-to-right across the phone screen
        const visibleCols = Math.max(5, Math.floor((cssW - 2 * edgeSafeX) / pitchX));
        centerX = visibleCols % 2 === 0 ? midX + 0.5 * pitchX : midX;
        blockedRects = [];
      }

      // Scale & center the middle hero stack on desktop so its 4 visual edges are strictly equidistant from the nearest mortise holes
      const heroEl = heroSelector
        ? (document.querySelector(heroSelector) as HTMLElement | null)
        : null;
      if (heroEl && !isMobileBand) {
        const W0 = heroEl.offsetWidth;
        const H0 = heroEl.offsetHeight;
        const totalCols = Math.floor((cssW - 2 * edgeSafeX) / pitchX);

        let best: {
          kx: number;
          ky: number;
          s: number;
          clearW: number;
          clearH: number;
          cost: number;
        } | null = null;

        if (W0 > 120 && H0 > 120 && W0 > H0 + 20) {
          for (const ky of [8, 6, 10]) {
            const clearH = (ky + 1) * pitchY - slotH;
            const maxKx = Math.min(24, totalCols - 2);
            for (let kx = 8; kx <= maxKx; kx++) {
              const clearW = (kx + 1) * pitchX - slotW;
              if (clearW <= clearH) continue;
              // Exact uniform scale s such that (clearW - s*W0)/2 === (clearH - s*H0)/2 === G on all 4 sides
              const s = (clearW - clearH) / (W0 - H0);
              const G = (clearH - s * H0) * 0.5;
              const gRatio = G / pitchY;
              if (s < 0.62 || s > 1.32) continue;
              if (gRatio < 0.24 || gRatio > 0.96) continue;
              const flankCols = Math.floor((totalCols - kx) / 2);
              if (flankCols < 3) continue;

              // Target a prominent, commanding center stack (s ~ 1.04) while keeping generous flanks & equidistant framing
              const sScore = Math.abs(s - 1.04) * 2.4;
              const gScore = Math.abs(gRatio - 0.54) * 1.1;
              const kyPenalty = ky === 8 ? 0 : ky === 6 ? 0.16 : 0.45;
              const flankPenalty = flankCols < 5 ? (5 - flankCols) * 0.45 : 0;
              const cost = sScore + gScore + kyPenalty + flankPenalty;
              if (!best || cost < best.cost) {
                best = { kx, ky, s, clearW, clearH, cost };
              }
            }
          }
        }

        if (best) {
          blockedRects = [];
          // Match horizontal grid parity to kx so left & right flanking columns are 100% symmetric
          centerX = best.kx % 2 === 0 ? midX + 0.5 * pitchX : midX;
          const gxMin = best.kx % 2 === 0 ? -(best.kx / 2) : -((best.kx - 1) / 2);
          const gxMax = best.kx % 2 === 0 ? best.kx / 2 - 1 : (best.kx - 1) / 2;
          const gyMin = -(best.ky / 2);
          const gyMax = best.ky / 2 - 1;
          heroCutout = { gxMin, gxMax, gyMin, gyMax };

          // Align the center of #hero-center-stack exactly to (midX, midY) before scaling
          const hr = heroEl.getBoundingClientRect();
          const natCenterX = (hr.left + hr.right) * 0.5 - heroAppliedDx;
          const natCenterY = (hr.top + hr.bottom) * 0.5 - heroAppliedDy;
          const nextDx = Math.round((midX - natCenterX) * 100) / 100;
          const nextDy = Math.round((midY - natCenterY) * 100) / 100;
          const nextTransform = `translate(${nextDx}px, ${nextDy}px) scale(${best.s.toFixed(5)})`;

          heroEl.style.transformOrigin = 'center center';
          if (heroEl.style.transform !== nextTransform) {
            heroEl.style.transform = nextTransform;
          }
          heroAppliedDx = nextDx;
          heroAppliedDy = nextDy;

          const scaledW = W0 * best.s;
          const scaledH = H0 * best.s;
          heroRect = {
            left: midX - scaledW * 0.5,
            right: midX + scaledW * 0.5,
            top: midY - scaledH * 0.5,
            bottom: midY + scaledH * 0.5,
          };
        } else {
          if (heroEl.style.transform) {
            heroEl.style.transform = '';
            heroEl.style.transformOrigin = '';
          }
          heroAppliedDx = 0;
          heroAppliedDy = 0;
          const hr = heroEl.getBoundingClientRect();
          heroRect = {
            left: hr.left - 4,
            right: hr.right + 4,
            top: hr.top - 4,
            bottom: hr.bottom + 4,
          };
          const surfaces = Array.from(heroEl.querySelectorAll('.ui-surface')) as HTMLElement[];
          blockedRects = surfaces
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0)
            .map((r) => ({
              left: r.left - 4,
              right: r.right + 4,
              top: r.top - 4,
              bottom: r.bottom + 4,
            }));
        }
      } else if (heroEl && isMobileBand) {
        if (heroEl.style.transform) {
          heroEl.style.transform = '';
          heroEl.style.transformOrigin = '';
        }
        heroAppliedDx = 0;
        heroAppliedDy = 0;
      }

      const halfCols = Math.ceil((cssW * 0.5) / pitchX) + 2;

      gridMeta = {
        minGx: -halfCols,
        maxGx: halfCols,
        minGy: minVisibleGy,
        maxGy: maxVisibleGy,
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
            blocked: isSlotBlocked(gx, gy, cx, cy, slotW, slotH),
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
     * Deterministic layout for calm monotone architectural props (Simple Backpack & Simple Hat)
     * hanging on single or multi-column Casegoods Wall Hooks.
     */
    const getHookPropsLayout = (
      gx1: number,
      gx2: number,
      gy1: number,
      gy2: number,
      m: GridMeta,
      lift: number,
      ox: number,
      oy: number,
      seed = 0
    ): Array<{
      kind: 'backpack' | 'hat';
      gx: number;
      cx: number;
      anchorY: number;
      topY: number;
      w: number;
      h: number;
      depth: number;
    }> => {
      const cols = Math.max(1, gx2 - gx1 + 1);
      const rows = Math.max(1, gy2 - gy1 + 1);
      const upperH = m.slotH * 0.768;
      const lowerH = m.slotH * 1.382;
      const extraH = Math.max(0, rows - 1) * m.pitchY;
      const liftOffset = (1 - lift) * 6;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const hy = upperCy + m.slotH * 0.04 - liftOffset;
      const seamY = hy + upperH + extraH;
      const anchorY = seamY + lowerH * 0.22;
      const hookW = m.slotW * 0.857;
      const hookDepth = Math.max(hookW * 2.0, (upperH + lowerH) * 0.62) * lift;

      const s = Math.abs(Math.round(seed || gx1 * 11 + gx2 * 17 + gy1 * 23));
      const assignments: Array<{ gx: number; kind: 'backpack' | 'hat' }> = [];

      if (cols === 1) {
        assignments.push({ gx: gx1, kind: s % 2 === 0 ? 'backpack' : 'hat' });
      } else if (cols === 2) {
        // Real-scale Filson pack (~1.82 pitchX) or Cap (~1.06 pitchX) on one hook, leaving sibling birch hook clean
        const pickLeft = s % 2 === 0;
        const kind: 'backpack' | 'hat' = Math.floor(s / 2) % 2 === 0 ? 'backpack' : 'hat';
        assignments.push({ gx: pickLeft ? gx1 : gx2, kind });
      } else if (cols === 3 || cols === 4) {
        // 3–4 col hook rail: Filson backpack + hanging cap flank exposed inner birch peg(s) cleanly
        if (s % 2 === 0) {
          assignments.push({ gx: gx1, kind: 'backpack' });
          assignments.push({ gx: gx2, kind: 'hat' });
        } else {
          assignments.push({ gx: gx1, kind: 'hat' });
          assignments.push({ gx: gx2, kind: 'backpack' });
        }
      } else {
        // Wide 5–6 col entryway peg rail: space backpack & cap naturally with crisp open birch pegs between them
        const leftPeg = cols >= 6 ? gx1 + 1 : gx1;
        const rightPeg = cols >= 6 ? gx2 - 1 : gx2;
        if (s % 2 === 0) {
          assignments.push({ gx: leftPeg, kind: 'backpack' });
          assignments.push({ gx: rightPeg, kind: 'hat' });
        } else {
          assignments.push({ gx: leftPeg, kind: 'hat' });
          assignments.push({ gx: rightPeg, kind: 'backpack' });
        }
      }

      return assignments.map(({ gx, kind }) => {
        const cx = m.centerX + gx * m.pitchX + ox;
        if (kind === 'backpack') {
          // Exact real-world scale measured against the mortise wall photo (IMG_5140): ~1.82 pitchX wide × ~2.38 pitchY tall
          const w = m.pitchX * 1.82;
          const h = m.pitchY * 2.38;
          const loopDrop = Math.max(8, m.slotH * 0.42);
          return {
            kind,
            gx,
            cx,
            anchorY,
            topY: anchorY + loopDrop,
            w,
            h,
            depth: hookDepth * 1.32,
          };
        } else {
          // Simple 2D wide-brim Stetson felt hat hanging flat against the wall from the peg inside the upper crown
          const w = m.pitchX * 1.74;
          const h = m.pitchY * 1.54;
          return {
            kind,
            gx,
            cx,
            anchorY,
            topY: anchorY - h * 0.22,
            w,
            h,
            depth: hookDepth * 0.82,
          };
        }
      });
    };

    /**
     * Traces the 2D front-elevation silhouette of the Filson Roll-Top Backpack (from IMG_5140)
     * or the simple flat 2D wide-brim Stetson felt hat hanging on the peg.
     */
    const appendHookPropSilhouette = (
      kind: 'backpack' | 'hat',
      cx: number,
      topY: number,
      w: number,
      h: number
    ) => {
      if (kind === 'backpack') {
        // Filson roll-top dry/canvas backpack: flared rolled collar ears tapering gently into soft-cornered body
        const halfW = w * 0.5;
        const flareW = w * 0.57;
        const rollH = h * 0.145;
        const botHalfW = w * 0.485;
        const botR = Math.max(5, w * 0.11);

        ctx.moveTo(cx - flareW + 4, topY);
        ctx.lineTo(cx + flareW - 4, topY);
        ctx.quadraticCurveTo(cx + flareW + 2, topY + rollH * 0.18, cx + flareW, topY + rollH * 0.58);
        ctx.quadraticCurveTo(cx + flareW * 0.94, topY + rollH * 1.02, cx + halfW, topY + rollH * 1.15);
        ctx.lineTo(cx + botHalfW, topY + h - botR);
        ctx.quadraticCurveTo(cx + botHalfW, topY + h, cx + botHalfW - botR, topY + h);
        ctx.lineTo(cx - botHalfW + botR, topY + h);
        ctx.quadraticCurveTo(cx - botHalfW, topY + h, cx - botHalfW, topY + h - botR);
        ctx.lineTo(cx - halfW, topY + rollH * 1.15);
        ctx.quadraticCurveTo(cx - flareW * 0.94, topY + rollH * 1.02, cx - flareW, topY + rollH * 0.58);
        ctx.quadraticCurveTo(cx - flareW - 2, topY + rollH * 0.18, cx - flareW + 4, topY);
        ctx.closePath();
      } else {
        // Wide-brim Stetson hat: clean, smooth 2D oval felt brim
        const cy = topY + h * 0.5;
        const rx = w * 0.5;
        const ry = h * 0.5;
        ctx.moveTo(cx + rx, cy);
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.closePath();
      }
    };

    /**
     * True 3D cast shadow of Josh's exact Casegoods CNC Baltic Birch Hook (from CASEGOODS2_90825123.svg):
     * Crisp rectilinear rounded-corner L/U-hook profile (straight vertical wall stem -> rounded 90° bottom heel
     * -> flat horizontal saddle projecting 1.5" off wall -> rounded 90° front turn up into flat vertical front lip
     * -> rounded 90° inner throat returning to wall stem) + directional shadows for Filson Backpack & Hanging Cap.
     */
    const drawWallHookIsoShadow = (
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
      const cols = Math.max(1, gx2 - gx1 + 1);
      const rows = Math.max(1, gy2 - gy1 + 1);
      const hookW = m.slotW * 0.857;
      const edgeR = m.slotW * 0.143;
      const upperH = m.slotH * 0.768;
      const lowerH = m.slotH * 1.382;
      const extraH = Math.max(0, rows - 1) * m.pitchY;
      const totalH = upperH + extraH + lowerH;
      const bendY = upperH + extraH;
      const liftOffset = (1 - lift) * 6;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const hy = upperCy + m.slotH * 0.04 - liftOffset;

      // Exact CAD depth from CASEGOODS2_90825123.svg: 1.50" Z protrusion (2.0 × 3/4" ply thickness)
      const depth = Math.max(hookW * 2.05, (upperH + lowerH) * 0.62) * lift;
      const projX = (x: number, zFrac: number) => x + depth * zFrac * LIGHT_KX;
      const projY = (yPx: number, zFrac: number) => hy + yPx + depth * zFrac * LIGHT_KY;

      ctx.save();
      ctx.beginPath();

      // Multi-column horizontal mounting rail shadow when cols > 1
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
          edgeR
        );
      }

      // Exact rectilinear rounded-corner Casegoods hook side profile from CASEGOODS2_90825123.svg
      // (straight vertical stem + rounded 90° lower saddle + flat vertical front catch lip + rounded inner throat)
      const throatY = bendY + lowerH * 0.52;
      const lipTopY = bendY + lowerH * 0.06;
      for (let gx = gx1; gx <= gx2; gx++) {
        const cx = m.centerX + gx * m.pitchX + ox;
        const hx = cx - hookW * 0.5;
        const rightEdge = hx + hookW;

        ctx.moveTo(rightEdge, hy + edgeR);
        // Upper mortise stem stepping straight out of wall with crisp 1/8" corner roundover
        ctx.quadraticCurveTo(
          projX(rightEdge, 0.2),
          projY(0, 0.2),
          projX(rightEdge, 0.22),
          projY(edgeR * 1.4, 0.22)
        );
        // Inner vertical wall of hook dropping straight down into the rounded 90° inner throat
        ctx.lineTo(projX(rightEdge, 0.22), projY(throatY - edgeR * 1.4, 0.22));
        ctx.quadraticCurveTo(
          projX(rightEdge, 0.22),
          projY(throatY, 0.22),
          projX(rightEdge, 0.34),
          projY(throatY, 0.34)
        );
        // Flat horizontal inner throat ledge turning cleanly up into inner face of front catch lip
        ctx.lineTo(projX(rightEdge, 0.52), projY(throatY, 0.52));
        ctx.quadraticCurveTo(
          projX(rightEdge, 0.62),
          projY(throatY, 0.62),
          projX(rightEdge, 0.62),
          projY(throatY - edgeR * 1.4, 0.62)
        );
        // Inner vertical face of upturned front catch lip rising to rounded top face
        ctx.lineTo(projX(rightEdge, 0.62), projY(lipTopY + edgeR, 0.62));
        ctx.quadraticCurveTo(
          projX(rightEdge, 0.62),
          projY(lipTopY, 0.62),
          projX(rightEdge, 0.72),
          projY(lipTopY, 0.72)
        );
        // Flat top of front catch lip -> rounded 90° top-front corner (1/8" roundover)
        ctx.lineTo(projX(rightEdge, 0.9), projY(lipTopY, 0.9));
        ctx.quadraticCurveTo(
          projX(rightEdge, 1.0),
          projY(lipTopY, 1.0),
          projX(rightEdge, 1.0),
          projY(lipTopY + edgeR * 1.4, 1.0)
        );
        // Straight vertical outer front face descending to generously rounded 90° bottom-front corner
        ctx.lineTo(projX(rightEdge, 1.0), projY(totalH - edgeR * 2.4, 1.0));
        ctx.quadraticCurveTo(
          projX(rightEdge, 1.0),
          projY(totalH, 1.0),
          projX(rightEdge, 0.8),
          projY(totalH, 0.8)
        );
        // Flat horizontal underside saddle returning cleanly to rounded bottom-back heel at wall (z=0)
        ctx.lineTo(projX(hx, 0.26), projY(totalH, 0.26));
        ctx.quadraticCurveTo(hx, hy + totalH, hx, hy + totalH - edgeR * 1.8);
        ctx.lineTo(hx, hy + edgeR);
        ctx.quadraticCurveTo(hx, hy, hx + edgeR, hy);
        ctx.lineTo(rightEdge - edgeR, hy);
        ctx.quadraticCurveTo(rightEdge, hy, rightEdge, hy + edgeR);
        ctx.closePath();
      }

      const firstHx = m.centerX + gx1 * m.pitchX + ox - hookW * 0.5;
      const lastRight = m.centerX + gx2 * m.pitchX + ox + hookW * 0.5;
      fillDirectionalCastShadow(
        firstHx,
        hy,
        projX(lastRight, 1.0),
        projY(totalH, 1.0),
        lift,
        5
      );
      ctx.restore();

      // Directional cast shadows for real-scale Filson Backpack & Backstrap-Hanging Cap (bill touching wall)
      if (showProps) {
        const props = getHookPropsLayout(gx1, gx2, gy1, gy2, m, lift, ox, oy, seed);
        if (props.length > 0) {
          ctx.save();
          ctx.beginPath();
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;

          for (const p of props) {
            const pdx = p.depth * LIGHT_KX;
            const pdy = p.depth * LIGHT_KY;
            if (p.kind === 'hat') {
              // Clean simple flat 2D Stetson wide-brim cast shadow
              appendHookPropSilhouette('hat', p.cx + pdx * 0.72, p.topY + pdy * 0.72, p.w, p.h);
              appendHookPropSilhouette(
                'hat',
                p.cx + pdx * 0.34,
                p.topY + pdy * 0.34,
                p.w * 0.98,
                p.h * 0.98
              );
            } else {
              appendHookPropSilhouette('backpack', p.cx + pdx, p.topY + pdy, p.w, p.h);
              appendHookPropSilhouette(
                'backpack',
                p.cx + pdx * 0.45,
                p.topY + pdy * 0.45,
                p.w * 0.96,
                p.h * 0.98
              );
            }

            minX = Math.min(minX, p.cx - p.w * 0.58);
            minY = Math.min(minY, p.topY);
            maxX = Math.max(maxX, p.cx + p.w * 0.58 + pdx);
            maxY = Math.max(maxY, p.topY + p.h + pdy);
          }

          fillDirectionalCastShadow(minX, minY, maxX, maxY, lift, 8);
          ctx.restore();
        }
      }
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
     * Pure 2D Orthographic + True 3D Wall-Shadow Layout for Minimal Clothing Hangers on Shelf + Rod.
     * Assumes standard closet rod diameter = 1.3125" (pxPerInch = rodDiam / 1.3125).
     * Front elevation displays razor-simple perpendicular 2D edge-on hangers, while the wall cast shadow
     * reveals the full 3D open-triangle hanger geometry projected strictly along (LIGHT_KX, LIGHT_KY).
     */
    const getShelfHangersLayout = (
      innerLeft: number,
      innerRight: number,
      rodTopY: number,
      rodBotY: number,
      rodDiam: number,
      rodDepth: number,
      grainSeed: number
    ) => {
      const innerSpan = Math.max(0, innerRight - innerLeft);
      const pxPerInch = rodDiam / 1.3125;
      if (innerSpan < pxPerInch * 5.2 || pxPerInch <= 1.2) {
        return {
          pxPerInch,
          hookStroke: 1.5,
          edgeW: 4,
          barThick: 3,
          hangers: [] as Array<{
            hx: number;
            hookApexY: number;
            neckBotY: number;
            shoulderY: number;
            barY: number;
            zBack: number;
            zFront: number;
            zRod: number;
          }>,
        };
      }

      const seeded = (salt: number) => {
        const s = Math.sin(grainSeed * 12.9898 + salt * 78.233) * 43758.5453;
        return s - Math.floor(s);
      };

      const count =
        innerSpan >= pxPerInch * 28
          ? 6
          : innerSpan >= pxPerInch * 22
            ? 5
            : innerSpan >= pxPerInch * 16.5
              ? 4
              : 3;
      const mirror = Math.abs(Math.round(grainSeed)) % 2 === 1;
      const baseFracs =
        count === 6
          ? mirror
            ? [0.16, 0.28, 0.42, 0.56, 0.69, 0.82]
            : [0.18, 0.31, 0.44, 0.58, 0.72, 0.84]
          : count === 5
            ? mirror
              ? [0.19, 0.34, 0.5, 0.66, 0.8]
              : [0.21, 0.36, 0.52, 0.67, 0.82]
            : count === 4
              ? mirror
                ? [0.24, 0.39, 0.56, 0.72]
                : [0.28, 0.44, 0.61, 0.76]
              : mirror
                ? [0.3, 0.48, 0.67]
                : [0.33, 0.52, 0.7];

      const hookStroke = Math.max(0.95, Math.min(2.1, pxPerInch * 0.14));
      const edgeW = Math.max(2.4, Math.min(6.2, pxPerInch * 0.38));
      const barThick = Math.max(1.5, Math.min(3.8, pxPerInch * 0.25));

      const hookApexY = rodTopY - pxPerInch * 0.44;
      const neckBotY = rodBotY + pxPerInch * 0.96;
      const shoulderY = neckBotY + pxPerInch * 2.55;
      const barY = neckBotY + pxPerInch * 3.35;

      // Full 3D perpendicular hanger span along Z (clamped cleanly in front of wall z > 0)
      const halfZ = rodDepth * 0.85;
      const margin = Math.max(pxPerInch * 1.6, 8);

      const hangers: Array<{
        hx: number;
        hookApexY: number;
        neckBotY: number;
        shoulderY: number;
        barY: number;
        zBack: number;
        zFront: number;
        zRod: number;
      }> = [];

      for (let i = 0; i < baseFracs.length; i++) {
        const jitter = (seeded(i * 11 + 3) - 0.5) * 0.032;
        const rawX = innerLeft + innerSpan * (baseFracs[i] + jitter);
        const hx = Math.max(innerLeft + margin, Math.min(innerRight - margin, rawX));

        hangers.push({
          hx,
          hookApexY,
          neckBotY,
          shoulderY,
          barY,
          zBack: rodDepth - halfZ,
          zFront: rodDepth + halfZ,
          zRod: rodDepth,
        });
      }

      return { pxPerInch, hookStroke, edgeW, barThick, hangers };
    };

    /**
     * True 3D cast shadow of the Shelf + Closet Rod (+ optional minimal clothing hangers) under upper-left directional light:
     * twin protruding cheek brackets + deep horizontal shelf overhang + detached floating chrome rod shadow
     * + full 3D open-triangle hanger shadows unfolding along the exact (LIGHT_KX, LIGHT_KY) light vector.
     */
    const drawShelfIsoShadow = (
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

      // Grounded 3D shelf projection depth stays realistic even on taller 3-row shelves
      const shelfDepth = Math.min(bracketH, m.pitchY * 1.15) * 0.68 * lift;
      const dx = shelfDepth * LIGHT_KX;
      const dy = shelfDepth * LIGHT_KY;

      const rodDepth = shelfDepth * 0.64;
      const rdx = rodDepth * LIGHT_KX;
      const rdy = rodDepth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();

      // 1. Left & right protruding vertical cheek bracket shadows (consistent 1/8" edge rounding)
      appendExtrudedBoxShadowPath(leftX, topY, t, bracketH, dx, dy, r);
      appendExtrudedBoxShadowPath(rightX, topY, t, bracketH, dx, dy, r);

      // 2. Deep horizontal shelf board overhang shadow (from wall z=0 to front edge z=shelfDepth)
      appendExtrudedBoxShadowPath(leftCx, shelfTopY, shelfFullW, shelfH, dx, dy, r * 0.6);

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

      // 4. Minimal Clothing Hangers — Wall Shadow Displays Full 3D Open-Triangle Hanger Profile Along Exact (LIGHT_KX, LIGHT_KY)
      if (showProps && innerSpan > 12) {
        const layout = getShelfHangersLayout(
          innerLeft,
          innerRight,
          rodTopY,
          rodBotY,
          rodDiam,
          rodDepth,
          grainSeed
        );

        if (layout.hangers.length > 0) {
          const projX = (x: number, z: number) => x + z * LIGHT_KX;
          const projY = (y: number, z: number) => y + z * LIGHT_KY;

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = `rgba(18, 20, 24, ${(0.1 * lift).toFixed(3)})`;
          ctx.shadowBlur = 5.5;
          ctx.shadowOffsetX = 1.2 * lift;
          ctx.shadowOffsetY = 1.6 * lift;

          const firstH = layout.hangers[0];
          const lastH = layout.hangers[layout.hangers.length - 1];
          const shGrad = ctx.createLinearGradient(
            projX(firstH.hx, firstH.zBack),
            projY(firstH.hookApexY, firstH.zRod),
            projX(lastH.hx, lastH.zFront),
            projY(lastH.barY, lastH.zFront)
          );
          shGrad.addColorStop(0, `rgba(18, 20, 24, ${(0.2 * lift).toFixed(3)})`);
          shGrad.addColorStop(0.55, `rgba(18, 20, 24, ${(0.135 * lift).toFixed(3)})`);
          shGrad.addColorStop(1, `rgba(18, 20, 24, ${(0.075 * lift).toFixed(3)})`);
          ctx.strokeStyle = shGrad;

          // Curved wire hook + neck shadow hooking seamlessly over the floating chrome rod shadow
          ctx.beginPath();
          for (const h of layout.hangers) {
            const hookZBack = h.zRod - rodDiam * 0.45;
            const hookZFront = h.zRod + rodDiam * 0.45;
            const apexSX = projX(h.hx, h.zRod);
            const apexSY = projY(h.hookApexY, h.zRod);
            const rodTopBackSX = projX(h.hx, hookZBack);
            const rodTopBackSY = projY(rodTopY + rodDiam * 0.28, hookZBack);
            const rodMidFrontSX = projX(h.hx, hookZFront);
            const rodMidFrontSY = projY(rodTopY + rodDiam * 0.62, hookZFront);
            const neckBotSX = projX(h.hx, h.zRod);
            const neckBotSY = projY(h.neckBotY, h.zRod);

            ctx.moveTo(rodTopBackSX, rodTopBackSY);
            ctx.quadraticCurveTo(apexSX, apexSY - 1.5, rodMidFrontSX, rodMidFrontSY);
            ctx.quadraticCurveTo(neckBotSX, projY(rodBotY, h.zRod), neckBotSX, neckBotSY);
          }
          ctx.lineWidth = Math.max(1.4, layout.hookStroke * 0.95);
          ctx.stroke();

          // True 3D perpendicular hanger triangle shadow (bottom bar runs 100% parallel to LIGHT_KX, LIGHT_KY)
          ctx.beginPath();
          for (const h of layout.hangers) {
            const ax = projX(h.hx, h.zRod);
            const ay = projY(h.neckBotY, h.zRod);
            const bShoulderX = projX(h.hx, h.zBack);
            const bShoulderY = projY(h.shoulderY, h.zBack);
            const bx = projX(h.hx, h.zBack);
            const by = projY(h.barY, h.zBack);
            const fShoulderX = projX(h.hx, h.zFront);
            const fShoulderY = projY(h.shoulderY, h.zFront);
            const fx = projX(h.hx, h.zFront);
            const fy = projY(h.barY, h.zFront);

            ctx.moveTo(ax, ay);
            ctx.quadraticCurveTo(
              (ax + bShoulderX) * 0.5,
              ay + (bShoulderY - ay) * 0.35,
              bShoulderX,
              bShoulderY
            );
            ctx.quadraticCurveTo(bx, by, bx + (fx - bx) * 0.08, by + (fy - by) * 0.08);
            ctx.lineTo(fx - (fx - bx) * 0.08, fy - (fy - by) * 0.08);
            ctx.quadraticCurveTo(fx, fy, fShoulderX, fShoulderY);
            ctx.quadraticCurveTo(
              (ax + fShoulderX) * 0.5,
              ay + (fShoulderY - ay) * 0.35,
              ax,
              ay
            );
            ctx.closePath();
          }
          ctx.lineWidth = Math.max(2.0, layout.barThick * 0.9);
          ctx.stroke();

          ctx.restore();
        }
      }
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

      const t = m.slotW * 0.857;
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

      const edgeR = m.slotW * 0.143;
      ctx.save();
      ctx.beginPath();
      appendExtrudedBoxShadowPath(leftX, topY, cabW, cabH, dx, dy, edgeR);
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
      seed = 0,
      showProps = true
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

      // Individual CNC-cut 13-ply Baltic Birch architectural hooks at each column in gx1..gx2
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

        // Horizontal bend transition crease with crisp 1/8" edge-roundover corners (per CASEGOODS2_90825123.svg)
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(hx, seamY + r);
        ctx.quadraticCurveTo(hx, seamY, hx + r, seamY);
        ctx.lineTo(hx + hookW - r, seamY);
        ctx.quadraticCurveTo(hx + hookW, seamY, hx + hookW, seamY + r);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.2 : 1.65;
        ctx.stroke();
      }

      // Optional Simplified Architectural Props (Real-Scale Filson Camo Roll-Top Backpack & Backstrap-Hanging Cap)
      if (showProps) {
        const props = getHookPropsLayout(gx1, gx2, gy1, gy2, m, lift, ox, oy, seed);
        for (const p of props) {
          ctx.save();
          if (isGhost) {
            ctx.setLineDash([4, 3]);
          }

          if (p.kind === 'backpack') {
            const x = p.cx - p.w * 0.5;
            const y = p.topY;
            const rollH = p.h * 0.145;

            // Khaki canvas webbing haul loop hooking cleanly over the Baltic Birch hook peg
            const loopW = Math.max(hookW * 1.45, p.w * 0.24);
            const loopTopY = p.anchorY - Math.max(2, lowerH * 0.12);
            ctx.beginPath();
            ctx.moveTo(p.cx - loopW * 0.48, y + 3);
            ctx.quadraticCurveTo(p.cx - loopW * 0.52, loopTopY, p.cx, loopTopY);
            ctx.quadraticCurveTo(p.cx + loopW * 0.52, loopTopY, p.cx + loopW * 0.48, y + 3);
            ctx.strokeStyle = isGhost ? 'rgba(0, 0, 0, 0.7)' : COLORS.black;
            ctx.lineWidth = Math.max(4.0, p.w * 0.056);
            ctx.lineCap = 'round';
            ctx.stroke();
            if (!isGhost) {
              ctx.strokeStyle = '#B8A382';
              ctx.lineWidth = Math.max(2.1, p.w * 0.032);
              ctx.stroke();
            }

            // Minimal side compression buckle tabs peeking at mid-lower sides
            if (!isGhost) {
              const tabW = Math.max(3.2, p.w * 0.048);
              const tabH = Math.max(6, p.h * 0.055);
              ctx.fillStyle = '#B8A382';
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.05;
              drawRoundRect(x - tabW * 0.65, y + p.h * 0.56, tabW, tabH, 1.4);
              ctx.fill();
              ctx.stroke();
              drawRoundRect(x + p.w - tabW * 0.35, y + p.h * 0.56, tabW, tabH, 1.4);
              ctx.fill();
              ctx.stroke();
            }

            // Main Filson Roll-Top Backpack Silhouette — Warm Khaki Canvas Base
            ctx.beginPath();
            appendHookPropSilhouette('backpack', p.cx, y, p.w, p.h);
            ctx.fillStyle = isGhost ? '#DDD6C3' : '#C8BD9F';
            ctx.fill();

            if (!isGhost) {
              ctx.save();
              ctx.clip();

              // Clean Simplified Organic Duck-Hunter Camo Pattern (Plant-style crisp vector shapes, zero noisy clutter)
              const drawCamoBlob = (
                bx: number,
                by: number,
                rx: number,
                ry: number,
                rot: number,
                color: string
              ) => {
                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(rot);
                ctx.beginPath();
                ctx.moveTo(-rx * 0.85, -ry * 0.15);
                ctx.bezierCurveTo(-rx * 0.95, -ry * 0.95, rx * 0.25, -ry * 1.05, rx * 0.78, -ry * 0.45);
                ctx.bezierCurveTo(rx * 1.15, ry * 0.05, rx * 0.72, ry * 0.98, rx * 0.05, ry * 0.85);
                ctx.bezierCurveTo(-rx * 0.48, ry * 0.75, -rx * 0.78, ry * 0.42, -rx * 0.85, -ry * 0.15);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                ctx.restore();
              };

              // Olive-sage camo shapes
              drawCamoBlob(p.cx - p.w * 0.28, y + p.h * 0.24, p.w * 0.24, p.h * 0.095, -0.35, '#686C52');
              drawCamoBlob(p.cx + p.w * 0.26, y + p.h * 0.42, p.w * 0.25, p.h * 0.105, 0.4, '#686C52');
              drawCamoBlob(p.cx - p.w * 0.24, y + p.h * 0.72, p.w * 0.23, p.h * 0.11, -0.22, '#686C52');
              drawCamoBlob(p.cx + p.w * 0.22, y + p.h * 0.85, p.w * 0.21, p.h * 0.09, 0.3, '#686C52');
              drawCamoBlob(p.cx + p.w * 0.04, y + p.h * 0.07, p.w * 0.2, p.h * 0.06, 0.12, '#686C52');

              // Espresso bark-brown camo shapes
              drawCamoBlob(p.cx + p.w * 0.3, y + p.h * 0.18, p.w * 0.19, p.h * 0.085, 0.25, '#463A31');
              drawCamoBlob(p.cx - p.w * 0.18, y + p.h * 0.46, p.w * 0.21, p.h * 0.085, -0.45, '#463A31');
              drawCamoBlob(p.cx + p.w * 0.28, y + p.h * 0.66, p.w * 0.18, p.h * 0.095, 0.5, '#463A31');
              drawCamoBlob(p.cx - p.w * 0.32, y + p.h * 0.88, p.w * 0.18, p.h * 0.085, -0.3, '#463A31');

              // Warm Filson rust-sienna camo accents
              drawCamoBlob(p.cx - p.w * 0.34, y + p.h * 0.08, p.w * 0.16, p.h * 0.065, 0.22, '#844732');
              drawCamoBlob(p.cx + p.w * 0.36, y + p.h * 0.07, p.w * 0.16, p.h * 0.06, -0.28, '#844732');
              drawCamoBlob(p.cx - p.w * 0.02, y + p.h * 0.34, p.w * 0.17, p.h * 0.075, 0.35, '#844732');
              drawCamoBlob(p.cx + p.w * 0.12, y + p.h * 0.56, p.w * 0.17, p.h * 0.08, -0.32, '#844732');
              drawCamoBlob(p.cx - p.w * 0.22, y + p.h * 0.62, p.w * 0.15, p.h * 0.07, 0.42, '#844732');
              drawCamoBlob(p.cx + p.w * 0.02, y + p.h * 0.82, p.w * 0.16, p.h * 0.075, -0.18, '#844732');

              // Subtle dark espresso canvas bottom base reinforcement band
              ctx.fillStyle = '#463A31';
              ctx.fillRect(p.cx - p.w * 0.6, y + p.h * 0.91, p.w * 1.2, p.h * 0.12);

              // Subtle plant-style upper-left studio highlight & lower-right depth shading
              const packShade = ctx.createLinearGradient(x, y, x + p.w, y + p.h);
              packShade.addColorStop(0.0, 'rgba(255, 255, 255, 0.14)');
              packShade.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
              packShade.addColorStop(1.0, 'rgba(0, 0, 0, 0.16)');
              ctx.fillStyle = packShade;
              ctx.fillRect(p.cx - p.w * 0.6, y, p.w * 1.2, p.h);

              // Crisp horizontal roll-top collar fold line & subtle under-fold shadow
              ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
              ctx.fillRect(p.cx - p.w * 0.56, y + rollH * 1.02, p.w * 1.12, Math.max(2.5, p.h * 0.022));
              ctx.beginPath();
              ctx.moveTo(p.cx - p.w * 0.52, y + rollH * 1.04);
              ctx.quadraticCurveTo(p.cx, y + rollH * 1.22, p.cx + p.w * 0.52, y + rollH * 1.04);
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.2;
              ctx.stroke();

              // Signature Filson center vertical khaki webbing compression strap (over roll-top down to front pocket)
              const strapW = Math.max(7, p.w * 0.145);
              const strapX = p.cx - strapW * 0.5;
              const strapTopY = y - 1;
              const strapBotY = y + p.h * 0.55;
              ctx.fillStyle = '#B8A382';
              ctx.fillRect(strapX, strapTopY, strapW, strapBotY - strapTopY);
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.1;
              ctx.strokeRect(strapX, strapTopY, strapW, strapBotY - strapTopY);

              // Signature burnt-orange horizontal bartack stitch near lower end of compression strap
              const bartackY = strapBotY - Math.max(5, p.h * 0.055);
              ctx.beginPath();
              ctx.moveTo(strapX + 1.2, bartackY);
              ctx.lineTo(strapX + strapW - 1.2, bartackY);
              ctx.strokeStyle = '#D46A3C';
              ctx.lineWidth = 1.4;
              ctx.stroke();

              // Minimal CAD metal ladder-lock buckle bars on upper compression strap
              const bklH = Math.max(5.5, p.h * 0.052);
              const bklY = y + rollH * 0.22;
              drawRoundRect(strapX - 1.2, bklY, strapW + 2.4, bklH, 1.5);
              ctx.fillStyle = '#CFC8B8';
              ctx.fill();
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.05;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(strapX - 0.8, bklY + bklH * 0.5);
              ctx.lineTo(strapX + strapW + 0.8, bklY + bklH * 0.5);
              ctx.stroke();

              // Structured lower front pocket with subtle shadow + curved khaki-trimmed V-flap & snap
              const pktW = p.w * 0.74;
              const pktH = p.h * 0.39;
              const pktX = p.cx - pktW * 0.5;
              const pktY = y + p.h * 0.52;
              const pktR = Math.max(3, p.w * 0.05);

              // Subtle cast shadow under pocket perimeter
              ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
              drawRoundRect(pktX + 1.5, pktY + 2.5, pktW, pktH, pktR);
              ctx.fill();

              // Pocket body (base camo visible inside + crisp architectural outline)
              drawRoundRect(pktX, pktY, pktW, pktH, pktR);
              ctx.fillStyle = 'rgba(200, 189, 159, 0.22)';
              ctx.fill();
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.15;
              ctx.stroke();

              // Iconic curved V-shaped Filson pocket top flap with khaki cotton binding trim
              const flapBotY = pktY + pktH * 0.34;
              ctx.beginPath();
              ctx.moveTo(pktX, pktY + 1);
              ctx.quadraticCurveTo(p.cx, pktY - pktH * 0.05, pktX + pktW, pktY + 1);
              ctx.lineTo(pktX + pktW, pktY + pktH * 0.14);
              ctx.quadraticCurveTo(p.cx, flapBotY + pktH * 0.14, pktX, pktY + pktH * 0.14);
              ctx.closePath();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
              ctx.fill();

              // Khaki binding edge along curved V-flap bottom
              ctx.beginPath();
              ctx.moveTo(pktX, pktY + pktH * 0.12);
              ctx.quadraticCurveTo(p.cx, flapBotY + pktH * 0.12, pktX + pktW, pktY + pktH * 0.12);
              ctx.strokeStyle = '#B8A382';
              ctx.lineWidth = Math.max(2.8, p.w * 0.036);
              ctx.stroke();
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.1;
              ctx.stroke();

              // Centered matte snap button on pocket flap
              ctx.beginPath();
              ctx.arc(p.cx, pktY + pktH * 0.16, Math.max(2.1, p.w * 0.028), 0, Math.PI * 2);
              ctx.fillStyle = '#8F876F';
              ctx.fill();
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 0.95;
              ctx.stroke();

              ctx.restore();
            }

            // Crisp architectural black CAD ink outline
            ctx.beginPath();
            appendHookPropSilhouette('backpack', p.cx, y, p.w, p.h);
            ctx.strokeStyle = isGhost ? 'rgba(0, 0, 0, 0.72)' : COLORS.black;
            ctx.lineWidth = isGhost ? 1.0 : 1.4;
            ctx.stroke();
          } else {
            // Very simple flat 2D wide-brim Stetson felt hat hanging on the birch wall hook
            const y = p.topY;
            const cx = p.cx;
            const cy = y + p.h * 0.5;
            const rx = p.w * 0.5;
            const ry = p.h * 0.5;

            const tracePinchedCrown = (crx: number, cry: number) => {
              // Classic Stetson pinched teardrop crown: rounded back (top), gently pinched front (bottom)
              ctx.beginPath();
              ctx.moveTo(cx, cy - cry);
              ctx.bezierCurveTo(
                cx + crx * 0.82,
                cy - cry,
                cx + crx * 1.06,
                cy - cry * 0.35,
                cx + crx * 0.98,
                cy + cry * 0.14
              );
              ctx.bezierCurveTo(
                cx + crx * 0.9,
                cy + cry * 0.56,
                cx + crx * 0.58,
                cy + cry * 1.0,
                cx,
                cy + cry * 1.0
              );
              ctx.bezierCurveTo(
                cx - crx * 0.58,
                cy + cry * 1.0,
                cx - crx * 0.9,
                cy + cry * 0.56,
                cx - crx * 0.98,
                cy + cry * 0.14
              );
              ctx.bezierCurveTo(
                cx - crx * 1.06,
                cy - cry * 0.35,
                cx - crx * 0.82,
                cy - cry,
                cx,
                cy - cry
              );
              ctx.closePath();
            };

            // 1. Flat 2D wide felt brim
            ctx.beginPath();
            appendHookPropSilhouette('hat', cx, y, p.w, p.h);
            ctx.fillStyle = isGhost ? '#DDD3C3' : '#C8B08E';
            ctx.fill();

            if (!isGhost) {
              // Subtle bound-edge brim stitch line (pure flat 2D CAD detail)
              ctx.beginPath();
              ctx.ellipse(cx, cy, rx * 0.91, ry * 0.91, 0, 0, Math.PI * 2);
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
              ctx.lineWidth = 0.85;
              ctx.stroke();

              // 2. Dark grosgrain hatband encircling crown base
              const bandRx = rx * 0.54;
              const bandRy = ry * 0.56;
              tracePinchedCrown(bandRx, bandRy);
              ctx.fillStyle = '#2B241E';
              ctx.fill();
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.1;
              ctx.stroke();

              // Minimal flat side ribbon keeper/bow accent on left edge of hatband
              const bowW = Math.max(4.5, rx * 0.11);
              const bowH = Math.max(6.5, ry * 0.14);
              drawRoundRect(cx - bandRx - bowW * 0.42, cy - bowH * 0.5, bowW, bowH, 1.4);
              ctx.fillStyle = '#2B241E';
              ctx.fill();
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 0.95;
              ctx.stroke();

              // 3. Flat pinched Stetson felt crown
              const crownRx = rx * 0.46;
              const crownRy = ry * 0.48;
              tracePinchedCrown(crownRx, crownRy);
              ctx.fillStyle = '#D5BF9E';
              ctx.fill();
              ctx.strokeStyle = COLORS.black;
              ctx.lineWidth = 1.1;
              ctx.stroke();

              // 4. Simple flat 2D Stetson center teardrop / cattleman crease
              const creaseTopY = cy - crownRy * 0.62;
              const creaseBotY = cy + crownRy * 0.68;
              const creaseTopW = crownRx * 0.44;
              const creaseBotW = crownRx * 0.24;
              ctx.beginPath();
              ctx.moveTo(cx, creaseTopY);
              ctx.bezierCurveTo(
                cx + creaseTopW,
                creaseTopY,
                cx + creaseTopW * 0.96,
                cy + crownRy * 0.12,
                cx + creaseBotW,
                creaseBotY - crownRy * 0.12
              );
              ctx.quadraticCurveTo(cx, creaseBotY + crownRy * 0.04, cx - creaseBotW, creaseBotY - crownRy * 0.12);
              ctx.bezierCurveTo(
                cx - creaseTopW * 0.96,
                cy + crownRy * 0.12,
                cx - creaseTopW,
                creaseTopY,
                cx,
                creaseTopY
              );
              ctx.closePath();
              ctx.fillStyle = '#B49A77';
              ctx.fill();
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
              ctx.lineWidth = 1.0;
              ctx.stroke();

              // Minimal center crease line
              ctx.beginPath();
              ctx.moveTo(cx, cy - crownRy * 0.4);
              ctx.lineTo(cx, cy + crownRy * 0.44);
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
              ctx.lineWidth = 0.85;
              ctx.lineCap = 'round';
              ctx.stroke();
            }

            // Crisp architectural black CAD ink outer brim outline
            ctx.beginPath();
            appendHookPropSilhouette('hat', cx, y, p.w, p.h);
            ctx.strokeStyle = isGhost ? 'rgba(0, 0, 0, 0.72)' : COLORS.black;
            ctx.lineWidth = isGhost ? 1.0 : 1.35;
            ctx.stroke();
          }

          ctx.restore();
        }
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
      seed = 0,
      showProps = true
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
      const shelfDepth = Math.min(bracketH, m.pitchY * 1.15) * 0.68 * lift;
      const rodDepth = shelfDepth * 0.64;

      const hangerLayout =
        showProps && innerSpan > 12
          ? getShelfHangersLayout(
              innerLeft,
              innerRight,
              rodTopY,
              rodBotY,
              rodDiam,
              rodDepth,
              grainSeed
            )
          : null;

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      // 1. Cylindrical Closet Rod — Subtle Satin-Polished Chrome tubular steel (1.3125" standard diameter)
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

      // 1B. Pure 2D Edge-On Minimal Clothing Hangers (Scaled strictly from 1.3125" rod; wall shadow carries 3D triangular complexity)
      if (hangerLayout && hangerLayout.hangers.length > 0) {
        const { hookStroke, edgeW, hangers } = hangerLayout;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let hi = 0; hi < hangers.length; hi++) {
          const h = hangers[hi];
          const bodyX = h.hx - edgeW * 0.5;
          const bodyH = Math.max(10, h.barY - h.neckBotY);
          const bodyR = edgeW * 0.45;

          if (isGhost) {
            ctx.beginPath();
            ctx.moveTo(h.hx, h.hookApexY);
            ctx.lineTo(h.hx, h.neckBotY);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
            ctx.lineWidth = 1.15;
            ctx.stroke();
            drawRoundRect(bodyX, h.neckBotY, edgeW, bodyH, bodyR);
            ctx.fillStyle = '#ECEBE6';
            ctx.fill();
            ctx.stroke();
            continue;
          }

          // Whisper-subtle contact shadow where the vertical wire hook saddles over the 1.3125" chrome rod
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.fillRect(h.hx - hookStroke * 0.8, rodTopY + 0.5, hookStroke * 1.6, 2.2);

          // Pure 2D edge-on vertical wire hook & neck wrapping straight over the rod
          ctx.beginPath();
          ctx.moveTo(h.hx, h.hookApexY);
          ctx.lineTo(h.hx, h.neckBotY);
          ctx.strokeStyle = COLORS.black;
          ctx.lineWidth = hookStroke + 1.05;
          ctx.stroke();

          ctx.strokeStyle = '#6E747C';
          ctx.lineWidth = Math.max(0.95, hookStroke - 0.35);
          ctx.stroke();

          // Pure 2D edge-on minimal hanger vertical profile (calm architectural Hard Maple/chalk strip)
          drawRoundRect(bodyX, h.neckBotY, edgeW, bodyH, bodyR);
          ctx.fillStyle = '#ECEBE6';
          ctx.fill();

          // Subtle upper-left edge highlight matching the calm monotone books aesthetic
          ctx.save();
          drawRoundRect(bodyX, h.neckBotY, edgeW, bodyH, bodyR);
          ctx.clip();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fillRect(bodyX, h.neckBotY, edgeW * 0.35, bodyH);
          ctx.restore();

          drawRoundRect(bodyX, h.neckBotY, edgeW, bodyH, bodyR);
          ctx.strokeStyle = COLORS.black;
          ctx.lineWidth = 1.05;
          ctx.stroke();

          // Single minimal CAD tick mark at the shoulder-to-trouser-bar transition
          ctx.beginPath();
          ctx.moveTo(bodyX + 0.6, h.shoulderY);
          ctx.lineTo(bodyX + edgeW - 0.6, h.shoulderY);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }

        ctx.restore();
      }

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

      // 3. Continuous Horizontal Shelf Board seated into half-lap dados (leftCx..rightCx) with matching edge rounding
      const shelfR = r * 0.55;
      ctx.setLineDash([]);
      if (isGhost) {
        drawRoundRect(leftCx, shelfTopY, shelfFullW, shelfH, shelfR);
        ctx.fillStyle = '#E8D5B5';
        ctx.fill();
      } else {
        ctx.save();
        drawRoundRect(leftCx, shelfTopY, shelfFullW, shelfH, shelfR);
        ctx.clip();
        drawBirchEdge(leftCx, shelfTopY, shelfFullW, shelfH, 'horizontal', grainSeed + 1);
        ctx.restore();
      }
      drawRoundRect(leftCx, shelfTopY, shelfFullW, shelfH, shelfR);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.3 : 1.75;
      ctx.stroke();

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
      seed = 0,
      doorProgress = 0,
      doorOpenSide: 'left' | 'right' = 'left'
    ) => {
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const grainSeed = seed || gx1 * 11 + gx2 * 17 + gy1 * 23 + gy2 * 29;

      // Uniform 3/4" carcass plywood thickness matching every other modular object on the wall
      const t = m.slotW * 0.857;
      const liftOffset = (1 - lift) * 7;
      const leftX = leftCx - t * 0.5;
      const rightX = rightCx + t * 0.5;
      const cabW = rightX - leftX;
      const topY = upperCy - m.slotH * 0.62 - liftOffset;
      const botY = lowerCy + m.slotH * 0.62 - liftOffset;
      const cabH = botY - topY;

      const innerX = leftX + t;
      const innerY = topY + t;
      const innerW = Math.max(12, cabW - t * 2);
      const innerH = Math.max(16, cabH - t * 2);

      // True bypass sliding doors: each door spans 53.03% of innerW so they overlap cleanly at center when closed
      const p = isGhost ? 0 : Math.max(0, Math.min(1, doorProgress));
      const doorW = innerW * 0.5303;
      const maxTravel = Math.max(0, innerW - doorW);
      const leftDoorX =
        doorOpenSide === 'left' ? innerX + maxTravel * p : innerX;
      const rightDoorX =
        doorOpenSide === 'right'
          ? innerX + innerW - doorW - maxTravel * p
          : innerX + innerW - doorW;

      // Circular finger-pull cutouts ride cleanly with each bypass door panel
      const pullR = Math.max(3.0, Math.min(m.pitchY * 0.1, innerH * 0.075, innerW * 0.042));
      const pullInsetX = Math.max(pullR + 3.5, Math.min(innerW * 0.125, m.pitchX * 0.42));
      const pullInsetY = Math.max(pullR + 4.0, Math.min(innerH * 0.2, m.pitchY * 0.36));
      const leftPullCx = leftDoorX + pullInsetX;
      const rightPullCx = rightDoorX + doorW - pullInsetX;
      const pullCy = innerY + pullInsetY;

      const drawFingerPull = (
        px: number,
        py: number,
        cutSeed: number,
        overlapsRearDoor: boolean
      ) => {
        if (isGhost) {
          ctx.beginPath();
          ctx.arc(px, py, pullR, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.white;
          ctx.fill();
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, pullR, 0, Math.PI * 2);
          ctx.clip();

          // Shows rear door maple if slid over rear door, otherwise recessed vertical-grain back panel
          drawMapleFace(
            px - pullR,
            py - pullR,
            pullR * 2,
            pullR * 2,
            overlapsRearDoor ? 'horizontal' : 'vertical',
            undefined,
            0,
            cutSeed
          );

          ctx.fillStyle = overlapsRearDoor ? 'rgba(0, 0, 0, 0.16)' : 'rgba(0, 0, 0, 0.14)';
          ctx.fillRect(px - pullR, py - pullR, pullR * 2, pullR * 2);

          const rimShadow = ctx.createLinearGradient(
            px - pullR,
            py - pullR,
            px + pullR * 0.6,
            py + pullR * 0.6
          );
          rimShadow.addColorStop(0.0, 'rgba(0, 0, 0, 0.36)');
          rimShadow.addColorStop(0.45, 'rgba(0, 0, 0, 0.09)');
          rimShadow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = rimShadow;
          ctx.fillRect(px - pullR, py - pullR, pullR * 2, pullR * 2);
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(px, py, pullR, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.1 : 1.55;
        ctx.stroke();
      };

      const edgeR = m.slotW * 0.143;
      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      if (isGhost) {
        drawRoundRect(leftX, topY, cabW, cabH, edgeR);
        ctx.fillStyle = '#EAD8BD';
        ctx.fill();
      } else {
        // 1. Outer Carcass Exposed 13-Ply Baltic Birch Edges clipped to consistent 1/8" edge rounding
        ctx.save();
        drawRoundRect(leftX, topY, cabW, cabH, edgeR);
        ctx.clip();
        drawBirchEdge(leftX, topY, t * 0.5, cabH, 'vertical', grainSeed + 1);
        drawBirchEdge(leftCx, innerY, t * 0.5, innerH, 'vertical', grainSeed + 1.4);
        drawBirchEdge(rightCx, topY, t * 0.5, cabH, 'vertical', grainSeed + 2);
        drawBirchEdge(innerX + innerW, innerY, t * 0.5, innerH, 'vertical', grainSeed + 2.4);

        // Top & bottom horizontal carcass panels seated into half-lap rabbets (leftCx..rightCx)
        drawBirchEdge(leftCx, topY, rightCx - leftCx, t, 'horizontal', grainSeed + 3);
        drawBirchEdge(leftCx, innerY + innerH, rightCx - leftCx, t, 'horizontal', grainSeed + 4);
        ctx.restore();

        // 2. Clipped Interior Cavity + Bypass Sliding Doors (Rear Right Door -> Front Left Door)
        ctx.save();
        ctx.beginPath();
        ctx.rect(innerX, innerY, innerW, innerH);
        ctx.clip();

        // 2A. Recessed Cabinet Interior Cavity (revealed cleanly as either door slides open)
        if (p > 0.004) {
          drawMapleFace(innerX, innerY, innerW, innerH, 'vertical', undefined, 0, grainSeed + 13);

          // Recessed interior cavity depth shadows (top, left, and overall subtle recess tone)
          const topShadowH = Math.max(6, Math.min(22, innerH * 0.18));
          const leftShadowW = Math.max(5, Math.min(18, innerW * 0.12));

          const topGrad = ctx.createLinearGradient(0, innerY, 0, innerY + topShadowH);
          topGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.28)');
          topGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.1)');
          topGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = topGrad;
          ctx.fillRect(innerX, innerY, innerW, topShadowH);

          const leftGrad = ctx.createLinearGradient(innerX, 0, innerX + leftShadowW, 0);
          leftGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.22)');
          leftGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.07)');
          leftGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = leftGrad;
          ctx.fillRect(innerX, innerY, leftShadowW, innerH);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.fillRect(innerX, innerY, innerW, innerH);

          // Interior horizontal Baltic Birch divider shelf/shelves on taller cabinets (1 shelf for 3–4 rows, 2 for 5–6 rows)
          if (innerH >= m.pitchY * 1.15) {
            const shelfH = Math.max(3.5, t * 0.72);
            const shelfFracs = innerH >= m.pitchY * 2.65 ? [0.34, 0.67] : [0.5];
            for (let si = 0; si < shelfFracs.length; si++) {
              const shelfY = innerY + innerH * shelfFracs[si] - shelfH * 0.5;
              const shelfUnderGrad = ctx.createLinearGradient(
                0,
                shelfY + shelfH,
                0,
                shelfY + shelfH + 10
              );
              shelfUnderGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.2)');
              shelfUnderGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = shelfUnderGrad;
              ctx.fillRect(innerX, shelfY + shelfH, innerW, 10);

              drawBirchEdge(innerX, shelfY, innerW, shelfH, 'horizontal', grainSeed + 31 + si * 7);
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
              ctx.lineWidth = 1.05;
              ctx.strokeRect(innerX, shelfY, innerW, shelfH);
            }
          }

          // Subtle machined bypass door guide tracks along top & bottom inner rails
          const trackH = Math.max(1.8, t * 0.2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
          ctx.fillRect(innerX, innerY, innerW, trackH);
          ctx.fillRect(innerX, innerY + innerH - trackH, innerW, trackH);
        }

        // 2B. Rear (Right) Bypass Sliding Door — Natural Hard Maple horizontal grain
        drawMapleFace(rightDoorX, innerY, doorW, innerH, 'horizontal', undefined, 0, grainSeed + 9);
        // Subtle recessed shadow along rear door top sliding track
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(rightDoorX, innerY, doorW, Math.max(2.2, t * 0.26));
        // Rear door crisp left & right vertical borders
        ctx.beginPath();
        ctx.moveTo(rightDoorX, innerY);
        ctx.lineTo(rightDoorX, innerY + innerH);
        ctx.moveTo(rightDoorX + doorW, innerY);
        ctx.lineTo(rightDoorX + doorW, innerY + innerH);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = 1.45;
        ctx.stroke();

        // Rear door finger-pull cutout (naturally occluded when it slides behind the front left door!)
        drawFingerPull(rightPullCx, pullCy, grainSeed + 24, false);

        // 2C. Cast Shadow from Front (Left) Bypass Door onto Rear Door & Open Interior Cavity
        const overlapShadowW = Math.max(2.8, Math.min(6.0, t * 0.52));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.17)';
        ctx.fillRect(leftDoorX + doorW, innerY, overlapShadowW, innerH);
        if (leftDoorX > innerX + 1) {
          // Subtle shadow on open interior along left vertical stile of slid front door
          const leftDropW = Math.max(2.2, Math.min(4.8, t * 0.38));
          const leftDropGrad = ctx.createLinearGradient(
            leftDoorX - leftDropW,
            0,
            leftDoorX,
            0
          );
          leftDropGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
          leftDropGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.16)');
          ctx.fillStyle = leftDropGrad;
          ctx.fillRect(leftDoorX - leftDropW, innerY, leftDropW, innerH);
        }

        // 2D. Front (Left) Bypass Sliding Door — Natural Hard Maple horizontal grain
        drawMapleFace(leftDoorX, innerY, doorW, innerH, 'horizontal', undefined, 0, grainSeed + 5);
        // Subtle top-edge highlight on front left door
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(leftDoorX + 1, innerY + 1, Math.max(0, doorW - 2), Math.max(1.8, t * 0.2));
        // Front door crisp architectural vertical edge outlines
        ctx.beginPath();
        ctx.moveTo(leftDoorX, innerY);
        ctx.lineTo(leftDoorX, innerY + innerH);
        ctx.moveTo(leftDoorX + doorW, innerY);
        ctx.lineTo(leftDoorX + doorW, innerY + innerH);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = 1.65;
        ctx.stroke();

        // Front door finger-pull cutout (shows rear door maple if slid across the rear panel)
        const leftPullOverRear =
          leftPullCx >= rightDoorX && leftPullCx <= rightDoorX + doorW;
        drawFingerPull(leftPullCx, pullCy, grainSeed + 17, leftPullOverRear);

        ctx.restore();
      }

      // Outer Carcass Crisp Architectural Ink Frame (consistent 1/8" edge rounding)
      drawRoundRect(leftX, topY, cabW, cabH, edgeR);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.9;
      ctx.stroke();

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

      // Ghost preview door seam & finger-pulls
      if (isGhost) {
        const seamX = innerX + doorW;
        ctx.beginPath();
        ctx.moveTo(seamX, innerY);
        ctx.lineTo(seamX, innerY + innerH);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = 1.15;
        ctx.stroke();

        drawFingerPull(innerX + pullInsetX, pullCy, grainSeed + 17, false);
        drawFingerPull(innerX + innerW - pullInsetX, pullCy, grainSeed + 24, false);
      }

      ctx.restore();
    };

    /**
     * Shared geometry helper for the Pure 2D Baltic Birch Open Cube (min 3×3 hooks).
     * Uses full 3/4" Baltic Birch plywood thickness (m.slotW * 0.857) matching Hook, Shelf + Rod, and Vinyl Box.
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
      const t = m.slotW * 0.857;
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
     * 4A. OPEN CUBE — Directional Cast Shadow
     * Projects the full 3/4" Baltic Birch cube carcass with recessed back panel off the mortise wall.
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
      const depth = Math.min(c.boxH, m.pitchY * 1.45) * 0.44 * lift;
      const dx = depth * LIGHT_KX;
      const dy = depth * LIGHT_KY;

      const edgeR = m.slotW * 0.143;
      ctx.save();
      ctx.beginPath();
      appendExtrudedBoxShadowPath(c.leftX, c.topY, c.boxW, c.boxH, dx, dy, edgeR);
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
     * 4B. OPEN CUBE — Strict Pure 2D Orthographic Front Elevation (min 3×3 hooks)
     * Full 3/4" exposed 13-ply Baltic Birch 4-sided outer carcass with vertical wood-grain interior back panel.
     * Lighting assumes a continuous concealed LED strip recessed 1.5" back around all four interior edges
     * in the selected Kelvin color temperature (2700K / 3000K / 4000K / 5000K) with zero exterior spill.
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
      seed = 0,
      lit = true,
      kelvin: LightKelvin = 2700
    ) => {
      const grainSeed = seed || gx1 * 13 + gx2 * 19 + gy1 * 23 + gy2 * 31;
      const c = getOpenCubeMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const edgeR = m.slotW * 0.143;
      const leftCx = c.leftX + c.t * 0.5;
      const rightCx = c.rightX - c.t * 0.5;
      const innerX = c.leftX + c.t;
      const innerY = c.topY + c.t;
      const innerW = Math.max(18, c.boxW - c.t * 2);
      const innerH = Math.max(18, c.boxH - c.t * 2);
      const isLit = !isGhost && lit;
      const kPal = LIGHT_KELVIN_PRESETS[kelvin];

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
        drawRoundRect(c.leftX, c.topY, c.boxW, c.boxH, edgeR);
        ctx.fillStyle = '#EAD8BD';
        ctx.fill();
      } else {
        // 1. Interior Back Panel — Vertical wood grain matching the object button texture
        drawMapleFace(innerX, innerY, innerW, innerH, 'vertical', undefined, 0, grainSeed + 7);

        if (isLit) {
          // Continuous 360° recessed interior LED strip (1.5" back from front edge on all 4 inner walls)
          ctx.fillStyle = `rgba(${kPal.ambientRgb}, 0.27)`;
          ctx.fillRect(innerX, innerY, innerW, innerH);

          const coveDepthV = Math.max(10, Math.min(innerH * 0.42, c.t * 3.8));
          const coveDepthH = Math.max(10, Math.min(innerW * 0.42, c.t * 3.8));

          // Top interior wall cove wash
          const topCove = ctx.createLinearGradient(0, innerY, 0, innerY + coveDepthV);
          topCove.addColorStop(0.0, `rgba(${kPal.coreRgb}, 0.66)`);
          topCove.addColorStop(0.32, `rgba(${kPal.midRgb}, 0.32)`);
          topCove.addColorStop(0.7, `rgba(${kPal.washRgb}, 0.12)`);
          topCove.addColorStop(1.0, `rgba(${kPal.washRgb}, 0)`);
          ctx.fillStyle = topCove;
          ctx.fillRect(innerX, innerY, innerW, coveDepthV);

          // Bottom interior wall cove wash
          const botCove = ctx.createLinearGradient(0, innerY + innerH, 0, innerY + innerH - coveDepthV);
          botCove.addColorStop(0.0, `rgba(${kPal.coreRgb}, 0.60)`);
          botCove.addColorStop(0.32, `rgba(${kPal.midRgb}, 0.28)`);
          botCove.addColorStop(0.7, `rgba(${kPal.washRgb}, 0.11)`);
          botCove.addColorStop(1.0, `rgba(${kPal.washRgb}, 0)`);
          ctx.fillStyle = botCove;
          ctx.fillRect(innerX, innerY + innerH - coveDepthV, innerW, coveDepthV);

          // Left interior wall cove wash
          const leftCove = ctx.createLinearGradient(innerX, 0, innerX + coveDepthH, 0);
          leftCove.addColorStop(0.0, `rgba(${kPal.coreRgb}, 0.58)`);
          leftCove.addColorStop(0.32, `rgba(${kPal.midRgb}, 0.27)`);
          leftCove.addColorStop(0.7, `rgba(${kPal.washRgb}, 0.10)`);
          leftCove.addColorStop(1.0, `rgba(${kPal.washRgb}, 0)`);
          ctx.fillStyle = leftCove;
          ctx.fillRect(innerX, innerY, coveDepthH, innerH);

          // Right interior wall cove wash
          const rightCove = ctx.createLinearGradient(innerX + innerW, 0, innerX + innerW - coveDepthH, 0);
          rightCove.addColorStop(0.0, `rgba(${kPal.coreRgb}, 0.58)`);
          rightCove.addColorStop(0.32, `rgba(${kPal.midRgb}, 0.27)`);
          rightCove.addColorStop(0.7, `rgba(${kPal.washRgb}, 0.10)`);
          rightCove.addColorStop(1.0, `rgba(${kPal.washRgb}, 0)`);
          ctx.fillStyle = rightCove;
          ctx.fillRect(innerX + innerW - coveDepthH, innerY, coveDepthH, innerH);

          // Subtle luminous continuous cove rim grazing the 4 inner walls (1.5" back from front birch frame)
          ctx.save();
          ctx.strokeStyle = `rgba(${kPal.rimRgb}, 0.82)`;
          ctx.lineWidth = Math.max(1.2, Math.min(2.4, c.t * 0.2));
          ctx.strokeRect(innerX + 1.1, innerY + 1.1, Math.max(0, innerW - 2.2), Math.max(0, innerH - 2.2));
          ctx.restore();
        } else {
          // Unlit architectural daylight — recessed studio shadow depth
          const topShadowH = Math.max(6, Math.min(24, innerH * 0.16));
          const leftShadowW = Math.max(5, Math.min(20, innerW * 0.14));

          const topGrad = ctx.createLinearGradient(0, innerY, 0, innerY + topShadowH);
          topGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.24)');
          topGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.09)');
          topGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = topGrad;
          ctx.fillRect(innerX, innerY, innerW, topShadowH);

          const leftGrad = ctx.createLinearGradient(innerX, 0, innerX + leftShadowW, 0);
          leftGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.2)');
          leftGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.07)');
          leftGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = leftGrad;
          ctx.fillRect(innerX, innerY, leftShadowW, innerH);

          // Gentle overall recessed tone so the interior sits clearly behind the bright front birch edge
          ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
          ctx.fillRect(innerX, innerY, innerW, innerH);
        }

        // 2. Exposed 3/4" 13-Ply Baltic Birch Outer Carcass clipped to consistent 1/8" edge rounding
        ctx.save();
        drawRoundRect(c.leftX, c.topY, c.boxW, c.boxH, edgeR);
        ctx.clip();
        drawBirchEdge(c.leftX, c.topY, c.t * 0.5, c.boxH, 'vertical', grainSeed + 1);
        drawBirchEdge(leftCx, innerY, c.t * 0.5, innerH, 'vertical', grainSeed + 1.4);
        drawBirchEdge(rightCx, c.topY, c.t * 0.5, c.boxH, 'vertical', grainSeed + 2);
        drawBirchEdge(innerX + innerW, innerY, c.t * 0.5, innerH, 'vertical', grainSeed + 2.4);

        // Top & bottom horizontal carcass panels seated 3/8" deep into half-lap dados (leftCx..rightCx)
        drawBirchEdge(leftCx, c.topY, rightCx - leftCx, c.t, 'horizontal', grainSeed + 3);
        drawBirchEdge(leftCx, innerY + innerH, rightCx - leftCx, c.t, 'horizontal', grainSeed + 4);
        ctx.restore();
      }

      // Crisp Architectural CAD Ink Outlines (Outer Frame with consistent 1/8" edge rounding)
      drawRoundRect(c.leftX, c.topY, c.boxW, c.boxH, edgeR);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.9;
      ctx.stroke();

      // Cabinet-Matched 3/8" × 3/4" Half-Lap Dado Corner Joinery + Inner Cavity Frame Lines
      ctx.setLineDash([]);
      ctx.beginPath();
      // Left & right 3/8" dado vertical cuts at top and bottom panels
      ctx.moveTo(leftCx, c.topY);
      ctx.lineTo(leftCx, innerY);
      ctx.moveTo(rightCx, c.topY);
      ctx.lineTo(rightCx, innerY);
      ctx.moveTo(leftCx, innerY + innerH);
      ctx.lineTo(leftCx, c.botY);
      ctx.moveTo(rightCx, innerY + innerH);
      ctx.lineTo(rightCx, c.botY);
      // Inner top & bottom carcass lines extending to the 3/8" dado mid-lines
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
      ctx.lineWidth = isGhost ? 1.05 : 1.45;
      ctx.stroke();

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
      const shelfH = Math.max(4, t * 0.96);
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
      const spanInner = Math.max(20, rightCx - leftCx - earW * 2);
      const plantSideBias = Math.abs(seed) % 2 === 0 ? 0.38 : 0.62;
      const plantCx = leftCx + earW + spanInner * plantSideBias;
      const potW = Math.max(14, Math.min(44, m.pitchX * 0.56));
      const potH = Math.max(12, Math.min(38, m.pitchY * 0.36));
      const saucerH = Math.max(2.0, t * 0.32);
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
      const availH = Math.max(18, potTopY - foliageTopLimitY);
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

      // Main cantilevered horizontal shelf board shadow (consistent 1/8" edge rounding)
      appendExtrudedBoxShadowPath(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH, dx, dy, m.slotW * 0.143);

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

      // 1. Twin Rear Rounded-Top CNC Baltic Birch Mounting Ears Peeking Above the Shelf (consistent 1/8" edge rounding)
      const edgeR = m.slotW * 0.143;
      const drawEar = (cx: number, bSeed: number) => {
        const ex = cx - s.earW * 0.5;
        const topR = Math.min(edgeR, s.earW * 0.48, s.earH * 0.48);
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
        const botR = Math.min(edgeR, s.corbelW * 0.45, s.corbelH * 0.35);
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

      // 4. Main Horizontal Cantilevered 13-Ply Baltic Birch Shelf Board (consistent 1/8" edge rounding)
      ctx.setLineDash([]);
      if (isGhost) {
        drawRoundRect(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH, edgeR);
        ctx.fillStyle = '#E8D5B5';
        ctx.fill();
      } else {
        ctx.save();
        drawRoundRect(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH, edgeR);
        ctx.clip();
        drawBirchEdge(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH, 'horizontal', grainSeed + 1);
        // Subtle crisp top sheen & bottom edge depth
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(s.shelfLeftX + 1, s.shelfTopY + 0.8, Math.max(0, s.shelfW - 2), 1.4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(s.shelfLeftX + 1, s.shelfBotY - 1.8, Math.max(0, s.shelfW - 2), 1.4);
        ctx.restore();
      }
      drawRoundRect(s.shelfLeftX, s.shelfTopY, s.shelfW, s.shelfH, edgeR);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.85;
      ctx.stroke();

      ctx.restore();
    };

    /**
     * 6. VINYL BOX — Cast Shadow
     * 3-sided open-top Baltic Birch plywood U-box (left wall, right wall, bottom floor — exact Shelf + Rod height)
     * + cast shadow of the properly scaled edge-on 12" vinyl records standing inside.
     */
    /**
     * Shared deterministic layout for various-sized calm monotone architectural books
     * (represented in the same clean CAD spine style as the vinyl records, with varied heights & thicknesses).
     */
    const getShelfBooksLayout = (
      innerLeft: number,
      innerRight: number,
      innerBot: number,
      maxBookH: number,
      t: number,
      grainSeed: number
    ) => {
      const innerSpan = Math.max(0, innerRight - innerLeft);
      const hash = (n: number) => {
        const v = Math.sin(n * 127.1 + grainSeed * 311.7) * 43758.5453;
        return v - Math.floor(v);
      };

      // Curated architectural book width & height ratios so adjacent books never look repetitive
      const widthRatios = [0.68, 0.44, 0.92, 0.54, 0.78, 0.46, 0.86, 0.6, 0.98, 0.5];
      const heightRatios = [0.97, 0.76, 0.88, 0.64, 0.93, 0.72, 0.83, 0.6, 0.91, 0.78];

      const upright: Array<{ x: number; y: number; w: number; h: number; idx: number }> = [];
      const leaning: Array<{
        pivotX: number;
        w: number;
        h: number;
        tiltRad: number;
        idx: number;
      }> = [];

      const openGap = Math.max(14, innerSpan * 0.24);
      const limitX = innerRight - openGap;
      const minBookW = Math.max(3.2, t * 0.42);

      let cursor = innerLeft + 0.6;
      let idx = 0;
      const startOffset = Math.abs(grainSeed) % widthRatios.length;

      while (cursor < limitX - minBookW) {
        const pat = (idx + startOffset) % widthRatios.length;
        const wJitter = 0.92 + hash(idx * 7 + 11) * 0.16;
        const rawW = Math.max(minBookW, t * widthRatios[pat] * wJitter);
        const w = Math.min(rawW, limitX - cursor);
        if (w < minBookW * 0.85) break;

        const hJitter = 0.94 + hash(idx * 13 + 5) * 0.1;
        const hRatio = Math.min(1.0, Math.max(0.56, heightRatios[pat] * hJitter));
        const h = Math.max(10, maxBookH * hRatio);
        upright.push({ x: cursor, y: innerBot - h, w, h, idx });
        cursor += w;
        idx++;
      }

      // 1–2 gently leaning books resting naturally against the upright row
      let leanBaseX = cursor + 1.6;
      for (let li = 0; li < 2; li++) {
        const lw = Math.max(minBookW, t * (li === 0 ? 0.62 : 0.48));
        const lh = Math.max(12, maxBookH * (li === 0 ? 0.84 : 0.71));
        const tiltRad = 0.15 + li * 0.065;
        const topShiftX = Math.sin(tiltRad) * lh;
        if (leanBaseX + lw + topShiftX > innerRight - 2.5) break;
        leaning.push({
          pivotX: leanBaseX + topShiftX,
          w: lw,
          h: lh,
          tiltRad,
          idx: idx + 5 + li,
        });
        leanBaseX += lw + 2.4;
      }

      return { upright, leaning };
    };

    const drawVinylBoxIsoShadow = (
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
      const t = m.slotW * 0.857;
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const lowerCy = m.centerY + gy2 * m.pitchY + oy;
      const liftOffset = (1 - lift) * 6;
      const grainSeed = seed || gx1 * 7 + gx2 * 13 + gy1 * 19 + gy2 * 23;

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

      // Tallest art/architecture books peek cleanly above the open-top 3-sided U-box
      const bookTopLimitY = upperCy - m.slotH * 0.34 - liftOffset;
      const maxBookH = Math.max(24, innerBot - bookTopLimitY);

      const boxDepth = Math.min(boxH, m.pitchY * 1.15) * 0.62 * lift;
      const dx = boxDepth * LIGHT_KX;
      const dy = boxDepth * LIGHT_KY;

      const edgeR = m.slotW * 0.143;
      ctx.save();
      ctx.beginPath();
      // Left & right vertical birch side walls (consistent 1/8" edge rounding)
      appendExtrudedBoxShadowPath(leftX, topY, t, boxH, dx, dy, edgeR);
      appendExtrudedBoxShadowPath(rightX - t, topY, t, boxH, dx, dy, edgeR);
      // Bottom horizontal birch floor board
      appendExtrudedBoxShadowPath(innerLeft, innerBot, innerSpan, t, dx, dy, edgeR * 0.6);
      // Stepped cast shadow matching each varied-height upright book (when props enabled)
      if (showProps && innerSpan > 22 && maxBookH > 16) {
        const { upright } = getShelfBooksLayout(
          innerLeft,
          innerRight,
          innerBot,
          maxBookH,
          t,
          grainSeed
        );
        for (const bk of upright) {
          appendExtrudedBoxShadowPath(bk.x, bk.y, bk.w, bk.h, dx * 0.82, dy * 0.82, 0);
        }
      }
      fillDirectionalCastShadow(
        leftX,
        showProps ? bookTopLimitY : topY,
        rightX + dx,
        botY + dy,
        lift,
        8
      );
      ctx.restore();
    };

    /**
     * 6. OPEN BOOK / VINYL SHELF — Pure 2D Architectural Elevation (3-Sided Open-Top Baltic Birch U-Shelf)
     * 5 hooks wide by default, exact same height as Shelf + Rod. Three exposed 13-ply Baltic Birch boards only
     * (left wall, right wall, bottom floor — open top) holding calm monotone various-sized architectural books
     * side-by-side (varied heights, spine thicknesses, and gently leaning end volumes) when props are enabled.
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

      // Tallest architecture monographs peek cleanly proud of the open top; smaller books step down naturally
      const bookTopLimitY = upperCy - m.slotH * 0.34 - liftOffset;
      const maxBookH = Math.max(24, innerBot - bookTopLimitY);

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      // 1. Calm Monotone Various-Sized Architectural Books Side-by-Side (Optional Prop)
      if (showProps && innerSpan > 22 && maxBookH > 16) {
        // Same understated architectural monotone paper & concrete-gray spine palette
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

        const drawBookSpine = (
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
            ctx.fillRect(x + 0.5, y + 0.5, Math.max(0.85, w * 0.2), Math.max(0, h - 1));

            // Minimal CAD spine rule lines on wider architectural monographs
            if (w >= t * 0.62 && (idx + grainSeed) % 2 === 0) {
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
              ctx.lineWidth = 0.7;
              ctx.beginPath();
              ctx.moveTo(x + 1.1, y + h * 0.16);
              ctx.lineTo(x + w - 1.1, y + h * 0.16);
              ctx.moveTo(x + 1.1, y + h * 0.84);
              ctx.lineTo(x + w - 1.1, y + h * 0.84);
              ctx.stroke();
            }
          }

          ctx.strokeStyle = isGhost ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.74)';
          ctx.lineWidth = isGhost ? 0.75 : 0.9;
          ctx.strokeRect(x, y, w, h);
        };

        const { upright, leaning } = getShelfBooksLayout(
          innerLeft,
          innerRight,
          innerBot,
          maxBookH,
          t,
          grainSeed
        );

        ctx.save();
        ctx.beginPath();
        ctx.rect(
          innerLeft + 0.5,
          bookTopLimitY - 8,
          innerSpan - 1,
          innerBot - (bookTopLimitY - 8)
        );
        ctx.clip();

        for (const bk of upright) {
          drawBookSpine(bk.x, bk.y, bk.w, bk.h, bk.idx);
        }

        for (const lb of leaning) {
          ctx.save();
          ctx.translate(lb.pivotX, innerBot);
          ctx.rotate(-lb.tiltRad);
          drawBookSpine(0, -lb.h, lb.w, lb.h, lb.idx);
          ctx.restore();
        }

        // Subtle resting AO line right where the books sit on the bottom Baltic Birch shelf
        if (!isGhost) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.fillRect(innerLeft, innerBot - 2.0, innerSpan, 2.0);
        }
        ctx.restore();
      }

      // 2. Exposed 3/4" 13-Ply Baltic Birch 3-Sided U-Frame with Open Cube–Matched 3/8" × 3/4" Half-Lap Dado Joinery
      const innerWallH = Math.max(0, innerBot - topY);
      // Helper to trace the 3-sided U-profile with consistent 1/8" edge rounding on all outer & top-lip corners
      const edgeR = m.slotW * 0.143;
      const traceRoundedBookShelfU = () => {
        const rTop = Math.min(edgeR, t * 0.42);
        const rBot = Math.min(edgeR, t * 0.48);
        ctx.beginPath();
        ctx.moveTo(innerLeft, innerBot);
        ctx.lineTo(innerLeft, topY + rTop);
        ctx.quadraticCurveTo(innerLeft, topY, innerLeft - rTop, topY);
        ctx.lineTo(leftX + rTop, topY);
        ctx.quadraticCurveTo(leftX, topY, leftX, topY + rTop);
        ctx.lineTo(leftX, botY - rBot);
        ctx.quadraticCurveTo(leftX, botY, leftX + rBot, botY);
        ctx.lineTo(rightX - rBot, botY);
        ctx.quadraticCurveTo(rightX, botY, rightX, botY - rBot);
        ctx.lineTo(rightX, topY + rTop);
        ctx.quadraticCurveTo(rightX, topY, rightX - rTop, topY);
        ctx.lineTo(innerRight + rTop, topY);
        ctx.quadraticCurveTo(innerRight, topY, innerRight, topY + rTop);
        ctx.lineTo(innerRight, innerBot);
        ctx.closePath();
      };

      if (isGhost) {
        traceRoundedBookShelfU();
        ctx.fillStyle = '#E8D5B5';
        ctx.fill();
      } else {
        ctx.save();
        traceRoundedBookShelfU();
        ctx.clip();
        // Vertical side walls split at the 3/8" half-lap dado centerlines (leftCx, rightCx)
        drawBirchEdge(leftX, topY, t * 0.5, boxH, 'vertical', grainSeed + 5);
        drawBirchEdge(leftCx, topY, t * 0.5, innerWallH, 'vertical', grainSeed + 5.4);
        drawBirchEdge(rightCx, topY, t * 0.5, boxH, 'vertical', grainSeed + 9);
        drawBirchEdge(innerRight, topY, t * 0.5, innerWallH, 'vertical', grainSeed + 9.4);

        // Bottom horizontal floor board seated 3/8" deep into half-lap dados (leftCx..rightCx)
        if (rightCx - leftCx > 2) {
          drawBirchEdge(leftCx, innerBot, rightCx - leftCx, t, 'horizontal', grainSeed + 17);
        }
        ctx.restore();
      }

      // 3. Crisp Architectural CAD Ink Outlines (Outer 3-Sided U-Profile with consistent 1/8" edge rounding)
      const rTop = Math.min(edgeR, t * 0.42);
      const rBot = Math.min(edgeR, t * 0.48);
      ctx.beginPath();
      ctx.moveTo(innerLeft, topY + rTop);
      ctx.quadraticCurveTo(innerLeft, topY, innerLeft - rTop, topY);
      ctx.lineTo(leftX + rTop, topY);
      ctx.quadraticCurveTo(leftX, topY, leftX, topY + rTop);
      ctx.lineTo(leftX, botY - rBot);
      ctx.quadraticCurveTo(leftX, botY, leftX + rBot, botY);
      ctx.lineTo(rightX - rBot, botY);
      ctx.quadraticCurveTo(rightX, botY, rightX, botY - rBot);
      ctx.lineTo(rightX, topY + rTop);
      ctx.quadraticCurveTo(rightX, topY, rightX - rTop, topY);
      ctx.lineTo(innerRight + rTop, topY);
      ctx.quadraticCurveTo(innerRight, topY, innerRight, topY + rTop);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.4 : 1.9;
      ctx.stroke();

      // Open Cube–Matched 3/8" × 3/4" Half-Lap Dado Corner Joinery + Inner Cavity Wall Lines
      ctx.setLineDash([]);
      ctx.beginPath();
      // Left & right 3/8" dado vertical cuts at bottom corners
      ctx.moveTo(leftCx, innerBot);
      ctx.lineTo(leftCx, botY);
      ctx.moveTo(rightCx, innerBot);
      ctx.lineTo(rightCx, botY);
      // Inner bottom floor line extending to the 3/8" dado mid-lines
      ctx.moveTo(leftCx, innerBot);
      ctx.lineTo(rightCx, innerBot);
      // Inner left & right vertical side walls down to the floor surface
      ctx.moveTo(innerLeft, topY + rTop);
      ctx.lineTo(innerLeft, innerBot);
      ctx.moveTo(innerRight, topY + rTop);
      ctx.lineTo(innerRight, innerBot);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.05 : 1.45;
      ctx.stroke();

      ctx.restore();
    };

    /**
     * Shared geometry helper for Josh's Custom "Light Shelf" Wall Sconce (2..6 cols × 1 row, wire-free).
     * Faithful 2D architectural front elevation of the uploaded Rhino STL:
     * - Two identical 3/4" Baltic Birch vertical side cheeks centered on the outer mortise slots
     *   (integral rear top-back mortise hooks + generously radiused bottom-front corners)
     * - Recessed 3/4" Baltic Birch horizontal shelf set 3/4" below the top edge of the side cheeks
     * - Full-width routed LED strip & frosted diffuser channel milled into the underside of the shelf
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
      const t = m.slotW * 0.857; // Exact 3/4" Baltic Birch thickness in canvas pixels
      const leftCx = m.centerX + gx1 * m.pitchX + ox;
      const rightCx = m.centerX + gx2 * m.pitchX + ox;
      const upperCy = m.centerY + gy1 * m.pitchY + oy;
      const liftOffset = (1 - lift) * 5;

      // Two identical 3/4" side cheeks centered directly over the left & right mortise slots
      const cheekW = t;
      const leftX = leftCx - cheekW * 0.5;
      const leftInnerX = leftCx + cheekW * 0.5;
      const rightInnerX = rightCx - cheekW * 0.5;
      const rightX = rightCx + cheekW * 0.5;
      const totalW = Math.max(44, rightX - leftX);

      // Top of side cheeks covers the top-back integral mortise hook slot
      const cheekTopY = upperCy - m.slotH * 0.52 - liftOffset;
      const earH = t * 0.78; // Top cheek ears rising ~3/4" above the recessed horizontal shelf
      const shelfT = t; // Exact 3/4" Baltic Birch horizontal shelf
      const shelfTopY = cheekTopY + earH;
      const shelfBotY = shelfTopY + shelfT;
      const cheekTailH = t * 3.15; // Side cheeks extending cleanly below the shelf with radiused bottom-front corners
      const cheekH = earH + shelfT + cheekTailH;
      const cheekBotY = cheekTopY + cheekH;

      // Inner horizontal shelf span + routed under-shelf LED diffuser channel
      const shelfX = leftInnerX;
      const shelfW = Math.max(12, rightInnerX - leftInnerX);
      const ledH = Math.max(2.0, Math.min(4.8, shelfT * 0.28));
      const ledY = shelfBotY - 0.6;

      return {
        t,
        leftCx,
        rightCx,
        upperCy,
        cheekW,
        leftX,
        leftInnerX,
        rightInnerX,
        rightX,
        totalW,
        cheekTopY,
        cheekBotY,
        cheekH,
        earH,
        shelfX,
        shelfW,
        shelfT,
        shelfTopY,
        shelfBotY,
        ledX: shelfX + 1,
        ledY,
        ledW: Math.max(12, shelfW - 2),
        ledH,
      };
    };

    /**
     * 7A. LIGHT SHELF WALL SCONCE — Routed Under-Shelf Diffused Downward Wall Light Wash (Pass 0)
     * Casts a warm 2700K architectural light wash straight down from the diffused LED channel routed into
     * the underside of the horizontal shelf, cleanly framed between the two Baltic Birch side cheeks.
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
      lit: boolean,
      kelvin: LightKelvin = 2700
    ) => {
      if (!lit || lift <= 0.05) return;
      const sc = getWallSconceMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const downReach = Math.max(m.pitchY * 1.42, sc.cheekH * 1.85);
      const flareDown = Math.min(42, sc.shelfW * 0.22);
      const midX = (sc.leftX + sc.rightX) * 0.5;
      const kPal = LIGHT_KELVIN_PRESETS[kelvin];

      ctx.save();

      // 1. Primary Architectural Downward Wall Grazing Wash (in active Kelvin temperature)
      ctx.beginPath();
      ctx.moveTo(sc.leftInnerX, sc.shelfBotY);
      ctx.lineTo(sc.rightInnerX, sc.shelfBotY);
      ctx.lineTo(sc.rightInnerX, sc.cheekBotY - 2);
      ctx.lineTo(sc.rightInnerX + flareDown, sc.shelfBotY + downReach);
      ctx.quadraticCurveTo(
        midX,
        sc.shelfBotY + downReach + 22,
        sc.leftInnerX - flareDown,
        sc.shelfBotY + downReach
      );
      ctx.lineTo(sc.leftInnerX, sc.cheekBotY - 2);
      ctx.closePath();

      const downGrad = ctx.createLinearGradient(0, sc.shelfBotY, 0, sc.shelfBotY + downReach + 18);
      downGrad.addColorStop(0.0, `rgba(${kPal.midRgb}, ${(0.58 * lift).toFixed(3)})`);
      downGrad.addColorStop(0.18, `rgba(${kPal.washRgb}, ${(0.38 * lift).toFixed(3)})`);
      downGrad.addColorStop(0.55, `rgba(${kPal.washRgb}, ${(0.15 * lift).toFixed(3)})`);
      downGrad.addColorStop(0.85, `rgba(${kPal.washRgb}, ${(0.045 * lift).toFixed(3)})`);
      downGrad.addColorStop(1.0, `rgba(${kPal.washRgb}, 0)`);
      ctx.fillStyle = downGrad;
      ctx.fill();

      // 2. Concentrated Diffuser Core directly tucked under the horizontal shelf
      const coreH = Math.max(22, sc.cheekH * 0.45);
      const coreGrad = ctx.createLinearGradient(0, sc.shelfBotY, 0, sc.shelfBotY + coreH);
      coreGrad.addColorStop(0.0, `rgba(${kPal.coreRgb}, ${(0.74 * lift).toFixed(3)})`);
      coreGrad.addColorStop(0.45, `rgba(${kPal.midRgb}, ${(0.34 * lift).toFixed(3)})`);
      coreGrad.addColorStop(1.0, `rgba(${kPal.midRgb}, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.fillRect(sc.leftInnerX, sc.shelfBotY, sc.shelfW, coreH);

      ctx.restore();
    };

    /**
     * 7B. LIGHT SHELF WALL SCONCE — 3D Architectural Cast Shadow (Pass 1)
     * Casts crisp directional shadows projecting both 6"-deep side cheeks and the recessed horizontal shelf off the wall.
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
      const edgeR = m.slotW * 0.143;
      const cheekDepth = sc.t * 2.1 * lift;
      const shelfDepth = cheekDepth * 0.92;
      const cdx = cheekDepth * LIGHT_KX;
      const cdy = cheekDepth * LIGHT_KY;
      const sdx = shelfDepth * LIGHT_KX;
      const sdy = shelfDepth * LIGHT_KY;

      ctx.save();
      ctx.beginPath();
      appendExtrudedBoxShadowPath(sc.leftX, sc.cheekTopY, sc.cheekW, sc.cheekH, cdx, cdy, edgeR);
      appendExtrudedBoxShadowPath(sc.rightInnerX, sc.cheekTopY, sc.cheekW, sc.cheekH, cdx, cdy, edgeR);
      appendExtrudedBoxShadowPath(sc.shelfX, sc.shelfTopY, sc.shelfW, sc.shelfT, sdx, sdy, edgeR * 0.55);
      fillDirectionalCastShadow(
        sc.leftX,
        sc.cheekTopY,
        sc.rightX + cdx,
        sc.cheekBotY + cdy,
        lift,
        8
      );
      ctx.restore();
    };

    /**
     * 7C. LIGHT SHELF WALL SCONCE — Pure 2D Architectural Elevation (Pass 2)
     * Two 3/4" Baltic Birch side cheeks with integral rear hooks & consistent 1/8" edge rounding,
     * recessed 3/4" horizontal Baltic Birch shelf, and routed under-shelf frosted LED diffuser bar.
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
      lit = true,
      kelvin: LightKelvin = 2700
    ) => {
      const grainSeed = seed || gx1 * 17 + gx2 * 23 + gy1 * 31;
      const sc = getWallSconceMetrics(gx1, gx2, gy1, gy2, m, lift, ox, oy);
      const edgeR = m.slotW * 0.143;
      const isLit = !isGhost && lit;
      const kPal = LIGHT_KELVIN_PRESETS[kelvin];

      ctx.save();
      if (isGhost) {
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 3]);
      }

      // 1. Left & Right Identical 3/4" Baltic Birch Side Cheeks (consistent 1/8" edge rounding)
      const drawSideCheek = (cxLeft: number, isLeft: boolean, cheekSeed: number) => {
        drawRoundRect(cxLeft, sc.cheekTopY, sc.cheekW, sc.cheekH, edgeR);

        if (isGhost) {
          ctx.fillStyle = '#E8D5B5';
          ctx.fill();
        } else {
          ctx.save();
          ctx.clip();

          // Vertical 13-ply Baltic Birch plywood front edge
          drawBirchEdge(cxLeft, sc.cheekTopY, sc.cheekW, sc.cheekH, 'vertical', cheekSeed);

          // Smooth curved lower-front fillet roll-off shading (matches the 1.5" radius bottom-front corner in the Rhino STL)
          const filletStartY = sc.cheekBotY - sc.cheekH * 0.28;
          const filletShade = ctx.createLinearGradient(0, filletStartY, 0, sc.cheekBotY);
          filletShade.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
          filletShade.addColorStop(0.55, 'rgba(0, 0, 0, 0.12)');
          filletShade.addColorStop(1.0, 'rgba(0, 0, 0, 0.34)');
          ctx.fillStyle = filletShade;
          ctx.fillRect(cxLeft, filletStartY, sc.cheekW, sc.cheekBotY - filletStartY);

          // Subtle Kelvin LED graze along the inner edge of the cheek below the shelf when lit
          if (isLit) {
            const grazeX0 = isLeft ? cxLeft + sc.cheekW : cxLeft;
            const grazeX1 = isLeft ? cxLeft + sc.cheekW * 0.3 : cxLeft + sc.cheekW * 0.7;
            const innerGlow = ctx.createLinearGradient(grazeX0, 0, grazeX1, 0);
            innerGlow.addColorStop(0.0, `rgba(${kPal.midRgb}, 0.46)`);
            innerGlow.addColorStop(1.0, `rgba(${kPal.midRgb}, 0)`);
            ctx.fillStyle = innerGlow;
            ctx.fillRect(cxLeft, sc.shelfBotY, sc.cheekW, sc.cheekBotY - sc.shelfBotY);
          }

          ctx.restore();
        }

        // Crisp Black CAD Outer Frame
        drawRoundRect(cxLeft, sc.cheekTopY, sc.cheekW, sc.cheekH, edgeR);
        ctx.strokeStyle = COLORS.black;
        ctx.lineWidth = isGhost ? 1.3 : 1.85;
        ctx.stroke();
      };

      drawSideCheek(sc.leftX, true, grainSeed + 11);
      drawSideCheek(sc.rightInnerX, false, grainSeed + 19);

      // 2. Routed Under-Shelf Frosted Acrylic LED Diffuser Strip (flush along bottom edge between the inner cheek faces)
      if (!isGhost) {
        ctx.save();
        drawRoundRect(sc.ledX, sc.ledY, sc.ledW, sc.ledH, 1.0);
        if (isLit) {
          const ledGrad = ctx.createLinearGradient(0, sc.ledY, 0, sc.ledY + sc.ledH);
          ledGrad.addColorStop(0.0, '#FFFFFF');
          ledGrad.addColorStop(0.55, kPal.diffuserMid);
          ledGrad.addColorStop(1.0, kPal.diffuserBot);
          ctx.fillStyle = ledGrad;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.lineWidth = 0.9;
          ctx.stroke();
        } else {
          // Unlit recessed matte frosted acrylic diffuser
          ctx.fillStyle = '#E4E2DC';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
          ctx.lineWidth = 0.95;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 3. Continuous 3/4" Horizontal Shelf Board seated 3/8" deep into half-lap dados (leftCx..rightCx) with matching edge rounding
      const dadoShelfW = Math.max(16, sc.rightCx - sc.leftCx);
      const shelfR = edgeR * 0.55;
      ctx.setLineDash([]);
      if (isGhost) {
        drawRoundRect(sc.leftCx, sc.shelfTopY, dadoShelfW, sc.shelfT, shelfR);
        ctx.fillStyle = '#EAD8BD';
        ctx.fill();
      } else {
        ctx.save();
        drawRoundRect(sc.leftCx, sc.shelfTopY, dadoShelfW, sc.shelfT, shelfR);
        ctx.clip();

        // Continuous exposed horizontal 13-ply Baltic Birch plywood front edge
        drawBirchEdge(sc.leftCx, sc.shelfTopY, dadoShelfW, sc.shelfT, 'horizontal', grainSeed + 3);

        // Subtle gallery bevel shading (crisp top edge highlight + slight underside Kelvin tint)
        const shelfBevel = ctx.createLinearGradient(0, sc.shelfTopY, 0, sc.shelfBotY);
        shelfBevel.addColorStop(0.0, 'rgba(255, 255, 255, 0.22)');
        shelfBevel.addColorStop(0.28, 'rgba(255, 255, 255, 0)');
        shelfBevel.addColorStop(0.76, 'rgba(0, 0, 0, 0.04)');
        shelfBevel.addColorStop(1.0, isLit ? `rgba(${kPal.washRgb}, 0.24)` : 'rgba(0, 0, 0, 0.16)');
        ctx.fillStyle = shelfBevel;
        ctx.fillRect(sc.leftCx, sc.shelfTopY, dadoShelfW, sc.shelfT);

        ctx.restore();
      }

      drawRoundRect(sc.leftCx, sc.shelfTopY, dadoShelfW, sc.shelfT, shelfR);
      ctx.strokeStyle = COLORS.black;
      ctx.lineWidth = isGhost ? 1.3 : 1.75;
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
          drawWallHookIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy, seed, showProps);
          break;
        case 'shelf':
          drawShelfIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy, seed, showProps);
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
          drawVinylBoxIsoShadow(gx1, gx2, gy1, gy2, m, lift, ox, oy, seed, showProps);
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
      showProps = true,
      doorProgress = 0,
      doorOpenSide: 'left' | 'right' = 'left',
      lightKelvin: LightKelvin = 2700
    ) => {
      switch (type) {
        case 'hook':
          drawWallHook(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, showProps);
          break;
        case 'shelf':
          drawShelfWithRod(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, showProps);
          break;
        case 'cabinet':
          drawSlidingDoorCabinet(
            gx1,
            gx2,
            gy1,
            gy2,
            m,
            lift,
            ox,
            oy,
            isGhost,
            seed,
            doorProgress,
            doorOpenSide
          );
          break;
        case 'cubby':
          drawOpenCube(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, lit, lightKelvin);
          break;
        case 'wallShelf':
          drawWallShelf(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, showProps);
          break;
        case 'cradle':
          drawVinylBox(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, showProps);
          break;
        case 'sconce':
          drawWallSconce(gx1, gx2, gy1, gy2, m, lift, ox, oy, isGhost, seed, lit, lightKelvin);
          break;
      }
    };

    const triggerRipple = (nx: number, ny: number) => {
      rippleX = nx;
      rippleY = ny;
      rippleTime = performance.now();
      ensureLoop();
    };

    let lastArrangementArchetype = -1;

    /**
     * Generates a practical, architecturally composed Baltic Birch modular wall layout
     * weighted 60% Aesthetic Composition Rules and 40% Real-World Functionality Rules,
     * with controlled room for organic human variation on each Rearrange click.
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

      // 60% Visually Pleasing / 40% Functional mobile composition engine (curated pieces, no lighting or props)
      if (cssW < 768) {
        let mMinGy = Infinity;
        let mMaxGy = -Infinity;
        let mMinGx = Infinity;
        let mMaxGx = -Infinity;
        for (const s of openSlots) {
          if (s.gy < mMinGy) mMinGy = s.gy;
          if (s.gy > mMaxGy) mMaxGy = s.gy;
          if (s.gx < mMinGx) mMinGx = s.gx;
          if (s.gx > mMaxGx) mMaxGx = s.gx;
        }
        const mRowSpan = Math.max(1, mMaxGy - mMinGy);
        const mColSpan = Math.max(1, mMaxGx - mMinGx);
        const mMidGx = (mMinGx + mMaxGx) * 0.5;
        const mTotalCells = openSlots.length;

        type MobilePiece = {
          type: WallTool;
          gx1: number;
          gx2: number;
          gy1: number;
          gy2: number;
          cols: number;
          rows: number;
        };

        const gauss = (v: number, ideal: number, spread: number) =>
          Math.exp(-Math.pow((v - ideal) / Math.max(0.05, spread), 2));

        // Curated palettes combining focal mass, horizontal plane, sculptural cube, and functional hooks
        const palettes: Array<Array<{ type: WallTool; cols: number; rows: number }>> = [
          [
            { type: 'cabinet', cols: 3, rows: 2 },
            { type: 'wallShelf', cols: 3, rows: 1 },
            { type: 'cubby', cols: 2, rows: 2 },
            { type: 'wallShelf', cols: 2, rows: 1 },
            { type: 'hook', cols: 1, rows: 1 },
            { type: 'hook', cols: 1, rows: 1 },
          ],
          [
            { type: 'cabinet', cols: 3, rows: 2 },
            { type: 'cubby', cols: 2, rows: 2 },
            { type: 'cubby', cols: 2, rows: 2 },
            { type: 'wallShelf', cols: 3, rows: 1 },
            { type: 'hook', cols: 1, rows: 1 },
            { type: 'hook', cols: 1, rows: 1 },
            { type: 'hook', cols: 1, rows: 1 },
          ],
          [
            { type: 'cabinet', cols: 2, rows: 2 },
            { type: 'wallShelf', cols: 3, rows: 1 },
            { type: 'cubby', cols: 2, rows: 2 },
            { type: 'wallShelf', cols: 2, rows: 1 },
            { type: 'hook', cols: 1, rows: 1 },
            { type: 'hook', cols: 1, rows: 1 },
          ],
        ];

        const functionalScoreForPiece = (p: MobilePiece): number => {
          const topNorm = (p.gy1 - mMinGy) / mRowSpan;
          const midNorm = ((p.gy1 + p.gy2) * 0.5 - mMinGy) / mRowSpan;
          const botNorm = (p.gy2 - mMinGy) / mRowSpan;
          if (p.type === 'wallShelf') return gauss(topNorm, 0.22, 0.24);
          if (p.type === 'cubby') return gauss(midNorm, 0.38, 0.25);
          if (p.type === 'cabinet') return gauss(midNorm, 0.52, 0.22);
          // Hooks work best in the reachable lower zone with breathing space below
          return gauss(botNorm, 0.78, 0.22);
        };

        const scoreMobileLayout = (layout: MobilePiece[]): number => {
          if (layout.length === 0) return -1;
          let usedCells = 0;
          let leftMass = 0;
          let rightMass = 0;
          let funcSum = 0;
          const types = new Set<WallTool>();

          for (const p of layout) {
            const area = p.cols * p.rows;
            usedCells += area;
            const cx = (p.gx1 + p.gx2) * 0.5;
            if (cx < mMidGx) leftMass += area;
            else if (cx > mMidGx) rightMass += area;
            else {
              leftMass += area * 0.5;
              rightMass += area * 0.5;
            }
            funcSum += functionalScoreForPiece(p);
            types.add(p.type);
          }

          // 60% Aesthetic: left/right visual balance + target 38%–50% density + asymmetric focal counterweight + silhouette variety
          const balanceScore = 1 - Math.abs(leftMass - rightMass) / Math.max(1, leftMass + rightMass);
          const density = usedCells / Math.max(1, mTotalCells);
          const densityScore = gauss(density, 0.42, 0.16);
          const varietyScore = Math.min(1, types.size / 4);
          const cab = layout.find((p) => p.type === 'cabinet');
          const offCenterAnchor = cab
            ? gauss(Math.abs((cab.gx1 + cab.gx2) * 0.5 - mMidGx) / Math.max(1, mColSpan), 0.24, 0.18)
            : 0.6;
          const aestheticScore =
            0.34 * balanceScore + 0.30 * densityScore + 0.20 * varietyScore + 0.16 * offCenterAnchor;

          // 40% Functional: ergonomic vertical zoning + reachable hooks
          const functionalScore = funcSum / layout.length;

          return 0.6 * aestheticScore + 0.4 * functionalScore;
        };

        let bestLayout: MobilePiece[] = [];
        let bestScore = -Infinity;

        for (let trial = 0; trial < 36; trial++) {
          const palette = palettes[trial % palettes.length];
          const placed: MobilePiece[] = [];

          for (const spec of palette) {
            const cands: MobilePiece[] = [];
            for (const s of openSlots) {
              const gx1 = s.gx;
              const gx2 = gx1 + spec.cols - 1;
              const gy1 = s.gy;
              const gy2 = gy1 + spec.rows - 1;
              if (!canPlaceRect(gx1, gx2, gy1, gy2)) continue;
              // Require 1-cell breathing room between major pieces; allow hooks to pair side-by-side cleanly
              const pad = spec.type === 'hook' ? 0 : 1;
              const collides = placed.some((p) => {
                const effPad = spec.type === 'hook' && p.type === 'hook' ? 0 : Math.max(pad, p.type === 'hook' ? 0 : 1);
                return (
                  gx1 <= p.gx2 + effPad &&
                  gx2 >= p.gx1 - effPad &&
                  gy1 <= p.gy2 + effPad &&
                  gy2 >= p.gy1 - effPad
                );
              });
              if (!collides) {
                cands.push({ type: spec.type, gx1, gx2, gy1, gy2, cols: spec.cols, rows: spec.rows });
              }
            }
            if (cands.length === 0) continue;
            // Bias candidate selection toward ergonomic functional zone while preserving organic variety
            cands.sort((a, b) => functionalScoreForPiece(b) - functionalScoreForPiece(a));
            const topK = Math.max(1, Math.min(cands.length, 6));
            const pick = cands[Math.floor(Math.random() * topK)];
            placed.push(pick);
          }

          const sc = scoreMobileLayout(placed);
          if (sc > bestScore) {
            bestScore = sc;
            bestLayout = placed;
          }
        }

        for (const p of bestLayout) {
          addPlacedItem(p.type, p.gx1, p.gx2, p.gy1, p.gy2, withPulse);
        }
        if (withPulse) triggerRipple(0.5, 0.5);
        return;
      }

      const AESTHETIC_WEIGHT = 0.6;
      const FUNCTIONAL_WEIGHT = 0.4;

      const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      const gaussScore = (val: number, ideal: number, spread: number) =>
        Math.exp(-Math.pow((val - ideal) / Math.max(0.05, spread), 2));

      // Measure actual open wall bounds (smaller gy = higher toward ceiling, larger gy = lower toward floor)
      let minOpenGy = Infinity;
      let maxOpenGy = -Infinity;
      for (let i = 0; i < openSlots.length; i++) {
        const s = openSlots[i];
        if (s.gy < minOpenGy) minOpenGy = s.gy;
        if (s.gy > maxOpenGy) maxOpenGy = s.gy;
      }
      const rowSpan = Math.max(1, maxOpenGy - minOpenGy);
      const totalOpenCells = openSlots.length;

      type WallBay = 'left' | 'right' | 'center';
      interface CandidateRect {
        gx1: number;
        gx2: number;
        gy1: number;
        gy2: number;
        cols: number;
        rows: number;
        bay: WallBay;
        midX: number;
        topNorm: number;
        midNorm: number;
        botNorm: number;
      }
      interface LayoutPiece extends CandidateRect {
        type: WallTool;
      }

      const classifyBay = (midX: number): WallBay => {
        if (midX < cssW * 0.46) return 'left';
        if (midX > cssW * 0.54) return 'right';
        return 'center';
      };

      const hasLeftBay = openSlots.some((s) => s.cx < cssW * 0.46);
      const hasRightBay = openSlots.some((s) => s.cx > cssW * 0.54);
      const dualBayWall = hasLeftBay && hasRightBay;

      // Precompute all valid rectangles by "cols,rows" once for fast multi-candidate evaluation
      const rectsBySize = new Map<string, CandidateRect[]>();
      const getValidRects = (cols: number, rows: number): CandidateRect[] => {
        const sizeKey = `${cols}x${rows}`;
        const cached = rectsBySize.get(sizeKey);
        if (cached) return cached;
        const list: CandidateRect[] = [];
        for (let i = 0; i < openSlots.length; i++) {
          const s = openSlots[i];
          const gx1 = s.gx;
          const gx2 = s.gx + cols - 1;
          const gy1 = s.gy;
          const gy2 = s.gy + rows - 1;
          if (!canPlaceRect(gx1, gx2, gy1, gy2)) continue;
          const midX = gridMeta.centerX + ((gx1 + gx2) * 0.5) * gridMeta.pitchX;
          list.push({
            gx1,
            gx2,
            gy1,
            gy2,
            cols,
            rows,
            bay: classifyBay(midX),
            midX,
            topNorm: (gy1 - minOpenGy) / rowSpan,
            midNorm: ((gy1 + gy2) * 0.5 - minOpenGy) / rowSpan,
            botNorm: (gy2 - minOpenGy) / rowSpan,
          });
        }
        rectsBySize.set(sizeKey, list);
        return list;
      };

      // Visual mass density per modular object (drives left/right balance & visual gravity)
      const VISUAL_DENSITY: Record<WallTool, number> = {
        cabinet: 1.38,
        cubby: 1.18,
        cradle: 0.96,
        shelf: 0.9,
        wallShelf: 0.82,
        sconce: 0.48,
        hook: 0.46,
      };
      const pieceVisualMass = (p: { type: WallTool; cols: number; rows: number }) =>
        p.cols * p.rows * VISUAL_DENSITY[p.type];

      const colsOverlap = (
        a: { gx1: number; gx2: number },
        b: { gx1: number; gx2: number }
      ) => a.gx1 <= b.gx2 && b.gx1 <= a.gx2;

      const rowsOverlap = (
        a: { gy1: number; gy2: number },
        b: { gy1: number; gy2: number }
      ) => a.gy1 <= b.gy2 && b.gy1 <= a.gy2;

      // Real-world ergonomic height suitability (0..1) for each modular object on an actual wall
      const ergonomicHeightScore = (type: WallTool, r: CandidateRect): number => {
        switch (type) {
          case 'sconce': {
            // Architectural wall lighting belongs high / upper-mid wall, never ankle-height
            let s = gaussScore(r.topNorm, 0.14, 0.24);
            if (r.topNorm > 0.52) s *= 0.22;
            if (r.topNorm > 0.66) s *= 0.1;
            return clamp01(s);
          }
          case 'shelf': {
            // Closet rod + shelf: comfortable upper-mid reach with floor clearance for hanging clothes
            let s = gaussScore(r.midNorm, 0.28, 0.22);
            if (r.botNorm > 0.72) s *= 0.28;
            if (maxOpenGy - r.gy2 < 1 && rowSpan >= 4) s *= 0.08;
            return clamp01(s);
          }
          case 'wallShelf': {
            // Display shelf with sculptural plant + books: upper-to-mid eye level, headroom preferred
            let s = gaussScore(r.midNorm, 0.36, 0.26);
            if (r.gy1 === minOpenGy && rowSpan >= 4) s *= 0.76;
            if (r.botNorm > 0.86) s *= 0.45;
            return clamp01(s);
          }
          case 'cradle': {
            // Book Shelf: natural eye-to-waist browsing & reach zone
            let s = gaussScore(r.midNorm, 0.46, 0.26);
            if (r.topNorm < 0.06 && rowSpan >= 5) s *= 0.72;
            return clamp01(s);
          }
          case 'hook': {
            // Everyday carry hooks (backpack & hat): reachable mid-wall height, never ceiling or floor
            let s = gaussScore(r.midNorm, 0.46, 0.24);
            if (r.gy1 === minOpenGy && rowSpan >= 4) s *= 0.35;
            if (r.gy2 === maxOpenGy && rowSpan >= 3) s *= 0.12;
            return clamp01(s);
          }
          case 'cubby': {
            // Open Cube: focal mid-to-lower gallery height
            let s = gaussScore(r.midNorm, 0.56, 0.26);
            if (r.topNorm < 0.04 && rowSpan >= 5) s *= 0.65;
            return clamp01(s);
          }
          case 'cabinet': {
            // Sliding-door Cabinet: anchors lower-to-mid credenza/waist zone
            let s = gaussScore(r.midNorm, 0.72, 0.25);
            if (r.topNorm < 0.16 && rowSpan >= 4) s *= 0.28;
            return clamp01(s);
          }
        }
      };

      // Helper: checks if a drop zone below a piece would intrude into the centered hero cutout
      const dropHitsHeroCutout = (p: LayoutPiece, dropRows: number): boolean => {
        if (!heroCutout) return false;
        const hitsX = p.gx1 <= heroCutout.gxMax && p.gx2 >= heroCutout.gxMin;
        if (!hitsX) return false;
        return p.gy2 < heroCutout.gyMin && p.gy2 + dropRows >= heroCutout.gyMin;
      };

      // Check real-world physical clearance & non-interference for piece `p` against all other items
      const pieceClearanceScore = (p: LayoutPiece, all: LayoutPiece[]): number => {
        let score = 1.0;

        if (p.type === 'shelf') {
          // Garment hangers hang ~1.5–2 rows downward beneath the closet rod (never dangle over center logo)
          const wallRowsBelow = maxOpenGy - p.gy2;
          if (dropHitsHeroCutout(p, 2)) score -= 0.96;
          if (rowSpan >= 4 && wallRowsBelow < 2) score -= 0.78;
          else if (rowSpan >= 6 && wallRowsBelow < 3) score -= 0.26;

          for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (o === p || !colsOverlap(p, o)) continue;
            const gapBelow = o.gy1 - p.gy2 - 1;
            if (gapBelow === 0) score -= 0.85;
            else if (gapBelow === 1) score -= 0.56;
            else if (gapBelow === 2 && o.type !== 'cabinet') score -= 0.18;
          }
        } else if (p.type === 'hook') {
          // Real-scale Filson backpack (~2.4 rows) & hanging cap (~1.5 rows) need clear open drop below the hook
          const wallRowsBelow = maxOpenGy - p.gy2;
          if (dropHitsHeroCutout(p, 3)) score -= 0.96;
          if (rowSpan >= 4 && wallRowsBelow < 2) score -= 0.82;
          else if (rowSpan >= 6 && wallRowsBelow < 3) score -= 0.34;
          for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (o === p || !colsOverlap(p, o)) continue;
            const gapBelow = o.gy1 - p.gy2 - 1;
            if (gapBelow === 0) score -= 0.84;
            else if (gapBelow === 1) score -= 0.56;
            else if (gapBelow === 2) score -= 0.22;
            // Hooks shouldn't sit trapped underneath a garment rod's hanging clothes
            if (o.type === 'shelf') {
              const distBelowRod = p.gy1 - o.gy2 - 1;
              if (distBelowRod >= 0 && distBelowRod <= 2) score -= 0.68;
            }
          }
        } else if (p.type === 'wallShelf') {
          // Sculptural plant + books rise above the top surface
          for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (o === p || !colsOverlap(p, o)) continue;
            const gapAbove = p.gy1 - o.gy2 - 1;
            if (gapAbove === 0) score -= 0.56;
            if (o.type === 'shelf' && gapAbove >= 0 && gapAbove <= 2) score -= 0.55;
            if (o.type === 'hook' && gapAbove === 0) score -= 0.5;
          }
        } else if (p.type === 'cradle') {
          // Open-top Book Shelf needs clear access above to pull books out
          for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (o === p || !colsOverlap(p, o)) continue;
            const gapAbove = p.gy1 - o.gy2 - 1;
            if (gapAbove === 0) score -= 0.44;
            if (o.type === 'shelf' && gapAbove >= 0 && gapAbove <= 1) score -= 0.55;
          }
        } else if (p.type === 'sconce') {
          // Sconce casts warm ambient light — don't trap it directly beneath a deep cabinet/cube overhang
          for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (o === p || !colsOverlap(p, o)) continue;
            const gapAbove = p.gy1 - o.gy2 - 1;
            if (gapAbove === 0 && (o.type === 'cabinet' || o.type === 'cubby' || o.type === 'shelf')) {
              score -= 0.62;
            }
            const gapBelow = o.gy1 - p.gy2 - 1;
            if (gapBelow === 0 && (o.type === 'wallShelf' || o.type === 'cradle')) {
              // Too tight directly on top of plant/books
              score -= 0.25;
            }
          }
        } else if (p.type === 'cabinet' || p.type === 'cubby') {
          // Heavy base/focal units shouldn't sit inside a garment rod or backpack drop zone
          for (let i = 0; i < all.length; i++) {
            const o = all[i];
            if (o === p || !colsOverlap(p, o)) continue;
            const gapAbove = p.gy1 - o.gy2 - 1;
            if (o.type === 'shelf' && gapAbove >= 0 && gapAbove <= 1) score -= 0.72;
            if (o.type === 'hook' && gapAbove === 0) score -= 0.62;
          }
        }

        return clamp01(score);
      };

      // Score a single candidate placement during constructive generation (60% Aesthetic / 40% Functional)
      const scoreLocalPlacement = (
        type: WallTool,
        r: CandidateRect,
        placed: LayoutPiece[],
        preferredBay: WallBay | null,
        errorTolerance: number
      ): number => {
        const piece: LayoutPiece = { ...r, type };
        const tempAll = [...placed, piece];

        // --- FUNCTIONAL COMPONENT (0..100) ---
        const heightPts = ergonomicHeightScore(type, r) * 44;
        const clearancePts = pieceClearanceScore(piece, tempAll) * 42;
        let synergyPts = 7;

        for (let i = 0; i < placed.length; i++) {
          const o = placed[i];
          const overlapX = colsOverlap(r, o);
          // Task lighting: Sconce illuminating a Cabinet, Book Shelf, Wall Shelf, or Open Cube 1–3 rows below
          if (type === 'sconce' && overlapX) {
            const gapBelow = o.gy1 - r.gy2 - 1;
            if (
              gapBelow >= 1 &&
              gapBelow <= 3 &&
              (o.type === 'cabinet' || o.type === 'cradle' || o.type === 'wallShelf' || o.type === 'cubby')
            ) {
              synergyPts += 9;
            }
          } else if (
            o.type === 'sconce' &&
            overlapX &&
            (type === 'cabinet' || type === 'cradle' || type === 'wallShelf' || type === 'cubby')
          ) {
            const gapAbove = r.gy1 - o.gy2 - 1;
            if (gapAbove >= 1 && gapAbove <= 3) synergyPts += 7;
          }
          // Wardrobe / Entryway pairing: Hooks in the same bay or beside Shelf+Rod / Cabinet without blocking vertically
          if (type === 'hook' && (o.type === 'shelf' || o.type === 'cabinet')) {
            if (r.bay === o.bay && !overlapX) synergyPts += 5;
            else if (r.bay !== o.bay && Math.abs(r.midNorm - o.midNorm) < 0.25) synergyPts += 3;
          }
          // Credenza + Upper Shelf pairing
          if (
            (type === 'wallShelf' || type === 'cradle') &&
            o.type === 'cabinet' &&
            overlapX
          ) {
            const gapBelow = o.gy1 - r.gy2 - 1;
            if (gapBelow === 1 || gapBelow === 2) synergyPts += 8;
          }
        }
        const localFunctional = Math.min(100, heightPts + clearancePts + Math.min(14, synergyPts));

        // --- AESTHETIC COMPONENT (0..100) ---
        let alignPts = placed.length === 0 ? 22 : 8;
        let datumPts = placed.length === 0 ? 12 : 4;
        let spacingPts = 24;
        let balancePts = 18;
        let gravityPts = 10;

        let bestAlign = 0;
        let bestDatum = 0;

        for (let i = 0; i < placed.length; i++) {
          const o = placed[i];
          const sameBay = r.bay === o.bay;

          if (sameBay) {
            // Vertical architectural edge alignment inside a bay (Vitsoe/Bauhaus column discipline)
            if (r.gx1 === o.gx1 && r.gx2 === o.gx2) bestAlign = Math.max(bestAlign, 30);
            else if (r.gx1 === o.gx1 || r.gx2 === o.gx2) bestAlign = Math.max(bestAlign, 22);
            else if (Math.abs((r.gx1 + r.gx2) - (o.gx1 + o.gx2)) <= 1) {
              bestAlign = Math.max(bestAlign, 18);
            }
          } else {
            // Horizontal datum lines bridging Left & Right flanks across the center wordmark
            if (r.gy1 === o.gy1 || r.gy2 === o.gy2) bestDatum = Math.max(bestDatum, 18);
            else if (Math.abs((r.gy1 + r.gy2) - (o.gy1 + o.gy2)) <= 1) {
              bestDatum = Math.max(bestDatum, 12);
            }
          }

          // Clean negative space / breathing room between nearby pieces
          const dxGap = Math.max(0, Math.max(r.gx1 - o.gx2 - 1, o.gx1 - r.gx2 - 1));
          const dyGap = Math.max(0, Math.max(r.gy1 - o.gy2 - 1, o.gy1 - r.gy2 - 1));
          const overlapX = colsOverlap(r, o);
          const overlapY = rowsOverlap(r, o);

          if (overlapX && dyGap === 0) {
            // Flush vertical touching looks cramped on a mortise wall
            spacingPts -= 13;
          } else if (overlapX && dyGap === 1) {
            // Crisp 1-row architectural reveal
            spacingPts += 5;
          }

          if (overlapY && dxGap === 0) {
            // Flush side-by-side touching
            spacingPts -= 11;
          } else if (overlapY && (dxGap === 1 || dxGap === 2)) {
            spacingPts += 4;
          }

          // Avoid putting identical object types right next to each other
          if (o.type === type && sameBay && dxGap <= 1 && dyGap <= 1) {
            spacingPts -= 10;
          }
        }

        if (placed.length > 0) {
          alignPts = Math.min(30, 6 + bestAlign);
          datumPts = Math.min(18, 3 + bestDatum);
        }
        spacingPts = Math.max(0, Math.min(26, spacingPts));

        // Left / Right bay balance guidance
        if (dualBayWall) {
          let leftMass = 0;
          let rightMass = 0;
          for (let i = 0; i < placed.length; i++) {
            const m = pieceVisualMass(placed[i]);
            if (placed[i].bay === 'left') leftMass += m;
            else if (placed[i].bay === 'right') rightMass += m;
          }
          const myMass = pieceVisualMass(piece);
          const nextLeft = leftMass + (r.bay === 'left' ? myMass : 0);
          const nextRight = rightMass + (r.bay === 'right' ? myMass : 0);
          const totalM = Math.max(1, nextLeft + nextRight);
          const imbalance = Math.abs(nextLeft - nextRight) / totalM;
          balancePts = Math.max(2, 18 * (1 - imbalance * 1.15));
          if (preferredBay && r.bay === preferredBay) balancePts += 3;
        }

        // Visual gravity: heavy closed pieces feel grounded lower; light sconces/shelves lift upper wall
        const massNorm = clamp01((VISUAL_DENSITY[type] - 0.45) / 0.95);
        const idealVisualY = 0.22 + massNorm * 0.5;
        gravityPts = gaussScore(r.midNorm, idealVisualY, 0.34) * 10;

        const localAesthetic = Math.min(
          100,
          alignPts + datumPts + spacingPts + Math.min(18, balancePts) + gravityPts
        );

        // Weighted 60% Aesthetic + 40% Functional + controlled stochastic room for error
        const noise = (Math.random() - 0.5) * 2 * errorTolerance;
        return AESTHETIC_WEIGHT * localAesthetic + FUNCTIONAL_WEIGHT * localFunctional + noise;
      };

      // Whole-composition evaluation (strictly 60% Aesthetic / 40% Functionality)
      const evaluateComposition = (items: LayoutPiece[]) => {
        if (items.length === 0) {
          return { aestheticScore: 0, functionalScore: 0, totalScore: 0 };
        }

        // ============== 1. FUNCTIONAL SCORE (0..100, 40% weight) ==============
        let heightSum = 0;
        let clearanceSum = 0;
        for (let i = 0; i < items.length; i++) {
          heightSum += ergonomicHeightScore(items[i].type, items[i]);
          clearanceSum += pieceClearanceScore(items[i], items);
        }
        const heightScore = (heightSum / items.length) * 38;
        const clearanceScore = (clearanceSum / items.length) * 40;

        // Functional zoning & real-world pairing synergy (up to 22 pts)
        let synergyScore = 8;
        const sconces = items.filter((it) => it.type === 'sconce');
        for (const sc of sconces) {
          const illuminatesSurface = items.some(
            (o) =>
              o !== sc &&
              colsOverlap(sc, o) &&
              o.gy1 - sc.gy2 - 1 >= 1 &&
              o.gy1 - sc.gy2 - 1 <= 3 &&
              (o.type === 'cabinet' || o.type === 'cradle' || o.type === 'wallShelf' || o.type === 'cubby')
          );
          if (illuminatesSurface) synergyScore += 6;
        }
        const cabinets = items.filter((it) => it.type === 'cabinet');
        for (const cab of cabinets) {
          const hasUpperCompanion = items.some(
            (o) =>
              o !== cab &&
              o.bay === cab.bay &&
              o.gy2 < cab.gy1 &&
              (o.type === 'wallShelf' || o.type === 'cradle' || o.type === 'sconce' || o.type === 'cubby')
          );
          if (hasUpperCompanion) synergyScore += 4;
        }
        const hooks = items.filter((it) => it.type === 'hook');
        const shelves = items.filter((it) => it.type === 'shelf');
        if (hooks.length > 0 && (shelves.length > 0 || cabinets.length > 0)) {
          synergyScore += 4;
        }
        const functionalScore = clamp01((heightScore + clearanceScore + Math.min(22, synergyScore)) / 100) * 100;

        // ============== 2. AESTHETIC SCORE (0..100, 60% weight) ==============
        // 2a. Vertical column edge alignment within bays (28 pts)
        let alignedItems = 0;
        let bayPairedItems = 0;
        for (let i = 0; i < items.length; i++) {
          const a = items[i];
          const peers = items.filter((b) => b !== a && b.bay === a.bay);
          if (peers.length === 0) continue;
          bayPairedItems++;
          let best = 0;
          for (const b of peers) {
            if (a.gx1 === b.gx1 && a.gx2 === b.gx2) best = Math.max(best, 1.0);
            else if (a.gx1 === b.gx1 || a.gx2 === b.gx2) best = Math.max(best, 0.8);
            else if (Math.abs((a.gx1 + a.gx2) - (b.gx1 + b.gx2)) <= 1) best = Math.max(best, 0.68);
          }
          alignedItems += best;
        }
        const verticalAlignPts =
          bayPairedItems > 0 ? (alignedItems / bayPairedItems) * 28 : 20;

        // 2b. Horizontal datum harmony across the wall (18 pts)
        let datumMatches = 0;
        for (let i = 0; i < items.length; i++) {
          const a = items[i];
          let best = 0;
          for (let j = 0; j < items.length; j++) {
            if (i === j) continue;
            const b = items[j];
            if (a.bay === b.bay) continue;
            if (a.gy1 === b.gy1 || a.gy2 === b.gy2) best = Math.max(best, 1.0);
            else if (Math.abs((a.gy1 + a.gy2) - (b.gy1 + b.gy2)) <= 1) best = Math.max(best, 0.65);
          }
          datumMatches += best;
        }
        const datumPts = dualBayWall ? (datumMatches / items.length) * 18 : 13;

        // 2c. Breathing room & gallery negative space density (22 pts)
        let flushCollisions = 0;
        let crispReveals = 0;
        let usedCells = 0;
        for (let i = 0; i < items.length; i++) {
          const a = items[i];
          usedCells += a.cols * a.rows;
          for (let j = i + 1; j < items.length; j++) {
            const b = items[j];
            const dxGap = Math.max(0, Math.max(a.gx1 - b.gx2 - 1, b.gx1 - a.gx2 - 1));
            const dyGap = Math.max(0, Math.max(a.gy1 - b.gy2 - 1, b.gy1 - a.gy2 - 1));
            if (colsOverlap(a, b) && dyGap === 0) flushCollisions++;
            else if (rowsOverlap(a, b) && dxGap === 0) flushCollisions++;
            else if (
              (colsOverlap(a, b) && dyGap === 1) ||
              (rowsOverlap(a, b) && (dxGap === 1 || dxGap === 2))
            ) {
              crispReveals++;
            }
          }
        }
        const fillRatio = usedCells / Math.max(1, totalOpenCells);
        // Welcome minimalist sparse walls (2–4 pieces) through fuller studio walls without penalizing gallery negative space
        const densityScore =
          fillRatio <= 0.42
            ? Math.max(7.5, gaussScore(fillRatio, 0.24, 0.22) * 12)
            : gaussScore(fillRatio, 0.34, 0.14) * 12;
        const revealScore = Math.min(10, 6 + crispReveals * 1.4 - flushCollisions * 4.5);
        const spacingPts = Math.max(0, Math.min(22, densityScore + revealScore));

        // 2d. Left/Right asymmetrical visual mass balance (18 pts)
        let balancePts = 15;
        if (dualBayWall && items.length >= 2) {
          let leftMass = 0;
          let rightMass = 0;
          let centerMass = 0;
          let leftCount = 0;
          let rightCount = 0;
          for (const it of items) {
            const m = pieceVisualMass(it);
            if (it.bay === 'left') {
              leftMass += m;
              leftCount++;
            } else if (it.bay === 'right') {
              rightMass += m;
              rightCount++;
            } else {
              centerMass += m;
            }
          }
          const sideTotal = leftMass + rightMass;
          if (sideTotal <= 0 && centerMass > 0) {
            balancePts = 16;
          } else if (items.length >= 3 && (leftCount === 0 || rightCount === 0)) {
            balancePts = centerMass > 0 ? 9 : 3;
          } else {
            const diffRatio = Math.abs(leftMass - rightMass) / Math.max(1, sideTotal);
            balancePts = clamp01(1 - Math.max(0, diffRatio - 0.14) * 1.75) * 18;
          }
        }

        // 2e. Visual gravity & silhouette rhythm (14 pts)
        let massWeightedY = 0;
        let totalMass = 0;
        const uniqueTypes = new Set<WallTool>();
        for (const it of items) {
          const m = pieceVisualMass(it);
          massWeightedY += it.midNorm * m;
          totalMass += m;
          uniqueTypes.add(it.type);
        }
        const cgY = totalMass > 0 ? massWeightedY / totalMass : 0.5;
        const gravityPts = gaussScore(cgY, 0.54, 0.2) * 8;
        const varietyPts = Math.min(6, (uniqueTypes.size / Math.max(1, Math.min(4, items.length))) * 6);

        const aestheticScore = clamp01(
          (verticalAlignPts + datumPts + spacingPts + balancePts + gravityPts + varietyPts) / 100
        ) * 100;

        const totalScore =
          AESTHETIC_WEIGHT * aestheticScore + FUNCTIONAL_WEIGHT * functionalScore;

        return { aestheticScore, functionalScore, totalScore };
      };

      // Real-world practical size pools (4.25" pitchX × 5.375" pitchY mortise increments)
      interface PieceRecipe {
        type: WallTool;
        sizes: PieceSize[];
      }

      // Cabinets (width & height adjustable): 18"–39" wide × 12.75"–23.5" tall (flank cabinets & wide credenzas)
      const cabinetFlankSizes: PieceSize[] = [
        { cols: 5, rows: 3 },
        { cols: 6, rows: 3 },
        { cols: 5, rows: 4 },
        { cols: 6, rows: 4 },
        { cols: 4, rows: 3 },
        { cols: 5, rows: 5 },
      ];
      const cabinetCredenzaSizes: PieceSize[] = [
        { cols: 8, rows: 3 },
        { cols: 7, rows: 3 },
        { cols: 9, rows: 3 },
        { cols: 6, rows: 3 },
        { cols: 10, rows: 3 },
        { cols: 6, rows: 2 },
        { cols: 8, rows: 2 },
        { cols: 5, rows: 3 },
      ];
      const cabinetAllSizes: PieceSize[] = [
        ...cabinetFlankSizes,
        { cols: 7, rows: 3 },
        { cols: 8, rows: 3 },
      ];

      // Open Cubes (width & height adjustable): 13.5"×12.75" LP square, 17.75"×18.1" vitrine, wide gallery niches
      const cubbySizes: PieceSize[] = [
        { cols: 4, rows: 3 },
        { cols: 5, rows: 4 },
        { cols: 5, rows: 3 },
        { cols: 4, rows: 4 },
        { cols: 6, rows: 3 },
        { cols: 3, rows: 3 },
        { cols: 7, rows: 3 },
        { cols: 5, rows: 2 },
      ];

      // Shelf + Rod (width adjustable, 2 rows): practical 18"–31" entryway/wardrobe coat bars
      const shelfSizes: PieceSize[] = [
        { cols: 5, rows: 2 },
        { cols: 6, rows: 2 },
        { cols: 7, rows: 2 },
        { cols: 4, rows: 2 },
        { cols: 8, rows: 2 },
      ];

      // Book Shelf (width adjustable, 2 rows): 18"–35" studio library troughs
      const cradleSizes: PieceSize[] = [
        { cols: 5, rows: 2 },
        { cols: 6, rows: 2 },
        { cols: 7, rows: 2 },
        { cols: 8, rows: 2 },
        { cols: 4, rows: 2 },
        { cols: 9, rows: 2 },
      ];

      // Wall Shelf (width adjustable, 2 rows): 13.5"–35" cantilevered display ledges
      const wallShelfSizes: PieceSize[] = [
        { cols: 5, rows: 2 },
        { cols: 6, rows: 2 },
        { cols: 4, rows: 2 },
        { cols: 7, rows: 2 },
        { cols: 8, rows: 2 },
        { cols: 3, rows: 2 },
      ];

      // Wall Sconce (width adjustable, 1 row): 9"–30.5" architectural linear light shelves
      const sconceSizes: PieceSize[] = [
        { cols: 4, rows: 1 },
        { cols: 5, rows: 1 },
        { cols: 6, rows: 1 },
        { cols: 3, rows: 1 },
        { cols: 7, rows: 1 },
        { cols: 2, rows: 1 },
        { cols: 8, rows: 1 },
      ];

      // Hooks (width adjustable, 1 row): single peg accents through wide 6-peg entryway coat rails
      const hookSizes: PieceSize[] = [
        { cols: 1, rows: 1 },
        { cols: 2, rows: 1 },
        { cols: 3, rows: 1 },
        { cols: 4, rows: 1 },
        { cols: 5, rows: 1 },
        { cols: 6, rows: 1 },
      ];
      const hookRailSizes: PieceSize[] = [
        { cols: 4, rows: 1 },
        { cols: 5, rows: 1 },
        { cols: 3, rows: 1 },
        { cols: 6, rows: 1 },
        { cols: 2, rows: 1 },
      ];

      // Pick a curated subset of 3–4 practical sizes per piece so the scorer can match widths cleanly across bays
      const makeSpec = (type: WallTool, pool: PieceSize[], fallback: PieceSize): PieceRecipe => {
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const sizes = shuffled.slice(0, Math.min(4, shuffled.length));
        if (!sizes.some((s) => s.cols === fallback.cols && s.rows === fallback.rows)) {
          sizes.push(fallback);
        }
        return { type, sizes };
      };

      // Varied real-world architectural programs with NO fixed minimum piece count (organic 2–8+ piece range)
      const buildArchetypeRecipe = (archetypeIdx: number): PieceRecipe[] => {
        const cap = Math.max(2, Math.min(targetCount + 2, totalOpenCells >= 160 ? 9 : totalOpenCells >= 95 ? 7 : 5));
        const maybe = (prob: number, recipe: PieceRecipe): PieceRecipe[] =>
          Math.random() < prob ? [recipe] : [];

        const archetypes: Array<() => PieceRecipe[]> = [
          // 0: Minimalist Sculptural Duo / Trio (2–4 pieces — architectural restraint & generous negative space)
          () => [
            makeSpec('cabinet', cabinetCredenzaSizes, { cols: 6, rows: 3 }),
            makeSpec('sconce', sconceSizes, { cols: 4, rows: 1 }),
            ...maybe(0.7, makeSpec('cubby', cubbySizes, { cols: 4, rows: 3 })),
            ...maybe(0.4, makeSpec('hook', hookSizes, { cols: 1, rows: 1 })),
          ],
          // 1: Entryway & Mudroom Drop Zone (3–5 pieces — coat rod, wide peg rail, drop cabinet, task light)
          () => [
            makeSpec('shelf', shelfSizes, { cols: 5, rows: 2 }),
            makeSpec('cabinet', cabinetAllSizes, { cols: 5, rows: 3 }),
            makeSpec('hook', hookRailSizes, { cols: 3, rows: 1 }),
            ...maybe(0.75, makeSpec('sconce', sconceSizes, { cols: 4, rows: 1 })),
            ...maybe(0.45, makeSpec('wallShelf', wallShelfSizes, { cols: 5, rows: 2 })),
          ],
          // 2: Living / Reading Library Wall (4–6 pieces — wide credenza, book trough, LP open cube, plant ledge, sconce)
          () => [
            makeSpec('cabinet', cabinetCredenzaSizes, { cols: 6, rows: 3 }),
            makeSpec('cradle', cradleSizes, { cols: 6, rows: 2 }),
            makeSpec('cubby', cubbySizes, { cols: 4, rows: 3 }),
            makeSpec('sconce', sconceSizes, { cols: 5, rows: 1 }),
            ...maybe(0.8, makeSpec('wallShelf', wallShelfSizes, { cols: 5, rows: 2 })),
            ...maybe(0.4, makeSpec('hook', hookSizes, { cols: 2, rows: 1 })),
          ],
          // 3: Gallery Display & Light Study (2–5 pieces — open cube vitrines, long floating ledge, linear sconce)
          () => [
            makeSpec('cubby', cubbySizes, { cols: 5, rows: 4 }),
            makeSpec('wallShelf', wallShelfSizes, { cols: 6, rows: 2 }),
            ...maybe(0.85, makeSpec('sconce', sconceSizes, { cols: 5, rows: 1 })),
            ...maybe(0.55, makeSpec('cubby', cubbySizes, { cols: 4, rows: 3 })),
            ...maybe(0.4, makeSpec('hook', hookSizes, { cols: 1, rows: 1 })),
          ],
          // 4: Studio Wardrobe & Everyday Carry (4–6 pieces — wardrobe rod, tall cabinet, peg rail, plant shelf)
          () => [
            makeSpec('cabinet', cabinetFlankSizes, { cols: 5, rows: 4 }),
            makeSpec('shelf', shelfSizes, { cols: 6, rows: 2 }),
            makeSpec('hook', hookRailSizes, { cols: 4, rows: 1 }),
            makeSpec('wallShelf', wallShelfSizes, { cols: 5, rows: 2 }),
            ...maybe(0.75, makeSpec('sconce', sconceSizes, { cols: 4, rows: 1 })),
            ...maybe(0.4, makeSpec('cradle', cradleSizes, { cols: 5, rows: 2 })),
          ],
          // 5: Full Home / Studio Feature Wall (6–8 pieces — complete balanced architectural program)
          () => [
            makeSpec('cabinet', cabinetAllSizes, { cols: 6, rows: 3 }),
            makeSpec('cubby', cubbySizes, { cols: 4, rows: 3 }),
            makeSpec('shelf', shelfSizes, { cols: 5, rows: 2 }),
            makeSpec('cradle', cradleSizes, { cols: 6, rows: 2 }),
            makeSpec('wallShelf', wallShelfSizes, { cols: 5, rows: 2 }),
            makeSpec('sconce', sconceSizes, { cols: 4, rows: 1 }),
            ...maybe(0.85, makeSpec('hook', hookSizes, { cols: 3, rows: 1 })),
            ...maybe(0.4, makeSpec('sconce', sconceSizes, { cols: 3, rows: 1 })),
          ],
          // 6: Compact Architectural Study (3–4 pieces — book shelf, linear sconce, open cube, optional peg)
          () => [
            makeSpec('cradle', cradleSizes, { cols: 6, rows: 2 }),
            makeSpec('cubby', cubbySizes, { cols: 4, rows: 3 }),
            makeSpec('sconce', sconceSizes, { cols: 5, rows: 1 }),
            ...maybe(0.6, makeSpec('hook', hookSizes, { cols: 2, rows: 1 })),
          ],
          // 7: Dual-Cabinet Credenza & Shelving Composition (4–7 pieces — complementary tall + wide cabinets)
          () => [
            makeSpec('cabinet', cabinetCredenzaSizes, { cols: 7, rows: 3 }),
            makeSpec('cabinet', cabinetFlankSizes, { cols: 5, rows: 4 }),
            makeSpec('wallShelf', wallShelfSizes, { cols: 6, rows: 2 }),
            makeSpec('sconce', sconceSizes, { cols: 5, rows: 1 }),
            ...maybe(0.75, makeSpec('cradle', cradleSizes, { cols: 5, rows: 2 })),
            ...maybe(0.55, makeSpec('cubby', cubbySizes, { cols: 4, rows: 3 })),
            ...maybe(0.45, makeSpec('hook', hookRailSizes, { cols: 3, rows: 1 })),
          ],
        ];

        return archetypes[archetypeIdx % archetypes.length]().slice(0, cap);
      };

      // Rotate archetypes so consecutive Rearrange clicks explore diverse densities & room functions
      const archetypeCount = 8;
      let chosenArchetype = Math.floor(Math.random() * archetypeCount);
      if (chosenArchetype === lastArrangementArchetype) {
        chosenArchetype = (chosenArchetype + 1 + Math.floor(Math.random() * (archetypeCount - 1))) % archetypeCount;
      }
      lastArrangementArchetype = chosenArchetype;

      // Construct & evaluate 36 candidate layouts, allowing controlled room for error
      const TRIAL_COUNT = 36;
      const evaluatedLayouts: Array<{
        items: LayoutPiece[];
        aestheticScore: number;
        functionalScore: number;
        totalScore: number;
      }> = [];

      for (let trial = 0; trial < TRIAL_COUNT; trial++) {
        // Most trials refine the chosen room archetype; a few explore neighboring archetypes
        const trialArchetype =
          trial < 26 ? chosenArchetype : (chosenArchetype + 1 + (trial % (archetypeCount - 1))) % archetypeCount;
        const recipe = buildArchetypeRecipe(trialArchetype);

        // Mildly vary anchor order across trials for natural layout diversity
        if (recipe.length >= 2 && Math.random() < 0.5) {
          [recipe[0], recipe[1]] = [recipe[1], recipe[0]];
        }

        const usedCells = new Set<string>();
        const isFree = (r: CandidateRect) => {
          for (let gy = r.gy1; gy <= r.gy2; gy++) {
            for (let gx = r.gx1; gx <= r.gx2; gx++) {
              if (usedCells.has(keyOf(gx, gy))) return false;
            }
          }
          return true;
        };
        const markUsed = (r: CandidateRect) => {
          for (let gy = r.gy1; gy <= r.gy2; gy++) {
            for (let gx = r.gx1; gx <= r.gx2; gx++) {
              usedCells.add(keyOf(gx, gy));
            }
          }
        };

        const trialItems: LayoutPiece[] = [];
        // Per-trial room-for-error jitter (between 5 and 11 pts) so human imperfections can emerge
        const localErrorBand = 5.5 + Math.random() * 5.5;
        let nextBayBias: WallBay = Math.random() < 0.5 ? 'left' : 'right';

        for (const spec of recipe) {
          const bestChoices: Array<{ rect: CandidateRect; score: number }> = [];

          // Evaluate all sampled practical sizes for every piece so widths & heights align naturally with neighboring objects
          for (const sz of spec.sizes) {
            const rects = getValidRects(sz.cols, sz.rows);
            for (let i = 0; i < rects.length; i++) {
              const r = rects[i];
              if (!isFree(r)) continue;
              const s = scoreLocalPlacement(
                spec.type,
                r,
                trialItems,
                dualBayWall ? nextBayBias : null,
                localErrorBand
              );
              bestChoices.push({ rect: r, score: s });
            }
          }

          if (bestChoices.length === 0) continue;
          bestChoices.sort((a, b) => b.score - a.score);

          // Sample from top 3 local placements to preserve organic architectural variety
          const topLocal = bestChoices.slice(0, Math.min(3, bestChoices.length));
          const picked =
            topLocal.length === 1 || Math.random() < 0.62
              ? topLocal[0].rect
              : topLocal[Math.floor(Math.random() * topLocal.length)].rect;

          trialItems.push({ ...picked, type: spec.type });
          markUsed(picked);

          // Alternate bay bias toward whichever flank currently has lighter visual mass
          if (dualBayWall) {
            let lM = 0;
            let rM = 0;
            for (const it of trialItems) {
              const m = pieceVisualMass(it);
              if (it.bay === 'left') lM += m;
              else if (it.bay === 'right') rM += m;
            }
            nextBayBias = lM <= rM ? 'left' : 'right';
          }
        }

        if (trialItems.length === 0) continue;
        const scores = evaluateComposition(trialItems);
        evaluatedLayouts.push({ items: trialItems, ...scores });
      }

      if (evaluatedLayouts.length === 0) return;
      evaluatedLayouts.sort((a, b) => b.totalScore - a.totalScore);

      // Filter strictly to compositions passing practical + aesthetic standards, with safe fallback
      const passing = evaluatedLayouts.filter(
        (c) => c.functionalScore >= 60 && c.aestheticScore >= 62
      );
      const pool = passing.length >= 3 ? passing : evaluatedLayouts;

      // Allow controlled room for error: sample via softmax from top tier within 10 pts of the peak score
      const peakScore = pool[0].totalScore;
      const finalistBand = pool
        .filter((c) => c.totalScore >= peakScore - 10)
        .slice(0, 8);

      let weightSum = 0;
      const weights = finalistBand.map((c) => {
        const w = Math.exp((c.totalScore - peakScore) / 4.8);
        weightSum += w;
        return w;
      });
      let roll = Math.random() * weightSum;
      let winner = finalistBand[0];
      for (let i = 0; i < finalistBand.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          winner = finalistBand[i];
          break;
        }
      }

      for (const item of winner.items) {
        addPlacedItem(item.type, item.gx1, item.gx2, item.gy1, item.gy2, withPulse);
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
        warmLightingOn,
        lightKelvin,
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
        if (item.type === 'cabinet') {
          const targetOpen = item.doorOpen ? 1 : 0;
          const cur = item.doorProgress ?? 0;
          if (!motionOn || Math.abs(targetOpen - cur) < 0.002) {
            item.doorProgress = targetOpen;
          } else {
            item.doorProgress = cur + (targetOpen - cur) * 0.18;
          }
        }
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

      // Pass 0: Draw Kelvin-matched architectural light washes for Wall Sconces (Open Cube lighting stays strictly interior)
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
          Boolean(item.lit),
          lightKelvin
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

        const bevelShift = Math.max(0.85, Math.min(1.4, m.slotW * 0.11));
        ctx.save();
        drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
        ctx.clip();
        ctx.strokeStyle = 'rgba(203, 203, 203, 0.72)';
        ctx.lineWidth = Math.max(1.05, Math.min(1.75, m.slotW * 0.135));
        drawRoundRect(x + bevelShift, y + bevelShift, m.slotW, m.slotH, m.slotR);
        ctx.stroke();
        ctx.restore();

        drawRoundRect(x, y, m.slotW, m.slotH, m.slotR);
        ctx.strokeStyle =
          isAnchored || isDragSnapSlot
            ? COLORS.black
            : isHov || s.hoverHeat > 0.38
              ? COLORS.black
              : COLORS.gray;
        ctx.lineWidth =
          isHov || isDragSnapSlot
            ? Math.max(1.35, Math.min(1.9, m.slotW * 0.15))
            : Math.max(1.0, Math.min(1.4, m.slotW * 0.11));
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
          Boolean(item.hasProps)
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
          Boolean(item.lit),
          Boolean(item.hasProps),
          item.doorProgress ?? 0,
          item.doorOpenSide ?? 'left',
          lightKelvin
        );
      }

      // Pass 3: While dragging an existing item, show its magnetic snap target + lifted floating piece
      if (activeDrag && draggedItem) {
        const snap = activeDrag.snapRect;
        const draggedProps = Boolean(draggedItem.hasProps);
        const draggedLit = Boolean(draggedItem.lit);
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
          draggedLit,
          draggedProps,
          0,
          draggedItem.doorOpenSide ?? 'left',
          lightKelvin
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
            draggedLit,
            lightKelvin
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
          draggedLit,
          draggedProps,
          draggedItem.doorProgress ?? 0,
          draggedItem.doorOpenSide ?? 'left',
          lightKelvin
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
          false,
          false,
          0,
          'left',
          lightKelvin
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
        syncWallFlags();
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      },
      clearWall: () => {
        cancelActiveDrag();
        hasUserEdited = true;
        placedItems = [];
        syncWallFlags();
        triggerRipple(0.5, 0.5);
        if (!stateRef.current.motionOn) renderFrame(performance.now());
      },
      triggerRipple,
      setAllProps: (show: boolean) => {
        for (let i = 0; i < placedItems.length; i++) {
          const item = placedItems[i];
          if (
            item.type === 'wallShelf' ||
            item.type === 'cradle' ||
            item.type === 'shelf' ||
            item.type === 'hook'
          ) {
            item.hasProps = show;
          }
        }
        syncWallFlags();
        if (!stateRef.current.motionOn) renderFrame(performance.now());
        else ensureLoop();
      },
      setAllLighting: (on: boolean) => {
        for (let i = 0; i < placedItems.length; i++) {
          const item = placedItems[i];
          if (item.type === 'sconce' || item.type === 'cubby') {
            item.lit = on;
          }
        }
        syncWallFlags();
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

      // Clicking directly on an existing piece without dragging toggles lighting, sliding cabinet doors, or props
      const hitExisting = findItemAtPoint(clickX, clickY);
      if (hitExisting) {
        if (hitExisting.type === 'sconce' || hitExisting.type === 'cubby') {
          hitExisting.lit = !Boolean(hitExisting.lit);
          hitExisting.lift = 0.88;
          syncWallFlags();
        } else if (hitExisting.type === 'cabinet') {
          const wasOpen = Boolean(hitExisting.doorOpen);
          if (!wasOpen) {
            const leftCx = gridMeta.centerX + hitExisting.gx1 * gridMeta.pitchX;
            const rightCx = gridMeta.centerX + hitExisting.gx2 * gridMeta.pitchX;
            const midX = (leftCx + rightCx) * 0.5;
            hitExisting.doorOpenSide = clickX > midX ? 'right' : 'left';
            hitExisting.doorOpen = true;
          } else {
            hitExisting.doorOpen = false;
          }
        } else if (
          hitExisting.type === 'wallShelf' ||
          hitExisting.type === 'cradle' ||
          hitExisting.type === 'shelf' ||
          hitExisting.type === 'hook'
        ) {
          hitExisting.hasProps = !Boolean(hitExisting.hasProps);
          hitExisting.lift = 0.88;
          syncWallFlags();
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
      const effectiveTool: WallTool =
        cssW < 768 && !MOBILE_WALL_TOOLS.includes(activeTool) ? 'hook' : activeTool;
      const size = cssW < 768 ? MOBILE_FIXED_SIZES[effectiveTool] : toolSizes[effectiveTool];
      const cand = getCandidateForSlot(best, size.cols, size.rows);
      if (cand) {
        hasUserEdited = true;
        addPlacedItem(effectiveTool, cand.gx1, cand.gx2, cand.gy1, cand.gy2, true);
        syncWallFlags();
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
      syncWallFlags();
      triggerRipple(e.clientX / Math.max(1, cssW), e.clientY / Math.max(1, cssH));
      if (!stateRef.current.motionOn) renderFrame(performance.now());
    };

    sizeCanvas();
    syncWallFlags();
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
      const cleanupHero = heroSelector
        ? (document.querySelector(heroSelector) as HTMLElement | null)
        : null;
      if (cleanupHero) {
        cleanupHero.style.transform = '';
        cleanupHero.style.transformOrigin = '';
      }
    };
  }, [desktopInteractive, controller.registerActions, controller.syncWallState, heroSelector, headerSelector, footerSelector]);

  useEffect(() => {
    if (!desktopInteractive) return;
    syncLoopRef.current();
  }, [
    desktopInteractive,
    controller.motionOn,
    controller.showProps,
    controller.warmLightingOn,
    controller.lightKelvin,
    controller.activePillar,
    controller.activeTool,
    controller.toolSizes,
    isModalOpen,
    canInteract,
  ]);

  if (!desktopInteractive) return null;

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
          <rect x="5" y="5" width="2.8" height="13.5" strokeWidth="1.35" />
          <rect x="7.8" y="8" width="2.2" height="10.5" strokeWidth="1.35" />
          <rect x="10" y="6.2" width="3.2" height="12.3" strokeWidth="1.35" />
          <rect x="13.2" y="9.2" width="2.4" height="9.3" strokeWidth="1.35" />
          <line x1="16.4" y1="7.2" x2="18.6" y2="18.5" />
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
          {/* Left & right vertical 3/4" Baltic Birch side cheeks with ears above recessed shelf */}
          <rect x="2.5" y="5" width="3" height="12.5" rx="0.6" />
          <rect x="18.5" y="5" width="3" height="12.5" rx="0.6" />
          {/* Recessed horizontal shelf */}
          <rect x="5.5" y="7.4" width="13" height="3.2" />
          {/* Downward architectural light rays from under-shelf routed LED channel */}
          <line x1="9" y1="13.8" x2="8.2" y2="18.5" strokeWidth="1.35" />
          <line x1="12" y1="13.8" x2="12" y2="19.5" strokeWidth="1.35" />
          <line x1="15" y1="13.8" x2="15.8" y2="18.5" strokeWidth="1.35" />
        </svg>
      );
  }
};

const ALL_WALL_TOOLS: WallTool[] = [
  'hook',
  'shelf',
  'cabinet',
  'cubby',
  'wallShelf',
  'cradle',
  'sconce',
];

export const MortiseWallToolbar: React.FC<{
  controller: MortiseWallController;
  variant?: 'default' | 'compact';
}> = ({ controller, variant = 'default' }) => {
  const isDesktopInteractive = useDesktopInteractiveWall();
  const isMobileWall = useIsMobileWall();
  const [objectMenuOpen, setObjectMenuOpen] = useState(false);
  const [lightMenuOpen, setLightMenuOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!objectMenuOpen && !lightMenuOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setObjectMenuOpen(false);
        setLightMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setObjectMenuOpen(false);
        setLightMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [objectMenuOpen, lightMenuOpen]);

  const {
    activeTool,
    setActiveTool,
    toolSizes,
    adjustToolSize,
    showProps,
    toggleProps,
    warmLightingOn,
    toggleWarmLighting,
    hasLightableItems,
    hasPropItems,
    lightKelvin,
    setLightKelvin,
    rearrange,
    clearWall,
  } = controller;

  const visibleTools = isMobileWall ? MOBILE_WALL_TOOLS : ALL_WALL_TOOLS;
  const effectiveTool: WallTool =
    isMobileWall && !MOBILE_WALL_TOOLS.includes(activeTool) ? 'hook' : activeTool;

  const activeLightSwatch = LIGHT_KELVIN_PRESETS[lightKelvin].uiBg;
  const currentSize = toolSizes[effectiveTool];
  const currentLimits = TOOL_SIZE_LIMITS[effectiveTool];
  const activeLabel = TOOL_LABELS[effectiveTool];

  if (!isDesktopInteractive) return null;

  return (
    <div
      ref={toolbarRef}
      className={`wall-toolbar wall-toolbar--dropdown ui-surface${
        variant === 'compact' ? ' wall-toolbar--compact' : ''
      }`}
      aria-label="Interactive modular wall controls"
    >
      <div className="wall-controls-panel">
        <div className="wall-size-controls" role="group" aria-label="Object and size controls">
          {/* Pull-Down Object Selector Menu */}
          <div className="wall-dropdown-wrap">
            <button
              type="button"
              className="wall-tool-btn wall-dropdown-trigger"
              aria-expanded={objectMenuOpen}
              aria-haspopup="listbox"
              onClick={() => {
                setObjectMenuOpen((prev) => !prev);
                setLightMenuOpen(false);
              }}
            >
              {renderToolIcon(effectiveTool)}
              <span>{activeLabel}</span>
              {!isMobileWall && (
                <span className="wall-tool-size">
                  {currentSize.cols}×{currentSize.rows}
                </span>
              )}
              <svg
                className={`wall-chevron${objectMenuOpen ? ' is-open' : ''}`}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {objectMenuOpen && (
              <div
                className="wall-dropdown-menu"
                role="listbox"
                aria-label="Select modular piece to place"
              >
                {visibleTools.map((tool) => {
                  const selected = effectiveTool === tool;
                  return (
                    <button
                      key={tool}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`wall-dropdown-item${selected ? ' is-selected' : ''}`}
                      onClick={() => {
                        setActiveTool(tool);
                        setObjectMenuOpen(false);
                      }}
                    >
                      {renderToolIcon(tool)}
                      <span>{TOOL_LABELS[tool]}</span>
                      {!isMobileWall && (
                        <span className="wall-tool-size">
                          {toolSizes[tool].cols}×{toolSizes[tool].rows}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Only: Inline W / H Size Steppers & Lighting Pull-Down */}
          {!isMobileWall && (
            <>
              <div className="wall-size-stepper">
                <span className="wall-size-axis" title="Width in mortise cells">
                  W
                </span>
                <button
                  type="button"
                  className="wall-size-step-btn"
                  aria-label={`Make ${activeLabel} 1 cell narrower`}
                  disabled={currentSize.cols <= currentLimits.minCols}
                  onClick={() => adjustToolSize(effectiveTool, 'cols', -1)}
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
                  onClick={() => adjustToolSize(effectiveTool, 'cols', 1)}
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
                    onClick={() => adjustToolSize(effectiveTool, 'rows', -1)}
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
                    onClick={() => adjustToolSize(effectiveTool, 'rows', 1)}
                  >
                    +
                  </button>
                </div>
              )}

              <div className="wall-dropdown-wrap">
                <button
                  type="button"
                  className="wall-light-trigger"
                  aria-expanded={lightMenuOpen}
                  aria-pressed={warmLightingOn}
                  disabled={!hasLightableItems}
                  style={{ '--light-swatch': activeLightSwatch } as React.CSSProperties}
                  onClick={() => {
                    setLightMenuOpen((prev) => !prev);
                    setObjectMenuOpen(false);
                  }}
                  title={
                    hasLightableItems
                      ? `Lighting (${warmLightingOn ? `${lightKelvin}K` : 'Off'})`
                      : 'Place a Wall Sconce or Open Cube on the wall to toggle lighting'
                  }
                >
                  <svg
                    className="wall-light-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2.5" x2="12" y2="5.2" />
                    <line x1="12" y1="18.8" x2="12" y2="21.5" />
                    <line x1="2.5" y1="12" x2="5.2" y2="12" />
                    <line x1="18.8" y1="12" x2="21.5" y2="12" />
                    <line x1="5.3" y1="5.3" x2="7.2" y2="7.2" />
                    <line x1="16.8" y1="16.8" x2="18.7" y2="18.7" />
                    <line x1="18.7" y1="5.3" x2="16.8" y2="7.2" />
                    <line x1="7.2" y1="16.8" x2="5.3" y2="18.7" />
                  </svg>
                  <span>{warmLightingOn ? `${lightKelvin}K` : 'OFF'}</span>
                  <svg
                    className={`wall-chevron${lightMenuOpen ? ' is-open' : ''}`}
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {lightMenuOpen && (
                  <div
                    className="wall-dropdown-menu wall-dropdown-menu--light"
                    role="menu"
                    aria-label="Lighting options"
                  >
                    <button
                      type="button"
                      className={`wall-dropdown-item${warmLightingOn ? ' is-selected' : ''}`}
                      onClick={toggleWarmLighting}
                    >
                      <span>Lighting: {warmLightingOn ? 'ON' : 'OFF'}</span>
                    </button>
                    <div className="wall-dropdown-divider" />
                    {LIGHT_KELVIN_OPTIONS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`wall-dropdown-item${lightKelvin === k ? ' is-selected' : ''}`}
                        onClick={() => {
                          setLightKelvin(k);
                          setLightMenuOpen(false);
                        }}
                      >
                        <span
                          className="wall-kelvin-dot"
                          style={{ backgroundColor: LIGHT_KELVIN_PRESETS[k].uiBg }}
                        />
                        <span>{k}K</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="mortise-actions">
          {!isMobileWall && (
            <button
              type="button"
              className="text-action-link"
              aria-pressed={showProps}
              disabled={!hasPropItems}
              onClick={toggleProps}
              title={
                hasPropItems
                  ? 'Toggle props on or off'
                  : 'Place a Hook, Shelf, or Book Shelf on the wall to toggle props'
              }
            >
              Props: {showProps ? 'On' : 'Off'}
            </button>
          )}
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
