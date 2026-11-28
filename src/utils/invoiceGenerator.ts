import { PDFDocument, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  drawCasegoodsQrPdf,
  renderCasegoodsQrSvgFragment,
} from './casegoodsQr.ts';

export interface BudgetPillar {
  key: 'design' | 'resources' | 'fabrication' | 'flex';
  label: string;
  colorHex: string;
  amount: number;
  description: string;
}

export interface InvoiceTemplateData {
  recipientName: string;
  invoiceNumber: string;
  projectTitle: string;
  projectSummary: string;
  pillars: {
    design: { amount: number; description: string };
    resources: { amount: number; description: string };
    fabrication: { amount: number; description: string };
    flex: { amount: number; description: string };
  };
  depositAmount: number;
  depositMethodNote: string;
  depositStatus: string;
  pageLabel: string;
  driveFolderUrl?: string;
  driveFolderName?: string;
}

export const DEFAULT_INVOICE_DATA: InvoiceTemplateData = {
  recipientName: 'JOSEPH MCGILL',
  invoiceNumber: '1070MCG(B)',
  projectTitle: 'KIDS KITCHEN',
  projectSummary:
    'THIS PROJECT CONSISTS OF DESIGNING, ENGINEERING, AND FABRICATING A CUSTOM HEIRLOOM-QUALITY CHILDREN’S PLAY KITCHENETTE. THE PIECE WILL BE CONSTRUCTED PRIMARILY FROM SOLID AMERICAN BLACK WALNUT AND PREMIUM WALNUT PLYWOOD, BRINGING FINE-FURNITURE AESTHETICS, TRADITIONAL JOINERY, AND FUNCTIONAL PLAY ELEMENTS INTO A SINGLE INTEGRATED UNIT.',
  pillars: {
    design: {
      amount: 175,
      description:
        "COVERS THE TIME NEEDED TO TRANSLATE THE CLIENT'S CONCEPT SKETCH INTO PRECISE 3D CAD MODELS IN RHINO, CREATE DETAILED SHOP DRAWINGS, LAY OUT THE LATHE TURNING PROFILES FOR THE STACKED-BALL LEGS, AND MAKE PHYSICAL ROUTER TEMPLATES FOR CUSTOM CONSTRUCTION.",
    },
    resources: {
      amount: 900,
      description:
        'COVERS ALL HIGH-END PHYSICAL INPUTS, INCLUDING 8/4 AND 4/4 SELECT SOLID AMERICAN BLACK WALNUT STOCK, 3/4" WALNUT PLYWOOD, SOFT-CLOSE HINGES, AND RUBIO MONOCOAT FINISH.',
    },
    fabrication: {
      amount: 1175,
      description:
        'CAPTURES THE CORE SHOP LABOR REQUIRED TO SELECT/MILL LUMBER, FACE-GLUE THICK BLANKS AND TURN MATCHING STACKED-BALL LEGS ON THE LATHE, ASSEMBLE THE CABINET BOX WITH INSET JOINERY, PERFORM DETAILED HAND SANDING, APPLY/BUFF THE HARDWAX OIL FINISH, AND HANDLE LOCAL DELIVERY / BLANKET-WRAPPED TRANSPORT.',
    },
    flex: {
      amount: 250,
      description: 'COVERS UNEXPECTED EXPENSES AND GUARANTEES THE PRICE WILL NOT CHANGE.',
    },
  },
  depositAmount: 1125,
  depositMethodNote: 'CHECK',
  depositStatus: 'PAID',
  pageLabel: '1',
  driveFolderUrl: '',
  driveFolderName: '',
};

export interface ComputedInvoiceSummary {
  totalAmount: number;
  depositAmount: number;
  finalPayment: number;
  slices: Array<{
    key: 'design' | 'resources' | 'fabrication' | 'flex';
    label: string;
    colorHex: string;
    amount: number;
    percent: number;
    startDeg: number;
    endDeg: number;
    midDeg: number;
    description: string;
  }>;
}

export function computeInvoiceSummary(data: InvoiceTemplateData): ComputedInvoiceSummary {
  const raw = [
    {
      key: 'design' as const,
      label: 'DESIGN / ENGINEERING',
      colorHex: '#CBCBCB',
      amount: Math.max(0, Number(data.pillars.design.amount) || 0),
      description: data.pillars.design.description || '',
    },
    {
      key: 'resources' as const,
      label: 'RESOURCES / MATERIALS',
      colorHex: '#EF6922',
      amount: Math.max(0, Number(data.pillars.resources.amount) || 0),
      description: data.pillars.resources.description || '',
    },
    {
      key: 'fabrication' as const,
      label: 'FABRICATION / DELIVERY',
      colorHex: '#27AAE0',
      amount: Math.max(0, Number(data.pillars.fabrication.amount) || 0),
      description: data.pillars.fabrication.description || '',
    },
    {
      key: 'flex' as const,
      label: 'FLEX',
      colorHex: '#FDCB33',
      amount: Math.max(0, Number(data.pillars.flex.amount) || 0),
      description: data.pillars.flex.description || '',
    },
  ];

  const totalAmount = raw.reduce((s, p) => s + p.amount, 0);
  const safeTotal = totalAmount > 0 ? totalAmount : 100;
  const fallbackAmounts = [7, 36, 47, 10];

  const exactPcts = raw.map((item, idx) =>
    totalAmount > 0 ? (item.amount / safeTotal) * 100 : fallbackAmounts[idx]
  );
  const floored = exactPcts.map((v) => Math.floor(v));
  let remainder = 100 - floored.reduce((a, b) => a + b, 0);
  const order = exactPcts
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && remainder > 0; k++) {
    floored[order[k].i] += 1;
    remainder -= 1;
  }

  let cursorDeg = -90; // 12 o'clock top
  const slices = raw.map((item, idx) => {
    const fraction =
      totalAmount > 0 ? item.amount / totalAmount : fallbackAmounts[idx] / 100;
    const sweepDeg = fraction * 360;
    const startDeg = cursorDeg;
    const endDeg = cursorDeg + sweepDeg;
    const midDeg = startDeg + sweepDeg / 2;
    cursorDeg = endDeg;
    return {
      ...item,
      percent: floored[idx],
      startDeg,
      endDeg,
      midDeg,
    };
  });

  const depositAmount = Math.max(0, Number(data.depositAmount) || 0);
  const finalPayment = Math.max(0, totalAmount - depositAmount);

  return {
    totalAmount,
    depositAmount,
    finalPayment,
    slices,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function wrapTextLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxCharsPerLine) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function wrapPdfLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidthPt: number,
  maxLines: number
): string[] {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidthPt) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

export function roundedRectPathPt(
  x: number,
  y: number,
  w: number,
  h: number,
  rTopLeft: number,
  rTopRight: number,
  rBottomRight: number,
  rBottomLeft: number,
  scale = 1
): string {
  const s = (v: number) => +(v * scale).toFixed(2);
  const rtl = s(rTopLeft);
  const rtr = s(rTopRight);
  const rbr = s(rBottomRight);
  const rbl = s(rBottomLeft);
  const x0 = s(x);
  const y0 = s(y);
  const x1 = s(x + w);
  const y1 = s(y + h);

  return [
    `M ${x0 + rtl} ${y0}`,
    `L ${x1 - rtr} ${y0}`,
    rtr > 0 ? `Q ${x1} ${y0} ${x1} ${y0 + rtr}` : `L ${x1} ${y0}`,
    `L ${x1} ${y1 - rbr}`,
    rbr > 0 ? `Q ${x1} ${y1} ${x1 - rbr} ${y1}` : `L ${x1} ${y1}`,
    `L ${x0 + rbl} ${y1}`,
    rbl > 0 ? `Q ${x0} ${y1} ${x0} ${y1 - rbl}` : `L ${x0} ${y1}`,
    `L ${x0} ${y0 + rtl}`,
    rtl > 0 ? `Q ${x0} ${y0} ${x0 + rtl} ${y0}` : `L ${x0} ${y0}`,
    'Z',
  ].join(' ');
}

