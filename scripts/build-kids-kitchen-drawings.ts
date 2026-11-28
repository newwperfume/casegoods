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
// 1070MCG HEIRLOOM PLAY KITCHEN & BUILT-IN WALL — EXACT FRACTIONAL DIMENSIONS
// (Sourced directly from Rhino 2D CAD Elevation A1 & Section B1)
// =============================================================================
const DIM = {
  // Built-In Storage Wall (Left)
  builtInW: 72.75,    // 72 3/4"
  builtInD: 20.0,     // 20" depth
  totalH: 101.0,      // 101" floor to ceiling
  toeH: 4.5,          // 4 1/2" plinth base
  lowerDoorH: 30.0,   // 30" lower doors
  midRailH: 1.25,     // 1 1/4" mid counter ledge
  upperDoorH: 46.75,  // 46 3/4" upper doors
  transomH: 12.0,     // 12" transom doors
  crownH: 3.0,        // 2 63/64" (~3") frieze/crown
  scribeH: 3.5,       // 3 1/2" ceiling scribe

  // Heirloom Play Kitchenette (Right)
  playW: 48.25,       // 48 1/4" overall countertop span
  playD: 20.0,        // 20" depth
  playCounterH: 30.5, // 30 1/2" AFF
  playTopThk: 1.25,   // 1 1/4" walnut countertop
  playCaseH: 19.5,    // 19 1/2" casework height
  legH: 9.75,         // 9 3/4" stacked-ball turned legs
  leftBayW: 27.9375,  // 27 15/16" left sink bay
  rightBayW: 19.75,   // 19 3/4" right towel-bar bay
  legSpanCenter: 42.25, // 42 1/4" center-to-center leg span
  legClearSpan: 30.25,  // 30 1/4" clear between legs
  leftDoorPanelH: 13.25,// 13 1/4" left Shaker door recessed panel
  rightDoorPanelH: 8.75,// 8 3/4" right Shaker door recessed panel
  railBandH: 1.5,     // 1 1/2" drawer pull rail & towel bar
  // Plumbing rough-ins from built-in right face
  coldSupplyX: 20.5,  // 20 1/2"
  drainX: 24.0,       // 24"
  hotSupplyX: 26.75,  // 26 3/4"
  supplyH: 20.0,      // 20" AFF
  drainH: 15.75,      // 15 3/4" AFF
};

/** Draw a lathe-turned stacked-ball walnut leg (3 stacked flattened spheres + foot button) */
function drawStackedBallLeg(
  page: PDFPage,
  cx: number,
  topY: number,
  legH: number,
  maxRadius: number
) {
  const footH = legH * 0.08;
  const usableH = legH - footH;
  // 3 balls: top (widest), middle, bottom (slightly narrower)
  const balls = [
    { rx: maxRadius * 1.0, ry: usableH * 0.175, cy: topY + usableH * 0.175 },
    { rx: maxRadius * 0.9, ry: usableH * 0.165, cy: topY + usableH * 0.51 },
    { rx: maxRadius * 0.78, ry: usableH * 0.16, cy: topY + usableH * 0.83 },
  ];
  for (const b of balls) {
    page.drawEllipse({
      x: cx,
      y: py(b.cy),
      xScale: b.rx,
      yScale: b.ry,
      color: C.walnutTint,
      borderColor: C.black,
      borderWidth: 0.8,
    });
  }
  // Small turned foot pad at floor
  rect(page, cx - maxRadius * 0.34, topY + legH - footH, maxRadius * 0.68, footH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.7,
  });
}

/** Draw continuous scalloped apron between left and right stacked-ball legs */
function drawScallopedApron(
  page: PDFPage,
  xStart: number,
  xEnd: number,
  topY: number,
  scallopR: number,
  count = 8
) {
  const span = xEnd - xStart;
  const step = span / count;
  const r = Math.min(scallopR, step / 2);
  let d = `M ${xStart.toFixed(2)},${topY.toFixed(2)} L ${xEnd.toFixed(2)},${topY.toFixed(2)}`;
  // Draw scallops right-to-left along bottom edge
  for (let i = count - 1; i >= 0; i--) {
    const sx = xStart + i * step;
    const midX = sx + step / 2;
    d += ` Q ${midX.toFixed(2)},${(topY + r * 1.85).toFixed(2)} ${sx.toFixed(2)},${topY.toFixed(2)}`;
  }
  d += ' Z';
  page.drawSvgPath(d, {
    x: 0,
    y: PAGE_H,
    color: C.walnutTint,
    borderColor: C.black,
    borderWidth: 0.8,
  });
}

