import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ASSETS } from '../assets/index.ts';

interface DrawingSheet {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  pillarBg: string;
  cadSrc: string;
  renderSrc: string;
  renderCaption: string;
  downloadName: string;
}

const FAMILY_ROOM_SHEETS: DrawingSheet[] = [
  {
    id: 'a101',
    code: 'A-101',
    title: 'ELEVATIONS & SECTIONS',
    subtitle: 'West Wall, North Wall Run, Sections A / B / C & Material Schedule',
    pillarBg: 'bg-[#EF6922]',
    cadSrc: '/downloads/drawings/casegoods-1064HEM-A101-elevations-sections.png',
    renderSrc: '/assets/render_1064HEM_1.jpg',
    renderCaption: 'Reference 3D Render — Full North Wall Elevation & Window Bench',
    downloadName: 'casegoods-1064HEM-A101-elevations-sections.png',
  },
  {
    id: 'a102',
    code: 'A-102',
    title: 'PLAN & ISOMETRIC',
    subtitle: 'Floor Plan, Horizontal Section & 30° Orthographic Isometric',
    pillarBg: 'bg-[#27AAE0]',
    cadSrc: '/downloads/drawings/casegoods-1064HEM-A102-plan-isometric.png',
    renderSrc: '/assets/render_1064HEM_4.jpg',
    renderCaption: 'Reference 3D Render — West Wall Return, Sloped Window & Tall Tower',
    downloadName: 'casegoods-1064HEM-A102-plan-isometric.png',
  },
  {
    id: 'a103',
    code: 'A-103',
    title: 'BENCH & JOINERY DETAILS',
    subtitle: '6-Bay Window Bench, Section D, 2-Drawer Chest & 1:1 Joinery Profiles',
    pillarBg: 'bg-[#FDCB33]',
    cadSrc: '/downloads/drawings/casegoods-1064HEM-A103-bench-joinery-details.png',
    renderSrc: '/assets/render_1064HEM_3.jpg',
    renderCaption: 'Reference 3D Render — Exposed Box Finger-Joints, Fluted Drawers & Bench',
    downloadName: 'casegoods-1064HEM-A103-bench-joinery-details.png',
  },
];

const COMBINED_PDF_URL = '/downloads/drawings/casegoods-1064HEM-family-room-submittal-A101-A103.pdf';

