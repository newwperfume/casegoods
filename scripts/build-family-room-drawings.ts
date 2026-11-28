import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PDFDocument, rgb, PDFPage, PDFFont, PDFImage, LineCapStyle } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const ROOT = process.cwd();
const LOGO_FULL = path.join(ROOT, 'public/assets/aistudio/CASEGOODS_LOGO_FINAL6.png');
const LOGO_ICONS = path.join(ROOT, 'public/assets/aistudio/LOGO_4_IMAGES.png');
const FONT_NEXA = path.join(ROOT, 'public/assets/NexaLight.ttf');
const OUT_DIR = path.join(ROOT, 'public/downloads/drawings');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Brand Palette — Casegoods Omaha (identical to Kitchen A-101..A-103)
const C = {
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  inkDark: rgb(0.14, 0.14, 0.14),
  inkMid: rgb(0.36, 0.36, 0.36),
  inkLight: rgb(0.56, 0.56, 0.56),
  inkFaint: rgb(0.74, 0.74, 0.74),
  gray: rgb(203 / 255, 203 / 255, 203 / 255),      // #CBCBCB
  grayDark: rgb(90 / 255, 90 / 255, 90 / 255),
  walnutTint: rgb(0.945, 0.935, 0.92),             // Subtle architectural shading for walnut (matches Kitchen hood)
  oakTint: rgb(0.985, 0.98, 0.968),                // Ultra-light warm paper tint for exposed oak panels in iso
  cushionTint: rgb(0.87, 0.87, 0.87),              // Matte charcoal cushion architectural fill
  glassTint: rgb(0.965, 0.98, 0.992),              // Whisper-light glazing tint
  wallFill: rgb(0.91, 0.91, 0.91),                 // Section-cut wall poché
  orange: rgb(239 / 255, 105 / 255, 34 / 255),     // #EF6922
  cyan: rgb(39 / 255, 170 / 255, 224 / 255),       // #27AAE0
  yellow: rgb(253 / 255, 203 / 255, 51 / 255),     // #FDCB33
};

// Page geometry: 1600 x 1000 pt (exact 16:10 -> 4800 x 3000 px @ 216 DPI)
const PAGE_W = 1600;
const PAGE_H = 1000;
const py = (yTop: number) => PAGE_H - yTop;

// =============================================================================
// SHARED CAD PRIMITIVES & SHEET CHROME (Exact Match to Kitchen Submittal)
// =============================================================================

function drawRoundedRect(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  r: number,
  opts: {
    fill?: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
    topRoundedOnly?: boolean;
  }
) {
  const rad = Math.min(r, w / 2, h / 2);
  const d = opts.topRoundedOnly
    ? `M ${x},${yTop + rad} Q ${x},${yTop} ${x + rad},${yTop} L ${x + w - rad},${yTop} Q ${x + w},${yTop} ${x + w},${yTop + rad} L ${x + w},${yTop + h} L ${x},${yTop + h} Z`
    : `M ${x + rad},${yTop} L ${x + w - rad},${yTop} Q ${x + w},${yTop} ${x + w},${yTop + rad} L ${x + w},${yTop + h - rad} Q ${x + w},${yTop + h} ${x + w - rad},${yTop + h} L ${x + rad},${yTop + h} Q ${x},${yTop + h} ${x},${yTop + h - rad} L ${x},${yTop + rad} Q ${x},${yTop} ${x + rad},${yTop} Z`;

  page.drawSvgPath(d, {
    x: 0,
    y: PAGE_H,
    color: opts.fill,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth,
  });
}

function measureTrackedText(font: PDFFont, text: string, size: number, tracking: number): number {
  if (!text) return 0;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    width += font.widthOfTextAtSize(text[i], size);
    if (i < text.length - 1) width += tracking;
  }
  return width;
}

function drawTrackedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  yTopBaseline: number,
  size: number,
  opts: {
    color?: ReturnType<typeof rgb>;
    tracking?: number;
    align?: 'left' | 'right' | 'center';
    weight?: 'light' | 'medium' | 'bold';
  } = {}
) {
  const color = opts.color ?? C.black;
  const tracking = opts.tracking ?? size * 0.12;
  const align = opts.align ?? 'left';
  const weight = opts.weight ?? 'light';

  const totalW = measureTrackedText(font, text, size, tracking);
  let cursorX = x;
  if (align === 'right') cursorX = x - totalW;
  else if (align === 'center') cursorX = x - totalW / 2;

  const yPdf = py(yTopBaseline);
  const offsets: Array<[number, number]> =
    weight === 'bold'
      ? [
          [0, 0],
          [0.24, 0],
          [0, 0.2],
          [0.24, 0.2],
        ]
      : weight === 'medium'
      ? [
          [0, 0],
          [0.18, 0],
        ]
      : [[0, 0]];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    for (const [dx, dy] of offsets) {
      page.drawText(ch, {
        x: cursorX + dx,
        y: yPdf + dy,
        size,
        font,
        color,
      });
    }
    cursorX += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function drawCadLabel(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
  x: number,
  yTop: number,
  opts: {
    size?: number;
    align?: 'left' | 'right' | 'center';
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
    weight?: 'light' | 'medium' | 'bold';
  } = {}
) {
  const size = opts.size ?? 7.2;
  const lh = opts.lineHeight ?? size * 1.38;
  const color = opts.color ?? C.inkMid;
  const align = opts.align ?? 'left';
  const weight = opts.weight ?? 'medium';
  lines.forEach((line, idx) => {
    drawTrackedText(page, font, line, x, yTop + idx * lh, size, {
      color,
      tracking: size * 0.08,
      align,
      weight,
    });
  });
}

function drawCornerTicks(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  inset = 10,
  arm = 4
) {
  const pts: Array<[number, number]> = [
    [x + inset, yTop + inset],
    [x + w - inset, yTop + inset],
    [x + inset, yTop + h - inset],
    [x + w - inset, yTop + h - inset],
  ];
  for (const [cx, cy] of pts) {
    page.drawLine({
      start: { x: cx - arm, y: py(cy) },
      end: { x: cx + arm, y: py(cy) },
      thickness: 0.55,
      color: C.gray,
    });
    page.drawLine({
      start: { x: cx, y: py(cy - arm) },
      end: { x: cx, y: py(cy + arm) },
      thickness: 0.55,
      color: C.gray,
    });
  }
}

function drawSectionBadge(
  page: PDFPage,
  font: PDFFont,
  cx: number,
  cyTop: number,
  radius: number,
  letter: string,
  fill: ReturnType<typeof rgb>
) {
  page.drawCircle({
    x: cx,
    y: py(cyTop),
    size: radius,
    color: fill,
    borderColor: C.black,
    borderWidth: 1.05,
  });
  drawTrackedText(page, font, letter, cx, cyTop + radius * 0.36, radius * 1.08, {
    color: C.black,
    tracking: 0,
    align: 'center',
    weight: 'bold',
  });
}

interface ViewportCard {
  x: number;
  yTop: number;
  w: number;
  h: number;
  innerX: number;
  innerYTop: number;
  innerW: number;
  innerH: number;
}

function drawViewportCard(
  page: PDFPage,
  font: PDFFont,
  opts: {
    x: number;
    yTop: number;
    w: number;
    h: number;
    title: string;
    subtitle?: string;
    headerBg: ReturnType<typeof rgb>;
    headerTextColor: ReturnType<typeof rgb>;
    subtitleColor?: ReturnType<typeof rgb>;
    headerH?: number;
    titleSize?: number;
    subtitleSize?: number;
    showCornerTicks?: boolean;
    bottomTicksYOffset?: number;
  }
): ViewportCard {
  const headerH = opts.headerH ?? 30;
  const radius = 10;

  drawRoundedRect(page, opts.x, opts.yTop, opts.w, opts.h, radius, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 1.15,
  });
  drawRoundedRect(page, opts.x, opts.yTop, opts.w, headerH, radius, {
    fill: opts.headerBg,
    borderColor: C.black,
    borderWidth: 1.15,
    topRoundedOnly: true,
  });

  drawTrackedText(
    page,
    font,
    opts.title,
    opts.x + 14,
    opts.yTop + headerH * 0.65,
    opts.titleSize ?? 10.2,
    {
      color: opts.headerTextColor,
      tracking: 1.15,
      weight: 'bold',
    }
  );

  if (opts.subtitle) {
    drawTrackedText(
      page,
      font,
      opts.subtitle,
      opts.x + opts.w - 14,
      opts.yTop + headerH * 0.64,
      opts.subtitleSize ?? 8.2,
      {
        color: opts.subtitleColor ?? opts.headerTextColor,
        tracking: 0.9,
        align: 'right',
        weight: 'medium',
      }
    );
  }

  const innerYTop = opts.yTop + headerH;
  const innerH = opts.h - headerH;
  if (opts.showCornerTicks !== false) {
    const tickH = opts.bottomTicksYOffset ? innerH - opts.bottomTicksYOffset : innerH;
    drawCornerTicks(page, opts.x, innerYTop, opts.w, tickH, 11, 3.5);
  }

  return {
    x: opts.x,
    yTop: opts.yTop,
    w: opts.w,
    h: opts.h,
    innerX: opts.x + 8,
    innerYTop: innerYTop + 6,
    innerW: opts.w - 16,
    innerH: innerH - 12,
  };
}

function drawSheetChrome(
  page: PDFPage,
  font: PDFFont,
  logoFullImg: PDFImage,
  logoIconsImg: PDFImage,
  opts: {
    sheetCode: string;
    sheetIndexText: string;
    sheetCategory: string;
    bannerBg: ReturnType<typeof rgb>;
    bannerLeft: string;
    bannerRight: string;
    accentColor: ReturnType<typeof rgb>;
  }
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    color: C.white,
  });

  // Outer CAD frame border (rounded-[9px] aesthetic)
  drawRoundedRect(page, 22, 22, PAGE_W - 44, PAGE_H - 44, 14, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 1.5,
  });

  // Top-Left: Official Casegoods Logo
  const logoDims = logoFullImg.scaleToFit(278, 66);
  page.drawImage(logoFullImg, {
    x: 44,
    y: py(39 + logoDims.height),
    width: logoDims.width,
    height: logoDims.height,
  });

  // Center-Right: Project Metadata Strip
  const metaX = 766;
  const metaW = 588;
  const metaY = 40;
  const metaH = 62;
  drawRoundedRect(page, metaX, metaY, metaW, metaH, 11, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 1.0,
  });

  const col1X = metaX + 18;
  const col2X = metaX + 236;
  const col3X = metaX + 422;

  page.drawLine({
    start: { x: col2X - 16, y: py(metaY + 10) },
    end: { x: col2X - 16, y: py(metaY + metaH - 10) },
    thickness: 0.75,
    color: C.gray,
  });
  page.drawLine({
    start: { x: col3X - 16, y: py(metaY + 10) },
    end: { x: col3X - 16, y: py(metaY + metaH - 10) },
    thickness: 0.75,
    color: C.gray,
  });

  drawTrackedText(page, font, 'PROJECT · DWG 1064HEM', col1X, metaY + 22, 7.6, {
    color: C.grayDark,
    tracking: 1.1,
    weight: 'medium',
  });
  drawTrackedText(page, font, 'FAMILY ROOM MILLWORK', col1X, metaY + 44, 10.6, {
    color: C.black,
    tracking: 1.1,
    weight: 'bold',
  });

  drawTrackedText(page, font, 'SHEET SERIES', col2X, metaY + 22, 7.6, {
    color: C.grayDark,
    tracking: 1.1,
    weight: 'medium',
  });
  drawTrackedText(page, font, opts.sheetCategory, col2X, metaY + 44, 10.4, {
    color: C.black,
    tracking: 1.0,
    weight: 'bold',
  });

  drawTrackedText(page, font, 'DRAWING SCALE', col3X, metaY + 22, 7.6, {
    color: C.grayDark,
    tracking: 1.1,
    weight: 'medium',
  });
  drawTrackedText(page, font, 'SCHEMATIC · NTS', col3X, metaY + 44, 10.4, {
    color: C.black,
    tracking: 1.0,
    weight: 'bold',
  });

  // Far-Right: Solid Black Sheet Code Block
  const codeX = 1368;
  const codeW = 188;
  const codeY = 40;
  const codeH = 62;
  drawRoundedRect(page, codeX, codeY, codeW, codeH, 11, {
    fill: C.black,
    borderColor: C.black,
    borderWidth: 1.0,
  });
  drawRoundedRect(page, codeX + 14, codeY + 16, 36, 7, 3, {
    fill: opts.accentColor,
  });
  drawTrackedText(page, font, opts.sheetIndexText, codeX + 14, codeY + 47, 8.2, {
    color: C.yellow,
    tracking: 0.9,
    weight: 'bold',
  });
  drawTrackedText(page, font, opts.sheetCode, codeX + codeW - 15, codeY + 41, 24.5, {
    color: C.white,
    tracking: 1.6,
    align: 'right',
    weight: 'bold',
  });

  // Header divider rule
  page.drawLine({
    start: { x: 44, y: py(116) },
    end: { x: PAGE_W - 44, y: py(116) },
    thickness: 1.0,
    color: C.black,
  });

  // Full-width Bauhaus banner bar
  drawRoundedRect(page, 44, 126, PAGE_W - 88, 34, 10, {
    fill: opts.bannerBg,
    borderColor: C.black,
    borderWidth: 1.1,
  });
  drawTrackedText(page, font, opts.bannerLeft, 60, 147.2, 11.2, {
    color: C.black,
    tracking: 1.45,
    align: 'left',
    weight: 'bold',
  });
  drawTrackedText(page, font, opts.bannerRight, PAGE_W - 60, 146.8, 9.2, {
    color: C.black,
    tracking: 1.15,
    align: 'right',
    weight: 'bold',
  });

  // Bottom Architectural Footer Strip
  page.drawLine({
    start: { x: 44, y: py(918) },
    end: { x: PAGE_W - 44, y: py(918) },
    thickness: 0.9,
    color: C.black,
  });

  const iconsDims = logoIconsImg.scaleToFit(196, 30);
  page.drawImage(logoIconsImg, {
    x: (PAGE_W - iconsDims.width) / 2,
    y: py(948 + iconsDims.height / 2),
    width: iconsDims.width,
    height: iconsDims.height,
  });

  drawTrackedText(page, font, 'CASEGOODS  ·  HANDCRAFTED IN OMAHA, NEBRASKA', 44, 951, 8.8, {
    color: C.black,
    tracking: 1.25,
    align: 'left',
    weight: 'bold',
  });
  drawTrackedText(
    page,
    font,
    'JOSH HEINKE  ·  MAKER OF THINGS  ·  402-830-8782  ·  CASEGOODSOMAHA.COM',
    PAGE_W - 44,
    951,
    8.6,
    {
      color: C.black,
      tracking: 1.1,
      align: 'right',
      weight: 'bold',
    }
  );
}

// =============================================================================
// VECTOR CAD DRAWING HELPERS (Top-Down Page Coordinates in Points)
// =============================================================================

function line(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 0.85,
  color = C.black,
  dashArray?: number[]
) {
  page.drawLine({
    start: { x: x1, y: py(y1) },
    end: { x: x2, y: py(y2) },
    thickness,
    color,
    dashArray,
    lineCap: LineCapStyle.Butt,
  });
}

function rect(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  opts: {
    fill?: ReturnType<typeof rgb>;
    stroke?: ReturnType<typeof rgb>;
    strokeWidth?: number;
    dashArray?: number[];
  } = {}
) {
  if (opts.fill) {
    page.drawRectangle({
      x,
      y: py(yTop + h),
      width: w,
      height: h,
      color: opts.fill,
    });
  }
  if (opts.stroke !== undefined || (opts.strokeWidth ?? 0) > 0) {
    const sw = opts.strokeWidth ?? 0.85;
    const sc = opts.stroke ?? C.black;
    if (opts.dashArray) {
      line(page, x, yTop, x + w, yTop, sw, sc, opts.dashArray);
      line(page, x + w, yTop, x + w, yTop + h, sw, sc, opts.dashArray);
      line(page, x + w, yTop + h, x, yTop + h, sw, sc, opts.dashArray);
      line(page, x, yTop + h, x, yTop, sw, sc, opts.dashArray);
    } else {
      page.drawRectangle({
        x,
        y: py(yTop + h),
        width: w,
        height: h,
        borderColor: sc,
        borderWidth: sw,
      });
    }
  }
}

