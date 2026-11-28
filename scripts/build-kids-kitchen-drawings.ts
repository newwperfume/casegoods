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
  drawDimArrow as drawRawDimArrow,
  rasterizeSubmittalPdf,
  type ViewportCard,
} from './lib/cadSheetChrome.ts';

/** Labeled CAD dimension arrow helper (horizontal or vertical) */
function drawDimArrow(
  page: PDFPage,
  font: PDFFont,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  labelSide: 'left' | 'right' = 'right'
) {
  drawRawDimArrow(page, x1, y1, x2, y2, C.inkMid, 0.55);
  const isHoriz = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  if (isHoriz) {
    drawCadLabel(page, font, [label], (x1 + x2) / 2, Math.min(y1, y2) - 4, {
      size: 5.7,
      align: 'center',
      color: C.inkDark,
    });
  } else if (labelSide === 'left') {
    drawCadLabel(page, font, [label], Math.min(x1, x2) - 5, (y1 + y2) / 2 + 2, {
      size: 5.7,
      align: 'right',
      color: C.inkDark,
    });
  } else {
    drawCadLabel(page, font, [label], Math.max(x1, x2) + 5, (y1 + y2) / 2 + 2, {
      size: 5.7,
      align: 'left',
      color: C.inkDark,
    });
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// =============================================================================
// 1070MCG HEIRLOOM PLAY KITCHEN — EXACT FRACTIONAL DIMENSIONS
// (Sourced directly from Rhino 2D CAD Elevation A1 & Section B1)
// =============================================================================
const DIM = {
  // Built-In Storage Wall (Elevation A room context only)
  builtInW: 72.75,      // 72 3/4"
  totalH: 101.0,        // 101" floor to ceiling
  toeH: 4.5,            // 4 1/2" plinth base
  lowerDoorH: 30.0,     // 30" lower doors
  midRailH: 1.25,       // 1 1/4" mid counter ledge
  upperDoorH: 46.75,    // 46 3/4" upper doors
  transomH: 12.0,       // 12" transom doors
  crownH: 3.0,          // 2 63/64" (~3") frieze
  scribeH: 3.5,         // 3 1/2" ceiling scribe

  // Heirloom Play Kitchenette (Primary Subject)
  playW: 48.25,         // 48 1/4" overall countertop width
  playD: 20.0,          // 20" overall depth
  playCounterH: 30.5,   // 30 1/2" AFF
  playTopThk: 1.25,     // 1 1/4" honed quartz countertop
  playCaseH: 19.5,      // 19 1/2" solid walnut casework height
  legH: 9.75,           // 9 3/4" lathe-turned stacked-ball legs
  leftBayW: 27.9375,    // 27 15/16" left sink bay
  rightBayW: 19.75,     // 19 3/4" right towel-bar bay
  legSpanCenter: 42.25, // 42 1/4" center-to-center leg span
  legClearSpan: 30.25,  // 30 1/4" clear between front legs
  leftDoorPanelH: 13.25,// 13 1/4" left Shaker door recessed panel
  rightDoorPanelH: 8.75,// 8 3/4" right Shaker door recessed panel
  railBandH: 1.5,       // 1 1/2" recessed pull band & walnut towel bar
  // Plumbing rough-ins from left edge of play kitchen
  coldSupplyX: 20.5,    // 20 1/2"
  drainX: 24.0,         // 24"
  hotSupplyX: 26.75,    // 26 3/4"
  supplyH: 20.0,        // 20" AFF
  drainH: 15.75,        // 15 3/4" AFF
};

/** Subtle vertical walnut grain lines matching Wet Bar & Family Room sheets */
function drawWalnutGrain(page: PDFPage, x: number, yTop: number, w: number, h: number, count = 4) {
  if (w < 6 || h < 8) return;
  for (let i = 1; i <= count; i++) {
    const gx = x + (w * i) / (count + 1);
    line(page, gx, yTop + 1.5, gx, yTop + h - 1.5, 0.22, C.inkFaint);
  }
}

/** Draw a graduated lathe-turned stacked-ball walnut leg (3 spheres + neck collars + foot pad) */
function drawStackedBallLeg(
  page: PDFPage,
  cx: number,
  topY: number,
  legH: number,
  maxRadius: number,
  strokeWidth = 0.8
) {
  const footH = legH * 0.095;
  const usableH = legH - footH;
  // 3 graduated flattened spheres (top 5 1/4", mid 4 3/4", bottom 4 1/4")
  const balls = [
    { rx: maxRadius * 1.0, ry: usableH * 0.175, cy: topY + usableH * 0.175 },
    { rx: maxRadius * 0.90, ry: usableH * 0.168, cy: topY + usableH * 0.505 },
    { rx: maxRadius * 0.80, ry: usableH * 0.162, cy: topY + usableH * 0.825 },
  ];
  // Turned foot pad resting on floor
  rect(page, cx - maxRadius * 0.36, topY + legH - footH, maxRadius * 0.72, footH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: strokeWidth * 0.9,
  });
  // Subtle inner neck collars between spheres
  for (let i = 0; i < 2; i++) {
    const ny = (balls[i].cy + balls[i + 1].cy) / 2;
    rect(page, cx - maxRadius * 0.42, ny - usableH * 0.03, maxRadius * 0.84, usableH * 0.06, {
      fill: C.gray,
      stroke: C.black,
      strokeWidth: strokeWidth * 0.7,
    });
  }
  for (const b of balls) {
    page.drawEllipse({
      x: cx,
      y: py(b.cy),
      xScale: b.rx,
      yScale: b.ry,
      color: C.walnutTint,
      borderColor: C.black,
      borderWidth: strokeWidth,
    });
    // Subtle specular lathe highlight arc on left side of each turned sphere
    if (b.rx > 4) {
      line(
        page,
        cx - b.rx * 0.48,
        b.cy - b.ry * 0.38,
        cx - b.rx * 0.48,
        b.cy + b.ry * 0.38,
        0.25,
        C.inkLight
      );
    }
  }
}

/** Draw continuous scalloped solid walnut apron (9 crisp semi-circular scallops on front) */
function drawScallopedApron(
  page: PDFPage,
  xStart: number,
  xEnd: number,
  topY: number,
  scallopDrop: number,
  count = 9,
  strokeWidth = 0.8
) {
  const span = xEnd - xStart;
  if (span <= 2) return;
  const step = span / count;
  const drop = Math.min(scallopDrop, step * 0.72);
  let d = `M ${xStart.toFixed(2)},${topY.toFixed(2)} L ${xEnd.toFixed(2)},${topY.toFixed(2)}`;
  for (let i = count - 1; i >= 0; i--) {
    const sx = xStart + i * step;
    const midX = sx + step / 2;
    d += ` Q ${midX.toFixed(2)},${(topY + drop * 1.95).toFixed(2)} ${sx.toFixed(2)},${topY.toFixed(2)}`;
  }
  d += ' Z';
  page.drawSvgPath(d, {
    x: 0,
    y: PAGE_H,
    color: C.walnutTint,
    borderColor: C.black,
    borderWidth: strokeWidth,
  });
}

/** Draw tall gooseneck play-kitchen faucet with side lever handle in elevation */
function drawGooseneckFaucet(page: PDFPage, cx: number, topY: number, s: number) {
  const h = 11.2 * s;
  const r = 1.45 * s;
  // Base escutcheon & body
  rect(page, cx - 1.05 * s, topY - 2.6 * s, 2.1 * s, 2.6 * s, {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.75,
  });
  // Side lever handle (right side per Rhino elevation)
  rect(page, cx + 1.05 * s, topY - 2.2 * s, 2.1 * s, 0.85 * s, {
    fill: C.steelTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  line(page, cx + 2.8 * s, topY - 2.2 * s, cx + 2.8 * s, topY - 4.2 * s, 0.85, C.black);
  // Gooseneck vertical spout
  const d = `M ${(cx - 0.48 * s).toFixed(2)},${(topY - 2.6 * s).toFixed(2)} L ${(cx - 0.48 * s).toFixed(2)},${(
    topY - h
  ).toFixed(2)} A ${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${(cx + 0.48 * s).toFixed(2)},${(
    topY - h
  ).toFixed(2)} L ${(cx + 0.48 * s).toFixed(2)},${(topY - 2.6 * s).toFixed(2)}`;
  page.drawSvgPath(d, {
    x: 0,
    y: PAGE_H,
    color: C.steelTint,
    borderColor: C.black,
    borderWidth: 0.72,
  });
}

/** Reusable richly-detailed front elevation of the 48 1/4" Heirloom Play Kitchen */
function drawPlayKitchenFrontElevation(
  page: PDFPage,
  x0: number,
  floorY: number,
  s: number,
  opts: {
    showFaucet?: boolean;
    showGrain?: boolean;
    showPlumbing?: boolean;
    showOutlets?: boolean;
  } = {}
) {
  const playW = DIM.playW * s;
  const topThk = DIM.playTopThk * s;
  const caseH = DIM.playCaseH * s;
  const legH = DIM.legH * s;

  const counterTopY = floorY - DIM.playCounterH * s;
  const caseTopY = counterTopY + topThk;
  const caseBotY = floorY - legH;

  const leftLegCx = x0 + 6.0 * s;
  const rightLegCx = x0 + DIM.playW * s - 6.0 * s;
  const legR = 2.65 * s;

  // 1. Turned stacked-ball legs + continuous 9-scallop walnut apron
  drawScallopedApron(page, leftLegCx + legR * 0.75, rightLegCx - legR * 0.75, caseBotY, 1.55 * s, 9, 0.82);
  drawStackedBallLeg(page, leftLegCx, caseBotY, legH, legR, 0.85);
  drawStackedBallLeg(page, rightLegCx, caseBotY, legH, legR, 0.85);

  // 2. Main solid walnut cabinet carcass
  rect(page, x0 + 0.5 * s, caseTopY, playW - 1.0 * s, caseH, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });

  // 3. 1 1/4" Honed quartz countertop (slight overhang)
  rect(page, x0, counterTopY, playW, topThk, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });
  // Countertop bottom shadow reveal line
  line(page, x0 + 0.5 * s, caseTopY + 0.35 * s, x0 + playW - 0.5 * s, caseTopY + 0.35 * s, 0.35, C.inkMid);

  const divX = x0 + DIM.leftBayW * s;
  const drawerH = 4.5 * s;

  if (!opts.showPlumbing) {
    // Center vertical stile dividing Left Sink Bay (27 15/16") and Right Towel Bay (19 3/4")
    rect(page, divX - 0.38 * s, caseTopY, 0.76 * s, caseH, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.75,
    });

    // Horizontal mid rail separating top drawer band from lower doors
    line(page, x0 + 0.5 * s, caseTopY + drawerH, x0 + playW - 0.5 * s, caseTopY + drawerH, 0.85, C.black);

    // --- LEFT BAY (27 15/16"): Top false drawer w/ 1 1/2" recessed pull strip ---
    const lInX = x0 + 1.25 * s;
    const lInW = divX - 0.38 * s - lInX - 0.65 * s;
    rect(page, lInX, caseTopY + 0.55 * s, lInW, drawerH - 1.1 * s, {
      fill: C.oakTint,
      stroke: C.black,
      strokeWidth: 0.7,
    });
    // Recessed horizontal pull groove (1 1/2" H)
    rect(page, lInX + 0.6 * s, caseTopY + 1.45 * s, lInW - 1.2 * s, DIM.railBandH * s, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.6,
    });

    // Twin Inset Shaker Doors below (each ~13 29/32" wide, 13 1/4" inner panel height)
    const doorTopY = caseTopY + drawerH + 0.55 * s;
    const doorH = caseBotY - doorTopY - 0.55 * s;
    const pairGap = 0.65 * s;
    const singleW = (lInW - pairGap) / 2;
    for (let d = 0; d < 2; d++) {
      const dx = lInX + d * (singleW + pairGap);
      rect(page, dx, doorTopY, singleW, doorH, {
        fill: C.walnutTint,
        stroke: C.black,
        strokeWidth: 0.78,
      });
      // Recessed shaker inner panel
      const stile = 1.65 * s;
      const px = dx + stile;
      const pyTop = doorTopY + stile * 0.7;
      const pw = singleW - stile * 2;
      const ph = doorH - stile * 1.4;
      rect(page, px, pyTop, pw, ph, {
        fill: C.oakTint,
        stroke: C.black,
        strokeWidth: 0.62,
      });
      if (opts.showGrain) drawWalnutGrain(page, px, pyTop, pw, ph, 3);
      // Inner bevel reveal line
      rect(page, px + 0.35 * s, pyTop + 0.35 * s, pw - 0.7 * s, ph - 0.7 * s, {
        stroke: C.inkLight,
        strokeWidth: 0.32,
      });
    }

    // --- RIGHT BAY (19 3/4"): Top drawer w/ pull strip + 1 1/2" cantilevered towel bar + lower shaker door ---
    const rInX = divX + 0.85 * s;
    const rInW = x0 + playW - 1.25 * s - rInX;
    rect(page, rInX, caseTopY + 0.55 * s, rInW, drawerH - 1.1 * s, {
      fill: C.oakTint,
      stroke: C.black,
      strokeWidth: 0.7,
    });
    rect(page, rInX + 0.6 * s, caseTopY + 1.45 * s, rInW - 1.2 * s, DIM.railBandH * s, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.6,
    });

    // Lower shaker door tucked beneath the towel bar (8 3/4" recessed panel height)
    const rDoorTopY = caseTopY + drawerH + 3.6 * s;
    const rDoorH = caseBotY - rDoorTopY - 0.55 * s;
    rect(page, rInX, rDoorTopY, rInW, rDoorH, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.78,
    });
    const rStile = 1.65 * s;
    rect(page, rInX + rStile, rDoorTopY + rStile * 0.65, rInW - rStile * 2, rDoorH - rStile * 1.3, {
      fill: C.oakTint,
      stroke: C.black,
      strokeWidth: 0.62,
    });
    if (opts.showGrain) {
      drawWalnutGrain(page, rInX + rStile, rDoorTopY + rStile * 0.65, rInW - rStile * 2, rDoorH - rStile * 1.3, 4);
    }

    // Cantilevered 1 1/2" solid walnut towel rail spanning across right bay and projecting right
    const towelY = caseTopY + drawerH + 1.55 * s;
    const towelH = DIM.railBandH * s;
    const towelExtend = 3.2 * s;
    rect(page, rInX - 0.5 * s, towelY, rInW + towelExtend, towelH, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.9,
    });
    // Subtle chamfer highlight along towel rail
    line(page, rInX - 0.3 * s, towelY + towelH * 0.32, rInX + rInW + towelExtend - 0.2 * s, towelY + towelH * 0.32, 0.3, C.inkLight);
  } else {
    // Plumbing rough-in X-ray view: dashed bay divider + sink basin + supply/drain stubs
    line(page, divX, caseTopY, divX, caseBotY, 0.75, C.inkMid, [3, 2]);
    line(page, x0 + 0.5 * s, caseTopY + drawerH, x0 + playW - 0.5 * s, caseTopY + drawerH, 0.55, C.inkLight, [3, 2]);
    // Dashed undermount sink bowl profile
    const bowlX = x0 + (DIM.drainX - 7.5) * s;
    const bowlW = 15.0 * s;
    const bowlH = 6.5 * s;
    rect(page, bowlX, caseTopY, bowlW, bowlH, {
      fill: C.steelTint,
      stroke: C.inkMid,
      strokeWidth: 0.65,
      dash: [3, 2],
    });
    // Cold & Hot water supply stubs (20" AFF)
    const supplyY = floorY - DIM.supplyH * s;
    const coldX = x0 + DIM.coldSupplyX * s;
    const hotX = x0 + DIM.hotSupplyX * s;
    for (const sx of [coldX, hotX]) {
      page.drawCircle({ x: sx, y: py(supplyY), size: 0.95 * s, color: C.white, borderColor: C.black, borderWidth: 0.85 });
      page.drawCircle({ x: sx, y: py(supplyY), size: 0.35 * s, color: C.black });
    }
    // Drain stub (24" CL, 15 3/4" AFF)
    const drainX = x0 + DIM.drainX * s;
    const drainY = floorY - DIM.drainH * s;
    page.drawCircle({ x: drainX, y: py(drainY), size: 1.65 * s, color: C.white, borderColor: C.black, borderWidth: 0.95 });
    line(page, drainX - 2.3 * s, drainY, drainX + 2.3 * s, drainY, 0.4, C.inkMid, [2, 1.5]);
    line(page, drainX, drainY - 2.3 * s, drainX, drainY + 2.3 * s, 0.4, C.inkMid, [2, 1.5]);
  }

  if (opts.showFaucet) {
    drawGooseneckFaucet(page, x0 + 23.0 * s, counterTopY, s);
  }
  if (opts.showOutlets) {
    rect(page, x0 + 2.4 * s, counterTopY - 5.2 * s, 2.2 * s, 3.6 * s, { fill: C.white, stroke: C.inkMid, strokeWidth: 0.55 });
    rect(page, x0 + playW - 5.2 * s, counterTopY - 5.2 * s, 3.4 * s, 3.6 * s, { fill: C.white, stroke: C.inkMid, strokeWidth: 0.55 });
  }
}