export function pieSliceBezierPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  scale = 1
): string {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.05) return '';

  const s = (v: number) => +(v * scale).toFixed(2);
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  if (sweep >= 359.9) {
    const r = s(radius);
    const sx = s(cx);
    const sy = s(cy);
    return [
      `M ${sx} ${sy - r}`,
      `C ${sx + r * 0.5523} ${sy - r} ${sx + r} ${sy - r * 0.5523} ${sx + r} ${sy}`,
      `C ${sx + r} ${sy + r * 0.5523} ${sx + r * 0.5523} ${sy + r} ${sx} ${sy + r}`,
      `C ${sx - r * 0.5523} ${sy + r} ${sx - r} ${sy + r * 0.5523} ${sx - r} ${sy}`,
      `C ${sx - r} ${sy - r * 0.5523} ${sx - r * 0.5523} ${sy - r} ${sx} ${sy - r}`,
      'Z',
    ].join(' ');
  }

  const segments = Math.max(1, Math.ceil(sweep / 45));
  const segAngle = sweep / segments;
  const startRad = toRad(startDeg);

  const parts: string[] = [
    `M ${s(cx)} ${s(cy)}`,
    `L ${s(cx + radius * Math.cos(startRad))} ${s(cy + radius * Math.sin(startRad))}`,
  ];

  for (let i = 0; i < segments; i++) {
    const a1 = toRad(startDeg + i * segAngle);
    const a2 = toRad(startDeg + (i + 1) * segAngle);
    const alpha = (4 / 3) * Math.tan((a2 - a1) / 4);

    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);

    const cp1x = x1 - alpha * radius * Math.sin(a1);
    const cp1y = y1 + alpha * radius * Math.cos(a1);
    const cp2x = x2 + alpha * radius * Math.sin(a2);
    const cp2y = y2 - alpha * radius * Math.cos(a2);

    parts.push(
      `C ${s(cp1x)} ${s(cp1y)} ${s(cp2x)} ${s(cp2y)} ${s(x2)} ${s(y2)}`
    );
  }

  parts.push('Z');
  return parts.join(' ');
}

export interface CalloutGeometry {
  key: 'design' | 'resources' | 'fabrication' | 'flex';
  label: string;
  percentText: string;
  leaderPath: (scale: number) => string;
  centerTextX: number;
  labelY: number;
  pctY: number;
}

/**
 * Computes non-overlapping architectural leader lines with a smooth 90-degree
 * corner radius (6.75pt / 9px CAD radius) and centered title + percentage labels.
 */
export function buildPieCallouts(
  cx: number,
  cy: number,
  radius: number,
  slices: ComputedInvoiceSummary['slices'],
  compactFlanks = false
): CalloutGeometry[] {
  const anchorR = radius + 6;
  const armOffset = compactFlanks ? 26 : 44;
  const labelHalfW = compactFlanks ? 54 : 68;

  return slices
    .filter((s) => s.endDeg - s.startDeg > 0.5)
    .map((slice) => {
      const isRight = slice.key === 'design' || slice.key === 'resources';
      const isTop = slice.key === 'design' || slice.key === 'flex';

      let exitDeg = slice.midDeg;
      if (isTop) {
        if (isRight) {
          exitDeg = Math.min(slice.midDeg, Math.max(slice.startDeg + 3, -18));
        } else {
          exitDeg = Math.max(slice.midDeg, Math.min(slice.endDeg - 3, 198));
        }
      } else {
        if (isRight) {
          exitDeg = Math.max(slice.midDeg, Math.min(slice.endDeg - 4, 34));
        } else {
          exitDeg = Math.min(slice.midDeg, Math.max(slice.startDeg + 4, 146));
        }
      }

      const exitRad = (exitDeg * Math.PI) / 180;
      const anchorX = cx + anchorR * Math.cos(exitRad);
      const anchorY = cy + anchorR * Math.sin(exitRad);

      // Keep elbows comfortably inside the unified Budget Distribution card body (y=183..366)
      const elbowY = isTop
        ? Math.min(anchorY - 10, cy - radius - 11)
        : Math.max(anchorY + 11, cy + radius + 9);

      const endX = isRight ? cx + radius + armOffset : cx - radius - armOffset;
      const centerTextX = isRight ? endX + labelHalfW : endX - labelHalfW;

      const crossesOppositeSide = (anchorY - cy) * (elbowY - cy) < 0;
      const insideHorizontalSpan = Math.abs(anchorX - cx) < radius + 5;

      const buildRoundedElbowPath = (scale: number) => {
        const s = (v: number) => +(v * scale).toFixed(2);
        const dirY = elbowY > anchorY ? 1 : -1;
        const dirX = endX > anchorX ? 1 : -1;

        if (crossesOppositeSide && insideHorizontalSpan) {
          const safeX = cx + (isRight ? radius + 11 : -(radius + 11));
          const cr1 = Math.min(
            6.75,
            Math.abs(safeX - anchorX) * 0.45,
            Math.abs(elbowY - anchorY) * 0.35
          );
          const cr2 = Math.min(
            6.75,
            Math.abs(endX - safeX) * 0.45,
            Math.abs(elbowY - anchorY) * 0.35
          );
          return [
            `M ${s(anchorX)} ${s(anchorY)}`,
            `L ${s(safeX - dirX * cr1)} ${s(anchorY)}`,
            `Q ${s(safeX)} ${s(anchorY)} ${s(safeX)} ${s(anchorY + dirY * cr1)}`,
            `L ${s(safeX)} ${s(elbowY - dirY * cr2)}`,
            `Q ${s(safeX)} ${s(elbowY)} ${s(safeX + dirX * cr2)} ${s(elbowY)}`,
            `L ${s(endX)} ${s(elbowY)}`,
          ].join(' ');
        }

        const cr = Math.min(
          6.75,
          Math.abs(elbowY - anchorY) * 0.48,
          Math.abs(endX - anchorX) * 0.48
        );

        if (cr < 1) {
          return `M ${s(anchorX)} ${s(anchorY)} L ${s(anchorX)} ${s(elbowY)} L ${s(endX)} ${s(elbowY)}`;
        }

        return [
          `M ${s(anchorX)} ${s(anchorY)}`,
          `L ${s(anchorX)} ${s(elbowY - dirY * cr)}`,
          `Q ${s(anchorX)} ${s(elbowY)} ${s(anchorX + dirX * cr)} ${s(elbowY)}`,
          `L ${s(endX)} ${s(elbowY)}`,
        ].join(' ');
      };

      return {
        key: slice.key,
        label: slice.label,
        percentText: `${slice.percent}%`,
        leaderPath: buildRoundedElbowPath,
        centerTextX,
        labelY: elbowY - 3,
        pctY: elbowY + 8.5,
      };
    });
}