function polygon(
  page: PDFPage,
  pts: Array<[number, number]>,
  opts: {
    fill?: ReturnType<typeof rgb>;
    stroke?: ReturnType<typeof rgb>;
    strokeWidth?: number;
  } = {}
) {
  if (pts.length < 3) return;
  const d =
    pts
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ') + ' Z';
  page.drawSvgPath(d, {
    x: 0,
    y: PAGE_H,
    color: opts.fill,
    borderColor: opts.stroke,
    borderWidth: opts.strokeWidth ?? (opts.stroke ? 0.8 : undefined),
  });
}

function drawDimArrow(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color = C.inkMid,
  thickness = 0.55
) {
  line(page, x1, y1, x2, y2, thickness, color);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const pyv = ux;
  const ah = 4.2;
  const aw = 2.0;
  // Arrow at start
  line(page, x1, y1, x1 + ux * ah + px * aw, y1 + uy * ah + pyv * aw, thickness, color);
  line(page, x1, y1, x1 + ux * ah - px * aw, y1 + uy * ah - pyv * aw, thickness, color);
  // Arrow at end
  line(page, x2, y2, x2 - ux * ah + px * aw, y2 - uy * ah + pyv * aw, thickness, color);
  line(page, x2, y2, x2 - ux * ah - px * aw, y2 - uy * ah - pyv * aw, thickness, color);
}

/** Draw an inset fluted Black Walnut door/drawer panel with authentic semicircular CAD flute lines */
function drawFlutedPanel(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  orientation: 'vertical' | 'horizontal',
  fluteCount: number,
  opts: {
    borderWidth?: number;
    fluteWidth?: number;
    tint?: ReturnType<typeof rgb>;
  } = {}
) {
  const bw = opts.borderWidth ?? 0.72;
  const fw = opts.fluteWidth ?? 0.34;
  rect(page, x, yTop, w, h, {
    fill: opts.tint ?? C.walnutTint,
    stroke: C.black,
    strokeWidth: bw,
  });

  if (orientation === 'vertical') {
    const step = w / fluteCount;
    for (let i = 1; i < fluteCount; i++) {
      const fx = x + i * step;
      line(page, fx, yTop + 0.5, fx, yTop + h - 0.5, fw, C.inkMid);
    }
    // Subtle highlight ridge offset lines for semicircular depth at larger scales
    if (step > 4.5) {
      for (let i = 0; i < fluteCount; i++) {
        const rx = x + (i + 0.36) * step;
        line(page, rx, yTop + 0.6, rx, yTop + h - 0.6, fw * 0.55, C.inkFaint);
      }
    }
  } else {
    const step = h / fluteCount;
    for (let i = 1; i < fluteCount; i++) {
      const fy = yTop + i * step;
      line(page, x + 0.5, fy, x + w - 0.5, fy, fw, C.inkMid);
    }
    if (step > 4.5) {
      for (let i = 0; i < fluteCount; i++) {
        const ry = yTop + (i + 0.36) * step;
        line(page, x + 0.6, ry, x + w - 0.6, ry, fw * 0.55, C.inkFaint);
      }
    }
  }
}

/** Draw a custom lathe-turned cylindrical/conical solid walnut pull in elevation */
function drawTurnedPull(page: PDFPage, cx: number, cyTop: number, r: number) {
  // Subtle outer shadow ring for tapered cone base
  page.drawCircle({
    x: cx,
    y: py(cyTop),
    size: r,
    color: C.white,
    borderColor: C.black,
    borderWidth: 0.85,
  });
  if (r >= 2.6) {
    page.drawCircle({
      x: cx,
      y: py(cyTop),
      size: r * 0.62,
      borderColor: C.inkLight,
      borderWidth: 0.35,
    });
  }
}

/** Draw exposed 3/4" Rift White Oak box finger-joints along a vertical or horizontal joint edge */
function drawFingerJointsStrip(
  page: PDFPage,
  x: number,
  yTop: number,
  length: number,
  thickness: number,
  orientation: 'horizontal' | 'vertical',
  pinCount: number
) {
  const step = length / (pinCount * 2 - 1);
  for (let i = 0; i < pinCount * 2 - 1; i++) {
    if (i % 2 === 0) {
      if (orientation === 'horizontal') {
        rect(page, x + i * step, yTop, step, thickness, {
          fill: C.inkLight,
          stroke: C.black,
          strokeWidth: 0.4,
        });
      } else {
        rect(page, x, yTop + i * step, thickness, step, {
          fill: C.inkLight,
          stroke: C.black,
          strokeWidth: 0.4,
        });
      }
    }
  }
}

// =============================================================================
// UNIFIED 1064HEM ARCHITECTURAL DIMENSIONS (INCHES)
// =============================================================================
const DIM = {
  // Room & Wall
  roomW: 294,          // North Wall total width: 24'-6" (0..294)
  ceilH: 96,           // Main ceiling datum at left/center: 8'-0"
  ceilRightH: 108,     // Right vaulted ceiling rise at East wall
  ceilWestFrontH: 108, // West wall ceiling slope upward toward front
  westDepth: 76,       // Drawn depth of West Wall return (0..76)
  wallT: 5.5,
  toeH: 3.5,
  toeRecess: 2.5,
  caseT: 0.85,         // Visual 3/4" oak frame thickness
  baseH: 32,           // Base cabinets height (Modules 1, 2, 3-low, 5)

  // Module 1: West Return Cabinet (along West wall)
  m1Depth: 18,         // x = 0..18
  m1YStart: 20,        // meets Module 2 front at y = 20
  m1YEnd: 66,          // 46" visible width along West wall

  // Module 2: Left North-Wall Base Cabinet
  m2XStart: 18,
  m2XEnd: 50,          // 32" visible width
  m2Depth: 20,

  // Module 3: Tall Tower & 2-Drawer Chest
  m3XStart: 50,
  m3XEnd: 96,          // 46" wide
  m3LowDepth: 24,      // 24" deep lower 2-drawer chest
  m3UpDepth: 19,       // 19" deep upper tall cabinet (5" setback ledge)
  m3TransomY: 86.5,    // horizontal oak rail below fluted upper transom

  // Module 4: 6-Bay Window Bench
  m4XStart: 96,
  m4XEnd: 228,         // 132" wide (two 66" 3-bay modules joined at x = 162)
  m4Depth: 21,
  m4CaseTop: 15.75,
  m4CushionH: 2.5,     // Total seat height = 18.25"

  // Picture Window above Bench
  winXStart: 100,
  winXEnd: 224,        // 124" wide
  winSill: 21.5,
  winHead: 84,

  // Pilaster Column between Window and Right Alcove
  pilXStart: 228,
  pilXEnd: 244,        // 16" wide pilaster
  pilDepth: 11,

  // Module 5: Right Alcove Floating Shelves & Base Cabinet
  shelfXStart: 228,    // Wraps around front of pilaster!
  shelfXEnd: 294,      // Runs into East wall
  shelfDepth: 14,      // Projects 3" past pilaster front, 14" from back wall in alcove
  shelfT: 1.75,
  shelfZs: [48, 62, 76],

  m5XStart: 250,
  m5XEnd: 292,         // 42" wide right alcove base cabinet
  m5Depth: 19,

  // Section cut X-coordinates along North Wall
  secAX: 73,           // Center of Tall Tower & 2-Drawer Chest
  secBX: 151,          // Through Window Bench & Picture Window
  secCX: 271,          // Through Wrap-Around Shelves & Right Alcove Base
};

// =============================================================================
// SHEET A-101: ELEVATION A (WEST), ELEVATION B (NORTH), SECTIONS A/B/C, SPEC KEY
// =============================================================================

