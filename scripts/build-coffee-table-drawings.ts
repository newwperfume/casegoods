import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  C,
  PAGE_W,
  PAGE_H,
  OUT_DIR,
  LOGO_FULL,
  LOGO_ICONS,
  FONT_NEXA,
  py,
  drawRoundedRect,
  drawTrackedText,
  drawCadLabel,
  drawSectionBadge,
  drawViewportCard,
  drawSheetChrome,
  drawSpecKeyCard,
  drawSectionCutLegend,
  line,
  rect,
  polygon,
  drawDimArrow,
  rasterizeSubmittalPdf,
  type ViewportCard,
} from './lib/cadSheetChrome.ts';

fs.mkdirSync(OUT_DIR, { recursive: true });

// =============================================================================
// WHITE OAK MORTISE & TENON COFFEE TABLE — EXACT GEOMETRY (INCHES)
// Verified against Rhino 3D Model (Untitled.PNG), Build Photos & Maker Specs
// =============================================================================
const DIM = {
  topL: 56.0,         // Overall tabletop length
  topW: 32.0,         // Overall tabletop width
  topThk: 1.5,        // Solid White Oak tabletop thickness (R 1/4" roundover all edges)
  totalH: 18.0,       // Overall table height
  baseH: 16.5,        // Floor to underside of tabletop
  baseL: 50.0,        // Outer-to-outer leg span (long side)
  baseW: 29.0,        // Outer-to-outer leg span (short side)
  legClearL: 47.0,    // Clear span between legs (long side)
  legClearW: 26.0,    // Clear span between leg shafts (short side)
  earSpanW: 23.0,     // Clear span between stepped L-leg upper ears (29 - 3 - 3 = 23")
  legEarW: 3.0,       // Stepped L-leg total upper width (1.5" shaft + 1.5" inward ear)
  legNotchH: 1.5,     // Outer corner shadow-gap step at top of each leg
  overhangL: 3.0,     // Tabletop overhang each short end
  overhangW: 1.5,     // Tabletop overhang each long side
  legSq: 1.5,         // 1.50" × 1.50" leg shaft cross-section
  glideH: 0.45,       // Adjustable leveling glide height
  endApronH: 3.0,     // 23.00" L × 3.00" H × 1.50" T short-end apron (twin doweled to L-legs)
  slatH: 1.5,         // Every rail & cross-slat: 1.50" tall
  slatW: 0.75,        // Every rail & cross-slat: 3/4" (0.75") wide
  tenonL: 0.5,        // 1/2" long tenon on each end of every slat
  tenonH: 1.0,        // 1" tall tenon (1/4" top & bottom shoulders)
  tenonW: 0.5,        // 1/2" wide tenon (1/8" cheek shoulders)
  roundoverR: 0.25,   // 1/4" roundover on EVERY exposed edge
  clearOpenH: 8.25,   // Clear vertical opening between upper rail & lower shelf
  shelfThk: 0.75,     // 0.75" corner-notched lower shelf (projects 0.50" past legs)
  shelfProj: 0.5,     // Shelf perimeter overhang past outer face of legs
  lowerRailH: 1.5,    // 1.50" tall lower rails & cross-slats
  floorClearH: 4.5,   // Floor to underside of lower rail
  upperSlats: 5,      // 5× upper cross-slats (1.5" H × 0.75" W w/ tenons)
  lowerSlats: 5,      // 5× lower cross-slats (1.5" H × 0.75" W w/ tenons)
};

/** Draw a CAD member with explicit 1/4" roundover corners & subtle edge tangent lines */
function drawRoundedMember(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  rPx: number,
  opts: {
    fill?: ReturnType<typeof rgb>;
    strokeWidth?: number;
    tangentInset?: number;
    horizontalTangents?: boolean;
    verticalTangents?: boolean;
  } = {}
) {
  const r = Math.min(rPx, w * 0.35, h * 0.35);
  drawRoundedRect(page, x, yTop, w, h, r, {
    fill: opts.fill ?? C.oakTint,
    borderColor: C.black,
    borderWidth: opts.strokeWidth ?? 0.95,
  });
  const t = opts.tangentInset ?? Math.max(1.2, r);
  if (opts.horizontalTangents && h > t * 2.4) {
    line(page, x + r, yTop + t, x + w - r, yTop + t, 0.32, C.inkLight);
    line(page, x + r, yTop + h - t, x + w - r, yTop + h - t, 0.32, C.inkLight);
  }
  if (opts.verticalTangents && w > t * 2.4) {
    line(page, x + t, yTop + r, x + t, yTop + h - r, 0.32, C.inkLight);
    line(page, x + w - t, yTop + r, x + w - t, yTop + h - r, 0.32, C.inkLight);
  }
}

/** Draw hidden mortise-and-tenon dashed box */
function drawHiddenMortise(page: PDFPage, x: number, yTop: number, w: number, h: number) {
  rect(page, x, yTop, w, h, {
    stroke: C.inkMid,
    strokeWidth: 0.48,
    dashArray: [2.2, 1.8],
  });
}

/** Draw adjustable steel leveling glide under a leg */
function drawLevelerGlide(page: PDFPage, cx: number, floorY: number, s: number) {
  const padW = 1.25 * s;
  const padH = DIM.glideH * s;
  drawRoundedRect(page, cx - padW / 2, floorY - padH, padW, padH, 1.2, {
    fill: C.steelTint,
    borderColor: C.black,
    borderWidth: 0.75,
  });
}

/** Draw an L-shaped stepped leg profile in Short-Side Elevation (left or right) */
function drawSteppedLegShortElev(
  page: PDFPage,
  outerX: number,
  topBotY: number,
  glideTopY: number,
  s: number,
  side: 'left' | 'right'
) {
  const legW = DIM.legSq * s;      // 1.50"
  const earW = DIM.legEarW * s;    // 3.00"
  const notchH = DIM.legNotchH * s;// 1.50"
  const earH = DIM.endApronH * s;  // 3.00"
  const r = Math.max(1.3, DIM.roundoverR * s);
  const dir = side === 'left' ? 1 : -1;

  // Points clockwise (for left leg; mirrored for right)
  const xOuter = outerX;
  const xShaftIn = outerX + dir * legW;
  const xEarIn = outerX + dir * earW;
  const yTop = topBotY;
  const yNotch = topBotY + notchH;
  const yEarBot = topBotY + earH;
  const yBot = glideTopY;

  const pts: Array<[number, number]> = [
    [xShaftIn, yTop],
    [xEarIn, yTop],
    [xEarIn, yEarBot],
    [xShaftIn, yEarBot],
    [xShaftIn, yBot],
    [xOuter, yBot],
    [xOuter, yNotch],
    [xShaftIn, yNotch],
  ];
  polygon(page, pts, { fill: C.oakTint, stroke: C.black, strokeWidth: 1.0 });

  // 1/4" roundover tangent lines along vertical leg shaft & stepped corner
  const t = Math.max(1.2, r);
  line(page, xOuter + dir * t, yNotch + t, xOuter + dir * t, yBot - t, 0.32, C.inkLight);
  line(page, xShaftIn - dir * t, yEarBot + t, xShaftIn - dir * t, yBot - t, 0.32, C.inkLight);
  line(page, xOuter + dir * t, yNotch + t, xShaftIn + dir * t, yNotch + t, 0.3, C.inkLight);
}

// =============================================================================
// SHEET A-101 — ELEVATIONS & ARCHITECTURAL SECTIONS
// =============================================================================

function drawShortSideElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const topW = DIM.topW * s;
  const baseW = DIM.baseW * s;
  const legW = DIM.legSq * s;
  const earW = DIM.legEarW * s;
  const r = Math.max(1.3, DIM.roundoverR * s);

  const xTop0 = box.innerX + (box.innerW - topW) / 2 + 8;
  const xBase0 = xTop0 + DIM.overhangW * s;
  const xBase1 = xBase0 + baseW;

  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const glideTopY = floorY - DIM.glideH * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;

  // Floor line
  line(page, xTop0 - 24, floorY, xTop0 + topW + 24, floorY, 1.4, C.black);

  // 1.50" Solid White Oak Tabletop with 1/4" roundover edges & tangent lines
  drawRoundedMember(page, xTop0, topY, topW, DIM.topThk * s, r, {
    strokeWidth: 1.05,
    horizontalTangents: true,
    verticalTangents: true,
  });

  // 23.00" × 3.00" Short-End Apron spanning cleanly between the two 3.00" stepped L-leg ears!
  drawRoundedMember(page, xBase0 + earW, topBotY, DIM.earSpanW * s, DIM.endApronH * s, r * 0.7, {
    strokeWidth: 0.95,
    horizontalTangents: true,
  });

  // Left & Right Stepped L-Shaped Legs (3.00" upper width -> 1.50" vertical shaft!)
  drawSteppedLegShortElev(page, xBase0, topBotY, glideTopY, s, 'left');
  drawSteppedLegShortElev(page, xBase1, topBotY, glideTopY, s, 'right');
  drawLevelerGlide(page, xBase0 + legW / 2, floorY, s);
  drawLevelerGlide(page, xBase1 - legW / 2, floorY, s);

  // Hidden twin floating dowels joining each stepped L-leg ear to the 23.00" short-end apron
  for (const dy of [0.85 * s, 2.05 * s]) {
    drawHiddenMortise(page, xBase0 + earW - 0.9 * s, topBotY + dy - 0.25 * s, 1.8 * s, 0.5 * s);
    drawHiddenMortise(page, xBase1 - earW - 0.9 * s, topBotY + dy - 0.25 * s, 1.8 * s, 0.5 * s);
  }
  // Hidden mortise pockets on back of end apron receiving the 2× long upper rails (1.5"×0.75" w/ 1"×1/2" tenons)
  drawHiddenMortise(page, xBase0 + earW + 0.35 * s, topBotY + 0.5 * s, DIM.tenonW * s, DIM.tenonH * s);
  drawHiddenMortise(page, xBase1 - earW - 0.85 * s, topBotY + 0.5 * s, DIM.tenonW * s, DIM.tenonH * s);

  // 0.75" Corner-notched lower shelf (projects 0.50" past outer leg faces, 1/4" roundover edges + 4 oak edge plugs)
  const shelfProj = DIM.shelfProj * s;
  // Left & right projecting ears outside legs + center span between legs
  drawRoundedMember(page, xBase0 - shelfProj, shelfTopY, shelfProj, DIM.shelfThk * s, r * 0.65, {
    strokeWidth: 0.9,
  });
  drawRoundedMember(page, xBase1, shelfTopY, shelfProj, DIM.shelfThk * s, r * 0.65, {
    strokeWidth: 0.9,
  });
  drawRoundedMember(page, xBase0 + legW, shelfTopY, DIM.legClearW * s, DIM.shelfThk * s, r * 0.65, {
    strokeWidth: 0.95,
    horizontalTangents: true,
  });
  for (let d = 0; d < 4; d++) {
    const dx = xBase0 + legW + (DIM.legClearW * s * (d + 0.5)) / 4;
    page.drawCircle({
      x: dx,
      y: py(shelfTopY + (DIM.shelfThk * s) / 2),
      size: 1.7,
      borderColor: C.inkMid,
      borderWidth: 0.6,
    });
  }

  // 1.50" Lower end slat spanning 26.00" between legs with 1/2"×1"×1/2" tenons into legs
  drawRoundedMember(page, xBase0 + legW, lowerRailTopY, DIM.legClearW * s, DIM.lowerRailH * s, r * 0.65, {
    strokeWidth: 0.95,
    horizontalTangents: true,
  });
  drawHiddenMortise(page, xBase0 + legW - DIM.tenonL * s, lowerRailTopY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);
  drawHiddenMortise(page, xBase1 - legW, lowerRailTopY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);

  // Section A cut datum
  const secAX = xTop0 + topW / 2;
  line(page, secAX, topY - 36, secAX, floorY + 14, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secAX, topY - 40, 10, 'A', C.orange);

  // Exact Dimensions (100% matching Untitled.PNG Short Side Elevation!)
  // 3.00" stepped leg ear width at top-left
  drawDimArrow(page, xBase0, topY - 26, xBase0 + earW, topY - 26);
  drawCadLabel(page, font, ['3.00"'], xBase0 + earW / 2, topY - 30, {
    size: 5.9,
    align: 'center',
    color: C.inkDark,
  });
  // 32.00" overall top width
  drawDimArrow(page, xTop0, topY - 12, xTop0 + topW, topY - 12);
  drawCadLabel(page, font, ['32.00" (R 1/4" ALL EDGES)'], xTop0 + topW / 2, topY - 16, {
    size: 6.0,
    align: 'center',
    color: C.inkDark,
  });
  // 18.00" overall height
  drawDimArrow(page, xTop0 - 16, topY, xTop0 - 16, floorY);
  drawCadLabel(page, font, ['18.00"'], xTop0 - 20, (topY + floorY) / 2, {
    size: 6.2,
    align: 'right',
    color: C.inkDark,
  });
  // 23.00" clear between stepped ears & 26.00" clear between leg shafts
  drawDimArrow(page, xBase0 + earW, topBotY + DIM.endApronH * s + 12, xBase1 - earW, topBotY + DIM.endApronH * s + 12);
  drawCadLabel(page, font, ['23.00" EAR CLEAR'], xTop0 + topW / 2, topBotY + DIM.endApronH * s + 9, {
    size: 5.7,
    align: 'center',
    color: C.inkDark,
  });
  drawDimArrow(page, xBase0 + legW, topBotY + DIM.endApronH * s + 26, xBase1 - legW, topBotY + DIM.endApronH * s + 26);
  drawCadLabel(page, font, ['26.00" LEG CLEAR'], xTop0 + topW / 2, topBotY + DIM.endApronH * s + 23, {
    size: 5.7,
    align: 'center',
    color: C.inkMid,
  });
  // 29.00" base width
  drawDimArrow(page, xBase0, floorY + 16, xBase1, floorY + 16);
  drawCadLabel(page, font, ['29.00" BASE'], xTop0 + topW / 2, floorY + 13, {
    size: 6.1,
    align: 'center',
    color: C.inkDark,
  });
}

function drawLongSideElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const topL = DIM.topL * s;
  const baseL = DIM.baseL * s;
  const legW = DIM.legSq * s;
  const r = Math.max(1.3, DIM.roundoverR * s);

  const xTop0 = box.innerX + (box.innerW - topL) / 2;
  const xBase0 = xTop0 + DIM.overhangL * s;
  const xBase1 = xBase0 + baseL;

  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const glideTopY = floorY - DIM.glideH * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;

  // Floor line
  line(page, xTop0 - 28, floorY, xTop0 + topL + 36, floorY, 1.4, C.black);

  // 56.00" × 1.50" Tabletop with 1/4" roundover edges & tangent lines
  drawRoundedMember(page, xTop0, topY, topL, DIM.topThk * s, r, {
    strokeWidth: 1.05,
    horizontalTangents: true,
    verticalTangents: true,
  });

  // 1.50" Long Upper Rail (recessed behind stepped leg ears, 47.00" between legs)
  drawRoundedMember(page, xBase0 + legW, topBotY, DIM.legClearL * s, DIM.slatH * s, r * 0.65, {
    strokeWidth: 0.95,
    horizontalTangents: true,
  });
  // Hidden 1" H × 1/2" W tenons of all 5× upper cross-slats
  for (let i = 1; i <= DIM.upperSlats; i++) {
    const sx = xBase0 + legW + (DIM.legClearL * s * i) / (DIM.upperSlats + 1);
    drawHiddenMortise(page, sx - (DIM.tenonW * s) / 2, topBotY + 0.25 * s, DIM.tenonW * s, DIM.tenonH * s);
  }

  // Left & Right Legs (1.50" wide, rising to underside of top with 1.50" stepped-ear line!)
  for (const lx of [xBase0, xBase1 - legW]) {
    drawRoundedMember(page, lx, topBotY, legW, glideTopY - topBotY, r * 0.75, {
      strokeWidth: 1.0,
      verticalTangents: true,
    });
    // Horizontal shoulder line showing the 1.50" outer notch step on the short side
    line(page, lx, topBotY + DIM.legNotchH * s, lx + legW, topBotY + DIM.legNotchH * s, 0.75, C.black);
    drawLevelerGlide(page, lx + legW / 2, floorY, s);
  }

  // 0.75" Lower shelf projecting 0.50" past legs on left & right ends
  const shelfProj = DIM.shelfProj * s;
  drawRoundedMember(page, xBase0 - shelfProj, shelfTopY, shelfProj, DIM.shelfThk * s, r * 0.65, { strokeWidth: 0.9 });
  drawRoundedMember(page, xBase1, shelfTopY, shelfProj, DIM.shelfThk * s, r * 0.65, { strokeWidth: 0.9 });
  drawRoundedMember(page, xBase0 + legW, shelfTopY, DIM.legClearL * s, DIM.shelfThk * s, r * 0.65, {
    strokeWidth: 0.95,
    horizontalTangents: true,
  });

  // 1.50" Lower long rail + hidden 1/2"×1"×1/2" tenons into legs & 5× lower cross-slats
  drawRoundedMember(page, xBase0 + legW, lowerRailTopY, DIM.legClearL * s, DIM.lowerRailH * s, r * 0.65, {
    strokeWidth: 0.95,
    horizontalTangents: true,
  });
  drawHiddenMortise(page, xBase0 + legW - DIM.tenonL * s, lowerRailTopY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);
  drawHiddenMortise(page, xBase1 - legW, lowerRailTopY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);
  for (let i = 1; i <= DIM.lowerSlats; i++) {
    const sx = xBase0 + legW + (DIM.legClearL * s * i) / (DIM.lowerSlats + 1);
    drawHiddenMortise(page, sx - (DIM.tenonW * s) / 2, lowerRailTopY + 0.25 * s, DIM.tenonW * s, DIM.tenonH * s);
  }

  // Section Cut B (Corner Leg) & Section Cut C (Center Cross-Slat)
  const secBX = xBase0 + legW * 0.5;
  const secCX = xTop0 + topL * 0.5;
  line(page, secBX, topY - 36, secBX, floorY + 14, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secBX, topY - 40, 10, 'B', C.cyan);

  line(page, secCX, topY - 36, secCX, floorY + 14, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secCX, topY - 40, 10, 'C', C.yellow);

  // Exact Dimensions (100% matching Untitled.PNG Long Side Elevation!)
  drawDimArrow(page, xTop0, topY - 14, xTop0 + topL, topY - 14);
  drawCadLabel(page, font, ['56.00" OVERALL LENGTH (R 1/4" ALL EDGES)'], xTop0 + topL / 2, topY - 18, {
    size: 6.4,
    align: 'center',
    color: C.inkDark,
  });
  drawDimArrow(page, xTop0 - 16, topBotY, xTop0 - 16, floorY);
  drawCadLabel(page, font, ['16.50"'], xTop0 - 20, (topBotY + floorY) / 2, {
    size: 6.1,
    align: 'right',
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['1.50"'], xTop0 - 20, topY + (DIM.topThk * s) / 2 + 2, {
    size: 5.9,
    align: 'right',
    color: C.inkDark,
  });
  drawDimArrow(page, xTop0 + topL + 16, topY, xTop0 + topL + 16, floorY);
  drawCadLabel(page, font, ['18.00"'], xTop0 + topL + 20, (topY + floorY) / 2, {
    size: 6.3,
    color: C.inkDark,
  });

  // Internal 8.25" clear opening & 47.00" clear between legs
  const openDimX = xBase1 - legW - 28;
  drawDimArrow(page, openDimX, topBotY + DIM.slatH * s, openDimX, shelfTopY);
  drawCadLabel(page, font, ['8.25" CLEAR'], openDimX - 5, (topBotY + DIM.slatH * s + shelfTopY) / 2 + 2, {
    size: 5.9,
    align: 'right',
    color: C.inkDark,
  });
  drawDimArrow(page, xBase0 + legW, topBotY + DIM.slatH * s + 14, xBase1 - legW, topBotY + DIM.slatH * s + 14);
  drawCadLabel(page, font, ['47.00" CLEAR BETWEEN LEGS · 5× UPPER & 5× LOWER SLATS (1.5"×0.75")'], xTop0 + topL / 2, topBotY + DIM.slatH * s + 10, {
    size: 5.7,
    align: 'center',
    color: C.inkMid,
  });

  // Bottom 50.00" base span & 4.50" floor clearance
  drawDimArrow(page, xBase0, floorY + 16, xBase1, floorY + 16);
  drawCadLabel(page, font, ['50.00" BASE SPAN · 4.50" FLOOR CLEAR · 0.75" SHELF'], xTop0 + topL / 2, floorY + 13, {
    size: 6.1,
    align: 'center',
    color: C.inkDark,
  });
}

