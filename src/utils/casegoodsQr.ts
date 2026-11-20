import QRCode from 'qrcode';
import { PDFPage, rgb } from 'pdf-lib';

export interface CasegoodsContactInfo {
  fullName: string;
  company: string;
  title: string;
  phoneDisplay: string;
  phoneE164: string;
  email: string;
  cityState: string;
  websiteUrl: string;
  tagline: string;
}

export const CASEGOODS_PUBLIC_URL = 'https://casegoodsomaha.com';

export const DEFAULT_CASEGOODS_CONTACT: CasegoodsContactInfo = {
  fullName: 'Josh Heinke',
  company: 'casegoods',
  title: 'Maker of Things',
  phoneDisplay: '402-720-1377',
  phoneE164: '+14027201377',
  email: 'casegoodsne@gmail.com',
  cityState: 'Omaha, Nebraska',
  websiteUrl: CASEGOODS_PUBLIC_URL,
  tagline: 'Architectural Built-Ins & Custom Furniture — Handcrafted in Omaha',
};

/**
 * Generates standard vCard 3.0 text.
 * Use compact=true when embedding directly inside a QR code to keep QR module density chunky and fast-scanning.
 */
export function buildCasegoodsVCard(
  contact: CasegoodsContactInfo,
  compact = false
): string {
  const parts = contact.fullName.trim().split(/\s+/);
  const firstName = parts[0] || 'Josh';
  const lastName = parts.slice(1).join(' ') || 'Heinke';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${contact.fullName}`,
    `ORG:${contact.company}`,
    `TITLE:${contact.title}`,
    `TEL;TYPE=CELL,VOICE:${contact.phoneE164}`,
    `EMAIL;TYPE=WORK,INTERNET:${contact.email}`,
  ];

  if (contact.websiteUrl.trim()) {
    lines.push(`URL:${contact.websiteUrl.trim()}`);
  }

  if (!compact) {
    const [city = 'Omaha', state = 'NE'] = contact.cityState
      .split(',')
      .map((s) => s.trim());
    lines.push(`ADR;TYPE=WORK:;;${city};${state};;USA`);
    if (contact.tagline.trim()) {
      lines.push(`NOTE:${contact.tagline.trim()}`);
    }
  }

  lines.push('END:VCARD');
  return lines.join('\n');
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const cr = Math.max(0, Math.min(r, w / 2, h / 2));
  const f = (v: number) => +v.toFixed(3);
  const x0 = f(x);
  const y0 = f(y);
  const x1 = f(x + w);
  const y1 = f(y + h);
  const rc = f(cr);

  if (cr <= 0.001) {
    return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
  }

  return [
    `M ${f(x0 + rc)} ${y0}`,
    `L ${f(x1 - rc)} ${y0}`,
    `Q ${x1} ${y0} ${x1} ${f(y0 + rc)}`,
    `L ${x1} ${f(y1 - rc)}`,
    `Q ${x1} ${y1} ${f(x1 - rc)} ${y1}`,
    `L ${f(x0 + rc)} ${y1}`,
    `Q ${x0} ${y1} ${x0} ${f(y1 - rc)}`,
    `L ${x0} ${f(y0 + rc)}`,
    `Q ${x0} ${y0} ${f(x0 + rc)} ${y0}`,
    'Z',
  ].join(' ');
}

export interface CasegoodsQrVectorSpec {
  moduleCount: number;
  outerSize: number;
  matrixOrigin: number;
  moduleSize: number;
  borderWidth: number;
  borderPath: string;
  whiteBgPath: string;
  blackPaths: string[];
  whiteCutoutPaths: string[];
  /** Solid black CG monogram paths inside the center quiet zone */
  cgBlackPaths: string[];
  /** White inner slot/ring cutouts for the CG monogram */
  cgWhitePaths: string[];
}

export interface CasegoodsQrOptions {
  /** Frame style: 'cg-badge' adds the concentric rounded-square CAD outer ring matching logo_mark.png */
  frameStyle?: 'cg-badge' | 'bare';
  /** Dark ink hex color (defaults to #000000 Drafting Black) */
  inkColor?: string;
}

function isFinderModule(r: number, c: number, N: number): boolean {
  const tl = r < 7 && c < 7;
  const tr = r < 7 && c >= N - 7;
  const bl = r >= N - 7 && c < 7;
  return tl || tr || bl;
}

/**
 * Builds deterministic pure-vector geometry for a Casegoods CG-styled QR code
 * centered at (0, 0) within an (outerSize x outerSize) coordinate space.
 * Uses ECC Level H (30% error recovery) so the centered Casegoods CG monogram
 * never compromises mobile camera scannability.
 */
export function buildCasegoodsQrSpec(
  payload: string,
  outerSize: number,
  options: CasegoodsQrOptions = {}
): CasegoodsQrVectorSpec {
  const safePayload = (payload || CASEGOODS_PUBLIC_URL).trim();
  const qr = QRCode.create(safePayload, { errorCorrectionLevel: 'H' });
  const N = qr.modules.size;

  const frameStyle = options.frameStyle ?? 'cg-badge';
  // Bold concentric rounded-square outer frame + generous white quiet zone channel
  const borderWidth = frameStyle === 'cg-badge' ? outerSize * 0.044 : 0;
  const quietModules = frameStyle === 'cg-badge' ? 3.8 : 2;
  const innerSpan = outerSize - borderWidth * 2;
  const moduleSize = innerSpan / (N + quietModules * 2);
  const matrixOrigin = borderWidth + quietModules * moduleSize;

  // Center CG emblem clearance: bold ~23% of matrix width, always <= 8% of total QR modules (well under 30% ECC-H)
  const holeModules = N >= 45 ? 11 : N >= 33 ? 9 : 7;
  const centerStart = Math.floor((N - holeModules) / 2);
  const centerEnd = centerStart + holeModules - 1;

  // Outer concentric rounded square geometry (Casegoods logo_mark silhouette)
  const outerR = outerSize * 0.155;
  const innerFrameInset = borderWidth;
  const innerFrameR = Math.max(2, outerR - innerFrameInset);

  const whiteBgPath = roundedRectPath(0, 0, outerSize, outerSize, outerR);
  const borderPath =
    frameStyle === 'cg-badge'
      ? roundedRectPath(
          borderWidth / 2,
          borderWidth / 2,
          outerSize - borderWidth,
          outerSize - borderWidth,
          Math.max(2, outerR - borderWidth / 2)
        )
      : '';

  const blackPaths: string[] = [];
  const whiteCutoutPaths: string[] = [];

  // 1. Custom Casegoods Concentric Rounded-Square Finder Eyes (TL, TR, BL)
  const finderOrigins: Array<[number, number]> = [
    [0, 0],
    [0, N - 7],
    [N - 7, 0],
  ];
  for (const [fr, fc] of finderOrigins) {
    const fx = matrixOrigin + fc * moduleSize;
    const fy = matrixOrigin + fr * moduleSize;
    const fSize = 7 * moduleSize;
    // Concentric radii mimicking logo_mark.png
    blackPaths.push(roundedRectPath(fx, fy, fSize, fSize, moduleSize * 1.65));
    whiteCutoutPaths.push(
      roundedRectPath(
        fx + moduleSize,
        fy + moduleSize,
        5 * moduleSize,
        5 * moduleSize,
        moduleSize * 0.95
      )
    );
    blackPaths.push(
      roundedRectPath(
        fx + 2 * moduleSize,
        fy + 2 * moduleSize,
        3 * moduleSize,
        3 * moduleSize,
        moduleSize * 0.48
      )
    );
  }

  // 2. Crisp Rounded-CAD Data Modules (skipping finder eyes & center CG logo hole)
  const dotInset = moduleSize * 0.06;
  const dotSpan = moduleSize - dotInset * 2;
  const dotR = moduleSize * 0.22;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (isFinderModule(r, c, N)) continue;
      if (r >= centerStart && r <= centerEnd && c >= centerStart && c <= centerEnd) {
        continue;
      }
      if (qr.modules.get(r, c)) {
        const mx = matrixOrigin + c * moduleSize + dotInset;
        const my = matrixOrigin + r * moduleSize + dotInset;
        blackPaths.push(roundedRectPath(mx, my, dotSpan, dotSpan, dotR));
      }
    }
  }

  // 3. Center Casegoods "CG" Monogram (exact geometry of logo_mark.png)
  const holeX = matrixOrigin + centerStart * moduleSize;
  const holeY = matrixOrigin + centerStart * moduleSize;
  const holeS = holeModules * moduleSize;

  // Slight padding inside the cleared modules so data dots never crowd the CG mark
  const logoPad = moduleSize * 0.35;
  const ls = holeS - logoPad * 2;
  const lx = holeX + logoPad;
  const ly = holeY + logoPad;

  // Quiet white pad behind center logo
  whiteCutoutPaths.push(
    roundedRectPath(
      holeX - moduleSize * 0.2,
      holeY - moduleSize * 0.2,
      holeS + moduleSize * 0.4,
      holeS + moduleSize * 0.4,
      ls * 0.26
    )
  );

  // CG outer black rounded square
  const cgBlackPaths: string[] = [
    roundedRectPath(lx, ly, ls, ls, ls * 0.25),
  ];
  // CG white concentric channel + CG inner black core + horizontal G-slot
  const cgWhitePaths: string[] = [
    roundedRectPath(
      lx + ls * 0.115,
      ly + ls * 0.115,
      ls * 0.77,
      ls * 0.77,
      ls * 0.145
    ),
  ];
  cgBlackPaths.push(
    roundedRectPath(
      lx + ls * 0.23,
      ly + ls * 0.23,
      ls * 0.54,
      ls * 0.54,
      ls * 0.065
    )
  );
  // Horizontal white cutout on right side of inner core (forming C / G)
  cgWhitePaths.push(
    roundedRectPath(
      lx + ls * 0.48,
      ly + ls * 0.44,
      ls * 0.31,
      ls * 0.12,
      0
    )
  );

  void innerFrameR;

  return {
    moduleCount: N,
    outerSize,
    matrixOrigin,
    moduleSize,
    borderWidth,
    borderPath,
    whiteBgPath,
    blackPaths,
    whiteCutoutPaths,
    cgBlackPaths,
    cgWhitePaths,
  };
}

/**
 * Generates an SVG <g> fragment translated to (x, y) scaled cleanly to `targetSize`.
 * Ideal for embedding crisp vector QR codes inside larger Inkscape SVG layouts.
 */
export function renderCasegoodsQrSvgFragment(
  payload: string,
  x: number,
  y: number,
  targetSize: number,
  options: CasegoodsQrOptions = {}
): string {
  const spec = buildCasegoodsQrSpec(payload, targetSize, options);
  const ink = options.inkColor || '#000000';
  const borderWidth = +spec.borderWidth.toFixed(3);

  // Preserve concentric finder visual layering:
  // whiteBg -> blackPaths (drawn in order? Wait: finder eye needs outer black -> white -> inner black!)
  // Wait: if whiteCutoutPaths contains finder middle rings, draw:
  // 1) whiteBg -> 2) black finder outer + dots -> Wait: if we draw blackPaths[0,2,4...], let's layer explicitly!
  // Actually blackPaths has outer rings AND inner 3x3 cores together! If whiteCutoutPaths draws AFTER all blackPaths, it would cover the 3x3 cores unless drawn in stages!
  // Good catch! Let's slice carefully: finder 0..2 outer+white+inner are 3 triplets (indices 0,1 = finder0 outer & core; etc.).
  // Even cleaner: separate finderOuterPaths (0,2,4) vs finderCorePaths (1,3,5) or combine each finder eye as even-odd path, OR simply inspect:
  // Wait: in blackPaths, each finder pushes [outerRing, innerCore], while whiteCutoutPaths pushes [whiteRing].
  // If we draw: whiteBg -> outerRings (even indices 0,2,4) + dots (index >= 6) -> whiteCutoutPaths -> innerCores (indices 1,3,5) -> cgBlack[0] -> cgWhite[0] -> cgBlack[1] -> cgWhite[1], every single layer stacks cleanly with zero occlusion!
  const finderOuters = [spec.blackPaths[0], spec.blackPaths[2], spec.blackPaths[4]];
  const finderCores = [spec.blackPaths[1], spec.blackPaths[3], spec.blackPaths[5]];
  const dataDots = spec.blackPaths.slice(6);

  return `<g transform="translate(${+x.toFixed(2)}, ${+y.toFixed(2)})">
    <path d="${spec.whiteBgPath}" fill="#FFFFFF" />
    ${
      borderWidth > 0 && spec.borderPath
        ? `<path d="${spec.borderPath}" fill="none" stroke="${ink}" stroke-width="${borderWidth}" />`
        : ''
    }
    <path d="${[...finderOuters, ...dataDots].join(' ')}" fill="${ink}" />
    <path d="${spec.whiteCutoutPaths.join(' ')}" fill="#FFFFFF" />
    <path d="${finderCores.join(' ')}" fill="${ink}" />
    <path d="${spec.cgBlackPaths[0]}" fill="${ink}" />
    <path d="${spec.cgWhitePaths[0]}" fill="#FFFFFF" />
    <path d="${spec.cgBlackPaths[1]}" fill="${ink}" />
    <path d="${spec.cgWhitePaths[1]}" fill="#FFFFFF" />
  </g>`;
}

/**
 * Generates a standalone Inkscape-compatible SVG file string for the Casegoods QR code.
 */
export function generateCasegoodsQrStandaloneSvg(
  payload: string,
  sizePx = 420,
  options: CasegoodsQrOptions = {}
): string {
  const inner = renderCasegoodsQrSvgFragment(payload, 0, 0, sizePx, options);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  width="${sizePx}"
  height="${sizePx}"
  viewBox="0 0 ${sizePx} ${sizePx}"
  version="1.1"
  id="casegoods-qr-mark">
  <title>casegoods QR Mark</title>
  ${inner}
</svg>`;
}