function drawElevationA(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  // West Wall viewed looking West (-X):
  // Left = front of room (y = westDepth = 76"), Right = North Wall corner (y = 0")
  // Plus we draw the side-profile projection of Module 2 & Tall Tower on the right (against North Wall)!
  const totalW = DIM.westDepth * scale;
  const originRightX = box.innerX + (box.innerW + totalW) / 2 + 12; // North Wall line (y = 0)
  const wx = (yInch: number) => originRightX - yInch * scale;
  const wz = (zInch: number) => floorY - zInch * scale;

  // Floor datum & ceiling slope line (sloping up from North Wall 96" to front 108")
  line(page, wx(DIM.westDepth + 8), floorY, wx(-6), floorY, 1.8, C.black);
  line(
    page,
    wx(DIM.westDepth + 8),
    wz(DIM.ceilWestFrontH),
    wx(-6),
    wz(DIM.ceilH),
    1.8,
    C.black
  );
  // Corner wall vertical line at North Wall (y = 0)
  line(page, wx(0), wz(DIM.ceilH), wx(0), floorY, 1.0, C.black);

  // Sloped-Top Trapezoid Window on West Wall (y = 22..62, sill z = 44, head z = 80..95)
  const winY1 = 62;
  const winY2 = 22;
  const winSillZ = 44;
  const winHeadLeftZ = 95.5;
  const winHeadRightZ = 80;
  const trim = 2.6;
  // Outer casing
  polygon(
    page,
    [
      [wx(winY1), wz(winSillZ)],
      [wx(winY2), wz(winSillZ)],
      [wx(winY2), wz(winHeadRightZ)],
      [wx(winY1), wz(winHeadLeftZ)],
    ],
    { fill: C.white, stroke: C.black, strokeWidth: 1.05 }
  );
  // Inner glass sash
  polygon(
    page,
    [
      [wx(winY1 - trim), wz(winSillZ + trim)],
      [wx(winY2 + trim), wz(winSillZ + trim)],
      [wx(winY2 + trim), wz(winHeadRightZ - trim * 1.15)],
      [wx(winY1 - trim), wz(winHeadLeftZ - trim * 1.15)],
    ],
    { fill: C.glassTint, stroke: C.inkMid, strokeWidth: 0.7 }
  );
  // Subtle diagonal glass reflection tick lines tucked neatly in upper-left corner (clear of center label)
  line(page, wx(55), wz(80), wx(50), wz(87), 0.35, C.inkLight);
  line(page, wx(52.5), wz(78.5), wx(48), wz(84.5), 0.35, C.inkLight);

  // Background silhouette of Tall Tower Side Profile (projected at right side, y = 0..24 / 0..19)
  // Upper tall tower side panel (white oak, y = 0..19, z = 32..96..sloped)
  const towerSlopeAt19 =
    DIM.ceilH + ((DIM.ceilWestFrontH - DIM.ceilH) * DIM.m3UpDepth) / DIM.westDepth;
  polygon(
    page,
    [
      [wx(DIM.m3UpDepth), wz(DIM.baseH)],
      [wx(0), wz(DIM.baseH)],
      [wx(0), wz(DIM.ceilH)],
      [wx(DIM.m3UpDepth), wz(towerSlopeAt19)],
    ],
    { fill: C.white, stroke: C.inkMid, strokeWidth: 0.85 }
  );
  // Dashed transom shelf line on side profile
  line(
    page,
    wx(DIM.m3UpDepth),
    wz(DIM.m3TransomY),
    wx(0),
    wz(DIM.m3TransomY),
    0.5,
    C.inkLight,
    [3, 2.5]
  );
  // Exposed finger-joint ticks aligned cleanly along the sloped top corner of upper tower
  for (let i = 0; i < 3; i++) {
    const fy0 = 2.5 + i * 5.2;
    const fy1 = fy0 + 2.5;
    const z0 = DIM.ceilH + ((DIM.ceilWestFrontH - DIM.ceilH) * fy0) / DIM.westDepth;
    const z1 = DIM.ceilH + ((DIM.ceilWestFrontH - DIM.ceilH) * fy1) / DIM.westDepth;
    polygon(
      page,
      [
        [wx(fy1), wz(z1)],
        [wx(fy0), wz(z0)],
        [wx(fy0), wz(z0 - 1.3)],
        [wx(fy1), wz(z1 - 1.3)],
      ],
      { fill: C.inkLight, stroke: C.black, strokeWidth: 0.35 }
    );
  }

  // Lower 2-drawer chest side step-out (behind Module 1 return, visible above/right from y = 0..24)
  rect(
    page,
    wx(DIM.m3LowDepth),
    wz(DIM.baseH),
    DIM.m3LowDepth * scale,
    DIM.baseH * scale,
    { fill: C.white, stroke: C.inkMid, strokeWidth: 0.75, dashArray: [3, 2.5] }
  );

  // MODULE 1 — WEST RETURN BASE CABINET (Foreground! y = 20..66, z = 0..32)
  const m1X = wx(DIM.m1YEnd);
  const m1W = (DIM.m1YEnd - DIM.m1YStart) * scale;
  const m1YTop = wz(DIM.baseH);
  const m1H = DIM.baseH * scale;
  const t = DIM.caseT * scale;
  const toeH = DIM.toeH * scale;

  // Outer white oak carcass
  rect(page, m1X, m1YTop, m1W, m1H, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });

  // Recessed toe-kick plinth along bottom
  rect(page, m1X + t, floorY - toeH, m1W - t, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // Left oak gable extending cleanly to floor
  line(page, m1X + t, m1YTop + t, m1X + t, floorY, 0.75, C.black);

  // Top white oak case slab line
  line(page, m1X, m1YTop + t, m1X + m1W, m1YTop + t, 0.75, C.black);
  // Bottom white oak case rail line
  line(page, m1X + t, floorY - toeH - t, m1X + m1W, floorY - toeH - t, 0.75, C.black);

  // 2 Inset Vertical-Fluted Black Walnut Doors inside Module 1
  const doorsX = m1X + t + 0.6;
  const doorsW = m1W - t * 2 - 1.2;
  const doorsY = m1YTop + t + 0.6;
  const doorsH = m1H - toeH - t * 2 - 1.2;
  const halfW = (doorsW - 1.2) / 2;

  drawFlutedPanel(page, doorsX, doorsY, halfW, doorsH, 'vertical', 8, {
    borderWidth: 0.75,
    fluteWidth: 0.34,
  });
  drawFlutedPanel(page, doorsX + halfW + 1.2, doorsY, halfW, doorsH, 'vertical', 8, {
    borderWidth: 0.75,
    fluteWidth: 0.34,
  });

  // 2 Turned Walnut Cylindrical Pulls at upper-center meeting stile (z = 22.5")
  const pullY = wz(22.5);
  const pullR = 0.85 * scale;
  drawTurnedPull(page, doorsX + halfW - 3.6 * scale, pullY, pullR);
  drawTurnedPull(page, doorsX + halfW + 1.2 + 3.6 * scale, pullY, pullR);

  // Module 2 side-section cut (shown in profile right at corner y = 0..20, z = 0..32)
  const m2SideX = wx(DIM.m2Depth);
  const m2SideW = DIM.m2Depth * scale;
  rect(page, m2SideX, m1YTop, m2SideW, m1H, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.05,
  });
  // Top & bottom oak slabs on corner return + toe-kick notch
  rect(page, m2SideX, floorY - toeH, DIM.toeRecess * scale, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.7,
  });
  // Door profile line on front of Module 2
  line(page, m2SideX + 1.8, m1YTop + t, m2SideX + 1.8, floorY - toeH - t, 0.55, C.inkMid);

  // Clean CAD Callout Annotations on Elevation A
  drawCadLabel(page, font, ['SLOPED', 'CASEMENT', 'WINDOW'], wx(42), wz(66), {
    size: 6.5,
    align: 'center',
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['TALL TOWER', 'SIDE PROFILE', '(19" D UPPER)'], wx(10), wz(64), {
    size: 6.2,
    align: 'center',
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['2x VERTICAL-FLUTED', 'WALNUT DOORS'], wx(43), wz(39.5), {
    size: 6.3,
    align: 'center',
    color: C.inkMid,
  });
  // Leader down to left exposed finger-joint gable
  line(page, m1X - 18, m1YTop + 6, m1X - 2, m1YTop + 6, 0.5, C.inkLight);
  drawCadLabel(page, font, ['EXPOSED', 'OAK BOX', 'JOINTS'], m1X - 21, m1YTop + 2, {
    size: 6.0,
    align: 'right',
    color: C.inkMid,
  });
}

function drawElevationB(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  const totalW = DIM.roomW * scale;
  const originX = box.innerX + (box.innerW - totalW) / 2;
  const nx = (xInch: number) => originX + xInch * scale;
  const nz = (zInch: number) => floorY - zInch * scale;
  const t = DIM.caseT * scale;
  const toeH = DIM.toeH * scale;
  const pullR = 0.85 * scale;

  // Floor & Ceiling Datum Lines (flat 96" across main run, subtle vault rise over right alcove)
  line(page, nx(-6), floorY, nx(DIM.roomW + 6), floorY, 1.8, C.black);
  line(page, nx(-6), nz(DIM.ceilH), nx(DIM.pilXEnd), nz(DIM.ceilH), 1.8, C.black);
  line(
    page,
    nx(DIM.pilXEnd),
    nz(DIM.ceilH),
    nx(DIM.roomW + 6),
    nz(DIM.ceilRightH),
    1.8,
    C.black
  );
  // Left & Right room boundary walls
  line(page, nx(0), nz(DIM.ceilH), nx(0), floorY, 1.0, C.black);
  line(page, nx(DIM.roomW), nz(DIM.ceilRightH), nx(DIM.roomW), floorY, 1.0, C.black);

  // ---------------------------------------------------------------------------
  // 1. MODULE 1 (Side Profile at Far Left x = 0..18, projecting forward)
  // ---------------------------------------------------------------------------
  rect(page, nx(0), nz(DIM.baseH), DIM.m1Depth * scale, DIM.baseH * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.1,
  });
  // Exposed finger-joint pins on the front-facing left return gable (top & bottom!)
  drawFingerJointsStrip(
    page,
    nx(1.2),
    nz(DIM.baseH - 0.1),
    (DIM.m1Depth - 2.4) * scale,
    t * 0.85,
    'horizontal',
    4
  );
  drawFingerJointsStrip(
    page,
    nx(1.2),
    nz(DIM.toeH + DIM.caseT),
    (DIM.m1Depth - 2.4) * scale,
    t * 0.85,
    'horizontal',
    4
  );
  line(page, nx(0), floorY - toeH, nx(DIM.m1Depth), floorY - toeH, 0.7, C.inkMid);

  // ---------------------------------------------------------------------------
  // 2. MODULE 2 (Left North-Wall Base Cabinet x = 18..50, z = 0..32)
  // ---------------------------------------------------------------------------
  const m2W = (DIM.m2XEnd - DIM.m2XStart) * scale;
  rect(page, nx(DIM.m2XStart), nz(DIM.baseH), m2W, DIM.baseH * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.1,
  });
  rect(page, nx(DIM.m2XStart), floorY - toeH, m2W, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  drawFlutedPanel(
    page,
    nx(DIM.m2XStart) + t,
    nz(DIM.baseH) + t,
    m2W - t * 2,
    DIM.baseH * scale - toeH - t * 2,
    'vertical',
    10,
    { borderWidth: 0.72, fluteWidth: 0.34 }
  );
  // Single turned walnut pull on right edge of Module 2
  drawTurnedPull(page, nx(DIM.m2XEnd - 4.2), nz(22.5), pullR);

  // ---------------------------------------------------------------------------
  // 3. MODULE 3 (Tall Tower + 2-Drawer Lower Chest x = 50..96, z = 0..96)
  // ---------------------------------------------------------------------------
  const m3W = (DIM.m3XEnd - DIM.m3XStart) * scale;
  const m3X = nx(DIM.m3XStart);

  // Upper Tall Tower (z = 32..96)
  rect(page, m3X, nz(DIM.ceilH), m3W, (DIM.ceilH - DIM.baseH) * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.2,
  });
  // Horizontal oak transom divider rail (z = 86.5..87.5)
  const transRailY = nz(DIM.m3TransomY + DIM.caseT);
  rect(page, m3X + t, transRailY, m3W - t * 2, t, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  // Upper Vertical-Fluted Walnut Transom Band (z = 87.5..95.2)
  drawFlutedPanel(
    page,
    m3X + t,
    nz(DIM.ceilH) + t,
    m3W - t * 2,
    transRailY - (nz(DIM.ceilH) + t),
    'vertical',
    16,
    { borderWidth: 0.72, fluteWidth: 0.33 }
  );
  // Main Tall Double Doors (z = 32.85..86.5)
  const tallDoorY = transRailY + t + 0.5;
  const tallDoorH = nz(DIM.baseH) - t * 0.4 - tallDoorY;
  const tallHalfW = (m3W - t * 2 - 1.2) / 2;
  drawFlutedPanel(page, m3X + t, tallDoorY, tallHalfW, tallDoorH, 'vertical', 8, {
    borderWidth: 0.75,
    fluteWidth: 0.34,
  });
  drawFlutedPanel(
    page,
    m3X + t + tallHalfW + 1.2,
    tallDoorY,
    tallHalfW,
    tallDoorH,
    'vertical',
    8,
    { borderWidth: 0.75, fluteWidth: 0.34 }
  );
  // 2 Turned Walnut Pulls near BOTTOM-CENTER of tall doors (z = 38.5")
  drawTurnedPull(page, m3X + m3W / 2 - 3.6 * scale, nz(38.5), pullR);
  drawTurnedPull(page, m3X + m3W / 2 + 3.6 * scale, nz(38.5), pullR);

  // Lower 2-Drawer Chest (z = 0..32) — heavy crisp frame showing forward step-out
  rect(page, m3X, nz(DIM.baseH), m3W, DIM.baseH * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.25,
  });
  rect(page, m3X, floorY - toeH, m3W, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  const drwInnerY = nz(DIM.baseH) + t + 0.4;
  const drwTotalH = DIM.baseH * scale - toeH - t * 2 - 0.8;
  const singleDrwH = (drwTotalH - 1.2) / 2;
  // Upper horizontal-fluted drawer (4 horizontal flutes + 2 pulls)
  drawFlutedPanel(page, m3X + t, drwInnerY, m3W - t * 2, singleDrwH, 'horizontal', 4, {
    borderWidth: 0.75,
    fluteWidth: 0.35,
  });
  drawTurnedPull(page, m3X + 8.5 * scale, drwInnerY + singleDrwH * 0.38, pullR);
  drawTurnedPull(page, m3X + m3W - 8.5 * scale, drwInnerY + singleDrwH * 0.38, pullR);
  // Lower horizontal-fluted drawer (4 horizontal flutes + 2 pulls)
  const botDrwY = drwInnerY + singleDrwH + 1.2;
  drawFlutedPanel(page, m3X + t, botDrwY, m3W - t * 2, singleDrwH, 'horizontal', 4, {
    borderWidth: 0.75,
    fluteWidth: 0.35,
  });
  drawTurnedPull(page, m3X + 8.5 * scale, botDrwY + singleDrwH * 0.38, pullR);
  drawTurnedPull(page, m3X + m3W - 8.5 * scale, botDrwY + singleDrwH * 0.38, pullR);

  // ---------------------------------------------------------------------------
  // 4. 4-PANEL PICTURE WINDOW (x = 100..224, z = 21.5..84)
  // ---------------------------------------------------------------------------
  const winW = (DIM.winXEnd - DIM.winXStart) * scale;
  const winH = (DIM.winHead - DIM.winSill) * scale;
  rect(page, nx(DIM.winXStart), nz(DIM.winHead), winW, winH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  // 4 glass lites: 20" | 38" | 38" | 20" (plus 2" mullions & 2" outer frame = 124")
  const paneWidths = [20, 38, 38, 20];
  let curWinX = DIM.winXStart + 2;
  for (const pw of paneWidths) {
    rect(
      page,
      nx(curWinX),
      nz(DIM.winHead - 2),
      pw * scale,
      (DIM.winHead - DIM.winSill - 4) * scale,
      { fill: C.glassTint, stroke: C.inkMid, strokeWidth: 0.65 }
    );
    // Subtle diagonal architectural glazing tick marks
    const gx = nx(curWinX + pw * 0.5);
    const gy = nz((DIM.winHead + DIM.winSill) / 2);
    line(page, gx - 5, gy + 7, gx + 5, gy - 7, 0.3, C.inkFaint);
    line(page, gx - 2, gy + 8, gx + 7, gy - 5, 0.3, C.inkFaint);
    curWinX += pw + 2;
  }

  // ---------------------------------------------------------------------------
  // 5. MODULE 4 — 6-BAY BUILT-IN WINDOW BENCH (x = 96..228, z = 0..18.25)
  // ---------------------------------------------------------------------------
  const m4X = nx(DIM.m4XStart);
  const m4W = (DIM.m4XEnd - DIM.m4XStart) * scale;
  const cushionY = nz(DIM.m4CaseTop + DIM.m4CushionH);
  const cushionH = DIM.m4CushionH * scale;
  const benchCaseY = nz(DIM.m4CaseTop);
  const benchCaseH = DIM.m4CaseTop * scale;

  // Matte black upholstered seat cushion (2-piece center seam at x = 162)
  rect(page, m4X, cushionY, m4W, cushionH, {
    fill: C.cushionTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });
  line(page, nx(162), cushionY, nx(162), cushionY + cushionH, 0.75, C.black);

  // White oak bench carcass & recessed toe-kick
  rect(page, m4X, benchCaseY, m4W, benchCaseH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.1,
  });
  rect(page, m4X, floorY - toeH, m4W, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  // Center module seam line between Left 3-Bay Module and Right 3-Bay Module
  line(page, nx(162), benchCaseY, nx(162), floorY, 0.9, C.black);

  // 6 Bays with EXACT mirrored alternating pattern: [H | V | H] + [H | V | H]
  const bayPattern: Array<'horizontal' | 'vertical'> = [
    'horizontal',
    'vertical',
    'horizontal',
    'horizontal',
    'vertical',
    'horizontal',
  ];
  const baySpan = (DIM.m4XEnd - DIM.m4XStart) / 6; // 22" center-to-center
  const bayInnerY = benchCaseY + t;
  const bayInnerH = benchCaseH - toeH - t * 2;
  for (let i = 0; i < 6; i++) {
    const bx = nx(DIM.m4XStart + i * baySpan) + t * 0.75;
    const bw = baySpan * scale - t * 1.5;
    const orient = bayPattern[i];
    drawFlutedPanel(page, bx, bayInnerY, bw, bayInnerH, orient, orient === 'vertical' ? 8 : 4, {
      borderWidth: 0.68,
      fluteWidth: 0.32,
    });
  }

  // ---------------------------------------------------------------------------
  // 6. STRUCTURAL PILASTER COLUMN (x = 228..244, z = 0..96)
  // ---------------------------------------------------------------------------
  line(page, nx(DIM.pilXStart), nz(DIM.ceilH), nx(DIM.pilXStart), floorY, 0.9, C.black);
  line(page, nx(DIM.pilXEnd), nz(DIM.ceilH), nx(DIM.pilXEnd), floorY, 0.9, C.inkMid);

  // ---------------------------------------------------------------------------
  // 7. 3 WRAP-AROUND SOLID WALNUT FLOATING SHELVES (x = 228..294)
  // ---------------------------------------------------------------------------
  for (const sz of DIM.shelfZs) {
    const sy = nz(sz + DIM.shelfT);
    const sh = DIM.shelfT * scale;
    // Left wrap segment across pilaster face (slightly darker edge emphasis)
    rect(
      page,
      nx(DIM.shelfXStart),
      sy,
      (DIM.shelfXEnd - DIM.shelfXStart) * scale,
      sh,
      { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.95 }
    );
    // Pilaster corner fold line on shelf fascia
    line(page, nx(DIM.pilXEnd), sy, nx(DIM.pilXEnd), sy + sh, 0.65, C.inkMid);
  }

  // ---------------------------------------------------------------------------
  // 8. MODULE 5 — RIGHT ALCOVE BASE CABINET (x = 250..292, z = 0..32)
  // ---------------------------------------------------------------------------
  const m5X = nx(DIM.m5XStart);
  const m5W = (DIM.m5XEnd - DIM.m5XStart) * scale;
  rect(page, m5X, nz(DIM.baseH), m5W, DIM.baseH * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });
  rect(page, m5X, floorY - toeH, m5W, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  const m5DoorsY = nz(DIM.baseH) + t;
  const m5DoorsH = DIM.baseH * scale - toeH - t * 2;
  const m5HalfW = (m5W - t * 2 - 1.2) / 2;
  drawFlutedPanel(page, m5X + t, m5DoorsY, m5HalfW, m5DoorsH, 'vertical', 8, {
    borderWidth: 0.72,
    fluteWidth: 0.34,
  });
  drawFlutedPanel(
    page,
    m5X + t + m5HalfW + 1.2,
    m5DoorsY,
    m5HalfW,
    m5DoorsH,
    'vertical',
    8,
    { borderWidth: 0.72, fluteWidth: 0.34 }
  );
  // 2 Turned Walnut Pulls at upper-center meeting stile
  drawTurnedPull(page, m5X + m5W / 2 - 3.4 * scale, nz(22.5), pullR);
  drawTurnedPull(page, m5X + m5W / 2 + 3.4 * scale, nz(22.5), pullR);

  // ---------------------------------------------------------------------------
  // 9. COLOR-CODED SECTION CUT LINES & BADGES (A, B, C) — Clear Above Vaulted Right Ceiling
  // ---------------------------------------------------------------------------
  const badgeY = nz(DIM.ceilRightH) - 12;
  const markers: Array<{ xInch: number; letter: string; color: ReturnType<typeof rgb> }> = [
    { xInch: DIM.secAX, letter: 'A', color: C.orange },
    { xInch: DIM.secBX, letter: 'B', color: C.cyan },
    { xInch: DIM.secCX, letter: 'C', color: C.yellow },
  ];
  for (const m of markers) {
    const mx = nx(m.xInch);
    line(page, mx, badgeY + 12, mx, floorY + 8, 0.55, C.inkLight, [3.5, 3]);
    drawSectionBadge(page, font, mx, badgeY, 10.5, m.letter, m.color);
  }
}

/** Shared helper for Sections A, B, and C (identical 1:1 vertical scale!) */
function drawSectionWallFrame(
  page: PDFPage,
  backWallX: number,
  floorY: number,
  scale: number,
  rightReachInch: number
) {
  const ceilY = floorY - DIM.ceilH * scale;
  const wallW = DIM.wallT * scale;
  // Wall poché bar
  rect(page, backWallX - wallW, ceilY, wallW, DIM.ceilH * scale, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });
  // Heavy ceiling & floor datum bars
  line(
    page,
    backWallX - wallW - 6,
    ceilY,
    backWallX + rightReachInch * scale,
    ceilY,
    1.9,
    C.black
  );
  line(
    page,
    backWallX - wallW - 6,
    floorY,
    backWallX + rightReachInch * scale,
    floorY,
    1.9,
    C.black
  );
}