// =============================================================================
// SHEET A-101 — ELEVATIONS, PLAY KITCHEN SECTIONS & SPECIFICATION SCHEDULE
// =============================================================================

function drawElevationAFullWall(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const totalW = DIM.builtInW + DIM.playW; // 121"
  const s = Math.min((box.innerW - 140) / totalW, (box.innerH - 86) / DIM.totalH);
  const drawW = totalW * s;
  const x0 = box.innerX + (box.innerW - drawW) / 2 + 12;
  const floorY = box.innerYTop + box.innerH - 36;
  const ceilY = floorY - DIM.totalH * s;

  // Floor datum line
  line(page, x0 - 26, floorY, x0 + drawW + 26, floorY, 1.25, C.black);

  // Subtle room boundary on right side above Play Kitchen
  const playX = x0 + DIM.builtInW * s;
  const builtInW = DIM.builtInW * s;
  const playW = DIM.playW * s;
  line(page, x0, ceilY, x0 + drawW, ceilY, 0.75, C.inkMid);
  line(page, x0 + drawW, ceilY, x0 + drawW, floorY, 0.75, C.inkMid);

  // --- LEFT CONTEXT: 72 3/4" × 101" Built-In Storage Wall (clean architectural context) ---
  rect(page, x0, ceilY, builtInW, DIM.totalH * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  const yToe = floorY - DIM.toeH * s;
  const yMidBot = yToe - DIM.lowerDoorH * s;
  const yMidTop = yMidBot - DIM.midRailH * s;
  const yUpTop = yMidTop - DIM.upperDoorH * s;
  const yTransTop = yUpTop - DIM.transomH * s;
  const yCrownTop = yTransTop - DIM.crownH * s;

  rect(page, x0, yToe, builtInW, DIM.toeH * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.75 });
  rect(page, x0 - 1.5, yMidTop, builtInW + 4.5, DIM.midRailH * s, { fill: C.stoneTint, stroke: C.black, strokeWidth: 0.75 });
  line(page, x0, yUpTop, x0 + builtInW, yUpTop, 0.75, C.black);
  line(page, x0, yTransTop, x0 + builtInW, yTransTop, 0.75, C.black);
  line(page, x0, yCrownTop, x0 + builtInW, yCrownTop, 0.65, C.inkMid);

  // 3 bays (6 vertical doors)
  for (let i = 1; i < 6; i++) {
    const dx = x0 + (builtInW * i) / 6;
    const isMajor = i % 2 === 0;
    line(page, dx, yMidBot, dx, yToe, isMajor ? 0.8 : 0.45, isMajor ? C.black : C.inkMid);
    line(page, dx, yUpTop, dx, yMidTop, isMajor ? 0.8 : 0.45, isMajor ? C.black : C.inkMid);
    if (isMajor) line(page, dx, yTransTop, dx, yUpTop, 0.75, C.black);
  }

  // Clean subtle context label INSIDE clear ceiling band (zero line collisions!)
  drawCadLabel(page, font, ['EXISTING BUILT-IN WALL (CONTEXT)'], x0 + builtInW / 2, ceilY - 10, {
    size: 5.8,
    align: 'center',
    color: C.inkLight,
  });

  // --- RIGHT PRIMARY SUBJECT: 48 1/4" Solid Walnut Heirloom Play Kitchen ---
  drawPlayKitchenFrontElevation(page, playX, floorY, s, {
    showFaucet: true,
    showGrain: true,
    showOutlets: true,
  });

  // Round wall sconce / mirror rough-in above play kitchen
  page.drawCircle({
    x: playX + 21.5 * s,
    y: py(floorY - 67.5 * s),
    size: 3.1 * s,
    borderColor: C.inkMid,
    borderWidth: 0.65,
  });

  // Section Cut Bubbles A, B, C — ALL focused on the Play Kitchen!
  const badgeY = ceilY - 16;
  const cutAX = playX + 9.5 * s;   // Left sink bay door
  const cutBX = playX + 24.0 * s;  // Sink & plumbing CL
  const cutCX = playX + 38.5 * s;  // Right towel-bar bay
  for (const [cx, letter, col] of [
    [cutAX, 'A', C.orange],
    [cutBX, 'B', C.cyan],
    [cutCX, 'C', C.yellow],
  ] as const) {
    line(page, cx, badgeY + 12, cx, floorY - 30.5 * s - 2, 0.45, C.inkLight, [3, 2]);
    drawSectionBadge(page, font, cx, badgeY, 10, letter, col);
  }

  // Clean Overall Dimensions
  drawDimArrow(page, font, x0 - 16, ceilY, x0 - 16, floorY, '101"', 'left');
  drawDimArrow(page, font, x0, floorY + 18, playX, floorY + 18, '72 3/4" BUILT-IN CONTEXT');
  drawDimArrow(page, font, playX, floorY + 18, x0 + drawW, floorY + 18, '48 1/4" PLAY KITCHEN');
  drawDimArrow(page, font, x0 + drawW + 18, floorY - DIM.playCounterH * s, x0 + drawW + 18, floorY, '30 1/2"');
}