function drawSectionALongitudinal(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const topL = DIM.topL * s;
  const baseL = DIM.baseL * s;
  const x0 = box.innerX + (box.innerW - topL) / 2;
  const xb0 = x0 + DIM.overhangL * s;
  const xb1 = xb0 + baseL;
  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;
  const r = Math.max(1.0, DIM.roundoverR * s);

  line(page, x0 - 12, floorY, x0 + topL + 12, floorY, 1.3, C.black);
  drawRoundedMember(page, x0, topY, topL, DIM.topThk * s, r, { strokeWidth: 0.95 });
  // 2× 3.00" end aprons cut
  drawRoundedMember(page, xb0, topBotY, DIM.legSq * s, DIM.endApronH * s, r * 0.6, { fill: C.wallFill, strokeWidth: 0.85 });
  drawRoundedMember(page, xb1 - DIM.legSq * s, topBotY, DIM.legSq * s, DIM.endApronH * s, r * 0.6, { fill: C.wallFill, strokeWidth: 0.85 });

  // 5× Upper slats (1.50" H × 0.75" W) in section
  const span = baseL - DIM.legSq * 2 * s;
  for (let i = 1; i <= DIM.upperSlats; i++) {
    const sx = xb0 + DIM.legSq * s + (span * i) / (DIM.upperSlats + 1);
    drawRoundedMember(page, sx - (DIM.slatW * s) / 2, topBotY, DIM.slatW * s, DIM.slatH * s, r * 0.5, {
      fill: C.wallFill,
      strokeWidth: 0.8,
    });
  }
  // 0.75" Lower shelf + 5× Lower slats (1.50" H × 0.75" W) in section
  drawRoundedMember(page, xb0 - DIM.shelfProj * s, shelfTopY, baseL + DIM.shelfProj * 2 * s, DIM.shelfThk * s, r * 0.6, {
    strokeWidth: 0.9,
  });
  for (let i = 1; i <= DIM.lowerSlats; i++) {
    const sx = xb0 + DIM.legSq * s + (span * i) / (DIM.lowerSlats + 1);
    drawRoundedMember(page, sx - (DIM.slatW * s) / 2, lowerRailTopY, DIM.slatW * s, DIM.lowerRailH * s, r * 0.5, {
      fill: C.wallFill,
      strokeWidth: 0.8,
    });
  }

  drawCadLabel(
    page,
    font,
    ['5× UPPER SLATS (1.5" H × 3/4" W)', '0.75" OVERHANGING LOWER SHELF', '5× LOWER SLATS (1.5" H × 3/4" W)'],
    x0 + topL / 2,
    topY - 38,
    { size: 6.0, align: 'center', color: C.inkMid }
  );
}

function drawSectionBSteppedLeg(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const xOuter = box.innerX + 46;
  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const glideTopY = floorY - DIM.glideH * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;
  const r = Math.max(1.2, DIM.roundoverR * s);

  line(page, xOuter - 20, floorY, xOuter + 145, floorY, 1.3, C.black);
  drawRoundedMember(page, xOuter - DIM.overhangW * s, topY, 96, DIM.topThk * s, r, {
    strokeWidth: 0.95,
    horizontalTangents: true,
  });

  // True Stepped L-Leg (3.00" ear width at top, 1.50" outer notch!)
  drawSteppedLegShortElev(page, xOuter, topBotY, glideTopY, s, 'left');
  drawLevelerGlide(page, xOuter + (DIM.legSq * s) / 2, floorY, s);

  // 3.00" end apron + twin dowels
  const earX = xOuter + DIM.legEarW * s;
  drawRoundedMember(page, earX, topBotY, 44, DIM.endApronH * s, r * 0.65, { strokeWidth: 0.9 });
  for (const dy of [0.85 * s, 2.05 * s]) {
    drawHiddenMortise(page, earX - 0.85 * s, topBotY + dy - 0.25 * s, 1.7 * s, 0.5 * s);
  }

  // Lower shelf + lower rail tenon
  drawRoundedMember(page, xOuter - DIM.shelfProj * s, shelfTopY, DIM.shelfProj * s, DIM.shelfThk * s, r * 0.6, { strokeWidth: 0.85 });
  drawRoundedMember(page, xOuter + DIM.legSq * s, shelfTopY, 56, DIM.shelfThk * s, r * 0.6, { strokeWidth: 0.9 });
  drawRoundedMember(page, xOuter + DIM.legSq * s, lowerRailTopY, 56, DIM.lowerRailH * s, r * 0.6, { strokeWidth: 0.9 });
  drawHiddenMortise(page, xOuter + (DIM.legSq - DIM.tenonL) * s, lowerRailTopY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);

  drawCadLabel(
    page,
    font,
    ['STEPPED L-LEG', '(3.00" TOP EAR)', 'TWIN DOWEL JOINT', '1/4" ROUNDOVERS'],
    earX + 66,
    topY + 8,
    { size: 5.8, color: C.inkMid }
  );
  drawCadLabel(
    page,
    font,
    ['1/2"×1"×1/2" TENON', '4.50" FLOOR CLEAR'],
    earX + 66,
    lowerRailTopY + 2,
    { size: 5.8, color: C.inkMid }
  );
}