/** Draw tall gooseneck play-kitchen faucet in elevation */
function drawGooseneckFaucet(page: PDFPage, cx: number, topY: number, s: number) {
  const h = 11.5 * s;
  const r = 1.6 * s;
  rect(page, cx - 1.1 * s, topY - 2.6 * s, 2.2 * s, 2.6 * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  // Side lever
  rect(page, cx + 1.1 * s, topY - 2.1 * s, 2.2 * s, 0.9 * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  // Tall vertical neck
  const d = `M ${(cx - 0.55 * s).toFixed(2)},${(topY - 2.6 * s).toFixed(2)} L ${(cx - 0.55 * s).toFixed(2)},${(
    topY - h
  ).toFixed(2)} A ${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(cx + 0.55 * s).toFixed(2)},${(
    topY - h
  ).toFixed(2)} L ${(cx + 0.55 * s).toFixed(2)},${(topY - 2.6 * s).toFixed(2)}`;
  page.drawSvgPath(d, {
    x: 0,
    y: PAGE_H,
    color: C.white,
    borderColor: C.black,
    borderWidth: 0.8,
  });
}

/** Draw Shaker door panel with recessed inner frame */
function drawShakerDoor(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  inset: number
) {
  rect(page, x, yTop, w, h, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  if (w > inset * 2.5 && h > inset * 2.5) {
    rect(page, x + inset, yTop + inset, w - inset * 2, h - inset * 2, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.65,
    });
  }
}

// =============================================================================
// SHEET A-101 DRAWINGS
// =============================================================================

function drawFullWallElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const builtW = DIM.builtInW * s;
  const playW = DIM.playW * s;
  const totalW = builtW + playW;
  const x0 = box.innerX + (box.innerW - totalW) / 2 + 20;

  // Floor & right wall line
  line(page, x0 - 24, floorY, x0 + totalW + 24, floorY, 1.4, C.black);
  const ceilY = floorY - DIM.totalH * s;
  line(page, x0 - 12, ceilY, x0 + totalW + 18, ceilY, 0.9, C.black);
  line(page, x0 + totalW + 6, ceilY, x0 + totalW + 6, floorY, 0.8, C.inkMid);

  // ---- LEFT: 72 3/4" × 101" BUILT-IN STORAGE WALL ----
  const toeY = floorY - DIM.toeH * s;
  const lowTopY = toeY - DIM.lowerDoorH * s;
  const midTopY = lowTopY - DIM.midRailH * s;
  const upTopY = midTopY - DIM.upperDoorH * s;
  const transTopY = upTopY - DIM.transomH * s;
  const crownTopY = transTopY - DIM.crownH * s;

  // Outer carcass
  rect(page, x0, ceilY, builtW, DIM.totalH * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  // Ceiling scribe & crown fascia
  rect(page, x0, ceilY, builtW, DIM.scribeH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  rect(page, x0, crownTopY, builtW, DIM.crownH * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  // Sloped soffit diagonal on right of built-in
  line(page, x0 + builtW, crownTopY, x0 + builtW + 5 * s, ceilY, 0.8, C.black);

  // 3 equal bays (each 24 1/4")
  const bayW = builtW / 3;
  for (let b = 0; b < 3; b++) {
    const bx = x0 + b * bayW;
    // Transom door (12" H)
    rect(page, bx, transTopY, bayW, DIM.transomH * s, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.8,
    });
    // Upper pair of vertical doors (46 3/4" H)
    rect(page, bx, upTopY, bayW / 2, DIM.upperDoorH * s, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.8,
    });
    rect(page, bx + bayW / 2, upTopY, bayW / 2, DIM.upperDoorH * s, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.8,
    });
    // Lower pair of vertical doors (30" H)
    rect(page, bx, lowTopY, bayW / 2, DIM.lowerDoorH * s, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.8,
    });
    rect(page, bx + bayW / 2, lowTopY, bayW / 2, DIM.lowerDoorH * s, {
      fill: C.white,
      stroke: C.black,
      strokeWidth: 0.8,
    });
  }

  // 1 1/4" Mid counter ledge (projects slightly right)
  rect(page, x0 - 1, midTopY, builtW + 2.5, DIM.midRailH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  // 4 1/2" Toe-kick plinth
  rect(page, x0, toeY, builtW, DIM.toeH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });

  // Left vertical dimension stack (exact Rhino fractions!)
  const dX = x0 - 16;
  drawDimArrow(page, dX, ceilY, dX, floorY);
  drawCadLabel(page, font, ['101"'], dX - 4, (ceilY + floorY) / 2, {
    size: 6.6,
    align: 'right',
    color: C.inkDark,
  });
  drawCadLabel(page, font, ['72 3/4" BUILT-IN WALL'], x0 + builtW / 2, transTopY + DIM.transomH * s * 0.62, {
    size: 6.2,
    align: 'center',
    color: C.inkMid,
  });

  // ---- RIGHT: 48 1/4" × 30 1/2" HEIRLOOM PLAY KITCHEN ----
  const px0 = x0 + builtW + 1.5;
  const pTopY = floorY - DIM.playCounterH * s;
  const pTopH = DIM.playTopThk * s;
  const pCaseTopY = pTopY + pTopH;
  const pCaseH = DIM.playCaseH * s;
  const pCaseBotY = pCaseTopY + pCaseH;
  const legH = DIM.legH * s;

  // Wall rough-in circle & electrical outlets above play kitchen
  page.drawCircle({
    x: px0 + playW * 0.48,
    y: py(floorY - 72 * s),
    size: 2.2 * s,
    borderColor: C.inkMid,
    borderWidth: 0.75,
  });
  rect(page, px0 + 3.5 * s, pTopY - 7 * s, 2.2 * s, 3.8 * s, {
    stroke: C.inkMid,
    strokeWidth: 0.65,
  });
  rect(page, px0 + playW - 6.5 * s, pTopY - 7 * s, 3.2 * s, 3.5 * s, {
    stroke: C.inkMid,
    strokeWidth: 0.65,
  });

  // Gooseneck faucet
  drawGooseneckFaucet(page, px0 + DIM.drainX * s - 2 * s, pTopY, s);

  // Stacked-ball lathe legs (9 3/4" H)
  const legR = 3.2 * s;
  const leftLegX = px0 + 5.8 * s;
  const rightLegX = px0 + playW - 6.8 * s;
  drawStackedBallLeg(page, leftLegX, pCaseBotY, legH, legR);
  drawStackedBallLeg(page, rightLegX, pCaseBotY, legH, legR);

  // Continuous scalloped apron between legs
  drawScallopedApron(page, leftLegX + legR * 0.75, rightLegX - legR * 0.75, pCaseBotY, 2.2 * s, 8);

  // Countertop slab (48 1/4" W × 1 1/4" H)
  rect(page, px0 - 1, pTopY, playW + 1.5, pTopH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });

  // Casework body (19 1/2" H)
  rect(page, px0, pCaseTopY, playW - 1, pCaseH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });

  // Left bay (27 15/16") & Right bay (19 3/4")
  const lbW = DIM.leftBayW * s;
  const rbW = playW - 1 - lbW;
  const drwBandH = 4.6 * s;

  // Left bay top apron/drawer + 1 1/2" pull strip
  rect(page, px0 + 1.5, pCaseTopY + 1.2, lbW - 2.5, drwBandH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.7,
  });
  rect(page, px0 + 3, pCaseTopY + drwBandH * 0.45, lbW - 5.5, 1.5 * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.6,
  });
  // Left bay pair of Shaker doors (13 1/4" panel)
  const doorY = pCaseTopY + drwBandH + 2.2;
  const lDoorH = pCaseH - drwBandH - 3.6;
  const lHalf = (lbW - 3.5) / 2;
  drawShakerDoor(page, px0 + 1.5, doorY, lHalf, lDoorH, 2.2);
  drawShakerDoor(page, px0 + 2.5 + lHalf, doorY, lHalf, lDoorH, 2.2);

  // Right bay top apron/drawer
  const rbx = px0 + lbW;
  rect(page, rbx + 1, pCaseTopY + 1.2, rbW - 2.5, drwBandH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.7,
  });
  rect(page, rbx + 2.5, pCaseTopY + drwBandH * 0.45, rbW - 5.5, 1.5 * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.6,
  });
  // Right bay projecting 1 1/2" towel bar
  const towelY = doorY + 2.6 * s;
  drawRoundedRect(page, rbx + 1, towelY, rbW + 3.5 * s, 1.5 * s, 1.8, {
    fill: C.walnutTint,
    borderColor: C.black,
    borderWidth: 0.75,
  });
  // Right bay lower Shaker door (8 3/4" panel)
  const rDoorY = towelY + 2.0 * s;
  drawShakerDoor(page, rbx + 1, rDoorY, rbW - 2.5, pCaseBotY - rDoorY - 1.5, 2.0);

  // Section cut bubbles A, B, C
  const secAX = x0 + builtW * 0.5;
  const secBX = px0 + lbW * 0.55;
  const secCX = rbx + rbW * 0.5;
  const badgeY = ceilY - 16;

  line(page, secAX, badgeY + 11, secAX, floorY + 10, 0.6, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secAX, badgeY, 9.5, 'A', C.orange);

  line(page, secBX, badgeY + 11, secBX, floorY + 10, 0.6, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secBX, badgeY, 9.5, 'B', C.cyan);

  line(page, secCX, badgeY + 11, secCX, floorY + 10, 0.6, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secCX, badgeY, 9.5, 'C', C.yellow);

  // Bottom width callouts
  const dimY = floorY + 16;
  drawDimArrow(page, x0, dimY, x0 + builtW, dimY);
  drawCadLabel(page, font, ['72 3/4" STORAGE WALL'], x0 + builtW / 2, dimY - 3.5, {
    size: 5.9,
    align: 'center',
    color: C.inkDark,
  });
  drawDimArrow(page, px0, dimY, px0 + playW, dimY);
  drawCadLabel(page, font, ['48 1/4" PLAY KITCHEN'], px0 + playW / 2, dimY - 3.5, {
    size: 5.9,
    align: 'center',
    color: C.inkDark,
  });
}

function drawPlumbingRoughInElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const playW = DIM.playW * s;
  const x0 = box.innerX + (box.innerW - playW) / 2 - 10;
  const pTopY = floorY - DIM.playCounterH * s;
  const pTopH = DIM.playTopThk * s;
  const pCaseTopY = pTopY + pTopH;
  const pCaseH = DIM.playCaseH * s;
  const pCaseBotY = pCaseTopY + pCaseH;
  const legH = DIM.legH * s;

  // Floor & left built-in reference edge
  line(page, x0 - 20, floorY, x0 + playW + 46, floorY, 1.4, C.black);
  rect(page, x0 - 8, floorY - 58 * s, 8, 58 * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Ghosted kitchenette outline
  rect(page, x0, pTopY, playW, pTopH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.95 });
  rect(page, x0, pCaseTopY, playW - 1, pCaseH, { fill: C.white, stroke: C.black, strokeWidth: 0.9 });
  line(page, x0 + DIM.leftBayW * s, pCaseTopY, x0 + DIM.leftBayW * s, pCaseBotY, 0.75, C.inkMid);
  drawGooseneckFaucet(page, x0 + DIM.drainX * s - 2 * s, pTopY, s);

  const legR = 3.2 * s;
  drawStackedBallLeg(page, x0 + 5.8 * s, pCaseBotY, legH, legR);
  drawStackedBallLeg(page, x0 + playW - 6.8 * s, pCaseBotY, legH, legR);
  drawScallopedApron(page, x0 + 5.8 * s + legR * 0.75, x0 + playW - 6.8 * s - legR * 0.75, pCaseBotY, 2.2 * s, 8);

  // Exact plumbing rough-in points from Rhino Section B1!
  const coldX = x0 + DIM.coldSupplyX * s;
  const hotX = x0 + DIM.hotSupplyX * s;
  const drainX = x0 + DIM.drainX * s;
  const supplyY = floorY - DIM.supplyH * s;
  const drainY = floorY - DIM.drainH * s;

  // Supply valves (20" AFF)
  for (const sx of [coldX, hotX]) {
    page.drawCircle({ x: sx, y: py(supplyY), size: 3.2, color: C.white, borderColor: C.black, borderWidth: 0.95 });
  }
  // Waste drain stub-out (15 3/4" AFF)
  page.drawCircle({ x: drainX, y: py(drainY), size: 6.2, color: C.white, borderColor: C.black, borderWidth: 1.05 });

  // Horizontal rough-in dimensions from built-in face (x0)
  const topDimY = pTopY - 22;
  line(page, coldX, topDimY - 3, coldX, supplyY - 4, 0.45, C.inkLight, [2, 2]);
  drawDimArrow(page, x0, topDimY, coldX, topDimY);
  drawCadLabel(page, font, ['20 1/2"'], (x0 + coldX) / 2, topDimY - 4, {
    size: 6.2,
    align: 'center',
    color: C.inkDark,
  });

  const midDimY = supplyY + 12;
  drawDimArrow(page, x0, midDimY, hotX, midDimY);
  drawCadLabel(page, font, ['26 3/4" HOT'], (x0 + hotX) / 2, midDimY - 3.5, {
    size: 5.8,
    align: 'center',
    color: C.inkDark,
  });

  const botDimY = floorY + 16;
  line(page, drainX, drainY + 7, drainX, botDimY + 3, 0.45, C.inkLight, [2, 2]);
  drawDimArrow(page, x0, botDimY, drainX, botDimY);
  drawCadLabel(page, font, ['24" DRAIN CL'], (x0 + drainX) / 2, botDimY - 3.5, {
    size: 6.0,
    align: 'center',
    color: C.inkDark,
  });

  // Vertical rough-in dimensions on right
  const rDim1 = x0 + playW + 14;
  const rDim2 = x0 + playW + 34;
  line(page, drainX + 7, drainY, rDim1 + 3, drainY, 0.45, C.inkLight, [2, 2]);
  drawDimArrow(page, rDim1, drainY, rDim1, floorY);
  drawCadLabel(page, font, ['15 3/4"'], rDim1 + 3, (drainY + floorY) / 2 + 2, {
    size: 5.8,
    color: C.inkDark,
  });

  line(page, hotX + 4, supplyY, rDim2 + 3, supplyY, 0.45, C.inkLight, [2, 2]);
  drawDimArrow(page, rDim2, supplyY, rDim2, floorY);
  drawCadLabel(page, font, ['20"'], rDim2 + 3, (supplyY + floorY) / 2 - 12, {
    size: 5.8,
    color: C.inkDark,
  });
}