function drawElevationBPlumbing(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Enlarged Play Kitchen Plumbing Rough-In (100% focused on Play Kitchen!)
  const s = Math.min((box.innerW - 140) / DIM.playW, (box.innerH - 110) / 42);
  const drawW = DIM.playW * s;
  const x0 = box.innerX + (box.innerW - drawW) / 2 - 14;
  const floorY = box.innerYTop + box.innerH - 42;

  // Floor line + left reference wall face
  line(page, x0 - 18, floorY, x0 + drawW + 52, floorY, 1.25, C.black);
  rect(page, x0 - 7, floorY - 40 * s, 7, 40 * s, { fill: C.wallFill, stroke: C.black, strokeWidth: 0.75 });

  drawPlayKitchenFrontElevation(page, x0, floorY, s, {
    showFaucet: true,
    showPlumbing: true,
  });

  // Clean non-overlapping plumbing rough-in dimensions
  const supplyY = floorY - DIM.supplyH * s;
  const drainY = floorY - DIM.drainH * s;
  const coldX = x0 + DIM.coldSupplyX * s;
  const hotX = x0 + DIM.hotSupplyX * s;
  const drainX = x0 + DIM.drainX * s;

  // Vertical leader ticks down/up to dimension lines
  line(page, coldX, supplyY - 1.2 * s, coldX, floorY - 37.5 * s, 0.45, C.inkMid, [2, 2]);
  drawDimArrow(page, font, x0, floorY - 36.5 * s, coldX, floorY - 36.5 * s, '20 1/2" COLD');

  line(page, hotX, supplyY + 1.2 * s, hotX, floorY - 11.5 * s, 0.45, C.inkMid, [2, 2]);
  drawDimArrow(page, font, x0, floorY - 12.5 * s, hotX, floorY - 12.5 * s, '26 3/4" HOT');

  line(page, drainX, drainY + 1.8 * s, drainX, floorY + 20, 0.45, C.inkMid, [2, 2]);
  drawDimArrow(page, font, x0, floorY + 18, drainX, floorY + 18, '24" DRAIN CL');

  // Right vertical height dimensions (20" supplies, 15 3/4" drain)
  line(page, hotX + 1.5 * s, supplyY, x0 + drawW + 38, supplyY, 0.4, C.inkLight, [2, 2]);
  line(page, drainX + 2.0 * s, drainY, x0 + drawW + 18, drainY, 0.4, C.inkLight, [2, 2]);
  drawDimArrow(page, font, x0 + drawW + 16, drainY, x0 + drawW + 16, floorY, '15 3/4"');
  drawDimArrow(page, font, x0 + drawW + 36, supplyY, x0 + drawW + 36, floorY, '20"');
}