function drawSectionCTransverse(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const topW = DIM.topW * s;
  const baseW = DIM.baseW * s;
  const x0 = box.innerX + (box.innerW - topW) / 2;
  const xb0 = x0 + DIM.overhangW * s;
  const xb1 = xb0 + baseW;
  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;
  const r = Math.max(1.1, DIM.roundoverR * s);

  line(page, x0 - 14, floorY, x0 + topW + 14, floorY, 1.3, C.black);
  drawRoundedMember(page, x0, topY, topW, DIM.topThk * s, r, { strokeWidth: 0.95, horizontalTangents: true });

  // 2× Long upper rails (0.75" wide × 1.50" tall) + 1.50"×0.75" cross-slat w/ 1/2"×1"×1/2" tenons!
  const railW = DIM.slatW * s;
  const inX0 = xb0 + DIM.legEarW * s;
  const inX1 = xb1 - DIM.legEarW * s;
  drawRoundedMember(page, inX0, topBotY, railW, DIM.slatH * s, r * 0.5, { fill: C.wallFill, strokeWidth: 0.85 });
  drawRoundedMember(page, inX1 - railW, topBotY, railW, DIM.slatH * s, r * 0.5, { fill: C.wallFill, strokeWidth: 0.85 });
  drawRoundedMember(page, inX0 + railW, topBotY, inX1 - inX0 - railW * 2, DIM.slatH * s, r * 0.5, { strokeWidth: 0.85 });
  drawHiddenMortise(page, inX0 + railW - DIM.tenonL * s, topBotY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);
  drawHiddenMortise(page, inX1 - railW, topBotY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);

  // Lower shelf + lower long rails + lower cross-slat w/ tenons
  drawRoundedMember(page, xb0 - DIM.shelfProj * s, shelfTopY, baseW + DIM.shelfProj * 2 * s, DIM.shelfThk * s, r * 0.6, {
    strokeWidth: 0.9,
  });
  const loX0 = xb0 + DIM.legSq * s;
  const loX1 = xb1 - DIM.legSq * s;
  drawRoundedMember(page, loX0, lowerRailTopY, railW, DIM.lowerRailH * s, r * 0.5, { fill: C.wallFill, strokeWidth: 0.85 });
  drawRoundedMember(page, loX1 - railW, lowerRailTopY, railW, DIM.lowerRailH * s, r * 0.5, { fill: C.wallFill, strokeWidth: 0.85 });
  drawRoundedMember(page, loX0 + railW, lowerRailTopY, loX1 - loX0 - railW * 2, DIM.lowerRailH * s, r * 0.5, {
    strokeWidth: 0.85,
  });
  drawHiddenMortise(page, loX0 + railW - DIM.tenonL * s, lowerRailTopY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);
  drawHiddenMortise(page, loX1 - railW, lowerRailTopY + 0.25 * s, DIM.tenonL * s, DIM.tenonH * s);

  drawCadLabel(
    page,
    font,
    ['SLAT: 1.5" H × 3/4" W', 'TENON: 1/2" L × 1" H × 1/2" W', '8.25" CLEAR OPENING'],
    x0 + topW / 2,
    topY - 38,
    { size: 6.0, align: 'center', color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-102 — STRUCTURAL SUB-FRAME PLAN & EXPLODED PART DRAWING
// =============================================================================

function drawCoffeeTablePlan(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = 8.1;
  const topL = DIM.topL * s;
  const topW = DIM.topW * s;
  const baseL = DIM.baseL * s;
  const baseW = DIM.baseW * s;
  const legW = DIM.legSq * s;
  const earW = DIM.legEarW * s;
  const slatW = DIM.slatW * s;

  const x0 = box.innerX + (box.innerW - topL) / 2;
  const y0 = box.innerYTop + (box.innerH - topW) / 2 - 4;
  const xb0 = x0 + DIM.overhangL * s;
  const yb0 = y0 + DIM.overhangW * s;

  // Dashed 56.00" × 32.00" tabletop perimeter + 1/4" roundover inner tangent line
  drawRoundedRect(page, x0, y0, topL, topW, Math.max(2, DIM.roundoverR * s), {
    fill: C.white,
    borderColor: C.inkMid,
    borderWidth: 0.9,
  });
  drawRoundedRect(page, x0 + 2, y0 + 2, topL - 4, topW - 4, Math.max(1.2, DIM.roundoverR * s * 0.6), {
    borderColor: C.inkFaint,
    borderWidth: 0.4,
  });

  // Lower overhanging shelf (subtle fill)
  const sp = DIM.shelfProj * s;
  drawRoundedRect(page, xb0 - sp, yb0 - sp, baseL + sp * 2, baseW + sp * 2, 2, {
    fill: C.oakTint,
    borderColor: C.inkLight,
    borderWidth: 0.65,
  });

  // 4× Stepped L-Legs (1.50" × 3.00" upper ear footprint at each corner!)
  const legEars: Array<[number, number]> = [
    [xb0, yb0],
    [xb0 + baseL - legW, yb0],
    [xb0, yb0 + baseW - earW],
    [xb0 + baseL - legW, yb0 + baseW - earW],
  ];
  for (const [lx, ly] of legEars) {
    rect(page, lx, ly, legW, earW, { fill: C.wallFill, stroke: C.black, strokeWidth: 1.0 });
  }

  // 2× Short-end 3.00" aprons (23.00" long between stepped leg ears)
  rect(page, xb0, yb0 + earW, legW, DIM.earSpanW * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
  rect(page, xb0 + baseL - legW, yb0 + earW, legW, DIM.earSpanW * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });

  // 2× Long Upper Rails (0.75" wide, aligned inside stepped ears)
  const uRailTopY = yb0 + earW;
  const uRailBotY = yb0 + baseW - earW - slatW;
  rect(page, xb0 + legW, uRailTopY, DIM.legClearL * s, slatW, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.9 });
  rect(page, xb0 + legW, uRailBotY, DIM.legClearL * s, slatW, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.9 });

  // 5× Upper Cross-Slats (0.75" wide) w/ 1/2" × 1/2" tenons entering long rails!
  const clearL = DIM.legClearL * s;
  const innerSpanY = uRailBotY - (uRailTopY + slatW);
  for (let i = 1; i <= DIM.upperSlats; i++) {
    const sx = xb0 + legW + (clearL * i) / (DIM.upperSlats + 1) - slatW / 2;
    rect(page, sx, uRailTopY + slatW, slatW, innerSpanY, { fill: C.white, stroke: C.black, strokeWidth: 0.85 });
    // 1/2" L × 1/2" W tenons dashed inside long rails
    drawHiddenMortise(page, sx + (slatW - DIM.tenonW * s) / 2, uRailTopY + slatW - DIM.tenonL * s, DIM.tenonW * s, DIM.tenonL * s);
    drawHiddenMortise(page, sx + (slatW - DIM.tenonW * s) / 2, uRailBotY, DIM.tenonW * s, DIM.tenonL * s);
  }

  // 5× Lower Cross-Slats (dashed beneath shelf)
  for (let i = 1; i <= DIM.lowerSlats; i++) {
    const sx = xb0 + legW + (clearL * i) / (DIM.lowerSlats + 1) - slatW / 2;
    rect(page, sx, yb0 + legW, slatW, baseW - legW * 2, {
      stroke: C.inkMid,
      strokeWidth: 0.55,
      dashArray: [2.5, 2.5],
    });
  }

  // Section Cut markers A, B, C
  drawSectionBadge(page, font, x0 - 22, y0 + topW / 2, 10, 'A', C.orange);
  line(page, x0 - 11, y0 + topW / 2, x0 + topL + 14, y0 + topW / 2, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, xb0 + legW / 2, y0 - 24, 10, 'B', C.cyan);
  line(page, xb0 + legW / 2, y0 - 13, xb0 + legW / 2, y0 + topW + 16, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, x0 + topL / 2, y0 - 24, 10, 'C', C.yellow);
  line(page, x0 + topL / 2, y0 - 13, x0 + topL / 2, y0 + topW + 16, 0.6, C.inkMid, [4, 3]);

  drawDimArrow(page, x0, y0 - 44, x0 + topL, y0 - 44);
  drawCadLabel(page, font, ['56.00" × 32.00" TOP · 50.00" × 29.00" BASE · R 1/4" ALL EDGES'], x0 + topL / 2, y0 - 48, {
    size: 6.1,
    align: 'center',
    color: C.inkDark,
  });
  drawCadLabel(
    page,
    font,
    ['5× UPPER & 5× LOWER SLATS (1.50" H × 0.75" W) W/ 1/2" × 1" × 1/2" TENONS'],
    x0 + topL / 2,
    y0 + topW + 28,
    { size: 5.9, align: 'center', color: C.inkMid }
  );
}

/**
 * High-detail Exploded Part Drawing on Sheet A-102.
 * Uses a clean low-angle architectural axonometric (matching Untitled.PNG's Exploded Perspective)
 * so every exploded layer, stepped L-leg, twin dowel, corner-notched shelf, and 1/2"×1"×1/2" tenon
 * is 100% unobstructed and crystal clear.
 */
function drawExplodedPartDrawingA102(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Clean low-angle axonometric: X goes right-and-slightly-down, Y goes left-and-down, Z goes straight up
  const sc = 6.75;
  const ox = box.innerX + box.innerW * 0.415;
  const oy = box.innerYTop + box.innerH * 0.515;

  // Low-elevation projection vectors (shows vertical faces & under-table structure cleanly!)
  const vxX = 0.88;
  const vxY = 0.24;
  const vyX = -0.58;
  const vyY = 0.30;

  const p3 = (x: number, y: number, z: number): [number, number] => [
    ox + (x * vxX + y * vyX) * sc,
    oy + (x * vxY + y * vyY - z) * sc,
  ];

  // Subtle 3-tone architectural shading so top, front, and side faces read immediately
  const shadeTop = C.white;
  const shadeFront = C.oakTint;
  const shadeSide = C.walnutTint;

  /** Draw a 3D rectangular prism with optional 1/4" roundover edge lines */
  const drawBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    opts: { top?: ReturnType<typeof rgb>; front?: ReturnType<typeof rgb>; side?: ReturnType<typeof rgb>; sw?: number; roundover?: boolean } = {}
  ) => {
    const sw = opts.sw ?? 0.78;
    // Front face (y = y + d)
    polygon(page, [p3(x, y + d, z), p3(x + w, y + d, z), p3(x + w, y + d, z + h), p3(x, y + d, z + h)], {
      fill: opts.front ?? shadeFront,
      stroke: C.black,
      strokeWidth: sw,
    });
    // Right face (x = x + w)
    polygon(page, [p3(x + w, y, z), p3(x + w, y + d, z), p3(x + w, y + d, z + h), p3(x + w, y, z + h)], {
      fill: opts.side ?? shadeSide,
      stroke: C.black,
      strokeWidth: sw,
    });
    // Top face (z = z + h)
    polygon(page, [p3(x, y, z + h), p3(x + w, y, z + h), p3(x + w, y + d, z + h), p3(x, y + d, z + h)], {
      fill: opts.top ?? shadeTop,
      stroke: C.black,
      strokeWidth: sw,
    });
    if (opts.roundover && w > 1 && d > 1) {
      const r = 0.25;
      // Top surface 1/4" roundover tangent line
      polygon(page, [p3(x + r, y + r, z + h), p3(x + w - r, y + r, z + h), p3(x + w - r, y + d - r, z + h), p3(x + r, y + d - r, z + h)], {
        stroke: C.inkLight,
        strokeWidth: 0.35,
      });
      if (h >= 0.75) {
        line(page, ...p3(x, y + d, z + h - r), ...p3(x + w, y + d, z + h - r), 0.32, C.inkLight);
        line(page, ...p3(x + w, y, z + h - r), ...p3(x + w, y + d, z + h - r), 0.32, C.inkLight);
      }
    }
  };

  /** Draw a true 12-vertex corner-notched 0.75" lower shelf slab */
  const drawNotchedShelf = (x0: number, y0: number, z: number, lenX: number, lenY: number, thk: number, notch = 1.7) => {
    // 12-point perimeter (notched at all 4 corners around the 1.5" legs)
    const pts2d: Array<[number, number]> = [
      [x0 + notch, y0],
      [x0 + lenX - notch, y0],
      [x0 + lenX - notch, y0 + notch],
      [x0 + lenX, y0 + notch],
      [x0 + lenX, y0 + lenY - notch],
      [x0 + lenX - notch, y0 + lenY - notch],
      [x0 + lenX - notch, y0 + lenY],
      [x0 + notch, y0 + lenY],
      [x0 + notch, y0 + lenY - notch],
      [x0, y0 + lenY - notch],
      [x0, y0 + notch],
      [x0 + notch, y0 + notch],
    ];
    // Visible front & right vertical thickness skirts
    const skirtEdges: Array<[number, number]> = [
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
    ];
    for (const [a, b] of skirtEdges) {
      const [ax, ay] = pts2d[a];
      const [bx, by] = pts2d[b];
      polygon(page, [p3(ax, ay, z), p3(bx, by, z), p3(bx, by, z + thk), p3(ax, ay, z + thk)], {
        fill: a === 3 ? shadeSide : shadeFront,
        stroke: C.black,
        strokeWidth: 0.72,
      });
    }
    // Top face of notched shelf
    polygon(
      page,
      pts2d.map(([px, pyv]) => p3(px, pyv, z + thk)),
      { fill: shadeTop, stroke: C.black, strokeWidth: 0.85 }
    );
  };

  /** Draw a 1.50" H × 0.75" W cross-slat along Y with crisp 1/2" L × 1" H × 1/2" W tenons on BOTH ends */
  const drawSlatY = (x: number, y0: number, lenY: number, z: number) => {
    // Back tenon (1/2" L × 1" H × 1/2" W)
    drawBox(x + 0.125, y0 - 0.5, z + 0.25, 0.5, 0.5, 1.0, { top: C.white, front: C.white, side: C.wallFill, sw: 0.58 });
    // Main slat body (0.75" W × lenY × 1.50" H)
    drawBox(x, y0, z, 0.75, lenY, 1.5, { sw: 0.72 });
    // Front tenon (1/2" L × 1" H × 1/2" W)
    drawBox(x + 0.125, y0 + lenY, z + 0.25, 0.5, 0.5, 1.0, { top: C.white, front: C.white, side: C.wallFill, sw: 0.58 });
  };

  /** Draw a 1.50" H × 0.75" W long rail along X with end tenons & 5× inner mortise slots */
  const drawLongRailX = (x0: number, lenX: number, y: number, z: number, showMortisesOnFront = false) => {
    drawBox(x0 - 0.5, y + 0.125, z + 0.25, 0.5, 0.5, 1.0, { top: C.white, front: C.white, side: C.wallFill, sw: 0.58 });
    drawBox(x0, y, z, lenX, 0.75, 1.5, { sw: 0.78 });
    drawBox(x0 + lenX, y + 0.125, z + 0.25, 0.5, 0.5, 1.0, { top: C.white, front: C.white, side: C.wallFill, sw: 0.58 });
    if (showMortisesOnFront) {
      for (let i = 1; i <= 5; i++) {
        const mx = x0 + (lenX * i) / 6 - 0.25;
        polygon(
          page,
          [p3(mx, y + 0.75, z + 0.25), p3(mx + 0.5, y + 0.75, z + 0.25), p3(mx + 0.5, y + 0.75, z + 1.25), p3(mx, y + 0.75, z + 1.25)],
          { fill: C.inkMid, stroke: C.black, strokeWidth: 0.45 }
        );
      }
    }
  };

  /** Draw an authentic Stepped L-Shaped Leg (1.5" shaft + 3.0" upper ear + lower mortise slot) */
  const drawSteppedLeg = (x: number, yOuter: number, zBase: number, earDirY: 1 | -1) => {
    // Draw back part first for painter's order
    const yEar = earDirY === 1 ? yOuter + 1.5 : yOuter - 1.5;
    if (earDirY === -1) {
      // Back ear first, then front shaft
      drawBox(x, yEar, zBase + 12.0, 1.5, 1.5, 3.0, { sw: 0.85 });
      drawBox(x, yOuter, zBase, 1.5, 1.5, 13.5, { sw: 0.85 });
    } else {
      // Back shaft first, then front ear
      drawBox(x, yOuter, zBase, 1.5, 1.5, 13.5, { sw: 0.85 });
      drawBox(x, yEar, zBase + 12.0, 1.5, 1.5, 3.0, { sw: 0.85 });
    }
    // Lower rail mortise slot on inside face
    polygon(
      page,
      [p3(x + 1.5, yOuter + 0.5, zBase + 4.3), p3(x + 1.5, yOuter + 1.0, zBase + 4.3), p3(x + 1.5, yOuter + 1.0, zBase + 5.3), p3(x + 1.5, yOuter + 0.5, zBase + 5.3)],
      { fill: C.inkMid, stroke: C.black, strokeWidth: 0.45 }
    );
  };

  // =========================================================================
  // BACK-TO-FRONT PAINTER'S ORDER EXPLODED ASSEMBLY
  // =========================================================================

  // 1. Back-Left & Back-Right Stepped L-Legs (exploded left x=-9 and right x=67.5)
  drawSteppedLeg(-9, 1.5, -5, 1);
  drawBox(-8.8, 1.7, -9.2, 1.1, 1.1, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.6 });
  line(page, ...p3(-8.25, 2.25, -8.7), ...p3(-8.25, 2.25, -5.2), 0.45, C.inkLight, [2, 2]);

  drawSteppedLeg(67.5, 1.5, -5, 1);
  drawBox(67.7, 1.7, -9.2, 1.1, 1.1, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.6 });
  line(page, ...p3(68.25, 2.25, -8.7), ...p3(68.25, 2.25, -5.2), 0.45, C.inkLight, [2, 2]);

  // 2. Lower Ladder Frame (z = -12): back rail, 5× tenoned slats, front rail pushed slightly forward (+3.5 in Y)
  drawLongRailX(4.5, 47, 0.0, -12, true);
  for (let i = 1; i <= 5; i++) {
    const sx = 4.5 + (47 * i) / 6 - 0.375;
    drawSlatY(sx, 3.0, 24.5, -12);
  }
  drawLongRailX(4.5, 47, 31.5, -12, false);

  // 3. 0.75" Corner-Notched Lower Shelf (z = 0)
  drawNotchedShelf(3.0, 1.0, 0, 50.0, 30.0, 0.75, 1.75);

  // 4. Left 23" × 3" End Apron + Twin Floating Dowels (exploded at x=-3.5)
  drawBox(-3.5, 4.5, 7.0, 1.5, 23.0, 3.0, { sw: 0.85, roundover: true });
  for (const dz of [7.9, 9.1]) {
    line(page, ...p3(-7.4, 4.5, dz), ...p3(-3.8, 4.5, dz), 1.35, C.black);
    line(page, ...p3(-7.4, 27.5, dz), ...p3(-3.8, 27.5, dz), 1.35, C.black);
  }

  // 5. Upper Ladder Frame (z = 12): back rail (y=2.5), 5× tenoned slats (y=5.5..24.5), front rail (y=28.5)
  drawLongRailX(4.5, 47, 2.5, 12, true);
  for (let i = 1; i <= 5; i++) {
    const sx = 4.5 + (47 * i) / 6 - 0.375;
    drawSlatY(sx, 5.5, 19.0, 12);
  }
  drawLongRailX(4.5, 47, 28.5, 12, false);

  // 6. Right 3.00" End Apron + Twin Floating Dowels (exploded cleanly past right shelf edge at x=61.5)
  drawBox(61.5, 4.5, 7.0, 1.5, 23.0, 3.0, { sw: 0.85, roundover: true });
  for (const dz of [7.9, 9.1]) {
    line(page, ...p3(63.3, 4.5, dz), ...p3(67.1, 4.5, dz), 1.35, C.black);
    line(page, ...p3(63.3, 27.5, dz), ...p3(67.1, 27.5, dz), 1.35, C.black);
  }

  // 7. Front-Left & Front-Right Stepped L-Legs + Leveling Glides
  drawSteppedLeg(-9, 29.0, -5, -1);
  drawBox(-8.8, 29.2, -9.2, 1.1, 1.1, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.6 });
  line(page, ...p3(-8.25, 29.75, -8.7), ...p3(-8.25, 29.75, -5.2), 0.45, C.inkLight, [2, 2]);

  drawSteppedLeg(67.5, 29.0, -5, -1);
  drawBox(67.7, 29.2, -9.2, 1.1, 1.1, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.6 });
  line(page, ...p3(68.25, 29.75, -8.7), ...p3(68.25, 29.75, -5.2), 0.45, C.inkLight, [2, 2]);

  // 8. Lifted 56.00" × 32.00" × 1.50" Solid White Oak Tabletop (z = 27) w/ 1/4" Roundover Tangent Lines
  drawBox(0, 0, 27, 56, 32, 1.5, { sw: 1.0, roundover: true });

  // Clean Leader-Lined Part Callouts!
  const callout = (lines: string[], tx: number, ty: number, px: number, pyv: number, align: 'left' | 'right' = 'left') => {
    drawCadLabel(page, font, lines, tx, ty, { size: 6.0, align, color: C.inkDark });
    const startX = align === 'left' ? tx + 132 : tx - 132;
    line(page, startX, ty - 2, px, pyv, 0.45, C.inkLight);
    page.drawCircle({ x: px, y: py(pyv), size: 1.8, color: C.black });
  };

  callout(['01 · 1.50" OAK TOP (R 1/4" EDGES)'], box.innerX + 18, box.innerYTop + 42, ...p3(6, 12, 28.5), 'left');
  callout(['02 · UPPER LADDER FRAME', '     5× SLATS (1.5"×3/4") W/ TENONS'], box.innerX + 18, box.innerYTop + 134, ...p3(12, 18, 13.5), 'left');
  callout(['03 · 0.75" CORNER-NOTCHED SHELF'], box.innerX + 18, box.innerYTop + 236, ...p3(12, 18, 0.75), 'left');
  callout(['04 · LOWER LADDER FRAME', '     5× SLATS (1.5"×3/4") W/ TENONS'], box.innerX + 18, box.innerYTop + 378, ...p3(14, 31.5, -11.2), 'left');

  drawCadLabel(
    page,
    font,
    ['05 · 4× STEPPED L-LEGS (3.00" EAR)', '06 · 2× 3.00" APRONS + TWIN DOWELS', '07 · 4× ADJUSTABLE LEVELING GLIDES'],
    box.innerX + box.innerW - 18,
    box.innerYTop + 576,
    { size: 6.0, align: 'right', color: C.inkDark }
  );
}