export interface InvoiceAssets {
  logoMainPng: Uint8Array;
  logoIconsPng: Uint8Array;
  nexaLightTtf: Uint8Array;
}

/**
 * Shared architectural geometry & layout spec (in US Letter points: 612pt x 792pt)
 * matching the updated Casegoods website header and unified outline-integrated card system.
 * Used identically by SVG export, PDF export, and the live React preview.
 */
export const INVOICE_LAYOUT = {
  pageW: 612,
  pageH: 792,
  svgScale: 96 / 72, // 1.333333 px per pt -> 816 x 1056
  rCad: 6.75, // 9px CAD corner radius
  marginX: 34,
  contentW: 544, // 34..578
  centerX: 306,

  // Top 3-Zone Architectural Header
  headerTopY: 22,
  headerBoxW: 162,
  headerBoxH: 46,
  headerBarH: 18,
  headerRuleY: 78,
  mainLogoH: 42,
  mainLogoAspect: 7841 / 1847,

  // Unified Section 01: Project Overview Card
  scopeY: 88,
  scopeBarH: 19,
  scopeBodyH: 47, // total 66 -> bottom 154

  // Unified Section 02: Budget Distribution Card
  budgetY: 164,
  budgetBarH: 19,
  budgetBodyH: 183, // total 202 -> bottom 366
  pieCx: 306,
  pieCy: 274,
  pieR: 61,

  // Unified Sections 03-06: Four Color-Coded Pillar Cards
  pillars: [
    { index: 0, topY: 376, barH: 19, bodyH: 46, maxLines: 3 }, // 376..441
    { index: 1, topY: 450, barH: 19, bodyH: 38, maxLines: 2 }, // 450..507
    { index: 2, topY: 516, barH: 19, bodyH: 52, maxLines: 3 }, // 516..587
    { index: 3, topY: 596, barH: 19, bodyH: 30, maxLines: 2 }, // 596..645
  ] as const,

  // Bottom Footer Divider & 3-Zone Integrated Payment Cards
  footerRuleY: 656,
  footerY: 666,
  footerCardW: 178,
  footerBarH: 19,
  footerMidH: 27,
  footerBotH: 28, // total 74 -> bottom 740
  iconsH: 26,
  iconsAspect: 2422 / 472,
  pageBadgeW: 128,
  pageBadgeH: 26,
  pageBadgeY: 714,
  contactLineY: 766,

  // Calibrated hairline CAD stroke weights (in PDF points; 0.75pt = 1px @ 96dpi)
  // Matches the 0.75px–1px crisp borders used across the rest of the Casegoods app
  strokes: {
    card: 0.65,
    divider: 0.6,
    headerRule: 0.75,
    footerRule: 0.55,
    leader: 0.55,
    pieGap: 1.5,
  },
} as const;

export function buildInvoiceViewModel(data: InvoiceTemplateData) {
  const summary = computeInvoiceSummary(data);
  const L = INVOICE_LAYOUT;

  const hasDriveQr = Boolean(data.driveFolderUrl?.trim());
  const driveUrl = (data.driveFolderUrl || '').trim();
  const folderTag = (data.driveFolderName || '').trim().toUpperCase();
  const clippedFolder =
    folderTag.length > 20 ? `${folderTag.slice(0, 19)}…` : folderTag;

  const pieR = hasDriveQr ? 54 : L.pieR;
  const callouts = buildPieCallouts(L.pieCx, L.pieCy, pieR, summary.slices, hasDriveQr);

  const scopeLines = wrapTextLines(data.projectSummary, 92, 3);
  const pillarCards = L.pillars.map((row) => {
    const slice = summary.slices[row.index];
    const descLines = wrapTextLines(slice.description, 92, row.maxLines);
    return {
      ...row,
      totalH: row.barH + row.bodyH,
      slice,
      descLines,
      rightMeta: `${slice.percent}%  ·  ${formatCurrency(slice.amount)}`,
    };
  });

  const depositMethodUpper = data.depositMethodNote.trim()
    ? ` (${data.depositMethodNote.trim().toUpperCase()})`
    : '';
  const equationLine = `${formatCurrency(summary.totalAmount)} - ${formatCurrency(
    summary.depositAmount
  )}${depositMethodUpper}`;
  const resultLine = `= ${formatCurrency(summary.finalPayment)}`;

  const rawPage = (data.pageLabel || '1').trim().toUpperCase();
  const pageBadgeText = rawPage.startsWith('PAGE') ? rawPage : `PAGE ${rawPage}`;

  return {
    summary,
    hasDriveQr,
    driveUrl,
    clippedFolder,
    pieR,
    callouts,
    scopeLines,
    pillarCards,
    equationLine,
    resultLine,
    pageBadgeText,
    contactFooterText:
      'CASEGOODS  ·  JOSH HEINKE  ·  402-830-8782  ·  JOSH@CASEGOODSOMAHA.COM  ·  OMAHA, NE',
  };
}

/**
 * Generates an Inkscape-native layered SVG (US Letter 8.5in x 11in, 816 x 1056 viewBox)
 * matching the updated Casegoods architectural header and unified outline integration,
 * with embedded OpenType Nexa Light font.
 */