/** Enlarged Play Kitchen Section (Sections A, B, C on A-101 — scaled to Play Kitchen, NOT 101" empty wall!) */
function drawPlayKitchenSection(
  page: PDFPage,
  font: PDFFont,
  box: ViewportCard,
  variant: 'sink-bay' | 'plumbing' | 'towel-bar'
) {
  // Scale generously to the 30 1/2" counter + 11" faucet height!
  const s = Math.min((box.innerW - 140) / (DIM.playD + 6), (box.innerH - 58) / 43);
  const floorY = box.innerYTop + box.innerH - 26;
  const wallX = box.innerX + 34;
  const wallW = 8;
  const cabX = wallX + wallW;
  const cabD = DIM.playD * s;
  const counterTopY = floorY - DIM.playCounterH * s;
  const topThk = DIM.playTopThk * s;
  const caseTopY = counterTopY + topThk;
  const caseBotY = floorY - DIM.legH * s;
  const legR = 2.45 * s;

  // Floor & rear wall poché
  line(page, wallX - 10, floorY, cabX + cabD + 30, floorY, 1.25, C.black);
  rect(page, wallX, counterTopY - 12 * s, wallW, (DIM.playCounterH + 12) * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });

  // Back & front stacked-ball legs + side scalloped apron (5 scallops)
  const backLegCx = cabX + 3.4 * s;
  const frontLegCx = cabX + cabD - 3.4 * s;
  drawScallopedApron(page, backLegCx + legR * 0.7, frontLegCx - legR * 0.7, caseBotY, 1.45 * s, 4, 0.78);
  drawStackedBallLeg(page, backLegCx, caseBotY, DIM.legH * s, legR, 0.82);
  drawStackedBallLeg(page, frontLegCx, caseBotY, DIM.legH * s, legR, 0.82);

  // Solid walnut carcass section box (with 3/4" walls shown in cut)
  rect(page, cabX, caseTopY, cabD, DIM.playCaseH * s, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  const wallT = 0.75 * s;
  rect(page, cabX + wallT, caseTopY + wallT, cabD - wallT * 2, DIM.playCaseH * s - wallT * 2, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.65,
  });

  // 1 1/4" Honed quartz countertop (1/2" front overhang)
  rect(page, cabX, counterTopY, cabD + 0.6 * s, topThk, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });

  if (variant === 'sink-bay') {
    // Undermount stainless sink bowl + adjustable interior shelf + front shaker door profile
    rect(page, cabX + 3.5 * s, caseTopY, 12.5 * s, 6.2 * s, {
      fill: C.steelTint,
      stroke: C.black,
      strokeWidth: 0.8,
    });
    // Adjustable interior shelf
    rect(page, cabX + wallT, caseBotY - 6.8 * s, cabD - wallT * 2, 0.75 * s, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.65,
    });
    // Front door & false drawer cut line
    line(page, cabX + cabD, caseTopY + 4.5 * s, cabX + cabD - wallT, caseTopY + 4.5 * s, 0.75, C.black);
  } else if (variant === 'plumbing') {
    // Gooseneck faucet in side profile + undermount sink + P-trap to wall drain stub + supply stub
    drawGooseneckFaucet(page, cabX + 3.2 * s, counterTopY, s * 0.95);
    rect(page, cabX + 4.0 * s, caseTopY, 11.8 * s, 6.2 * s, {
      fill: C.steelTint,
      stroke: C.black,
      strokeWidth: 0.8,
    });
    // Drain tailpiece & P-trap to 15 3/4" wall stub
    const drainY = floorY - DIM.drainH * s;
    const trapX = cabX + 9.8 * s;
    line(page, trapX, caseTopY + 6.2 * s, trapX, drainY + 1.5 * s, 1.0, C.inkDark);
    line(page, trapX, drainY, cabX, drainY, 1.0, C.inkDark);
    page.drawCircle({ x: cabX + 0.6 * s, y: py(drainY), size: 1.0 * s, color: C.white, borderColor: C.black, borderWidth: 0.8 });
    // Supply stub at 20" AFF
    const supplyY = floorY - DIM.supplyH * s;
    page.drawCircle({ x: cabX + 0.6 * s, y: py(supplyY), size: 0.7 * s, color: C.white, borderColor: C.black, borderWidth: 0.75 });
  } else {
    // Right Towel-Bar Bay: top drawer box + cantilevered 1 1/2" walnut towel rail projecting front + lower shelf
    rect(page, cabX + wallT + 0.6 * s, caseTopY + 0.8 * s, cabD - wallT * 2 - 1.2 * s, 3.6 * s, {
      fill: C.oakTint,
      stroke: C.black,
      strokeWidth: 0.65,
    });
    // Projecting 1 1/2" solid walnut towel bar (with stand-off bracket)
    const towelY = caseTopY + 6.0 * s;
    rect(page, cabX + cabD, towelY + 0.35 * s, 2.2 * s, 0.8 * s, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.7,
    });
    rect(page, cabX + cabD + 1.6 * s, towelY, 1.5 * s, 1.5 * s, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.85,
    });
    // Lower adjustable shelf
    rect(page, cabX + wallT, caseBotY - 6.8 * s, cabD - wallT * 2, 0.75 * s, {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.65,
    });
  }

  // Right-side callout notes
  const noteX = cabX + cabD + 22;
  const noteY = caseTopY + 8;
  const notes =
    variant === 'sink-bay'
      ? ['30 1/2" COUNTER HT', '1 1/4" HONED QUARTZ', '19 1/2" WALNUT CASE', '9 3/4" TURNED LEGS', 'SCALLOPED APRON']
      : variant === 'plumbing'
        ? ['GOOSENECK FAUCET', 'UNDERMOUNT SINK', '20" SUPPLY STUBS', '15 3/4" DRAIN STUB', 'P-TRAP CLEARANCE']
        : ['TOP UTILITY DRAWER', '1 1/2" WALNUT RAIL', '2 1/4" PROJECTION', '8 3/4" SHAKER DOOR', '20" CASE DEPTH'];
  drawCadLabel(page, font, notes, noteX, noteY, { size: 5.5, color: C.inkMid });
}

// =============================================================================
// SHEET A-102 — PLAY KITCHEN FLOOR PLAN & HIGH-DETAIL 3/4 ISOMETRIC
// =============================================================================

function drawPlayKitchenFloorPlanA102(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Focused 100% on the 48 1/4" W × 20" D Heirloom Play Kitchen!
  const s = Math.min((box.innerW - 140) / (DIM.playW + 5), (box.innerH - 220) / (DIM.playD + 8));
  const drawW = DIM.playW * s;
  const drawD = DIM.playD * s;
  const x0 = box.innerX + (box.innerW - drawW) / 2 - 8;
  const y0 = box.innerYTop + (box.innerH - 70 - drawD) / 2 + 12;

  // Rear & side reference walls (subtle architectural poché)
  const wallT = 9;
  rect(page, x0 - wallT, y0 - wallT, drawW + wallT * 2 + 18, wallT, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // Left abutment face (adjacent built-in wall context)
  rect(page, x0 - wallT, y0, wallT, drawD + 16, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // Right alcove return wall
  rect(page, x0 + drawW + 18, y0, wallT, drawD + 16, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });

  // 48 1/4" × 20" Honed quartz countertop slab
  rect(page, x0, y0, drawW, drawD, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.05,
  });

  // Dashed bay divider (27 15/16" left sink bay | 19 3/4" right towel bay)
  const divX = x0 + DIM.leftBayW * s;
  line(page, divX, y0, divX, y0 + drawD, 0.7, C.inkMid, [4, 2.5]);

  // Dashed footprints of all 4× Lathe-Turned Stacked-Ball Legs (5 1/4" max Ø)
  const legR = 2.625 * s;
  const legXs = [x0 + 6.0 * s, x0 + (DIM.playW - 6.0) * s];
  const legYs = [y0 + 3.6 * s, y0 + drawD - 3.6 * s];
  for (const lx of legXs) {
    for (const ly of legYs) {
      page.drawCircle({
        x: lx,
        y: py(ly),
        size: legR,
        borderColor: C.inkMid,
        borderWidth: 0.65,
        borderDashArray: [3, 2],
      });
      // Center crosshairs
      line(page, lx - 3, ly, lx + 3, ly, 0.4, C.inkLight);
      line(page, lx, ly - 3, lx, ly + 3, 0.4, C.inkLight);
    }
  }

  // Undermount stainless steel sink basin (centered on 24" drain CL)
  const sinkW = 14.5 * s;
  const sinkD = 11.5 * s;
  const sinkX = x0 + DIM.drainX * s - sinkW / 2;
  const sinkY = y0 + 5.2 * s;
  rect(page, sinkX, sinkY, sinkW, sinkD, {
    fill: C.white,
    stroke: C.black,
    strokeWidth: 0.9,
  });
  rect(page, sinkX + 0.7 * s, sinkY + 0.7 * s, sinkW - 1.4 * s, sinkD - 1.4 * s, {
    fill: C.steelTint,
    stroke: C.inkMid,
    strokeWidth: 0.55,
  });
  // Drain + faucet escutcheon
  const drainX = x0 + DIM.drainX * s;
  const drainY = sinkY + sinkD / 2;
  page.drawCircle({ x: drainX, y: py(drainY), size: 1.2 * s, color: C.white, borderColor: C.black, borderWidth: 0.75 });
  page.drawCircle({ x: drainX - 0.8 * s, y: py(y0 + 2.6 * s), size: 0.95 * s, color: C.steelTint, borderColor: C.black, borderWidth: 0.75 });
  line(page, drainX - 0.8 * s, y0 + 2.6 * s, drainX - 0.8 * s, sinkY + 2.8 * s, 1.35, C.black);

  // Cantilevered 1 1/2" solid walnut towel bar along right bay front + returning to right wall
  const towelD = 1.5 * s;
  const towelY = y0 + drawD + 1.6 * s;
  rect(page, divX + 1.0 * s, towelY, drawW - DIM.leftBayW * s + 16.5, towelD, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.85,
  });
  // Stand-off brackets to cabinet front
  rect(page, divX + 2.2 * s, y0 + drawD, 1.0 * s, 1.6 * s, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.65 });
  rect(page, x0 + drawW - 2.4 * s, y0 + drawD, 1.0 * s, 1.6 * s, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.65 });

  // Labels inside plan bays
  drawCadLabel(page, font, ['SINK BAY', '27 15/16" W'], x0 + (DIM.leftBayW * s) / 2, y0 + drawD - 14, {
    size: 5.8,
    align: 'center',
    color: C.inkDark,
  });
  drawCadLabel(page, font, ['TOWEL BAY', '19 3/4" W'], divX + (DIM.rightBayW * s) / 2, y0 + drawD / 2 + 2, {
    size: 5.8,
    align: 'center',
    color: C.inkDark,
  });

  // Clean Fractional Dimensions
  drawDimArrow(page, font, x0, y0 - 44, x0 + drawW, y0 - 44, '48 1/4" OVERALL PLAY KITCHEN');
  drawDimArrow(page, font, x0, y0 - 24, divX, y0 - 24, '27 15/16"');
  drawDimArrow(page, font, divX, y0 - 24, x0 + drawW, y0 - 24, '19 3/4"');
  drawDimArrow(page, font, x0 - 22, y0, x0 - 22, y0 + drawD, '20"', 'left');
  drawDimArrow(page, font, legXs[0], y0 + drawD + 48, legXs[1], y0 + drawD + 48, '42 1/4" LEG CL SPAN');

  // Section Cut Bubbles A, B, C
  const cutY = y0 + drawD + 74;
  for (const [cx, letter, col] of [
    [x0 + 9.5 * s, 'A', C.orange],
    [drainX, 'B', C.cyan],
    [x0 + 38.5 * s, 'C', C.yellow],
  ] as const) {
    line(page, cx, y0 - 4, cx, cutY - 12, 0.48, C.inkLight, [3, 2]);
    drawSectionBadge(page, font, cx, cutY, 10, letter, col);
  }

  // Bottom Section Cut Legend
  const legX = box.innerX + 12;
  const legY = box.innerYTop + box.innerH - 42;
  drawSectionCutLegend(page, font, legX, legY, box.innerW - 24, [
    { code: 'A', text: 'SINK BAY', color: C.orange, x: legX + 158 },
    { code: 'B', text: 'PLUMBING CL', color: C.cyan, x: legX + 312 },
    { code: 'C', text: 'TOWEL RAIL', color: C.yellow, x: legX + 492 },
  ]);
}