export const FamilyRoomDrawingsViewer: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'cad' | 'render'>('cad');
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const activeSheet = FAMILY_ROOM_SHEETS[activeIndex] ?? FAMILY_ROOM_SHEETS[0];
  const activeSrc = viewMode === 'cad' ? activeSheet.cadSrc : activeSheet.renderSrc;

  useEffect(() => {
    setImgStatus('loading');
    setZoom(1);
  }, [activeSrc]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
      if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev + 1) % FAMILY_ROOM_SHEETS.length);
      }
      if (e.key === 'ArrowLeft') {
        setActiveIndex(
          (prev) => (prev - 1 + FAMILY_ROOM_SHEETS.length) % FAMILY_ROOM_SHEETS.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleBackToStudio = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="min-h-screen bg-white text-black font-nexa antialiased">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Top Studio Navigation Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black pb-4">
          <button
            type="button"
            onClick={handleBackToStudio}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[9px] border border-black bg-white text-black text-[0.72rem] tracking-cad uppercase hover:bg-black hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO STUDIO</span>
          </button>

          <img
            src={ASSETS.brand.logoFull}
            alt="casegoods — maker of things"
            className="h-10 sm:h-12 w-auto object-contain select-none"
            referrerPolicy="no-referrer"
          />

          <a
            href={COMBINED_PDF_URL}
            download="casegoods-1064HEM-family-room-submittal-A101-A103.pdf"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[9px] border border-black bg-[#FDCB33] text-black text-[0.72rem] tracking-cad uppercase font-medium hover:bg-black hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>DOWNLOAD ALL 3 (PDF)</span>
          </a>
        </header>

        {/* Active Sheet Bauhaus Banner */}
        <div
          className={`w-full ${activeSheet.pillarBg} text-black border border-black rounded-[9px] px-5 py-3 flex flex-wrap items-center justify-between gap-2`}
        >
          <span className="text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase font-medium">
            {activeSheet.code} / FAMILY ROOM CABINETS &amp; WINDOW BENCH (1064HEM) — {activeSheet.title}
          </span>
          <span className="text-[0.72rem] tracking-cad uppercase font-medium">
            4800 × 3000 PNG · VECTOR PDF
          </span>
        </div>

        {/* Sheet Selector & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Architectural sheets">
            {FAMILY_ROOM_SHEETS.map((sheet, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={sheet.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveIndex(idx)}
                  className={`px-4 py-2 rounded-[9px] border border-black text-[0.72rem] tracking-cad uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? `${sheet.pillarBg} text-black font-medium`
                      : 'bg-white text-black hover:bg-[#CBCBCB]/40'
                  }`}
                >
                  {sheet.code} · {sheet.title}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* CAD vs Reference Render Toggle */}
            <div className="inline-flex rounded-[9px] border border-black overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('cad')}
                className={`px-3 py-2 text-[0.70rem] tracking-cad uppercase transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'cad'
                    ? 'bg-black text-white font-medium'
                    : 'bg-white text-black hover:bg-[#CBCBCB]/40'
                }`}
              >
                2D CAD SHEET
              </button>
              <button
                type="button"
                onClick={() => setViewMode('render')}
                className={`px-3 py-2 text-[0.70rem] tracking-cad uppercase border-l border-black transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'render'
                    ? 'bg-[#CBCBCB] text-black font-medium'
                    : 'bg-white text-black hover:bg-[#CBCBCB]/40'
                }`}
              >
                3D RENDER REF
              </button>
            </div>

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
              className="p-2 rounded-[9px] border border-black bg-white text-black hover:bg-[#EF6922] transition-colors cursor-pointer"
              aria-label="Zoom in"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
              className="p-2 rounded-[9px] border border-black bg-white text-black hover:bg-[#27AAE0] transition-colors cursor-pointer"
              aria-label="Zoom out"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-3 py-2 rounded-[9px] border border-black bg-white text-black text-[0.70rem] tracking-cad uppercase tabular-nums hover:bg-[#CBCBCB] transition-colors cursor-pointer"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[9px] border border-black bg-white text-black text-[0.70rem] tracking-cad uppercase hover:bg-black hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>FULLSCREEN</span>
            </button>

            <a
              href={activeSheet.cadSrc}
              download={activeSheet.downloadName}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] border border-black bg-[#EF6922] text-black text-[0.70rem] tracking-cad uppercase font-medium hover:bg-black hover:text-white transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>SAVE {activeSheet.code} PNG</span>
            </a>
          </div>
        </div>

        {/* High-Resolution Sheet Viewport */}
        <div className="relative rounded-[9px] border-[1.5px] border-black bg-white p-3 sm:p-5 overflow-auto">
          <div className="min-h-[340px] sm:min-h-[540px] flex items-center justify-center relative">
            {imgStatus === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 gap-2">
                <div className="w-9 h-9 rounded-[9px] border border-black flex items-center justify-center text-[0.68rem] tracking-cad font-medium">
                  CG
                </div>
                <span className="text-[0.72rem] tracking-cad uppercase text-black/75">
                  LOADING {activeSheet.code} SHEET...
                </span>
              </div>
            )}

            {imgStatus === 'error' ? (
              <div className="p-10 text-center space-y-3 border border-[#CBCBCB] rounded-[9px] bg-white">
                <p className="text-[0.82rem] tracking-cad uppercase font-medium">
                  UNABLE TO LOAD {activeSheet.code} IMAGE
                </p>
                <p className="text-[0.85rem] text-black/75">
                  Download the combined vector PDF above or reload the sheet.
                </p>
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="w-full flex items-center justify-center"
              >
                <img
                  src={activeSrc}
                  alt={
                    viewMode === 'cad'
                      ? `${activeSheet.code} — ${activeSheet.title}`
                      : activeSheet.renderCaption
                  }
                  onLoad={() => setImgStatus('loaded')}
                  onError={() => setImgStatus('error')}
                  className="w-full h-auto max-h-[72vh] object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setActiveIndex(
                (prev) => (prev - 1 + FAMILY_ROOM_SHEETS.length) % FAMILY_ROOM_SHEETS.length
              )
            }
            aria-label="Previous sheet"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[9px] border border-black bg-white/95 text-black hover:bg-[#EF6922] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveIndex((prev) => (prev + 1) % FAMILY_ROOM_SHEETS.length)}
            aria-label="Next sheet"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[9px] border border-black bg-white/95 text-black hover:bg-[#27AAE0] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* All 3 Sheets Thumbnail Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FAMILY_ROOM_SHEETS.map((sheet, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <button
                key={sheet.id}
                type="button"
                onClick={() => {
                  setActiveIndex(idx);
                  setViewMode('cad');
                }}
                className={`text-left rounded-[9px] border overflow-hidden bg-white transition-all cursor-pointer ${
                  isSelected ? 'border-black ring-2 ring-black/20' : 'border-[#CBCBCB] hover:border-black'
                }`}
              >
                <div
                  className={`${sheet.pillarBg} text-black px-3.5 py-2 border-b border-black flex items-center justify-between text-[0.70rem] tracking-cad uppercase font-medium`}
                >
                  <span>{sheet.code}</span>
                  <span>{sheet.title}</span>
                </div>
                <div className="p-2.5 bg-white">
                  <img
                    src={sheet.cadSrc}
                    alt={`${sheet.code} thumbnail`}
                    loading="lazy"
                    className="w-full aspect-[16/10] object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {isFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/90 p-3 sm:p-6 flex flex-col gap-3"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="flex items-center justify-between gap-3 bg-white border border-black rounded-[9px] px-4 py-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[0.74rem] tracking-cad uppercase font-medium">
              {activeSheet.code} · {activeSheet.title} — {activeSheet.subtitle}
            </span>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] border border-black bg-white text-black text-[0.70rem] tracking-cad uppercase hover:bg-black hover:text-white transition-colors cursor-pointer"
            >
              <span>CLOSE</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className="flex-1 bg-white border border-black rounded-[9px] p-3 overflow-auto flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeSrc}
              alt={`${activeSheet.code} fullscreen`}
              className="max-w-full max-h-full object-contain select-none"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