function drawSectionA(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  const wallX = box.innerX + 76;
  const sz = (zInch: number) => floorY - zInch * scale;
  const t = DIM.caseT * scale;
  const toeH = DIM.toeH * scale;
  const toeRec = DIM.toeRecess * scale;

  drawSectionWallFrame(page, wallX, floorY, scale, 48);

  // Upper Tall Tower Carcass (19" D, z = 32..96)
  const upD = DIM.m3UpDepth * scale;
  rect(page, wallX, sz(DIM.ceilH), upD, (DIM.ceilH - DIM.baseH) * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });
  // Back panel + top/bottom oak plates
  rect(page, wallX, sz(DIM.ceilH), upD, t, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.6 });
  rect(page, wallX, sz(DIM.m3TransomY + DIM.caseT), upD, t, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.6,
  });
  // 4 adjustable interior shelves
  for (const shZ of [45, 56, 67, 77]) {
    rect(page, wallX + 1.5, sz(shZ), upD - 4.5, t * 0.85, {
      fill: C.white,
      stroke: C.inkMid,
      strokeWidth: 0.55,
    });
  }
  // Fluted walnut upper door + transom section profile on front edge
  rect(page, wallX + upD - 2.6, sz(DIM.ceilH) + t, 2.6, (DIM.ceilH - DIM.baseH) * scale - t, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.7,
  });
  // Turned pull profile near bottom of upper door
  rect(page, wallX + upD, sz(39.4), 3.4, 2.4, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.65,
  });

  // Lower 2-Drawer Chest Carcass (24" D — steps 5" forward!, z = 0..32)
  const lowD = DIM.m3LowDepth * scale;
  rect(page, wallX, sz(DIM.baseH), lowD, (DIM.baseH - DIM.toeH) * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.2,
  });
  // Recessed toe-kick
  rect(page, wallX, floorY - toeH, lowD - toeRec, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  // 2 deep interior drawer boxes + thick fluted fronts + turned pulls
  const drwHeights = [
    [18.2, 30.8],
    [4.6, 17.2],
  ];
  for (const [zBot, zTop] of drwHeights) {
    rect(page, wallX + 3, sz(zTop), lowD - 7.2, (zTop - zBot) * scale, {
      fill: C.white,
      stroke: C.inkMid,
      strokeWidth: 0.55,
    });
    // Fluted front thickness
    rect(page, wallX + lowD - 3.2, sz(zTop), 3.2, (zTop - zBot) * scale, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.75,
    });
    // Pull profile
    rect(page, wallX + lowD, sz(zTop - 4.2), 3.4, 2.4, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.65,
    });
  }

  // Clean CAD Callout Notes (matching Kitchen Sections!)
  drawCadLabel(page, font, ['19" DEEP UPPER', 'TOWER + FLUTED', 'TRANSOM'], wallX + upD + 14, sz(76), {
    size: 6.8,
  });
  drawCadLabel(page, font, ['5" OAK LEDGE', 'STEP-OUT'], wallX + lowD + 12, sz(36.5), {
    size: 6.6,
  });
  drawCadLabel(page, font, ['24" DEEP CHEST', '2x FULL-WIDTH', 'FLUTED DRAWERS'], wallX + lowD + 12, sz(21), {
    size: 6.8,
  });
}