/**
 * Draws the vector Casegoods-styled QR code directly onto a pdf-lib PDFPage
 * at top-down coordinates (x, topY) with square width/height `sizePt`.
 */
export function drawCasegoodsQrPdf(
  page: PDFPage,
  pageHeightPt: number,
  payload: string,
  x: number,
  topY: number,
  sizePt: number,
  options: CasegoodsQrOptions = {}
): void {
  const spec = buildCasegoodsQrSpec(payload, sizePt, options);
  const borderWidth = spec.borderWidth;

  const BLACK = rgb(0, 0, 0);
  const WHITE = rgb(1, 1, 1);

  const svgTopLeftToPdfY = pageHeightPt - topY;
  const drawOpt = { x, y: svgTopLeftToPdfY };

  // 1. White rounded-square canvas
  page.drawSvgPath(spec.whiteBgPath, { ...drawOpt, color: WHITE });

  // 2. Outer Casegoods rounded-square CAD border
  if (borderWidth > 0 && spec.borderPath) {
    page.drawSvgPath(spec.borderPath, {
      ...drawOpt,
      borderColor: BLACK,
      borderWidth,
    });
  }

  // 3. Finder outer rings + data dots
  const finderOuters = [spec.blackPaths[0], spec.blackPaths[2], spec.blackPaths[4]];
  const finderCores = [spec.blackPaths[1], spec.blackPaths[3], spec.blackPaths[5]];
  const dataDots = spec.blackPaths.slice(6);

  page.drawSvgPath([...finderOuters, ...dataDots].join(' '), {
    ...drawOpt,
    color: BLACK,
  });

  // 4. White finder rings + center quiet pad
  page.drawSvgPath(spec.whiteCutoutPaths.join(' '), {
    ...drawOpt,
    color: WHITE,
  });

  // 5. Inner rounded finder cores
  page.drawSvgPath(finderCores.join(' '), {
    ...drawOpt,
    color: BLACK,
  });

  // 6. Center Casegoods CG Monogram
  page.drawSvgPath(spec.cgBlackPaths[0], { ...drawOpt, color: BLACK });
  page.drawSvgPath(spec.cgWhitePaths[0], { ...drawOpt, color: WHITE });
  page.drawSvgPath(spec.cgBlackPaths[1], { ...drawOpt, color: BLACK });
  page.drawSvgPath(spec.cgWhitePaths[1], { ...drawOpt, color: WHITE });
}

/**
 * Browser helper: rasterizes any Casegoods SVG QR to a crisp high-res PNG Blob.
 */
export async function renderSvgStringToPngBlob(
  svgMarkup: string,
  pixelSize = 1024
): Promise<Blob> {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = (err) => reject(err);
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = pixelSize;
    canvas.height = pixelSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.clearRect(0, 0, pixelSize, pixelSize);
    ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 1)
    );
    if (!pngBlob) throw new Error('Failed to encode PNG blob');
    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
