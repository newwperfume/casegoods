import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PDFDocument, rgb, PDFPage, PDFFont, PDFImage, LineCapStyle } from 'pdf-lib';

export const ROOT = process.cwd();
export const LOGO_FULL = path.join(ROOT, 'public/assets/aistudio/CASEGOODS_LOGO_FINAL6.png');
export const LOGO_ICONS = path.join(ROOT, 'public/assets/aistudio/LOGO_4_IMAGES.png');
export const FONT_NEXA = path.join(ROOT, 'public/assets/NexaLight.ttf');
export const OUT_DIR = path.join(ROOT, 'public/downloads/drawings');

// Brand Palette — Casegoods Omaha (identical to Kitchen & Family Room A-101..A-103)
export const C = {
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  inkDark: rgb(0.14, 0.14, 0.14),
  inkMid: rgb(0.36, 0.36, 0.36),
  inkLight: rgb(0.56, 0.56, 0.56),
  inkFaint: rgb(0.74, 0.74, 0.74),
  gray: rgb(203 / 255, 203 / 255, 203 / 255),        // #CBCBCB
  grayMed: rgb(168 / 255, 168 / 255, 168 / 255),     // #A8A8A8
  grayDark: rgb(90 / 255, 90 / 255, 90 / 255),
  walnutTint: rgb(0.945, 0.935, 0.92),               // Subtle architectural shading for walnut
  oakTint: rgb(0.985, 0.98, 0.968),                  // Ultra-light warm paper tint for white oak
  stoneTint: rgb(0.86, 0.86, 0.86),                  // Matte black honed quartz architectural fill
  steelTint: rgb(0.93, 0.94, 0.95),                  // Brushed stainless steel tint
  glassTint: rgb(0.965, 0.98, 0.992),                // Whisper-light glazing tint
  wallFill: rgb(0.91, 0.91, 0.91),                   // Section-cut wall poché
  orange: rgb(239 / 255, 105 / 255, 34 / 255),       // #EF6922
  orangeTint: rgb(252 / 255, 224 / 255, 208 / 255),  // Architectural Bauhaus orange wash
  cyan: rgb(39 / 255, 170 / 255, 224 / 255),         // #27AAE0
  cyanTint: rgb(210 / 255, 238 / 255, 250 / 255),    // Architectural Bauhaus blue wash
  yellow: rgb(253 / 255, 203 / 255, 51 / 255),       // #FDCB33
};

// Page geometry: 1600 x 1000 pt (exact 16:10 -> 4800 x 3000 px @ 216 DPI)
export const PAGE_W = 1600;
export const PAGE_H = 1000;
export const py = (yTop: number) => PAGE_H - yTop;

export function drawRoundedRect(
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

export function measureTrackedText(font: PDFFont, text: string, size: number, tracking: number): number {
  if (!text) return 0;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    width += font.widthOfTextAtSize(text[i], size);
    if (i < text.length - 1) width += tracking;
  }
  return width;
}