function drawSectionB(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  const wallX = box.innerX + 78;
  const sz = (zInch: number) => floorY - zInch * scale;
  const toeH = DIM.toeH * scale;
  const toeRec = DIM.toeRecess * scale;
  const wallW = DIM.wallT * scale;

  drawSectionWallFrame(page, wallX, floorY, scale, 48);

  // Window Opening Cut through the Back Wall (z = 21.5..84)
  rect(page, wallX - wallW, sz(DIM.winHead), wallW, (DIM.winHead - DIM.winSill) * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  // Double-pane glazing lines inside wall section
  line(page, wallX - wallW * 0.58, sz(DIM.winHead), wallX - wallW * 0.58, sz(DIM.winSill), 0.65, C.inkMid);
  line(page, wallX - wallW * 0.42, sz(DIM.winHead), wallX - wallW * 0.42, sz(DIM.winSill), 0.65, C.inkMid);
  // Window sill trim projecting slightly
  rect(page, wallX - wallW - 1.5, sz(DIM.winSill + 1.5), wallW + 4.5, 2.2 * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.75,
  });

  // Built-in Window Bench (21" D, z = 0..18.25)
  const bD = DIM.m4Depth * scale;
  // Upholstered Matte Black Seat Cushion (2.5" thick)
  rect(page, wallX, sz(DIM.m4CaseTop + DIM.m4CushionH), bD, DIM.m4CushionH * scale, {
    fill: C.cushionTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });
  // White Oak Bench Carcass (z = 3.5..15.75)
  rect(page, wallX, sz(DIM.m4CaseTop), bD, (DIM.m4CaseTop - DIM.toeH) * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });
  // Interior push-to-open storage drawer box
  rect(page, wallX + 3, sz(DIM.m4CaseTop - 1.2), bD - 6.6, (DIM.m4CaseTop - DIM.toeH - 2.4) * scale, {
    fill: C.white,
    stroke: C.inkMid,
    strokeWidth: 0.55,
  });
  // Fluted walnut drawer front (handleless)
  rect(page, wallX + bD - 2.8, sz(DIM.m4CaseTop - 0.9), 2.8, (DIM.m4CaseTop - DIM.toeH - 1.8) * scale, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  // Recessed toe-kick
  rect(page, wallX, floorY - toeH, bD - toeRec, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Clean CAD Callout Notes
  drawCadLabel(page, font, ['4-PANEL PICTURE', 'WINDOW GLAZING', '(21.5" SILL DATUM)'], wallX + 14, sz(64), {
    size: 6.8,
  });
  drawCadLabel(page, font, ['2.5" MATTE BLACK', 'BENCH CUSHION'], wallX + bD + 12, sz(23), {
    size: 6.6,
  });
  drawCadLabel(page, font, ['21" D × 18" H BENCH', 'PUSH-TO-OPEN', 'FLUTED STORAGE'], wallX + bD + 12, sz(11.5), {
    size: 6.8,
  });
}

function drawSectionC(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  const wallX = box.innerX + 78;
  const sz = (zInch: number) => floorY - zInch * scale;
  const toeH = DIM.toeH * scale;
  const toeRec = DIM.toeRecess * scale;

  drawSectionWallFrame(page, wallX, floorY, scale, 48);

  // 3 Cantilevered Solid Walnut Floating Shelves (~14" D in alcove, 1.75" thick)
  const shD = DIM.shelfDepth * scale;
  for (const zShelf of DIM.shelfZs) {
    rect(page, wallX, sz(zShelf + DIM.shelfT), shD, DIM.shelfT * scale, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 1.0,
    });
    // Concealed floating steel rod dashed line inside shelf
    line(
      page,
      wallX - 4,
      sz(zShelf + DIM.shelfT / 2),
      wallX + shD * 0.72,
      sz(zShelf + DIM.shelfT / 2),
      0.45,
      C.inkMid,
      [2.5, 2]
    );
  }

  // Right Alcove Base Cabinet (19" D, z = 0..32)
  const cD = DIM.m5Depth * scale;
  rect(page, wallX, sz(DIM.baseH), cD, (DIM.baseH - DIM.toeH) * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });
  // Adjustable interior shelf
  rect(page, wallX + 1.5, sz(18), cD - 4.5, 0.75 * scale, {
    fill: C.white,
    stroke: C.inkMid,
    strokeWidth: 0.55,
  });
  // Fluted walnut door front + upper turned pull
  rect(page, wallX + cD - 2.8, sz(DIM.baseH - 0.9), 2.8, (DIM.baseH - DIM.toeH - 1.8) * scale, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  rect(page, wallX + cD, sz(23.2), 3.4, 2.4, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  // Recessed toe-kick
  rect(page, wallX, floorY - toeH, cD - toeRec, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Clean CAD Callout Notes
  drawCadLabel(
    page,
    font,
    ['3x SOLID WALNUT', 'FLOATING SHELVES', '(1.75" THK × 14" D)'],
    wallX + shD + 14,
    sz(67.5),
    { size: 6.8 }
  );
  drawCadLabel(
    page,
    font,
    ['ALCOVE BASE', '(19" D × 32" H)', 'FINGER-JOINT OAK'],
    wallX + cD + 12,
    sz(21),
    { size: 6.8 }
  );
}

// =============================================================================
// SHEET A-102: FLOOR PLAN & HORIZONTAL SECTION + TRUE 30° ORTHOGRAPHIC ISOMETRIC
// =============================================================================

function drawFloorPlan(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Generous room depth so the Floor Plan sits vertically balanced & gallery-proportioned inside the tall left card
  const availW = box.innerW - 72;
  const availH = box.innerH - 84;
  const planDepth = 176;
  const scale = Math.min(availW / (DIM.roomW + 16), availH / (planDepth + 44));

  const ox = box.innerX + (box.innerW - DIM.roomW * scale) / 2 + 2;
  const totalDrawingH = (planDepth + 42) * scale;
  const oy = box.innerYTop + (box.innerH - totalDrawingH) / 2 + 44 * scale;
  const px = (xInch: number) => ox + xInch * scale;
  const pyc = (yInch: number) => oy + yInch * scale;
  const wt = DIM.wallT * scale;

  // Architectural Walls (West, North, Pilaster Bump-Out, East)
  rect(page, px(-DIM.wallT), pyc(-DIM.wallT), (DIM.winXStart + DIM.wallT) * scale, wt, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });
  // Picture window in North Wall
  rect(page, px(DIM.winXStart), pyc(-DIM.wallT), (DIM.winXEnd - DIM.winXStart) * scale, wt, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  line(
    page,
    px(DIM.winXStart),
    pyc(-DIM.wallT * 0.42),
    px(DIM.winXEnd),
    pyc(-DIM.wallT * 0.42),
    0.75,
    C.inkMid
  );
  line(
    page,
    px(DIM.winXStart),
    pyc(-DIM.wallT * 0.68),
    px(DIM.winXEnd),
    pyc(-DIM.wallT * 0.68),
    0.75,
    C.inkMid
  );
  // North Wall right of window to East Wall
  rect(
    page,
    px(DIM.winXEnd),
    pyc(-DIM.wallT),
    (DIM.roomW - DIM.winXEnd + DIM.wallT) * scale,
    wt,
    { fill: C.wallFill, stroke: C.black, strokeWidth: 1.35 }
  );

  // Structural Pilaster Bump-Out (x = 228..244, y = 0..11)
  rect(page, px(DIM.pilXStart), pyc(0), (DIM.pilXEnd - DIM.pilXStart) * scale, DIM.pilDepth * scale, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });

  // West Wall (with Sloped Window cut)
  rect(page, px(-DIM.wallT), pyc(0), wt, 22 * scale, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });
  rect(page, px(-DIM.wallT), pyc(22), wt, 40 * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  line(page, px(-DIM.wallT * 0.5), pyc(22), px(-DIM.wallT * 0.5), pyc(62), 0.75, C.inkMid);
  rect(page, px(-DIM.wallT), pyc(62), wt, (planDepth - 62) * scale, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });

  // East Wall (with large side window)
  rect(page, px(DIM.roomW), pyc(0), wt, 24 * scale, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });
  rect(page, px(DIM.roomW), pyc(24), wt, 66 * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  line(
    page,
    px(DIM.roomW + DIM.wallT * 0.5),
    pyc(24),
    px(DIM.roomW + DIM.wallT * 0.5),
    pyc(90),
    0.75,
    C.inkMid
  );
  rect(page, px(DIM.roomW), pyc(90), wt, (planDepth - 90) * scale, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });

  // Subtle dashed room boundary break line at bottom of open family room
  line(page, px(0), pyc(planDepth), px(DIM.roomW), pyc(planDepth), 0.55, C.inkLight, [6, 4]);

  // --- CABINETRY IN PLAN VIEW ---

  // Module 1: West Return Cabinet (x = 0..18, y = 20..66)
  rect(page, px(0), pyc(DIM.m1YStart), DIM.m1Depth * scale, (DIM.m1YEnd - DIM.m1YStart) * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });
  line(page, px(DIM.m1Depth - 3), pyc(43), px(DIM.m1Depth), pyc(43), 0.65, C.inkMid);
  // Leader callout placed cleanly in open floor space to the right of West Return Cabinet (zero clipping!)
  line(page, px(DIM.m1Depth + 2), pyc(46), px(DIM.m1Depth + 14), pyc(46), 0.5, C.inkLight);
  drawCadLabel(page, font, ['L-RETURN', '2-DR BASE', '(18" D × 46" W)'], px(DIM.m1Depth + 17), pyc(43), {
    size: 6.0,
    align: 'left',
  });

  // Module 2: Left North-Wall Base Cabinet (x = 0..50, y = 0..20)
  rect(page, px(0), pyc(0), DIM.m2XEnd * scale, DIM.m2Depth * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });
  line(page, px(DIM.m1Depth), pyc(0), px(DIM.m1Depth), pyc(DIM.m2Depth), 0.65, C.inkLight, [2.5, 2]);
  drawCadLabel(page, font, ['1-DR BASE', '(20" D)'], px(34), pyc(9), {
    size: 5.8,
    align: 'center',
  });

  // Module 3: Tall Tower + 2-Drawer Chest (x = 50..96, y = 0..24; dashed upper at y = 19!)
  rect(
    page,
    px(DIM.m3XStart),
    pyc(0),
    (DIM.m3XEnd - DIM.m3XStart) * scale,
    DIM.m3LowDepth * scale,
    { fill: C.white, stroke: C.black, strokeWidth: 1.25 }
  );
  line(
    page,
    px(DIM.m3XStart),
    pyc(DIM.m3UpDepth),
    px(DIM.m3XEnd),
    pyc(DIM.m3UpDepth),
    0.85,
    C.inkMid,
    [3.5, 2.5]
  );
  drawCadLabel(page, font, ['TALL TOWER', '19" UP / 24" LOW'], px(73), pyc(7.8), {
    size: 5.6,
    align: 'center',
  });

  // Module 4: 6-Bay Built-In Window Bench (x = 96..228, y = 0..21)
  rect(
    page,
    px(DIM.m4XStart),
    pyc(0),
    (DIM.m4XEnd - DIM.m4XStart) * scale,
    DIM.m4Depth * scale,
    { fill: C.cushionTint, stroke: C.black, strokeWidth: 1.15 }
  );
  line(page, px(162), pyc(0), px(162), pyc(DIM.m4Depth), 0.9, C.black);
  const baySpan = (DIM.m4XEnd - DIM.m4XStart) / 6;
  const bayTags = ['H', 'V', 'H', 'H', 'V', 'H'];
  for (let i = 0; i < 6; i++) {
    if (i > 0 && i !== 3) {
      const dx = px(DIM.m4XStart + i * baySpan);
      line(page, dx, pyc(0), dx, pyc(DIM.m4Depth), 0.55, C.inkMid, [2.5, 2.5]);
    }
    drawCadLabel(
      page,
      font,
      [bayTags[i]],
      px(DIM.m4XStart + (i + 0.5) * baySpan),
      pyc(DIM.m4Depth * 0.58),
      { size: 6.2, align: 'center', color: C.black, weight: 'bold' }
    );
  }
  drawCadLabel(
    page,
    font,
    ['6-BAY WINDOW BENCH · 132" W × 21" D (H/V FLUTE ORIENTATION)'],
    px(162),
    pyc(DIM.m4Depth + 14),
    { size: 6.2, align: 'center' }
  );

  // Module 5: Right Alcove Base Cabinet (x = 250..292, y = 0..19)
  rect(
    page,
    px(DIM.m5XStart),
    pyc(0),
    (DIM.m5XEnd - DIM.m5XStart) * scale,
    DIM.m5Depth * scale,
    { fill: C.white, stroke: C.black, strokeWidth: 1.15 }
  );
  // Overhead Dashed Wrap-Around Walnut Floating Shelves (x = 228..294, y = 0..14)
  line(
    page,
    px(DIM.shelfXStart),
    pyc(DIM.pilDepth),
    px(DIM.shelfXStart),
    pyc(DIM.shelfDepth),
    0.85,
    C.inkMid,
    [3.5, 2.5]
  );
  line(
    page,
    px(DIM.shelfXStart),
    pyc(DIM.shelfDepth),
    px(DIM.shelfXEnd),
    pyc(DIM.shelfDepth),
    0.85,
    C.inkMid,
    [3.5, 2.5]
  );
  // Label placed cleanly in top clear zone above the dashed shelf line (zero overlap!)
  drawCadLabel(page, font, ['ALCOVE BASE'], px(271), pyc(8.5), {
    size: 5.5,
    align: 'center',
  });
  drawCadLabel(page, font, ['19" D BASE +', '3x OVERHEAD', 'WRAP SHELVES'], px(271), pyc(30), {
    size: 5.8,
    align: 'center',
    color: C.inkMid,
  });

  // Left Return depth dimension & Overall Room Width dimension
  drawDimArrow(page, px(0), pyc(142), px(DIM.roomW), pyc(142), C.inkMid, 0.65);
  line(page, px(0), pyc(72), px(0), pyc(148), 0.45, C.inkLight);
  line(page, px(DIM.roomW), pyc(96), px(DIM.roomW), pyc(148), 0.45, C.inkLight);
  drawCadLabel(
    page,
    font,
    ['24\'-6" FULL-WALL MILLWORK SPAN (294" APPROX.)'],
    px(DIM.roomW / 2),
    pyc(137),
    { size: 7.0, align: 'center', color: C.inkDark }
  );

  // Subtle spatial clearance & room labels
  drawCadLabel(page, font, ['OPEN FAMILY ROOM FLOOR'], px(155), pyc(92), {
    size: 7.8,
    align: 'center',
    color: C.inkLight,
  });
  drawCadLabel(page, font, ['4-PANEL PICTURE WINDOW (124" W)'], px(162), pyc(-12), {
    size: 6.4,
    align: 'center',
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['PILASTER'], px(236), pyc(24), {
    size: 5.5,
    align: 'center',
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['SLOPED', 'WINDOW'], px(10), pyc(80), {
    size: 5.6,
    align: 'left',
    color: C.inkLight,
  });
  drawCadLabel(page, font, ['EAST WALL', 'WINDOW'], px(DIM.roomW - 8), pyc(62), {
    size: 5.6,
    align: 'right',
    color: C.inkLight,
  });

  // Color-Coded Section Cut Lines & Badges (A, B, C)
  const cutTopY = pyc(-34);
  const planMarkers: Array<{ xInch: number; letter: string; color: ReturnType<typeof rgb> }> = [
    { xInch: DIM.secAX, letter: 'A', color: C.orange },
    { xInch: DIM.secBX, letter: 'B', color: C.cyan },
    { xInch: DIM.secCX, letter: 'C', color: C.yellow },
  ];
  for (const m of planMarkers) {
    const mx = px(m.xInch);
    line(page, mx, cutTopY + 11, mx, pyc(52), 0.55, C.inkLight, [3.5, 3]);
    drawSectionBadge(page, font, mx, cutTopY, 10, m.letter, m.color);
  }
}

/** True 3D -> 2D 30° Orthographic Isometric Projection of the Entire Family Room Millwork */
function drawIsometricView(page: PDFPage, _font: PDFFont, box: ViewportCard) {
  // Isometric basis (camera looking from front-left-above so BOTH West Wall interior face (+X)
  // AND North Wall front face (+Y) AND Tops (+Z) are cleanly visible — matching Render 1 & Kitchen A-102!):
  // +X (along North wall right): goes down-right at +30° -> (+cos30, +sin30)
  // +Y (forward along West wall): goes down-left at -30° -> (-cos30, +sin30)
  // +Z (height upward): goes straight UP -> (0, -1)
  const COS30 = Math.cos(Math.PI / 6); // 0.8660254
  const SIN30 = 0.5;

  // Compute bounding box of our 3D scene to auto-fit & center perfectly in box
  const rawProj = (x: number, y: number, z: number): [number, number] => [
    (x - y) * COS30,
    (x + y) * SIN30 - z,
  ];

  const samplePts: Array<[number, number, number]> = [
    [-6, -6, 0],
    [DIM.roomW + 4, -6, DIM.ceilRightH],
    [-6, DIM.westDepth + 8, DIM.ceilWestFrontH],
    [DIM.roomW + 4, DIM.westDepth + 8, 0],
  ];
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, y, z] of samplePts) {
    const [u, v] = rawProj(x, y, z);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const scale = Math.min((box.innerW - 44) / (maxU - minU), (box.innerH - 36) / (maxV - minV));
  const cx = box.innerX + box.innerW / 2 - ((minU + maxU) / 2) * scale;
  const cy = box.innerYTop + box.innerH / 2 - ((minV + maxV) / 2) * scale;

  const P = (x: number, y: number, z: number): [number, number] => {
    const [u, v] = rawProj(x, y, z);
    return [cx + u * scale, cy + v * scale];
  };

  const isoLine = (
    a: [number, number, number],
    b: [number, number, number],
    w = 0.8,
    col = C.black,
    dash?: number[]
  ) => {
    const [x1, y1] = P(...a);
    const [x2, y2] = P(...b);
    line(page, x1, y1, x2, y2, w, col, dash);
  };

  const isoQuad = (
    pts3: Array<[number, number, number]>,
    opts: { fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb>; strokeWidth?: number }
  ) => {
    polygon(
      page,
      pts3.map((p) => P(...p)),
      opts
    );
  };

  /** Draw a clean solid axis-aligned 3D box showing its 3 visible isometric faces (+X right, +Y front, +Z top) */
  const isoBox = (
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    opts: {
      topFill?: ReturnType<typeof rgb>;
      frontFill?: ReturnType<typeof rgb>;
      rightFill?: ReturnType<typeof rgb>;
      strokeWidth?: number;
      skipRight?: boolean;
      skipFront?: boolean;
      skipTop?: boolean;
    } = {}
  ) => {
    const sw = opts.strokeWidth ?? 0.9;
    // Front face (y = y1, facing +Y toward front-left)
    if (!opts.skipFront) {
      isoQuad(
        [
          [x0, y1, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
        { fill: opts.frontFill ?? C.white, stroke: C.black, strokeWidth: sw }
      );
    }
    // Right face (x = x1, facing +X toward front-right)
    if (!opts.skipRight) {
      isoQuad(
        [
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x1, y0, z1],
        ],
        { fill: opts.rightFill ?? C.oakTint, stroke: C.black, strokeWidth: sw }
      );
    }
    // Top face (z = z1)
    if (!opts.skipTop) {
      isoQuad(
        [
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
        { fill: opts.topFill ?? C.white, stroke: C.black, strokeWidth: sw }
      );
    }
  };

  /** Draw fluted walnut face on the +Y (North Wall front) plane */
  const isoFlutedFront = (
    x0: number,
    x1: number,
    y: number,
    z0: number,
    z1: number,
    orient: 'vertical' | 'horizontal',
    count: number
  ) => {
    isoQuad(
      [
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ],
      { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.65 }
    );
    if (orient === 'vertical') {
      for (let i = 1; i < count; i++) {
        const fx = x0 + ((x1 - x0) * i) / count;
        isoLine([fx, y, z0], [fx, y, z1], 0.28, C.inkMid);
      }
    } else {
      for (let i = 1; i < count; i++) {
        const fz = z0 + ((z1 - z0) * i) / count;
        isoLine([x0, y, fz], [x1, y, fz], 0.28, C.inkMid);
      }
    }
  };

  /** Draw fluted walnut face on the +X (West Return front) plane */
  const isoFlutedRight = (
    x: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    count: number
  ) => {
    isoQuad(
      [
        [x, y0, z0],
        [x, y1, z0],
        [x, y1, z1],
        [x, y0, z1],
      ],
      { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.65 }
    );
    for (let i = 1; i < count; i++) {
      const fy = y0 + ((y1 - y0) * i) / count;
      isoLine([x, fy, z0], [x, fy, z1], 0.28, C.inkMid);
    }
  };

  // ===========================================================================
  // 1. ARCHITECTURAL ROOM SHELL (Floor + West Wall + North Wall + Windows)
  // ===========================================================================
  const floorDepth = DIM.westDepth + 12;
  // Floor polygon
  isoQuad(
    [
      [0, 0, 0],
      [DIM.roomW, 0, 0],
      [DIM.roomW, floorDepth, 0],
      [0, floorDepth, 0],
    ],
    { fill: C.white, stroke: C.inkDark, strokeWidth: 1.0 }
  );

  // West Wall (x = 0, y = 0..westDepth, ceiling slopes from 96" at y=0 to 108" at y=westDepth)
  isoQuad(
    [
      [0, 0, 0],
      [0, DIM.westDepth, 0],
      [0, DIM.westDepth, DIM.ceilWestFrontH],
      [0, 0, DIM.ceilH],
    ],
    { fill: C.white, stroke: C.black, strokeWidth: 1.25 }
  );
  // West Wall thickness cap on top & front edge
  isoQuad(
    [
      [-DIM.wallT, 0, DIM.ceilH],
      [0, 0, DIM.ceilH],
      [0, DIM.westDepth, DIM.ceilWestFrontH],
      [-DIM.wallT, DIM.westDepth, DIM.ceilWestFrontH],
    ],
    { fill: C.wallFill, stroke: C.black, strokeWidth: 1.1 }
  );
  isoQuad(
    [
      [-DIM.wallT, DIM.westDepth, 0],
      [0, DIM.westDepth, 0],
      [0, DIM.westDepth, DIM.ceilWestFrontH],
      [-DIM.wallT, DIM.westDepth, DIM.ceilWestFrontH],
    ],
    { fill: C.wallFill, stroke: C.black, strokeWidth: 1.1 }
  );
  // West Wall Sloped Trapezoid Window
  isoQuad(
    [
      [0, 22, 44],
      [0, 62, 44],
      [0, 62, 95],
      [0, 22, 80],
    ],
    { fill: C.glassTint, stroke: C.black, strokeWidth: 0.9 }
  );
  isoQuad(
    [
      [0, 24.5, 46.5],
      [0, 59.5, 46.5],
      [0, 59.5, 91.5],
      [0, 24.5, 77.5],
    ],
    { fill: C.glassTint, stroke: C.inkMid, strokeWidth: 0.55 }
  );

  // North Wall (y = 0, x = 0..roomW, ceiling 96" to pilaster then sloping up to 108")
  isoQuad(
    [
      [0, 0, 0],
      [DIM.roomW, 0, 0],
      [DIM.roomW, 0, DIM.ceilRightH],
      [DIM.pilXEnd, 0, DIM.ceilH],
      [0, 0, DIM.ceilH],
    ],
    { fill: C.white, stroke: C.black, strokeWidth: 1.25 }
  );
  // North Wall top thickness cap
  isoQuad(
    [
      [-DIM.wallT, -DIM.wallT, DIM.ceilH],
      [DIM.pilXEnd, -DIM.wallT, DIM.ceilH],
      [DIM.pilXEnd, 0, DIM.ceilH],
      [0, 0, DIM.ceilH],
    ],
    { fill: C.wallFill, stroke: C.black, strokeWidth: 1.1 }
  );
  isoQuad(
    [
      [DIM.pilXEnd, -DIM.wallT, DIM.ceilH],
      [DIM.roomW, -DIM.wallT, DIM.ceilRightH],
      [DIM.roomW, 0, DIM.ceilRightH],
      [DIM.pilXEnd, 0, DIM.ceilH],
    ],
    { fill: C.wallFill, stroke: C.black, strokeWidth: 1.1 }
  );
  // 4-Panel Picture Window on North Wall
  isoQuad(
    [
      [DIM.winXStart, 0, DIM.winSill],
      [DIM.winXEnd, 0, DIM.winSill],
      [DIM.winXEnd, 0, DIM.winHead],
      [DIM.winXStart, 0, DIM.winHead],
    ],
    { fill: C.white, stroke: C.black, strokeWidth: 0.9 }
  );
  const pws = [20, 38, 38, 20];
  let cxw = DIM.winXStart + 2;
  for (const pw of pws) {
    isoQuad(
      [
        [cxw, 0, DIM.winSill + 2],
        [cxw + pw, 0, DIM.winSill + 2],
        [cxw + pw, 0, DIM.winHead - 2],
        [cxw, 0, DIM.winHead - 2],
      ],
      { fill: C.glassTint, stroke: C.inkMid, strokeWidth: 0.55 }
    );
    cxw += pw + 2;
  }

  // ===========================================================================
  // 2. MILLWORK MODULES IN STRICT BACK-TO-FRONT PAINTER'S ORDER!
  //    Order: Back-left (M2) -> M1 (West Return) -> M3 (Tall Tower + Lower Chest)
  //           -> M4 (Window Bench) -> Pilaster -> M5 (Right Base + Wrap Shelves)
  // ===========================================================================

  // Helper for crisp isometric turned walnut pull dot
  const isoPull = (x: number, y: number, z: number) => {
    const [pxi, pyi] = P(x, y, z);
    page.drawCircle({
      x: pxi,
      y: py(pyi),
      size: 2.1,
      color: C.white,
      borderColor: C.black,
      borderWidth: 0.65,
    });
  };

  // MODULE 2: Left North-Wall Base Cabinet (x = 0..50, y = 0..20, z = 0..32)
  isoBox(0, 0, DIM.toeH, DIM.m2XEnd, DIM.m2Depth, DIM.baseH, {
    strokeWidth: 0.95,
    skipRight: true,
  });
  isoBox(DIM.m1Depth, 0, 0, DIM.m2XEnd, DIM.m2Depth - DIM.toeRecess, DIM.toeH, {
    strokeWidth: 0.75,
    skipTop: true,
    skipRight: true,
  });
  isoFlutedFront(DIM.m2XStart + 1.2, DIM.m2XEnd - 1.2, DIM.m2Depth, DIM.toeH + 1.1, DIM.baseH - 1.1, 'vertical', 9);
  isoPull(DIM.m2XEnd - 4.2, DIM.m2Depth, 22.5);

  // MODULE 1: West Return Cabinet (x = 0..18, y = 20..66, z = 0..32)
  isoBox(0, DIM.m1YStart, 0, DIM.m1Depth - DIM.toeRecess, DIM.m1YEnd - 1, DIM.toeH, {
    strokeWidth: 0.75,
    skipTop: true,
  });
  isoBox(0, DIM.m1YStart, DIM.toeH, DIM.m1Depth, DIM.m1YEnd, DIM.baseH, {
    strokeWidth: 1.0,
    frontFill: C.oakTint,
  });
  isoQuad(
    [
      [0, DIM.m1YEnd, 0],
      [DIM.m1Depth, DIM.m1YEnd, 0],
      [DIM.m1Depth, DIM.m1YEnd, DIM.baseH],
      [0, DIM.m1YEnd, DIM.baseH],
    ],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 1.0 }
  );
  // Exposed box finger-joints on Module 1 front exposed oak gable (top & bottom!)
  for (let i = 0; i < 3; i++) {
    const fx = 2.2 + i * 5.0;
    isoQuad(
      [
        [fx, DIM.m1YEnd, DIM.baseH - 1.3],
        [fx + 2.3, DIM.m1YEnd, DIM.baseH - 1.3],
        [fx + 2.3, DIM.m1YEnd, DIM.baseH],
        [fx, DIM.m1YEnd, DIM.baseH],
      ],
      { fill: C.inkLight, stroke: C.black, strokeWidth: 0.35 }
    );
    isoQuad(
      [
        [fx, DIM.m1YEnd, DIM.toeH],
        [fx + 2.3, DIM.m1YEnd, DIM.toeH],
        [fx + 2.3, DIM.m1YEnd, DIM.toeH + 1.3],
        [fx, DIM.m1YEnd, DIM.toeH + 1.3],
      ],
      { fill: C.inkLight, stroke: C.black, strokeWidth: 0.35 }
    );
  }
  isoFlutedRight(DIM.m1Depth, DIM.m1YStart + 1.2, 42.6, DIM.toeH + 1.1, DIM.baseH - 1.1, 7);
  isoFlutedRight(DIM.m1Depth, 43.4, DIM.m1YEnd - 1.2, DIM.toeH + 1.1, DIM.baseH - 1.1, 7);
  isoPull(DIM.m1Depth, 39.2, 22.5);
  isoPull(DIM.m1Depth, 46.8, 22.5);
  isoLine([0, DIM.m1YStart, DIM.baseH], [DIM.m1Depth, DIM.m1YStart, DIM.baseH], 0.65, C.inkMid, [2, 2]);

  // MODULE 3: Lower 2-Drawer Chest (0..32) + Upper Tall Tower (32..96)
  isoBox(DIM.m3XStart, 0, 0, DIM.m3XEnd - 1, DIM.m3LowDepth - DIM.toeRecess, DIM.toeH, {
    strokeWidth: 0.75,
    skipTop: true,
  });
  isoBox(DIM.m3XStart, 0, DIM.toeH, DIM.m3XEnd, DIM.m3LowDepth, DIM.baseH, {
    strokeWidth: 1.05,
    rightFill: C.oakTint,
  });
  isoQuad(
    [
      [DIM.m3XEnd, 0, 0],
      [DIM.m3XEnd, DIM.m3LowDepth, 0],
      [DIM.m3XEnd, DIM.m3LowDepth, DIM.baseH],
      [DIM.m3XEnd, 0, DIM.baseH],
    ],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 1.05 }
  );
  for (let i = 0; i < 4; i++) {
    const fy = 2.5 + i * 5.2;
    isoQuad(
      [
        [DIM.m3XEnd, fy, DIM.baseH - 1.3],
        [DIM.m3XEnd, fy + 2.4, DIM.baseH - 1.3],
        [DIM.m3XEnd, fy + 2.4, DIM.baseH],
        [DIM.m3XEnd, fy, DIM.baseH],
      ],
      { fill: C.inkLight, stroke: C.black, strokeWidth: 0.35 }
    );
    isoQuad(
      [
        [DIM.m3XEnd, fy, DIM.toeH],
        [DIM.m3XEnd, fy + 2.4, DIM.toeH],
        [DIM.m3XEnd, fy + 2.4, DIM.toeH + 1.3],
        [DIM.m3XEnd, fy, DIM.toeH + 1.3],
      ],
      { fill: C.inkLight, stroke: C.black, strokeWidth: 0.35 }
    );
  }
  isoFlutedFront(DIM.m3XStart + 1.2, DIM.m3XEnd - 1.2, DIM.m3LowDepth, 18.2, 30.8, 'horizontal', 4);
  isoFlutedFront(DIM.m3XStart + 1.2, DIM.m3XEnd - 1.2, DIM.m3LowDepth, 4.6, 17.2, 'horizontal', 4);
  isoPull(DIM.m3XStart + 8.5, DIM.m3LowDepth, 25.5);
  isoPull(DIM.m3XEnd - 8.5, DIM.m3LowDepth, 25.5);
  isoPull(DIM.m3XStart + 8.5, DIM.m3LowDepth, 12.0);
  isoPull(DIM.m3XEnd - 8.5, DIM.m3LowDepth, 12.0);

  // Upper Tall Tower (x = 50..96, y = 0..19, z = 32..96)
  isoBox(DIM.m3XStart, 0, DIM.baseH, DIM.m3XEnd, DIM.m3UpDepth, DIM.ceilH, {
    strokeWidth: 1.05,
    rightFill: C.oakTint,
  });
  isoFlutedFront(
    DIM.m3XStart + 1.2,
    DIM.m3XEnd - 1.2,
    DIM.m3UpDepth,
    DIM.m3TransomY + 1.0,
    DIM.ceilH - 1.0,
    'vertical',
    14
  );
  isoFlutedFront(
    DIM.m3XStart + 1.2,
    72.6,
    DIM.m3UpDepth,
    DIM.baseH + 1.0,
    DIM.m3TransomY - 0.6,
    'vertical',
    7
  );
  isoFlutedFront(
    73.4,
    DIM.m3XEnd - 1.2,
    DIM.m3UpDepth,
    DIM.baseH + 1.0,
    DIM.m3TransomY - 0.6,
    'vertical',
    7
  );
  isoPull(69.2, DIM.m3UpDepth, 38.5);
  isoPull(76.8, DIM.m3UpDepth, 38.5);

  // MODULE 4: 6-Bay Built-In Window Bench (x = 96..228, y = 0..21, z = 0..18.25)
  isoBox(DIM.m4XStart, 0, 0, DIM.m4XEnd, DIM.m4Depth - DIM.toeRecess, DIM.toeH, {
    strokeWidth: 0.75,
    skipTop: true,
  });
  isoBox(DIM.m4XStart, 0, DIM.toeH, DIM.m4XEnd, DIM.m4Depth, DIM.m4CaseTop, {
    strokeWidth: 0.95,
  });
  const isoPattern: Array<'horizontal' | 'vertical'> = [
    'horizontal',
    'vertical',
    'horizontal',
    'horizontal',
    'vertical',
    'horizontal',
  ];
  const bSpan = (DIM.m4XEnd - DIM.m4XStart) / 6;
  for (let i = 0; i < 6; i++) {
    const bx0 = DIM.m4XStart + i * bSpan + 1.0;
    const bx1 = DIM.m4XStart + (i + 1) * bSpan - 1.0;
    const ori = isoPattern[i];
    isoFlutedFront(
      bx0,
      bx1,
      DIM.m4Depth,
      DIM.toeH + 1.0,
      DIM.m4CaseTop - 1.0,
      ori,
      ori === 'vertical' ? 7 : 4
    );
  }
  isoBox(DIM.m4XStart, 0, DIM.m4CaseTop, DIM.m4XEnd, DIM.m4Depth, DIM.m4CaseTop + DIM.m4CushionH, {
    topFill: C.cushionTint,
    frontFill: C.cushionTint,
    rightFill: C.cushionTint,
    strokeWidth: 0.95,
  });
  isoLine(
    [162, 0, DIM.m4CaseTop + DIM.m4CushionH],
    [162, DIM.m4Depth, DIM.m4CaseTop + DIM.m4CushionH],
    0.75,
    C.black
  );
  isoLine(
    [162, DIM.m4Depth, DIM.m4CaseTop],
    [162, DIM.m4Depth, DIM.m4CaseTop + DIM.m4CushionH],
    0.75,
    C.black
  );

  // STRUCTURAL WALL PILASTER (x = 228..244, y = 0..11, z = 0..96)
  isoBox(DIM.pilXStart, 0, 0, DIM.pilXEnd, DIM.pilDepth, DIM.ceilH, {
    topFill: C.wallFill,
    frontFill: C.white,
    rightFill: C.white,
    strokeWidth: 1.05,
  });

  // MODULE 5: Right Alcove Base Cabinet (x = 250..292, y = 0..19, z = 0..32)
  isoBox(DIM.m5XStart, 0, 0, DIM.m5XEnd, DIM.m5Depth - DIM.toeRecess, DIM.toeH, {
    strokeWidth: 0.75,
    skipTop: true,
  });
  isoBox(DIM.m5XStart, 0, DIM.toeH, DIM.m5XEnd, DIM.m5Depth, DIM.baseH, {
    strokeWidth: 1.0,
    rightFill: C.oakTint,
  });
  isoFlutedFront(DIM.m5XStart + 1.2, 270.6, DIM.m5Depth, DIM.toeH + 1.1, DIM.baseH - 1.1, 'vertical', 7);
  isoFlutedFront(271.4, DIM.m5XEnd - 1.2, DIM.m5Depth, DIM.toeH + 1.1, DIM.baseH - 1.1, 'vertical', 7);
  isoPull(267.4, DIM.m5Depth, 22.5);
  isoPull(274.6, DIM.m5Depth, 22.5);

  // 3 WRAP-AROUND SOLID WALNUT FLOATING SHELVES (wrapping pilaster x = 228..244 and alcove x = 244..294)
  for (const sz of DIM.shelfZs) {
    // Back alcove portion (x = 244..294, y = 0..14)
    isoBox(DIM.pilXEnd, 0, sz, DIM.shelfXEnd, DIM.shelfDepth, sz + DIM.shelfT, {
      topFill: C.walnutTint,
      frontFill: C.walnutTint,
      rightFill: C.walnutTint,
      strokeWidth: 0.9,
    });
    // Front pilaster wrap strip (x = 228..244, y = 11..14)
    isoBox(DIM.shelfXStart, DIM.pilDepth, sz, DIM.pilXEnd, DIM.shelfDepth, sz + DIM.shelfT, {
      topFill: C.walnutTint,
      frontFill: C.walnutTint,
      rightFill: C.walnutTint,
      strokeWidth: 0.9,
      skipRight: true,
    });
  }
}