// =============================================================================
// SHEET A-103 — HIGH-DETAIL ASSEMBLED ISOMETRIC & 1:1 JOINERY DETAILS
// =============================================================================

function drawAssembledIsometricA103(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Low-angle architectural 3/4 view matching Untitled.PNG Perspective & IMG_2954.jpg!
  // Shows tabletop 1/4" roundover edges, stepped L-leg floating corner reveals, end apron,
  // corner-notched overhanging shelf with edge dowels, lower rails, and leveling glides.
  const sc = 6.45;
  const ox = box.innerX + box.innerW * 0.44;
  const oy = box.innerYTop + box.innerH * 0.47;

  const vxX = 0.88;
  const vxY = 0.22;
  const vyX = -0.58;
  const vyY = 0.28;

  const p3 = (x: number, y: number, z: number): [number, number] => [
    ox + (x * vxX + y * vyX) * sc,
    oy + (x * vxY + y * vyY - z) * sc,
  ];

  const shadeTop = C.white;
  const shadeFront = C.oakTint;
  const shadeSide = C.walnutTint;

  const drawBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    opts: { top?: ReturnType<typeof rgb>; front?: ReturnType<typeof rgb>; side?: ReturnType<typeof rgb>; sw?: number; roundover?: boolean } = {}
  ) => {
    const sw = opts.sw ?? 0.82;
    polygon(page, [p3(x, y + d, z), p3(x + w, y + d, z), p3(x + w, y + d, z + h), p3(x, y + d, z + h)], {
      fill: opts.front ?? shadeFront,
      stroke: C.black,
      strokeWidth: sw,
    });
    polygon(page, [p3(x + w, y, z), p3(x + w, y + d, z), p3(x + w, y + d, z + h), p3(x + w, y, z + h)], {
      fill: opts.side ?? shadeSide,
      stroke: C.black,
      strokeWidth: sw,
    });
    polygon(page, [p3(x, y, z + h), p3(x + w, y, z + h), p3(x + w, y + d, z + h), p3(x, y + d, z + h)], {
      fill: opts.top ?? shadeTop,
      stroke: C.black,
      strokeWidth: sw,
    });
    if (opts.roundover && w > 1 && d > 1) {
      const r = 0.25;
      polygon(page, [p3(x + r, y + r, z + h), p3(x + w - r, y + r, z + h), p3(x + w - r, y + d - r, z + h), p3(x + r, y + d - r, z + h)], {
        stroke: C.inkLight,
        strokeWidth: 0.38,
      });
      if (h >= 0.75) {
        line(page, ...p3(x, y + d, z + h - r), ...p3(x + w, y + d, z + h - r), 0.34, C.inkLight);
        line(page, ...p3(x, y + d, z + r), ...p3(x + w, y + d, z + r), 0.34, C.inkLight);
        line(page, ...p3(x + w, y, z + h - r), ...p3(x + w, y + d, z + h - r), 0.34, C.inkLight);
        line(page, ...p3(x + w, y, z + r), ...p3(x + w, y + d, z + r), 0.34, C.inkLight);
      }
    }
  };

  // 1. Back-left & Back-right legs + glides
  drawBox(3.15, 1.65, 0, 1.2, 1.2, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.65 });
  drawBox(3, 1.5, 0.45, 1.5, 1.5, 14.55);
  drawBox(51.65, 1.65, 0, 1.2, 1.2, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.65 });
  drawBox(51.5, 1.5, 0.45, 1.5, 1.5, 14.55);
  drawBox(51.5, 3.0, 13.5, 1.5, 1.5, 3.0);

  // 2. Lower sub-frame rails (z: 4.5..6.0)
  drawBox(4.5, 29.0, 4.5, 47.0, 0.75, 1.5);
  drawBox(51.5, 3.0, 4.5, 0.75, 26.0, 1.5);

  // 3. True 12-vertex Corner-Notched Overhanging 0.75" Lower Shelf (z: 6.0..6.75)
  const sx0 = 2.5;
  const sy0 = 1.0;
  const slx = 51.0;
  const sly = 30.0;
  const n = 2.0;
  const sPts: Array<[number, number]> = [
    [sx0 + n, sy0],
    [sx0 + slx - n, sy0],
    [sx0 + slx - n, sy0 + n],
    [sx0 + slx, sy0 + n],
    [sx0 + slx, sy0 + sly - n],
    [sx0 + slx - n, sy0 + sly - n],
    [sx0 + slx - n, sy0 + sly],
    [sx0 + n, sy0 + sly],
    [sx0 + n, sy0 + sly - n],
    [sx0, sy0 + sly - n],
    [sx0, sy0 + n],
    [sx0 + n, sy0 + n],
  ];
  for (const [a, b] of [
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [8, 9],
  ]) {
    const [ax, ay] = sPts[a];
    const [bx, by] = sPts[b];
    polygon(page, [p3(ax, ay, 6.0), p3(bx, by, 6.0), p3(bx, by, 6.75), p3(ax, ay, 6.75)], {
      fill: a === 3 ? shadeSide : shadeFront,
      stroke: C.black,
      strokeWidth: 0.78,
    });
  }
  polygon(
    page,
    sPts.map(([px, pyv]) => p3(px, pyv, 6.75)),
    { fill: shadeTop, stroke: C.black, strokeWidth: 0.88 }
  );
  // 4× Flush oak edge dowels along visible right short edge of lower shelf!
  for (let d = 0; d < 4; d++) {
    const dy = sy0 + n + ((sly - n * 2) * (d + 0.5)) / 4;
    const [cx, cy] = p3(sx0 + slx, dy, 6.375);
    page.drawCircle({ x: cx, y: py(cy), size: 1.5, borderColor: C.inkDark, borderWidth: 0.55 });
  }

  // 4. Recessed Upper Long Front Rail (z: 15.0..16.5) & Right 3.00" Short End Apron (z: 13.5..16.5)
  drawBox(4.5, 27.5, 15.0, 47.0, 0.75, 1.5, { sw: 0.8 });
  drawBox(51.5, 4.5, 13.5, 1.5, 23.0, 3.0, { sw: 0.88 });

  // 5. Front-Left & Front-Right Stepped L-Legs (showing the signature 1.50" outer floating notch!)
  // Front-left leg
  drawBox(3.15, 29.15, 0, 1.2, 1.2, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.65 });
  drawBox(3, 27.5, 13.5, 1.5, 1.5, 3.0, { sw: 0.88 });
  drawBox(3, 29.0, 0.45, 1.5, 1.5, 14.55, { sw: 0.92 });
  // Front-right leg
  drawBox(51.65, 29.15, 0, 1.2, 1.2, 0.45, { top: C.steelTint, front: C.steelTint, side: C.gray, sw: 0.65 });
  drawBox(51.5, 27.5, 13.5, 1.5, 1.5, 3.0, { sw: 0.88 });
  drawBox(51.5, 29.0, 0.45, 1.5, 1.5, 14.55, { sw: 0.92 });

  // 6. 56.00" × 32.00" × 1.50" Solid White Oak Tabletop w/ crisp 1/4" roundover double edge lines!
  drawBox(0, 0, 16.5, 56, 32, 1.5, { sw: 1.05, roundover: true });

  drawCadLabel(
    page,
    font,
    ['ASSEMBLED 3/4 PERSPECTIVE · STEPPED L-LEGS · CORNER-NOTCHED SHELF · R 1/4" EDGES'],
    box.innerX + box.innerW / 2,
    box.innerYTop + box.innerH - 12,
    { size: 6.2, align: 'center', color: C.inkMid }
  );
}

