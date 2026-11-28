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
// WHITE OAK MORTISE & TENON COFFEE TABLE — EXACT MODEL DIMENSIONS (INCHES)
// (Sourced directly from Rhino 3D Model & Finished Build Photos)
// =============================================================================
const DIM = {
  topL: 56.0,         // Overall tabletop length
  topW: 32.0,         // Overall tabletop width
  topThk: 1.5,        // Solid White Oak tabletop thickness
  totalH: 18.0,       // Overall table height (floor to top surface)
  baseH: 16.5,        // Floor to underside of tabletop
  baseL: 50.0,        // Outer-to-outer leg span (long side)
  baseW: 29.0,        // Outer-to-outer leg span (short side)
  legClearL: 47.0,    // Clear span between legs (long side)
  legClearW: 26.0,    // Clear span between legs (short side)
  innerRailW: 23.0,   // Clear span between long upper rails
  overhangL: 3.0,     // Tabletop overhang on each short end
  overhangW: 1.5,     // Tabletop overhang on each long side
  legSq: 1.5,         // 1.50" x 1.50" square solid White Oak legs
  glideH: 0.45,       // Adjustable steel/felt leveling glide height
  endApronH: 3.0,     // Floating 3.00" tall short-end apron riser
  shadowGap: 0.75,    // Floating corner shadow reveal above leg top
  upperRailH: 1.5,    // Long upper apron rail height
  clearOpenH: 8.25,   // Clear opening between upper rail and lower shelf
  shelfThk: 0.75,     // Corner-notched solid White Oak lower shelf thickness
  lowerRailH: 1.5,    // Lower sub-frame rail height
  floorClearH: 4.5,   // Floor to underside of lower rail
  upperStretchers: 5, // 5× mortise-and-tenon upper cross-stretchers
  lowerStretchers: 4, // 4× mortise-and-tenon lower cross-stretchers
};

/** Draw subtle dashed mortise-and-tenon joint lines inside a leg or rail */
function drawHiddenTenon(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number
) {
  rect(page, x, yTop, w, h, {
    stroke: C.inkMid,
    strokeWidth: 0.5,
    dashArray: [2.5, 2],
  });
}