function drawSectionABuiltIn(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const wallX = box.innerX + 48;
  const wallW = 8;
  const cabD = DIM.builtInD * s;
  const totalH = DIM.totalH * s;
  const ceilY = floorY - totalH;

  line(page, wallX - 10, floorY, wallX + cabD + 44, floorY, 1.35, C.black);
  rect(page, wallX, ceilY, wallW, totalH, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.9 });

  // Full-height built-in carcass
  rect(page, wallX + wallW, ceilY + DIM.scribeH * s, cabD, totalH - (DIM.scribeH + DIM.toeH) * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Toe-kick recessed
  rect(page, wallX + wallW, floorY - DIM.toeH * s, cabD - 3 * s, DIM.toeH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  // Mid rail at 34.5" AFF
  const midY = floorY - (DIM.toeH + DIM.lowerDoorH + DIM.midRailH) * s;
  rect(page, wallX + wallW, midY, cabD + 2, DIM.midRailH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // Transom divider
  const transY = midY - DIM.upperDoorH * s;
  line(page, wallX + wallW, transY, wallX + wallW + cabD, transY, 0.85, C.black);
  // Adjustable interior shelves
  for (const sh of [15, 25, 48, 60, 72]) {
    const sy = floorY - sh * s;
    line(page, wallX + wallW + 2, sy, wallX + wallW + cabD - 3, sy, 0.55, C.inkMid);
  }

  drawCadLabel(
    page,
    font,
    ['101" FULL-HEIGHT', '20" D STORAGE', '12" TRANSOM', '46 3/4" UPPERS', '30" LOWERS', '4 1/2" PLINTH'],
    wallX + wallW + cabD + 12,
    ceilY + 26,
    { size: 6.2, color: C.inkMid }
  );
}

function drawSectionBPlayKitchen(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const wallX = box.innerX + 48;
  const wallW = 8;
  const cabD = DIM.playD * s;
  const topY = floorY - DIM.playCounterH * s;
  const topH = DIM.playTopThk * s;
  const caseH = DIM.playCaseH * s;
  const caseBotY = topY + topH + caseH;

  line(page, wallX - 10, floorY, wallX + cabD + 56, floorY, 1.35, C.black);
  rect(page, wallX, floorY - 78 * s, wallW, 78 * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.9 });

  // Walnut casework
  rect(page, wallX + wallW, topY + topH, cabD, caseH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Countertop
  rect(page, wallX + wallW, topY, cabD + 1.5, topH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Undermount play sink & faucet
  rect(page, wallX + wallW + 4 * s, topY + topH, 11 * s, 6 * s, {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  drawGooseneckFaucet(page, wallX + wallW + 3.5 * s, topY, s * 1.15);

  // Stacked-ball legs front & back
  const legR = 3.0 * s;
  drawStackedBallLeg(page, wallX + wallW + 3.8 * s, caseBotY, DIM.legH * s, legR);
  drawStackedBallLeg(page, wallX + wallW + cabD - 3.8 * s, caseBotY, DIM.legH * s, legR);
  drawScallopedApron(page, wallX + wallW + 3.8 * s + legR, wallX + wallW + cabD - 3.8 * s - legR, caseBotY, 1.8 * s, 3);

  drawCadLabel(
    page,
    font,
    ['30 1/2" COUNTER HT.', '19 1/2" WALNUT CASE', '9 3/4" TURNED LEGS', 'SCALLOPED APRON'],
    wallX + wallW + cabD + 14,
    topY + 4,
    { size: 6.2, color: C.inkMid }
  );
}

function drawSectionCPlumbingTowel(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const wallX = box.innerX + 48;
  const wallW = 8;
  const cabD = DIM.playD * s;
  const topY = floorY - DIM.playCounterH * s;
  const topH = DIM.playTopThk * s;
  const caseH = DIM.playCaseH * s;
  const caseBotY = topY + topH + caseH;

  line(page, wallX - 10, floorY, wallX + cabD + 56, floorY, 1.35, C.black);
  rect(page, wallX, floorY - 78 * s, wallW, 78 * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.9 });

  rect(page, wallX + wallW, topY + topH, cabD, caseH, { fill: C.white, stroke: C.black, strokeWidth: 0.95 });
  rect(page, wallX + wallW, topY, cabD + 1.5, topH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.95 });

  // Plumbing stub-outs in wall section (20" supply & 15 3/4" drain)
  const supY = floorY - DIM.supplyH * s;
  const drnY = floorY - DIM.drainH * s;
  line(page, wallX + 3, supY, wallX + wallW + 6 * s, supY, 1.1, C.black);
  line(page, wallX + 3, drnY, wallX + wallW + 8 * s, drnY, 1.5, C.black);

  // Projecting 1 1/2" walnut towel bar on front
  page.drawCircle({
    x: wallX + wallW + cabD + 4.5,
    y: py(topY + topH + 8 * s),
    size: 2.2,
    color: C.walnutTint,
    borderColor: C.black,
    borderWidth: 0.8,
  });

  // Turned legs
  const legR = 3.0 * s;
  drawStackedBallLeg(page, wallX + wallW + 3.8 * s, caseBotY, DIM.legH * s, legR);
  drawStackedBallLeg(page, wallX + wallW + cabD - 3.8 * s, caseBotY, DIM.legH * s, legR);

  drawCadLabel(
    page,
    font,
    ['1 1/2" WALNUT', 'TOWEL BAR', '20" SUPPLY STUB', '15 3/4" DRAIN STUB'],
    wallX + wallW + cabD + 14,
    topY + 4,
    { size: 6.2, color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-102 — FLOOR PLAN & 30° ISOMETRIC
// =============================================================================

function drawKidsFloorPlan(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = 4.2;
  const builtW = DIM.builtInW * s;
  const playW = DIM.playW * s;
  const totalW = builtW + playW;
  const depth = DIM.builtInD * s;
  const x0 = box.innerX + (box.innerW - totalW) / 2;
  const y0 = box.innerYTop + (box.innerH - depth) / 2 - 20;
  const wallT = 9;

  // Back wall & right return wall
  rect(page, x0 - wallT, y0 - wallT, totalW + wallT * 2, wallT, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  rect(page, x0 - wallT, y0, wallT, depth + 95, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  rect(page, x0 + totalW, y0, wallT, depth + 95, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.0,
  });

  // 72 3/4" × 20" Built-In Storage Wall (3 bays)
  rect(page, x0, y0, builtW, depth, { fill: C.white, stroke: C.black, strokeWidth: 1.1 });
  const bayW = builtW / 3;
  for (let i = 1; i < 3; i++) {
    line(page, x0 + i * bayW, y0, x0 + i * bayW, y0 + depth, 0.75, C.inkMid, [3, 2]);
  }
  drawCadLabel(page, font, ['72 3/4" W × 20" D BUILT-IN STORAGE WALL (3 BAYS)'], x0 + builtW / 2, y0 + depth / 2 + 2, {
    size: 6.2,
    align: 'center',
    color: C.inkDark,
  });

  // 48 1/4" × 20" Heirloom Play Kitchen
  const px0 = x0 + builtW;
  rect(page, px0, y0, playW, depth, { fill: C.walnutTint, stroke: C.black, strokeWidth: 1.1 });
  line(page, px0 + DIM.leftBayW * s, y0 + 2, px0 + DIM.leftBayW * s, y0 + depth - 2, 0.65, C.inkMid, [3, 2]);

  // Play sink in plan
  const sinkW = 14 * s;
  const sinkD = 11 * s;
  const sinkX = px0 + DIM.drainX * s - sinkW / 2;
  const sinkY = y0 + (depth - sinkD) / 2 + 1.5 * s;
  drawRoundedRect(page, sinkX, sinkY, sinkW, sinkD, 4, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 0.9,
  });
  page.drawCircle({ x: px0 + DIM.drainX * s, y: py(sinkY + sinkD / 2), size: 3.5, borderColor: C.black, borderWidth: 0.7 });
  // Dashed stacked-ball leg footprints at 4 corners
  const legOffX = 5.8 * s;
  for (const [lx, ly] of [
    [px0 + legOffX, y0 + 4 * s],
    [px0 + playW - legOffX, y0 + 4 * s],
    [px0 + legOffX, y0 + depth - 4 * s],
    [px0 + playW - legOffX, y0 + depth - 4 * s],
  ]) {
    page.drawCircle({ x: lx, y: py(ly), size: 3.0 * s, borderColor: C.inkMid, borderWidth: 0.6 });
  }

  // Section cut bubbles A, B, C
  drawSectionBadge(page, font, x0 + builtW / 2, y0 + depth + 34, 10, 'A', C.orange);
  line(page, x0 + builtW / 2, y0 - 12, x0 + builtW / 2, y0 + depth + 22, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, px0 + DIM.drainX * s, y0 + depth + 34, 10, 'B', C.cyan);
  line(page, px0 + DIM.drainX * s, y0 - 12, px0 + DIM.drainX * s, y0 + depth + 22, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, px0 + DIM.leftBayW * s + (DIM.rightBayW * s) / 2, y0 + depth + 34, 10, 'C', C.yellow);
  line(
    page,
    px0 + DIM.leftBayW * s + (DIM.rightBayW * s) / 2,
    y0 - 12,
    px0 + DIM.leftBayW * s + (DIM.rightBayW * s) / 2,
    y0 + depth + 22,
    0.6,
    C.inkMid,
    [4, 3]
  );

  // Overall width dimensions
  drawDimArrow(page, x0, y0 - 26, x0 + builtW, y0 - 26);
  drawCadLabel(page, font, ['72 3/4"'], x0 + builtW / 2, y0 - 30, { size: 6.4, align: 'center', color: C.inkDark });
  drawDimArrow(page, px0, y0 - 26, px0 + playW, y0 - 26);
  drawCadLabel(page, font, ['48 1/4"'], px0 + playW / 2, y0 - 30, { size: 6.4, align: 'center', color: C.inkDark });
  drawDimArrow(page, x0, y0 - 46, x0 + totalW, y0 - 46);
  drawCadLabel(page, font, ['121" OVERALL WALL SPAN'], x0 + totalW / 2, y0 - 50, {
    size: 6.8,
    align: 'center',
    color: C.inkDark,
  });
}

function drawKidsIsometric(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = 0.5;
  const sc = 2.85;
  const ox = box.innerX + box.innerW * 0.31;
  const oy = box.innerYTop + box.innerH * 0.60;

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
    fills: { top?: ReturnType<typeof rgb>; front?: ReturnType<typeof rgb>; right?: ReturnType<typeof rgb> },
    sw = 0.85
  ) => {
    // Front face (y = y + d)
    polygon(page, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], {
      fill: fills.front ?? C.white,
      stroke: C.black,
      strokeWidth: sw,
    });
    // Right face (x = x + w)
    polygon(page, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], {
      fill: fills.right ?? C.white,
      stroke: C.black,
      strokeWidth: sw,
    });
    // Top face (z = z + h)
    polygon(page, [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], {
      fill: fills.top ?? C.white,
      stroke: C.black,
      strokeWidth: sw,
    });
  };

  // Floor & back wall
  polygon(page, [iso(0, 0, 0), iso(124, 0, 0), iso(124, 54, 0), iso(0, 54, 0)], {
    fill: C.white,
    stroke: C.inkFaint,
    strokeWidth: 0.65,
  });
  polygon(page, [iso(0, 0, 0), iso(124, 0, 0), iso(124, 0, 101), iso(0, 0, 101)], {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // 72 3/4" × 20" × 101" Built-In Storage Wall
  drawIsoBox(0, 0, 0, 72.75, 20, 101, { top: C.wallFill, front: C.white, right: C.oakTint }, 0.95);
  // Horizontal & vertical door divisions on front of built-in
  for (const z of [4.5, 34.5, 35.75, 82.5, 94.5, 97.5]) {
    line(page, ...iso(0, 20, z), ...iso(72.75, 20, z), 0.7, C.black);
  }
  for (let i = 1; i < 6; i++) {
    const x = (72.75 / 6) * i;
    line(page, ...iso(x, 20, 4.5), ...iso(x, 20, 34.5), 0.6, C.black);
    line(page, ...iso(x, 20, 35.75), ...iso(x, 20, 82.5), 0.6, C.black);
    if (i % 2 === 0) line(page, ...iso(x, 20, 82.5), ...iso(x, 20, 94.5), 0.65, C.black);
  }

  // Heirloom Play Kitchen (x: 73..121.25, y: 0..20, z: 9.75..30.5)
  // 4 stacked-ball legs drawn as stacked iso ellipses at corners
  for (const [lx, ly] of [
    [78, 17],
    [116, 17],
    [116, 4],
  ]) {
    const [bx, by] = iso(lx, ly, 9.75);
    drawStackedBallLeg(page, bx, by, 9.75 * sc, 3.0 * sc);
  }
  // Walnut casework body (z: 9.75..29.25)
  drawIsoBox(73.5, 0.5, 9.75, 47.25, 19.5, 19.5, { top: C.walnutTint, front: C.walnutTint, right: C.walnutTint }, 0.9);
  // Bay divider + Shaker doors on front
  line(page, ...iso(101.4, 20, 9.75), ...iso(101.4, 20, 29.25), 0.75, C.black);
  line(page, ...iso(73.5, 20, 24.5), ...iso(120.75, 20, 24.5), 0.7, C.black);
  line(page, ...iso(87.5, 20, 9.75), ...iso(87.5, 20, 24.5), 0.65, C.black);

  // Countertop (z: 29.25..30.5)
  drawIsoBox(73, 0, 29.25, 48.25, 20.5, 1.25, { top: C.walnutTint, front: C.walnutTint, right: C.walnutTint }, 0.95);
  // Play sink cutout on top
  polygon(page, [iso(90, 5, 30.5), iso(104, 5, 30.5), iso(104, 16, 30.5), iso(90, 16, 30.5)], {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  // Faucet
  line(page, ...iso(97, 3.5, 30.5), ...iso(97, 3.5, 41.5), 1.0, C.black);
  line(page, ...iso(97, 3.5, 41.5), ...iso(97, 7, 41.5), 0.9, C.black);

  drawCadLabel(
    page,
    font,
    ['ORTHOGRAPHIC 30° ISOMETRIC — 72 3/4" × 101" BUILT-IN & 48 1/4" SOLID WALNUT PLAY KITCHEN'],
    box.innerX + box.innerW / 2,
    box.innerYTop + box.innerH - 12,
    { size: 6.7, align: 'center', color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-103 — DIMENSIONED KITCHENETTE, BUILT-IN DETAIL & 1:1 TURNED PROFILES
// =============================================================================

function drawPlayKitchenDetailElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const playW = DIM.playW * s;
  const x0 = box.innerX + (box.innerW - playW) / 2;
  const pTopY = floorY - DIM.playCounterH * s;
  const pTopH = DIM.playTopThk * s;
  const pCaseTopY = pTopY + pTopH;
  const pCaseH = DIM.playCaseH * s;
  const pCaseBotY = pCaseTopY + pCaseH;
  const legH = DIM.legH * s;

  line(page, x0 - 32, floorY, x0 + playW + 42, floorY, 1.4, C.black);
  drawGooseneckFaucet(page, x0 + DIM.drainX * s - 2 * s, pTopY, s);

  const legR = 3.2 * s;
  const leftLegX = x0 + 5.8 * s;
  const rightLegX = x0 + playW - 6.8 * s;
  drawStackedBallLeg(page, leftLegX, pCaseBotY, legH, legR);
  drawStackedBallLeg(page, rightLegX, pCaseBotY, legH, legR);
  drawScallopedApron(page, leftLegX + legR * 0.78, rightLegX - legR * 0.78, pCaseBotY, 2.2 * s, 8);

  rect(page, x0 - 1.5, pTopY, playW + 3, pTopH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 1.0 });
  rect(page, x0, pCaseTopY, playW, pCaseH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 1.0 });

  const lbW = DIM.leftBayW * s;
  const rbW = playW - lbW;
  const drwBandH = 4.6 * s;

  // Left bay
  rect(page, x0 + 2, pCaseTopY + 1.5, lbW - 3, drwBandH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.75 });
  rect(page, x0 + 4, pCaseTopY + drwBandH * 0.44, lbW - 7, 1.5 * s, { fill: C.white, stroke: C.black, strokeWidth: 0.65 });
  const doorY = pCaseTopY + drwBandH + 2.6;
  const lDoorH = pCaseH - drwBandH - 4.4;
  const lHalf = (lbW - 4.5) / 2;
  drawShakerDoor(page, x0 + 2, doorY, lHalf, lDoorH, 3.0);
  drawShakerDoor(page, x0 + 3.5 + lHalf, doorY, lHalf, lDoorH, 3.0);

  // Right bay
  const rbx = x0 + lbW;
  rect(page, rbx + 1.5, pCaseTopY + 1.5, rbW - 3.5, drwBandH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.75 });
  rect(page, rbx + 3.5, pCaseTopY + drwBandH * 0.44, rbW - 7.5, 1.5 * s, { fill: C.white, stroke: C.black, strokeWidth: 0.65 });
  const towelY = doorY + 2.8 * s;
  drawRoundedRect(page, rbx + 1.5, towelY, rbW + 4.5 * s, 1.5 * s, 2.2, {
    fill: C.walnutTint,
    borderColor: C.black,
    borderWidth: 0.85,
  });
  const rDoorY = towelY + 2.2 * s;
  drawShakerDoor(page, rbx + 1.5, rDoorY, rbW - 3.5, pCaseBotY - rDoorY - 2, 2.8);

  // Exact Rhino fractional dimensions!
  // Top bays: 27 15/16" & 19 3/4"
  const topDimY = pTopY - 14;
  drawDimArrow(page, x0, topDimY, x0 + lbW, topDimY);
  drawCadLabel(page, font, ['27 15/16"'], x0 + lbW / 2, topDimY - 4, { size: 6.4, align: 'center', color: C.inkDark });
  drawDimArrow(page, rbx, topDimY, x0 + playW, topDimY);
  drawCadLabel(page, font, ['19 3/4"'], rbx + rbW / 2, topDimY - 4, { size: 6.4, align: 'center', color: C.inkDark });

  // Left vertical dims: 30 1/2" overall & 19 1/2" casework
  drawDimArrow(page, x0 - 22, pTopY, x0 - 22, floorY);
  drawCadLabel(page, font, ['30 1/2"'], x0 - 26, (pTopY + floorY) / 2, { size: 6.4, align: 'right', color: C.inkDark });
  drawDimArrow(page, x0 - 9, pCaseTopY, x0 - 9, pCaseBotY);
  drawCadLabel(page, font, ['19 1/2"'], x0 - 12, (pCaseTopY + pCaseBotY) / 2, { size: 6.0, align: 'right', color: C.inkMid });

  // Right vertical dim: 9 3/4" stacked-ball legs
  drawDimArrow(page, x0 + playW + 18, pCaseBotY, x0 + playW + 18, floorY);
  drawCadLabel(page, font, ['9 3/4" LEGS'], x0 + playW + 22, (pCaseBotY + floorY) / 2 + 2, {
    size: 6.2,
    color: C.inkDark,
  });

  // Bottom leg spans: 30 1/4" clear & 42 1/4" overall
  drawDimArrow(page, leftLegX + legR, floorY + 12, rightLegX - legR, floorY + 12);
  drawCadLabel(page, font, ['30 1/4" CLEAR'], (leftLegX + rightLegX) / 2, floorY + 9, {
    size: 5.8,
    align: 'center',
    color: C.inkMid,
  });
  drawDimArrow(page, leftLegX, floorY + 24, rightLegX, floorY + 24);
  drawCadLabel(page, font, ['42 1/4" LEG SPAN'], (leftLegX + rightLegX) / 2, floorY + 21, {
    size: 6.0,
    align: 'center',
    color: C.inkDark,
  });

  // Section D badge
  line(page, leftLegX, pTopY - 30, leftLegX, floorY + 8, 0.6, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, leftLegX, pTopY - 34, 9.5, 'D', C.orange);
}

function drawSectionDLegApron(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const cx = box.innerX + box.innerW * 0.42;
  const floorY = box.innerYTop + box.innerH - 32;
  const s = 12.5; // Enlarged detail scale
  const legH = DIM.legH * s;
  const caseBotY = floorY - legH;

  line(page, cx - 80, floorY, cx + 115, floorY, 1.4, C.black);

  // Lower portion of walnut casework + bottom rail
  rect(page, cx - 44, caseBotY - 68, 88, 68, { fill: C.white, stroke: C.black, strokeWidth: 1.0 });
  rect(page, cx - 44, caseBotY - 14, 88, 14, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.9 });

  // Turned mortise-and-tenon dowel dashed inside bottom rail
  rect(page, cx - 8, caseBotY - 24, 16, 24, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.7,
    dashArray: [3, 2],
  });

  // Enlarged stacked-ball leg
  drawStackedBallLeg(page, cx, caseBotY, legH, 24);

  // Scalloped apron profile extending right
  drawScallopedApron(page, cx + 22, cx + 98, caseBotY, 14, 3);

  drawCadLabel(page, font, ['3/4" SOLID WALNUT', 'CASEWORK BOTTOM RAIL'], cx + 52, caseBotY - 42, {
    size: 6.4,
    color: C.inkDark,
  });
  drawCadLabel(page, font, ['INTEGRAL TURNED TENON', '(GLUED INTO CASEWORK)'], cx + 52, caseBotY - 16, {
    size: 6.2,
    color: C.inkMid,
  });
  drawCadLabel(page, font, ['9 3/4" H LATHE-TURNED', 'STACKED-BALL WALNUT LEG'], cx + 38, caseBotY + 56, {
    size: 6.4,
    color: C.inkDark,
  });
}

function drawBuiltInDetailElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const builtW = DIM.builtInW * s;
  const x0 = box.innerX + (box.innerW - builtW) / 2;
  const ceilY = floorY - DIM.totalH * s;
  const toeY = floorY - DIM.toeH * s;
  const lowTopY = toeY - DIM.lowerDoorH * s;
  const midTopY = lowTopY - DIM.midRailH * s;
  const upTopY = midTopY - DIM.upperDoorH * s;
  const transTopY = upTopY - DIM.transomH * s;
  const crownTopY = transTopY - DIM.crownH * s;

  line(page, x0 - 24, floorY, x0 + builtW + 24, floorY, 1.4, C.black);
  rect(page, x0, ceilY, builtW, DIM.totalH * s, { fill: C.white, stroke: C.black, strokeWidth: 1.0 });
  rect(page, x0, ceilY, builtW, DIM.scribeH * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.75 });
  rect(page, x0, crownTopY, builtW, DIM.crownH * s, { fill: C.white, stroke: C.black, strokeWidth: 0.8 });

  const bayW = builtW / 3;
  for (let b = 0; b < 3; b++) {
    const bx = x0 + b * bayW;
    rect(page, bx, transTopY, bayW, DIM.transomH * s, { fill: C.white, stroke: C.black, strokeWidth: 0.8 });
    rect(page, bx, upTopY, bayW / 2, DIM.upperDoorH * s, { fill: C.white, stroke: C.black, strokeWidth: 0.8 });
    rect(page, bx + bayW / 2, upTopY, bayW / 2, DIM.upperDoorH * s, { fill: C.white, stroke: C.black, strokeWidth: 0.8 });
    rect(page, bx, lowTopY, bayW / 2, DIM.lowerDoorH * s, { fill: C.white, stroke: C.black, strokeWidth: 0.8 });
    rect(page, bx + bayW / 2, lowTopY, bayW / 2, DIM.lowerDoorH * s, { fill: C.white, stroke: C.black, strokeWidth: 0.8 });
  }
  rect(page, x0 - 1, midTopY, builtW + 2, DIM.midRailH * s, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.85 });
  rect(page, x0, toeY, builtW, DIM.toeH * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.85 });

  // Vertical datum stack on left
  const dX = x0 - 12;
  const bands: Array<[number, number, string]> = [
    [ceilY, crownTopY, '3 1/2"'],
    [transTopY, upTopY, '12"'],
    [upTopY, midTopY, '46 3/4"'],
    [lowTopY, toeY, '30"'],
    [toeY, floorY, '4 1/2"'],
  ];
  for (const [y1, y2, lbl] of bands) {
    drawDimArrow(page, dX, y1 + 1, dX, y2 - 1);
    drawCadLabel(page, font, [lbl], dX - 4, (y1 + y2) / 2 + 2, { size: 5.8, align: 'right', color: C.inkDark });
  }

  // Overall width
  drawDimArrow(page, x0, floorY + 14, x0 + builtW, floorY + 14);
  drawCadLabel(page, font, ['72 3/4" OVERALL (3 × 24 1/4" BAYS)'], x0 + builtW / 2, floorY + 11, {
    size: 6.2,
    align: 'center',
    color: C.inkDark,
  });
}