// =============================================================================
// SHEET A-103: BENCH ELEVATION, BENCH SECTION D, L-CORNER/CHEST DETAIL & 1:1 JOINERY
// =============================================================================

function drawBenchDetailElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  const benchW = (DIM.m4XEnd - DIM.m4XStart) * scale;
  const x0 = box.innerX + (box.innerW - benchW) / 2;
  const bx = (inch: number) => x0 + inch * scale;
  const bz = (zInch: number) => floorY - zInch * scale;
  const t = DIM.caseT * scale;
  const toeH = DIM.toeH * scale;

  // Heavy floor line
  line(page, x0 - 24, floorY, x0 + benchW + 24, floorY, 1.8, C.black);

  // Window sill reference line just above cushion
  line(page, x0 + 4 * scale, bz(DIM.winSill), x0 + benchW - 4 * scale, bz(DIM.winSill), 0.7, C.inkLight, [4, 3]);
  drawCadLabel(page, font, ['WINDOW SILL DATUM (21.5" AFF)'], bx(26), bz(DIM.winSill + 2.2), {
    size: 6.2,
    align: 'center',
    color: C.inkLight,
  });

  // 2.5" Matte Black Upholstered Seat Cushion (2-piece split at 66")
  const cushTopY = bz(DIM.m4CaseTop + DIM.m4CushionH);
  const cushH = DIM.m4CushionH * scale;
  rect(page, x0, cushTopY, benchW, cushH, {
    fill: C.cushionTint,
    stroke: C.black,
    strokeWidth: 1.2,
  });
  line(page, bx(66), cushTopY, bx(66), cushTopY + cushH, 0.9, C.black);

  // White Oak Bench Carcass & Toe-Kick
  const caseTopY = bz(DIM.m4CaseTop);
  const caseH = DIM.m4CaseTop * scale;
  rect(page, x0, caseTopY, benchW, caseH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.2,
  });
  rect(page, x0, floorY - toeH, benchW, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  line(page, bx(66), caseTopY, bx(66), floorY, 1.0, C.black);

  // 6 Alternating Fluted Walnut Bays: [H | V | H] + [H | V | H]
  const pattern: Array<'horizontal' | 'vertical'> = [
    'horizontal',
    'vertical',
    'horizontal',
    'horizontal',
    'vertical',
    'horizontal',
  ];
  const bayW = 22;
  const innerY = caseTopY + t;
  const innerH = caseH - toeH - t * 2;
  for (let i = 0; i < 6; i++) {
    const px0 = bx(i * bayW) + t * 0.75;
    const pw = bayW * scale - t * 1.5;
    const ori = pattern[i];
    drawFlutedPanel(page, px0, innerY, pw, innerH, ori, ori === 'vertical' ? 10 : 4, {
      borderWidth: 0.8,
      fluteWidth: 0.36,
    });
    drawCadLabel(
      page,
      font,
      [ori === 'vertical' ? 'VERT. FLUTE' : 'HORIZ. FLUTE'],
      bx((i + 0.5) * bayW),
      floorY + 14,
      { size: 5.8, align: 'center', color: C.inkMid }
    );
  }

  // Overall width dimension cleanly ABOVE window sill datum with zero collision!
  const dimY = cushTopY - 40;
  drawDimArrow(page, x0, dimY, x0 + benchW, dimY, C.inkMid, 0.6);
  line(page, x0, cushTopY - 4, x0, dimY - 4, 0.45, C.inkLight);
  line(page, x0 + benchW, cushTopY - 4, x0 + benchW, dimY - 4, 0.45, C.inkLight);
  drawCadLabel(
    page,
    font,
    ['132" OVERALL BENCH (2x 66" 3-BAY MODULES · HANDLELESS PUSH-TO-OPEN)'],
    bx(52),
    dimY - 6,
    { size: 6.8, align: 'center', color: C.inkDark }
  );

  // Section D Marker (Orange) cutting cleanly through Bay 5 (clear of dimension text!)
  const secDX = bx(115);
  const badgeY = dimY - 36;
  line(page, secDX, badgeY + 11, secDX, floorY + 24, 0.65, C.inkMid, [3.5, 2.5]);
  drawSectionBadge(page, font, secDX, badgeY, 10.5, 'D', C.orange);
}

function drawSectionDBench(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  const wallX = box.innerX + 165;
  const bz = (zInch: number) => floorY - zInch * scale;
  const wt = DIM.wallT * scale;
  const bD = DIM.m4Depth * scale;
  const t = DIM.caseT * scale;
  const toeH = DIM.toeH * scale;
  const toeRec = DIM.toeRecess * scale;

  // Heavy floor datum
  line(page, wallX - wt - 32, floorY, wallX + bD + 130, floorY, 1.8, C.black);

  // Back wall up to window sill + window sash profile
  rect(page, wallX - wt, bz(DIM.winSill), wt, DIM.winSill * scale, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.35,
  });
  // Window sill & frame above bench
  rect(page, wallX - wt, bz(DIM.winSill + 18), wt, 18 * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  line(page, wallX - wt * 0.56, bz(DIM.winSill + 18), wallX - wt * 0.56, bz(DIM.winSill), 0.75, C.inkMid);
  line(page, wallX - wt * 0.42, bz(DIM.winSill + 18), wallX - wt * 0.42, bz(DIM.winSill), 0.75, C.inkMid);
  rect(page, wallX - wt - 3, bz(DIM.winSill + 1.5), wt + 7, 1.8 * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // 2.5" Matte Black Upholstered Seat Cushion with subtle beveled top edge
  const cushY = bz(DIM.m4CaseTop + DIM.m4CushionH);
  const cushH = DIM.m4CushionH * scale;
  drawRoundedRect(page, wallX, cushY, bD, cushH, 3.5, {
    fill: C.cushionTint,
    borderColor: C.black,
    borderWidth: 1.15,
  });

  // Solid 3/4" Rift White Oak Carcass (top, back, bottom)
  const caseY = bz(DIM.m4CaseTop);
  const caseH = (DIM.m4CaseTop - DIM.toeH) * scale;
  rect(page, wallX, caseY, bD, caseH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.2,
  });
  // Top & bottom solid oak plates
  rect(page, wallX, caseY, bD, t, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.75 });
  rect(page, wallX, floorY - toeH - t, bD, t, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.75 });

  // Interior Push-to-Open Undermount Drawer Box
  const drwY = caseY + t + 3;
  const drwH = caseH - t * 2 - 6;
  rect(page, wallX + 7, drwY, bD - 14.5, drwH, {
    fill: C.white,
    stroke: C.inkMid,
    strokeWidth: 0.75,
  });
  // Concealed undermount soft-close push-to-open runner rail (dashed)
  line(
    page,
    wallX + 7,
    drwY + drwH - 3.5,
    wallX + bD - 8,
    drwY + drwH - 3.5,
    0.7,
    C.inkDark,
    [3.5, 2.5]
  );

  // Thick 1-1/8" Semicircular Fluted Walnut Drawer Front (inset flush)
  rect(page, wallX + bD - 6.5, caseY + t + 0.8, 6.5, caseH - t * 2 - 1.6, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Recessed White Oak Toe-Kick Plinth (3.5" H × 2.5" recess)
  rect(page, wallX, floorY - toeH, bD - toeRec, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.0,
  });

  // Clean Dimension & Callout Leaders (generous spacing, zero crowding!)
  const hDimX = wallX + bD + 20;
  drawDimArrow(page, hDimX, cushY, hDimX, floorY, C.inkMid, 0.6);
  line(page, wallX + bD + 4, cushY, hDimX + 5, cushY, 0.45, C.inkLight);
  drawCadLabel(page, font, ['18 1/4"', 'SEAT HT.'], hDimX + 7, (cushY + floorY) / 2 - 4, {
    size: 6.5,
    color: C.inkDark,
  });

  // Depth dimension (21" D)
  const dDimY = cushY - 18;
  drawDimArrow(page, wallX, dDimY, wallX + bD, dDimY, C.inkMid, 0.6);
  line(page, wallX + bD, cushY - 3, wallX + bD, dDimY - 4, 0.45, C.inkLight);
  drawCadLabel(page, font, ['21" BENCH DEPTH'], wallX + bD / 2, dDimY - 5, {
    size: 6.6,
    align: 'center',
    color: C.inkDark,
  });

  // Technical Callouts cleanly aligned in right column with thin horizontal leaders
  const noteX = wallX + bD + 86;
  line(page, wallX + bD + 3, cushY + cushH / 2, noteX - 6, cushY + cushH / 2, 0.45, C.inkLight);
  drawCadLabel(page, font, ['2.5" UPHOLSTERED', 'MATTE BLACK TOP'], noteX, cushY + 2, {
    size: 6.4,
  });
  drawCadLabel(page, font, ['3/4" RIFT WHITE OAK', 'BOX CARCASS'], noteX, caseY + 24, {
    size: 6.4,
  });
  line(page, wallX + bD + 3, drwY + drwH - 2, noteX - 6, drwY + drwH - 2, 0.45, C.inkLight);
  drawCadLabel(page, font, ['CONCEALED PUSH-TO-OPEN', 'UNDERMOUNT RUNNER'], noteX, drwY + drwH - 5, {
    size: 6.4,
  });
  drawCadLabel(page, font, ['PICTURE WINDOW', 'SILL & GLAZING'], wallX - wt - 12, bz(DIM.winSill + 10), {
    size: 6.4,
    align: 'right',
  });
}

