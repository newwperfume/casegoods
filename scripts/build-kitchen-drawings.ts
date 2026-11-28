import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PDFDocument, rgb, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const ROOT = process.cwd();
const SRC_A101 = path.join(ROOT, 'public/assets/aistudio/Code_Generated_Image_61941781.png');
const SRC_A102 = path.join(ROOT, 'public/assets/aistudio/Code_Generated_Image__1__3512361b.png');
const SRC_A103 = path.join(ROOT, 'public/assets/aistudio/Code_Generated_Image__2__3d9afa37.png');

const LOGO_FULL = path.join(ROOT, 'public/assets/aistudio/CASEGOODS_LOGO_FINAL6.png');
const LOGO_ICONS = path.join(ROOT, 'public/assets/aistudio/LOGO_4_IMAGES.png');
const FONT_NEXA = path.join(ROOT, 'public/assets/NexaLight.ttf');

const OUT_DIR = path.join(ROOT, 'public/downloads/drawings');
const TMP_DIR = path.join(ROOT, '.tmp-kitchen-crops');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// Brand Palette — Casegoods Omaha
const C = {
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  gray: rgb(203 / 255, 203 / 255, 203 / 255),      // #CBCBCB
  grayLight: rgb(245 / 255, 245 / 255, 245 / 255),
  grayDark: rgb(90 / 255, 90 / 255, 90 / 255),
  orange: rgb(239 / 255, 105 / 255, 34 / 255),     // #EF6922
  cyan: rgb(39 / 255, 170 / 255, 224 / 255),       // #27AAE0
  yellow: rgb(253 / 255, 203 / 255, 51 / 255),     // #FDCB33
};

// Page geometry: 1600 x 1000 pt (exact 16:10 -> 4800 x 3000 px @ 216 DPI)
const PAGE_W = 1600;
const PAGE_H = 1000;

interface CropSpec {
  id: string;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  markers?: Array<{
    label: string;
    /** Center X in source image coordinates */
    srcX: number;
    /** Center Y in source image coordinates */
    srcY: number;
    color: ReturnType<typeof rgb>;
    /** Radius in source pixels to mask & replace cleanly */
    srcRadius?: number;
  }>;
}

const CROPS: Record<string, CropSpec> = {
  // Sheet A-101
  elevA: {
    id: 'a101_elevA',
    src: SRC_A101,
    x: 317,
    y: 242,
    w: 1334,
    h: 1108,
    markers: [{ label: 'A', srcX: 1235.5, srcY: 260, color: C.orange, srcRadius: 21 }],
  },
  elevB: {
    id: 'a101_elevB',
    src: SRC_A101,
    x: 2285,
    y: 242,
    w: 1892,
    h: 1108,
    markers: [
      { label: 'B', srcX: 2783.5, srcY: 260, color: C.cyan, srcRadius: 21 },
      { label: 'C', srcX: 3724.5, srcY: 260, color: C.yellow, srcRadius: 21 },
    ],
  },
  secA: {
    id: 'a101_secA',
    src: SRC_A101,
    x: 575,
    y: 1708,
    w: 447,
    h: 857,
  },
  secB: {
    id: 'a101_secB',
    src: SRC_A101,
    x: 1783,
    y: 1708,
    w: 453,
    h: 857,
  },
  secC: {
    id: 'a101_secC',
    src: SRC_A101,
    x: 2983,
    y: 1708,
    w: 446,
    h: 857,
  },
  // Sheet A-102
  plan: {
    id: 'a102_plan',
    src: SRC_A102,
    x: 192,
    y: 627,
    w: 1954,
    h: 1515,
    markers: [
      { label: 'A', srcX: 254, srcY: 1308, color: C.orange, srcRadius: 21 },
      { label: 'B', srcX: 818, srcY: 643.5, color: C.cyan, srcRadius: 21 },
      { label: 'C', srcX: 1709, srcY: 643.5, color: C.yellow, srcRadius: 21 },
    ],
  },
  iso: {
    id: 'a102_iso',
    src: SRC_A102,
    x: 2421,
    y: 369,
    w: 2064,
    h: 1916,
  },
  // Sheet A-103
  elevC: {
    id: 'a103_elevC',
    src: SRC_A103,
    x: 660,
    y: 303,
    w: 1625,
    h: 907,
    markers: [{ label: 'D', srcX: 1401, srcY: 321, color: C.orange, srcRadius: 21 }],
  },
  secD: {
    id: 'a103_secD',
    src: SRC_A103,
    x: 3162,
    y: 390,
    w: 1014,
    h: 803,
  },
  elevD: {
    id: 'a103_elevD',
    src: SRC_A103,
    x: 681,
    y: 1745,
    w: 1583,
    h: 774,
  },
  planD: {
    id: 'a103_planD',
    src: SRC_A103,
    x: 2981,
    y: 1665,
    w: 1333,
    h: 759,
    markers: [{ label: 'D', srcX: 3613.5, srcY: 1682.5, color: C.orange, srcRadius: 21 }],
  },
};