function drawKidsJoineryProfiles(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const pad = 12;
  const gap = 12;
  const cardW = (box.innerW - pad * 2 - gap * 2) / 3;
  const cardH = box.innerH - pad * 2;
  const cy = box.innerYTop + pad;

  const cards = [
    { title: '4A / STACKED-BALL LEG', sub: '9 3/4" H SOLID WALNUT' },
    { title: '4B / SCALLOPED APRON', sub: 'CONTINUOUS CNC PROFILE' },
    { title: '4C / SHAKER & TOWEL BAR', sub: '1 1/2" SOLID WALNUT RAIL' },
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
      drawStackedBallLeg(page, midX, midY - 46, 94, 24);
      drawCadLabel(page, font, ['LATHE-TURNED WALNUT'], midX, cy + cardH - 14, {
        size: 5.8,
        align: 'center',
        color: C.inkMid,
      });
    } else if (i === 1) {
      drawScallopedApron(page, midX - 58, midX + 58, midY - 12, 16, 4);
      drawDimArrow(page, midX - 58, midY - 24, midX - 29, midY - 24);
      drawCadLabel(page, font, ['3 3/4" PITCH'], midX - 43, midY - 28, {
        size: 5.8,
        align: 'center',
        color: C.inkDark,
      });
      drawCadLabel(page, font, ['SOLID BLACK WALNUT APRON'], midX, cy + cardH - 14, {
        size: 5.8,
        align: 'center',
        color: C.inkMid,
      });
    } else {
      drawShakerDoor(page, midX - 44, midY - 36, 88, 72, 12);
      drawRoundedRect(page, midX - 50, midY - 12, 100, 12, 4, {
        fill: C.walnutTint,
        borderColor: C.black,
        borderWidth: 0.9,
      });
      drawCadLabel(page, font, ['MORTISED SHAKER STILES'], midX, cy + cardH - 14, {
        size: 5.8,
        align: 'center',
        color: C.inkMid,
      });
    }
  });
}

