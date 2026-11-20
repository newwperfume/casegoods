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

function wrapTextLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
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

function roundedRectPathPt(
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

function pieSliceBezierPath(
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

interface CalloutGeometry {
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
function buildPieCallouts(
  cx: number,
  cy: number,
  radius: number,
  slices: ComputedInvoiceSummary['slices']
): CalloutGeometry[] {
  const anchorR = radius + 7; // 75pt outside circle center

  return slices
    .filter((s) => s.endDeg - s.startDeg > 0.5)
    .map((slice) => {
      const isRight = slice.key === 'design' || slice.key === 'resources';
      const isTop = slice.key === 'design' || slice.key === 'flex';

      // Ensure anchor exits cleanly from the slice perimeter without crossing back across the circle
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

      // Vertical target strictly outside the circle's top or bottom edge
      const elbowY = isTop
        ? Math.min(anchorY - 12, cy - radius - 14)
        : Math.max(anchorY + 14, cy + radius + 8);

      const endX = isRight ? cx + radius + 54 : cx - radius - 54;
      const centerTextX = isRight ? endX + 76 : endX - 76;

      // Check if going vertically straight from anchorY to elbowY would pass through the circle
      const crossesOppositeSide = (anchorY - cy) * (elbowY - cy) < 0;
      const insideHorizontalSpan = Math.abs(anchorX - cx) < radius + 5;

      const buildRoundedElbowPath = (scale: number) => {
        const s = (v: number) => +(v * scale).toFixed(2);
        const dirY = elbowY > anchorY ? 1 : -1;
        const dirX = endX > anchorX ? 1 : -1;

        if (crossesOppositeSide && insideHorizontalSpan) {
          const safeX = cx + (isRight ? radius + 12 : -(radius + 12));
          const cr1 = Math.min(6.75, Math.abs(safeX - anchorX) * 0.45, Math.abs(elbowY - anchorY) * 0.35);
          const cr2 = Math.min(6.75, Math.abs(endX - safeX) * 0.45, Math.abs(elbowY - anchorY) * 0.35);
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
        label: slice.label,
        percentText: `${slice.percent} %`,
        leaderPath: buildRoundedElbowPath,
        centerTextX,
        labelY: elbowY - 3,
        pctY: elbowY + 9,
      };
    });
}

export interface InvoiceAssets {
  logoMainPng: Uint8Array;
  logoIconsPng: Uint8Array;
  nexaLightTtf: Uint8Array;
}

/**
 * Generates an Inkscape-native layered SVG (US Letter 8.5in x 11in, 816 x 1056 viewBox)
 * with embedded Nexa Light TrueType font, radiused 90-deg leader lines, centered % under titles,
 * and section cost centered next to each pillar bar title.
 */
export function generateInvoiceSvg(
  data: InvoiceTemplateData,
  assets: InvoiceAssets
): string {
  const summary = computeInvoiceSummary(data);
  const S = 96 / 72; // 1.333333 px per pt
  const p = (pt: number) => +(pt * S).toFixed(2);
  const fontStack = `'Nexa Light', 'Montserrat', 'Questrial', sans-serif`;

  const logoMainB64 = `data:image/png;base64,${uint8ToBase64(assets.logoMainPng)}`;
  const logoIconsB64 = `data:image/png;base64,${uint8ToBase64(assets.logoIconsPng)}`;
  const nexaFontB64 = `data:font/truetype;base64,${uint8ToBase64(assets.nexaLightTtf)}`;

  const rCad = 6.75; // 9px radius
  const marginX = 34;
  const contentW = 544; // 34..578

  const sideW = 152;
  const mainLogoH = 44;
  const mainLogoW = +(mainLogoH * (7841 / 1847)).toFixed(2);
  const mainLogoX = +(306 - mainLogoW / 2).toFixed(2);

  // Pie Chart Geometry (68pt radius leaves generous white space for centered side callouts)
  const pieCx = 306;
  const pieCy = 292;
  const pieR = 68;
  const callouts = buildPieCallouts(pieCx, pieCy, pieR, summary.slices);

  const scopeLines = wrapTextLines(data.projectSummary, 90, 3);

  const pillarRows = [
    { slice: summary.slices[0], topY: 396, barH: 18, boxH: 44, maxLines: 3 },
    { slice: summary.slices[1], topY: 470, barH: 18, boxH: 36, maxLines: 2 },
    { slice: summary.slices[2], topY: 536, barH: 18, boxH: 48, maxLines: 3 },
    { slice: summary.slices[3], topY: 614, barH: 18, boxH: 26, maxLines: 1 },
  ];

  const iconsH = 26;
  const iconsW = +(iconsH * (2422 / 472)).toFixed(2);
  const iconsX = +(306 - iconsW / 2).toFixed(2);

  const slicesSvg = summary.slices
    .filter((s) => s.endDeg - s.startDeg > 0.2)
    .map(
      (s) =>
        `<path id="pie-slice-${s.key}" d="${pieSliceBezierPath(
          pieCx,
          pieCy,
          pieR,
          s.startDeg,
          s.endDeg,
          S
        )}" fill="${s.colorHex}" stroke="#FFFFFF" stroke-width="${p(2.5)}" stroke-linejoin="round" />`
    )
    .join('\n    ');

  const calloutsSvg = callouts
    .map(
      (c) => `
    <g>
      <path d="${c.leaderPath(S)}" fill="none" stroke="#000000" stroke-width="${p(0.85)}" stroke-linecap="round" />
      <text x="${p(c.centerTextX)}" y="${p(c.labelY)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="300" letter-spacing="1.0" fill="#000000">${escapeXml(
        c.label
      )}</text>
      <text x="${p(c.centerTextX)}" y="${p(c.pctY)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.2)}" font-weight="300" letter-spacing="0.8" fill="#000000">${escapeXml(
        c.percentText
      )}</text>
    </g>`
    )
    .join('\n');

  const pillarsSvg = pillarRows
    .map((row) => {
      const descLines = wrapTextLines(row.slice.description, 90, row.maxLines);
      const boxY = row.topY + row.barH + 4;
      const lineStartY = boxY + (descLines.length === 1 ? 16 : descLines.length === 2 ? 14.5 : 13.5);
      const barTitleWithCost = `${row.slice.label}  ·  ${formatCurrency(row.slice.amount)}`;
      const linesMarkup = descLines
        .map(
          (line, idx) =>
            `<text x="${p(marginX + 12)}" y="${p(
              lineStartY + idx * 11.5
            )}" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="300" letter-spacing="0.35" fill="#000000">${escapeXml(
              line
            )}</text>`
        )
        .join('\n      ');

      return `
    <g id="pillar-section-${row.slice.key}">
      <rect x="${p(marginX)}" y="${p(row.topY)}" width="${p(contentW)}" height="${p(
        row.barH
      )}" rx="${p(rCad)}" ry="${p(rCad)}" fill="${row.slice.colorHex}" stroke="#000000" stroke-width="1" />
      <text x="${p(306)}" y="${p(
        row.topY + 12
      )}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.8)}" font-weight="300" letter-spacing="1.4" fill="#000000">${escapeXml(
        barTitleWithCost
      )}</text>
      <rect x="${p(marginX)}" y="${p(boxY)}" width="${p(contentW)}" height="${p(
        row.boxH
      )}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
      ${linesMarkup}
    </g>`;
    })
    .join('\n');

  const depositMethodUpper = data.depositMethodNote.trim()
    ? ` (${data.depositMethodNote.trim().toUpperCase()})`
    : '';
  const equationLine = `${formatCurrency(summary.totalAmount)} - ${formatCurrency(
    summary.depositAmount
  )}${depositMethodUpper}`;
  const resultLine = `= ${formatCurrency(summary.finalPayment)}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  width="8.5in"
  height="11in"
  viewBox="0 0 ${p(612)} ${p(792)}"
  version="1.1"
  id="casegoods-invoice-template">
  <title>casegoods — Invoice ${escapeXml(data.invoiceNumber)}</title>
  <defs>
    <style type="text/css"><![CDATA[
      @font-face {
        font-family: 'Nexa Light';
        src: url('${nexaFontB64}') format('truetype');
        font-weight: 300;
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
    <rect x="0" y="0" width="${p(612)}" height="${p(792)}" fill="#FFFFFF" />
  </g>

  <!-- LAYER 2: TOP HEADER, RECIPIENT / INVOICE TAGS & PROJECT SUMMARY -->
  <g inkscape:groupmode="layer" id="layer-header-project" inkscape:label="02 - Header &amp; Project Overview">
    <rect x="${p(marginX)}" y="${p(26)}" width="${p(sideW)}" height="${p(20)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + sideW / 2)}" y="${p(39)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="300" letter-spacing="1.4" fill="#FFFFFF">RECIPIENT</text>
    <rect x="${p(marginX)}" y="${p(50)}" width="${p(sideW)}" height="${p(22)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + sideW / 2)}" y="${p(64)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.2)}" font-weight="300" letter-spacing="0.9" fill="#000000">${escapeXml(
      data.recipientName
    )}</text>

    <image
      id="casegoods-main-logo"
      x="${p(mainLogoX)}"
      y="${p(27)}"
      width="${p(mainLogoW)}"
      height="${p(mainLogoH)}"
      preserveAspectRatio="xMidYMid meet"
      xlink:href="${logoMainB64}" />

    <rect x="${p(marginX + contentW - sideW)}" y="${p(26)}" width="${p(sideW)}" height="${p(20)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + contentW - sideW / 2)}" y="${p(39)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="300" letter-spacing="1.4" fill="#FFFFFF">INVOICE</text>
    <rect x="${p(marginX + contentW - sideW)}" y="${p(50)}" width="${p(sideW)}" height="${p(22)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + contentW - sideW / 2)}" y="${p(64)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.2)}" font-weight="300" letter-spacing="0.9" fill="#000000">${escapeXml(
      data.invoiceNumber
    )}</text>

    <line x1="${p(marginX)}" y1="${p(82)}" x2="${p(marginX + contentW)}" y2="${p(82)}" stroke="#000000" stroke-width="1" />

    <rect x="${p(marginX)}" y="${p(92)}" width="${p(contentW)}" height="${p(20)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <text x="${p(306)}" y="${p(105)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8)}" font-weight="300" letter-spacing="1.5" fill="#FFFFFF">${escapeXml(
      data.projectTitle
    )}</text>

    <rect x="${p(marginX)}" y="${p(117)}" width="${p(contentW)}" height="${p(48)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    ${scopeLines
      .map(
        (line, idx) =>
          `<text x="${p(marginX + 12)}" y="${p(
            131 + idx * 11.8
          )}" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="300" letter-spacing="0.35" fill="#000000">${escapeXml(
            line
          )}</text>`
      )
      .join('\n    ')}
  </g>

  <!-- LAYER 3: BUDGET DISTRIBUTION PIE CHART -->
  <g inkscape:groupmode="layer" id="layer-budget-pie" inkscape:label="03 - Budget Distribution Pie Chart">
    <rect x="${p(marginX)}" y="${p(175)}" width="${p(contentW)}" height="${p(20)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <text x="${p(306)}" y="${p(188)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8)}" font-weight="300" letter-spacing="1.5" fill="#FFFFFF">BUDGET DISTRIBUTION</text>

    ${slicesSvg}
    ${calloutsSvg}
    ${
      data.driveFolderUrl?.trim()
        ? (() => {
            const driveUrl = data.driveFolderUrl.trim();
            const folderTag = (data.driveFolderName || '').trim().toUpperCase();
            const clippedFolder =
              folderTag.length > 22 ? `${folderTag.slice(0, 21)}…` : folderTag;
            const qrSize = 64;
            const qrCenterX = 504;
            const qrX = qrCenterX - qrSize / 2;
            const qrY = 250;
            const totalBoxW = 104;
            const totalCenterX = 108;
            const totalX = totalCenterX - totalBoxW / 2;

            return `
    <!-- Symmetrical Left Flank: Project Total Pill -->
    <g id="budget-total-badge">
      <rect x="${p(totalX)}" y="${p(268)}" width="${p(totalBoxW)}" height="${p(17)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
      <text x="${p(totalCenterX)}" y="${p(279)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(6.5)}" font-weight="300" letter-spacing="1.1" fill="#FFFFFF">PROJECT TOTAL</text>
      <rect x="${p(totalX)}" y="${p(288)}" width="${p(totalBoxW)}" height="${p(22)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
      <text x="${p(totalCenterX)}" y="${p(302.5)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.4)}" font-weight="300" letter-spacing="0.6" fill="#000000">${escapeXml(
              formatCurrency(summary.totalAmount)
            )}</text>
    </g>
    <!-- Symmetrical Right Flank: Google Drive Project Folder QR Code -->
    <g id="project-drive-qr">
      ${renderCasegoodsQrSvgFragment(driveUrl, p(qrX), p(qrY), p(qrSize), {
        frameStyle: 'cg-badge',
      })}
      <text x="${p(qrCenterX)}" y="${p(325.5)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(6.0)}" font-weight="300" letter-spacing="1.0" fill="#000000">PROJECT DRIVE FILES</text>
      ${
        clippedFolder
          ? `<text x="${p(qrCenterX)}" y="${p(335)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(5.5)}" font-weight="300" letter-spacing="0.5" fill="#000000">${escapeXml(
              clippedFolder
            )}</text>`
          : ''
      }
    </g>`;
          })()
        : ''
    }
  </g>

  <!-- LAYER 4: FOUR COLOR-CODED PILLAR BREAKDOWNS -->
  <g inkscape:groupmode="layer" id="layer-pillar-breakdowns" inkscape:label="04 - 4 Pillar Breakdowns">
    ${pillarsSvg}
  </g>

  <!-- LAYER 5: FINAL PAYMENT, DEPOSIT REQUIRED & 4-ICON FOOTER -->
  <g inkscape:groupmode="layer" id="layer-payment-footer" inkscape:label="05 - Payment &amp; Footer">
    <rect x="${p(marginX)}" y="${p(686)}" width="${p(160)}" height="${p(20)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + 80)}" y="${p(699)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="300" letter-spacing="1.3" fill="#FFFFFF">FINAL PAYMENT</text>
    <rect x="${p(marginX)}" y="${p(710)}" width="${p(160)}" height="${p(21)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + 80)}" y="${p(724)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.5)}" font-weight="300" letter-spacing="0.4" fill="#000000">${escapeXml(
      equationLine
    )}</text>
    <rect x="${p(marginX)}" y="${p(735)}" width="${p(160)}" height="${p(21)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + 80)}" y="${p(749)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.5)}" font-weight="300" letter-spacing="0.6" fill="#000000">${escapeXml(
      resultLine
    )}</text>

    <image
      id="casegoods-footer-icons"
      x="${p(iconsX)}"
      y="${p(692)}"
      width="${p(iconsW)}"
      height="${p(iconsH)}"
      preserveAspectRatio="xMidYMid meet"
      xlink:href="${logoIconsB64}" />
    <rect x="${p(236)}" y="${p(735)}" width="${p(140)}" height="${p(21)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <text x="${p(306)}" y="${p(749)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8)}" font-weight="300" letter-spacing="1.2" fill="#FFFFFF">${escapeXml(
      data.pageLabel
    )}</text>

    <rect x="${p(marginX + contentW - 160)}" y="${p(686)}" width="${p(160)}" height="${p(20)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + contentW - 80)}" y="${p(699)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(7.6)}" font-weight="300" letter-spacing="1.3" fill="#FFFFFF">DEPOSIT REQUIRED</text>
    <rect x="${p(marginX + contentW - 160)}" y="${p(710)}" width="${p(160)}" height="${p(21)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + contentW - 80)}" y="${p(724)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8.4)}" font-weight="300" letter-spacing="0.6" fill="#000000">${escapeXml(
      formatCurrency(summary.depositAmount)
    )}</text>
    <rect x="${p(marginX + contentW - 160)}" y="${p(735)}" width="${p(160)}" height="${p(21)}" rx="${p(rCad)}" ry="${p(rCad)}" fill="#FDCB33" stroke="#000000" stroke-width="1" />
    <text x="${p(marginX + contentW - 80)}" y="${p(749)}" text-anchor="middle" font-family="${fontStack}" font-size="${p(8)}" font-weight="300" letter-spacing="1.2" fill="#000000">${escapeXml(
      data.depositStatus
    )}</text>
  </g>
</svg>`;
}