function drawSectionDSteppedCorner(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = 26;
  const xOuter = box.innerX + box.innerW * 0.28;
  const topY = box.innerYTop + 42;
  const topH = DIM.topThk * s;
  const topBotY = topY + topH;
  const r = DIM.roundoverR * s;

  drawRoundedMember(page, xOuter - 1.5 * s, topY, 224, topH, r, {
    strokeWidth: 1.1,
    horizontalTangents: true,
    verticalTangents: true,
  });

  // Enlarged Stepped L-Leg (3.00" ear width, 1.50" outer notch!)
  drawSteppedLegShortElev(page, xOuter, topBotY, topBotY + 184, s, 'left');

  // 3.00" End apron joined with twin floating dowels
  const earX = xOuter + DIM.legEarW * s;
  drawRoundedMember(page, earX, topBotY, 108, DIM.endApronH * s, r * 0.85, {
    strokeWidth: 1.05,
    horizontalTangents: true,
  });
  for (const dy of [0.85 * s, 2.05 * s]) {
    drawHiddenMortise(page, earX - 1.0 * s, topBotY + dy - 0.25 * s, 2.0 * s, 0.5 * s);
  }

  // Dimensions
  drawDimArrow(page, xOuter, topY - 12, earX, topY - 12);
  drawCadLabel(page, font, ['3.00" STEPPED EAR'], (xOuter + earX) / 2, topY - 16, {
    size: 6.1,
    align: 'center',
    color: C.inkDark,
  });
  drawDimArrow(page, xOuter - 12, topBotY, xOuter - 12, topBotY + DIM.legNotchH * s);
  drawCadLabel(page, font, ['1.50" NOTCH'], xOuter - 16, topBotY + (DIM.legNotchH * s) / 2 + 2, {
    size: 5.9,
    align: 'right',
    color: C.inkDark,
  });
  drawCadLabel(
    page,
    font,
    ['1.50" OAK TOP (R 1/4" EDGES)', '3.00" END APRON', 'TWIN FLOATING DOWELS', '1.50" × 1.50" LEG SHAFT'],
    earX + 118,
    topY + 18,
    { size: 6.2, color: C.inkDark, lineHeight: 16 }
  );
}

