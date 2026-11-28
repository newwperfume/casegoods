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
// 1064HEM-WB WET BAR — TRUE-PROPORTION ARCHITECTURAL DIMENSIONS (INCHES)
// =============================================================================
const DIM = {
  alcoveW: 96,       // Wall-to-wall back bar width
  backBarD: 24,      // Back bar credenza depth
  counterH: 36,      // Standard bar counter height (34.5" case + 1.5" top)
  topThk: 1.5,       // Matte black honed quartz top thickness
  toeH: 3.0,         // Recessed walnut toe-kick height
  bayW: 24,          // 4 equal 24" bays on back bar
  windowSillH: 38.5, // Window sill directly above back bar counter
  windowH: 34,       // Horizontal 2-panel window height
  ceilH: 96,         // 8'-0" alcove ceiling datum
  aisleClear: 42,    // Clear walkway between back bar and island
  islandW: 84,       // Overall countertop width (70" carcass + 14" overhang)
  islandCarcassW: 70,// Base carcass width (42" sink base + 28" drawer stack)
  islandOverhangW: 14,// Cantilevered radiused West end overhang
  islandD: 36,       // Overall island countertop depth
  islandCarcassD: 32,// Base carcass depth (with 4" foot rail projection)
  islandRadius: 6,   // Corner radius at West end of island top
  sinkBaseW: 42,     // Working side sink base (orange apron + double doors)
  drawerStackW: 28,  // Working side 4-drawer Bauhaus stack
  footRailH: 3.5,    // Sculpted solid walnut foot rail height
  footRailProj: 4.0, // Foot rail projection forward of tambour face
  sinkW: 15,         // Undermount stainless bar sink width
  sinkD: 17,         // Undermount stainless bar sink depth
};

/** Draw vertical book-matched walnut grain lines inside a door panel */
function drawWalnutGrain(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  linesCount = 6
) {
  const step = w / (linesCount + 1);
  for (let i = 1; i <= linesCount; i++) {
    line(page, x + i * step, yTop + 1, x + i * step, yTop + h - 1, 0.28, C.inkFaint);
  }
}