/**
 * High-Detail 3/4 Architectural Isometric of the Heirloom Play Kitchen (Sheet A-102 Right Panel).
 * Dedicated 100% to the Play Kitchen (no giant built-in wall) with 3-tone shading,
 * 3D stacked-ball walnut legs, scalloped front & side aprons, inset shaker doors,
 * recessed top pull strips, cantilevered 1 1/2" walnut towel bar, undermount sink & gooseneck faucet!
 */
function drawPlayKitchenIsometricA102(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const sc = 8.8;
  const ox = box.innerX + box.innerW * 0.36;
  const oy = box.innerYTop + box.innerH * 0.62;

  // Low-angle architectural 3/4 axonometric (same cohesive angle as Coffee Table & Wet Bar!)
  const vxX = 0.88;
  const vxY = 0.22;
  const vyX = -0.58;
  const vyY = 0.28;

  const p3 = (x: number, y: number, z: number): [number, number] => [
    ox + (x * vxX + y * vyX) * sc,
    oy + (x * vxY + y * vyY - z) * sc,
  ];

  const shadeTop = C.stoneTint;
  const shadeFront = C.oakTint;
  const shadeSide = C.walnutTint;

  const drawBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    opts: { top?: ReturnType<typeof rgb>; front?: ReturnType<typeof rgb>; side?: ReturnType<typeof rgb>; sw?: number } = {}
  ) => {
    const sw = opts.sw ?? 0.85;
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
      fill: opts.top ?? C.white,
      stroke: C.black,
      strokeWidth: sw,
    });
  };

  /** Draw a 3D stacked-ball walnut leg centered at (cx, cy) from z=0 to z=9.75 */
  const drawIsoLeg = (cx: number, cy: number) => {
    const [topX, topY] = p3(cx, cy, DIM.legH);
    const [, botY] = p3(cx, cy, 0);
    drawStackedBallLeg(page, topX, topY, botY - topY, 2.55 * sc * 0.92, 0.82);
  };

  // Subtle architectural floor shadow grid footprint
  polygon(
    page,
    [p3(-4, -3, 0), p3(55, -3, 0), p3(55, 25, 0), p3(-4, 25, 0)],
    { stroke: C.inkFaint, strokeWidth: 0.5 }
  );

  // 1. Back-left & Back-right turned stacked-ball legs
  drawIsoLeg(6.0, 3.6);
  drawIsoLeg(DIM.playW - 6.0, 3.6);

  // 2. Scalloped apron along front (y = 19.3) and right side (x = 47.6)
  const apronZTop = DIM.legH;
  const apronDrop = 1.65;
  // Right-side scalloped apron (4 scallops along Y)
  {
    const yStart = 5.4;
    const yEnd = 15.8;
    const count = 4;
    const step = (yEnd - yStart) / count;
    const pts: Array<[number, number]> = [p3(DIM.playW - 0.8, yStart, apronZTop), p3(DIM.playW - 0.8, yEnd, apronZTop)];
    const segs = 8;
    for (let i = count - 1; i >= 0; i--) {
      const ya = yStart + i * step;
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        const yv = ya + step * (1 - t);
        const zv = apronZTop - Math.sin(t * Math.PI) * apronDrop;
        pts.push(p3(DIM.playW - 0.8, yv, zv));
      }
    }
    polygon(page, pts, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.8 });
  }
  // Front scalloped apron (9 smooth semicircular scallops along X)
  {
    const xStart = 8.4;
    const xEnd = DIM.playW - 8.4;
    const count = 9;
    const step = (xEnd - xStart) / count;
    const pts: Array<[number, number]> = [p3(xStart, DIM.playD - 0.8, apronZTop), p3(xEnd, DIM.playD - 0.8, apronZTop)];
    const segs = 8;
    for (let i = count - 1; i >= 0; i--) {
      const xa = xStart + i * step;
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        const xv = xa + step * (1 - t);
        const zv = apronZTop - Math.sin(t * Math.PI) * apronDrop;
        pts.push(p3(xv, DIM.playD - 0.8, zv));
      }
    }
    polygon(page, pts, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.8 });
  }

  // 3. Front-left & Front-right turned stacked-ball legs
  drawIsoLeg(6.0, DIM.playD - 3.6);
  drawIsoLeg(DIM.playW - 6.0, DIM.playD - 3.6);

  // 4. Main Solid Walnut Carcass (47.25" W × 19.2" D × 19.5" H)
  const zCase = DIM.legH;
  const hCase = DIM.playCaseH;
  drawBox(0.5, 0.2, zCase, DIM.playW - 1.0, DIM.playD - 0.7, hCase, {
    top: C.walnutTint,
    front: C.walnutTint,
    side: C.walnutTint,
    sw: 0.95,
  });

  // Right side shaker panel detail on visible right face (x = playW - 0.5)
  polygon(
    page,
    [
      p3(DIM.playW - 0.5, 2.2, zCase + 2.0),
      p3(DIM.playW - 0.5, DIM.playD - 2.5, zCase + 2.0),
      p3(DIM.playW - 0.5, DIM.playD - 2.5, zCase + hCase - 2.0),
      p3(DIM.playW - 0.5, 2.2, zCase + hCase - 2.0),
    ],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 0.65 }
  );

  // Front cabinet facework (y = playD - 0.5)
  const fy = DIM.playD - 0.5;
  const divX = DIM.leftBayW;
  const zMid = zCase + hCase - 4.5;

  // Center vertical stile & horizontal mid rail
  line(page, ...p3(divX, fy, zCase), ...p3(divX, fy, zCase + hCase), 0.95, C.black);
  line(page, ...p3(0.5, fy, zMid), ...p3(DIM.playW - 0.5, fy, zMid), 0.9, C.black);

  // Left bay top false drawer + recessed 1 1/2" pull strip
  polygon(
    page,
    [p3(1.4, fy, zMid + 0.6), p3(divX - 0.8, fy, zMid + 0.6), p3(divX - 0.8, fy, zCase + hCase - 0.6), p3(1.4, fy, zCase + hCase - 0.6)],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 0.7 }
  );
  polygon(
    page,
    [p3(2.2, fy, zMid + 1.4), p3(divX - 1.6, fy, zMid + 1.4), p3(divX - 1.6, fy, zMid + 2.9), p3(2.2, fy, zMid + 2.9)],
    { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.6 }
  );

  // Left bay twin inset shaker doors
  const pairMid = (1.4 + (divX - 0.8)) / 2;
  const doorRanges: Array<[number, number]> = [
    [1.4, pairMid - 0.3],
    [pairMid + 0.3, divX - 0.8],
  ];
  for (const [xa, xb] of doorRanges) {
    polygon(page, [p3(xa, fy, zCase + 0.6), p3(xb, fy, zCase + 0.6), p3(xb, fy, zMid - 0.6), p3(xa, fy, zMid - 0.6)], {
      fill: C.walnutTint,
      stroke: C.black,
      strokeWidth: 0.75,
    });
    // Recessed shaker panel
    polygon(
      page,
      [p3(xa + 1.6, fy, zCase + 2.1), p3(xb - 1.6, fy, zCase + 2.1), p3(xb - 1.6, fy, zMid - 2.1), p3(xa + 1.6, fy, zMid - 2.1)],
      { fill: C.oakTint, stroke: C.black, strokeWidth: 0.62 }
    );
  }

  // Right bay top drawer + pull strip
  const rxa = divX + 0.8;
  const rxb = DIM.playW - 1.4;
  polygon(
    page,
    [p3(rxa, fy, zMid + 0.6), p3(rxb, fy, zMid + 0.6), p3(rxb, fy, zCase + hCase - 0.6), p3(rxa, fy, zCase + hCase - 0.6)],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 0.7 }
  );
  polygon(
    page,
    [p3(rxa + 0.8, fy, zMid + 1.4), p3(rxb - 0.8, fy, zMid + 1.4), p3(rxb - 0.8, fy, zMid + 2.9), p3(rxa + 0.8, fy, zMid + 2.9)],
    { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.6 }
  );

  // Right bay lower shaker door (tucked beneath towel bar)
  polygon(
    page,
    [p3(rxa, fy, zCase + 0.6), p3(rxb, fy, zCase + 0.6), p3(rxb, fy, zMid - 3.6), p3(rxa, fy, zMid - 3.6)],
    { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.75 }
  );
  polygon(
    page,
    [p3(rxa + 1.6, fy, zCase + 1.8), p3(rxb - 1.6, fy, zCase + 1.8), p3(rxb - 1.6, fy, zMid - 4.8), p3(rxa + 1.6, fy, zMid - 4.8)],
    { fill: C.oakTint, stroke: C.black, strokeWidth: 0.62 }
  );

  // Cantilevered 1 1/2" solid walnut towel rail + stand-off brackets in true 3D!
  const zTowel = zMid - 2.8;
  drawBox(rxa + 1.2, fy, zTowel + 0.35, 1.0, 1.8, 0.8, { top: C.walnutTint, front: C.walnutTint, side: C.walnutTint, sw: 0.6 });
  drawBox(rxb - 2.2, fy, zTowel + 0.35, 1.0, 1.8, 0.8, { top: C.walnutTint, front: C.walnutTint, side: C.walnutTint, sw: 0.6 });
  drawBox(rxa - 0.4, fy + 1.4, zTowel, DIM.rightBayW + 3.2, 1.5, 1.5, {
    top: C.oakTint,
    front: C.walnutTint,
    side: C.walnutTint,
    sw: 0.88,
  });

  // 5. 1 1/4" Honed Quartz Countertop (48 1/4" × 20")
  const zTop = zCase + hCase;
  drawBox(0, 0, zTop, DIM.playW, DIM.playD, DIM.playTopThk, {
    top: C.stoneTint,
    front: C.gray,
    side: C.grayMed,
    sw: 1.05,
  });

  // 6. Undermount stainless steel sink basin cutout + gooseneck faucet on countertop
  const zSurf = zTop + DIM.playTopThk;
  const sinkX0 = 16.5;
  const sinkY0 = 5.2;
  const sinkW = 14.5;
  const sinkD = 11.2;
  polygon(
    page,
    [p3(sinkX0, sinkY0, zSurf), p3(sinkX0 + sinkW, sinkY0, zSurf), p3(sinkX0 + sinkW, sinkY0 + sinkD, zSurf), p3(sinkX0, sinkY0 + sinkD, zSurf)],
    { fill: C.steelTint, stroke: C.black, strokeWidth: 0.88 }
  );
  // Inner sink basin depth drop line
  line(page, ...p3(sinkX0, sinkY0 + sinkD, zSurf), ...p3(sinkX0, sinkY0 + sinkD - 2.2, zSurf - 2.2), 0.55, C.inkMid);
  line(page, ...p3(sinkX0, sinkY0 + 2.2, zSurf - 2.2), ...p3(sinkX0 + sinkW - 2.0, sinkY0 + 2.2, zSurf - 2.2), 0.5, C.inkLight);
  // Drain
  const [drX, drY] = p3(sinkX0 + sinkW / 2, sinkY0 + sinkD / 2, zSurf - 0.5);
  page.drawEllipse({ x: drX, y: py(drY), xScale: 5.5, yScale: 3.0, color: C.white, borderColor: C.black, borderWidth: 0.65 });

  // Smooth curved gooseneck faucet rising cleanly behind sink
  const fx = sinkX0 + sinkW / 2 - 0.5;
  const fyBase = sinkY0 - 2.2;
  line(page, ...p3(fx, fyBase, zSurf), ...p3(fx, fyBase, zSurf + 9.2), 2.1, C.black);
  const archR = 2.6;
  const archSegs = 8;
  for (let k = 0; k < archSegs; k++) {
    const a1 = (k / archSegs) * Math.PI;
    const a2 = ((k + 1) / archSegs) * Math.PI;
    const pA = p3(fx, fyBase + archR * (1 - Math.cos(a1)), zSurf + 9.2 + archR * Math.sin(a1));
    const pB = p3(fx, fyBase + archR * (1 - Math.cos(a2)), zSurf + 9.2 + archR * Math.sin(a2));
    line(page, ...pA, ...pB, 1.85, C.black);
  }
  line(page, ...p3(fx, fyBase + archR * 2, zSurf + 9.2), ...p3(fx, fyBase + archR * 2, zSurf + 7.6), 1.75, C.black);
  // Side lever
  line(page, ...p3(fx, fyBase, zSurf + 2.2), ...p3(fx + 2.4, fyBase, zSurf + 2.2), 1.4, C.black);
  line(page, ...p3(fx + 2.4, fyBase, zSurf + 2.2), ...p3(fx + 2.4, fyBase, zSurf + 4.4), 1.2, C.black);

  // Clean Leader-Lined Craft Callouts (same crisp architectural grammar as Coffee Table!)
  const callout = (lines: string[], tx: number, ty: number, px: number, pyv: number, align: 'left' | 'right' = 'left') => {
    drawCadLabel(page, font, lines, tx, ty, { size: 5.9, align, color: C.inkDark });
    const startX = align === 'left' ? tx + 132 : tx - 132;
    line(page, startX, ty - 2, px, pyv, 0.45, C.inkLight);
    page.drawCircle({ x: px, y: py(pyv), size: 1.8, color: C.black });
  };

  callout(['01 · 1 1/4" HONED QUARTZ TOP', '     UNDERMOUNT STAINLESS SINK'], box.innerX + 20, box.innerYTop + 48, ...p3(20, 9, zSurf), 'left');
  callout(['02 · RECESSED 1 1/2" PULL STRIPS', '     & INSET WALNUT SHAKER DOORS'], box.innerX + 20, box.innerYTop + 138, ...p3(8, fy, zMid - 4), 'left');
  callout(['03 · CONTINUOUS SCALLOPED APRON', '     SOLID AMERICAN BLACK WALNUT'], box.innerX + 20, box.innerYTop + 530, ...p3(19, fy, apronZTop - 0.8), 'left');

  callout(['04 · 1 1/2" WALNUT TOWEL RAIL', '     CANTILEVERED TO RETURN WALL'], box.innerX + box.innerW - 20, box.innerYTop + 104, ...p3(DIM.playW + 0.5, fy + 2, zTowel + 0.8), 'right');
  callout(['05 · 4× LATHE-TURNED LEGS (9 3/4" H)', '     GRADUATED STACKED-BALL PROFILE'], box.innerX + box.innerW - 20, box.innerYTop + 530, ...p3(DIM.playW - 6.0, DIM.playD - 3.6, 4.5), 'right');

  drawCadLabel(
    page,
    font,
    ['ORTHOGRAPHIC 3/4 ISOMETRIC  ·  48 1/4" W × 20" D × 30 1/2" H SOLID BLACK WALNUT HEIRLOOM PLAY KITCHEN'],
    box.innerX + box.innerW / 2,
    box.innerYTop + box.innerH - 12,
    { size: 6.1, align: 'center', color: C.inkMid }
  );
}