function drawSlatTenonAndShelfDetail(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Left half: Enlarged Slat Side & End Elevation showing exact 1.50" H × 0.75" W slat & 1/2" L × 1" H × 1/2" W tenon!
  const s = 44; // Huge crisp detail scale!
  const sx0 = box.innerX + 86;
  const sy0 = box.innerYTop + 108;
  const r = DIM.roundoverR * s * 0.45;

  // Slat body (partial length 3.2" shown) + 0.50" L × 1.00" H tenon on right entering 0.75" rail!
  const bodyW = 3.2 * s;
  const slatH = DIM.slatH * s;
  const tenL = DIM.tenonL * s;
  const tenH = DIM.tenonH * s;
  const shH = (slatH - tenH) / 2;

  drawRoundedMember(page, sx0, sy0, bodyW, slatH, r, { strokeWidth: 1.05, horizontalTangents: true });
  // Tenon projecting right into rail mortise
  rect(page, sx0 + bodyW, sy0 + shH, tenL, tenH, { fill: C.white, stroke: C.black, strokeWidth: 1.0 });
  // Mating long rail section (0.75" W × 1.50" H)
  rect(page, sx0 + bodyW, sy0, DIM.slatW * s, slatH, { stroke: C.inkMid, strokeWidth: 0.85, dashArray: [3, 2] });

  // Exact dimensions!
  drawDimArrow(page, sx0 - 16, sy0, sx0 - 16, sy0 + slatH);
  drawCadLabel(page, font, ['1.50"'], sx0 - 20, sy0 + slatH / 2 + 2, { size: 6.4, align: 'right', color: C.inkDark });

  drawDimArrow(page, sx0 + bodyW + DIM.slatW * s + 14, sy0 + shH, sx0 + bodyW + DIM.slatW * s + 14, sy0 + shH + tenH);
  drawCadLabel(page, font, ['1.00" TENON H'], sx0 + bodyW + DIM.slatW * s + 18, sy0 + slatH / 2 + 2, {
    size: 6.2,
    color: C.inkDark,
  });

  drawDimArrow(page, sx0 + bodyW, sy0 - 14, sx0 + bodyW + tenL, sy0 - 14);
  drawCadLabel(page, font, ['0.50" L'], sx0 + bodyW + tenL / 2, sy0 - 18, { size: 6.2, align: 'center', color: C.inkDark });
  drawCadLabel(page, font, ['SLAT SIDE VIEW (0.25" SHOULDERS TOP & BOT.)'], sx0 + bodyW / 2, sy0 + slatH + 20, {
    size: 6.0,
    align: 'center',
    color: C.inkMid,
  });

  // Right half: Enlarged Plan View of 0.75" Corner-Notched Overhanging Shelf around 1.50" Leg
  const px0 = box.innerX + box.innerW * 0.62;
  const py0 = box.innerYTop + 68;
  const pLeg = 42;
  const pProj = 14;
  const pShelf = 148;
  polygon(
    page,
    [
      [px0 + pLeg, py0 - pProj],
      [px0 + pShelf, py0 - pProj],
      [px0 + pShelf, py0 + pShelf],
      [px0 - pProj, py0 + pShelf],
      [px0 - pProj, py0 + pLeg],
      [px0 + pLeg, py0 + pLeg],
    ],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 1.0 }
  );
  drawRoundedRect(page, px0, py0, pLeg, pLeg, 5, { fill: C.wallFill, borderColor: C.black, borderWidth: 1.05 });
  drawCadLabel(page, font, ['1.50" LEG'], px0 + pLeg / 2, py0 + pLeg / 2 + 2, {
    size: 5.5,
    align: 'center',
    color: C.inkDark,
  });
  drawCadLabel(
    page,
    font,
    ['CORNER-NOTCHED', '0.75" OAK SHELF', '(0.50" OVERHANG', 'R 1/4" EDGES)'],
    px0 + pShelf * 0.56,
    py0 + pShelf * 0.52,
    { size: 6.0, align: 'center', color: C.inkMid }
  );
}