export function generateInvoiceSvg(
  data: InvoiceTemplateData,
  assets: InvoiceAssets
): string {
  const vm = buildInvoiceViewModel(data);
  const L = INVOICE_LAYOUT;
  const S = L.svgScale;
  const p = (pt: number) => +(pt * S).toFixed(2);
  const fontStack = `'Nexa Light', 'Montserrat', 'Questrial', sans-serif`;

  const logoMainB64 = `data:image/png;base64,${uint8ToBase64(assets.logoMainPng)}`;
  const logoIconsB64 = `data:image/png;base64,${uint8ToBase64(assets.logoIconsPng)}`;
  // public/assets/NexaLight.ttf is OpenType (OTTO) font data — declare font/otf + format('opentype')
  const nexaFontB64 = `data:font/otf;base64,${uint8ToBase64(assets.nexaLightTtf)}`;

  const mainLogoW = +(L.mainLogoH * L.mainLogoAspect).toFixed(2);
  const mainLogoX = +(L.centerX - mainLogoW / 2).toFixed(2);
  const iconsW = +(L.iconsH * L.iconsAspect).toFixed(2);
  const iconsX = +(L.centerX - iconsW / 2).toFixed(2);

  const rightHeaderX = L.marginX + L.contentW - L.headerBoxW;
  const rightFooterX = L.marginX + L.contentW - L.footerCardW;
  const footerTotalH = L.footerBarH + L.footerMidH + L.footerBotH;
  const scopeTotalH = L.scopeBarH + L.scopeBodyH;
  const budgetTotalH = L.budgetBarH + L.budgetBodyH;

  const strokes = L.strokes;

  const slicesSvg = vm.summary.slices
    .filter((s) => s.endDeg - s.startDeg > 0.2)
    .map(
      (s) =>
        `<path id="pie-slice-${s.key}" d="${pieSliceBezierPath(
          L.pieCx,
          L.pieCy,
          vm.pieR,
          s.startDeg,
          s.endDeg,
          S
        )}" fill="${s.colorHex}" stroke="#FFFFFF" stroke-width="${p(strokes.pieGap)}" stroke-linejoin="round" />`
    )
    .join('\n    ');

  const calloutsSvg = vm.callouts
    .map(
      (c) => `
    <g>
      <path d="${c.leaderPath(S)}" fill="none" stroke="#000000" stroke-width="${p(strokes.leader)}" stroke-linecap="round" />
      <text x="${p(c.centerTextX)}" y="${p(c.labelY)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.2)}" font-weight="400" letter-spacing="0.9" fill="#000000">${escapeXml(
        c.label
      )}</text>
      <text x="${p(c.centerTextX)}" y="${p(c.pctY)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.8)}" font-weight="400" letter-spacing="0.7" fill="#000000">${escapeXml(
        c.percentText
      )}</text>
    </g>`
    )
    .join('\n');

  const pillarsSvg = vm.pillarCards
    .map((card) => {
      const bodyTopY = card.topY + card.barH;
      const lineStartY =
        bodyTopY +
        (card.descLines.length === 1
          ? card.bodyH / 2 + 2.6
          : card.descLines.length === 2
          ? card.bodyH / 2 - 3.2
          : 14);
      const linesMarkup = card.descLines
        .map(
          (line, idx) =>
            `<text x="${p(L.marginX + 12)}" y="${p(
              lineStartY + idx * 11.4
            )}" font-family="${fontStack}" font-size="${p(7.4)}" font-weight="300" letter-spacing="0.35" fill="#000000">${escapeXml(
              line
            )}</text>`
        )
        .join('\n      ');

      return `
    <g id="pillar-section-${card.slice.key}">
      <rect x="${p(L.marginX)}" y="${p(card.topY)}" width="${p(L.contentW)}" height="${p(
        card.totalH
      )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
      <path d="${roundedRectPathPt(
        L.marginX,
        card.topY,
        L.contentW,
        card.barH,
        L.rCad,
        L.rCad,
        0,
        0,
        S
      )}" fill="${card.slice.colorHex}" stroke="none" />
      <line x1="${p(L.marginX)}" y1="${p(bodyTopY)}" x2="${p(
        L.marginX + L.contentW
      )}" y2="${p(bodyTopY)}" stroke="#000000" stroke-width="${p(strokes.divider)}" />
      <text x="${p(L.marginX + 12)}" y="${p(
        card.topY + 12.6
      )}" font-family="${fontStack}" font-size="${p(7.5)}" font-weight="400" letter-spacing="1.2" fill="#000000">${escapeXml(
        card.slice.label
      )}</text>
      <text x="${p(L.marginX + L.contentW - 12)}" y="${p(
        card.topY + 12.6
      )}" text-anchor="end" font-family="${fontStack}" font-size="${p(7.5)}" font-weight="400" letter-spacing="1.0" fill="#000000">${escapeXml(
        card.rightMeta
      )}</text>
      ${linesMarkup}
      <rect x="${p(L.marginX)}" y="${p(card.topY)}" width="${p(L.contentW)}" height="${p(
        card.totalH
      )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
        strokes.card
      )}" />
    </g>`;
    })
    .join('\n');

  const driveFlanksSvg = vm.hasDriveQr
    ? (() => {
        const qrSize = 56;
        const qrCenterX = 528;
        const qrX = qrCenterX - qrSize / 2;
        const qrY = 236;

        const totalBoxW = 92;
        const totalBoxH = 38;
        const totalBarH = 15;
        const totalX = 46;
        const totalY = 252;
        const totalCenterX = totalX + totalBoxW / 2;

        return `
    <!-- Symmetrical Left Flank: Unified Project Total Card -->
    <g id="budget-total-badge">
      <rect x="${p(totalX)}" y="${p(totalY)}" width="${p(totalBoxW)}" height="${p(
          totalBoxH
        )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
      <path d="${roundedRectPathPt(
        totalX,
        totalY,
        totalBoxW,
        totalBarH,
        L.rCad,
        L.rCad,
        0,
        0,
        S
      )}" fill="#CBCBCB" stroke="none" />
      <line x1="${p(totalX)}" y1="${p(totalY + totalBarH)}" x2="${p(
          totalX + totalBoxW
        )}" y2="${p(totalY + totalBarH)}" stroke="#000000" stroke-width="${p(strokes.divider)}" />
      <text x="${p(totalCenterX)}" y="${p(
          totalY + 10.2
        )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(6.0)}" font-weight="400" letter-spacing="1.0" fill="#000000">PROJECT TOTAL</text>
      <text x="${p(totalCenterX)}" y="${p(
          totalY + 29.5
        )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.2)}" font-weight="400" letter-spacing="0.5" fill="#000000">${escapeXml(
          formatCurrency(vm.summary.totalAmount)
        )}</text>
      <rect x="${p(totalX)}" y="${p(totalY)}" width="${p(totalBoxW)}" height="${p(
          totalBoxH
        )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
          strokes.card
        )}" />
    </g>
    <!-- Symmetrical Right Flank: Google Drive Project Folder QR Code -->
    <g id="project-drive-qr">
      ${renderCasegoodsQrSvgFragment(vm.driveUrl, p(qrX), p(qrY), p(qrSize), {
        frameStyle: 'cg-badge',
      })}
      <text x="${p(qrCenterX)}" y="${p(303)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(5.8)}" font-weight="400" letter-spacing="0.9" fill="#000000">PROJECT DRIVE FILES</text>
      ${
        vm.clippedFolder
          ? `<text x="${p(qrCenterX)}" y="${p(312)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(5.3)}" font-weight="300" letter-spacing="0.5" fill="#000000">${escapeXml(
              vm.clippedFolder
            )}</text>`
          : ''
      }
    </g>`;
      })()
    : '';

  const scopeStartY =
    L.scopeY +
    L.scopeBarH +
    (vm.scopeLines.length === 1 ? 26 : vm.scopeLines.length === 2 ? 20 : 14.5);

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  width="8.5in"
  height="11in"
  viewBox="0 0 ${p(L.pageW)} ${p(L.pageH)}"
  version="1.1"
  id="casegoods-invoice-template">
  <title>casegoods — Invoice ${escapeXml(data.invoiceNumber)}</title>
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Nexa Light';
        src: url('${nexaFontB64}') format('opentype');
        font-weight: 100 900;
        font-style: normal;
      }
    ]]></style>
  </defs>
  <sodipodi:namedview
    id="namedview1"
    pagecolor="#ffffff"
    bordercolor="#000000"
    borderopacity="0.25"
    inkscape:showpageshadow="2"
    inkscape:pageopacity="1"
    inkscape:pagecheckerboard="0"
    inkscape:deskcolor="#f4f4f4"
    inkscape:document-units="in"
    showgrid="false" />

  <!-- LAYER 1: PAGE BACKGROUND -->
  <g inkscape:groupmode="layer" id="layer-background" inkscape:label="01 - Page Background">
    <rect x="0" y="0" width="${p(L.pageW)}" height="${p(L.pageH)}" fill="#FFFFFF" />
  </g>

  <!-- LAYER 2: UPDATED 3-ZONE ARCHITECTURAL HEADER & UNIFIED PROJECT SCOPE -->
  <g inkscape:groupmode="layer" id="layer-header-project" inkscape:label="02 - Header &amp; Project Overview">
    <!-- Left Unified Recipient Card -->
    <rect x="${p(L.marginX)}" y="${p(L.headerTopY)}" width="${p(L.headerBoxW)}" height="${p(
    L.headerBoxH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
    <path d="${roundedRectPathPt(
      L.marginX,
      L.headerTopY,
      L.headerBoxW,
      L.headerBarH,
      L.rCad,
      L.rCad,
      0,
      0,
      S
    )}" fill="#000000" stroke="none" />
    <text x="${p(L.marginX + L.headerBoxW / 2)}" y="${p(
    L.headerTopY + 12
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.2)}" font-weight="400" letter-spacing="1.4" fill="#FFFFFF">RECIPIENT</text>
    <text x="${p(L.marginX + L.headerBoxW / 2)}" y="${p(
    L.headerTopY + L.headerBarH + 17.2
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.5)}" font-weight="400" letter-spacing="0.9" fill="#000000">${escapeXml(
    data.recipientName
  )}</text>
    <rect x="${p(L.marginX)}" y="${p(L.headerTopY)}" width="${p(L.headerBoxW)}" height="${p(
    L.headerBoxH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
    strokes.card
  )}" />

    <!-- Center Brand Lockup -->
    <image
      id="casegoods-main-logo"
      x="${p(mainLogoX)}"
      y="${p(L.headerTopY + 2)}"
      width="${p(mainLogoW)}"
      height="${p(L.mainLogoH)}"
      preserveAspectRatio="xMidYMid meet"
      xlink:href="${logoMainB64}" />

    <!-- Right Unified Invoice Card -->
    <rect x="${p(rightHeaderX)}" y="${p(L.headerTopY)}" width="${p(L.headerBoxW)}" height="${p(
    L.headerBoxH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
    <path d="${roundedRectPathPt(
      rightHeaderX,
      L.headerTopY,
      L.headerBoxW,
      L.headerBarH,
      L.rCad,
      L.rCad,
      0,
      0,
      S
    )}" fill="#000000" stroke="none" />
    <text x="${p(rightHeaderX + L.headerBoxW / 2)}" y="${p(
    L.headerTopY + 12
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.2)}" font-weight="400" letter-spacing="1.4" fill="#FFFFFF">INVOICE</text>
    <text x="${p(rightHeaderX + L.headerBoxW / 2)}" y="${p(
    L.headerTopY + L.headerBarH + 17.2
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.5)}" font-weight="400" letter-spacing="0.9" fill="#000000">${escapeXml(
    data.invoiceNumber
  )}</text>
    <rect x="${p(rightHeaderX)}" y="${p(L.headerTopY)}" width="${p(L.headerBoxW)}" height="${p(
    L.headerBoxH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
    strokes.card
  )}" />

    <!-- Architectural Header Bottom Rule -->
    <line x1="${p(L.marginX)}" y1="${p(L.headerRuleY)}" x2="${p(
    L.marginX + L.contentW
  )}" y2="${p(L.headerRuleY)}" stroke="#000000" stroke-width="${p(strokes.headerRule)}" />

    <!-- Unified Project Overview Card -->
    <rect x="${p(L.marginX)}" y="${p(L.scopeY)}" width="${p(L.contentW)}" height="${p(
    scopeTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
    <path d="${roundedRectPathPt(
      L.marginX,
      L.scopeY,
      L.contentW,
      L.scopeBarH,
      L.rCad,
      L.rCad,
      0,
      0,
      S
    )}" fill="#000000" stroke="none" />
    <text x="${p(L.marginX + 12)}" y="${p(
    L.scopeY + 12.6
  )}" font-family="${fontStack}" font-size="${p(7.8)}" font-weight="400" letter-spacing="1.4" fill="#FFFFFF">${escapeXml(
    data.projectTitle
  )}</text>
    <text x="${p(L.marginX + L.contentW - 12)}" y="${p(
    L.scopeY + 12.6
  )}" text-anchor="end" font-family="${fontStack}" font-size="${p(7.0)}" font-weight="400" letter-spacing="1.2" fill="#FDCB33">PROJECT SCOPE</text>
    ${vm.scopeLines
      .map(
        (line, idx) =>
          `<text x="${p(L.marginX + 12)}" y="${p(
            scopeStartY + idx * 11.6
          )}" font-family="${fontStack}" font-size="${p(7.4)}" font-weight="300" letter-spacing="0.35" fill="#000000">${escapeXml(
            line
          )}</text>`
      )
      .join('\n    ')}
    <rect x="${p(L.marginX)}" y="${p(L.scopeY)}" width="${p(L.contentW)}" height="${p(
    scopeTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
    strokes.card
  )}" />
  </g>

  <!-- LAYER 3: UNIFIED BUDGET DISTRIBUTION CARD & PIE CHART -->
  <g inkscape:groupmode="layer" id="layer-budget-pie" inkscape:label="03 - Budget Distribution Pie Chart">
    <rect x="${p(L.marginX)}" y="${p(L.budgetY)}" width="${p(L.contentW)}" height="${p(
    budgetTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
    <path d="${roundedRectPathPt(
      L.marginX,
      L.budgetY,
      L.contentW,
      L.budgetBarH,
      L.rCad,
      L.rCad,
      0,
      0,
      S
    )}" fill="#000000" stroke="none" />
    <text x="${p(L.marginX + 12)}" y="${p(
    L.budgetY + 12.6
  )}" font-family="${fontStack}" font-size="${p(7.8)}" font-weight="400" letter-spacing="1.4" fill="#FFFFFF">BUDGET DISTRIBUTION</text>
    <text x="${p(L.marginX + L.contentW - 12)}" y="${p(
    L.budgetY + 12.6
  )}" text-anchor="end" font-family="${fontStack}" font-size="${p(7.4)}" font-weight="400" letter-spacing="1.1" fill="#FDCB33">TOTAL  ·  ${escapeXml(
    formatCurrency(vm.summary.totalAmount)
  )}</text>

    ${slicesSvg}
    ${calloutsSvg}
    ${driveFlanksSvg}

    <rect x="${p(L.marginX)}" y="${p(L.budgetY)}" width="${p(L.contentW)}" height="${p(
    budgetTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
    strokes.card
  )}" />
  </g>

  <!-- LAYER 4: FOUR UNIFIED COLOR-CODED PILLAR BREAKDOWN CARDS -->
  <g inkscape:groupmode="layer" id="layer-pillar-breakdowns" inkscape:label="04 - 4 Pillar Breakdowns">
    ${pillarsSvg}
  </g>

  <!-- LAYER 5: INTEGRATED 3-ZONE PAYMENT FOOTER & BRAND MARK -->
  <g inkscape:groupmode="layer" id="layer-payment-footer" inkscape:label="05 - Payment &amp; Footer">
    <line x1="${p(L.marginX)}" y1="${p(L.footerRuleY)}" x2="${p(
    L.marginX + L.contentW
  )}" y2="${p(L.footerRuleY)}" stroke="#000000" stroke-width="${p(strokes.footerRule)}" />

    <!-- Left Unified Final Payment Card -->
    <rect x="${p(L.marginX)}" y="${p(L.footerY)}" width="${p(L.footerCardW)}" height="${p(
    footerTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
    <path d="${roundedRectPathPt(
      L.marginX,
      L.footerY,
      L.footerCardW,
      L.footerBarH,
      L.rCad,
      L.rCad,
      0,
      0,
      S
    )}" fill="#000000" stroke="none" />
    <text x="${p(L.marginX + L.footerCardW / 2)}" y="${p(
    L.footerY + 12.4
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.3)}" font-weight="400" letter-spacing="1.3" fill="#FFFFFF">FINAL PAYMENT</text>
    <text x="${p(L.marginX + L.footerCardW / 2)}" y="${p(
    L.footerY + L.footerBarH + 16.5
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.3)}" font-weight="300" letter-spacing="0.4" fill="#000000">${escapeXml(
    vm.equationLine
  )}</text>
    <path d="${roundedRectPathPt(
      L.marginX,
      L.footerY + L.footerBarH + L.footerMidH,
      L.footerCardW,
      L.footerBotH,
      0,
      0,
      L.rCad,
      L.rCad,
      S
    )}" fill="#CBCBCB" stroke="none" />
    <line x1="${p(L.marginX)}" y1="${p(L.footerY + L.footerBarH + L.footerMidH)}" x2="${p(
    L.marginX + L.footerCardW
  )}" y2="${p(L.footerY + L.footerBarH + L.footerMidH)}" stroke="#000000" stroke-width="${p(
    strokes.divider
  )}" />
    <text x="${p(L.marginX + L.footerCardW / 2)}" y="${p(
    L.footerY + L.footerBarH + L.footerMidH + 17.5
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.8)}" font-weight="400" letter-spacing="0.8" fill="#000000">${escapeXml(
    vm.resultLine
  )}</text>
    <rect x="${p(L.marginX)}" y="${p(L.footerY)}" width="${p(L.footerCardW)}" height="${p(
    footerTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
    strokes.card
  )}" />

    <!-- Center 4-Icon Mark + Page Badge -->
    <image
      id="casegoods-footer-icons"
      x="${p(iconsX)}"
      y="${p(L.footerY + 10)}"
      width="${p(iconsW)}"
      height="${p(L.iconsH)}"
      preserveAspectRatio="xMidYMid meet"
      xlink:href="${logoIconsB64}" />
    <rect x="${p(L.centerX - L.pageBadgeW / 2)}" y="${p(L.pageBadgeY)}" width="${p(
    L.pageBadgeW
  )}" height="${p(L.pageBadgeH)}" rx="${p(L.rCad)}" ry="${p(
    L.rCad
  )}" fill="#000000" stroke="none" />
    <text x="${p(L.centerX)}" y="${p(
    L.pageBadgeY + 16.2
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="400" letter-spacing="1.4" fill="#FFFFFF">${escapeXml(
    vm.pageBadgeText
  )}</text>

    <!-- Right Unified Deposit Required Card -->
    <rect x="${p(rightFooterX)}" y="${p(L.footerY)}" width="${p(L.footerCardW)}" height="${p(
    footerTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="#FFFFFF" stroke="none" />
    <path d="${roundedRectPathPt(
      rightFooterX,
      L.footerY,
      L.footerCardW,
      L.footerBarH,
      L.rCad,
      L.rCad,
      0,
      0,
      S
    )}" fill="#000000" stroke="none" />
    <text x="${p(rightFooterX + L.footerCardW / 2)}" y="${p(
    L.footerY + 12.4
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.3)}" font-weight="400" letter-spacing="1.3" fill="#FFFFFF">DEPOSIT REQUIRED</text>
    <text x="${p(rightFooterX + L.footerCardW / 2)}" y="${p(
    L.footerY + L.footerBarH + 16.8
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.6)}" font-weight="400" letter-spacing="0.6" fill="#000000">${escapeXml(
    formatCurrency(vm.summary.depositAmount)
  )}</text>
    <path d="${roundedRectPathPt(
      rightFooterX,
      L.footerY + L.footerBarH + L.footerMidH,
      L.footerCardW,
      L.footerBotH,
      0,
      0,
      L.rCad,
      L.rCad,
      S
    )}" fill="#FDCB33" stroke="none" />
    <line x1="${p(rightFooterX)}" y1="${p(L.footerY + L.footerBarH + L.footerMidH)}" x2="${p(
    rightFooterX + L.footerCardW
  )}" y2="${p(L.footerY + L.footerBarH + L.footerMidH)}" stroke="#000000" stroke-width="${p(
    strokes.divider
  )}" />
    <text x="${p(rightFooterX + L.footerCardW / 2)}" y="${p(
    L.footerY + L.footerBarH + L.footerMidH + 17.5
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.0)}" font-weight="400" letter-spacing="1.3" fill="#000000">${escapeXml(
    data.depositStatus
  )}</text>
    <rect x="${p(rightFooterX)}" y="${p(L.footerY)}" width="${p(L.footerCardW)}" height="${p(
    footerTotalH
  )}" rx="${p(L.rCad)}" ry="${p(L.rCad)}" fill="none" stroke="#000000" stroke-width="${p(
    strokes.card
  )}" />

    <!-- Studio Contact Footnote -->
    <text x="${p(L.centerX)}" y="${p(
    L.contactLineY
  )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(6.4)}" font-weight="300" letter-spacing="1.4" fill="#000000">${escapeXml(
    vm.contactFooterText
  )}</text>
  </g>