/** Draw adjustable leveling glide under a 1.50" square leg */
function drawLevelerGlide(page: PDFPage, cx: number, floorY: number, s: number) {
  const padW = 1.25 * s;
  const padH = DIM.glideH * s;
  rect(page, cx - padW / 2, floorY - padH, padW, padH, {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.75,
  });
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
  const xTop0 = box.innerX + (box.innerW - topW) / 2 + 8;
  const xBase0 = xTop0 + DIM.overhangW * s;
  const xBase1 = xBase0 + baseW;

  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const legTopY = topBotY + DIM.shadowGap * s;
  const glideTopY = floorY - DIM.glideH * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;

  // Floor line
  line(page, xTop0 - 24, floorY, xTop0 + topW + 24, floorY, 1.4, C.black);

  // 1.50" Solid White Oak Tabletop
  rect(page, xTop0, topY, topW, DIM.topThk * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });

  // 3.00" Floating Short-End Apron (spans between legs & rises to underside of top!)
  const apronY = topBotY;
  const apronH = DIM.endApronH * s;
  rect(page, xBase0 + legW, apronY, baseW - legW * 2, apronH, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Recessed long-rail end profiles visible inside shadow line
  rect(page, xBase0 + legW, topBotY + 1.5 * s, 1.5 * s, 1.5 * s, {
    stroke: C.inkMid,
    strokeWidth: 0.55,
    dashArray: [2, 2],
  });
  rect(page, xBase1 - legW - 1.5 * s, topBotY + 1.5 * s, 1.5 * s, 1.5 * s, {
    stroke: C.inkMid,
    strokeWidth: 0.55,
    dashArray: [2, 2],
  });

  // 2× Square Legs (1.50" × 1.50") with 0.75" floating shadow gap below top
  for (const lx of [xBase0, xBase1 - legW]) {
    rect(page, lx, legTopY, legW, glideTopY - legTopY, {
      fill: C.oakTint,
      stroke: C.black,
      strokeWidth: 1.0,
    });
    drawLevelerGlide(page, lx + legW / 2, floorY, s);
  }
  // Hidden twin tenons from 3.00" apron into left & right legs
  drawHiddenTenon(page, xBase0 + legW * 0.28, legTopY + 0.35 * s, legW * 0.72, 0.7 * s);
  drawHiddenTenon(page, xBase0 + legW * 0.28, legTopY + 1.3 * s, legW * 0.72, 0.7 * s);
  drawHiddenTenon(page, xBase1 - legW, legTopY + 0.35 * s, legW * 0.72, 0.7 * s);
  drawHiddenTenon(page, xBase1 - legW, legTopY + 1.3 * s, legW * 0.72, 0.7 * s);

  // Corner-notched 0.75" lower shelf with 4 exposed oak dowel pins along edge
  rect(page, xBase0 + legW, shelfTopY, baseW - legW * 2, DIM.shelfThk * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  for (let d = 0; d < 4; d++) {
    const dx = xBase0 + legW + ((baseW - legW * 2) * (d + 0.5)) / 4;
    page.drawCircle({
      x: dx,
      y: py(shelfTopY + (DIM.shelfThk * s) / 2),
      size: 1.7,
      borderColor: C.inkMid,
      borderWidth: 0.6,
    });
  }

  // 1.50" Lower end rail mortised into legs
  rect(page, xBase0 + legW, lowerRailTopY, baseW - legW * 2, DIM.lowerRailH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  drawHiddenTenon(page, xBase0 + legW * 0.28, lowerRailTopY + 0.3 * s, legW * 0.72, 0.9 * s);
  drawHiddenTenon(page, xBase1 - legW, lowerRailTopY + 0.3 * s, legW * 0.72, 0.9 * s);

  // Section A vertical cut datum
  const secAX = xTop0 + topW / 2;
  line(page, secAX, topY - 34, secAX, floorY + 14, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secAX, topY - 38, 10, 'A', C.orange);

  // Exact Dimensions (matching Untitled.PNG!)
  // Top 32.00"
  drawDimArrow(page, xTop0, topY - 14, xTop0 + topW, topY - 14);
  drawCadLabel(page, font, ['32.00"'], xTop0 + topW / 2, topY - 18, {
    size: 6.4,
    align: 'center',
    color: C.inkDark,
  });
  // Left 18.00" overall height
  drawDimArrow(page, xTop0 - 16, topY, xTop0 - 16, floorY);
  drawCadLabel(page, font, ['18.00"'], xTop0 - 20, (topY + floorY) / 2, {
    size: 6.3,
    align: 'right',
    color: C.inkDark,
  });
  // Inner 26.00" leg clear & 23.00" inner rail span
  drawDimArrow(page, xBase0 + legW, apronY + apronH + 14, xBase1 - legW, apronY + apronH + 14);
  drawCadLabel(page, font, ['26.00" LEG CLEAR (23.00" INNER RAILS)'], xTop0 + topW / 2, apronY + apronH + 10, {
    size: 5.7,
    align: 'center',
    color: C.inkMid,
  });
  // Bottom 29.00" base width
  drawDimArrow(page, xBase0, floorY + 16, xBase1, floorY + 16);
  drawCadLabel(page, font, ['29.00" BASE'], xTop0 + topW / 2, floorY + 13, {
    size: 6.2,
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
  const xTop0 = box.innerX + (box.innerW - topL) / 2;
  const xBase0 = xTop0 + DIM.overhangL * s;
  const xBase1 = xBase0 + baseL;

  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const legTopY = topBotY + DIM.shadowGap * s;
  const glideTopY = floorY - DIM.glideH * s;
  const upperRailTopY = topBotY;
  const upperRailH = DIM.upperRailH * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;

  // Floor line
  line(page, xTop0 - 28, floorY, xTop0 + topL + 36, floorY, 1.4, C.black);

  // 56.00" × 1.50" Solid White Oak Tabletop
  rect(page, xTop0, topY, topL, DIM.topThk * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });

  // Recessed long upper rail (47.00" span between legs, 1.50" tall)
  rect(page, xBase0 + legW, upperRailTopY, baseL - legW * 2, upperRailH, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Dashed positions of 5× upper cross-stretcher tenons
  const uSpan = baseL - legW * 2;
  for (let i = 1; i <= DIM.upperStretchers; i++) {
    const sx = xBase0 + legW + (uSpan * i) / (DIM.upperStretchers + 1);
    drawHiddenTenon(page, sx - 0.65 * s, upperRailTopY + 0.3 * s, 1.3 * s, 0.9 * s);
  }

  // Left & Right Legs (1.50" wide) with 0.75" floating shadow gap at top!
  for (const lx of [xBase0, xBase1 - legW]) {
    rect(page, lx, legTopY, legW, glideTopY - legTopY, {
      fill: C.oakTint,
      stroke: C.black,
      strokeWidth: 1.0,
    });
    drawLevelerGlide(page, lx + legW / 2, floorY, s);
  }
  // Floating end-apron riser behind top of legs (3.00" overhang detail)
  rect(page, xBase0, topBotY, legW, DIM.shadowGap * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  rect(page, xBase1 - legW, topBotY, legW, DIM.shadowGap * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.65,
  });

  // 0.75" Corner-notched lower shelf
  rect(page, xBase0 + legW, shelfTopY, baseL - legW * 2, DIM.shelfThk * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });

  // 1.50" Lower long rail + hidden mortise-and-tenons into legs & 4× lower cross-stretchers
  rect(page, xBase0 + legW, lowerRailTopY, baseL - legW * 2, DIM.lowerRailH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  drawHiddenTenon(page, xBase0 + legW * 0.25, lowerRailTopY + 0.3 * s, legW * 0.75, 0.9 * s);
  drawHiddenTenon(page, xBase1 - legW, lowerRailTopY + 0.3 * s, legW * 0.75, 0.9 * s);
  for (let i = 1; i <= DIM.lowerStretchers; i++) {
    const sx = xBase0 + legW + (uSpan * i) / (DIM.lowerStretchers + 1);
    drawHiddenTenon(page, sx - 0.6 * s, lowerRailTopY + 0.3 * s, 1.2 * s, 0.9 * s);
  }

  // Section Cut B (Thru Corner Leg & Tenons) & Section Cut C (Thru Center Cross-Stretchers)
  const secBX = xBase0 + legW * 0.5;
  const secCX = xTop0 + topL * 0.5;
  line(page, secBX, topY - 34, secBX, floorY + 14, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secBX, topY - 38, 10, 'B', C.cyan);

  line(page, secCX, topY - 34, secCX, floorY + 14, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secCX, topY - 38, 10, 'C', C.yellow);

  // Exact Dimensions (matching Untitled.PNG!)
  // Top 56.00" overall length
  drawDimArrow(page, xTop0, topY - 14, xTop0 + topL, topY - 14);
  drawCadLabel(page, font, ['56.00" OVERALL LENGTH'], xTop0 + topL / 2, topY - 18, {
    size: 6.5,
    align: 'center',
    color: C.inkDark,
  });
  // Left 16.50" base height & 1.50" top
  drawDimArrow(page, xTop0 - 16, topBotY, xTop0 - 16, floorY);
  drawCadLabel(page, font, ['16.50"'], xTop0 - 20, (topBotY + floorY) / 2, {
    size: 6.1,
    align: 'right',
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['1.50" TOP'], xTop0 - 20, topY + (DIM.topThk * s) / 2 + 2, {
    size: 5.8,
    align: 'right',
    color: C.inkDark,
  });
  // Right 18.00" overall height
  drawDimArrow(page, xTop0 + topL + 16, topY, xTop0 + topL + 16, floorY);
  drawCadLabel(page, font, ['18.00"'], xTop0 + topL + 20, (topY + floorY) / 2, {
    size: 6.3,
    color: C.inkDark,
  });
  // Internal 8.25" clear opening & 47.00" clear between legs
  const openDimX = xBase1 - legW - 28;
  drawDimArrow(page, openDimX, upperRailTopY + upperRailH, openDimX, shelfTopY);
  drawCadLabel(page, font, ['8.25" CLEAR'], openDimX - 5, (upperRailTopY + upperRailH + shelfTopY) / 2 + 2, {
    size: 5.9,
    align: 'right',
    color: C.inkDark,
  });
  drawDimArrow(page, xBase0 + legW, upperRailTopY + upperRailH + 14, xBase1 - legW, upperRailTopY + upperRailH + 14);
  drawCadLabel(page, font, ['47.00" CLEAR BETWEEN LEGS'], xTop0 + topL / 2, upperRailTopY + upperRailH + 10, {
    size: 5.9,
    align: 'center',
    color: C.inkMid,
  });
  // Bottom 50.00" base span & 4.50" floor clearance
  drawDimArrow(page, xBase0, floorY + 16, xBase1, floorY + 16);
  drawCadLabel(page, font, ['50.00" BASE SPAN · 4.50" FLOOR CLEARANCE'], xTop0 + topL / 2, floorY + 13, {
    size: 6.2,
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

  line(page, x0 - 12, floorY, x0 + topL + 12, floorY, 1.3, C.black);
  // Tabletop cut
  rect(page, x0, topY, topL, DIM.topThk * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
  // 2× 3.00" End aprons cut
  rect(page, xb0, topBotY, DIM.legSq * s, DIM.endApronH * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.85 });
  rect(page, xb1 - DIM.legSq * s, topBotY, DIM.legSq * s, DIM.endApronH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // 5× Upper cross-stretchers in cross-section!
  const span = baseL - DIM.legSq * 2 * s;
  for (let i = 1; i <= DIM.upperStretchers; i++) {
    const sx = xb0 + DIM.legSq * s + (span * i) / (DIM.upperStretchers + 1);
    rect(page, sx - 0.75 * s, topBotY, 1.5 * s, DIM.upperRailH * s, {
      fill: C.wallFill,
      stroke: C.black,
      strokeWidth: 0.8,
    });
  }
  // 0.75" Lower shelf cut + 4× lower cross-stretchers in section
  rect(page, xb0 + DIM.legSq * s, shelfTopY, span, DIM.shelfThk * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  for (let i = 1; i <= DIM.lowerStretchers; i++) {
    const sx = xb0 + DIM.legSq * s + (span * i) / (DIM.lowerStretchers + 1);
    rect(page, sx - 0.65 * s, lowerRailTopY, 1.3 * s, DIM.lowerRailH * s, {
      fill: C.wallFill,
      stroke: C.black,
      strokeWidth: 0.8,
    });
  }

  drawCadLabel(
    page,
    font,
    ['5× UPPER MORTISED CROSS-STRETCHERS', '0.75" SOLID OAK LOWER SHELF', '4× LOWER CROSS-STRETCHERS'],
    x0 + topL / 2,
    topY - 38,
    { size: 6.1, align: 'center', color: C.inkMid }
  );
}

function drawSectionBCornerLeg(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const legW = DIM.legSq * s;
  const cx = box.innerX + box.innerW * 0.36;
  const topY = floorY - DIM.totalH * s;
  const topBotY = topY + DIM.topThk * s;
  const legTopY = topBotY + DIM.shadowGap * s;
  const glideTopY = floorY - DIM.glideH * s;
  const lowerRailBotY = floorY - DIM.floorClearH * s;
  const lowerRailTopY = lowerRailBotY - DIM.lowerRailH * s;
  const shelfTopY = lowerRailTopY - DIM.shelfThk * s;

  line(page, cx - 44, floorY, cx + 108, floorY, 1.3, C.black);
  // Tabletop overhang
  rect(page, cx - 22, topY, 92, DIM.topThk * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
  // 1.50" Leg
  rect(page, cx - legW / 2, legTopY, legW, glideTopY - legTopY, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  drawLevelerGlide(page, cx, floorY, s);
  // 3.00" Floating end apron with twin mortise-and-tenons into leg
  rect(page, cx + legW / 2, topBotY, 44, DIM.endApronH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  drawHiddenTenon(page, cx - legW * 0.2, legTopY + 0.35 * s, legW * 0.7, 0.75 * s);
  drawHiddenTenon(page, cx - legW * 0.2, legTopY + 1.3 * s, legW * 0.7, 0.75 * s);
  // 0.75" Shelf + 1.50" lower mortised rail
  rect(page, cx + legW / 2, shelfTopY, 44, DIM.shelfThk * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  rect(page, cx + legW / 2, lowerRailTopY, 44, DIM.lowerRailH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  drawHiddenTenon(page, cx - legW * 0.2, lowerRailTopY + 0.3 * s, legW * 0.7, 0.9 * s);

  drawCadLabel(
    page,
    font,
    ['0.75" FLOATING', 'SHADOW REVEAL', 'TWIN M&T JOINT', 'IN 1.50" SQ. LEG'],
    cx + legW / 2 + 68,
    topY + 8,
    { size: 6.0, color: C.inkMid }
  );
  drawCadLabel(
    page,
    font,
    ['LOWER RAIL M&T', '4.50" CLEARANCE'],
    cx + legW / 2 + 68,
    lowerRailTopY + 2,
    { size: 6.0, color: C.inkMid }
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

  line(page, x0 - 14, floorY, x0 + topW + 14, floorY, 1.3, C.black);
  // Tabletop
  rect(page, x0, topY, topW, DIM.topThk * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
  // 2× Long upper rails in section + cross-stretcher spanning 23.00" between them
  const railW = DIM.legSq * s;
  const inX0 = xb0 + railW;
  const inX1 = xb1 - railW;
  rect(page, inX0, topBotY, railW, DIM.upperRailH * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.85 });
  rect(page, inX1 - railW, topBotY, railW, DIM.upperRailH * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.85 });
  rect(page, inX0 + railW, topBotY, inX1 - inX0 - railW * 2, DIM.upperRailH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawHiddenTenon(page, inX0 + railW * 0.35, topBotY + 0.3 * s, railW * 0.65, 0.9 * s);
  drawHiddenTenon(page, inX1 - railW, topBotY + 0.3 * s, railW * 0.65, 0.9 * s);

  // Lower shelf & lower rail/stretcher
  rect(page, xb0, shelfTopY, baseW, DIM.shelfThk * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.9 });
  rect(page, xb0 + railW, lowerRailTopY, railW, DIM.lowerRailH * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.85 });
  rect(page, xb1 - railW * 2, lowerRailTopY, railW, DIM.lowerRailH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  rect(page, xb0 + railW * 2, lowerRailTopY, baseW - railW * 4, DIM.lowerRailH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });

  drawCadLabel(
    page,
    font,
    ['32.00" TOP · 23.00" STRETCHER SPAN', 'SLOTTED MOVEMENT FASTENERS', '8.25" CLEAR SHELF OPENING'],
    x0 + topW / 2,
    topY - 38,
    { size: 6.0, align: 'center', color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-102 — STRUCTURAL SUB-FRAME PLAN & 30° ISOMETRIC
// =============================================================================

function drawCoffeeTablePlan(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = 8.4;
  const topL = DIM.topL * s;
  const topW = DIM.topW * s;
  const baseL = DIM.baseL * s;
  const baseW = DIM.baseW * s;
  const legW = DIM.legSq * s;

  const x0 = box.innerX + (box.innerW - topL) / 2;
  const y0 = box.innerYTop + (box.innerH - topW) / 2 - 4;
  const xb0 = x0 + DIM.overhangL * s;
  const yb0 = y0 + DIM.overhangW * s;

  // Dashed 56.00" × 32.00" tabletop perimeter overhang
  rect(page, x0, y0, topL, topW, {
    fill: C.white,
    stroke: C.inkMid,
    strokeWidth: 0.9,
    dashArray: [5, 3],
  });

  // 0.75" corner-notched lower shelf outline (subtle fill)
  rect(page, xb0, yb0, baseL, baseW, {
    fill: C.oakTint,
    stroke: C.inkLight,
    strokeWidth: 0.7,
  });

  // 4× Square 1.50" × 1.50" legs at corners of 50.00" × 29.00" footprint
  const legs: Array<[number, number]> = [
    [xb0, yb0],
    [xb0 + baseL - legW, yb0],
    [xb0, yb0 + baseW - legW],
    [xb0 + baseL - legW, yb0 + baseW - legW],
  ];
  for (const [lx, ly] of legs) {
    rect(page, lx, ly, legW, legW, {
      fill: C.wallFill,
      stroke: C.black,
      strokeWidth: 1.05,
    });
  }

  // 2× Short-end 3.00" floating aprons (connecting left pair & right pair of legs)
  rect(page, xb0, yb0 + legW, legW, baseW - legW * 2, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  rect(page, xb0 + baseL - legW, yb0 + legW, legW, baseW - legW * 2, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });

  // 2× Long upper rails (inset 1.50" from long edges -> 23.00" clear span!)
  const railInsetY = yb0 + legW;
  const railBotY = yb0 + baseW - legW * 2;
  rect(page, xb0 + legW, railInsetY, baseL - legW * 2, legW, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  rect(page, xb0 + legW, railBotY, baseL - legW * 2, legW, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });

  // 5× Upper mortise-and-tenon cross-stretchers (solid) with slotted mounting holes!
  const clearL = baseL - legW * 2;
  const innerSpanY = baseW - legW * 4;
  for (let i = 1; i <= DIM.upperStretchers; i++) {
    const sx = xb0 + legW + (clearL * i) / (DIM.upperStretchers + 1) - legW / 2;
    rect(page, sx, railInsetY + legW, legW, innerSpanY, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.9,
    });
    // Hidden tenons into upper long rails
    drawHiddenTenon(page, sx + legW * 0.2, railInsetY + legW * 0.35, legW * 0.6, legW * 0.65);
    drawHiddenTenon(page, sx + legW * 0.2, railBotY, legW * 0.6, legW * 0.65);
    // Elongated seasonal-movement screw slots on center of stretcher
    for (const frac of [0.28, 0.72]) {
      drawRoundedRect(page, sx + legW * 0.36, railInsetY + legW + innerSpanY * frac - 4, legW * 0.28, 8, 2, {
        fill: C.white,
        borderColor: C.inkDark,
        borderWidth: 0.65,
      });
    }
  }

  // 4× Lower cross-stretchers (dashed beneath shelf)
  for (let i = 1; i <= DIM.lowerStretchers; i++) {
    const sx = xb0 + legW + (clearL * i) / (DIM.lowerStretchers + 1) - legW * 0.45;
    rect(page, sx, yb0 + legW, legW * 0.9, baseW - legW * 2, {
      stroke: C.inkMid,
      strokeWidth: 0.6,
      dashArray: [3, 3],
    });
  }

  // Section Cut markers A, B, C
  drawSectionBadge(page, font, x0 - 24, y0 + topW / 2, 10, 'A', C.orange);
  line(page, x0 - 13, y0 + topW / 2, x0 + topL + 16, y0 + topW / 2, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, xb0 + legW / 2, y0 - 24, 10, 'B', C.cyan);
  line(page, xb0 + legW / 2, y0 - 13, xb0 + legW / 2, y0 + topW + 18, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, x0 + topL / 2, y0 - 24, 10, 'C', C.yellow);
  line(page, x0 + topL / 2, y0 - 13, x0 + topL / 2, y0 + topW + 18, 0.6, C.inkMid, [4, 3]);

  // Overall Plan Dimensions
  drawDimArrow(page, x0, y0 - 44, x0 + topL, y0 - 44);
  drawCadLabel(page, font, ['56.00" TABLETOP LENGTH (50.00" BASE · 3.00" OVERHANG EACH END)'], x0 + topL / 2, y0 - 48, {
    size: 6.3,
    align: 'center',
    color: C.inkDark,
  });

  drawDimArrow(page, x0 + topL + 22, y0, x0 + topL + 22, y0 + topW);
  drawCadLabel(page, font, ['32.00"'], x0 + topL + 26, y0 + topW / 2 + 2, {
    size: 6.3,
    color: C.inkDark,
  });

  drawCadLabel(
    page,
    font,
    ['SOLID: 5× UPPER MORTISED CROSS-STRETCHERS W/ SLOTTED MOVEMENT HOLES  ·  DASHED: 4× LOWER STRETCHERS'],
    x0 + topL / 2,
    y0 + topW + 30,
    { size: 5.9, align: 'center', color: C.inkMid }
  );
}

function drawCoffeeTableIsometric(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = 0.5;
  const sc = 6.7;
  const ox = box.innerX + box.innerW * 0.42;
  const oy = box.innerYTop + box.innerH * 0.44;

  const iso = (x: number, y: number, z: number): [number, number] => [
    ox + (x - y) * cos30 * sc,
    oy + (x + y) * sin30 * sc - z * sc,
  ];

  const drawIsoBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    fills: { top?: ReturnType<typeof rgb>; front?: ReturnType<typeof rgb>; left?: ReturnType<typeof rgb>; right?: ReturnType<typeof rgb> },
    sw = 0.85
  ) => {
    // Left-front face (x = x)
    polygon(page, [iso(x, y, z), iso(x, y + d, z), iso(x, y + d, z + h), iso(x, y, z + h)], {
      fill: fills.left ?? C.oakTint,
      stroke: C.black,
      strokeWidth: sw,
    });
    // Right-front face (y = y + d)
    polygon(page, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], {
      fill: fills.front ?? C.oakTint,
      stroke: C.black,
      strokeWidth: sw,
    });
    // Top face (z = z + h)
    polygon(page, [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], {
      fill: fills.top ?? C.oakTint,
      stroke: C.black,
      strokeWidth: sw,
    });
  };

  // Back leg (3, 1.5)
  drawIsoBox(3, 1.5, 0.45, 1.5, 1.5, 15.3, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.85);
  // Right-back leg (51.5, 1.5)
  drawIsoBox(51.5, 1.5, 0.45, 1.5, 1.5, 15.3, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.85);

  // Lower rails + 0.75" corner-notched lower shelf (z: 4.5..6.75)
  drawIsoBox(4.5, 1.5, 4.5, 47, 29, 1.5, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.85);
  drawIsoBox(4.5, 1.5, 6.0, 47, 29, 0.75, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.9);

  // Front-left leg (3, 29.0) & Front-right leg (51.5, 29.0)
  drawIsoBox(3, 29.0, 0.45, 1.5, 1.5, 15.3, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.95);
  drawIsoBox(51.5, 29.0, 0.45, 1.5, 1.5, 15.3, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.95);
  // Leveling glides
  for (const [lx, ly] of [
    [3.15, 29.15],
    [51.65, 29.15],
    [3.15, 1.65],
  ]) {
    drawIsoBox(lx, ly, 0, 1.2, 1.2, 0.45, { top: C.steelTint, front: C.steelTint, left: C.steelTint }, 0.75);
  }

  // 3.00" Floating Short-End Apron (left visible end, z: 13.5..16.5)
  drawIsoBox(3, 3.0, 13.5, 1.5, 26.0, 3.0, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.9);
  // Long front upper rail (z: 15.0..16.5)
  drawIsoBox(4.5, 27.5, 15.0, 47.0, 1.5, 1.5, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 0.85);

  // 56.00" × 32.00" × 1.50" Solid White Oak Tabletop (z: 16.5..18.0)
  drawIsoBox(0, 0, 16.5, 56.0, 32.0, 1.5, { top: C.oakTint, front: C.oakTint, left: C.oakTint }, 1.1);
  // Subtle eased chamfer edge line on top
  polygon(page, [iso(0.6, 0.6, 18), iso(55.4, 0.6, 18), iso(55.4, 31.4, 18), iso(0.6, 31.4, 18)], {
    stroke: C.inkFaint,
    strokeWidth: 0.45,
  });

  drawCadLabel(
    page,
    font,
    ['ORTHOGRAPHIC 30° ISOMETRIC — 56.00" × 32.00" × 18.00" SOLID WHITE OAK COFFEE TABLE'],
    box.innerX + box.innerW / 2,
    box.innerYTop + box.innerH - 12,
    { size: 6.7, align: 'center', color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-103 — EXPLODED JOINERY ASSEMBLY & 1:1 MORTISE-AND-TENON DETAILS
// =============================================================================

function drawExplodedAssembly(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = 0.5;
  const sc = 3.15;
  const ox = box.innerX + box.innerW * 0.45;
  const oy = box.innerYTop + box.innerH * 0.56;

  const iso = (x: number, y: number, z: number): [number, number] => [
    ox + (x - y) * cos30 * sc,
    oy + (x + y) * sin30 * sc - z * sc,
  ];

  const drawBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    fill = C.oakTint,
    sw = 0.7
  ) => {
    polygon(page, [iso(x, y, z), iso(x, y + d, z), iso(x, y + d, z + h), iso(x, y, z + h)], {
      fill,
      stroke: C.black,
      strokeWidth: sw,
    });
    polygon(page, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], {
      fill,
      stroke: C.black,
      strokeWidth: sw,
    });
    polygon(page, [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], {
      fill,
      stroke: C.black,
      strokeWidth: sw,
    });
  };

  // 1. Lower ladder frame (exploded down to z = 2)
  drawBox(4.5, 29.0, 2, 47, 1.5, 1.5);
  drawBox(4.5, 1.5, 2, 47, 1.5, 1.5);
  for (let i = 1; i <= 4; i++) {
    const sx = 4.5 + (47 * i) / 5;
    drawBox(sx, 3.0, 2, 1.3, 26.0, 1.5, C.white, 0.65);
  }

  // 2. Corner-notched 0.75" lower shelf (exploded at z = 11)
  drawBox(4.5, 1.5, 11, 47, 29, 0.75, C.oakTint, 0.8);

  // 3. 4× Mortised Square Legs (pushed outward on X for exploded clarity!)
  drawBox(-5, 29.0, 6, 1.5, 1.5, 15.3, C.oakTint, 0.8);
  drawBox(-5, 1.5, 6, 1.5, 1.5, 15.3, C.oakTint, 0.8);
  drawBox(59, 29.0, 6, 1.5, 1.5, 15.3, C.oakTint, 0.8);
  drawBox(59, 1.5, 6, 1.5, 1.5, 15.3, C.oakTint, 0.8);
  // Floating 3.00" end aprons (pushed slightly outward with twin tenons!)
  drawBox(-1, 3.0, 18.5, 1.5, 26.0, 3.0, C.oakTint, 0.8);
  drawBox(55, 3.0, 18.5, 1.5, 26.0, 3.0, C.oakTint, 0.8);

  // 4. Upper ladder frame (2× long rails + 5× tenoned cross-stretchers at z = 23)
  drawBox(4.5, 27.5, 23, 47, 1.5, 1.5);
  drawBox(4.5, 3.0, 23, 47, 1.5, 1.5);
  for (let i = 1; i <= 5; i++) {
    const sx = 4.5 + (47 * i) / 6;
    drawBox(sx, 4.5, 23, 1.5, 23.0, 1.5, C.white, 0.65);
  }

  // 5. Lifted 56.00" × 32.00" × 1.50" Tabletop (exploded up to z = 34)
  drawBox(0, 0, 34, 56, 32, 1.5, C.oakTint, 0.95);

  // Dashed assembly axis lines
  for (const [ax, ay] of [
    [-4.2, 29.7],
    [59.7, 29.7],
  ]) {
    line(page, ...iso(ax, ay, 0), ...iso(ax, ay, 5.5), 0.55, C.inkMid, [2, 2]);
  }

  // Crisp assembly callouts
  drawCadLabel(page, font, ['1.50" SOLID OAK TOP'], box.innerX + 26, box.innerYTop + 28, {
    size: 6.1,
    color: C.inkDark,
  });
  drawCadLabel(page, font, ['5× TENONED UPPER STRETCHERS'], box.innerX + 26, box.innerYTop + 88, {
    size: 6.1,
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['0.75" NOTCHED LOWER SHELF'], box.innerX + 26, box.innerYTop + 150, {
    size: 6.1,
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['4× LOWER STRETCHERS'], box.innerX + 26, box.innerYTop + 210, {
    size: 6.1,
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['3.00" FLOATING END APRONS', '& TWIN-TENONED 1.50" LEGS'], box.innerX + box.innerW - 22, box.innerYTop + 148, {
    size: 6.1,
    align: 'right',
    color: C.inkDark,
  });
}

function drawSectionDFloatingCorner(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = 26; // Large architectural detail scale
  const xLeg = box.innerX + box.innerW * 0.34;
  const topY = box.innerYTop + 42;
  const topH = DIM.topThk * s;
  const gapH = DIM.shadowGap * s;
  const legW = DIM.legSq * s;
  const apronH = DIM.endApronH * s;

  // Tabletop cut
  rect(page, xLeg - 36, topY, 210, topH, { fill: C.oakTint, stroke: C.black, strokeWidth: 1.1 });

  // 1.50" Square Leg below 0.75" shadow gap
  rect(page, xLeg, topY + topH + gapH, legW, 145, { fill: C.oakTint, stroke: C.black, strokeWidth: 1.05 });

  // 3.00" Floating End Apron extending UP to touch underside of tabletop!
  rect(page, xLeg + legW, topY + topH, 130, apronH, { fill: C.oakTint, stroke: C.black, strokeWidth: 1.05 });

  // Twin mortise-and-tenon joints (dashed inside leg!)
  drawHiddenTenon(page, xLeg + legW * 0.25, topY + topH + gapH + 10, legW * 0.75, 18);
  drawHiddenTenon(page, xLeg + legW * 0.25, topY + topH + gapH + 36, legW * 0.75, 18);

  // Slotted tabletop fastener screw
  line(page, xLeg + legW + 52, topY + topH - 14, xLeg + legW + 52, topY + topH + apronH * 0.55, 1.0, C.black);

  // Dimensions & Callouts
  drawDimArrow(page, xLeg - 14, topY + topH, xLeg - 14, topY + topH + gapH);
  drawCadLabel(page, font, ['0.75" GAP'], xLeg - 18, topY + topH + gapH / 2 + 2, {
    size: 6.2,
    align: 'right',
    color: C.inkDark,
  });
  drawCadLabel(
    page,
    font,
    ['1.50" SOLID WHITE OAK TOP', '3.00" FLOATING END APRON', 'TWIN MORTISE & TENONS', '1.50" × 1.50" SQUARE LEG'],
    xLeg + legW + 140,
    topY + 18,
    { size: 6.3, color: C.inkDark, lineHeight: 16 }
  );
}

function drawLowerShelfNotchDetail(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Left side: Elevation of lower corner; Right side: Plan view of 1.50"×1.50" leg notch in 0.75" shelf
  const s = 18;
  const floorY = box.innerYTop + box.innerH - 36;
  const xLeg = box.innerX + 120;
  const legW = DIM.legSq * s;
  const railBotY = floorY - DIM.floorClearH * s;
  const railTopY = railBotY - DIM.lowerRailH * s;
  const shelfTopY = railTopY - DIM.shelfThk * s;

  line(page, xLeg - 36, floorY, xLeg + 220, floorY, 1.35, C.black);
  rect(page, xLeg, shelfTopY - 46, legW, floorY - DIM.glideH * s - (shelfTopY - 46), {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  drawLevelerGlide(page, xLeg + legW / 2, floorY, s);

  rect(page, xLeg + legW, shelfTopY, 160, DIM.shelfThk * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
  // Exposed oak edge dowels
  for (const dx of [xLeg + legW + 32, xLeg + legW + 96]) {
    page.drawCircle({ x: dx, y: py(shelfTopY + (DIM.shelfThk * s) / 2), size: 3.2, borderColor: C.inkDark, borderWidth: 0.75 });
  }
  rect(page, xLeg + legW, railTopY, 160, DIM.lowerRailH * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
  drawHiddenTenon(page, xLeg + legW * 0.22, railTopY + 5, legW * 0.78, DIM.lowerRailH * s - 10);

  drawDimArrow(page, xLeg - 16, railBotY, xLeg - 16, floorY);
  drawCadLabel(page, font, ['4.50"'], xLeg - 20, (railBotY + floorY) / 2 + 2, {
    size: 6.2,
    align: 'right',
    color: C.inkDark,
  });
  drawCadLabel(page, font, ['0.75" SHELF W/ OAK DOWELS', '1.50" LOWER M&T RAIL'], xLeg + legW + 80, shelfTopY - 22, {
    size: 6.1,
    align: 'center',
    color: C.inkMid,
  });

  // Right side: Enlarged Plan View of 1.50" × 1.50" Corner Notch around Leg
  const px0 = box.innerX + box.innerW * 0.62;
  const py0 = box.innerYTop + 62;
  const pLeg = 38;
  const pShelf = 148;
  // L-notched shelf polygon
  polygon(
    page,
    [
      [px0 + pLeg, py0],
      [px0 + pShelf, py0],
      [px0 + pShelf, py0 + pShelf],
      [px0, py0 + pShelf],
      [px0, py0 + pLeg],
      [px0 + pLeg, py0 + pLeg],
    ],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 1.0 }
  );
  // Square leg nested cleanly in notch
  rect(page, px0, py0, pLeg, pLeg, { fill: C.wallFill, stroke: C.black, strokeWidth: 1.05 });
  drawCadLabel(page, font, ['1.50" LEG'], px0 + pLeg / 2, py0 + pLeg / 2 + 2, {
    size: 5.4,
    align: 'center',
    color: C.inkDark,
  });
  drawCadLabel(page, font, ['CORNER-NOTCHED', '0.75" OAK SHELF', '(PLAN DETAIL)'], px0 + pShelf * 0.56, py0 + pShelf * 0.56, {
    size: 6.1,
    align: 'center',
    color: C.inkMid,
  });
}

function drawJoineryProfiles(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const pad = 12;
  const gap = 12;
  const cardW = (box.innerW - pad * 2 - gap * 2) / 3;
  const cardH = box.innerH - pad * 2;
  const cy = box.innerYTop + pad;

  const cards = [
    { title: '4A / TWIN LEG TENON', sub: '1.50" SQ. LEG · 3.00" APRON' },
    { title: '4B / STRETCHER TENON', sub: '1.50" RAIL · SLOTTED MOUNT' },
    { title: '4C / SHELF EDGE DOWEL', sub: '0.75" OAK · FLUSH PLUGGED' },
  ];

  cards.forEach((c, i) => {
    const cx = box.innerX + pad + i * (cardW + gap);
    drawRoundedRect(page, cx, cy, cardW, cardH, 8, {
      fill: C.white,
      borderColor: C.inkLight,
      borderWidth: 0.75,
    });
    drawTrackedText(page, font, c.title, cx + cardW / 2, cy + 20, 7.6, {
      color: C.black,
      tracking: 0.7,
      align: 'center',
      weight: 'bold',
    });
    drawTrackedText(page, font, c.sub, cx + cardW / 2, cy + 33, 6.2, {
      color: C.inkMid,
      tracking: 0.55,
      align: 'center',
      weight: 'medium',
    });

    const midX = cx + cardW / 2;
    const midY = cy + cardH * 0.56;

    if (i === 0) {
      // Twin tenon into leg mortise
      rect(page, midX - 48, midY - 40, 34, 84, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
      rect(page, midX - 14, midY - 36, 62, 72, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
      drawHiddenTenon(page, midX - 38, midY - 24, 24, 18);
      drawHiddenTenon(page, midX - 38, midY + 4, 24, 18);
      drawCadLabel(page, font, ['GLUED TWIN MORTISE & TENON'], midX, cy + cardH - 14, {
        size: 5.7,
        align: 'center',
        color: C.inkMid,
      });
    } else if (i === 1) {
      // Cross-stretcher mortise & tenon + slotted movement hole
      rect(page, midX - 50, midY - 22, 26, 48, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.9 });
      rect(page, midX - 24, midY - 14, 74, 32, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
      drawHiddenTenon(page, midX - 42, midY - 8, 18, 20);
      drawRoundedRect(page, midX + 6, midY - 4, 24, 8, 3, {
        fill: C.white,
        borderColor: C.black,
        borderWidth: 0.75,
      });
      drawCadLabel(page, font, ['ALLOWS SEASONAL MOVEMENT'], midX, cy + cardH - 14, {
        size: 5.7,
        align: 'center',
        color: C.inkMid,
      });
    } else {
      // Corner-notched shelf + edge dowel
      rect(page, midX - 46, midY - 14, 92, 28, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.95 });
      page.drawCircle({ x: midX - 18, y: py(midY), size: 6.5, color: C.white, borderColor: C.black, borderWidth: 0.85 });
      page.drawCircle({ x: midX + 18, y: py(midY), size: 6.5, color: C.white, borderColor: C.black, borderWidth: 0.85 });
      drawCadLabel(page, font, ['FLUSH SANDED OAK PLUGS'], midX, cy + cardH - 14, {
        size: 5.7,
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
    bannerRight: 'WHITE OAK MORTISE & TENON COFFEE TABLE  ·  56" × 32" × 18"  ·  OMAHA STUDIO',
    accentColor: C.orange,
  });

  const row1Y = 174;
  const row1H = 384;
  const elevAW = 560;
  const elevBW = PAGE_W - 88 - elevAW - 16; // 936

  const boxElevA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row1Y,
    w: elevAW,
    h: row1H,
    title: '01 / ELEVATION A — SHORT SIDE (32.00" W)',
    subtitle: '29.00" BASE · 26.00" LEG CLEAR · 3.00" FLOATING APRON',
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
    title: '02 / ELEVATION B — LONG SIDE (56.00" L)',
    subtitle: '50.00" BASE · 47.00" CLEAR · 8.25" OPENING · 4.50" FLOOR CLEAR',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.cyan,
    subtitleSize: 7.8,
  });

  const sharedElevScale = Math.min(
    (boxElevA.innerW - 110) / DIM.topW,
    (boxElevB.innerW - 140) / DIM.topL,
    (boxElevA.innerH - 110) / DIM.totalH
  );
  const elevFloorY = boxElevA.innerYTop + boxElevA.innerH - 36;
  drawShortSideElevation(page1, nexaFont, boxElevA, sharedElevScale, elevFloorY);
  drawLongSideElevation(page1, nexaFont, boxElevB, sharedElevScale, elevFloorY);

  const row2Y = row1Y + row1H + 16;
  const row2H = 330;
  const secW = 318;
  const specW = PAGE_W - 88 - secW * 3 - 16 * 3; // 510

  const boxSecA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row2Y,
    w: secW,
    h: row2H,
    title: '03 / SECTION A',
    subtitle: 'LONGITUDINAL FRAME',
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
    subtitle: 'CORNER LEG & TENONS',
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
    subtitle: 'TRANSVERSE CENTER',
    headerBg: C.yellow,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  const secFloorY = boxSecA.innerYTop + boxSecA.innerH - 28;
  drawSectionALongitudinal(page1, nexaFont, boxSecA, 4.4, secFloorY);
  drawSectionBCornerLeg(page1, nexaFont, boxSecB, 9.2, secFloorY);
  drawSectionCTransverse(page1, nexaFont, boxSecC, 6.8, secFloorY);

  drawSpecKeyCard(
    page1,
    nexaFont,
    44 + (secW + 16) * 3,
    row2Y,
    specW,
    row2H,
    [
      ['PRIMARY HARDWOOD', 'SOLID QUARTER & RIFT WHITE OAK'],
      ['TABLETOP SLAB', '56.00" L × 32.00" W × 1.50" THK'],
      ['BASE & LEGS', '1.50" SQ. LEGS · 0.75" FLOATING GAP'],
      ['FRAME JOINERY', 'TWIN MORTISE & TENON THROUGHOUT'],
      ['LOWER SHELF', '0.75" CORNER-NOTCHED · 4× STRETCHERS'],
      ['HARDWARE & TOL.', 'LEVELING GLIDES · ± 1/32" RHINO 3D'],
    ],
    'DRY-FIT ALL MORTISE & TENON JOINTS PRIOR TO GLUE-UP · SLOTTED TOP MOUNTING'
  );

  // SHEET A-102 — STRUCTURAL SUB-FRAME PLAN & 30° ISOMETRIC
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page2, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG CG-CT01',
    projectTitleLine: 'WHITE OAK COFFEE TABLE',
    scaleText: 'DECIMAL · 2D CAD',
    sheetCode: 'A-102',
    sheetIndexText: 'SHEET 02 / 03',
    sheetCategory: 'PLAN & ISOMETRIC',
    bannerBg: C.cyan,
    bannerLeft: 'A-102  /  STRUCTURAL SUB-FRAME PLAN & 30° ORTHOGRAPHIC ISOMETRIC',
    bannerRight: '5× UPPER & 4× LOWER MORTISED STRETCHERS  ·  56" × 32" × 18"  ·  CG-CT01',
    accentColor: C.cyan,
  });

  const a102Y = 174;
  const a102H = 730;
  const planW = 684;
  const isoW = PAGE_W - 88 - planW - 16;

  const boxPlan = drawViewportCard(page2, nexaFont, {
    x: 44,
    yTop: a102Y,
    w: planW,
    h: a102H,
    title: '01 / SUB-FRAME PLAN',
    subtitle: 'SOLID: 5× UPPER STRETCHERS · DASHED: 4× LOWER STRETCHERS',
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

  drawCoffeeTablePlan(page2, nexaFont, { ...boxPlan, innerH: boxPlan.innerH - 54 });
  drawSectionCutLegend(page2, nexaFont, 60, a102Y + a102H - 50, planW - 32, [
    { code: 'A', text: 'LONGITUDINAL', color: C.orange, x: 214 },
    { code: 'B', text: 'CORNER TENONS', color: C.cyan, x: 378 },
    { code: 'C', text: 'CENTER SPAN', color: C.yellow, x: 546 },
  ]);
  drawCoffeeTableIsometric(page2, nexaFont, boxIso);

  // SHEET A-103 — EXPLODED JOINERY ASSEMBLY & 1:1 MORTISE-AND-TENON DETAILS
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page3, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG CG-CT01',
    projectTitleLine: 'WHITE OAK COFFEE TABLE',
    scaleText: 'DECIMAL · 2D CAD',
    sheetCode: 'A-103',
    sheetIndexText: 'SHEET 03 / 03',
    sheetCategory: 'MORTISE & TENON DETAILS',
    bannerBg: C.yellow,
    bannerLeft: 'A-103  /  EXPLODED MORTISE & TENON BASE ASSEMBLY & 1:1 JOINERY DETAILS',
    bannerRight: 'TWIN-TENON FLOATING CORNERS  ·  CORNER-NOTCHED LOWER SHELF  ·  CG-CT01',
    accentColor: C.yellow,
  });

  const a103TopY = 174;
  const a103RowH = 357;
  const a103BotY = a103TopY + a103RowH + 16;
  const leftColW = 790;
  const rightColW = PAGE_W - 88 - leftColW - 16;

  const boxExploded = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103TopY,
    w: leftColW,
    h: a103RowH,
    title: '01 / EXPLODED ISOMETRIC — MORTISE & TENON BASE ASSEMBLY',
    subtitle: '1.50" TOP · 5× UPPER STRETCHERS · NOTCHED SHELF · 4× LOWER STRETCHERS',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.yellow,
    subtitleSize: 7.8,
  });

  const boxSecD = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103TopY,
    w: rightColW,
    h: a103RowH,
    title: '03 / SECTION D — FLOATING CORNER & TWIN TENON',
    subtitle: 'ENLARGED LEG-TO-APRON JOINERY',
    headerBg: C.orange,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  const boxLowerDet = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103BotY,
    w: leftColW,
    h: a103RowH,
    title: '02 / DETAIL ELEVATION D — LOWER SHELF NOTCH & RAIL JOINERY',
    subtitle: '0.75" NOTCHED SHELF · 1.50" M&T RAIL · 4.50" FLOOR CLEARANCE',
    headerBg: C.gray,
    headerTextColor: C.black,
    subtitleSize: 7.9,
  });

  const boxJoinery = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103BotY,
    w: rightColW,
    h: a103RowH,
    title: '04 / MORTISE & TENON JOINERY PROFILES',
    subtitle: '1:1 ARCHITECTURAL SHOP DETAILS',
    headerBg: C.cyan,
    headerTextColor: C.black,
    subtitleSize: 8.0,
    showCornerTicks: false,
  });

  drawExplodedAssembly(page3, nexaFont, boxExploded);
  drawSectionDFloatingCorner(page3, nexaFont, boxSecD);
  drawLowerShelfNotchDetail(page3, nexaFont, boxLowerDet);
  drawJoineryProfiles(page3, nexaFont, boxJoinery);

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