function drawJoineryProfilesA103(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const pad = 12;
  const gap = 12;
  const cardW = (box.innerW - pad * 2 - gap * 2) / 3;
  const cardH = box.innerH - pad * 2;
  const cy = box.innerYTop + pad;

  const cards = [
    { title: '4A / SLAT END PROFILE', sub: '1.50"×0.75" · 1"×1/2" TENON' },
    { title: '4B / 1/4" ROUNDOVER', sub: 'R 0.25" ALL EXPOSED EDGES' },
    { title: '4C / STEPPED L-LEG EAR', sub: 'TWIN DOWELS · 3.00" APRON' },
  ];

  cards.forEach((c, i) => {
    const cx = box.innerX + pad + i * (cardW + gap);
    drawRoundedRect(page, cx, cy, cardW, cardH, 8, {
      fill: C.white,
      borderColor: C.inkLight,
      borderWidth: 0.75,
    });
    drawTrackedText(page, font, c.title, cx + cardW / 2, cy + 20, 7.5, {
      color: C.black,
      tracking: 0.7,
      align: 'center',
      weight: 'bold',
    });
    drawTrackedText(page, font, c.sub, cx + cardW / 2, cy + 33, 6.0, {
      color: C.inkMid,
      tracking: 0.5,
      align: 'center',
      weight: 'medium',
    });

    const midX = cx + cardW / 2;
    const midY = cy + cardH * 0.57;

    if (i === 0) {
      // Exact end-grain cross-section of 1.50" H × 0.75" W slat with centered 1.00" H × 0.50" W tenon!
      const sw = 42; // 0.75"
      const sh = 84; // 1.50"
      const tw = 28; // 0.50"
      const th = 56; // 1.00"
      drawRoundedRect(page, midX - sw / 2, midY - sh / 2, sw, sh, 6, {
        fill: C.oakTint,
        borderColor: C.black,
        borderWidth: 1.0,
      });
      rect(page, midX - tw / 2, midY - th / 2, tw, th, {
        fill: C.white,
        stroke: C.black,
        strokeWidth: 0.95,
      });
      drawDimArrow(page, midX - sw / 2, midY - sh / 2 - 10, midX + sw / 2, midY - sh / 2 - 10);
      drawCadLabel(page, font, ['3/4"'], midX, midY - sh / 2 - 14, { size: 5.8, align: 'center', color: C.inkDark });
      drawCadLabel(page, font, ['1/2"×1" TENON (1/8" CHEEKS)'], midX, cy + cardH - 14, {
        size: 5.5,
        align: 'center',
        color: C.inkMid,
      });
    } else if (i === 1) {
      // 1:1 1/4" Roundover Edge Cross-Section of 1.50" Tabletop!
      drawRoundedRect(page, midX - 46, midY - 36, 92, 72, 16, {
        fill: C.oakTint,
        borderColor: C.black,
        borderWidth: 1.05,
      });
      // Tangent reference lines
      line(page, midX - 46, midY - 20, midX + 46, midY - 20, 0.45, C.inkMid, [3, 2]);
      line(page, midX - 30, midY - 36, midX - 30, midY + 36, 0.45, C.inkMid, [3, 2]);
      drawCadLabel(page, font, ['R 1/4"'], midX - 4, midY - 24, { size: 6.4, align: 'center', color: C.inkDark });
      drawCadLabel(page, font, ['1/4" ROUNDOVER ALL EDGES'], midX, cy + cardH - 14, {
        size: 5.5,
        align: 'center',
        color: C.inkMid,
      });
    } else {
      // Twin dowel joint in stepped L-leg ear
      rect(page, midX - 44, midY - 36, 36, 72, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
      rect(page, midX - 8, midY - 36, 52, 72, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
      drawHiddenMortise(page, midX - 24, midY - 22, 32, 12);
      drawHiddenMortise(page, midX - 24, midY + 10, 32, 12);
      drawCadLabel(page, font, ['TWIN FLOATING OAK DOWELS'], midX, cy + cardH - 14, {
        size: 5.5,
        align: 'center',
        color: C.inkMid,
      });
    }
  });
}

// =============================================================================
// MAIN BUILD
// =============================================================================

async function buildCoffeeTableSheets() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle('casegoods — White Oak Mortise & Tenon Coffee Table (DWG CG-CT01 · A-101 to A-103)');
  pdfDoc.setAuthor('Josh Heinke — casegoods (Omaha, NE)');
  pdfDoc.setCreator('casegoods Omaha Architectural Drawing Studio');

  const nexaFont = await pdfDoc.embedFont(fs.readFileSync(FONT_NEXA));
  const logoFullImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_FULL));
  const logoIconsImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_ICONS));

  // SHEET A-101 — ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page1, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG CG-CT01',
    projectTitleLine: 'WHITE OAK COFFEE TABLE',
    scaleText: 'DECIMAL · 2D CAD',
    sheetCode: 'A-101',
    sheetIndexText: 'SHEET 01 / 03',
    sheetCategory: 'ELEVATIONS & SECTIONS',
    bannerBg: C.orange,
    bannerLeft: 'A-101  /  ARCHITECTURAL ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE',
    bannerRight: 'WHITE OAK MORTISE & TENON COFFEE TABLE  ·  R 1/4" ALL EDGES  ·  OMAHA STUDIO',
    accentColor: C.orange,
  });

  const row1Y = 174;
  const row1H = 384;
  const elevAW = 560;
  const elevBW = PAGE_W - 88 - elevAW - 16;

  const boxElevA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row1Y,
    w: elevAW,
    h: row1H,
    title: '01 / ELEVATION A — SHORT SIDE (32.00" W)',
    subtitle: 'STEPPED L-LEGS (3.00" EAR) · 23.00" CLEAR · R 1/4" EDGES',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.orange,
    subtitleSize: 7.7,
  });

  const boxElevB = drawViewportCard(page1, nexaFont, {
    x: 44 + elevAW + 16,
    yTop: row1Y,
    w: elevBW,
    h: row1H,
    title: '02 / ELEVATION B — LONG SIDE (56.00" L)',
    subtitle: '50.00" BASE · 47.00" CLEAR · 5× UPPER & 5× LOWER SLATS',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.cyan,
    subtitleSize: 7.8,
  });

  const sharedElevScale = Math.min(
    (boxElevA.innerW - 110) / DIM.topW,
    (boxElevB.innerW - 140) / DIM.topL,
    (boxElevA.innerH - 112) / DIM.totalH
  );
  const elevFloorY = boxElevA.innerYTop + boxElevA.innerH - 36;
  drawShortSideElevation(page1, nexaFont, boxElevA, sharedElevScale, elevFloorY);
  drawLongSideElevation(page1, nexaFont, boxElevB, sharedElevScale, elevFloorY);

  const row2Y = row1Y + row1H + 16;
  const row2H = 330;
  const secW = 318;
  const specW = PAGE_W - 88 - secW * 3 - 16 * 3;

  const boxSecA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row2Y,
    w: secW,
    h: row2H,
    title: '03 / SECTION A',
    subtitle: 'LONGITUDINAL SLATS',
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
    subtitle: 'STEPPED L-LEG',
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
    subtitle: 'SLAT TENON SPAN',
    headerBg: C.yellow,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  const secFloorY = boxSecA.innerYTop + boxSecA.innerH - 28;
  drawSectionALongitudinal(page1, nexaFont, boxSecA, 4.4, secFloorY);
  drawSectionBSteppedLeg(page1, nexaFont, boxSecB, 9.2, secFloorY);
  drawSectionCTransverse(page1, nexaFont, boxSecC, 6.8, secFloorY);

  drawSpecKeyCard(
    page1,
    nexaFont,
    44 + (secW + 16) * 3,
    row2Y,
    specW,
    row2H,
    [
      ['PRIMARY HARDWOOD', 'SOLID WHITE OAK · R 1/4" ALL EDGES'],
      ['TABLETOP SLAB', '56.00" L × 32.00" W × 1.50" THK'],
      ['STEPPED L-LEGS', '1.50" SHAFT · 3.00" EAR · TWIN DOWELS'],
      ['SLATS & RAILS', '1.50" H × 3/4" W (5× UPPER, 5× LOWER)'],
      ['SLAT TENONS', '1/2" L × 1" H × 1/2" W EACH END'],
      ['LOWER SHELF', '0.75" NOTCHED · 0.50" OVERHANG · GLIDES'],
    ],
    '1/4" ROUNDOVER ON ALL EXPOSED EDGES · DRY-FIT ALL M&T JOINTS PRIOR TO GLUE-UP'
  );

  // SHEET A-102 — SUB-FRAME PLAN & EXPLODED PART DRAWING (AS REQUESTED!)
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page2, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG CG-CT01',
    projectTitleLine: 'WHITE OAK COFFEE TABLE',
    scaleText: 'DECIMAL · 2D CAD',
    sheetCode: 'A-102',
    sheetIndexText: 'SHEET 02 / 03',
    sheetCategory: 'PLAN & EXPLODED PARTS',
    bannerBg: C.cyan,
    bannerLeft: 'A-102  /  STRUCTURAL SUB-FRAME PLAN & EXPLODED PART DRAWING',
    bannerRight: '5× UPPER & 5× LOWER TENONED SLATS  ·  STEPPED L-LEGS  ·  CG-CT01',
    accentColor: C.cyan,
  });

  const a102Y = 174;
  const a102H = 730;
  const planW = 636;
  const expW = PAGE_W - 88 - planW - 16; // 860 pt generous stage for Exploded Part Drawing!

  const boxPlan = drawViewportCard(page2, nexaFont, {
    x: 44,
    yTop: a102Y,
    w: planW,
    h: a102H,
    title: '01 / SUB-FRAME PLAN',
    subtitle: '5× UPPER & 5× LOWER SLATS · STEPPED L-LEGS',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.yellow,
    bottomTicksYOffset: 54,
  });

  const boxExploded = drawViewportCard(page2, nexaFont, {
    x: 44 + planW + 16,
    yTop: a102Y,
    w: expW,
    h: a102H,
    title: '02 / EXPLODED PART DRAWING — 30° ORTHOGRAPHIC',
    subtitle: 'ALL COMPONENTS & M&T JOINERY',
    headerBg: C.cyan,
    headerTextColor: C.black,
  });

  drawCoffeeTablePlan(page2, nexaFont, { ...boxPlan, innerH: boxPlan.innerH - 54 });
  drawSectionCutLegend(page2, nexaFont, 60, a102Y + a102H - 50, planW - 32, [
    { code: 'A', text: 'SLAT FRAME', color: C.orange, x: 210 },
    { code: 'B', text: 'STEPPED LEG', color: C.cyan, x: 366 },
    { code: 'C', text: 'SLAT TENON', color: C.yellow, x: 526 },
  ]);
  drawExplodedPartDrawingA102(page2, nexaFont, boxExploded);

  // SHEET A-103 — ASSEMBLED ISOMETRIC & 1:1 MORTISE, TENON & ROUNDOVER DETAILS
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page3, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG CG-CT01',
    projectTitleLine: 'WHITE OAK COFFEE TABLE',
    scaleText: 'DECIMAL · 2D CAD',
    sheetCode: 'A-103',
    sheetIndexText: 'SHEET 03 / 03',
    sheetCategory: 'ISOMETRIC & JOINERY',
    bannerBg: C.yellow,
    bannerLeft: 'A-103  /  ASSEMBLED ISOMETRIC, STEPPED LEG & 1:1 SLAT TENON DETAILS',
    bannerRight: '1/2" × 1" × 1/2" SLAT TENONS  ·  R 1/4" ROUNDOVERS  ·  CG-CT01',
    accentColor: C.yellow,
  });

  const a103TopY = 174;
  const a103RowH = 357;
  const a103BotY = a103TopY + a103RowH + 16;
  const leftColW = 790;
  const rightColW = PAGE_W - 88 - leftColW - 16;

  const boxIso = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103TopY,
    w: leftColW,
    h: a103RowH,
    title: '01 / ASSEMBLED ISOMETRIC — ORTHOGRAPHIC 30°',
    subtitle: '56.00" × 32.00" × 18.00" · R 1/4" ROUNDOVER ALL EDGES',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.yellow,
    subtitleSize: 7.9,
  });

  const boxSecD = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103TopY,
    w: rightColW,
    h: a103RowH,
    title: '03 / SECTION D — STEPPED L-LEG & TWIN DOWELS',
    subtitle: '3.00" EAR · 1.50" NOTCH · R 1/4" EDGES',
    headerBg: C.orange,
    headerTextColor: C.black,
    subtitleSize: 7.9,
  });

  const boxSlatDet = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103BotY,
    w: leftColW,
    h: a103RowH,
    title: '02 / DETAIL ELEVATION D — SLAT TENON & LOWER SHELF NOTCH',
    subtitle: '1.50" H × 3/4" W SLAT · 1/2" L × 1" H × 1/2" W TENON',
    headerBg: C.gray,
    headerTextColor: C.black,
    subtitleSize: 7.9,
  });

  const boxJoinery = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103BotY,
    w: rightColW,
    h: a103RowH,
    title: '04 / 1:1 MORTISE, TENON & ROUNDOVER PROFILES',
    subtitle: 'ARCHITECTURAL SHOP DETAILS',
    headerBg: C.cyan,
    headerTextColor: C.black,
    subtitleSize: 8.0,
    showCornerTicks: false,
  });

  drawAssembledIsometricA103(page3, nexaFont, boxIso);
  drawSectionDSteppedCorner(page3, nexaFont, boxSecD);
  drawSlatTenonAndShelfDetail(page3, nexaFont, boxSlatDet);
  drawJoineryProfilesA103(page3, nexaFont, boxJoinery);

  const pdfBytes = await pdfDoc.save();
  const pdfOutPath = path.join(OUT_DIR, 'casegoods-CG-CT01-coffee-table-submittal-A101-A103.pdf');
  fs.writeFileSync(pdfOutPath, pdfBytes);

  rasterizeSubmittalPdf(pdfOutPath, [
    { page: 1, name: 'casegoods-CG-CT01-A101-elevations-sections.png' },
    { page: 2, name: 'casegoods-CG-CT01-A102-plan-isometric.png' },
    { page: 3, name: 'casegoods-CG-CT01-A103-joinery-details.png' },
  ]);
  console.log(`Generated PDF: ${pdfOutPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

buildCoffeeTableSheets().catch((err) => {
  console.error(err);
  process.exit(1);
});