</svg>`;
}

/**
 * Generates an editable Vector + Real-Text US Letter PDF (612pt x 792pt)
 * matching the updated Casegoods header and unified outline integration,
 * using the embedded full Nexa Light OpenType font (subset: false so PDFCraft/Inkscape
 * can freely edit any text without missing glyphs).
 */
export async function generateInvoicePdf(
  data: InvoiceTemplateData,
  assets: InvoiceAssets
): Promise<Uint8Array> {
  const vm = buildInvoiceViewModel(data);
  const L = INVOICE_LAYOUT;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(`casegoods — Invoice ${data.invoiceNumber}`);
  pdfDoc.setAuthor('casegoods — Josh Heinke');
  pdfDoc.setSubject(`Invoice ${data.invoiceNumber} for ${data.recipientName}`);
  pdfDoc.setCreator('casegoods Private Invoice Studio');

  const page = pdfDoc.addPage([L.pageW, L.pageH]);
  const H = L.pageH;

  const fontNexa = await pdfDoc.embedFont(assets.nexaLightTtf, { subset: false });

  const logoMain = await pdfDoc.embedPng(assets.logoMainPng);
  const logoIcons = await pdfDoc.embedPng(assets.logoIconsPng);

  const BLACK = rgb(0, 0, 0);
  const WHITE = rgb(1, 1, 1);
  const YELLOW = rgb(253 / 255, 203 / 255, 51 / 255);
  const GRAY = rgb(203 / 255, 203 / 255, 203 / 255);
  const hexColorMap: Record<string, ReturnType<typeof rgb>> = {
    '#CBCBCB': GRAY,
    '#EF6922': rgb(239 / 255, 105 / 255, 34 / 255),
    '#27AAE0': rgb(39 / 255, 170 / 255, 224 / 255),
    '#FDCB33': YELLOW,
  };

  const py = (topY: number) => H - topY;

  const drawBox = (
    x: number,
    topY: number,
    w: number,
    h: number,
    opts: {
      fill?: ReturnType<typeof rgb>;
      border?: ReturnType<typeof rgb>;
      borderWidth?: number;
      corners?: [number, number, number, number];
    }
  ) => {
    const r = L.rCad;
    const [rtl, rtr, rbr, rbl] = opts.corners ?? [r, r, r, r];
    const path = roundedRectPathPt(x, topY, w, h, rtl, rtr, rbr, rbl, 1);
    page.drawSvgPath(path, {
      x: 0,
      y: H,
      color: opts.fill,
      borderColor: opts.border,
      borderWidth: opts.borderWidth,
    });
  };

  const drawCenterText = (
    text: string,
    centerX: number,
    topBaselineY: number,
    size: number,
    color = BLACK
  ) => {
    const safe = text || '';
    const width = fontNexa.widthOfTextAtSize(safe, size);
    page.drawText(safe, {
      x: centerX - width / 2,
      y: py(topBaselineY),
      size,
      font: fontNexa,
      color,
    });
  };

  const drawRightText = (
    text: string,
    rightX: number,
    topBaselineY: number,
    size: number,
    color = BLACK
  ) => {
    const safe = text || '';
    const width = fontNexa.widthOfTextAtSize(safe, size);
    page.drawText(safe, {
      x: rightX - width,
      y: py(topBaselineY),
      size,
      font: fontNexa,
      color,
    });
  };

  page.drawRectangle({ x: 0, y: 0, width: L.pageW, height: L.pageH, color: WHITE });

  const rightHeaderX = L.marginX + L.contentW - L.headerBoxW;
  const rightFooterX = L.marginX + L.contentW - L.footerCardW;
  const footerTotalH = L.footerBarH + L.footerMidH + L.footerBotH;
  const scopeTotalH = L.scopeBarH + L.scopeBodyH;
  const budgetTotalH = L.budgetBarH + L.budgetBodyH;

  const strokes = L.strokes;

  // 1. Top 3-Zone Architectural Header
  // Left Unified Recipient Card
  drawBox(L.marginX, L.headerTopY, L.headerBoxW, L.headerBoxH, {
    fill: WHITE,
  });
  drawBox(L.marginX, L.headerTopY, L.headerBoxW, L.headerBarH, {
    fill: BLACK,
    corners: [L.rCad, L.rCad, 0, 0],
  });
  drawCenterText('RECIPIENT', L.marginX + L.headerBoxW / 2, L.headerTopY + 12, 7.4, WHITE);
  drawCenterText(
    data.recipientName,
    L.marginX + L.headerBoxW / 2,
    L.headerTopY + L.headerBarH + 17.2,
    8.6,
    BLACK
  );
  drawBox(L.marginX, L.headerTopY, L.headerBoxW, L.headerBoxH, {
    border: BLACK,
    borderWidth: strokes.card,
  });

  // Center Brand Lockup
  const mainLogoW = L.mainLogoH * (logoMain.width / logoMain.height);
  page.drawImage(logoMain, {
    x: L.centerX - mainLogoW / 2,
    y: py(L.headerTopY + 2 + L.mainLogoH),
    width: mainLogoW,
    height: L.mainLogoH,
  });

  // Right Unified Invoice Card
  drawBox(rightHeaderX, L.headerTopY, L.headerBoxW, L.headerBoxH, {
    fill: WHITE,
  });
  drawBox(rightHeaderX, L.headerTopY, L.headerBoxW, L.headerBarH, {
    fill: BLACK,
    corners: [L.rCad, L.rCad, 0, 0],
  });
  drawCenterText('INVOICE', rightHeaderX + L.headerBoxW / 2, L.headerTopY + 12, 7.4, WHITE);
  drawCenterText(
    data.invoiceNumber,
    rightHeaderX + L.headerBoxW / 2,
    L.headerTopY + L.headerBarH + 17.2,
    8.6,
    BLACK
  );
  drawBox(rightHeaderX, L.headerTopY, L.headerBoxW, L.headerBoxH, {
    border: BLACK,
    borderWidth: strokes.card,
  });

  // Header Divider Rule
  page.drawLine({
    start: { x: L.marginX, y: py(L.headerRuleY) },
    end: { x: L.marginX + L.contentW, y: py(L.headerRuleY) },
    thickness: strokes.headerRule,
    color: BLACK,
  });

  // 2. Unified Project Overview Card
  drawBox(L.marginX, L.scopeY, L.contentW, scopeTotalH, {
    fill: WHITE,
  });
  drawBox(L.marginX, L.scopeY, L.contentW, L.scopeBarH, {
    fill: BLACK,
    corners: [L.rCad, L.rCad, 0, 0],
  });
  page.drawText(data.projectTitle || '', {
    x: L.marginX + 12,
    y: py(L.scopeY + 12.6),
    size: 8.0,
    font: fontNexa,
    color: WHITE,
  });
  drawRightText('PROJECT SCOPE', L.marginX + L.contentW - 12, L.scopeY + 12.6, 7.2, YELLOW);

  const scopePdfLines = wrapPdfLines(data.projectSummary, fontNexa, 7.5, L.contentW - 24, 3);
  const scopeStartY =
    L.scopeY +
    L.scopeBarH +
    (scopePdfLines.length === 1 ? 26 : scopePdfLines.length === 2 ? 20 : 14.5);
  scopePdfLines.forEach((line, idx) => {
    page.drawText(line, {
      x: L.marginX + 12,
      y: py(scopeStartY + idx * 11.6),
      size: 7.5,
      font: fontNexa,
      color: BLACK,
    });
  });
  drawBox(L.marginX, L.scopeY, L.contentW, scopeTotalH, {
    border: BLACK,
    borderWidth: strokes.card,
  });

  // 3. Unified Budget Distribution Card & Pie Chart
  drawBox(L.marginX, L.budgetY, L.contentW, budgetTotalH, {
    fill: WHITE,
  });
  drawBox(L.marginX, L.budgetY, L.contentW, L.budgetBarH, {
    fill: BLACK,
    corners: [L.rCad, L.rCad, 0, 0],
  });
  page.drawText('BUDGET DISTRIBUTION', {
    x: L.marginX + 12,
    y: py(L.budgetY + 12.6),
    size: 8.0,
    font: fontNexa,
    color: WHITE,
  });
  drawRightText(
    `TOTAL  ·  ${formatCurrency(vm.summary.totalAmount)}`,
    L.marginX + L.contentW - 12,
    L.budgetY + 12.6,
    7.6,
    YELLOW
  );

  vm.summary.slices
    .filter((s) => s.endDeg - s.startDeg > 0.2)
    .forEach((s) => {
      const wedgePath = pieSliceBezierPath(L.pieCx, L.pieCy, vm.pieR, s.startDeg, s.endDeg, 1);
      page.drawSvgPath(wedgePath, {
        x: 0,
        y: H,
        color: hexColorMap[s.colorHex] || BLACK,
        borderColor: WHITE,
        borderWidth: strokes.pieGap,
      });
    });

  vm.callouts.forEach((c) => {
    page.drawSvgPath(c.leaderPath(1), {
      x: 0,
      y: H,
      borderColor: BLACK,
      borderWidth: strokes.leader,
    });
    drawCenterText(c.label, c.centerTextX, c.labelY, 7.4, BLACK);
    drawCenterText(c.percentText, c.centerTextX, c.pctY, 8.0, BLACK);
  });

  if (vm.hasDriveQr) {
    const qrSize = 56;
    const qrCenterX = 528;
    const qrX = qrCenterX - qrSize / 2;
    const qrY = 236;

    const totalBoxW = 92;
    const totalBoxH = 38;
    const totalBarH = 15;
    const totalX = 46;
    const totalY = 252;
    const totalCenterX = totalX + totalBoxW / 2;

    drawBox(totalX, totalY, totalBoxW, totalBoxH, {
      fill: WHITE,
    });
    drawBox(totalX, totalY, totalBoxW, totalBarH, {
      fill: GRAY,
      corners: [L.rCad, L.rCad, 0, 0],
    });
    page.drawLine({
      start: { x: totalX, y: py(totalY + totalBarH) },
      end: { x: totalX + totalBoxW, y: py(totalY + totalBarH) },
      thickness: strokes.divider,
      color: BLACK,
    });
    drawCenterText('PROJECT TOTAL', totalCenterX, totalY + 10.2, 6.2, BLACK);
    drawCenterText(formatCurrency(vm.summary.totalAmount), totalCenterX, totalY + 29.5, 8.2, BLACK);
    drawBox(totalX, totalY, totalBoxW, totalBoxH, {
      border: BLACK,
      borderWidth: strokes.card,
    });

    drawCasegoodsQrPdf(page, H, vm.driveUrl, qrX, qrY, qrSize, { frameStyle: 'cg-badge' });
    drawCenterText('PROJECT DRIVE FILES', qrCenterX, 303, 5.8, BLACK);
    if (vm.clippedFolder) {
      drawCenterText(vm.clippedFolder, qrCenterX, 312, 5.4, BLACK);
    }
  }
  drawBox(L.marginX, L.budgetY, L.contentW, budgetTotalH, {
    border: BLACK,
    borderWidth: strokes.card,
  });

  // 4. Four Unified Color-Coded Pillar Cards
  vm.pillarCards.forEach((card) => {
    const fill = hexColorMap[card.slice.colorHex] || BLACK;
    const bodyTopY = card.topY + card.barH;
    drawBox(L.marginX, card.topY, L.contentW, card.totalH, {
      fill: WHITE,
    });
    drawBox(L.marginX, card.topY, L.contentW, card.barH, {
      fill,
      corners: [L.rCad, L.rCad, 0, 0],
    });
    page.drawLine({
      start: { x: L.marginX, y: py(bodyTopY) },
      end: { x: L.marginX + L.contentW, y: py(bodyTopY) },
      thickness: strokes.divider,
      color: BLACK,
    });
    page.drawText(card.slice.label, {
      x: L.marginX + 12,
      y: py(card.topY + 12.6),
      size: 7.7,
      font: fontNexa,
      color: BLACK,
    });
    drawRightText(card.rightMeta, L.marginX + L.contentW - 12, card.topY + 12.6, 7.7, BLACK);

    const descLines = wrapPdfLines(
      card.slice.description,
      fontNexa,
      7.4,
      L.contentW - 24,
      card.maxLines
    );
    const lineStartY =
      bodyTopY +
      (descLines.length === 1
        ? card.bodyH / 2 + 2.6
        : descLines.length === 2
        ? card.bodyH / 2 - 3.2
        : 14);
    descLines.forEach((line, idx) => {
      page.drawText(line, {
        x: L.marginX + 12,
        y: py(lineStartY + idx * 11.4),
        size: 7.4,
        font: fontNexa,
        color: BLACK,
      });
    });
    drawBox(L.marginX, card.topY, L.contentW, card.totalH, {
      border: BLACK,
      borderWidth: strokes.card,
    });
  });

  // 5. Integrated Bottom 3-Zone Payment Footer
  page.drawLine({
    start: { x: L.marginX, y: py(L.footerRuleY) },
    end: { x: L.marginX + L.contentW, y: py(L.footerRuleY) },
    thickness: strokes.footerRule,
    color: BLACK,
  });

  // Left Unified Final Payment Card
  drawBox(L.marginX, L.footerY, L.footerCardW, footerTotalH, {
    fill: WHITE,
  });
  drawBox(L.marginX, L.footerY, L.footerCardW, L.footerBarH, {
    fill: BLACK,
    corners: [L.rCad, L.rCad, 0, 0],
  });
  drawCenterText('FINAL PAYMENT', L.marginX + L.footerCardW / 2, L.footerY + 12.4, 7.4, WHITE);
  drawCenterText(
    vm.equationLine,
    L.marginX + L.footerCardW / 2,
    L.footerY + L.footerBarH + 16.5,
    7.4,
    BLACK
  );
  drawBox(L.marginX, L.footerY + L.footerBarH + L.footerMidH, L.footerCardW, L.footerBotH, {
    fill: GRAY,
    corners: [0, 0, L.rCad, L.rCad],
  });
  page.drawLine({
    start: { x: L.marginX, y: py(L.footerY + L.footerBarH + L.footerMidH) },
    end: { x: L.marginX + L.footerCardW, y: py(L.footerY + L.footerBarH + L.footerMidH) },
    thickness: strokes.divider,
    color: BLACK,
  });
  drawCenterText(
    vm.resultLine,
    L.marginX + L.footerCardW / 2,
    L.footerY + L.footerBarH + L.footerMidH + 17.5,
    8.8,
    BLACK
  );
  drawBox(L.marginX, L.footerY, L.footerCardW, footerTotalH, {
    border: BLACK,
    borderWidth: strokes.card,
  });

  // Center 4-Icon Mark + Page Badge
  const iconsW = L.iconsH * (logoIcons.width / logoIcons.height);
  page.drawImage(logoIcons, {
    x: L.centerX - iconsW / 2,
    y: py(L.footerY + 10 + L.iconsH),
    width: iconsW,
    height: L.iconsH,
  });
  drawBox(L.centerX - L.pageBadgeW / 2, L.pageBadgeY, L.pageBadgeW, L.pageBadgeH, {
    fill: BLACK,
  });
  drawCenterText(vm.pageBadgeText, L.centerX, L.pageBadgeY + 16.2, 7.8, WHITE);

  // Right Unified Deposit Required Card
  drawBox(rightFooterX, L.footerY, L.footerCardW, footerTotalH, {
    fill: WHITE,
  });
  drawBox(rightFooterX, L.footerY, L.footerCardW, L.footerBarH, {
    fill: BLACK,
    corners: [L.rCad, L.rCad, 0, 0],
  });
  drawCenterText('DEPOSIT REQUIRED', rightFooterX + L.footerCardW / 2, L.footerY + 12.4, 7.4, WHITE);
  drawCenterText(
    formatCurrency(vm.summary.depositAmount),
    rightFooterX + L.footerCardW / 2,
    L.footerY + L.footerBarH + 16.8,
    8.6,
    BLACK
  );
  drawBox(rightFooterX, L.footerY + L.footerBarH + L.footerMidH, L.footerCardW, L.footerBotH, {
    fill: YELLOW,
    corners: [0, 0, L.rCad, L.rCad],
  });
  page.drawLine({
    start: { x: rightFooterX, y: py(L.footerY + L.footerBarH + L.footerMidH) },
    end: { x: rightFooterX + L.footerCardW, y: py(L.footerY + L.footerBarH + L.footerMidH) },
    thickness: strokes.divider,
    color: BLACK,
  });
  drawCenterText(
    data.depositStatus,
    rightFooterX + L.footerCardW / 2,
    L.footerY + L.footerBarH + L.footerMidH + 17.5,
    8.1,
    BLACK
  );
  drawBox(rightFooterX, L.footerY, L.footerCardW, footerTotalH, {
    border: BLACK,
    borderWidth: strokes.card,
  });

  // Bottom Studio Contact Footnote
  drawCenterText(vm.contactFooterText, L.centerX, L.contactLineY, 6.6, BLACK);

  return await pdfDoc.save();
}
