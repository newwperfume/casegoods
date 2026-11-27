/**
 * Generates watertight, manifold Binary STL files (millimeters) for the
 * Casegoods Mortise Wall Sconces (original linear bar + all 5 CNC-repeatable
 * 3/4" Baltic Birch integral-hook side-cheek redesigns, 2..6 mortise cells wide).
 *
 * Real-world Casegoods Mortise Wall scale (1 unit = 1 mm):
 * - 3/4" Baltic Birch plywood thickness: 19.05 mm
 * - Horizontal mortise pitch: 107.97 mm (4.25" OC)
 * - Integral mortise wall hook cut into each 3/4" side cheek:
 *   neck y in [-26, 0], z in [-10, +10]; downward locking catch y in [-26, -16], z in [-24, -10].
 */

interface Tri {
  n: [number, number, number];
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
}

export type SconceConceptId =
  | 'split-rail'
  | 'angled-valance'
  | 'open-trough'
  | 'half-tube'
  | 'micro-ledge';

export interface SconceConceptMeta {
  id: SconceConceptId;
  number: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  staticStlUrl: string;
  accentBg: string;
  cheekSpec: string;
  spanSpec: string;
  shopNote: string;
  heightMm: number;
  depthMm: number;
}

export const SCONCE_CONCEPTS: SconceConceptMeta[] = [
  {
    id: 'split-rail',
    number: '01',
    title: 'The Split-Rail Slot',
    subtitle: 'Twin-Bar Lantern',
    imageUrl: '/downloads/sconces/01-split-rail-slot.jpg',
    staticStlUrl: '/downloads/sconces/01-split-rail-slot-4x1.stl',
    accentBg: '#FDCB33',
    cheekSpec: 'Rectangular 3/4" cheek + integral rear hook + twin inner dadoes',
    spanSpec: '2 identical parallel birch rails framing a 14 mm horizontal light slot',
    shopNote: 'Zero left/right handedness; fastest drop-in for rechargeable LED bars.',
    heightMm: 52,
    depthMm: 44,
  },
  {
    id: 'angled-valance',
    number: '02',
    title: 'The Angled Valance',
    subtitle: '45° Architectural Blade',
    imageUrl: '/downloads/sconces/02-angled-valance.jpg',
    staticStlUrl: '/downloads/sconces/02-angled-valance-4x1.stl',
    accentBg: '#EF6922',
    cheekSpec: 'Trapezoidal 3/4" cheek + integral rear hook + single 45° blind dado',
    spanSpec: 'Single 45° Baltic Birch glare baffle + concealed top LED cleat',
    shopNote: 'Only 3 primary birch parts total; crisp downward wash with zero glare.',
    heightMm: 56,
    depthMm: 56,
  },
  {
    id: 'open-trough',
    number: '03',
    title: 'The Open-Back Trough',
    subtitle: 'Up/Down Wash Box',
    imageUrl: '/downloads/sconces/03-open-back-trough.jpg',
    staticStlUrl: '/downloads/sconces/03-open-back-trough-4x1.stl',
    accentBg: '#27AAE0',
    cheekSpec: 'Tall 3/4" vertical fin + integral rear hook + front apron & spine slots',
    spanSpec: 'Continuous birch front apron + center LED shelf with open top/bottom vents',
    shopNote: 'True gallery up/down wall-washer; hides battery pack from every angle.',
    heightMm: 84,
    depthMm: 48,
  },
  {
    id: 'half-tube',
    number: '04',
    title: 'The Half-Tube Cove',
    subtitle: 'D-Cheek Diffuser',
    imageUrl: '/downloads/sconces/04-half-tube-cove.jpg',
    staticStlUrl: '/downloads/sconces/04-half-tube-cove-4x1.stl',
    accentBg: '#FDCB33',
    cheekSpec: 'Semicircular "D" 3/4" cheek + integral rear hook + curved arc groove',
    spanSpec: 'Curved opal acrylic half-cylinder diffuser + rear LED mounting spine',
    shopNote: 'Softens the rectilinear pegboard with a signature Bauhaus 180° glow.',
    heightMm: 64,
    depthMm: 38,
  },
  {
    id: 'micro-ledge',
    number: '05',
    title: 'The Micro-Ledge Task',
    subtitle: 'Lip + Under-Glow',
    imageUrl: '/downloads/sconces/05-micro-ledge-task.jpg',
    staticStlUrl: '/downloads/sconces/05-micro-ledge-task-4x1.stl',
    accentBg: '#EF6922',
    cheekSpec: 'L-profiled 3/4" bracket + integral rear hook + shelf & lip dadoes',
    spanSpec: 'Shallow birch display ledge + front retainer lip + under-glow baffle',
    shopNote: 'Dual-function entryway or desk rail for keys, frames, or vinyl sleeves.',
    heightMm: 48,
    depthMm: 76,
  },
];