export function drawTrackedText(
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

export function drawCadLabel(
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
  lines.forEach((ln, idx) => {
    drawTrackedText(page, font, ln, x, yTop + idx * lh, size, {
      color,
      tracking: size * 0.08,
      align,
      weight,
    });
  });
}

export function drawCornerTicks(
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

export function drawSectionBadge(
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

export interface ViewportCard {
  x: number;
  yTop: number;
  w: number;
  h: number;
  innerX: number;
  innerYTop: number;
  innerW: number;
  innerH: number;
}

export function drawViewportCard(
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

export function drawSheetChrome(
  page: PDFPage,
  font: PDFFont,
  logoFullImg: PDFImage,
  logoIconsImg: PDFImage,
  opts: {
    projectCodeLine: string;
    projectTitleLine: string;
    scaleText?: string;
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

  // Outer CAD frame border
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

  drawTrackedText(page, font, opts.projectCodeLine, col1X, metaY + 22, 7.6, {
    color: C.grayDark,
    tracking: 1.1,
    weight: 'medium',
  });
  drawTrackedText(page, font, opts.projectTitleLine, col1X, metaY + 44, 10.4, {
    color: C.black,
    tracking: 1.05,
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
  drawTrackedText(page, font, opts.scaleText ?? 'SCHEMATIC · NTS', col3X, metaY + 44, 10.4, {
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

export function line(
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

export function rect(
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

export function polygon(
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

export function drawDimArrow(
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
  line(page, x1, y1, x1 + ux * ah + px * aw, y1 + uy * ah + pyv * aw, thickness, color);
  line(page, x1, y1, x1 + ux * ah - px * aw, y1 + uy * ah - pyv * aw, thickness, color);
  line(page, x2, y2, x2 - ux * ah + px * aw, y2 - uy * ah + pyv * aw, thickness, color);
  line(page, x2, y2, x2 - ux * ah - px * aw, y2 - uy * ah - pyv * aw, thickness, color);
}

export function drawSpecKeyCard(
  page: PDFPage,
  font: PDFFont,
  x: number,
  yTop: number,
  w: number,
  h: number,
  specs: Array<[string, string]>,
  verificationNote: string,
  subtitle = 'MATERIAL & JOINERY SCHEDULE'
) {
  drawViewportCard(page, font, {
    x,
    yTop,
    w,
    h,
    title: '06 / SPECIFICATION KEY',
    subtitle,
    headerBg: C.gray,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
    showCornerTicks: false,
  });

  const tableStartY = yTop + 34;
  const rowStep = 40;
  specs.forEach(([label, value], idx) => {
    const ry = tableStartY + idx * rowStep;
    if (idx > 0) {
      page.drawLine({
        start: { x: x + 18, y: py(ry) },
        end: { x: x + w - 18, y: py(ry) },
        thickness: 0.75,
        color: C.gray,
      });
    }
    drawTrackedText(page, font, label, x + 18, ry + 24, 8.5, {
      color: C.black,
      tracking: 0.95,
      weight: 'bold',
    });
    drawTrackedText(page, font, value, x + 176, ry + 24, 8.6, {
      color: C.black,
      tracking: 0.65,
      weight: 'medium',
    });
  });

  const noteY = yTop + h - 42;
  drawRoundedRect(page, x + 18, noteY, w - 36, 28, 7, {
    fill: C.yellow,
    borderColor: C.black,
    borderWidth: 0.9,
  });
  drawTrackedText(page, font, verificationNote, x + w / 2, noteY + 17.8, 7.9, {
    color: C.black,
    tracking: 0.9,
    align: 'center',
    weight: 'bold',
  });
}

export function drawSectionCutLegend(
  page: PDFPage,
  font: PDFFont,
  x: number,
  yTop: number,
  w: number,
  items: Array<{ code: string; text: string; color: ReturnType<typeof rgb>; x: number }>
) {
  drawRoundedRect(page, x, yTop, w, 34, 8, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 0.9,
  });
  drawTrackedText(page, font, 'SECTION CUTS', x + 16, yTop + 20.5, 8.2, {
    color: C.black,
    tracking: 1.15,
    weight: 'bold',
  });
  page.drawLine({
    start: { x: x + 126, y: py(yTop + 7) },
    end: { x: x + 126, y: py(yTop + 27) },
    thickness: 0.75,
    color: C.gray,
  });
  for (const item of items) {
    drawSectionBadge(page, font, item.x, yTop + 17, 9.5, item.code, item.color);
    drawTrackedText(page, font, item.text, item.x + 16, yTop + 20.5, 8.0, {
      color: C.black,
      tracking: 0.85,
      weight: 'bold',
    });
  }
}

export function rasterizeSubmittalPdf(
  pdfOutPath: string,
  pngSpecs: Array<{ page: number; name: string }>
) {
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
}