/** Draw oversized half-round vertical fluted White Oak tambour columns */
function drawTambourElevation(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  columnCount = 16
) {
  rect(page, x, yTop, w, h, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  const colW = w / columnCount;
  for (let i = 1; i < columnCount; i++) {
    const cx = x + i * colW;
    line(page, cx, yTop + 0.5, cx, yTop + h - 0.5, 0.72, C.black);
  }
  // Subtle cylindrical ridge highlight + shadow line inside each tambour column
  for (let i = 0; i < columnCount; i++) {
    const rx = x + (i + 0.34) * colW;
    const sx = x + (i + 0.76) * colW;
    line(page, rx, yTop + 0.8, rx, yTop + h - 0.8, 0.28, C.inkFaint);
    line(page, sx, yTop + 0.8, sx, yTop + h - 0.8, 0.32, C.inkLight);
  }
}

/** Draw a simple CAD bar faucet in elevation */
function drawFaucetElev(page: PDFPage, cx: number, counterYTop: number, s: number) {
  const baseW = 2.2 * s;
  const baseH = 1.0 * s;
  const stemH = 9.5 * s;
  const spoutR = 2.8 * s;
  rect(page, cx - baseW / 2, counterYTop - baseH, baseW, baseH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  // Vertical neck + horizontal spout
  const d = `M ${cx.toFixed(2)},${(counterYTop - baseH).toFixed(2)} L ${cx.toFixed(2)},${(
    counterYTop -
    baseH -
    stemH
  ).toFixed(2)} Q ${cx.toFixed(2)},${(counterYTop - baseH - stemH - spoutR * 0.7).toFixed(2)} ${(
    cx - spoutR
  ).toFixed(2)},${(counterYTop - baseH - stemH - spoutR * 0.7).toFixed(2)} L ${(
    cx -
    spoutR * 1.65
  ).toFixed(2)},${(counterYTop - baseH - stemH - spoutR * 0.7).toFixed(2)} L ${(
    cx -
    spoutR * 1.65
  ).toFixed(2)},${(counterYTop - baseH - stemH + 1.2 * s).toFixed(2)}`;
  page.drawSvgPath(d, {
    x: 0,
    y: PAGE_H,
    borderColor: C.black,
    borderWidth: 1.05,
  });
}

// =============================================================================
// SHEET A-101 DRAWINGS
// =============================================================================

function drawBackBarElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const totalW = DIM.alcoveW * s;
  const x0 = box.innerX + (box.innerW - totalW) / 2;
  const topY = floorY - DIM.counterH * s;
  const topH = DIM.topThk * s;
  const toeH = DIM.toeH * s;
  const cabTopY = topY + topH;
  const cabH = (DIM.counterH - DIM.topThk - DIM.toeH) * s;

  // Floor & alcove side walls
  line(page, x0 - 18, floorY, x0 + totalW + 18, floorY, 1.4, C.black);
  rect(page, x0 - 7, floorY - DIM.ceilH * s * 0.82, 7, DIM.ceilH * s * 0.82, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  rect(page, x0 + totalW, floorY - DIM.ceilH * s * 0.82, 7, DIM.ceilH * s * 0.82, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Overhead 2-panel horizontal window above back bar
  const winY = floorY - (DIM.windowSillH + DIM.windowH) * s;
  const winH = DIM.windowH * s;
  const winPad = 4 * s;
  rect(page, x0 + winPad, winY, totalW - winPad * 2, winH, {
    fill: C.glassTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  rect(page, x0 + winPad + 3, winY + 3, totalW - winPad * 2 - 6, winH - 6, {
    stroke: C.inkMid,
    strokeWidth: 0.5,
  });
  // Center mullion
  const midWinX = x0 + totalW / 2;
  rect(page, midWinX - 2, winY, 4, winH, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  // Subtle glazing slashes
  for (const gx of [x0 + totalW * 0.27, x0 + totalW * 0.73]) {
    const gy = winY + winH * 0.52;
    line(page, gx - 5, gy + 5, gx + 5, gy - 5, 0.45, C.inkLight);
    line(page, gx - 2, gy + 6, gx + 6, gy - 2, 0.35, C.inkFaint);
  }
  drawCadLabel(page, font, ['EXISTING 2-PANEL ALCOVE WINDOW'], x0 + totalW / 2, winY + winH * 0.26, {
    size: 6.4,
    align: 'center',
    color: C.inkLight,
  });

  // 1.5" Matte black honed quartz countertop
  rect(page, x0, topY, totalW, topH, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });

  // Walnut carcass outer frame (Bays 1–3)
  const bayW = DIM.bayW * s;
  const stile = 1.0 * s;
  rect(page, x0, cabTopY, bayW * 3, cabH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  // Recessed walnut toe-kick under Bays 1–3
  rect(page, x0 + 1.5, floorY - toeH, bayW * 3 - 3, toeH, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.8,
  });

  // Bay 1: Bauhaus Orange top drawer + vertical walnut door
  const b1x = x0 + stile;
  const innerBayW = bayW - stile * 1.5;
  const topDrwH = 6.2 * s;
  const railH = 0.9 * s;
  const doorH = cabH - topDrwH - railH - stile * 1.2;

  rect(page, b1x, cabTopY + stile * 0.6, innerBayW, topDrwH, {
    fill: C.orangeTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawCadLabel(page, font, ['ORANGE'], b1x + innerBayW / 2, cabTopY + stile * 0.6 + topDrwH * 0.65, {
    size: 5.5,
    align: 'center',
    color: C.inkDark,
  });
  const doorY = cabTopY + stile * 0.6 + topDrwH + railH;
  rect(page, b1x, doorY, innerBayW, doorH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawWalnutGrain(page, b1x, doorY, innerBayW, doorH, 5);
  // Integrated horizontal finger-pull notch at top center of door
  rect(page, b1x + innerBayW * 0.34, doorY + 0.6, innerBayW * 0.32, 1.4 * s, {
    fill: C.black,
  });

  // Bay 2: Fabrication Blue top drawer + vertical walnut door
  const b2x = x0 + bayW + stile * 0.5;
  rect(page, b2x, cabTopY + stile * 0.6, innerBayW, topDrwH, {
    fill: C.cyanTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawCadLabel(page, font, ['BLUE'], b2x + innerBayW / 2, cabTopY + stile * 0.6 + topDrwH * 0.65, {
    size: 5.5,
    align: 'center',
    color: C.inkDark,
  });
  rect(page, b2x, doorY, innerBayW, doorH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawWalnutGrain(page, b2x, doorY, innerBayW, doorH, 5);
  rect(page, b2x + innerBayW * 0.34, doorY + 0.6, innerBayW * 0.32, 1.4 * s, {
    fill: C.black,
  });

  // Bay 3: Two deep stacked color-blocked drawers (Gray top, Orange bottom)
  const b3x = x0 + bayW * 2 + stile * 0.5;
  const deepH = (cabH - stile * 1.2 - railH) / 2;
  rect(page, b3x, cabTopY + stile * 0.6, innerBayW, deepH, {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawCadLabel(page, font, ['GRAY'], b3x + innerBayW / 2, cabTopY + stile * 0.6 + deepH * 0.56, {
    size: 5.6,
    align: 'center',
    color: C.inkDark,
  });
  const botDeepY = cabTopY + stile * 0.6 + deepH + railH;
  rect(page, b3x, botDeepY, innerBayW, deepH, {
    fill: C.orangeTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawCadLabel(page, font, ['ORANGE'], b3x + innerBayW / 2, botDeepY + deepH * 0.58, {
    size: 5.6,
    align: 'center',
    color: C.inkDark,
  });
  rect(page, b3x + innerBayW * 0.34, botDeepY + 0.6, innerBayW * 0.32, 1.4 * s, {
    fill: C.black,
  });

  // Bay 4: 24" Undercounter Stainless Steel Beverage Refrigerator
  const b4x = x0 + bayW * 3 + 1.5;
  const fridgeW = bayW - 3;
  const fridgeH = (DIM.counterH - DIM.topThk - 0.6) * s;
  rect(page, b4x, cabTopY + 1.5, fridgeW, fridgeH - 1.5, {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Recessed top handle strip
  rect(page, b4x + 2, cabTopY + 3, fridgeW - 4, 2.2, {
    fill: C.inkMid,
  });
  drawCadLabel(
    page,
    font,
    ['24" BEV.', 'FRIDGE'],
    b4x + fridgeW / 2,
    cabTopY + fridgeH * 0.48,
    {
      size: 6.0,
      align: 'center',
      color: C.inkMid,
    }
  );

  // Section Cut A vertical datum through Bay 2/3
  const secAX = x0 + bayW * 1.5;
  line(page, secAX, winY - 22, secAX, floorY + 12, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secAX, winY - 26, 10.5, 'A', C.orange);

  // Overall width dimension below floor
  const dimY = floorY + 18;
  line(page, x0, floorY + 4, x0, dimY + 4, 0.45, C.inkLight);
  line(page, x0 + totalW, floorY + 4, x0 + totalW, dimY + 4, 0.45, C.inkLight);
  drawDimArrow(page, x0, dimY, x0 + totalW, dimY);
  drawCadLabel(
    page,
    font,
    ['96" OVERALL ALCOVE CREDENZA (4 × 24" BAYS) · 36" COUNTER HT.'],
    x0 + totalW / 2,
    dimY - 4,
    { size: 6.4, align: 'center', color: C.inkDark }
  );
}

function drawIslandGuestElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const totalW = DIM.islandW * s;
  const x0 = box.innerX + (box.innerW - totalW) / 2;
  const topY = floorY - DIM.counterH * s;
  const topH = DIM.topThk * s;
  const footH = DIM.footRailH * s;

  // Floor & East (right) anchor wall
  line(page, x0 - 22, floorY, x0 + totalW + 20, floorY, 1.4, C.black);
  rect(page, x0 + totalW, floorY - DIM.ceilH * s * 0.82, 7, DIM.ceilH * s * 0.82, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Bar faucet rising behind top on East (right) side
  drawFaucetElev(page, x0 + totalW - 11 * s, topY, s);

  // 1.5" Matte black honed quartz top (radiused on left end)
  rect(page, x0, topY, totalW, topH, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });
  // Walnut sub-apron reveal under countertop
  rect(page, x0 + 2 * s, topY + topH, totalW - 2 * s, 1.0 * s, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });

  // Left radiused walnut end return + right walnut stile
  const endPanelW = 9 * s;
  const rightStileW = 2.5 * s;
  const bodyTopY = topY + topH + 1.0 * s;
  const bodyH = floorY - bodyTopY - footH;

  // Left curved walnut return
  rect(page, x0 + 2 * s, bodyTopY, endPanelW, bodyH + footH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  drawWalnutGrain(page, x0 + 2 * s, bodyTopY, endPanelW, bodyH + footH, 3);

  // Oversized fluted White Oak tambour front (16 bold columns)
  const tambourX = x0 + 2 * s + endPanelW;
  const tambourW = totalW - 2 * s - endPanelW - rightStileW;
  drawTambourElevation(page, tambourX, bodyTopY, tambourW, bodyH, 16);

  // Right walnut stile
  rect(page, tambourX + tambourW, bodyTopY, rightStileW, bodyH + footH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Projecting sculpted solid walnut foot rail along bottom
  drawRoundedRect(page, tambourX - 1.5 * s, floorY - footH, tambourW + 3 * s, footH, 3.5, {
    fill: C.walnutTint,
    borderColor: C.black,
    borderWidth: 1.0,
  });
  line(
    page,
    tambourX - 0.5 * s,
    floorY - footH * 0.52,
    tambourX + tambourW + 0.5 * s,
    floorY - footH * 0.52,
    0.45,
    C.inkLight
  );

  // Section Cut B (Thru Sink, right) & Section Cut C (Thru Drawer Stack, left-center)
  const secCX = x0 + totalW * 0.34;
  const secBX = x0 + totalW * 0.78;
  const badgeY = topY - 46;
  line(page, secCX, badgeY + 12, secCX, floorY + 12, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secCX, badgeY, 10.5, 'C', C.yellow);

  line(page, secBX, badgeY + 12, secBX, floorY + 12, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secBX, badgeY, 10.5, 'B', C.cyan);

  // Annotations
  drawCadLabel(
    page,
    font,
    ['16× OVERSIZED FLUTED WHITE OAK TAMBOUR'],
    tambourX + tambourW * 0.52,
    badgeY - 22,
    { size: 6.3, align: 'center', color: C.inkMid }
  );

  // Overall width dimension below floor
  const dimY = floorY + 18;
  line(page, x0, floorY + 4, x0, dimY + 4, 0.45, C.inkLight);
  line(page, x0 + totalW, floorY + 4, x0 + totalW, dimY + 4, 0.45, C.inkLight);
  drawDimArrow(page, x0, dimY, x0 + totalW, dimY);
  drawCadLabel(
    page,
    font,
    ['84" PENINSULA ISLAND · SOLID WALNUT FOOT RAIL · 36" COUNTER HT.'],
    x0 + totalW / 2,
    dimY - 4,
    { size: 6.4, align: 'center', color: C.inkDark }
  );
}

function drawSectionABackBar(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const wallX = box.innerX + 46;
  const wallW = 9;
  const secH = 74 * s;
  const topY = floorY - DIM.counterH * s;
  const cabD = DIM.backBarD * s;
  const topH = DIM.topThk * s;
  const toeH = DIM.toeH * s;

  // Floor & North wall with window opening
  line(page, wallX - 10, floorY, wallX + cabD + 44, floorY, 1.35, C.black);
  rect(page, wallX, floorY - DIM.windowSillH * s, wallW, DIM.windowSillH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  // Window glazing in section
  const winTopY = floorY - (DIM.windowSillH + DIM.windowH) * s;
  rect(page, wallX + 2, winTopY, wallW - 4, DIM.windowH * s, {
    fill: C.glassTint,
    stroke: C.black,
    strokeWidth: 0.7,
  });
  rect(page, wallX, floorY - secH, wallW, Math.max(4, winTopY - (floorY - secH)), {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Back bar carcass
  rect(page, wallX + wallW, topY + topH, cabD - 1 * s, (DIM.counterH - DIM.topThk - DIM.toeH) * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Top drawer box & adjustable shelf inside
  rect(page, wallX + wallW + 2, topY + topH + 2, cabD - 6, 5.8 * s, {
    fill: C.orangeTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  line(
    page,
    wallX + wallW + 2,
    topY + topH + 17 * s,
    wallX + wallW + cabD - 4,
    topY + topH + 17 * s,
    0.75,
    C.inkMid
  );
  // Toe-kick recessed 3"
  rect(page, wallX + wallW, floorY - toeH, cabD - 4 * s, toeH, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  // Matte black top
  rect(page, wallX + wallW, topY, cabD, topH, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });

  drawCadLabel(
    page,
    font,
    ['ALCOVE WINDOW', '(38.5" SILL DATUM)'],
    wallX + wallW + 14,
    winTopY + 18,
    { size: 6.4, color: C.inkMid }
  );
  drawCadLabel(
    page,
    font,
    ['1.5" MATTE BLACK TOP', '24" D × 36" H CREDENZA', 'COLOR-BLOCKED DRAWER', 'RECESSED TOE-KICK'],
    wallX + wallW + cabD + 12,
    topY + 10,
    { size: 6.3, color: C.inkMid }
  );
}

function drawSectionBIslandSink(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const islandD = DIM.islandD * s;
  const x0 = box.innerX + (box.innerW - islandD) / 2 - 14;
  const topY = floorY - DIM.counterH * s;
  const topH = DIM.topThk * s;
  const footH = DIM.footRailH * s;
  const footProj = DIM.footRailProj * s;

  // Floor line
  line(page, x0 - 16, floorY, x0 + islandD + 26, floorY, 1.35, C.black);

  // Island carcass (working side on left, guest tambour side on right)
  const carcW = DIM.islandCarcassD * s;
  rect(page, x0 + 1 * s, topY + topH, carcW, (DIM.counterH - DIM.topThk - DIM.toeH) * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Toe-kick on working side
  rect(page, x0 + 4 * s, floorY - DIM.toeH * s, carcW - 3 * s, DIM.toeH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  // Tambour column profile on guest (right) face
  rect(page, x0 + 1 * s + carcW, topY + topH + 1 * s, 2.2 * s, (DIM.counterH - DIM.topThk - DIM.footRailH - 1) * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // Projecting solid walnut foot rail on guest (right) base
  drawRoundedRect(
    page,
    x0 + 1 * s + carcW,
    floorY - footH,
    footProj + 1.5 * s,
    footH,
    3,
    {
      fill: C.walnutTint,
      borderColor: C.black,
      borderWidth: 0.95,
    }
  );
  // Undermount stainless bar sink bowl
  const sinkX = x0 + 6 * s;
  const sinkW = 16 * s;
  const sinkDepth = 9.5 * s;
  rect(page, sinkX, topY + topH, sinkW, sinkDepth, {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // P-trap dashed line
  line(page, sinkX + sinkW / 2, topY + topH + sinkDepth, sinkX + sinkW / 2, topY + topH + sinkDepth + 12 * s, 0.55, C.inkLight, [3, 2]);

  // Matte black countertop
  rect(page, x0, topY, islandD, topH, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  drawFaucetElev(page, sinkX + sinkW - 1.5 * s, topY, s * 0.95);

  drawCadLabel(
    page,
    font,
    ['15" × 17" STAINLESS', 'UNDERMOUNT BAR SINK'],
    x0 + islandD / 2,
    topY - 54,
    { size: 6.3, align: 'center', color: C.inkMid }
  );
  drawCadLabel(
    page,
    font,
    ['WORKING', 'SIDE'],
    x0 - 4,
    topY + 26,
    { size: 5.9, align: 'right', color: C.inkLight }
  );
  drawCadLabel(
    page,
    font,
    ['OAK TAMBOUR', '& WALNUT', 'FOOT RAIL'],
    x0 + islandD + 6,
    floorY - 32,
    { size: 6.0, align: 'left', color: C.inkMid }
  );
}

function drawSectionCIslandDrawers(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const islandD = DIM.islandD * s;
  const x0 = box.innerX + (box.innerW - islandD) / 2 - 14;
  const topY = floorY - DIM.counterH * s;
  const topH = DIM.topThk * s;
  const footH = DIM.footRailH * s;
  const footProj = DIM.footRailProj * s;
  const carcW = DIM.islandCarcassD * s;

  line(page, x0 - 16, floorY, x0 + islandD + 26, floorY, 1.35, C.black);

  rect(page, x0 + 1 * s, topY + topH, carcW, (DIM.counterH - DIM.topThk - DIM.toeH) * s, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // 4 stacked dovetail drawer boxes in section
  const stackH = (DIM.counterH - DIM.topThk - DIM.toeH - 2) * s;
  const drwH = stackH / 4;
  const fills = [C.steelTint, C.cyanTint, C.orangeTint, C.wallFill];
  for (let i = 0; i < 4; i++) {
    const dy = topY + topH + 1 * s + i * drwH;
    rect(page, x0 + 2 * s, dy + 1, carcW - 6 * s, drwH - 2.5, {
      fill: fills[i],
      stroke: C.black,
      strokeWidth: 0.65,
    });
  }
  // Toe-kick
  rect(page, x0 + 4 * s, floorY - DIM.toeH * s, carcW - 3 * s, DIM.toeH * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  // Guest side oak tambour + walnut foot rail
  rect(page, x0 + 1 * s + carcW, topY + topH + 1 * s, 2.2 * s, (DIM.counterH - DIM.topThk - DIM.footRailH - 1) * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawRoundedRect(page, x0 + 1 * s + carcW, floorY - footH, footProj + 1.5 * s, footH, 3, {
    fill: C.walnutTint,
    borderColor: C.black,
    borderWidth: 0.95,
  });
  // Countertop
  rect(page, x0, topY, islandD, topH, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });

  drawCadLabel(
    page,
    font,
    ['4-DRAWER BAUHAUS', 'DOVETAIL STACK', '(SOFT-CLOSE)'],
    x0 + islandD / 2,
    topY - 38,
    { size: 6.3, align: 'center', color: C.inkMid }
  );
  drawCadLabel(
    page,
    font,
    ['36" D TOP', '36" H'],
    x0 + islandD + 6,
    topY + 12,
    { size: 6.2, align: 'left', color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-102 DRAWINGS — FLOOR PLAN & 30° ORTHOGRAPHIC ISOMETRIC
// =============================================================================

function drawWetBarFloorPlan(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = 4.4; // px per inch
  const roomW = DIM.alcoveW * s;
  const roomD = (DIM.backBarD + DIM.aisleClear + DIM.islandD + 20) * s;
  const x0 = box.innerX + (box.innerW - roomW) / 2;
  const y0 = box.innerYTop + (box.innerH - roomD) / 2 + 12;
  const wallT = 8;

  // Alcove walls: North wall (with window), West wall (left return), East wall (right full wall)
  rect(page, x0 - wallT, y0 - wallT, roomW + wallT * 2, wallT, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  // North window glazing in wall
  rect(page, x0 + 4 * s, y0 - wallT + 2, roomW - 8 * s, wallT - 4, {
    fill: C.glassTint,
    stroke: C.black,
    strokeWidth: 0.7,
  });
  // West alcove wall (stops at front of walkway)
  const westWallLen = (DIM.backBarD + DIM.aisleClear - 4) * s;
  rect(page, x0 - wallT, y0, wallT, westWallLen, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  // East wall (anchors back bar & peninsula island)
  rect(page, x0 + roomW, y0, wallT, roomD, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 1.0,
  });

  // Back bar credenza plan (96" × 24")
  const bbD = DIM.backBarD * s;
  rect(page, x0, y0, roomW, bbD, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.1,
  });
  // 4 bay dashed dividers
  const bayW = DIM.bayW * s;
  const bayLabels = ['ORANGE / DOOR', 'BLUE / DOOR', 'GRAY+ORG DRW', '24" BEV FRIDGE'];
  for (let i = 0; i < 4; i++) {
    const bx = x0 + i * bayW;
    if (i > 0) line(page, bx, y0 + 2, bx, y0 + bbD - 2, 0.65, C.inkMid, [3, 2]);
    drawCadLabel(page, font, [bayLabels[i]], bx + bayW / 2, y0 + bbD * 0.56, {
      size: 5.8,
      align: 'center',
      color: C.inkDark,
    });
  }

  // 42" Walkway clearance dimension
  const islandY = y0 + (DIM.backBarD + DIM.aisleClear) * s;
  const dimAisleX = x0 + roomW * 0.34;
  drawDimArrow(page, dimAisleX, y0 + bbD + 3, dimAisleX, islandY - 3);
  drawCadLabel(
    page,
    font,
    ['42" CLEAR WALKWAY AISLE'],
    dimAisleX + 10,
    y0 + bbD + (DIM.aisleClear * s) / 2 + 2,
    { size: 6.8, color: C.inkDark }
  );

  // Peninsula Island Plan (84" × 36" anchored to East wall, radiused West end)
  const islW = DIM.islandW * s;
  const islD = DIM.islandD * s;
  const islX = x0 + roomW - islW;
  const r = DIM.islandRadius * s;

  // Countertop outline with rounded left corners and square right corners against East wall
  const islPath = `M ${islX + r},${islandY} L ${islX + islW},${islandY} L ${islX + islW},${
    islandY + islD
  } L ${islX + r},${islandY + islD} Q ${islX},${islandY + islD} ${islX},${islandY + islD - r} L ${islX},${
    islandY + r
  } Q ${islX},${islandY} ${islX + r},${islandY} Z`;
  page.drawSvgPath(islPath, {
    x: 0,
    y: PAGE_H,
    color: C.stoneTint,
    borderColor: C.black,
    borderWidth: 1.25,
  });

  // Dashed base carcass under 14" cantilevered West overhang
  const carcX = islX + DIM.islandOverhangW * s;
  const carcW = DIM.islandCarcassW * s;
  const carcD = DIM.islandCarcassD * s;
  rect(page, carcX, islandY + 1.5 * s, carcW, carcD, {
    stroke: C.inkDark,
    strokeWidth: 0.7,
    dashArray: [4, 3],
  });
  // Division between 28" drawer stack (left) and 42" sink base (right)
  line(
    page,
    carcX + DIM.drawerStackW * s,
    islandY + 1.5 * s,
    carcX + DIM.drawerStackW * s,
    islandY + 1.5 * s + carcD,
    0.65,
    C.inkMid,
    [3, 2]
  );

  // Undermount stainless bar sink (East side of island)
  const sinkW = DIM.sinkW * s;
  const sinkD = DIM.sinkD * s;
  const sinkX = islX + islW - sinkW - 6 * s;
  const sinkY = islandY + (islD - sinkD) / 2;
  drawRoundedRect(page, sinkX, sinkY, sinkW, sinkD, 5, {
    fill: C.white,
    borderColor: C.black,
    borderWidth: 1.0,
  });
  page.drawCircle({
    x: sinkX + sinkW / 2,
    y: py(sinkY + sinkD / 2),
    size: 4.5,
    borderColor: C.black,
    borderWidth: 0.75,
  });
  // Faucet on East edge of sink
  page.drawCircle({
    x: sinkX + sinkW + 4,
    y: py(sinkY + sinkD / 2),
    size: 2.5,
    color: C.black,
  });

  // Labels inside island plan
  drawCadLabel(page, font, ['14" RADIUS', 'OVERHANG'], islX + (DIM.islandOverhangW * s) / 2, islandY + islD / 2 - 2, {
    size: 5.8,
    align: 'center',
    color: C.inkDark,
  });
  drawCadLabel(
    page,
    font,
    ['28" 4-DRAWER', 'BAUHAUS STACK'],
    carcX + (DIM.drawerStackW * s) / 2,
    islandY + islD / 2 - 2,
    { size: 6.0, align: 'center', color: C.inkDark }
  );
  drawCadLabel(
    page,
    font,
    ['42" SINK', 'BASE'],
    carcX + DIM.drawerStackW * s + 12 * s,
    islandY + islD / 2 - 2,
    { size: 6.0, align: 'center', color: C.inkDark }
  );

  // Guest front tambour callout along South face
  drawCadLabel(
    page,
    font,
    ['OVERSIZED FLUTED WHITE OAK TAMBOUR + SOLID WALNUT FOOT RAIL'],
    islX + islW / 2,
    islandY + islD + 16,
    { size: 6.4, align: 'center', color: C.inkMid }
  );

  // Section Cut markers A, B, C
  drawSectionBadge(page, font, x0 + bayW * 1.5, y0 - 22, 10, 'A', C.orange);
  line(page, x0 + bayW * 1.5, y0 - 11, x0 + bayW * 1.5, y0 + bbD + 12, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, sinkX + sinkW / 2, islandY + islD + 34, 10, 'B', C.cyan);
  line(page, sinkX + sinkW / 2, islandY - 10, sinkX + sinkW / 2, islandY + islD + 22, 0.6, C.inkMid, [4, 3]);

  drawSectionBadge(page, font, carcX + (DIM.drawerStackW * s) / 2, islandY + islD + 34, 10, 'C', C.yellow);
  line(
    page,
    carcX + (DIM.drawerStackW * s) / 2,
    islandY - 10,
    carcX + (DIM.drawerStackW * s) / 2,
    islandY + islD + 22,
    0.6,
    C.inkMid,
    [4, 3]
  );

  // Overall width dimensions
  drawDimArrow(page, x0, y0 - 38, x0 + roomW, y0 - 38);
  drawCadLabel(page, font, ['96" ALCOVE WIDTH'], x0 + roomW / 2, y0 - 42, {
    size: 6.6,
    align: 'center',
    color: C.inkDark,
  });
}

function drawWetBarIsometric(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // True 30° orthographic isometric projection
  // World coords: X = left-to-right (West -> East, 0..96"), Y = North-to-South (back wall -> guest front, 0..102"), Z = height (0..90")
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = 0.5;
  const sc = 3.25;
  const ox = box.innerX + box.innerW * 0.49;
  const oy = box.innerYTop + box.innerH * 0.41;

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
    fills: { top?: ReturnType<typeof rgb>; front?: ReturnType<typeof rgb>; left?: ReturnType<typeof rgb> },
    sw = 0.8
  ) => {
    // Left face (x = x, y..y+d)
    polygon(page, [iso(x, y, z), iso(x, y + d, z), iso(x, y + d, z + h), iso(x, y, z + h)], {
      fill: fills.left ?? C.white,
      stroke: C.black,
      strokeWidth: sw,
    });
    // Front face (y = y + d, x..x+w)
    polygon(page, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], {
      fill: fills.front ?? C.white,
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

  // Floor plane outline
  polygon(page, [iso(0, 0, 0), iso(96, 0, 0), iso(96, 114, 0), iso(0, 114, 0)], {
    fill: C.white,
    stroke: C.inkFaint,
    strokeWidth: 0.65,
  });

  // Back (North) wall & East (right) wall
  polygon(page, [iso(0, 0, 0), iso(96, 0, 0), iso(96, 0, 82), iso(0, 0, 82)], {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  // Window on North wall
  polygon(page, [iso(6, 0, 39), iso(90, 0, 39), iso(90, 0, 72), iso(6, 0, 72)], {
    fill: C.glassTint,
    stroke: C.black,
    strokeWidth: 0.8,
  });
  line(page, ...iso(48, 0, 39), ...iso(48, 0, 72), 0.75, C.black);

  // East wall
  polygon(page, [iso(96, 0, 0), iso(96, 108, 0), iso(96, 108, 82), iso(96, 0, 82)], {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Back Bar Credenza (0..96, 0..24, 0..36)
  drawIsoBox(0, 0, 0, 96, 24, 34.5, { top: C.walnutTint, front: C.walnutTint, left: C.walnutTint }, 0.85);
  // Front bays on back bar
  // Bay 1: Orange drawer + walnut door
  polygon(page, [iso(1, 24, 28), iso(23, 24, 28), iso(23, 24, 33.8), iso(1, 24, 33.8)], {
    fill: C.orangeTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  polygon(page, [iso(1, 24, 3), iso(23, 24, 3), iso(23, 24, 27), iso(1, 24, 27)], {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  // Bay 2: Blue drawer + walnut door
  polygon(page, [iso(25, 24, 28), iso(47, 24, 28), iso(47, 24, 33.8), iso(25, 24, 33.8)], {
    fill: C.cyanTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  polygon(page, [iso(25, 24, 3), iso(47, 24, 3), iso(47, 24, 27), iso(25, 24, 27)], {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  // Bay 3: Gray + Orange deep drawers
  polygon(page, [iso(49, 24, 19), iso(71, 24, 19), iso(71, 24, 33.8), iso(49, 24, 33.8)], {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  polygon(page, [iso(49, 24, 3), iso(71, 24, 3), iso(71, 24, 18), iso(49, 24, 18)], {
    fill: C.orangeTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  // Bay 4: Stainless bev fridge
  polygon(page, [iso(73, 24, 0.5), iso(95, 24, 0.5), iso(95, 24, 34), iso(73, 24, 34)], {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.7,
  });
  // Back bar matte black top
  drawIsoBox(0, 0, 34.5, 96, 24, 1.5, { top: C.stoneTint, front: C.stoneTint, left: C.stoneTint }, 0.9);

  // Peninsula Island (x: 12..96, y: 66..102, z: 0..36)
  // Solid walnut foot rail projecting at y: 102..105.5
  drawIsoBox(22, 99, 0, 72, 4.5, 3.5, { top: C.walnutTint, front: C.walnutTint, left: C.walnutTint }, 0.85);
  // Main island carcass (x: 14..96, y: 67..100, z: 0..34.5)
  drawIsoBox(14, 67, 0, 82, 33, 34.5, { top: C.oakTint, front: C.oakTint, left: C.walnutTint }, 0.9);

  // Oversized vertical fluted oak tambour columns on South (front) face (x: 24..93, y=100, z=3.5..34)
  const cols = 15;
  const colStep = 69 / cols;
  for (let i = 0; i <= cols; i++) {
    const cx = 24 + i * colStep;
    line(page, ...iso(cx, 100, 3.5), ...iso(cx, 100, 34.2), 0.65, C.black);
  }

  // Island matte black countertop (x: 12..96, y: 66..102, z: 34.5..36)
  drawIsoBox(12, 66, 34.5, 84, 36, 1.5, { top: C.stoneTint, front: C.stoneTint, left: C.stoneTint }, 1.0);

  // Undermount stainless bar sink on island top (x: 75..90, y: 76..92, z=36)
  polygon(page, [iso(75, 76, 36), iso(90, 76, 36), iso(90, 92, 36), iso(75, 92, 36)], {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  polygon(page, [iso(76.5, 77.5, 36), iso(88.5, 77.5, 36), iso(88.5, 90.5, 36), iso(76.5, 90.5, 36)], {
    fill: C.steelTint,
    stroke: C.inkMid,
    strokeWidth: 0.55,
  });
  // Faucet in iso
  line(page, ...iso(91, 84, 36), ...iso(91, 84, 45), 1.1, C.black);
  line(page, ...iso(91, 84, 45), ...iso(85, 84, 45), 1.0, C.black);

  drawCadLabel(
    page,
    font,
    ['ORTHOGRAPHIC 30° ISOMETRIC — 96" BACK BAR & 84" × 36" FLUTED OAK TAMBOUR ISLAND'],
    box.innerX + box.innerW / 2,
    box.innerYTop + box.innerH - 12,
    { size: 6.8, align: 'center', color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-103 DRAWINGS — WORKING SIDE ELEVATION, SECTIONS & 1:1 JOINERY
// =============================================================================

function drawIslandWorkingElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  const totalW = DIM.islandW * s;
  const x0 = box.innerX + (box.innerW - totalW) / 2;
  const topY = floorY - DIM.counterH * s;
  const topH = DIM.topThk * s;
  const toeH = DIM.toeH * s;
  const cabTopY = topY + topH;
  const cabH = (DIM.counterH - DIM.topThk - DIM.toeH) * s;

  // Floor & East (left) wall
  line(page, x0 - 18, floorY, x0 + totalW + 18, floorY, 1.4, C.black);
  rect(page, x0 - 7, floorY - 52 * s, 7, 52 * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.9,
  });

  // Bar faucet on left (East) side
  drawFaucetElev(page, x0 + 12 * s, topY, s);

  // 1.5" Matte black countertop extending full 84" (14" overhang on right)
  rect(page, x0, topY, totalW, topH, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });

  // 70" Base carcass (42" sink base on left + 28" 4-drawer stack on right)
  const carcW = DIM.islandCarcassW * s;
  rect(page, x0, cabTopY, carcW, cabH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  // Toe-kick under 70" carcass
  rect(page, x0 + 1.5, floorY - toeH, carcW - 3, toeH, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.8,
  });

  // Left Bay (42" Sink Base): Bauhaus Orange tilt-out apron + double walnut doors
  const st = 1.1 * s;
  const sbW = DIM.sinkBaseW * s - st * 1.5;
  const apronH = 7.0 * s;
  rect(page, x0 + st, cabTopY + st * 0.6, sbW, apronH, {
    fill: C.orangeTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  drawCadLabel(page, font, ['BAUHAUS ORANGE SINK APRON'], x0 + st + sbW / 2, cabTopY + st * 0.6 + apronH * 0.62, {
    size: 5.8,
    align: 'center',
    color: C.inkDark,
  });

  const doorY = cabTopY + st * 0.6 + apronH + 0.9 * s;
  const doorH = cabH - apronH - 0.9 * s - st * 1.2;
  const halfDoorW = (sbW - 0.8 * s) / 2;
  for (let d = 0; d < 2; d++) {
    const dx = x0 + st + d * (halfDoorW + 0.8 * s);
    rect(page, dx, doorY, halfDoorW, doorH, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.85,
    });
    drawWalnutGrain(page, dx, doorY, halfDoorW, doorH, 5);
  }
  // Vertical matte-black finger pulls meeting at center
  const midDoorsX = x0 + st + halfDoorW + 0.4 * s;
  rect(page, midDoorsX - 2.2 * s, doorY + 2 * s, 1.4 * s, 6 * s, { fill: C.black });
  rect(page, midDoorsX + 0.8 * s, doorY + 2 * s, 1.4 * s, 6 * s, { fill: C.black });

  // Right Bay (28" 4-Drawer Bauhaus Color-Blocked Stack)
  const drwX = x0 + DIM.sinkBaseW * s + st * 0.5;
  const drwW = DIM.drawerStackW * s - st * 1.5;
  const drwGap = 0.8 * s;
  const drwH = (cabH - st * 1.2 - drwGap * 3) / 4;
  const stackSpec: Array<{ label: string; fill: ReturnType<typeof rgb> }> = [
    { label: 'LIGHT GRAY', fill: C.steelTint },
    { label: 'FAB. BLUE (#27AAE0)', fill: C.cyanTint },
    { label: 'BAUHAUS ORANGE (#EF6922)', fill: C.orangeTint },
    { label: 'MEDIUM GRAY (#A8A8A8)', fill: C.wallFill },
  ];
  stackSpec.forEach((drw, idx) => {
    const dy = cabTopY + st * 0.6 + idx * (drwH + drwGap);
    rect(page, drwX, dy, drwW, drwH, {
      fill: drw.fill,
      stroke: C.black,
      strokeWidth: 0.85,
    });
    // Centered recessed black finger-pull notch at top of drawer
    rect(page, drwX + drwW * 0.36, dy + 0.5, drwW * 0.28, 1.2 * s, { fill: C.black });
    drawCadLabel(page, font, [drw.label], drwX + drwW / 2, dy + drwH * 0.62, {
      size: 5.5,
      align: 'center',
      color: C.inkDark,
    });
  });

  // 14" Cantilevered overhang dimension on right
  const ovX0 = x0 + carcW;
  const ovX1 = x0 + totalW;
  drawDimArrow(page, ovX0 + 2, topY + 28, ovX1 - 2, topY + 28);
  drawCadLabel(page, font, ['14" RADIUS', 'OVERHANG'], (ovX0 + ovX1) / 2, topY + 42, {
    size: 6.0,
    align: 'center',
    color: C.inkMid,
  });

  // Section D badge
  const secDX = x0 + DIM.sinkBaseW * s * 0.5;
  line(page, secDX, topY - 26, secDX, floorY + 12, 0.65, C.inkMid, [4, 3]);
  drawSectionBadge(page, font, secDX, topY - 30, 10, 'D', C.orange);

  // Dimensions along bottom
  const dimY = floorY + 18;
  drawDimArrow(page, x0, dimY, x0 + DIM.sinkBaseW * s, dimY);
  drawCadLabel(page, font, ['42" SINK BASE'], x0 + (DIM.sinkBaseW * s) / 2, dimY - 4, {
    size: 6.0,
    align: 'center',
    color: C.inkDark,
  });
  drawDimArrow(page, x0 + DIM.sinkBaseW * s, dimY, x0 + carcW, dimY);
  drawCadLabel(page, font, ['28" DRAWER STACK'], x0 + DIM.sinkBaseW * s + (DIM.drawerStackW * s) / 2, dimY - 4, {
    size: 6.0,
    align: 'center',
    color: C.inkDark,
  });
}

function drawSectionDTambourFootRail(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  // Enlarged section through guest-side tambour wall, top overhang, and mortised walnut foot rail
  const xWall = box.innerX + box.innerW * 0.42;
  const topY = floorY - DIM.counterH * s;
  const topH = DIM.topThk * s;
  const footH = DIM.footRailH * s;

  line(page, xWall - 70, floorY, xWall + 110, floorY, 1.4, C.black);

  // 3/4" structural carcass backing
  rect(page, xWall - 12, topY + topH, 12, (DIM.counterH - DIM.topThk) * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Walnut top reveal rail
  rect(page, xWall, topY + topH, 14, 1.2 * s, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // Oversized white oak tambour column (section profile)
  rect(page, xWall, topY + topH + 1.2 * s, 14, (DIM.counterH - DIM.topThk - DIM.footRailH - 1.2) * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // Mortised solid walnut foot rail (bullnose front)
  drawRoundedRect(page, xWall - 8, floorY - footH, 38, footH, 5, {
    fill: C.walnutTint,
    borderColor: C.black,
    borderWidth: 1.05,
  });
  // Matte black countertop overhanging tambour face
  rect(page, xWall - 64, topY, 90, topH, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });

  drawCadLabel(
    page,
    font,
    ['1.5" MATTE BLACK QUARTZ TOP', '(1.5" FRONT OVERHANG)'],
    xWall + 34,
    topY + 6,
    { size: 6.4, color: C.inkDark }
  );
  drawCadLabel(
    page,
    font,
    ['OVERSIZED HALF-ROUND', 'WHITE OAK TAMBOUR', '(GLUED TO 3/4" PLY CORE)'],
    xWall + 24,
    topY + 86,
    { size: 6.4, color: C.inkMid }
  );
  drawCadLabel(
    page,
    font,
    ['MORTISED SOLID WALNUT', 'BULLNOSE FOOT RAIL', '(3.5" H × 4" PROJ.)'],
    xWall + 38,
    floorY - footH - 8,
    { size: 6.4, color: C.inkDark }
  );
}

function drawBackBarDetailElevation(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  s: number,
  floorY: number
) {
  // Enlarged 3-bay detail (Bays 1–3 = 72" W) showing book-matched walnut doors & color-blocked fronts
  const totalW = 72 * s;
  const x0 = box.innerX + (box.innerW - totalW) / 2;
  const topY = floorY - DIM.counterH * s;
  const topH = DIM.topThk * s;
  const toeH = DIM.toeH * s;
  const cabTopY = topY + topH;
  const cabH = (DIM.counterH - DIM.topThk - DIM.toeH) * s;
  const bayW = 24 * s;
  const st = 1.0 * s;

  line(page, x0 - 16, floorY, x0 + totalW + 16, floorY, 1.4, C.black);
  rect(page, x0, topY, totalW, topH, { fill: C.stoneTint, stroke: C.black, strokeWidth: 1.05 });
  rect(page, x0, cabTopY, totalW, cabH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 1.0 });
  rect(page, x0 + 2, floorY - toeH, totalW - 4, toeH, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.8 });

  const innerW = bayW - st * 1.5;
  const topDrwH = 6.2 * s;
  const railH = 0.9 * s;
  const doorY = cabTopY + st * 0.6 + topDrwH + railH;
  const doorH = cabH - topDrwH - railH - st * 1.2;

  // Bay 1 & 2
  const topColors = [
    { label: 'BAUHAUS ORANGE (#EF6922)', fill: C.orangeTint },
    { label: 'FAB. BLUE (#27AAE0)', fill: C.cyanTint },
  ];
  for (let i = 0; i < 2; i++) {
    const bx = x0 + i * bayW + (i === 0 ? st : st * 0.5);
    rect(page, bx, cabTopY + st * 0.6, innerW, topDrwH, {
      fill: topColors[i].fill,
      stroke: C.black,
      strokeWidth: 0.85,
    });
    drawCadLabel(page, font, [topColors[i].label], bx + innerW / 2, cabTopY + st * 0.6 + topDrwH * 0.62, {
      size: 5.5,
      align: 'center',
      color: C.inkDark,
    });
    rect(page, bx, doorY, innerW, doorH, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.85 });
    drawWalnutGrain(page, bx, doorY, innerW, doorH, 7);
    rect(page, bx + innerW * 0.34, doorY + 0.8, innerW * 0.32, 1.3 * s, { fill: C.black });
    drawCadLabel(page, font, ['BOOK-MATCHED', 'WALNUT DOOR'], bx + innerW / 2, doorY + doorH * 0.52, {
      size: 5.8,
      align: 'center',
      color: C.inkMid,
    });
  }

  // Bay 3
  const b3x = x0 + bayW * 2 + st * 0.5;
  const deepH = (cabH - st * 1.2 - railH) / 2;
  rect(page, b3x, cabTopY + st * 0.6, innerW, deepH, { fill: C.steelTint, stroke: C.black, strokeWidth: 0.85 });
  drawCadLabel(page, font, ['INDUSTRIAL GRAY', 'DEEP DRAWER'], b3x + innerW / 2, cabTopY + st * 0.6 + deepH * 0.54, {
    size: 5.8,
    align: 'center',
    color: C.inkDark,
  });
  const b3BotY = cabTopY + st * 0.6 + deepH + railH;
  rect(page, b3x, b3BotY, innerW, deepH, { fill: C.orangeTint, stroke: C.black, strokeWidth: 0.85 });
  rect(page, b3x + innerW * 0.34, b3BotY + 0.8, innerW * 0.32, 1.3 * s, { fill: C.black });
  drawCadLabel(page, font, ['BAUHAUS ORANGE', 'DEEP DRAWER'], b3x + innerW / 2, b3BotY + deepH * 0.54, {
    size: 5.8,
    align: 'center',
    color: C.inkDark,
  });

  // Dimensions
  const dimY = floorY + 18;
  for (let i = 0; i < 3; i++) {
    drawDimArrow(page, x0 + i * bayW + 1, dimY, x0 + (i + 1) * bayW - 1, dimY);
    drawCadLabel(page, font, ['24" BAY'], x0 + (i + 0.5) * bayW, dimY - 4, {
      size: 6.0,
      align: 'center',
      color: C.inkDark,
    });
  }
}

function drawWetBarJoineryProfiles(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const pad = 12;
  const gap = 12;
  const cardW = (box.innerW - pad * 2 - gap * 2) / 3;
  const cardH = box.innerH - pad * 2;
  const cy = box.innerYTop + pad;

  const cards = [
    { title: '4A / OAK TAMBOUR PROFILE', sub: '3.5" Ø HALF-ROUND WHITE OAK' },
    { title: '4B / WALNUT FOOT RAIL', sub: 'MORTISED BULLNOSE BASE' },
    { title: '4C / ROUTED FINGER PULL', sub: 'INTEGRATED MATTE BLACK NOTCH' },
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
      // 3 oversized half-round tambour dowels in plan section
      const r = 20;
      const startX = midX - r * 3;
      const baseY = midY + 14;
      rect(page, startX, baseY, r * 6, 14, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.85 });
      for (let k = 0; k < 3; k++) {
        const ax = startX + k * r * 2;
        const arcD = `M ${ax},${baseY} A ${r},${r} 0 0 1 ${ax + r * 2},${baseY} Z`;
        page.drawSvgPath(arcD, {
          x: 0,
          y: PAGE_H,
          color: C.oakTint,
          borderColor: C.black,
          borderWidth: 0.95,
        });
      }
      drawDimArrow(page, startX, baseY - r - 12, startX + r * 2, baseY - r - 12);
      drawCadLabel(page, font, ['3.5" O.C.'], startX + r, baseY - r - 16, {
        size: 6.0,
        align: 'center',
        color: C.inkDark,
      });
      drawCadLabel(page, font, ['SOLID WHITE OAK HALF-ROUNDS'], midX, cy + cardH - 14, {
        size: 5.8,
        align: 'center',
        color: C.inkMid,
      });
    } else if (i === 1) {
      // Mortised walnut foot rail cross-section
      rect(page, midX - 42, midY - 30, 14, 56, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.85 });
      drawRoundedRect(page, midX - 28, midY + 2, 72, 24, 10, {
        fill: C.walnutTint,
        borderColor: C.black,
        borderWidth: 1.0,
      });
      // Tenon dashed inside carcass
      rect(page, midX - 38, midY + 8, 10, 12, {
        fill: C.walnutTint,
        stroke: C.black,
        strokeWidth: 0.6,
        dashArray: [2, 2],
      });
      drawCadLabel(page, font, ['4.0" PROJ. × 3.5" H'], midX + 8, midY - 6, {
        size: 6.0,
        align: 'center',
        color: C.inkDark,
      });
      drawCadLabel(page, font, ['SOLID BLACK WALNUT RAIL'], midX, cy + cardH - 14, {
        size: 5.8,
        align: 'center',
        color: C.inkMid,
      });
    } else {
      // Routed finger-pull notch detail
      rect(page, midX - 44, midY - 22, 88, 52, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.9 });
      rect(page, midX - 20, midY - 22, 40, 11, { fill: C.black, stroke: C.black, strokeWidth: 0.8 });
      drawDimArrow(page, midX - 20, midY - 32, midX + 20, midY - 32);
      drawCadLabel(page, font, ['4.5" × 1.0" NOTCH'], midX, midY - 36, {
        size: 6.0,
        align: 'center',
        color: C.inkDark,
      });
      drawCadLabel(page, font, ['CNC-ROUTED PULL · MATTE BLACK'], midX, cy + cardH - 14, {
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

async function buildWetBarSheets() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle('casegoods — Wet Bar Credenza & Fluted Tambour Island (DWG 1064HEM-WB · A-101 to A-103)');
  pdfDoc.setAuthor('Josh Heinke — casegoods (Omaha, NE)');
  pdfDoc.setCreator('casegoods Omaha Architectural Drawing Studio');

  const nexaFont = await pdfDoc.embedFont(fs.readFileSync(FONT_NEXA));
  const logoFullImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_FULL));
  const logoIconsImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_ICONS));

  // SHEET A-101 — ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page1, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1064HEM-WB',
    projectTitleLine: 'WET BAR & FLUTED ISLAND',
    sheetCode: 'A-101',
    sheetIndexText: 'SHEET 01 / 03',
    sheetCategory: 'ELEVATIONS & SECTIONS',
    bannerBg: C.orange,
    bannerLeft: 'A-101  /  ARCHITECTURAL ELEVATIONS, SECTIONS & SPECIFICATION SCHEDULE',
    bannerRight: 'WET BAR CREDENZA & FLUTED TAMBOUR ISLAND  ·  DWG 1064HEM-WB  ·  OMAHA STUDIO',
    accentColor: C.orange,
  });

  const row1Y = 174;
  const row1H = 384;
  const elevAW = 760;
  const elevBW = PAGE_W - 88 - elevAW - 16; // 736

  const boxElevA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: row1Y,
    w: elevAW,
    h: row1H,
    title: '01 / ELEVATION A — BACK BAR CREDENZA (NORTH WALL)',
    subtitle: '96" ALCOVE · BAUHAUS COLOR-BLOCKED DRAWERS · 24" BEV. FRIDGE',
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
    title: '02 / ELEVATION B — PENINSULA ISLAND (GUEST FRONT)',
    subtitle: '84" RADIUS TOP · FLUTED OAK TAMBOUR · WALNUT FOOT RAIL',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.cyan,
    subtitleSize: 7.8,
  });

  const sharedElevScale = Math.min(
    (boxElevA.innerW - 76) / DIM.alcoveW,
    (boxElevB.innerW - 76) / DIM.islandW,
    (boxElevA.innerH - 72) / 80
  );
  const elevFloorY = boxElevA.innerYTop + boxElevA.innerH - 30;
  drawBackBarElevation(page1, nexaFont, boxElevA, sharedElevScale, elevFloorY);
  drawIslandGuestElevation(page1, nexaFont, boxElevB, sharedElevScale, elevFloorY);

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
    subtitle: 'BACK BAR CREDENZA',
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
    subtitle: 'ISLAND THRU SINK',
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
    subtitle: 'ISLAND DRAWER STACK',
    headerBg: C.yellow,
    headerTextColor: C.black,
    titleSize: 9.8,
    subtitleSize: 8.0,
  });

  const secScale = (boxSecA.innerH - 42) / 76;
  const secFloorY = boxSecA.innerYTop + boxSecA.innerH - 18;
  drawSectionABackBar(page1, nexaFont, boxSecA, secScale, secFloorY);
  drawSectionBIslandSink(page1, nexaFont, boxSecB, secScale, secFloorY);
  drawSectionCIslandDrawers(page1, nexaFont, boxSecC, secScale, secFloorY);

  drawSpecKeyCard(
    page1,
    nexaFont,
    44 + (secW + 16) * 3,
    row2Y,
    specW,
    row2H,
    [
      ['ISLAND FRONT', 'OVERSIZED FLUTED WHITE OAK TAMBOUR'],
      ['ACCENT DRAWERS', 'ORANGE (#EF6922) · BLUE (#27AAE0) · GRAY'],
      ['CASEWORK & DOORS', 'BOOK-MATCHED AMERICAN BLACK WALNUT'],
      ['COUNTERTOPS', '1.5" MATTE BLACK RADIUSED QUARTZ'],
      ['FOOT RAIL & PULLS', 'MORTISED WALNUT RAIL · ROUTED NOTCHES'],
      ['TOLERANCE', '± 1/32" RHINO 3D · DWG 1064HEM-WB'],
    ],
    'VERIFY ALL PLUMBING ROUGH-INS & ALCOVE WALL DIMENSIONS PRIOR TO FABRICATION'
  );

  // SHEET A-102 — FLOOR PLAN & 30° ISOMETRIC
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page2, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1064HEM-WB',
    projectTitleLine: 'WET BAR & FLUTED ISLAND',
    sheetCode: 'A-102',
    sheetIndexText: 'SHEET 02 / 03',
    sheetCategory: 'PLAN & ISOMETRIC',
    bannerBg: C.cyan,
    bannerLeft: 'A-102  /  FLOOR PLAN, HORIZONTAL SECTION & 30° ORTHOGRAPHIC ISOMETRIC',
    bannerRight: 'TRUE-PROPORTION GEOMETRY  ·  42" WALKWAY CLEARANCE  ·  1064HEM-WB',
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
    subtitle: 'DASHED: 70" BASE CARCASS UNDER 14" RADIUS OVERHANG',
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

  drawWetBarFloorPlan(page2, nexaFont, { ...boxPlan, innerH: boxPlan.innerH - 54 });
  drawSectionCutLegend(page2, nexaFont, 60, a102Y + a102H - 50, planW - 32, [
    { code: 'A', text: 'BACK BAR', color: C.orange, x: 214 },
    { code: 'B', text: 'ISLAND SINK', color: C.cyan, x: 374 },
    { code: 'C', text: 'DRAWER STACK', color: C.yellow, x: 540 },
  ]);
  drawWetBarIsometric(page2, nexaFont, boxIso);

  // SHEET A-103 — ISLAND WORKING SIDE, BACK BAR DETAIL & 1:1 JOINERY
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page3, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1064HEM-WB',
    projectTitleLine: 'WET BAR & FLUTED ISLAND',
    sheetCode: 'A-103',
    sheetIndexText: 'SHEET 03 / 03',
    sheetCategory: 'ISLAND & JOINERY DETAILS',
    bannerBg: C.yellow,
    bannerLeft: 'A-103  /  ISLAND WORKING ELEVATION, TAMBOUR SECTION & JOINERY PROFILES',
    bannerRight: 'PROPORTIONAL SCHEMATIC  ·  FLUTED OAK TAMBOUR · BAUHAUS DRAWERS  ·  1064HEM-WB',
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
    title: '01 / DETAIL ELEVATION C — ISLAND WORKING SIDE (INTERIOR)',
    subtitle: '42" SINK BASE · 28" 4-DRAWER BAUHAUS STACK · 14" OVERHANG',
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
    title: '03 / SECTION D — TAMBOUR & FOOT RAIL',
    subtitle: 'ENLARGED GUEST-SIDE WALL SECTION',
    headerBg: C.orange,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  const boxElevD = drawViewportCard(page3, nexaFont, {
    x: 44,
    yTop: a103BotY,
    w: leftColW,
    h: a103RowH,
    title: '02 / DETAIL ELEVATION D — BACK BAR CREDENZA (BAYS 1–3)',
    subtitle: 'BOOK-MATCHED WALNUT DOORS · ROUTED FINGER-PULL NOTCHES',
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

  const detScale = Math.min((boxElevC.innerW - 76) / DIM.islandW, (boxElevC.innerH - 96) / 46);
  const topFloorY = boxElevC.innerYTop + boxElevC.innerH - 36;
  drawIslandWorkingElevation(page3, nexaFont, boxElevC, detScale, topFloorY);
  drawSectionDTambourFootRail(page3, nexaFont, boxSecD, detScale * 1.08, topFloorY);

  const bbDetScale = Math.min((boxElevD.innerW - 92) / 72, (boxElevD.innerH - 64) / 40);
  const botFloorY = boxElevD.innerYTop + boxElevD.innerH - 36;
  drawBackBarDetailElevation(page3, nexaFont, boxElevD, bbDetScale, botFloorY);
  drawWetBarJoineryProfiles(page3, nexaFont, boxJoinery);

  const pdfBytes = await pdfDoc.save();
  const pdfOutPath = path.join(OUT_DIR, 'casegoods-1064HEM-WB-wet-bar-submittal-A101-A103.pdf');
  fs.writeFileSync(pdfOutPath, pdfBytes);

  rasterizeSubmittalPdf(pdfOutPath, [
    { page: 1, name: 'casegoods-1064HEM-WB-A101-elevations-sections.png' },
    { page: 2, name: 'casegoods-1064HEM-WB-A102-plan-isometric.png' },
    { page: 3, name: 'casegoods-1064HEM-WB-A103-island-joinery-details.png' },
  ]);
  console.log(`Generated PDF: ${pdfOutPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

buildWetBarSheets().catch((err) => {
  console.error(err);
  process.exit(1);
});
