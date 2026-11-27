/**
 * Zero-dependency Binary & ASCII STL parser for client-side inspection
 * and lightweight 3D CAD turntable rendering.
 */

export interface ParsedStlMesh {
  format: 'binary' | 'ascii';
  triangleCount: number;
  /** Downsampled flat triangle vertex coordinates [x0,y0,z0, x1,y1,z1, x2,y2,z2, ...] centered at origin */
  previewPositions: Float32Array;
  /** Corresponding face normals [nx,ny,nz, ...] per preview triangle */
  previewNormals: Float32Array;
  previewTriCount: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
  };
}

const MAX_PREVIEW_TRIS = 14000;

function isLikelyBinaryStl(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;
  const view = new DataView(buffer);
  const triCount = view.getUint32(80, true);
  return 84 + triCount * 50 === buffer.byteLength;
}

export function parseStlArrayBuffer(buffer: ArrayBuffer): ParsedStlMesh {
  if (buffer.byteLength < 84) {
    throw new Error('File is too small to be a valid .STL mesh.');
  }

  let rawVerts: number[] = [];
  let format: 'binary' | 'ascii' = 'binary';
  let totalTris = 0;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  if (isLikelyBinaryStl(buffer)) {
    format = 'binary';
    const view = new DataView(buffer);
    totalTris = view.getUint32(80, true);
    if (totalTris === 0) {
      throw new Error('Binary STL contains zero triangles.');
    }

    const stride = Math.max(1, Math.ceil(totalTris / MAX_PREVIEW_TRIS));
    let offset = 84;
    for (let i = 0; i < totalTris; i++) {
      const ax = view.getFloat32(offset + 12, true);
      const ay = view.getFloat32(offset + 16, true);
      const az = view.getFloat32(offset + 20, true);
      const bx = view.getFloat32(offset + 24, true);
      const by = view.getFloat32(offset + 28, true);
      const bz = view.getFloat32(offset + 32, true);
      const cx = view.getFloat32(offset + 36, true);
      const cy = view.getFloat32(offset + 40, true);
      const cz = view.getFloat32(offset + 44, true);
      offset += 50;

      if (ax < minX) minX = ax;
      if (ax > maxX) maxX = ax;
      if (bx < minX) minX = bx;
      if (bx > maxX) maxX = bx;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;

      if (ay < minY) minY = ay;
      if (ay > maxY) maxY = ay;
      if (by < minY) minY = by;
      if (by > maxY) maxY = by;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      if (az < minZ) minZ = az;
      if (az > maxZ) maxZ = az;
      if (bz < minZ) minZ = bz;
      if (bz > maxZ) maxZ = bz;
      if (cz < minZ) minZ = cz;
      if (cz > maxZ) maxZ = cz;

      if (i % stride === 0) {
        rawVerts.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      }
    }
  } else {
    format = 'ascii';
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    if (!/^\s*solid\b/i.test(text) || !/facet\s+normal/i.test(text)) {
      throw new Error('Unrecognized file format. Please select a valid Binary or ASCII .STL file.');
    }

    const vertexRe =
      /vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/gi;
    const allCoords: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = vertexRe.exec(text)) !== null) {
      const x = Number(match[1]);
      const y = Number(match[2]);
      const z = Number(match[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      allCoords.push(x, y, z);
    }

    totalTris = Math.floor(allCoords.length / 9);
    if (totalTris === 0) {
      throw new Error('ASCII STL contains zero valid triangles.');
    }

    const stride = Math.max(1, Math.ceil(totalTris / MAX_PREVIEW_TRIS));
    for (let i = 0; i < totalTris; i += stride) {
      const b = i * 9;
      rawVerts.push(
        allCoords[b],
        allCoords[b + 1],
        allCoords[b + 2],
        allCoords[b + 3],
        allCoords[b + 4],
        allCoords[b + 5],
        allCoords[b + 6],
        allCoords[b + 7],
        allCoords[b + 8]
      );
    }
  }

  const cxMid = (minX + maxX) * 0.5;
  const cyMid = (minY + maxY) * 0.5;
  const czMid = (minZ + maxZ) * 0.5;

  const previewTriCount = Math.floor(rawVerts.length / 9);
  const previewPositions = new Float32Array(previewTriCount * 9);
  const previewNormals = new Float32Array(previewTriCount * 3);

  for (let i = 0; i < previewTriCount; i++) {
    const b = i * 9;
    const ax = rawVerts[b] - cxMid;
    const ay = rawVerts[b + 1] - cyMid;
    const az = rawVerts[b + 2] - czMid;
    const bx = rawVerts[b + 3] - cxMid;
    const by = rawVerts[b + 4] - cyMid;
    const bz = rawVerts[b + 5] - czMid;
    const cx = rawVerts[b + 6] - cxMid;
    const cy = rawVerts[b + 7] - cyMid;
    const cz = rawVerts[b + 8] - czMid;

    previewPositions[b] = ax;
    previewPositions[b + 1] = ay;
    previewPositions[b + 2] = az;
    previewPositions[b + 3] = bx;
    previewPositions[b + 4] = by;
    previewPositions[b + 5] = bz;
    previewPositions[b + 6] = cx;
    previewPositions[b + 7] = cy;
    previewPositions[b + 8] = cz;

    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;

    previewNormals[i * 3] = nx;
    previewNormals[i * 3 + 1] = ny;
    previewNormals[i * 3 + 2] = nz;
  }

  return {
    format,
    triangleCount: totalTris,
    previewPositions,
    previewNormals,
    previewTriCount,
    bounds: {
      minX: Number(minX.toFixed(2)),
      maxX: Number(maxX.toFixed(2)),
      minY: Number(minY.toFixed(2)),
      maxY: Number(maxY.toFixed(2)),
      minZ: Number(minZ.toFixed(2)),
      maxZ: Number(maxZ.toFixed(2)),
      sizeX: Number((maxX - minX).toFixed(2)),
      sizeY: Number((maxY - minY).toFixed(2)),
      sizeZ: Number((maxZ - minZ).toFixed(2)),
    },
  };
}