function cropAsset(spec: CropSpec): string {
  const outPath = path.join(TMP_DIR, `${spec.id}.png`);
  // Pad 8px white border so edge anti-aliasing is spotless
  execFileSync('convert', [
    spec.src,
    '-crop',
    `${spec.w}x${spec.h}+${spec.x}+${spec.y}`,
    '+repage',
    '-background',
    'white',
    '-alpha',
    'remove',
    '-alpha',
    'off',
    outPath,
  ]);
  return outPath;
}

/** Top-down Y coordinate -> PDF bottom-up Y */
const py = (yTop: number) => PAGE_H - yTop;

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

/**
 * Draws Nexa Light text with authentic CAD wide letter-spacing (`tracking-cad`)
 * and optional optical medium thickening (clean subtle sub-pixel offset) so Nexa Light
 * stays ultra-crisp and legible on Bauhaus colored bars and dark title blocks.
 */
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

  const baseY = py(yTopBaseline);

  const offsets: Array<[number, number]> =
    weight === 'bold'
      ? [
          [0, 0],
          [0.36, 0],
          [-0.22, 0],
          [0, 0.24],
          [0.22, 0.18],
        ]
      : weight === 'medium'
      ? [
          [0, 0],
          [0.24, 0],
          [0, 0.14],
        ]
      : [[0, 0]];

  let cx = cursorX;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    for (const [dx, dy] of offsets) {
      page.drawText(ch, {
        x: cx + dx,
        y: baseY + dy,
        size,
        font,
        color,
      });
    }
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function drawCornerTicks(page: PDFPage, x: number, yTop: number, w: number, h: number, inset = 10, len = 6) {
  const coords: Array<[number, number]> = [
    [x + inset, yTop + inset],
    [x + w - inset, yTop + inset],
    [x + inset, yTop + h - inset],
    [x + w - inset, yTop + h - inset],
  ];
  for (const [cx, cy] of coords) {
    page.drawLine({
      start: { x: cx - len / 2, y: py(cy) },
      end: { x: cx + len / 2, y: py(cy) },
      thickness: 0.65,
      color: C.gray,
    });
    page.drawLine({
      start: { x: cx, y: py(cy - len / 2) },
      end: { x: cx, y: py(cy + len / 2) },
      thickness: 0.65,
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
  label: string,
  fill: ReturnType<typeof rgb>
) {
  // White halo behind circle so old monochrome ring is completely masked
  page.drawCircle({
    x: cx,
    y: py(cyTop),
    size: radius + 2.2,
    color: C.white,
  });
  page.drawCircle({
    x: cx,
    y: py(cyTop),
    size: radius,
    color: fill,
    borderColor: C.black,
    borderWidth: 1.15,
  });
  const fontSize = radius * 1.18;
  drawTrackedText(page, font, label, cx, cyTop + fontSize * 0.34, fontSize, {
    color: C.black,
    tracking: 0,
    align: 'center',
    weight: 'bold',
  });
}

interface ViewportCardOpts {
  x: number;
  yTop: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  headerBg: ReturnType<typeof rgb>;
  headerTextColor?: ReturnType<typeof rgb>;
  subtitleColor?: ReturnType<typeof rgb>;
  titleSize?: number;
  subtitleSize?: number;
  showCornerTicks?: boolean;
  bottomTicksYOffset?: number;
}

function drawViewportCard(page: PDFPage, font: PDFFont, opts: ViewportCardOpts) {
  const headerH = 30;
  const r = 11;

  // Card outer white rounded frame
  drawRoundedRect(page, opts.x, opts.yTop, opts.w, opts.h, r, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 1.1,
  });

  // Top-rounded Casegoods header strip
  drawRoundedRect(page, opts.x, opts.yTop, opts.w, headerH, r, {
    fill: opts.headerBg,
    borderColor: C.black,
    borderWidth: 1.1,
    topRoundedOnly: true,
  });

  const textCol = opts.headerTextColor ?? C.black;
  const titleSize = opts.titleSize ?? 10.4;
  const subSize = opts.subtitleSize ?? 8.6;

  drawTrackedText(page, font, opts.title, opts.x + 14, opts.yTop + 19.5, titleSize, {
    color: textCol,
    tracking: titleSize * 0.125,
    align: 'left',
    weight: 'bold',
  });

  if (opts.subtitle) {
    drawTrackedText(page, font, opts.subtitle, opts.x + opts.w - 14, opts.yTop + 19.2, subSize, {
      color: opts.subtitleColor ?? textCol,
      tracking: subSize * 0.105,
      align: 'right',
      weight: 'bold',
    });
  }

  // Subtle CAD corner ticks inside drawing viewports (disabled on tables)
  if (opts.showCornerTicks !== false) {
    const tickH = opts.h - headerH - (opts.bottomTicksYOffset ?? 0);
    drawCornerTicks(page, opts.x, opts.yTop + headerH, opts.w, tickH, 12, 6);
  }

  return {
    innerX: opts.x + 16,
    innerYTop: opts.yTop + headerH + 14,
    innerW: opts.w - 32,
    innerH: opts.h - headerH - 28,
  };
}

function placeCroppedDiagram(
  page: PDFPage,
  font: PDFFont,
  img: PDFImage,
  spec: CropSpec,
  box: { innerX: number; innerYTop: number; innerW: number; innerH: number },
  opts: {
    padX?: number;
    padY?: number;
    alignY?: 'center' | 'bottom';
    maxScale?: number;
    forcedScale?: number;
  } = {}
) {
  const padX = opts.padX ?? 8;
  const padY = opts.padY ?? 8;
  const availW = box.innerW - padX * 2;
  const availH = box.innerH - padY * 2;

  const fitScale = Math.min(availW / spec.w, availH / spec.h);
  const scale = opts.forcedScale
    ? Math.min(opts.forcedScale, fitScale)
    : opts.maxScale
    ? Math.min(opts.maxScale, fitScale)
    : fitScale;

  const drawW = spec.w * scale;
  const drawH = spec.h * scale;
  const drawX = box.innerX + (box.innerW - drawW) / 2;
  const drawYTop =
    opts.alignY === 'bottom'
      ? box.innerYTop + box.innerH - padY - drawH
      : box.innerYTop + (box.innerH - drawH) / 2;

  page.drawImage(img, {
    x: drawX,
    y: py(drawYTop + drawH),
    width: drawW,
    height: drawH,
  });

  // Replace monochrome section bubbles with Casegoods Bauhaus color-coded markers
  if (spec.markers) {
    for (const m of spec.markers) {
      const localX = (m.srcX - spec.x) * scale;
      const localY = (m.srcY - spec.y) * scale;
      const rPt = Math.max(8.5, Math.min(11.5, (m.srcRadius ?? 21) * scale * 1.18));
      drawSectionBadge(page, font, drawX + localX, drawYTop + localY, rPt, m.label, m.color);
    }
  }

  return { drawX, drawYTop, drawW, drawH, scale };
}

interface SheetChromeOpts {
  sheetCode: string;
  sheetIndexText: string;
  sheetCategory: string;
  bannerBg: ReturnType<typeof rgb>;
  bannerLeft: string;
  bannerRight: string;
  accentColor: ReturnType<typeof rgb>;
}

function drawSheetChrome(
  page: PDFPage,
  font: PDFFont,
  logoFullImg: PDFImage,
  logoIconsImg: PDFImage,
  opts: SheetChromeOpts
) {
  // Pure white sheet background
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.white });

  // Outer Casegoods Rounded CAD Sheet Frame (1.6pt Black, rx=14)
  drawRoundedRect(page, 22, 22, PAGE_W - 44, PAGE_H - 44, 14, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 1.6,
  });

  // --- TOP HEADER ROW (yTop = 38 .. 104, h = 66) ---
  // Left: Casegoods Full Logo (CASEGOODS_LOGO_FINAL6.png)
  const logoDims = logoFullImg.scaleToFit(320, 62);
  page.drawImage(logoFullImg, {
    x: 44,
    y: py(38 + 66) + (66 - logoDims.height) / 2,
    width: logoDims.width,
    height: logoDims.height,
  });

  // Center-Right: Clean Framed Project Metadata Strip (rounded-[9px], 1pt black border)
  const metaX = 766;
  const metaW = 588;
  const metaY = 40;
  const metaH = 62;
  drawRoundedRect(page, metaX, metaY, metaW, metaH, 11, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 1.0,
  });

  // 3 clean columns inside Project Metadata Strip
  const col1X = metaX + 18;
  const col2X = metaX + 228;
  const col3X = metaX + 412;

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

  drawTrackedText(page, font, 'PROJECT', col1X, metaY + 22, 7.6, {
    color: C.grayDark,
    tracking: 1.1,
    weight: 'medium',
  });
  drawTrackedText(page, font, 'RESIDENTIAL KITCHEN', col1X, metaY + 44, 11.2, {
    color: C.black,
    tracking: 1.2,
    weight: 'bold',
  });

  drawTrackedText(page, font, 'SHEET SERIES', col2X, metaY + 22, 7.6, {
    color: C.grayDark,
    tracking: 1.1,
    weight: 'medium',
  });
  drawTrackedText(page, font, opts.sheetCategory, col2X, metaY + 44, 10.6, {
    color: C.black,
    tracking: 1.1,
    weight: 'bold',
  });

  drawTrackedText(page, font, 'DRAWING SCALE', col3X, metaY + 22, 7.6, {
    color: C.grayDark,
    tracking: 1.1,
    weight: 'medium',
  });
  drawTrackedText(page, font, 'SCHEMATIC · NTS', col3X, metaY + 44, 10.6, {
    color: C.black,
    tracking: 1.0,
    weight: 'bold',
  });

  // Far-Right: Solid Black Rounded Sheet Code Block (mirrors Invoice top-right block)
  const codeX = 1368;
  const codeW = 188;
  const codeY = 40;
  const codeH = 62;
  drawRoundedRect(page, codeX, codeY, codeW, codeH, 11, {
    fill: C.black,
    borderColor: C.black,
    borderWidth: 1.0,
  });

  // Bauhaus accent bar + sheet counter stacked cleanly on left, bold Sheet ID on right
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

  // Thin Black Rule Under Header
  page.drawLine({
    start: { x: 44, y: py(116) },
    end: { x: PAGE_W - 44, y: py(116) },
    thickness: 1.0,
    color: C.black,
  });

  // --- FULL-WIDTH BAUHAUS COLOR BANNER BAR (yTop = 126 .. 160, h = 34) ---
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

  // --- BOTTOM ARCHITECTURAL FOOTER STRIP (yTop = 918 .. 978, optical center yTop = 948) ---
  page.drawLine({
    start: { x: 44, y: py(918) },
    end: { x: PAGE_W - 44, y: py(918) },
    thickness: 0.9,
    color: C.black,
  });

  // Center 4-Icon Brand Strip (LOGO_4_IMAGES.png) optically centered between 918 and 978
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