// =============================================================================
// MAIN BUILD
// =============================================================================

async function buildKidsKitchenSheets() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle('casegoods — Heirloom Play Kitchen & Built-In Wall (DWG 1070MCG · A-101 to A-103)');
  pdfDoc.setAuthor('Josh Heinke — casegoods (Omaha, NE)');
  pdfDoc.setCreator('casegoods Omaha Architectural Drawing Studio');

  const nexaFont = await pdfDoc.embedFont(fs.readFileSync(FONT_NEXA));
  const logoFullImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_FULL));
  const logoIconsImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_ICONS));

  // SHEET A-101 — ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page1, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1070MCG',
    projectTitleLine: 'HEIRLOOM PLAY KITCHEN',
    scaleText: 'FRACTIONAL · 2D CAD',
    sheetCode: 'A-101',
    sheetIndexText: 'SHEET 01 / 03',
    sheetCategory: 'ELEVATIONS & SECTIONS',
    bannerBg: C.orange,
    bannerLeft: 'A-101  /  ARCHITECTURAL ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE',
    bannerRight: 'HEIRLOOM PLAY KITCHEN & BUILT-IN WALL  ·  DWG 1070MCG  ·  OMAHA STUDIO',
    accentColor: C.orange,
  });

  const row1Y = 174;
  const row1H = 384;
  const elevAW = 940;
  const elevBW = PAGE_W - 88 - elevAW - 16; // 556

  const boxElevA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row1Y,
    w: elevAW,
    h: row1H,
    title: '01 / ELEVATION A — FULL WALL (BUILT-IN & PLAY KITCHEN)',
    subtitle: '72 3/4" × 101" BUILT-IN WALL · 48 1/4" × 30 1/2" WALNUT PLAY KITCHEN',
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
    title: '02 / ELEVATION B — PLUMBING ROUGH-IN',
    subtitle: '20" SUPPLIES · 15 3/4" DRAIN CL',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.cyan,
    subtitleSize: 7.8,
  });

  const elevFloorY = boxElevA.innerYTop + boxElevA.innerH - 28;
  const fullScale = Math.min((boxElevA.innerW - 110) / (DIM.builtInW + DIM.playW), (boxElevA.innerH - 68) / DIM.totalH);
  drawFullWallElevation(page1, nexaFont, boxElevA, fullScale, elevFloorY);

  const roughScale = Math.min((boxElevB.innerW - 120) / DIM.playW, (boxElevB.innerH - 94) / 54);
  drawPlumbingRoughInElevation(page1, nexaFont, boxElevB, roughScale, elevFloorY);

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
    subtitle: 'BUILT-IN STORAGE',
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
    subtitle: 'PLAY KITCHEN & SINK',
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
    subtitle: 'PLUMBING & TOWEL RAIL',
    headerBg: C.yellow,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  const secFloorY = boxSecA.innerYTop + boxSecA.innerH - 18;
  const secAScale = (boxSecA.innerH - 34) / DIM.totalH;
  const secPlayScale = (boxSecB.innerH - 42) / 68;
  drawSectionABuiltIn(page1, nexaFont, boxSecA, secAScale, secFloorY);
  drawSectionBPlayKitchen(page1, nexaFont, boxSecB, secPlayScale, secFloorY);
  drawSectionCPlumbingTowel(page1, nexaFont, boxSecC, secPlayScale, secFloorY);

  drawSpecKeyCard(
    page1,
    nexaFont,
    44 + (secW + 16) * 3,
    row2Y,
    specW,
    row2H,
    [
      ['PRIMARY HARDWOOD', 'SOLID AMERICAN BLACK WALNUT'],
      ['TURNED LEGS', '9 3/4" H LATHE-TURNED STACKED-BALL'],
      ['APRON PROFILE', 'CONTINUOUS SCALLOPED SOLID WALNUT'],
      ['BUILT-IN WALL', '72 3/4" W × 101" H FULL-HEIGHT STORAGE'],
      ['PLAY KITCHENETTE', '48 1/4" W × 30 1/2" H · 15 3/4" DRAIN'],
      ['TOLERANCE', '± 1/32" RHINO 3D · DWG 1070MCG'],
    ],
    'VERIFY ALL PLUMBING ROUGH-INS & CEILING DATUM (101") PRIOR TO FABRICATION'
  );

  // SHEET A-102 — FLOOR PLAN & 30° ISOMETRIC
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page2, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1070MCG',
    projectTitleLine: 'HEIRLOOM PLAY KITCHEN',
    scaleText: 'FRACTIONAL · 2D CAD',
    sheetCode: 'A-102',
    sheetIndexText: 'SHEET 02 / 03',
    sheetCategory: 'PLAN & ISOMETRIC',
    bannerBg: C.cyan,
    bannerLeft: 'A-102  /  FLOOR PLAN, HORIZONTAL SECTION & 30° ORTHOGRAPHIC ISOMETRIC',
    bannerRight: 'TRUE-PROPORTION GEOMETRY  ·  121" TOTAL SPAN  ·  1070MCG',
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
    title: '01 / FLOOR PLAN & HORIZONTAL SECTION',
    subtitle: 'DASHED: 4× STACKED-BALL LEG FOOTPRINTS & DRAIN CL',
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

  drawKidsFloorPlan(page2, nexaFont, { ...boxPlan, innerH: boxPlan.innerH - 54 });
  drawSectionCutLegend(page2, nexaFont, 60, a102Y + a102H - 50, planW - 32, [
    { code: 'A', text: 'BUILT-IN WALL', color: C.orange, x: 214 },
    { code: 'B', text: 'PLAY SINK', color: C.cyan, x: 382 },
    { code: 'C', text: 'TOWEL RAIL', color: C.yellow, x: 540 },
  ]);
  drawKidsIsometric(page2, nexaFont, boxIso);

  // SHEET A-103 — DIMENSIONED KITCHENETTE, BUILT-IN DETAIL & 1:1 JOINERY
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page3, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1070MCG',
    projectTitleLine: 'HEIRLOOM PLAY KITCHEN',
    scaleText: 'FRACTIONAL · 2D CAD',
    sheetCode: 'A-103',
    sheetIndexText: 'SHEET 03 / 03',
    sheetCategory: 'KITCHENETTE & JOINERY',
    bannerBg: C.yellow,
    bannerLeft: 'A-103  /  DIMENSIONED PLAY KITCHEN, BUILT-IN WALL & TURNED JOINERY DETAILS',
    bannerRight: 'FRACTIONAL SHOP DRAWINGS  ·  STACKED-BALL LEGS · SCALLOPED APRON  ·  1070MCG',
    accentColor: C.yellow,
  });

  const a103TopY = 174;
  const a103RowH = 357;
  const a103BotY = a103TopY + a103RowH + 16;
  const leftColW = 790;
  const rightColW = PAGE_W - 88 - leftColW - 16;

  const boxElevC = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103TopY,
    w: leftColW,
    h: a103RowH,
    title: '01 / DETAIL ELEVATION C — HEIRLOOM PLAY KITCHEN (48 1/4" W)',
    subtitle: '27 15/16" SINK BAY · 19 3/4" TOWEL BAY · 9 3/4" STACKED-BALL LEGS',
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
    title: '03 / SECTION D — LEG TENON & APRON',
    subtitle: 'ENLARGED STACKED-BALL LEG JOINERY',
    headerBg: C.orange,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  const boxElevD = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103BotY,
    w: leftColW,
    h: a103RowH,
    title: '02 / DETAIL ELEVATION D — 72 3/4" × 101" BUILT-IN STORAGE WALL',
    subtitle: 'FULL VERTICAL FRACTIONAL DATUM STACK (4 1/2" TO 101")',
    headerBg: C.gray,
    headerTextColor: C.black,
    subtitleSize: 7.9,
  });

  const boxJoinery = drawViewportCard(page3, nexaFont, {
    x: 44 + leftColW + 16,
    yTop: a103BotY,
    w: rightColW,
    h: a103RowH,
    title: '04 / MILLWORK JOINERY & TURNED PROFILES',
    subtitle: '1:1 ARCHITECTURAL SHOP DETAILS',
    headerBg: C.cyan,
    headerTextColor: C.black,
    subtitleSize: 8.0,
    showCornerTicks: false,
  });

  const playDetScale = Math.min((boxElevC.innerW - 150) / DIM.playW, (boxElevC.innerH - 102) / 42);
  const topFloorY = boxElevC.innerYTop + boxElevC.innerH - 36;
  drawPlayKitchenDetailElevation(page3, nexaFont, boxElevC, playDetScale, topFloorY);
  drawSectionDLegApron(page3, nexaFont, boxSecD);

  const builtDetScale = Math.min((boxElevD.innerW - 140) / DIM.builtInW, (boxElevD.innerH - 54) / DIM.totalH);
  const botFloorY = boxElevD.innerYTop + boxElevD.innerH - 28;
  drawBuiltInDetailElevation(page3, nexaFont, boxElevD, builtDetScale, botFloorY);
  drawKidsJoineryProfiles(page3, nexaFont, boxJoinery);

  const pdfBytes = await pdfDoc.save();
  const pdfOutPath = path.join(OUT_DIR, 'casegoods-1070MCG-kids-kitchen-submittal-A101-A103.pdf');
  fs.writeFileSync(pdfOutPath, pdfBytes);

  rasterizeSubmittalPdf(pdfOutPath, [
    { page: 1, name: 'casegoods-1070MCG-A101-elevations-sections.png' },
    { page: 2, name: 'casegoods-1070MCG-A102-plan-isometric.png' },
    { page: 3, name: 'casegoods-1070MCG-A103-kitchenette-joinery-details.png' },
  ]);
  console.log(`Generated PDF: ${pdfOutPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

buildKidsKitchenSheets().catch((err) => {
  console.error(err);
  process.exit(1);
});