// =============================================================================
// SHEET A-103 — DIMENSIONED FRONT & SIDE ELEVATIONS, LEG SECTION & 1:1 PROFILES
// =============================================================================

function drawPlayKitchenDetailElevation(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = Math.min((box.innerW - 180) / (DIM.playW + 4), (box.innerH - 110) / 42);
  const drawW = DIM.playW * s;
  const x0 = box.innerX + (box.innerW - drawW) / 2 - 8;
  const floorY = box.innerYTop + box.innerH - 46;

  line(page, x0 - 22, floorY, x0 + drawW + 42, floorY, 1.25, C.black);
  drawPlayKitchenFrontElevation(page, x0, floorY, s, {
    showFaucet: true,
    showGrain: true,
  });

  const counterTopY = floorY - DIM.playCounterH * s;
  const caseTopY = counterTopY + DIM.playTopThk * s;
  const caseBotY = floorY - DIM.legH * s;
  const divX = x0 + DIM.leftBayW * s;
  const leftLegCx = x0 + 6.0 * s;
  const rightLegCx = x0 + DIM.playW * s - 6.0 * s;
  const legR = 2.65 * s;

  // Section D bubble pointing to left stacked-ball leg & apron joint
  drawSectionBadge(page, font, leftLegCx, counterTopY - 28, 10, 'D', C.orange);
  line(page, leftLegCx, counterTopY - 16, leftLegCx, floorY + 24, 0.45, C.inkMid, [3, 2]);

  // Exact Fractional Dimensions matching Rhino Elevation A1
  drawDimArrow(page, font, x0, counterTopY - 14, divX, counterTopY - 14, '27 15/16"');
  drawDimArrow(page, font, divX, counterTopY - 14, x0 + drawW, counterTopY - 14, '19 3/4"');

  // Left vertical heights (cleanly outside on the left!)
  drawDimArrow(page, font, x0 - 16, caseTopY, x0 - 16, caseBotY, '19 1/2"', 'left');
  drawDimArrow(page, font, x0 - 44, counterTopY, x0 - 44, floorY, '30 1/2"', 'left');

  // Right vertical leg & towel rail heights
  drawDimArrow(page, font, x0 + drawW + 24, caseBotY, x0 + drawW + 24, floorY, '9 3/4" LEGS');

  // Bottom leg clear & center-to-center spans
  drawDimArrow(page, font, leftLegCx + legR, floorY + 14, rightLegCx - legR, floorY + 14, '30 1/4" CLEAR');
  drawDimArrow(page, font, leftLegCx, floorY + 30, rightLegCx, floorY + 30, '42 1/4" LEG SPAN');
}