export interface WallSconceStlSpecs {
  cols: number;
  lengthMm: number;
  heightMm: number;
  depthMm: number;
  hookCenterSpanMm: number;
  ledChannelLengthMm: number;
  triangleCount: number;
}

const BIRCH_T = 19.05; // 3/4" Baltic Birch plywood (mm)
const HALF_T = BIRCH_T / 2; // 9.525 mm
const PITCH_X = 107.97; // 4.25" OC horizontal mortise slot pitch (mm)

// Shared integral rear mortise hook geometry (cut as part of every side cheek)
const HOOK_BACK_Y = -26.0;
const HOOK_CATCH_FRONT_Y = -16.0;
const HOOK_TOP_Z = 10.0;
const HOOK_NECK_BOT_Z = -10.0;
const HOOK_CATCH_BOT_Z = -24.0;

function dedupeSorted(values: number[], eps = 1e-4): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > eps) {
      out.push(v);
    }
  }
  return out;
}

function encodeBinaryStl(tris: Tri[], headerText: string): ArrayBuffer {
  const byteLength = 84 + tris.length * 50;
  const buffer = new ArrayBuffer(byteLength);
  const view = new DataView(buffer);

  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < headerText.length ? headerText.charCodeAt(i) : 0x20);
  }
  view.setUint32(80, tris.length, true);

  let offset = 84;
  for (const t of tris) {
    view.setFloat32(offset, t.n[0], true);
    view.setFloat32(offset + 4, t.n[1], true);
    view.setFloat32(offset + 8, t.n[2], true);

    view.setFloat32(offset + 12, t.a[0], true);
    view.setFloat32(offset + 16, t.a[1], true);
    view.setFloat32(offset + 20, t.a[2], true);

    view.setFloat32(offset + 24, t.b[0], true);
    view.setFloat32(offset + 28, t.b[1], true);
    view.setFloat32(offset + 32, t.b[2], true);

    view.setFloat32(offset + 36, t.c[0], true);
    view.setFloat32(offset + 40, t.c[1], true);
    view.setFloat32(offset + 44, t.c[2], true);

    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }

  return buffer;
}

/**
 * Builds a single 100% watertight rectilinear manifold mesh from exact coordinate partitions.
 */
