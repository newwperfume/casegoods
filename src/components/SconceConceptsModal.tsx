import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Download,
  X,
  ArrowLeft,
  Check,
  Upload,
  Box,
  Trash2,
  LogIn,
  RotateCcw,
} from 'lucide-react';
import {
  SCONCE_CONCEPTS,
  SconceConceptId,
  downloadSconceConceptStl,
} from '../utils/wallSconceStl.ts';
import { ParsedStlMesh, parseStlArrayBuffer } from '../utils/stlParser.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface SconceConceptsModalProps {
  /** Render as a full-page route (/sconce-concepts) instead of an overlay modal */
  standalone?: boolean;
  initialCols?: number;
  onClose?: () => void;
}

interface CustomSconceRecord {
  id: string;
  filename: string;
  title: string;
  notes: string;
  publicUrl: string;
  format: 'binary' | 'ascii';
  triangleCount: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  bytes: number;
  uploadedAt: string;
}

const OWNER_EMAIL = 'jmheinke1@gmail.com';
const PITCH_X_MM = 107.97;
const BIRCH_T_MM = 19.05;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}

/**
 * Lightweight zero-dependency 3D orthographic/perspective shaded turntable canvas
 * for inspecting uploaded Binary or ASCII .STL meshes.
 */
const StlPreviewCanvas: React.FC<{ mesh: ParsedStlMesh }> = ({ mesh }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [angles, setAngles] = useState<{ yaw: number; pitch: number }>({
    yaw: -0.62,
    pitch: 0.42,
  });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || 480;
    const height = canvas.clientHeight || 260;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Architectural studio white drafting backdrop
    ctx.fillStyle = '#F7F5F0';
    ctx.fillRect(0, 0, width, height);

    // Subtle CAD grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 24; x < width; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 24; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const { previewPositions, previewNormals, previewTriCount, bounds } = mesh;
    const diag = Math.hypot(bounds.sizeX, bounds.sizeY, bounds.sizeZ) || 1;
    const scale = (Math.min(width, height) * 0.72) / diag;

    const cy = Math.cos(angles.yaw);
    const sy = Math.sin(angles.yaw);
    const cp = Math.cos(angles.pitch);
    const sp = Math.sin(angles.pitch);

    // Rotate STL (Z-up CAD convention) into view space (X right, Y up, Z depth toward viewer)
    const rot = (x: number, y: number, z: number): [number, number, number] => {
      // Yaw around CAD Z axis
      const x1 = x * cy - y * sy;
      const y1 = x * sy + y * cy;
      const z1 = z;
      // Pitch around screen X axis (mapping CAD Z to screen Up, CAD Y to depth)
      const vx = x1;
      const vy = z1 * cp - y1 * sp;
      const vz = z1 * sp + y1 * cp;
      return [vx, vy, vz];
    };

    // Directional studio key light from upper-left-front
    const lx = -0.45;
    const ly = 0.65;
    const lz = 0.61;

    const drawList: Array<{
      depth: number;
      ax: number;
      ay: number;
      bx: number;
      by: number;
      cx: number;
      cy: number;
      shade: number;
    }> = [];

    const cxScreen = width * 0.5;
    const cyScreen = height * 0.52;

    for (let i = 0; i < previewTriCount; i++) {
      const b = i * 9;
      const [ax, ay, az] = rot(
        previewPositions[b],
        previewPositions[b + 1],
        previewPositions[b + 2]
      );
      const [bx, by, bz] = rot(
        previewPositions[b + 3],
        previewPositions[b + 4],
        previewPositions[b + 5]
      );
      const [cx, cy2, cz] = rot(
        previewPositions[b + 6],
        previewPositions[b + 7],
        previewPositions[b + 8]
      );

      const [nx, ny, nz] = rot(
        previewNormals[i * 3],
        previewNormals[i * 3 + 1],
        previewNormals[i * 3 + 2]
      );

      const dot = Math.abs(nx * lx + ny * ly + nz * lz);
      const shade = Math.min(1, Math.max(0.28, 0.34 + dot * 0.66));

      drawList.push({
        depth: (az + bz + cz) / 3,
        ax: cxScreen + ax * scale,
        ay: cyScreen - ay * scale,
        bx: cxScreen + bx * scale,
        by: cyScreen - by * scale,
        cx: cxScreen + cx * scale,
        cy: cyScreen - cy2 * scale,
        shade,
      });
    }

    // Painter's algorithm (back to front)
    drawList.sort((p, q) => p.depth - q.depth);

    const drawEdges = previewTriCount <= 2500;
    for (const tri of drawList) {
      // Warm Baltic Birch CAD clay tone
      const r = Math.round(234 * tri.shade);
      const g = Math.round(205 * tri.shade);
      const bl = Math.round(162 * tri.shade);
      ctx.fillStyle = `rgb(${r}, ${g}, ${bl})`;
      ctx.beginPath();
      ctx.moveTo(tri.ax, tri.ay);
      ctx.lineTo(tri.bx, tri.by);
      ctx.lineTo(tri.cx, tri.cy);
      ctx.closePath();
      ctx.fill();
      if (drawEdges) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
  }, [mesh, angles]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    setAngles((prev) => ({
      yaw: prev.yaw + dx * 0.012,
      pitch: Math.max(-1.45, Math.min(1.45, prev.pitch + dy * 0.012)),
    }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if already released
    }
  };

  return (
    <div className="relative border border-black rounded-[9px] overflow-hidden bg-[#F7F5F0]">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="w-full h-[240px] sm:h-[260px] block cursor-grab active:cursor-grabbing touch-none"
      />
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
        {[
          { label: 'ISO', yaw: -0.62, pitch: 0.42 },
          { label: 'FRONT', yaw: 0, pitch: 0 },
          { label: 'SIDE', yaw: -Math.PI / 2, pitch: 0 },
          { label: 'TOP', yaw: 0, pitch: Math.PI / 2 - 0.01 },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setAngles({ yaw: preset.yaw, pitch: preset.pitch })}
            className="px-2 py-1 text-[0.6rem] font-mono uppercase bg-white/95 text-black border border-black rounded-[5px] hover:bg-[#FDCB33] cursor-pointer"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="absolute bottom-2 left-2.5 px-2 py-0.5 bg-white/90 border border-black/30 rounded-[4px] text-[0.6rem] font-mono text-black/80 pointer-events-none">
        DRAG TO ORBIT · {mesh.triangleCount.toLocaleString()} TRIS ({mesh.format.toUpperCase()})
      </div>
    </div>
  );
};

export const SconceConceptsModal: React.FC<SconceConceptsModalProps> = ({
  standalone = false,
  initialCols = 4,
  onClose,
}) => {
  const { user, signInWithGoogle, getFreshToken } = useAuth();
  const isOwner = Boolean(user?.email && user.email.toLowerCase() === OWNER_EMAIL);

  const [cols, setCols] = useState<number>(Math.max(2, Math.min(6, initialCols)));
  const [recentDownload, setRecentDownload] = useState<string | null>(null);

  // Custom STL upload & preview state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [stagedFile, setStagedFile] = useState<{
    name: string;
    bytes: number;
    buffer: ArrayBuffer;
    mesh: ParsedStlMesh;
  } | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [savedSconces, setSavedSconces] = useState<CustomSconceRecord[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [previewingSavedId, setPreviewingSavedId] = useState<string | null>(null);

  const fetchSavedSconces = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-sconces');
      if (res.ok) {
        const data = (await res.json()) as { sconces?: CustomSconceRecord[] };
        setSavedSconces(Array.isArray(data.sconces) ? data.sconces : []);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedSconces();
  }, [fetchSavedSconces]);

  useEffect(() => {
    if (standalone || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [standalone, onClose]);

  const lengthMm = Number(((cols - 1) * PITCH_X_MM + BIRCH_T_MM).toFixed(1));
  const lengthIn = (lengthMm / 25.4).toFixed(2);

  const flashDownloaded = (key: string) => {
    setRecentDownload(key);
    window.setTimeout(() => {
      setRecentDownload((curr) => (curr === key ? null : curr));
    }, 1800);
  };

  const handleDownloadStl = (id: SconceConceptId) => {
    downloadSconceConceptStl(id, cols);
    flashDownloaded(`stl-${id}`);
  };

  const handleDownloadAllStls = () => {
    SCONCE_CONCEPTS.forEach((concept, index) => {
      window.setTimeout(() => {
        downloadSconceConceptStl(concept.id, cols);
      }, index * 240);
    });
    flashDownloaded('stl-all');
  };

  const handleDownloadRender = (imageUrl: string, number: string, id: string) => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `casegoods-sconce-${number}-${id}-render.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    flashDownloaded(`img-${id}`);
  };

  const stageStlFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setUploadError('Please select a .STL file (Binary or ASCII STL exported from Rhino/CAD).');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('That .STL file is larger than 15 MB. Try exporting with slightly coarser mesh tolerance.');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const mesh = parseStlArrayBuffer(buffer);
      setStagedFile({
        name: file.name,
        bytes: file.size,
        buffer,
        mesh,
      });
      setPreviewingSavedId(null);
      setCustomTitle(file.name.replace(/\.stl$/i, '').replace(/[_-]+/g, ' ').trim());
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Unable to parse .STL file.');
    }
  };

  const handleSaveCustomStl = async () => {
    if (!stagedFile) return;
    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);
    try {
      const token = await getFreshToken();
      if (!token) {
        setUploadError('Please sign in with the Studio Owner Google account to save .STL files.');
        setIsUploading(false);
        return;
      }

      const stlBase64 = arrayBufferToBase64(stagedFile.buffer);
      const res = await fetch('/api/custom-sconces/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: stagedFile.name,
          title: customTitle.trim() || stagedFile.name.replace(/\.stl$/i, ''),
          notes: customNotes.trim(),
          stlBase64,
        }),
      });

      const data = (await res.json()) as { sconce?: CustomSconceRecord; error?: string };
      if (!res.ok || !data.sconce) {
        throw new Error(data.error || 'Failed to save .STL to studio.');
      }

      setSavedSconces((prev) => [data.sconce!, ...prev.filter((p) => p.filename !== data.sconce!.filename)]);
      setUploadSuccess(
        `Saved "${data.sconce.title}" (${data.sconce.sizeX} × ${data.sconce.sizeY} × ${data.sconce.sizeZ} mm) to the Casegoods studio.`
      );
      setCustomNotes('');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreviewSaved = async (rec: CustomSconceRecord) => {
    setUploadError(null);
    try {
      const res = await fetch(rec.publicUrl);
      if (!res.ok) throw new Error('Could not load saved .STL file.');
      const buffer = await res.arrayBuffer();
      const mesh = parseStlArrayBuffer(buffer);
      setStagedFile({
        name: rec.filename,
        bytes: rec.bytes,
        buffer,
        mesh,
      });
      setCustomTitle(rec.title);
      setCustomNotes(rec.notes || '');
      setPreviewingSavedId(rec.id);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Unable to preview saved STL.');
    }
  };

  const handleDeleteSaved = async (filename: string) => {
    setUploadError(null);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`/api/custom-sconces/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Failed to delete STL.');
      }
      setSavedSconces((prev) => prev.filter((s) => s.filename !== filename));
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const content = (
    <div
      className={
        standalone
          ? 'w-full max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-10'
          : 'relative w-full max-w-[1040px] max-h-[90vh] overflow-y-auto bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-7'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-black">
        <div>
          <div className="text-[0.65rem] tracking-cad uppercase font-medium text-black/60">
            CASEGOODS CAD PACK · 3/4&quot; BALTIC BIRCH · INTEGRAL-HOOK CHEEKS
          </div>
          <h2 className="text-xl sm:text-2xl font-light tracking-[0.04em] uppercase text-black mt-1">
            WALL SCONCE .STL STUDIO — UPLOAD &amp; DOWNLOADS
          </h2>
          <p className="text-xs sm:text-sm text-black/75 mt-1 max-w-[700px]">
            Upload your own custom sconce .STL from Rhino or CAD for live 3D inspection and studio storage, or download any of the five integral-hook 3/4&quot; Baltic Birch sconce designs below.
          </p>
        </div>

        {standalone ? (
          <a
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-black rounded-[9px] bg-white text-black text-[0.7rem] tracking-cad uppercase hover:bg-black hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Studio</span>
          </a>
        ) : (
          onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sconce downloads"
              className="inline-flex items-center justify-center w-9 h-9 border border-black rounded-[9px] bg-white text-black hover:bg-black hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {/* Custom STL Uploader & Live 3D Inspector */}
      <section
        aria-label="Upload custom sconce STL"
        className="mt-5 p-4 sm:p-5 border-[1.5px] border-black rounded-[9px] bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 bg-[#EF6922] text-black border border-black rounded-[6px] text-[0.62rem] font-mono font-bold uppercase tracking-wider">
              CUSTOM .STL UPLOAD
            </span>
            <h3 className="text-sm sm:text-base font-medium tracking-[0.04em] uppercase text-black">
              Upload Your New Wall Sconce Design
            </h3>
          </div>
          {stagedFile && (
            <button
              type="button"
              onClick={() => {
                setStagedFile(null);
                setPreviewingSavedId(null);
                setUploadError(null);
                setUploadSuccess(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="inline-flex items-center gap-1.5 text-[0.65rem] tracking-cad uppercase text-black/70 hover:text-black cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Preview</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.STL,model/stl,application/octet-stream"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) stageStlFile(file);
          }}
        />

        {!stagedFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              const file = e.dataTransfer.files?.[0];
              if (file) stageStlFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-[1.5px] border-dashed rounded-[9px] p-6 sm:p-8 text-center cursor-pointer transition-colors ${
              isDraggingFile
                ? 'border-black bg-[#FDCB33]/25'
                : 'border-black/50 bg-[#FAFAFA] hover:border-black hover:bg-[#F5F5F5]'
            }`}
          >
            <Upload className="w-6 h-6 mx-auto text-black mb-2" />
            <div className="text-xs sm:text-sm font-medium uppercase tracking-cad text-black">
              Drop your .STL file here or click to browse
            </div>
            <p className="text-xs text-black/65 mt-1">
              Supports Binary &amp; ASCII .STL meshes up to 15 MB (Rhino 3D, Fusion 360, SolidWorks, Blender)
            </p>
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 px-4 py-2 border border-black rounded-[9px] bg-[#FDCB33] text-black text-[0.68rem] font-semibold tracking-cad uppercase">
                <Upload className="w-3.5 h-3.5" />
                <span>Choose .STL File</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-7">
              <StlPreviewCanvas mesh={stagedFile.mesh} />
            </div>

            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="p-3 border border-black rounded-[9px] bg-[#FAFAFA] space-y-1.5">
                <div className="text-[0.62rem] font-mono uppercase tracking-wider text-black/60">
                  DETECTED MESH SPECS ({stagedFile.name})
                </div>
                <div className="text-sm font-mono font-bold text-black">
                  {stagedFile.mesh.bounds.sizeX} × {stagedFile.mesh.bounds.sizeY} ×{' '}
                  {stagedFile.mesh.bounds.sizeZ} units
                </div>
                <div className="text-[0.7rem] font-mono text-black/75">
                  If mm: {(stagedFile.mesh.bounds.sizeX / 25.4).toFixed(2)}&quot; ×{' '}
                  {(stagedFile.mesh.bounds.sizeY / 25.4).toFixed(2)}&quot; ×{' '}
                  {(stagedFile.mesh.bounds.sizeZ / 25.4).toFixed(2)}&quot; ·{' '}
                  {(stagedFile.bytes / 1024).toFixed(1)} KB
                </div>
              </div>

              {!previewingSavedId && (
                <>
                  <div>
                    <label className="block text-[0.62rem] tracking-cad uppercase font-medium text-black mb-1">
                      Design Name
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. Casegoods Birch Sconce v2"
                      className="w-full h-9 px-3 border border-black rounded-[9px] text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[0.62rem] tracking-cad uppercase font-medium text-black mb-1">
                      Shop / Lighting Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      placeholder="e.g. Units in inches, 3/4 birch cheeks, warm 2700K LED"
                      className="w-full h-9 px-3 border border-black rounded-[9px] text-xs bg-white text-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>

                  {isOwner ? (
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={handleSaveCustomStl}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 border border-black rounded-[9px] bg-[#EF6922] text-black text-[0.7rem] font-semibold tracking-cad uppercase hover:bg-black hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploading ? 'Saving to Studio...' : 'Save .STL to Studio'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => signInWithGoogle()}
                      className="inline-flex items-center justify-center gap-2 h-10 px-4 border border-black rounded-[9px] bg-[#27AAE0] text-black text-[0.7rem] font-semibold tracking-cad uppercase hover:bg-black hover:text-white transition-colors cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In as Owner to Save .STL</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 h-9 px-3 border border-black rounded-[9px] bg-white text-black text-[0.66rem] tracking-cad uppercase hover:bg-[#CBCBCB]/40 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Different .STL</span>
              </button>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mt-3 px-3 py-2 border border-black rounded-[9px] bg-[#EF6922]/20 text-black text-xs">
            {uploadError}
          </div>
        )}
        {uploadSuccess && (
          <div className="mt-3 px-3 py-2 border border-black rounded-[9px] bg-[#FDCB33]/40 text-black text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {/* Saved Custom Sconce STLs List */}
        {!loadingSaved && savedSconces.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#CBCBCB]">
            <div className="text-[0.65rem] tracking-cad uppercase font-medium text-black/70 mb-2.5">
              UPLOADED STUDIO SCONCE .STLs ({savedSconces.length})
            </div>
            <div className="space-y-2">
              {savedSconces.map((rec) => (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-2.5 border border-black rounded-[9px] bg-[#FAFAFA]"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black truncate">
                      {rec.title}
                    </div>
                    <div className="text-[0.66rem] font-mono text-black/70">
                      {rec.sizeX} × {rec.sizeY} × {rec.sizeZ} · {rec.triangleCount.toLocaleString()}{' '}
                      tris · {(rec.bytes / 1024).toFixed(1)} KB
                      {rec.notes ? ` · ${rec.notes}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePreviewSaved(rec)}
                      className="inline-flex items-center gap-1 px-2.5 h-8 border border-black rounded-[7px] bg-white text-black text-[0.62rem] tracking-cad uppercase hover:bg-[#27AAE0] cursor-pointer"
                    >
                      <Box className="w-3 h-3" />
                      <span>Preview 3D</span>
                    </button>
                    <a
                      href={`/api/custom-sconces/download/${encodeURIComponent(rec.filename)}`}
                      className="inline-flex items-center gap-1 px-2.5 h-8 border border-black rounded-[7px] bg-[#FDCB33] text-black text-[0.62rem] font-semibold tracking-cad uppercase hover:bg-black hover:text-white transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>.STL</span>
                    </a>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSaved(rec.filename)}
                        title="Delete uploaded STL"
                        className="inline-flex items-center justify-center w-8 h-8 border border-black rounded-[7px] bg-white text-black hover:bg-[#EF6922] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Global Width & Batch Download Controls for the 5 Studio Redesigns */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4 mt-4 border-y border-[#CBCBCB]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center border border-black rounded-[9px] overflow-hidden bg-white h-9">
            <span className="px-3 h-full inline-flex items-center bg-black text-white text-[0.65rem] tracking-cad uppercase">
              WIDTH
            </span>
            {[2, 3, 4, 5, 6].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCols(c)}
                className={`px-3 h-full text-xs font-mono border-l border-black/15 cursor-pointer transition-colors ${
                  cols === c
                    ? 'bg-[#FDCB33] text-black font-bold'
                    : 'bg-white text-black hover:bg-[#CBCBCB]/40'
                }`}
              >
                {c}×1
              </button>
            ))}
          </div>
          <span className="text-xs font-mono text-black/80">
            {lengthMm} mm ({lengthIn}&quot;) overall · 19.05 mm Baltic Birch cheeks
          </span>
        </div>

        <button
          type="button"
          onClick={handleDownloadAllStls}
          className="inline-flex items-center gap-2 px-4 h-9 border border-black rounded-[9px] bg-black text-white text-[0.68rem] tracking-cad uppercase hover:bg-[#EF6922] hover:text-black transition-colors cursor-pointer"
        >
          {recentDownload === 'stl-all' ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span>
            {recentDownload === 'stl-all'
              ? `Downloading All 5 (${cols}×1)...`
              : `Download All 5 .STLs (${cols}×1)`}
          </span>
        </button>
      </div>

      {/* 5 Sconce Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5">
        {SCONCE_CONCEPTS.map((concept) => {
          const stlDone = recentDownload === `stl-${concept.id}`;
          const imgDone = recentDownload === `img-${concept.id}`;

          return (
            <article
              key={concept.id}
              className="flex flex-col border border-black rounded-[9px] bg-white overflow-hidden"
            >
              {/* Visual Render */}
              <div className="relative bg-[#F6F6F6] border-b border-black aspect-[4/3] overflow-hidden">
                <img
                  src={concept.imageUrl}
                  alt={`${concept.number} — ${concept.title}`}
                  className="w-full h-full object-cover block"
                />
                <span
                  style={{ backgroundColor: concept.accentBg }}
                  className="absolute top-3 left-3 px-2.5 py-1 border border-black rounded-[6px] text-black text-[0.65rem] font-mono font-bold tracking-wider"
                >
                  {concept.number} / {concept.subtitle.toUpperCase()}
                </span>
              </div>

              {/* Spec & Download Actions */}
              <div className="p-4 flex flex-col flex-1 gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-medium tracking-[0.04em] uppercase text-black">
                    {concept.title}
                  </h3>
                  <span className="text-[0.68rem] font-mono text-black/70 shrink-0">
                    {lengthMm}×{concept.depthMm}×{concept.heightMm} mm
                  </span>
                </div>

                <div className="text-xs text-black/80 space-y-1 flex-1">
                  <p>
                    <span className="font-medium text-black uppercase tracking-wider text-[0.65rem]">
                      Cheek:{' '}
                    </span>
                    {concept.cheekSpec}
                  </p>
                  <p>
                    <span className="font-medium text-black uppercase tracking-wider text-[0.65rem]">
                      Span:{' '}
                    </span>
                    {concept.spanSpec}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[#CBCBCB]">
                  <button
                    type="button"
                    onClick={() => handleDownloadStl(concept.id)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 border border-black rounded-[9px] bg-[#FDCB33] text-black text-[0.66rem] font-semibold tracking-cad uppercase hover:bg-black hover:text-white transition-colors cursor-pointer"
                  >
                    {stlDone ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{stlDone ? 'Saved .STL' : `Download ${cols}×1 .STL`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadRender(concept.imageUrl, concept.number, concept.id)
                    }
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 border border-black rounded-[9px] bg-white text-black text-[0.66rem] font-medium tracking-cad uppercase hover:bg-[#27AAE0] hover:text-black transition-colors cursor-pointer"
                  >
                    {imgDone ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Download className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{imgDone ? 'Saved .JPG' : 'Download Render'}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  if (standalone) {
    return <main className="min-h-screen bg-white text-black">{content}</main>;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wall Sconce STL Studio — Upload and Downloads"
      className="fixed inset-0 z-[100] bg-black/55 flex items-center justify-center p-3 sm:p-6 ui-surface"
      onClick={onClose}
    >
      {content}
    </div>
  );
};