function drawPlayKitchenSideElevation(page: PDFPage, font: PDFFont, box: ViewportCard) {
  // Right Side Elevation (20" Depth × 30 1/2" H) — replaces built-in wall on Sheet A-103!
  const s = Math.min((box.innerW - 220) / (DIM.playD + 6), (box.innerH - 96) / 42);
  const cabD = DIM.playD * s;
  const x0 = box.innerX + (box.innerW - cabD) / 2 - 4;
  const floorY = box.innerYTop + box.innerH - 40;
  const counterTopY = floorY - DIM.playCounterH * s;
  const caseTopY = counterTopY + DIM.playTopThk * s;
  const caseBotY = floorY - DIM.legH * s;
  const legR = 2.65 * s;

  // Floor & rear wall poché
  line(page, x0 - 24, floorY, x0 + cabD + 48, floorY, 1.25, C.black);
  rect(page, x0 - 10, counterTopY - 12 * s, 10, (DIM.playCounterH + 12) * s, {
    fill: C.wallFill,
    stroke: C.black,
    strokeWidth: 0.85,
  });

  // Back & front stacked-ball legs + side 4-scallop walnut apron
  const backLegCx = x0 + 3.6 * s;
  const frontLegCx = x0 + cabD - 3.6 * s;
  drawScallopedApron(page, backLegCx + legR * 0.72, frontLegCx - legR * 0.72, caseBotY, 1.55 * s, 4, 0.82);
  drawStackedBallLeg(page, backLegCx, caseBotY, DIM.legH * s, legR, 0.85);
  drawStackedBallLeg(page, frontLegCx, caseBotY, DIM.legH * s, legR, 0.85);

  // Solid walnut side panel with inset shaker panel & vertical grain
  rect(page, x0, caseTopY, cabD - 0.5 * s, DIM.playCaseH * s, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  const st = 2.0 * s;
  rect(page, x0 + st, caseTopY + st, cabD - 0.5 * s - st * 2, DIM.playCaseH * s - st * 2, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.65,
  });
  drawWalnutGrain(page, x0 + st, caseTopY + st, cabD - 0.5 * s - st * 2, DIM.playCaseH * s - st * 2, 5);

  // 1 1/4" Honed quartz countertop (1/2" front overhang)
  rect(page, x0, counterTopY, cabD + 0.5 * s, DIM.playTopThk * s, {
    fill: C.stoneTint,
    stroke: C.black,
    strokeWidth: 1.0,
  });

  // Projecting 1 1/2" solid walnut towel bar + bracket on front face (right side)
  const towelY = caseTopY + 6.0 * s;
  rect(page, x0 + cabD - 0.5 * s, towelY + 0.35 * s, 2.2 * s, 0.8 * s, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.72,
  });
  rect(page, x0 + cabD + 1.2 * s, towelY, 1.5 * s, 1.5 * s, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.88,
  });

  // Gooseneck faucet in side profile
  drawGooseneckFaucet(page, x0 + 3.2 * s, counterTopY, s * 0.92);

  // Clean Dimensions (vertical heights on left, towel bar callout unobstructed on right!)
  drawDimArrow(page, font, x0, floorY + 18, x0 + cabD, floorY + 18, '20" OVERALL DEPTH');
  drawDimArrow(page, font, x0 - 24, caseTopY, x0 - 24, caseBotY, '19 1/2"', 'left');
  drawDimArrow(page, font, x0 - 52, counterTopY, x0 - 52, floorY, '30 1/2"', 'left');

  // Leader callout to towel rail
  const lx = x0 + cabD + 38;
  drawCadLabel(page, font, ['1 1/2" SOLID WALNUT', 'TOWEL BAR RETURN', '(2 1/4" PROJECTION)'], lx, towelY - 6, {
    size: 5.6,
    color: C.inkDark,
  });
  line(page, lx - 4, towelY + 4, x0 + cabD + 2.8 * s, towelY + 0.75 * s, 0.45, C.inkMid);
}

function drawSectionDLegApron(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const s = 14.5;
  const cx = box.innerX + box.innerW * 0.36;
  const floorY = box.innerYTop + box.innerH - 36;
  const legH = DIM.legH * s;
  const caseBotY = floorY - legH;
  const legR = 2.625 * s;

  // Floor datum line
  line(page, cx - 72, floorY, cx + 106, floorY, 1.2, C.black);

  // Solid walnut carcass bottom rail + corner mortise block
  rect(page, cx - 48, caseBotY - 3.6 * s, 118, 3.6 * s, {
    fill: C.walnutTint,
    stroke: C.black,
    strokeWidth: 0.95,
  });
  // 3/4" bottom carcass plate line
  line(page, cx - 48, caseBotY - 0.75 * s, cx + 70, caseBotY - 0.75 * s, 0.65, C.inkMid);

  // Dashed integral 1 1/2" Ø × 1 1/2" turned leg tenon glued into mortised corner block
  rect(page, cx - 0.85 * s, caseBotY - 1.8 * s, 1.7 * s, 1.8 * s, {
    fill: C.oakTint,
    stroke: C.black,
    strokeWidth: 0.75,
    dash: [3, 2],
  });

  // Scalloped apron profile extending right from leg
  drawScallopedApron(page, cx + legR * 0.78, cx + 70, caseBotY, 1.55 * s, 2, 0.85);

  // Enlarged lathe-turned stacked-ball walnut leg
  drawStackedBallLeg(page, cx, caseBotY, legH, legR, 0.95);

  // Dimension height on left (cleanly outside to the left!)
  drawDimArrow(page, font, cx - 58, caseBotY, cx - 58, floorY, '9 3/4"', 'left');

  // Leader-lined engineering callouts on right
  const noteX = cx + 88;
  drawCadLabel(page, font, ['3/4" SOLID WALNUT', 'CARCASS BOTTOM &', 'MORTISED CORNER BLOCK'], noteX, caseBotY - 38, {
    size: 5.8,
    color: C.inkDark,
  });
  line(page, noteX - 6, caseBotY - 26, cx + 1.0 * s, caseBotY - 1.2 * s, 0.45, C.inkLight);

  drawCadLabel(page, font, ['INTEGRAL 1 1/2" Ø', 'TURNED LEG TENON', '(EPOXY / PVA GLUED)'], noteX, caseBotY + 8, {
    size: 5.8,
    color: C.inkDark,
  });
  line(page, noteX - 6, caseBotY + 14, cx + 0.9 * s, caseBotY - 0.5 * s, 0.45, C.inkLight);

  drawCadLabel(page, font, ['CONTINUOUS SCALLOPED', '3/4" WALNUT APRON', '(3 3/8" PITCH)'], noteX, caseBotY + 56, {
    size: 5.8,
    color: C.inkDark,
  });
  line(page, noteX - 6, caseBotY + 60, cx + 52, caseBotY + 1.1 * s, 0.45, C.inkLight);

  drawCadLabel(page, font, ['GRADUATED 3-SPHERE', 'LATHE-TURNED LEG', '(5 1/4" · 4 3/4" · 4 1/4" Ø)'], noteX, caseBotY + 106, {
    size: 5.8,
    color: C.inkDark,
  });
  line(page, noteX - 6, caseBotY + 112, cx + legR * 0.92, caseBotY + legH * 0.52, 0.45, C.inkLight);
}

function drawKidsJoineryProfiles(page: PDFPage, font: PDFFont, box: ViewportCard) {
  const pad = 12;
  const gap = 10;
  const subW = (box.innerW - pad * 2 - gap * 2) / 3;
  const subH = box.innerH - pad * 2;
  const subY = box.innerYTop + pad;

  const cards = [
    { title: '4A / STACKED-BALL LEG', sub: '9 3/4" H SOLID WALNUT', footer: 'LATHE-TURNED WALNUT' },
    { title: '4B / SCALLOPED APRON', sub: '3 3/8" PITCH VALANCE', footer: 'SOLID BLACK WALNUT APRON' },
    { title: '4C / SHAKER & TOWEL BAR', sub: '1 1/2" SOLID WALNUT RAIL', footer: 'MORTISED SHAKER STILES' },
  ];

  cards.forEach((c, idx) => {
    const sx = box.innerX + pad + idx * (subW + gap);
    rect(page, sx, subY, subW, subH, { stroke: C.inkMid, strokeWidth: 0.75 });
    drawCadLabel(page, font, [c.title], sx + subW / 2, subY + 22, { size: 6.4, align: 'center', color: C.black });
    drawCadLabel(page, font, [c.sub], sx + subW / 2, subY + 36, { size: 5.3, align: 'center', color: C.inkMid });
    drawCadLabel(page, font, [c.footer], sx + subW / 2, subY + subH - 16, { size: 5.3, align: 'center', color: C.inkMid });

    const cx = sx + subW / 2;
    const cy = subY + subH * 0.54;

    if (idx === 0) {
      // 4A: Enlarged stacked-ball leg profile with top tenon & graduated diameters
      rect(page, cx - 9, cy - 58, 18, 14, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.75 });
      drawStackedBallLeg(page, cx, cy - 44, 102, 26, 0.9);
      line(page, cx - 38, cy + 58, cx + 38, cy + 58, 1.0, C.black);
      drawDimArrow(page, font, cx - 34, cy - 44, cx - 34, cy + 58, '9 3/4"', 'left');
    } else if (idx === 1) {
      // 4B: Enlarged scalloped apron profile with 3 3/8" pitch & 1 1/2" drop (cleanly inset from border)
      const aw = subW - 64;
      const ax0 = cx - aw / 2 - 8;
      rect(page, ax0, cy - 20, aw, 14, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.85 });
      drawScallopedApron(page, ax0, ax0 + aw, cy - 6, 18, 4, 0.9);
      drawDimArrow(page, font, ax0, cy - 30, ax0 + aw / 4, cy - 30, '3 3/8"');
      drawDimArrow(page, font, ax0 + aw + 10, cy - 20, ax0 + aw + 10, cy + 12, '1 1/2"');
    } else {
      // 4C: Shaker mortise-and-tenon door stile + 1/4" panel + 1 1/2" walnut towel rail section
      rect(page, cx - 40, cy - 32, 80, 64, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.85 });
      rect(page, cx - 26, cy - 20, 52, 40, { fill: C.oakTint, stroke: C.black, strokeWidth: 0.7 });
      // Projecting 1 1/2" walnut towel rail bar overlay
      rect(page, cx - 48, cy - 8, 96, 16, { fill: C.walnutTint, stroke: C.black, strokeWidth: 0.95 });
      line(page, cx - 46, cy - 3, cx + 46, cy - 3, 0.35, C.inkLight);
      drawDimArrow(page, font, cx + 54, cy - 8, cx + 54, cy + 8, '1 1/2"');
    }
  });
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