async function buildSheets() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle('casegoods — Residential Kitchen Architectural Drawings (A-101 to A-103)');
  pdfDoc.setAuthor('Josh Heinke — casegoods (Omaha, NE)');
  pdfDoc.setCreator('casegoods Omaha Architectural Drawing Studio');

  const nexaFont = await pdfDoc.embedFont(fs.readFileSync(FONT_NEXA));
  const logoFullImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_FULL));
  const logoIconsImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_ICONS));

  // Crop & embed all 11 lossless diagrams
  const embedded: Record<string, PDFImage> = {};
  for (const [key, spec] of Object.entries(CROPS)) {
    const cropPath = cropAsset(spec);
    embedded[key] = await pdfDoc.embedPng(fs.readFileSync(cropPath));
  }

  // =========================================================================
  // SHEET A-101 — ELEVATIONS & SECTIONS (Bauhaus Orange Primary)
  // =========================================================================
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page1, nexaFont, logoFullImg, logoIconsImg, {
    sheetCode: 'A-101',
    sheetIndexText: 'SHEET 01 / 03',
    sheetCategory: 'ELEVATIONS & SECTIONS',
    bannerBg: C.orange,
    bannerLeft: 'A-101  /  ARCHITECTURAL ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE',
    bannerRight: 'PROPORTIONAL SCHEMATIC  ·  NTS  ·  OMAHA STUDIO',
    accentColor: C.orange,
  });

  // Top Row: Elevation A (West Wall) & Elevation B (North Wall)
  const row1Y = 174;
  const row1H = 384;
  const elevAW = 626;
  const elevBW = PAGE_W - 88 - elevAW - 16; // 870

  const boxElevA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row1Y,
    w: elevAW,
    h: row1H,
    title: '01 / ELEVATION A — WEST WALL',
    subtitle: '5-LITE DOOR · REFRIGERATOR ALCOVE · PANTRY TOWER',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.orange,
    subtitleSize: 8.4,
  });

  const boxElevB = drawViewportCard(page1, nexaFont, {
    x: 44 + elevAW + 16,
    yTop: row1Y,
    w: elevBW,
    h: row1H,
    title: '02 / ELEVATION B — NORTH WALL',
    subtitle: 'STACKED UPPERS · WALNUT HOOD · RANGE · FLOATING SHELVES',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.cyan,
    subtitleSize: 8.4,
  });

  // Compute shared scale for Elevation A and Elevation B so both match 1:1 in height
  const sharedElevScale = Math.min(
    (boxElevA.innerW - 24) / CROPS.elevA.w,
    (boxElevA.innerH - 12) / CROPS.elevA.h,
    (boxElevB.innerW - 24) / CROPS.elevB.w,
    (boxElevB.innerH - 12) / CROPS.elevB.h
  );
  placeCroppedDiagram(page1, nexaFont, embedded.elevA, CROPS.elevA, boxElevA, {
    padX: 12,
    padY: 6,
    forcedScale: sharedElevScale,
  });
  placeCroppedDiagram(page1, nexaFont, embedded.elevB, CROPS.elevB, boxElevB, {
    padX: 12,
    padY: 6,
    forcedScale: sharedElevScale,
  });

  // Bottom Row: 3 Color-Coded Architectural Sections + Specification Key Schedule Card
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
    subtitle: 'PANTRY TOWER',
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
    subtitle: 'WALNUT HOOD & RANGE',
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
    subtitle: 'SHELVES & BUFFET',
    headerBg: C.yellow,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  // Shared scale across all 3 sections so 9'-0" floor-to-ceiling heights match 1:1
  const sharedSecScale = Math.min(
    (boxSecA.innerW - 12) / CROPS.secA.w,
    (boxSecA.innerH - 8) / CROPS.secA.h,
    (boxSecB.innerW - 12) / CROPS.secB.w,
    (boxSecB.innerH - 8) / CROPS.secB.h,
    (boxSecC.innerW - 12) / CROPS.secC.w,
    (boxSecC.innerH - 8) / CROPS.secC.h
  );
  placeCroppedDiagram(page1, nexaFont, embedded.secA, CROPS.secA, boxSecA, {
    padX: 6,
    padY: 4,
    forcedScale: sharedSecScale,
  });
  placeCroppedDiagram(page1, nexaFont, embedded.secB, CROPS.secB, boxSecB, {
    padX: 6,
    padY: 4,
    forcedScale: sharedSecScale,
  });
  placeCroppedDiagram(page1, nexaFont, embedded.secC, CROPS.secC, boxSecC, {
    padX: 6,
    padY: 4,
    forcedScale: sharedSecScale,
  });

  // 06 / SPECIFICATION KEY — Authentic Casegoods Architectural Schedule Table (no corner ticks)
  const specX = 44 + (secW + 16) * 3;
  drawViewportCard(page1, nexaFont, {
    x: specX,
    yTop: row2Y,
    w: specW,
    h: row2H,
    title: '06 / SPECIFICATION KEY',
    subtitle: 'MATERIAL & HARDWARE SCHEDULE',
    headerBg: C.gray,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
    showCornerTicks: false,
  });

  const specs: Array<[string, string]> = [
    ['CABINETRY', 'PAINTED WHITE SHAKER'],
    ['HOOD & SHELVES', 'VERTICAL-GRAIN WALNUT'],
    ['COUNTERTOPS', '1.5" QUARTZ SLAB'],
    ['BACKSPLASH', 'VERTICAL STACKED TILE'],
    ['HARDWARE', 'MATTE BLACK BAR PULLS'],
    ['CEILING DATUM', "9'-0\" (APPROX. SCHEMATIC)"],
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
    drawTrackedText(page1, nexaFont, label, specX + 20, ry + 24, 9.2, {
      color: C.black,
      tracking: 1.2,
      weight: 'bold',
    });
    drawTrackedText(page1, nexaFont, value, specX + 204, ry + 24, 9.6, {
      color: C.black,
      tracking: 0.85,
      weight: 'medium',
    });
  });

  // Bottom notice strip inside Spec Key card
  const noteY = row2Y + row2H - 42;
  drawRoundedRect(page1, specX + 18, noteY, specW - 36, 28, 7, {
    fill: C.yellow,
    borderColor: C.black,
    borderWidth: 0.9,
  });
  drawTrackedText(
    page1,
    nexaFont,
    'VERIFY ALL FIELD DIMENSIONS & ROUGH-INS PRIOR TO FABRICATION',
    specX + specW / 2,
    noteY + 17.8,
    8.2,
    {
      color: C.black,
      tracking: 1.0,
      align: 'center',
      weight: 'bold',
    }
  );

  // =========================================================================
  // SHEET A-102 — PLAN & ISOMETRIC (Fabrication Cyan Primary)
  // =========================================================================
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page2, nexaFont, logoFullImg, logoIconsImg, {
    sheetCode: 'A-102',
    sheetIndexText: 'SHEET 02 / 03',
    sheetCategory: 'PLAN & ISOMETRIC',
    bannerBg: C.cyan,
    bannerLeft: 'A-102  /  FLOOR PLAN, HORIZONTAL SECTION & 30° ORTHOGRAPHIC ISOMETRIC',
    bannerRight: 'TRUE-PROPORTION GEOMETRY  ·  MATCHES ELEVATIONS A & B',
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
    subtitle: 'DASHED: OVERHEAD UPPERS, HOOD & SHELVES',
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

  // Leave room at bottom of Plan card for clean color-coded Section Cut Legend
  const planDrawingBox = {
    innerX: boxPlan.innerX,
    innerYTop: boxPlan.innerYTop,
    innerW: boxPlan.innerW,
    innerH: boxPlan.innerH - 54,
  };
  placeCroppedDiagram(page2, nexaFont, embedded.plan, CROPS.plan, planDrawingBox, {
    padX: 16,
    padY: 16,
  });

  // Clean Section Reference Legend bar at bottom of Floor Plan card (evenly distributed)
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
    { code: 'A', text: 'PANTRY TOWER', color: C.orange, x: 214 },
    { code: 'B', text: 'HOOD & RANGE', color: C.cyan, x: 382 },
    { code: 'C', text: 'SHELVES & BUFFET', color: C.yellow, x: 548 },
  ];
  for (const item of legendItems) {
    drawSectionBadge(page2, nexaFont, item.x, legY + 17, 9.5, item.code, item.color);
    drawTrackedText(page2, nexaFont, item.text, item.x + 16, legY + 20.5, 8.2, {
      color: C.black,
      tracking: 0.9,
      weight: 'bold',
    });
  }

  placeCroppedDiagram(page2, nexaFont, embedded.iso, CROPS.iso, boxIso, {
    padX: 16,
    padY: 14,
  });

  // =========================================================================
  // SHEET A-103 — ISLAND DETAILS (Flex Golden Yellow Primary)
  // =========================================================================
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page3, nexaFont, logoFullImg, logoIconsImg, {
    sheetCode: 'A-103',
    sheetIndexText: 'SHEET 03 / 03',
    sheetCategory: 'ISLAND DETAILS',
    bannerBg: C.yellow,
    bannerLeft: 'A-103  /  ISLAND ELEVATIONS, CROSS SECTION & HORIZONTAL PLAN',
    bannerRight: 'PROPORTIONAL SCHEMATIC  ·  12" L-SHAPED QUARTZ BAR-TOP OVERHANG',
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
    title: '01 / ELEVATION C — ISLAND WORKING SIDE',
    subtitle: '24" DW (L) · 30" SINK BASE (C) · 18" TRASH (R) · 12" OVERHANG',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.yellow,
    subtitleSize: 8.2,
  });

  const boxSecD = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103TopY,
    w: rightColW,
    h: a103RowH,
    title: '03 / SECTION D — ISLAND CROSS SECTION',
    subtitle: 'THRU UNDERMOUNT SINK & 12" OVERHANG',
    headerBg: C.orange,
    headerTextColor: C.black,
    subtitleSize: 8.2,
  });

  const boxElevD = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103BotY,
    w: leftColW,
    h: a103RowH,
    title: '02 / ELEVATION D — ISLAND SEATING SIDE (BACK)',
    subtitle: 'PANELED BACK · CONTINUOUS 12" BACK & RIGHT OVERHANG',
    headerBg: C.gray,
    headerTextColor: C.black,
    subtitleSize: 8.2,
  });

  const boxPlanD = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103BotY,
    w: rightColW,
    h: a103RowH,
    title: '04 / ISLAND PLAN & HORIZONTAL SECTION',
    subtitle: 'DASHED BASE CARCASS UNDER L-SHAPED BAR TOP',
    headerBg: C.cyan,
    headerTextColor: C.black,
    subtitleSize: 8.2,
  });

  // Match architectural scale across Elevation C, Elevation D, and Section D!
  const sharedIslandScale = Math.min(
    (boxElevC.innerW - 24) / CROPS.elevC.w,
    (boxElevC.innerH - 12) / CROPS.elevC.h,
    (boxElevD.innerW - 24) / CROPS.elevD.w,
    (boxElevD.innerH - 12) / CROPS.elevD.h,
    (boxSecD.innerW - 24) / CROPS.secD.w,
    (boxSecD.innerH - 12) / CROPS.secD.h
  );

  placeCroppedDiagram(page3, nexaFont, embedded.elevC, CROPS.elevC, boxElevC, {
    padX: 12,
    padY: 6,
    forcedScale: sharedIslandScale,
  });
  placeCroppedDiagram(page3, nexaFont, embedded.secD, CROPS.secD, boxSecD, {
    padX: 12,
    padY: 6,
    forcedScale: sharedIslandScale,
  });
  placeCroppedDiagram(page3, nexaFont, embedded.elevD, CROPS.elevD, boxElevD, {
    padX: 12,
    padY: 6,
    forcedScale: sharedIslandScale,
  });
  placeCroppedDiagram(page3, nexaFont, embedded.planD, CROPS.planD, boxPlanD, {
    padX: 14,
    padY: 10,
  });

  // Save combined vector PDF
  const pdfBytes = await pdfDoc.save();
  const pdfOutPath = path.join(OUT_DIR, 'casegoods-kitchen-submittal-A101-A103.pdf');
  fs.writeFileSync(pdfOutPath, pdfBytes);

  // Rasterize each PDF page at 216 DPI -> exact 4800 x 3000 px crisp PNGs via Ghostscript
  const pngSpecs = [
    { page: 1, name: 'casegoods-A101-elevations-sections.png' },
    { page: 2, name: 'casegoods-A102-plan-isometric.png' },
    { page: 3, name: 'casegoods-A103-island-details.png' },
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

  // Clean up temporary crops
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  console.log(`Generated PDF: ${pdfOutPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

buildSheets().catch((err) => {
  console.error(err);
  process.exit(1);
});