function drawCornerAndChestDetail(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  scale: number,
  floorY: number
) {
  // Large-scale elevation of Module 2 (32" W) + Module 3 Lower 2-Drawer Chest (46" W) + Right Exposed Finger-Joint Side (12" oblique cue or clean 24" side view!)
  // Even better: draw pure orthographic Front Elevation of Module 2 + Module 3 Lower Chest (78" W) + Adjacent Side Elevation of the 24" D Right Exposed White Oak Gable (showing the exposed 3/4" box finger-joints top & bottom at full scale!)
  const frontW = 78 * scale;
  const sideW = 24 * scale;
  const gap = 36;
  const totalW = frontW + gap + sideW;
  const x0 = box.innerX + (box.innerW - totalW) / 2;
  const fx = (inch: number) => x0 + inch * scale;
  const fz = (zInch: number) => floorY - zInch * scale;
  const t = DIM.caseT * scale;
  const toeH = DIM.toeH * scale;
  const pullR = 0.88 * scale;

  // Floor datum across both sub-views
  line(page, x0 - 16, floorY, x0 + frontW + 12, floorY, 1.8, C.black);
  line(page, x0 + frontW + gap - 12, floorY, x0 + totalW + 16, floorY, 1.8, C.black);

  // Module 2 (x = 0..32" in local coords)
  rect(page, fx(0), fz(DIM.baseH), 32 * scale, DIM.baseH * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.15,
  });
  rect(page, fx(0), floorY - toeH, 32 * scale, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawFlutedPanel(
    page,
    fx(0) + t,
    fz(DIM.baseH) + t,
    32 * scale - t * 2,
    DIM.baseH * scale - toeH - t * 2,
    'vertical',
    10,
    { borderWidth: 0.78, fluteWidth: 0.36 }
  );
  drawTurnedPull(page, fx(27.5), fz(22.5), pullR);

  // Module 3 Lower 2-Drawer Chest (x = 32..78" in local coords, 46" wide)
  const chX = fx(32);
  const chW = 46 * scale;
  // Subtle broken outline of upper tall tower sitting above z = 32
  rect(page, chX, fz(DIM.baseH + 14), chW, 14 * scale, {
    fill: C.white,
    stroke: C.inkMid,
    strokeWidth: 0.85,
  });
  drawFlutedPanel(page, chX + t, fz(DIM.baseH + 14), (chW - t * 2 - 1.5) / 2, 14 * scale - 1, 'vertical', 8, {
    borderWidth: 0.65,
    fluteWidth: 0.3,
  });
  drawFlutedPanel(
    page,
    chX + t + (chW - t * 2 - 1.5) / 2 + 1.5,
    fz(DIM.baseH + 14),
    (chW - t * 2 - 1.5) / 2,
    14 * scale - 1,
    'vertical',
    8,
    { borderWidth: 0.65, fluteWidth: 0.3 }
  );
  drawTurnedPull(page, chX + chW / 2 - 3.6 * scale, fz(38.5), pullR);
  drawTurnedPull(page, chX + chW / 2 + 3.6 * scale, fz(38.5), pullR);
  // Break line at top of partial upper tower
  line(page, chX - 4, fz(DIM.baseH + 14), chX + chW + 4, fz(DIM.baseH + 14), 0.75, C.inkMid, [5, 3]);

  // Lower 2-Drawer Chest Box
  rect(page, chX, fz(DIM.baseH), chW, DIM.baseH * scale, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.25,
  });
  rect(page, chX, floorY - toeH, chW, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  const drwTopY = fz(DIM.baseH) + t + 0.6;
  const drwAreaH = DIM.baseH * scale - toeH - t * 2 - 1.2;
  const drwH = (drwAreaH - 1.6) / 2;
  drawFlutedPanel(page, chX + t, drwTopY, chW - t * 2, drwH, 'horizontal', 4, {
    borderWidth: 0.8,
    fluteWidth: 0.38,
  });
  drawTurnedPull(page, chX + 8.5 * scale, drwTopY + drwH * 0.38, pullR);
  drawTurnedPull(page, chX + chW - 8.5 * scale, drwTopY + drwH * 0.38, pullR);

  const drw2Y = drwTopY + drwH + 1.6;
  drawFlutedPanel(page, chX + t, drw2Y, chW - t * 2, drwH, 'horizontal', 4, {
    borderWidth: 0.8,
    fluteWidth: 0.38,
  });
  drawTurnedPull(page, chX + 8.5 * scale, drw2Y + drwH * 0.38, pullR);
  drawTurnedPull(page, chX + chW - 8.5 * scale, drw2Y + drwH * 0.38, pullR);

  // Adjacent Right Side Elevation of the Exposed Rift White Oak Gable (24" D, showing exposed finger-joints!)
  const sx = x0 + frontW + gap;
  // Partial upper tower right gable (19" D, stepped back 5" from front!)
  rect(page, sx + 5 * scale, fz(DIM.baseH + 14), 19 * scale, 14 * scale, {
    fill: C.oakTint,
    stroke: C.inkMid,
    strokeWidth: 0.85,
  });
  line(page, sx + 5 * scale - 4, fz(DIM.baseH + 14), sx + sideW + 4, fz(DIM.baseH + 14), 0.75, C.inkMid, [5, 3]);
  // Lower chest full-height exposed oak gable (24" D, z = 0..32)
  rect(page, sx, fz(DIM.baseH), sideW, DIM.baseH * scale, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 1.25,
  });
  // Toe-kick front recess notch at bottom-left
  rect(page, sx, floorY - toeH, DIM.toeRecess * scale, toeH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // EXPOSED 3/4" BOX FINGER-JOINTS prominently drawn at TOP & BOTTOM of exposed oak side panel (matches Render 3!)
  drawFingerJointsStrip(page, sx + 3, fz(DIM.baseH), sideW - 6, t * 1.15, 'horizontal', 5);
  drawFingerJointsStrip(page, sx + 3, floorY - toeH - t * 1.15, sideW - 6, t * 1.15, 'horizontal', 5);

  // Height dimension on far-left & 5" upper setback cue on right gable
  const leftDimX = x0 - 16;
  drawDimArrow(page, leftDimX, fz(DIM.baseH), leftDimX, floorY, C.inkMid, 0.55);
  line(page, x0 - 4, fz(DIM.baseH), leftDimX - 4, fz(DIM.baseH), 0.4, C.inkLight);
  drawCadLabel(page, font, ['32" H'], leftDimX - 4, (fz(DIM.baseH) + floorY) / 2 + 2, {
    size: 6.2,
    align: 'right',
    color: C.inkDark,
  });
  drawCadLabel(page, font, ['5" LEDGE', 'SETBACK'], sx + 2, fz(DIM.baseH + 19), {
    size: 5.8,
    align: 'left',
    color: C.inkMid,
  });

  // Clean Labels below each sub-view
  drawCadLabel(
    page,
    font,
    ['LEFT BASE + 2-DRAWER CHEST FRONT ELEVATION (4x HORIZ. FLUTES / DRAWER)'],
    x0 + frontW / 2,
    floorY + 14,
    { size: 6.4, align: 'center', color: C.inkDark }
  );
  drawCadLabel(
    page,
    font,
    ['RIGHT GABLE (24" D)', 'EXPOSED 3/4" BOX JOINTS'],
    sx + sideW / 2,
    floorY + 13,
    { size: 6.1, align: 'center', color: C.inkDark }
  );
}

/** Card 04 on Sheet A-103: Three Crisp 1:1 Architectural Millwork Joinery Detail Callouts */
function drawJoineryProfiles(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const padX = 16;
  const colGap = 14;
  const colW = (box.innerW - padX * 2 - colGap * 2) / 3;
  const colY = box.innerYTop + 12;
  const colH = box.innerH - 22;

  const subCards = [
    { x: box.innerX + padX, title: '4A / WALNUT FLUTE PROFILE', sub: '0.50" R SEMICIRCULAR · 1.0" O.C.' },
    { x: box.innerX + padX + colW + colGap, title: '4B / EXPOSED BOX FINGER-JOINT', sub: '3/4" × 3/4" RIFT WHITE OAK' },
    { x: box.innerX + padX + (colW + colGap) * 2, title: '4C / TURNED WALNUT PULL', sub: '1.25" Ø CONICAL CYLINDER' },
  ];

  subCards.forEach((sc) => {
    drawRoundedRect(page, sc.x, colY, colW, colH, 8, {
      fill: C.white,
      borderColor: C.inkLight,
      borderWidth: 0.75,
    });
    drawTrackedText(page, font, sc.title, sc.x + colW / 2, colY + 19, 7.6, {
      color: C.black,
      tracking: 0.85,
      align: 'center',
      weight: 'bold',
    });
    drawTrackedText(page, font, sc.sub, sc.x + colW / 2, colY + 32, 6.5, {
      color: C.inkMid,
      tracking: 0.65,
      align: 'center',
      weight: 'medium',
    });
    line(page, sc.x + 12, colY + 41, sc.x + colW - 12, colY + 41, 0.6, C.gray);
  });

  // --- DETAIL 4A: SEMICIRCULAR WALNUT FLUTE CROSS-SECTION ---
  {
    const sx = subCards[0].x;
    const cx = sx + colW / 2;
    const cy = colY + colH * 0.56;
    const fluteR = 15.5; // radius in pt (fits comfortably inside 4A card with right-side thickness label!)
    const count = 4;
    const span = fluteR * 2 * count;
    const xStart = sx + 16;
    const baseThick = 22;

    let d = `M ${xStart},${cy + baseThick} L ${xStart + span},${cy + baseThick} L ${xStart + span},${cy}`;
    for (let i = count - 1; i >= 0; i--) {
      const fxEnd = xStart + i * fluteR * 2;
      const fxMid = fxEnd + fluteR;
      const k = fluteR * 0.5523;
      const fxStart = fxEnd + fluteR * 2;
      d += ` C ${fxStart},${cy - k} ${fxMid + k},${cy - fluteR} ${fxMid},${cy - fluteR}`;
      d += ` C ${fxMid - k},${cy - fluteR} ${fxEnd},${cy - k} ${fxEnd},${cy}`;
    }
    d += ' Z';
    page.drawSvgPath(d, {
      x: 0,
      y: PAGE_H,
      color: C.walnutTint,
      borderColor: C.black,
      borderWidth: 1.2,
    });
    for (let hx = xStart + 9; hx < xStart + span - 5; hx += 11) {
      line(page, hx, cy + 4, hx - 6, cy + baseThick - 3, 0.35, C.inkLight);
    }
    drawDimArrow(page, xStart, cy - fluteR - 14, xStart + fluteR * 2, cy - fluteR - 14, C.inkMid, 0.55);
    line(page, xStart, cy - 2, xStart, cy - fluteR - 18, 0.4, C.inkLight);
    line(page, xStart + fluteR * 2, cy - 2, xStart + fluteR * 2, cy - fluteR - 18, 0.4, C.inkLight);
    drawCadLabel(page, font, ['1.00" O.C. (0.50" R)'], xStart + fluteR + 12, cy - fluteR - 19, {
      size: 6.2,
      align: 'center',
      color: C.inkDark,
    });

    drawDimArrow(page, xStart + span + 10, cy - fluteR, xStart + span + 10, cy + baseThick, C.inkMid, 0.55);
    drawCadLabel(page, font, ['1-1/8"', 'SOLID', 'WALNUT'], xStart + span + 15, cy - 3, {
      size: 5.9,
      color: C.inkDark,
    });
    drawCadLabel(page, font, ['CNC MILLED · SOLID HARDWOOD'], cx, colY + colH - 16, {
      size: 6.0,
      align: 'center',
      color: C.inkMid,
    });
  }

  // --- DETAIL 4B: EXPOSED 3/4" BOX FINGER-JOINT CORNER ---
  {
    const sx = subCards[1].x;
    const cx = sx + colW / 2;
    const cy = colY + colH * 0.56;

    const bx = cx - 54;
    const by = cy - 40;
    const bw = 112;
    const bh = 88;
    const boardT = 22;

    rect(page, bx + bw - boardT, by, boardT, bh, {
      fill: C.oakTint,
      stroke: C.black,
      strokeWidth: 1.15,
    });
    rect(page, bx, by, bw - boardT, boardT, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 1.15,
    });
    const pins = 5;
    const pinH = boardT / pins;
    for (let i = 0; i < pins; i++) {
      const py0 = by + i * pinH;
      const isTopBoardPin = i % 2 === 0;
      rect(page, bx + bw - boardT, py0, boardT, pinH, {
        fill: isTopBoardPin ? C.inkLight : C.oakTint,
        stroke: C.black,
        strokeWidth: 0.75,
      });
    }
    line(page, bx + 8, by + 7, bx + bw - boardT - 8, by + 7, 0.35, C.inkLight);
    line(page, bx + 8, by + 15, bx + bw - boardT - 8, by + 15, 0.35, C.inkLight);
    line(page, bx + bw - 14, by + boardT + 8, bx + bw - 14, by + bh - 8, 0.35, C.inkLight);
    line(page, bx + bw - 7, by + boardT + 8, bx + bw - 7, by + bh - 8, 0.35, C.inkLight);

    drawDimArrow(page, bx - 10, by, bx - 10, by + boardT, C.inkMid, 0.55);
    drawCadLabel(page, font, ['3/4"'], bx - 14, by + 13, {
      size: 6.2,
      align: 'right',
      color: C.inkDark,
    });
    drawCadLabel(page, font, ['EXPOSED END-GRAIN', 'BOX FINGER-JOINTS', '(FLUSH SANDED)'], bx + 2, by + 44, {
      size: 6.0,
      color: C.inkDark,
    });
    line(page, bx + 66, by + 40, bx + bw - boardT - 2, by + 11, 0.55, C.inkMid);
    drawCadLabel(page, font, ['GLUED SOLID RIFT WHITE OAK CORNER'], cx, colY + colH - 16, {
      size: 6.0,
      align: 'center',
      color: C.inkMid,
    });
  }

  // --- DETAIL 4C: LATHE-TURNED SOLID WALNUT PULL (SIDE + FRONT ELEVATION) ---
  {
    const sx = subCards[2].x;
    const cx = sx + colW / 2;
    const cy = colY + colH * 0.56;

    // Left: Side Profile mounted on fluted door face (clean clearance below dim label!)
    const doorX = sx + 26;
    const doorW = 14;
    const proj = 36;
    rect(page, doorX, cy - 30, doorW, 60, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 1.0,
    });
    polygon(
      page,
      [
        [doorX + doorW, cy - 10],
        [doorX + doorW + proj, cy - 20],
        [doorX + doorW + proj, cy + 20],
        [doorX + doorW, cy + 10],
      ],
      { fill: C.white, stroke: C.black, strokeWidth: 1.2 }
    );
    line(page, doorX - 5, cy, doorX + doorW + 20, cy, 0.65, C.inkMid, [3, 2]);
    rect(page, doorX - 4, cy - 4.5, 4, 9, { fill: C.inkDark, stroke: C.black, strokeWidth: 0.7 });

    // Right: Front Circular Elevation of Pull
    const fcx = sx + colW - 44;
    const fRad = 20;
    page.drawCircle({
      x: fcx,
      y: py(cy),
      size: fRad,
      color: C.walnutTint,
      borderColor: C.black,
      borderWidth: 1.2,
    });
    page.drawCircle({
      x: fcx,
      y: py(cy),
      size: 10,
      borderColor: C.inkMid,
      borderWidth: 0.55,
    });
    line(page, fcx - 25, cy, fcx + 25, cy, 0.4, C.inkLight, [3, 2.5]);
    line(page, fcx, cy - 25, fcx, cy + 25, 0.4, C.inkLight, [3, 2.5]);

    // Dimensions positioned high & clean above both views (zero overlap with door block!)
    const dimTopY = cy - 40;
    drawDimArrow(page, doorX + doorW, dimTopY, doorX + doorW + proj, dimTopY, C.inkMid, 0.55);
    line(page, doorX + doorW, cy - 32, doorX + doorW, dimTopY - 3, 0.4, C.inkLight);
    line(page, doorX + doorW + proj, cy - 22, doorX + doorW + proj, dimTopY - 3, 0.4, C.inkLight);
    drawCadLabel(page, font, ['1-3/8" PROJ.'], doorX + doorW + proj / 2, dimTopY - 5, {
      size: 6.0,
      align: 'center',
      color: C.inkDark,
    });

    drawDimArrow(page, fcx - fRad, dimTopY, fcx + fRad, dimTopY, C.inkMid, 0.55);
    line(page, fcx - fRad, cy - 22, fcx - fRad, dimTopY - 3, 0.4, C.inkLight);
    line(page, fcx + fRad, cy - 22, fcx + fRad, dimTopY - 3, 0.4, C.inkLight);
    drawCadLabel(page, font, ['1.25" Ø FACE'], fcx, dimTopY - 5, {
      size: 6.0,
      align: 'center',
      color: C.inkDark,
    });
    drawCadLabel(page, font, ['LATHE-TURNED SOLID WALNUT · 8-32 STUD'], cx, colY + colH - 16, {
      size: 6.0,
      align: 'center',
      color: C.inkMid,
    });
  }
}