async function buildKidsKitchenSheets() {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const nexaFont = await pdfDoc.embedFont(fs.readFileSync(FONT_NEXA));
  const logoFullImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_FULL));
  const logoIconsImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_ICONS));

  // ---------------------------------------------------------------------------
  // SHEET A-101 — ELEVATIONS, PLAY KITCHEN SECTIONS & SPECIFICATION SCHEDULE
  // ---------------------------------------------------------------------------
  const page1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page1, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1070MCG',
    projectTitleLine: 'HEIRLOOM PLAY KITCHEN',
    scaleText: 'FRACTIONAL · 2D CAD',
    sheetCode: 'A-101',
    sheetIndexText: 'SHEET 01 / 03',
    sheetCategory: 'ELEVATIONS & SECTIONS',
    bannerBg: C.orange,
    bannerLeft: 'A-101  /  ARCHITECTURAL ELEVATIONS, PLAY KITCHEN SECTIONS & SPECIFICATION SCHEDULE',
    bannerRight: 'HEIRLOOM PLAY KITCHEN  ·  DWG 1070MCG  ·  OMAHA STUDIO',
    accentColor: C.orange,
  });

  const topRowY = 174;
  const topRowH = 384;
  const botRowY = topRowY + topRowH + 16;
  const botRowH = 330;

  const elevAW = 938;
  const elevBW = PAGE_W - 88 - elevAW - 16;

  const boxElevA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: topRowY,
    w: elevAW,
    h: topRowH,
    title: '01 / ELEVATION A — FULL WALL CONTEXT (BUILT-IN & PLAY KITCHEN)',
    subtitle: '48 1/4" × 30 1/2" WALNUT PLAY KITCHEN · 72 3/4" BUILT-IN CONTEXT',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.orange,
    subtitleSize: 7.9,
  });

  const boxElevB = drawViewportCard(page1, nexaFont, {
    x: 44 + elevAW + 16,
    yTop: topRowY,
    w: elevBW,
    h: topRowH,
    title: '02 / ELEVATION B — PLAY KITCHEN PLUMBING ROUGH-IN',
    subtitle: '20" SUPPLIES · 15 3/4" DRAIN CL',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.cyan,
    subtitleSize: 7.9,
  });

  const secW = 318;
  const specW = PAGE_W - 88 - secW * 3 - 16 * 3;

  const boxSecA = drawViewportCard(page1, nexaFont, {
    x: 44,
    yTop: botRowY,
    w: secW,
    h: botRowH,
    title: '03 / SECTION A',
    subtitle: 'LEFT SINK BAY',
    headerBg: C.orange,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  const boxSecB = drawViewportCard(page1, nexaFont, {
    x: 44 + (secW + 16),
    yTop: botRowY,
    w: secW,
    h: botRowH,
    title: '04 / SECTION B',
    subtitle: 'PLUMBING & DRAIN',
    headerBg: C.cyan,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  const boxSecC = drawViewportCard(page1, nexaFont, {
    x: 44 + (secW + 16) * 2,
    yTop: botRowY,
    w: secW,
    h: botRowH,
    title: '05 / SECTION C',
    subtitle: 'TOWEL-BAR BAY',
    headerBg: C.yellow,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  drawElevationAFullWall(page1, nexaFont, boxElevA);
  drawElevationBPlumbing(page1, nexaFont, boxElevB);
  drawPlayKitchenSection(page1, nexaFont, boxSecA, 'sink-bay');
  drawPlayKitchenSection(page1, nexaFont, boxSecB, 'plumbing');
  drawPlayKitchenSection(page1, nexaFont, boxSecC, 'towel-bar');

  drawSpecKeyCard(
    page1,
    nexaFont,
    44 + (secW + 16) * 3,
    botRowY,
    specW,
    botRowH,
    [
      ['PRIMARY HARDWOOD', 'SOLID AMERICAN BLACK WALNUT'],
      ['COUNTERTOP & SINK', '1 1/4" HONED QUARTZ · UNDERMOUNT SS'],
      ['TURNED LEGS', '9 3/4" H LATHE-TURNED STACKED-BALL'],
      ['APRON PROFILE', 'CONTINUOUS SCALLOPED WALNUT (3 3/8")'],
      ['OVERALL FOOTPRINT', '48 1/4" W × 20" D × 30 1/2" H'],
      ['TOLERANCE', '± 1/32" RHINO 3D · DWG 1070MCG'],
    ],
    'VERIFY PLUMBING ROUGH-INS (20" SUPPLIES · 15 3/4" DRAIN)'
  );

  // ---------------------------------------------------------------------------
  // SHEET A-102 — PLAY KITCHEN FLOOR PLAN & 3/4 ARCHITECTURAL ISOMETRIC
  // ---------------------------------------------------------------------------
  const page2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page2, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1070MCG',
    projectTitleLine: 'HEIRLOOM PLAY KITCHEN',
    scaleText: 'FRACTIONAL · 2D CAD',
    sheetCode: 'A-102',
    sheetIndexText: 'SHEET 02 / 03',
    sheetCategory: 'PLAN & ISOMETRIC',
    bannerBg: C.cyan,
    bannerLeft: 'A-102  /  PLAY KITCHEN FLOOR PLAN & 3/4 ARCHITECTURAL ISOMETRIC',
    bannerRight: 'SOLID BLACK WALNUT  ·  48 1/4" × 20" × 30 1/2"  ·  1070MCG',
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
    title: '01 / PLAY KITCHEN FLOOR PLAN & HORIZONTAL SECTION',
    subtitle: 'DASHED: 4× STACKED-BALL LEG FOOTPRINTS & BAY DIVIDER',
    headerBg: C.black,
    headerTextColor: C.white,
    subtitleColor: C.yellow,
    subtitleSize: 7.9,
  });

  const boxIso = drawViewportCard(page2, nexaFont, {
    x: 44 + planW + 16,
    yTop: a102Y,
    w: isoW,
    h: a102H,
    title: '02 / ISOMETRIC VIEW — HEIRLOOM PLAY KITCHEN (3/4 AXONOMETRIC)',
    subtitle: 'TRUE-PROPORTION 3D GEOMETRY',
    headerBg: C.cyan,
    headerTextColor: C.black,
    subtitleSize: 8.0,
  });

  drawPlayKitchenFloorPlanA102(page2, nexaFont, boxPlan);
  drawPlayKitchenIsometricA102(page2, nexaFont, boxIso);

  // ---------------------------------------------------------------------------
  // SHEET A-103 — DIMENSIONED FRONT & SIDE ELEVATIONS, LEG SECTION & 1:1 PROFILES
  // ---------------------------------------------------------------------------
  const page3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
  drawSheetChrome(page3, nexaFont, logoFullImg, logoIconsImg, {
    projectCodeLine: 'PROJECT · DWG 1070MCG',
    projectTitleLine: 'HEIRLOOM PLAY KITCHEN',
    scaleText: 'FRACTIONAL · 2D CAD',
    sheetCode: 'A-103',
    sheetIndexText: 'SHEET 03 / 03',
    sheetCategory: 'KITCHENETTE & JOINERY',
    bannerBg: C.yellow,
    bannerLeft: 'A-103  /  DIMENSIONED PLAY KITCHEN ELEVATIONS, TURNED LEG SECTION & 1:1 JOINERY',
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
    title: '01 / DETAIL ELEVATION C — HEIRLOOM PLAY KITCHEN FRONT (48 1/4" W)',
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
    title: '03 / SECTION D — LEG TENON & SCALLOPED APRON',
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
    title: '02 / DETAIL ELEVATION D — RIGHT SIDE & TOWEL BAR RETURN (20" D)',
    subtitle: 'SHAKER END PANEL · 1 1/2" TOWEL BAR PROJECTION · SIDE SCALLOPS',
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

  drawPlayKitchenDetailElevation(page3, nexaFont, boxElevC);
  drawSectionDLegApron(page3, nexaFont, boxSecD);
  drawPlayKitchenSideElevation(page3, nexaFont, boxElevD);
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