function buildRectilinearSolidMesh(
  xsRaw: number[],
  ysRaw: number[],
  zsRaw: number[],
  isSolid: (mx: number, my: number, mz: number) => boolean
): Tri[] {
  const xs = dedupeSorted(xsRaw);
  const ys = dedupeSorted(ysRaw);
  const zs = dedupeSorted(zsRaw);
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const nz = zs.length - 1;

  const grid = new Uint8Array(nx * ny * nz);
  const idxOf = (ix: number, iy: number, iz: number) => (ix * ny + iy) * nz + iz;

  for (let ix = 0; ix < nx; ix++) {
    const mx = (xs[ix] + xs[ix + 1]) * 0.5;
    for (let iy = 0; iy < ny; iy++) {
      const my = (ys[iy] + ys[iy + 1]) * 0.5;
      for (let iz = 0; iz < nz; iz++) {
        const mz = (zs[iz] + zs[iz + 1]) * 0.5;
        if (isSolid(mx, my, mz)) {
          grid[idxOf(ix, iy, iz)] = 1;
        }
      }
    }
  }

  const solidAt = (ix: number, iy: number, iz: number): boolean => {
    if (ix < 0 || ix >= nx || iy < 0 || iy >= ny || iz < 0 || iz >= nz) return false;
    return grid[idxOf(ix, iy, iz)] === 1;
  };

  const tris: Tri[] = [];
  const pushQuad = (
    n: [number, number, number],
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number]
  ) => {
    tris.push({ n, a: p0, b: p1, c: p2 });
    tris.push({ n, a: p0, b: p2, c: p3 });
  };

  for (let ix = 0; ix < nx; ix++) {
    const x0 = xs[ix];
    const x1 = xs[ix + 1];
    for (let iy = 0; iy < ny; iy++) {
      const y0 = ys[iy];
      const y1 = ys[iy + 1];
      for (let iz = 0; iz < nz; iz++) {
        if (!solidAt(ix, iy, iz)) continue;
        const z0 = zs[iz];
        const z1 = zs[iz + 1];

        if (!solidAt(ix + 1, iy, iz)) {
          pushQuad([1, 0, 0], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
        }
        if (!solidAt(ix - 1, iy, iz)) {
          pushQuad([-1, 0, 0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
        }
        if (!solidAt(ix, iy + 1, iz)) {
          pushQuad([0, 1, 0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
        }
        if (!solidAt(ix, iy - 1, iz)) {
          pushQuad([0, -1, 0], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
        }
        if (!solidAt(ix, iy, iz + 1)) {
          pushQuad([0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
        }
        if (!solidAt(ix, iy, iz - 1)) {
          pushQuad([0, 0, -1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
        }
      }
    }
  }

  return tris;
}

/**
 * Ear-clipping triangulation for any simple CCW 2D polygon in the (Y, Z) plane,
 * extruded cleanly along X in [x0, x1] into a 100% watertight manifold prism.
 */
function cross2D(a: [number, number], b: [number, number], c: [number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInTri2D(
  p: [number, number],
  a: [number, number],
  b: [number, number],
  c: [number, number]
): boolean {
  const c1 = cross2D(a, b, p);
  const c2 = cross2D(b, c, p);
  const c3 = cross2D(c, a, p);
  return c1 >= -1e-7 && c2 >= -1e-7 && c3 >= -1e-7;
}

function triangulateCCW2D(poly: [number, number][]): [number, number, number][] {
  const indices = poly.map((_, i) => i);
  const result: [number, number, number][] = [];
  let guard = 0;

  while (indices.length > 3 && guard < 1000) {
    guard++;
    let earFound = false;
    const n = indices.length;

    for (let i = 0; i < n; i++) {
      const iPrev = indices[(i - 1 + n) % n];
      const iCurr = indices[i];
      const iNext = indices[(i + 1) % n];

      const a = poly[iPrev];
      const b = poly[iCurr];
      const c = poly[iNext];

      if (cross2D(a, b, c) <= 1e-7) continue;

      let containsOther = false;
      for (let j = 0; j < n; j++) {
        const idx = indices[j];
        if (idx === iPrev || idx === iCurr || idx === iNext) continue;
        if (pointInTri2D(poly[idx], a, b, c)) {
          containsOther = true;
          break;
        }
      }
      if (containsOther) continue;

      result.push([iPrev, iCurr, iNext]);
      indices.splice(i, 1);
      earFound = true;
      break;
    }

    if (!earFound) break;
  }

  if (indices.length === 3) {
    result.push([indices[0], indices[1], indices[2]]);
  }
  return result;
}

function ensureCCW(poly: [number, number][]): [number, number][] {
  let area2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const [y0, z0] = poly[i];
    const [y1, z1] = poly[(i + 1) % poly.length];
    area2 += y0 * z1 - y1 * z0;
  }
  return area2 >= 0 ? poly : [...poly].reverse();
}

function pushExtrudedYZPrism(
  tris: Tri[],
  rawPoly: [number, number][],
  x0: number,
  x1: number
): void {
  const poly = ensureCCW(rawPoly);
  const capTris = triangulateCCW2D(poly);

  // +X cap (normal +1, 0, 0)
  for (const [i0, i1, i2] of capTris) {
    tris.push({
      n: [1, 0, 0],
      a: [x1, poly[i0][0], poly[i0][1]],
      b: [x1, poly[i1][0], poly[i1][1]],
      c: [x1, poly[i2][0], poly[i2][1]],
    });
    // -X cap (normal -1, 0, 0)
    tris.push({
      n: [-1, 0, 0],
      a: [x0, poly[i0][0], poly[i0][1]],
      b: [x0, poly[i2][0], poly[i2][1]],
      c: [x0, poly[i1][0], poly[i1][1]],
    });
  }

  // Side walls around perimeter
  for (let i = 0; i < poly.length; i++) {
    const [y0, z0] = poly[i];
    const [y1, z1] = poly[(i + 1) % poly.length];
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    if (len < 1e-7) continue;
    const n: [number, number, number] = [0, dz / len, -dy / len];

    const p0: [number, number, number] = [x0, y0, z0];
    const p1: [number, number, number] = [x0, y1, z1];
    const p2: [number, number, number] = [x1, y1, z1];
    const p3: [number, number, number] = [x1, y0, z0];

    tris.push({ n, a: p0, b: p1, c: p2 });
    tris.push({ n, a: p0, b: p2, c: p3 });
  }
}

/**
 * Helper predicate for the shared integral rear mortise hook on left/right 3/4" side cheeks.
 */
function isInRearIntegralHook(
  mx: number,
  my: number,
  mz: number,
  leftHookX: number,
  rightHookX: number
): boolean {
  const inCheekX =
    Math.abs(mx - leftHookX) <= HALF_T || Math.abs(mx - rightHookX) <= HALF_T;
  if (!inCheekX || my < HOOK_BACK_Y || my > 0) return false;
  if (mz >= HOOK_NECK_BOT_Z && mz <= HOOK_TOP_Z) return true;
  if (my <= HOOK_CATCH_FRONT_Y && mz >= HOOK_CATCH_BOT_Z && mz <= HOOK_NECK_BOT_Z) return true;
  return false;
}

/**
 * Builds a watertight Binary STL (millimeters) for any of the 5 CNC-repeatable
 * integral-hook Baltic Birch Wall Sconce redesigns (2..6 mortise cells wide).
 */
export function buildSconceConceptBinaryStl(
  conceptId: SconceConceptId,
  colsInput = 4
): {
  buffer: ArrayBuffer;
  specs: WallSconceStlSpecs;
} {
  const cols = Math.max(2, Math.min(6, Math.round(colsInput)));
  const hookSpanX = (cols - 1) * PITCH_X;
  const leftHookX = -hookSpanX / 2;
  const rightHookX = hookSpanX / 2;
  const leftOuterX = leftHookX - HALF_T;
  const leftInnerX = leftHookX + HALF_T;
  const rightInnerX = rightHookX - HALF_T;
  const rightOuterX = rightHookX + HALF_T;
  const lengthMm = Number((rightOuterX - leftOuterX).toFixed(2));
  const innerSpanMm = Number((rightInnerX - leftInnerX).toFixed(2));

  let tris: Tri[] = [];
  let heightMm = 52;
  let depthMm = 44;

  if (conceptId === 'split-rail') {
    // 01 / The Split-Rail Slot (Twin-Bar Lantern)
    // Two identical 3/4" rectangular side cheeks + integral rear hooks
    // + twin parallel 3/4" horizontal rails leaving a 14mm horizontal light slot
    // + recessed diffuser backing bar
    heightMm = 52;
    depthMm = 44;
    const xs = [leftOuterX, leftInnerX, rightInnerX, rightOuterX];
    const ys = [HOOK_BACK_Y, HOOK_CATCH_FRONT_Y, 0, 14, 20, 25, 44];
    const zs = [-26, HOOK_CATCH_BOT_Z, -12, HOOK_NECK_BOT_Z, -7, 7, HOOK_TOP_Z, 12, 26];

    tris = buildRectilinearSolidMesh(xs, ys, zs, (mx, my, mz) => {
      if (isInRearIntegralHook(mx, my, mz, leftHookX, rightHookX)) return true;
      const inCheekX =
        Math.abs(mx - leftHookX) <= HALF_T || Math.abs(mx - rightHookX) <= HALF_T;
      // Full 3/4" Baltic Birch rectangular side cheeks
      if (inCheekX && my >= 0 && my <= 44 && mz >= -26 && mz <= 26) return true;
      // Between cheeks: twin parallel birch rails + recessed central LED backing bar
      if (mx >= leftInnerX && mx <= rightInnerX) {
        if (my >= 25 && my <= 44 && ((mz >= 7 && mz <= 26) || (mz >= -26 && mz <= -7))) {
          return true;
        }
        if (my >= 14 && my <= 20 && mz >= -12 && mz <= 12) {
          return true;
        }
      }
      return false;
    });
  } else if (conceptId === 'angled-valance') {
    // 02 / The Angled Valance (45° Architectural Blade)
    // Two identical 3/4" trapezoidal cheeks with integral rear hooks + 45° baffle blade + rear LED cleat
    heightMm = 56;
    depthMm = 56;
    const cheekPoly: [number, number][] = [
      [0, -24],
      [22, -24],
      [56, 20],
      [56, 32],
      [0, 32],
      [0, HOOK_TOP_Z],
      [HOOK_BACK_Y, HOOK_TOP_Z],
      [HOOK_BACK_Y, HOOK_CATCH_BOT_Z],
      [HOOK_CATCH_FRONT_Y, HOOK_CATCH_BOT_Z],
      [HOOK_CATCH_FRONT_Y, HOOK_NECK_BOT_Z],
      [0, HOOK_NECK_BOT_Z],
    ];
    pushExtrudedYZPrism(tris, cheekPoly, leftOuterX, leftInnerX);
    pushExtrudedYZPrism(tris, cheekPoly, rightInnerX, rightOuterX);

    // 45° angled 12.7mm Baltic Birch front baffle spanning flush between the cheeks
    const bafflePoly: [number, number][] = [
      [21, -21],
      [31, -21],
      [54, 18],
      [54, 30],
      [44, 30],
      [21, -10],
    ];
    pushExtrudedYZPrism(tris, bafflePoly, leftInnerX, rightInnerX);

    // Concealed top LED mounting cleat along the back wall
    const cleatPoly: [number, number][] = [
      [0, 14],
      [18, 14],
      [18, 28],
      [0, 28],
    ];
    pushExtrudedYZPrism(tris, cleatPoly, leftInnerX, rightInnerX);
  } else if (conceptId === 'open-trough') {
    // 03 / The Open-Back Trough (Up/Down Wash Box)
    // Tall 3/4" vertical side cheeks + integral rear hooks + continuous birch front apron + center LED shelf
    heightMm = 84;
    depthMm = 48;
    const xs = [leftOuterX, leftInnerX, rightInnerX, rightOuterX];
    const ys = [HOOK_BACK_Y, HOOK_CATCH_FRONT_Y, 0, 10, 35.3, 48];
    const zs = [-42, HOOK_CATCH_BOT_Z, HOOK_NECK_BOT_Z, -6, 6, HOOK_TOP_Z, 42];

    tris = buildRectilinearSolidMesh(xs, ys, zs, (mx, my, mz) => {
      if (isInRearIntegralHook(mx, my, mz, leftHookX, rightHookX)) return true;
      const inCheekX =
        Math.abs(mx - leftHookX) <= HALF_T || Math.abs(mx - rightHookX) <= HALF_T;
      if (inCheekX && my >= 0 && my <= 48 && mz >= -42 && mz <= 42) return true;
      if (mx >= leftInnerX && mx <= rightInnerX) {
        // Full continuous 1/2" Baltic Birch front apron
        if (my >= 35.3 && my <= 48 && mz >= -42 && mz <= 42) return true;
        // Hidden centered horizontal LED / battery spine shelf (open top & bottom)
        if (my >= 10 && my <= 35.3 && mz >= -6 && mz <= 6) return true;
      }
      return false;
    });
  } else if (conceptId === 'half-tube') {
    // 04 / The Half-Tube Cove (D-Cheek Diffuser)
    // Semicircular "D" 3/4" side cheeks with integral rear hooks + curved 4mm diffuser half-cylinder + LED spine
    heightMm = 64;
    depthMm = 38;
    const radius = 32;
    const shoulderY = 6;
    const segs = 24;

    const cheekPoly: [number, number][] = [[0, -radius]];
    for (let i = 0; i <= segs; i++) {
      const angle = -Math.PI / 2 + (Math.PI * i) / segs;
      cheekPoly.push([
        Number((shoulderY + Math.cos(angle) * radius).toFixed(4)),
        Number((Math.sin(angle) * radius).toFixed(4)),
      ]);
    }
    cheekPoly.push(
      [0, radius],
      [0, HOOK_TOP_Z],
      [HOOK_BACK_Y, HOOK_TOP_Z],
      [HOOK_BACK_Y, HOOK_CATCH_BOT_Z],
      [HOOK_CATCH_FRONT_Y, HOOK_CATCH_BOT_Z],
      [HOOK_CATCH_FRONT_Y, HOOK_NECK_BOT_Z],
      [0, HOOK_NECK_BOT_Z]
    );

    pushExtrudedYZPrism(tris, cheekPoly, leftOuterX, leftInnerX);
    pushExtrudedYZPrism(tris, cheekPoly, rightInnerX, rightOuterX);

    // Curved frosted acrylic half-cylinder diffuser shell (R_out = 30mm, R_in = 26mm)
    const rOut = 30;
    const rIn = 26;
    const shellPoly: [number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const angle = -Math.PI / 2 + (Math.PI * i) / segs;
      shellPoly.push([
        Number((shoulderY + Math.cos(angle) * rOut).toFixed(4)),
        Number((Math.sin(angle) * rOut).toFixed(4)),
      ]);
    }
    for (let i = segs; i >= 0; i--) {
      const angle = -Math.PI / 2 + (Math.PI * i) / segs;
      shellPoly.push([
        Number((shoulderY + Math.cos(angle) * rIn).toFixed(4)),
        Number((Math.sin(angle) * rIn).toFixed(4)),
      ]);
    }
    pushExtrudedYZPrism(tris, shellPoly, leftInnerX, rightInnerX);

    // Rear LED mounting spine bar inside the half-tube
    const spinePoly: [number, number][] = [
      [0, -10],
      [10, -10],
      [10, 10],
      [0, 10],
    ];
    pushExtrudedYZPrism(tris, spinePoly, leftInnerX, rightInnerX);
  } else {
    // 05 / The Micro-Ledge Task Sconce (Lip + Under-Glow)
    // Compact L-profiled 3/4" brackets with integral rear hooks + display shelf + stepped front lip + under-glow baffle
    heightMm = 48;
    depthMm = 76;
    const xs = [leftOuterX, leftInnerX, rightInnerX, rightOuterX];
    const ys = [HOOK_BACK_Y, HOOK_CATCH_FRONT_Y, 0, 34, 56, 64, 76];
    const zs = [-26, HOOK_CATCH_BOT_Z, -12, HOOK_NECK_BOT_Z, -4, HOOK_TOP_Z, 15, 22];

    tris = buildRectilinearSolidMesh(xs, ys, zs, (mx, my, mz) => {
      if (isInRearIntegralHook(mx, my, mz, leftHookX, rightHookX)) return true;
      const inCheekX =
        Math.abs(mx - leftHookX) <= HALF_T || Math.abs(mx - rightHookX) <= HALF_T;
      if (inCheekX) {
        // Upper shelf bracket arm
        if (my >= 0 && my <= 76 && mz >= -12 && mz <= 22) return true;
        // Lower rear wall bearing heel
        if (my >= 0 && my <= 34 && mz >= -26 && mz <= -12) return true;
      }
      if (mx >= leftInnerX && mx <= rightInnerX) {
        // Main 3/4" Baltic Birch display ledge
        if (my >= 0 && my <= 76 && mz >= -4 && mz <= 15) return true;
        // Front retainer lip for keys / prints / vinyl sleeve
        if (my >= 64 && my <= 76 && mz >= 15 && mz <= 22) return true;
        // Recessed under-shelf front glare baffle concealing LED bar
        if (my >= 56 && my <= 64 && mz >= -12 && mz <= -4) return true;
      }
      return false;
    });
  }

  const headerText = `casegoods ${conceptId} sconce ${cols}x1 (${lengthMm}x${depthMm}x${heightMm}mm)`;
  const buffer = encodeBinaryStl(tris, headerText);

  return {
    buffer,
    specs: {
      cols,
      lengthMm,
      heightMm,
      depthMm,
      hookCenterSpanMm: Number(hookSpanX.toFixed(2)),
      ledChannelLengthMm: innerSpanMm,
      triangleCount: tris.length,
    },
  };
}

export function downloadSconceConceptStl(
  conceptId: SconceConceptId,
  cols = 4
): WallSconceStlSpecs {
  const meta = SCONCE_CONCEPTS.find((c) => c.id === conceptId);
  const { buffer, specs } = buildSconceConceptBinaryStl(conceptId, cols);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const num = meta ? meta.number : '00';
  a.href = url;
  a.download = `casegoods-sconce-${num}-${conceptId}-${specs.cols}x1-${Math.round(specs.lengthMm)}mm.stl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return specs;
}

/**
 * Original Sleek Linear Wall Sconce Binary STL builder (retained for backward compatibility).
 */
export function buildWallSconceBinaryStl(colsInput = 4): {
  buffer: ArrayBuffer;
  specs: WallSconceStlSpecs;
} {
  const cols = Math.max(2, Math.min(6, Math.round(colsInput)));
  const hookSpanX = (cols - 1) * PITCH_X;
  const endOverhang = 16.2;
  const lengthMm = Number((hookSpanX + endOverhang * 2).toFixed(2));
  const halfL = lengthMm / 2;

  const heightMm = 24.0;
  const halfH = heightMm / 2;
  const depthMm = 32.0;

  const endCap = 10.0;
  const ledChannelLengthMm = Number((lengthMm - endCap * 2).toFixed(2));
  const halfLedW = ledChannelLengthMm / 2;
  const halfLedH = 5.0;
  const ledFloorY = depthMm - 10.0;

  const leftHookX = -hookSpanX / 2;
  const rightHookX = hookSpanX / 2;

  const pocketW = Math.min(84.0, Math.max(36.0, hookSpanX - BIRCH_T - 24.0));
  const halfPocketW = pocketW / 2;
  const pocketDepthY = 10.0;
  const halfPocketH = 7.0;

  const xs = [
    -halfL,
    -halfLedW,
    leftHookX - HALF_T,
    leftHookX + HALF_T,
    -halfPocketW,
    halfPocketW,
    rightHookX - HALF_T,
    rightHookX + HALF_T,
    halfLedW,
    halfL,
  ];
  const ys = [HOOK_BACK_Y, HOOK_CATCH_FRONT_Y, 0, pocketDepthY, ledFloorY, depthMm];
  const zs = [
    HOOK_CATCH_BOT_Z,
    -halfH,
    HOOK_NECK_BOT_Z,
    -halfPocketH,
    -halfLedH,
    halfLedH,
    halfPocketH,
    HOOK_TOP_Z,
    halfH,
  ];

  const tris = buildRectilinearSolidMesh(xs, ys, zs, (mx, my, mz) => {
    if (Math.abs(mx) <= halfL && my >= 0 && my <= depthMm && Math.abs(mz) <= halfH) {
      if (Math.abs(mx) <= halfLedW && my >= ledFloorY && Math.abs(mz) <= halfLedH) {
        return false;
      }
      if (Math.abs(mx) <= halfPocketW && my <= pocketDepthY && Math.abs(mz) <= halfPocketH) {
        return false;
      }
      return true;
    }
    return isInRearIntegralHook(mx, my, mz, leftHookX, rightHookX);
  });

  const headerText = `casegoods linear wall sconce ${cols}x1 (${lengthMm}x${depthMm}x${heightMm}mm)`;
  const buffer = encodeBinaryStl(tris, headerText);

  return {
    buffer,
    specs: {
      cols,
      lengthMm,
      heightMm,
      depthMm,
      hookCenterSpanMm: Number(hookSpanX.toFixed(2)),
      ledChannelLengthMm,
      triangleCount: tris.length,
    },
  };
}

export function downloadWallSconceStl(cols = 4): WallSconceStlSpecs {
  const { buffer, specs } = buildWallSconceBinaryStl(cols);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `casegoods-wall-sconce-${specs.cols}x1-${Math.round(specs.lengthMm)}mm.stl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return specs;
}