// =============================================================================
// MAIN BUILD PIPELINE: 3-PAGE VECTOR PDF + 3x 4800×3000 CRISP PNG SHEETS
// =============================================================================

async function buildFamilyRoomSheets() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle('casegoods — Family Room Cabinets & Window Bench (DWG 1064HEM · A-101 to A-103)');
  pdfDoc.setAuthor('Josh Heinke — casegoods (Omaha, NE)');
  pdfDoc.setCreator('casegoods Omaha Architectural Drawing Studio');

  const nexaFont = await pdfDoc.embedFont(fs.readFileSync(FONT_NEXA));
  const logoFullImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_FULL));
  const logoIconsImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_ICONS));

  // ===========================================================================
  // SHEET A-101 — ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE (Orange Primary)
  // ===========================================================================
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page1, nexaFont, logoFullImg, logoIconsImg, {
    sheetCode: 'A-101',
    sheetIndexText: 'SHEET 01 / 03',
    sheetCategory: 'ELEVATIONS & SECTIONS',
    bannerBg: C.orange,
    bannerLeft: 'A-101  /  ARCHITECTURAL ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE',
    bannerRight: 'FAMILY ROOM CABINETS & WINDOW BENCH  ·  DWG 1064HEM  ·  OMAHA STUDIO',
    accentColor: C.orange,
  });

  const row1Y = 174;
  const row1H = 384;
  const elevAW = 452;
  const elevBW = PAGE_W - 88 - elevAW - 16; // 1044 pt for the dramatic full-wall run!

  const boxElevA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row1Y,
    w: elevAW,
    h: row1H,
    title: '01 / ELEVATION A — WEST WALL',
    subtitle: 'L-RETURN · SLOPED WINDOW · TOWER PROFILE',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.orange,
    subtitleSize: 7.8,
  });

  const boxElevB = drawViewportCard(page1, nexaFont, {
    x: 44 + elevAW + 16,
    yTop: row1Y,
    w: elevBW,
    h: row1H,
    title: '02 / ELEVATION B — NORTH WALL (MAIN MILLWORK RUN)',
    subtitle: 'L-CORNER · TALL TOWER · 6-BAY WINDOW BENCH · WRAP SHELVES · ALCOVE',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.cyan,
    subtitleSize: 8.0,
  });

  // Shared 1:1 elevation scale across Elevation A and Elevation B!
  const sharedElevScale = Math.min(
    (boxElevB.innerW - 44) / DIM.roomW,
    (boxElevA.innerW - 76) / DIM.westDepth,
    (boxElevB.innerH - 72) / DIM.ceilRightH
  );
  const elevFloorY = boxElevB.innerYTop + boxElevB.innerH - 22;

  drawElevationA(page1, nexaFont, boxElevA, sharedElevScale, elevFloorY);
  drawElevationB(page1, nexaFont, boxElevB, sharedElevScale, elevFloorY);

  // Bottom Row: 3 Color-Coded Architectural Sections + Specification Key Card
  const row2Y = row1Y + row1H + 16; // 574
  const row2H = 330;                // ends at 904
  const secW = 318;
  const specW = PAGE_W - 88 - secW * 3 - 16 * 3; // 510

  const boxSecA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row2Y,
    w: secW,
    h: row2H,
    title: '03 / SECTION A',
    subtitle: 'TOWER & CHEST',
    headerBg: C.orange,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  const boxSecB = drawViewportCard(page1, nexaFont, {
    x: 44 + (secW + 16) * 1,
    yTop: row2Y,
    w: secW,
    h: row2H,
    title: '04 / SECTION B',
    subtitle: 'WINDOW BENCH',
    headerBg: C.cyan,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  const boxSecC = drawViewportCard(page1, nexaFont, {
    x: 44 + (secW + 16) * 2,
    yTop: row2Y,
    w: secW,
    h: row2H,
    title: '05 / SECTION C',
    subtitle: 'SHELVES & ALCOVE',
    headerBg: C.yellow,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  // Shared 1:1 vertical scale across all 3 architectural sections!
  const sharedSecScale = (boxSecA.innerH - 36) / DIM.ceilH;
  const secFloorY = boxSecA.innerYTop + boxSecA.innerH - 18;
  drawSectionA(page1, nexaFont, boxSecA, sharedSecScale, secFloorY);
  drawSectionB(page1, nexaFont, boxSecB, sharedSecScale, secFloorY);
  drawSectionC(page1, nexaFont, boxSecC, sharedSecScale, secFloorY);

  // 06 / SPECIFICATION KEY — Authentic Casegoods Architectural Schedule Table
  const specX = 44 + (secW + 16) * 3;
  drawViewportCard(page1, nexaFont, {
    x: specX,
    yTop: row2Y,
    w: specW,
    h: row2H,
    title: '06 / SPECIFICATION KEY',
    subtitle: 'MATERIAL & JOINERY SCHEDULE',
    headerBg: C.gray,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
    showCornerTicks: false,
  });

  const specs: Array<[string, string]> = [
    ['CASEWORK', 'RIFT WHITE OAK · EXPOSED BOX JOINTS'],
    ['DOORS & DRAWERS', 'FLUTED AMERICAN BLACK WALNUT'],
    ['FLOATING SHELVES', '1.75" SOLID WALNUT · WRAP PILASTER'],
    ['BENCH TOP', '2.5" MATTE BLACK UPHOLSTERED CUSHION'],
    ['HARDWARE', '1.25" TURNED WALNUT · PUSH-TO-OPEN'],
    ['TOLERANCE', '± 1/32" RHINO 3D · DWG 1064HEM'],
  ];

  const tableStartY = row2Y + 34;
  const rowStep = 40;
  specs.forEach(([label, value], idx) => {
    const ry = tableStartY + idx * rowStep;
    if (idx > 0) {
      page1.drawLine({
        start: { x: specX + 18, y: py(ry) },
        end: { x: specX + specW - 18, y: py(ry) },
        thickness: 0.75,
        color: C.gray,
      });
    }
    drawTrackedText(page1, nexaFont, label, specX + 18, ry + 24, 8.6, {
      color: C.black,
      tracking: 1.0,
      weight: 'bold',
    });
    drawTrackedText(page1, nexaFont, value, specX + 188, ry + 24, 8.8, {
      color: C.black,
      tracking: 0.7,
      weight: 'medium',
    });
  });

  const noteY = row2Y + row2H - 42;
  drawRoundedRect(page1, specX + 18, noteY, specW - 36, 28, 7, {
    fill: C.yellow,
    borderColor: C.black,
    borderWidth: 0.9,
  });
  drawTrackedText(
    page1,
    nexaFont,
    'VERIFY ALL FIELD DIMENSIONS & WINDOW SILLS PRIOR TO FABRICATION',
    specX + specW / 2,
    noteY + 17.8,
    8.0,
    {
      color: C.black,
      tracking: 0.95,
      align: 'center',
      weight: 'bold',
    }
  );

  // ===========================================================================
  // SHEET A-102 — PLAN & 30° ISOMETRIC (Fabrication Cyan Primary)
  // ===========================================================================
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page2, nexaFont, logoFullImg, logoIconsImg, {
    sheetCode: 'A-102',
    sheetIndexText: 'SHEET 02 / 03',
    sheetCategory: 'PLAN & ISOMETRIC',
    bannerBg: C.cyan,
    bannerLeft: 'A-102  /  FLOOR PLAN, HORIZONTAL SECTION & 30° ORTHOGRAPHIC ISOMETRIC',
    bannerRight: 'TRUE-PROPORTION GEOMETRY  ·  MATCHES ELEVATIONS A & B  ·  1064HEM',
    accentColor: C.cyan,
  });

  const a102Y = 174;
  const a102H = 730;
  const planW = 684;
  const isoW = PAGE_W - 88 - planW - 16; // 812

  const boxPlan = drawViewportCard(page2, nexaFont, {
    x: 44,
    yTop: a102Y,
    w: planW,
    h: a102H,
    title: '01 / FLOOR PLAN & HORIZONTAL SECTION',
    subtitle: 'DASHED: 19" UPPER TOWER & WRAP-AROUND SHELVES',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.yellow,
    bottomTicksYOffset: 54,
  });

  const boxIso = drawViewportCard(page2, nexaFont, {
    x: 44 + planW + 16,
    yTop: a102Y,
    w: isoW,
    h: a102H,
    title: '02 / ISOMETRIC VIEW — ORTHOGRAPHIC 30°',
    subtitle: 'TRUE-PROPORTION 3D GEOMETRY',
    headerBg: C.cyan,
    headerTextColor: C.black,
  });

  const planDrawingBox: ViewportCard = {
    ...boxPlan,
    innerH: boxPlan.innerH - 54,
  };
  drawFloorPlan(page2, nexaFont, planDrawingBox);

  // Bottom Section Cut Legend Bar (matching Kitchen A-102 pixel-for-pixel!)
  const legY = a102Y + a102H - 50;
  drawRoundedRect(page2, 60, legY, planW - 32, 34, 8, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 0.9,
  });
  drawTrackedText(page2, nexaFont, 'SECTION CUTS', 76, legY + 20.5, 8.2, {
    color: C.black,
    tracking: 1.15,
    weight: 'bold',
  });
  page2.drawLine({
    start: { x: 186, y: py(legY + 7) },
    end: { x: 186, y: py(legY + 27) },
    thickness: 0.75,
    color: C.gray,
  });
  const legendItems: Array<{ code: string; text: string; color: ReturnType<typeof rgb>; x: number }> = [
    { code: 'A', text: 'TOWER & CHEST', color: C.orange, x: 214 },
    { code: 'B', text: 'WINDOW BENCH', color: C.cyan, x: 382 },
    { code: 'C', text: 'SHELVES & ALCOVE', color: C.yellow, x: 546 },
  ];
  for (const item of legendItems) {
    drawSectionBadge(page2, nexaFont, item.x, legY + 17, 9.5, item.code, item.color);
    drawTrackedText(page2, nexaFont, item.text, item.x + 16, legY + 20.5, 8.0, {
      color: C.black,
      tracking: 0.85,
      weight: 'bold',
    });
  }

  drawIsometricView(page2, nexaFont, boxIso);

  // ===========================================================================
  // SHEET A-103 — BENCH, CHEST & JOINERY DETAILS (Flex Golden Yellow Primary)
  // ===========================================================================
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page3, nexaFont, logoFullImg, logoIconsImg, {
    sheetCode: 'A-103',
    sheetIndexText: 'SHEET 03 / 03',
    sheetCategory: 'BENCH & JOINERY DETAILS',
    bannerBg: C.yellow,
    bannerLeft: 'A-103  /  WINDOW BENCH ELEVATION, CROSS SECTION & MILLWORK JOINERY DETAILS',
    bannerRight: 'PROPORTIONAL SCHEMATIC  ·  FLUTED WALNUT · EXPOSED OAK BOX JOINTS  ·  1064HEM',
    accentColor: C.yellow,
  });

  const a103TopY = 174;
  const a103RowH = 357;
  const a103BotY = a103TopY + a103RowH + 16; // 547 -> ends at 904
  const leftColW = 790;
  const rightColW = PAGE_W - 88 - leftColW - 16; // 706

  const boxElevC = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103TopY,
    w: leftColW,
    h: a103RowH,
    title: '01 / DETAIL ELEVATION C — 6-BAY WINDOW BENCH',
    subtitle: 'ALTERNATING [H|V|H] + [H|V|H] FLUTED WALNUT · PUSH-TO-OPEN',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.yellow,
    subtitleSize: 8.0,
  });

  const boxSecD = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103TopY,
    w: rightColW,
    h: a103RowH,
    title: '03 / SECTION D — BENCH CROSS SECTION',
    subtitle: 'THRU PUSH-TO-OPEN DRAWER & WINDOW SILL',
    headerBg: C.orange,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  const boxElevD = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103BotY,
    w: leftColW,
    h: a103RowH,
    title: '02 / DETAIL ELEVATION D — 2-DRAWER CHEST & EXPOSED OAK GABLE',
    subtitle: 'HORIZONTAL FLUTES · 3/4" BOX FINGER-JOINTS · TURNED PULLS',
    headerBg: C.gray,
    headerTextColor: C.black,
    subtitleSize: 7.9,
  });

  const boxJoinery = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103BotY,
    w: rightColW,
    h: a103RowH,
    title: '04 / MILLWORK JOINERY & HARDWARE PROFILES',
    subtitle: '1:1 ARCHITECTURAL SHOP DETAILS',
    headerBg: C.cyan,
    headerTextColor: C.black,
    subtitleSize: 8.0,
    showCornerTicks: false,
  });

  // Match crisp architectural scale across Detail Elevation C & Section D (bench elevation & section)!
  const benchScale = Math.min((boxElevC.innerW - 76) / 132, (boxSecD.innerH - 96) / 42);
  const topFloorY = boxElevC.innerYTop + boxElevC.innerH - 36;
  drawBenchDetailElevation(page3, nexaFont, boxElevC, benchScale, topFloorY);
  drawSectionDBench(page3, nexaFont, boxSecD, benchScale * 1.15, topFloorY);

  // Chest & Exposed Gable detail at generous scale
  const chestScale = Math.min((boxElevD.innerW - 92) / 106, (boxElevD.innerH - 54) / 48);
  const botFloorY = boxElevD.innerYTop + boxElevD.innerH - 34;
  drawCornerAndChestDetail(page3, nexaFont, boxElevD, chestScale, botFloorY);

  drawJoineryProfiles(page3, nexaFont, boxJoinery);

  // Save 3-page pure vector PDF
  const pdfBytes = await pdfDoc.save();
  const pdfOutPath = path.join(OUT_DIR, 'casegoods-1064HEM-family-room-submittal-A101-A103.pdf');
  fs.writeFileSync(pdfOutPath, pdfBytes);

  // Rasterize each PDF page at 216 DPI -> exact 4800 x 3000 px crisp PNGs via Ghostscript
  const pngSpecs = [
    { page: 1, name: 'casegoods-1064HEM-A101-elevations-sections.png' },
    { page: 2, name: 'casegoods-1064HEM-A102-plan-isometric.png' },
    { page: 3, name: 'casegoods-1064HEM-A103-bench-joinery-details.png' },
  ];

  for (const s of pngSpecs) {
    const outPng = path.join(OUT_DIR, s.name);
    execFileSync('gs', [
      '-dSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-sDEVICE=png16m',
      '-r216',
      '-dTextAlphaBits=4',
      '-dGraphicsAlphaBits=4',
      `-dFirstPage=${s.page}`,
      `-dLastPage=${s.page}`,
      `-sOutputFile=${outPng}`,
      pdfOutPath,
    ]);
    const buf = fs.readFileSync(outPng);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    console.log(`Generated ${s.name}: ${w}x${h} (${(buf.length / 1024).toFixed(1)} KB)`);
  }

  console.log(`Generated PDF: ${pdfOutPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

buildFamilyRoomSheets().catch((err) => {
  console.error(err);
  process.exit(1);
});