/**
 * Generates an editable Vector + Real-Text US Letter PDF (612pt x 792pt)
 * using the embedded full Nexa Light TrueType font (subset: false so PDFCraft/Inkscape
 * can freely edit any text without missing glyphs).
 */
export async function generateInvoicePdf(
  data: InvoiceTemplateData,
  assets: InvoiceAssets
): Promise<Uint8Array> {
  const summary = computeInvoiceSummary(data);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle(`casegoods — Invoice ${data.invoiceNumber}`);
  pdfDoc.setAuthor('casegoods — Josh Heinke');
  pdfDoc.setSubject(`Invoice ${data.invoiceNumber} for ${data.recipientName}`);
  pdfDoc.setCreator('casegoods Private Invoice Studio');

  const page = pdfDoc.addPage([612, 792]);
  const H = 792;

  const fontNexa = await pdfDoc.embedFont(assets.nexaLightTtf, { subset: false });

  const logoMain = await pdfDoc.embedPng(assets.logoMainPng);
  const logoIcons = await pdfDoc.embedPng(assets.logoIconsPng);

  const BLACK = rgb(0, 0, 0);
  const WHITE = rgb(1, 1, 1);
  const hexColorMap: Record<string, ReturnType<typeof rgb>> = {
    '#CBCBCB': rgb(203 / 255, 203 / 255, 203 / 255),
    '#EF6922': rgb(239 / 255, 105 / 255, 34 / 255),
    '#27AAE0': rgb(39 / 255, 170 / 255, 224 / 255),
    '#FDCB33': rgb(253 / 255, 203 / 255, 51 / 255),
  };

  const py = (topY: number) => H - topY;

  const drawRoundedBox = (
    x: number,
    topY: number,
    w: number,
    h: number,
    opts: { fill?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb>; borderWidth?: number }
  ) => {
    const r = 6.75;
    const path = roundedRectPathPt(x, topY, w, h, r, r, r, r, 1);
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
    font: PDFFont,
    color = BLACK
  ) => {
    const safe = text || '';
    const width = font.widthOfTextAtSize(safe, size);
    page.drawText(safe, {
      x: centerX - width / 2,
      y: py(topBaselineY),
      size,
      font,
      color,
    });
  };

  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: WHITE });

  const marginX = 34;
  const contentW = 544;
  const sideW = 152;

  // Left: Recipient
  drawRoundedBox(marginX, 26, sideW, 20, { fill: BLACK, border: BLACK, borderWidth: 1 });
  drawCenterText('RECIPIENT', marginX + sideW / 2, 39, 7.8, fontNexa, WHITE);
  drawRoundedBox(marginX, 50, sideW, 22, { fill: WHITE, border: BLACK, borderWidth: 1 });
  drawCenterText(data.recipientName, marginX + sideW / 2, 64, 8.4, fontNexa, BLACK);

  // Center: Remixed Casegoods Logo
  const mainLogoH = 44;
  const mainLogoW = mainLogoH * (logoMain.width / logoMain.height);
  page.drawImage(logoMain, {
    x: 306 - mainLogoW / 2,
    y: py(27 + mainLogoH),
    width: mainLogoW,
    height: mainLogoH,
  });

  // Right: Invoice Number
  drawRoundedBox(marginX + contentW - sideW, 26, sideW, 20, {
    fill: BLACK,
    border: BLACK,
    borderWidth: 1,
  });
  drawCenterText('INVOICE', marginX + contentW - sideW / 2, 39, 7.8, fontNexa, WHITE);
  drawRoundedBox(marginX + contentW - sideW, 50, sideW, 22, {
    fill: WHITE,
    border: BLACK,
    borderWidth: 1,
  });
  drawCenterText(data.invoiceNumber, marginX + contentW - sideW / 2, 64, 8.4, fontNexa, BLACK);

  // Thin Black Divider Line
  page.drawLine({
    start: { x: marginX, y: py(82) },
    end: { x: marginX + contentW, y: py(82) },
    thickness: 1,
    color: BLACK,
  });

  // Project Title Bar & Scope Box
  drawRoundedBox(marginX, 92, contentW, 20, { fill: BLACK, border: BLACK, borderWidth: 1 });
  drawCenterText(data.projectTitle, 306, 105, 8.2, fontNexa, WHITE);

  drawRoundedBox(marginX, 117, contentW, 48, { fill: WHITE, border: BLACK, borderWidth: 1 });
  const scopeLines = wrapPdfLines(data.projectSummary, fontNexa, 7.6, contentW - 24, 3);
  scopeLines.forEach((line, idx) => {
    page.drawText(line, {
      x: marginX + 12,
      y: py(131 + idx * 11.8),
      size: 7.6,
      font: fontNexa,
      color: BLACK,
    });
  });

  // Budget Distribution Header & Pie Chart
  drawRoundedBox(marginX, 175, contentW, 20, { fill: BLACK, border: BLACK, borderWidth: 1 });
  drawCenterText('BUDGET DISTRIBUTION', 306, 188, 8.2, fontNexa, WHITE);

  const pieCx = 306;
  const pieCy = 292;
  const pieR = 68;

  summary.slices
    .filter((s) => s.endDeg - s.startDeg > 0.2)
    .forEach((s) => {
      const wedgePath = pieSliceBezierPath(pieCx, pieCy, pieR, s.startDeg, s.endDeg, 1);
      page.drawSvgPath(wedgePath, {
        x: 0,
        y: H,
        color: hexColorMap[s.colorHex] || BLACK,
        borderColor: WHITE,
        borderWidth: 2.5,
      });
    });

  const callouts = buildPieCallouts(pieCx, pieCy, pieR, summary.slices);
  callouts.forEach((c) => {
    page.drawSvgPath(c.leaderPath(1), {
      x: 0,
      y: H,
      borderColor: BLACK,
      borderWidth: 0.85,
    });
    drawCenterText(c.label, c.centerTextX, c.labelY, 7.8, fontNexa, BLACK);
    drawCenterText(c.percentText, c.centerTextX, c.pctY, 8.4, fontNexa, BLACK);
  });

  if (data.driveFolderUrl?.trim()) {
    const driveUrl = data.driveFolderUrl.trim();
    const folderTag = (data.driveFolderName || '').trim().toUpperCase();
    const clippedFolder =
      folderTag.length > 22 ? `${folderTag.slice(0, 21)}…` : folderTag;
    const qrSize = 64;
    const qrCenterX = 504;
    const qrX = qrCenterX - qrSize / 2;
    const qrY = 250;
    const totalBoxW = 104;
    const totalCenterX = 108;
    const totalX = totalCenterX - totalBoxW / 2;

    // Symmetrical Left Flank: Project Total Pill
    drawRoundedBox(totalX, 268, totalBoxW, 17, { fill: BLACK, border: BLACK, borderWidth: 1 });
    drawCenterText('PROJECT TOTAL', totalCenterX, 279, 6.5, fontNexa, WHITE);
    drawRoundedBox(totalX, 288, totalBoxW, 22, { fill: WHITE, border: BLACK, borderWidth: 1 });
    drawCenterText(
      formatCurrency(summary.totalAmount),
      totalCenterX,
      302.5,
      8.4,
      fontNexa,
      BLACK
    );

    // Symmetrical Right Flank: Casegoods-Styled Google Drive Folder QR
    drawCasegoodsQrPdf(page, H, driveUrl, qrX, qrY, qrSize, { frameStyle: 'cg-badge' });
    drawCenterText('PROJECT DRIVE FILES', qrCenterX, 325.5, 6.0, fontNexa, BLACK);
    if (clippedFolder) {
      drawCenterText(clippedFolder, qrCenterX, 335, 5.5, fontNexa, BLACK);
    }
  }

  // 4 Pillar Breakdown Sections (Cost centered next to title in each bubble)
  const pillarRows = [
    { slice: summary.slices[0], topY: 396, barH: 18, boxH: 44, maxLines: 3 },
    { slice: summary.slices[1], topY: 470, barH: 18, boxH: 36, maxLines: 2 },
    { slice: summary.slices[2], topY: 536, barH: 18, boxH: 48, maxLines: 3 },
    { slice: summary.slices[3], topY: 614, barH: 18, boxH: 26, maxLines: 1 },
  ];

  pillarRows.forEach((row) => {
    const fill = hexColorMap[row.slice.colorHex] || BLACK;
    drawRoundedBox(marginX, row.topY, contentW, row.barH, {
      fill,
      border: BLACK,
      borderWidth: 1,
    });
    const barTitleWithCost = `${row.slice.label}  ·  ${formatCurrency(row.slice.amount)}`;
    drawCenterText(barTitleWithCost, 306, row.topY + 12, 8.0, fontNexa, BLACK);

    const boxY = row.topY + row.barH + 4;
    drawRoundedBox(marginX, boxY, contentW, row.boxH, {
      fill: WHITE,
      border: BLACK,
      borderWidth: 1,
    });

    const descLines = wrapPdfLines(
      row.slice.description,
      fontNexa,
      7.5,
      contentW - 24,
      row.maxLines
    );
    const lineStartY =
      boxY + (descLines.length === 1 ? 16 : descLines.length === 2 ? 14.5 : 13.5);
    descLines.forEach((line, idx) => {
      page.drawText(line, {
        x: marginX + 12,
        y: py(lineStartY + idx * 11.5),
        size: 7.5,
        font: fontNexa,
        color: BLACK,
      });
    });
  });

  // Bottom 3-Zone Payment Footer
  const depositMethodUpper = data.depositMethodNote.trim()
    ? ` (${data.depositMethodNote.trim().toUpperCase()})`
    : '';
  const equationLine = `${formatCurrency(summary.totalAmount)} - ${formatCurrency(
    summary.depositAmount
  )}${depositMethodUpper}`;
  const resultLine = `= ${formatCurrency(summary.finalPayment)}`;

  // Left: Final Payment
  drawRoundedBox(marginX, 686, 160, 20, { fill: BLACK, border: BLACK, borderWidth: 1 });
  drawCenterText('FINAL PAYMENT', marginX + 80, 699, 7.8, fontNexa, WHITE);
  drawRoundedBox(marginX, 710, 160, 21, { fill: WHITE, border: BLACK, borderWidth: 1 });
  drawCenterText(equationLine, marginX + 80, 724, 7.5, fontNexa, BLACK);
  drawRoundedBox(marginX, 735, 160, 21, { fill: WHITE, border: BLACK, borderWidth: 1 });
  drawCenterText(resultLine, marginX + 80, 749, 8.6, fontNexa, BLACK);

  // Center: 4 Icons + Page Indicator
  const iconsH = 26;
  const iconsW = iconsH * (logoIcons.width / logoIcons.height);
  page.drawImage(logoIcons, {
    x: 306 - iconsW / 2,
    y: py(692 + iconsH),
    width: iconsW,
    height: iconsH,
  });
  drawRoundedBox(236, 735, 140, 21, { fill: BLACK, border: BLACK, borderWidth: 1 });
  drawCenterText(data.pageLabel, 306, 749, 8.2, fontNexa, WHITE);

  // Right: Deposit Required
  const yellow = hexColorMap['#FDCB33'];
  drawRoundedBox(marginX + contentW - 160, 686, 160, 20, {
    fill: BLACK,
    border: BLACK,
    borderWidth: 1,
  });
  drawCenterText('DEPOSIT REQUIRED', marginX + contentW - 80, 699, 7.8, fontNexa, WHITE);
  drawRoundedBox(marginX + contentW - 160, 710, 160, 21, {
    fill: WHITE,
    border: BLACK,
    borderWidth: 1,
  });
  drawCenterText(
    formatCurrency(summary.depositAmount),
    marginX + contentW - 80,
    724,
    8.4,
    fontNexa,
    BLACK
  );
  drawRoundedBox(marginX + contentW - 160, 735, 160, 21, {
    fill: yellow,
    border: BLACK,
    borderWidth: 1,
  });
  drawCenterText(data.depositStatus, marginX + contentW - 80, 749, 8.2, fontNexa, BLACK);

  return await pdfDoc.save();
}
