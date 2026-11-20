import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import { downloadWatermarkedSheet } from '../utils/watermarkSheet.ts';

export interface ProjectImage {
  src: string;
  label: string;
  alt: string;
  sheetNumber: string;
  type: 'render' | 'cad';
}

export interface ProjectData {
  id: string;
  code: string;
  title: string;
  recipient?: string;
  category: string;
  categoryTag: 'architectural' | 'furniture' | 'commercial';
  materials: string;
  dimensions: string;
  description: string;
  images: ProjectImage[];
  specs: { label: string; value: string }[];
}

interface SheetColorTheme {
  barBg: string;
  barText: string;
  borderColor: string;
  ringColor: string;
  hoverBg: string;
  hoverText: string;
}

export const CLOSER_INSPECTION_THEMES: SheetColorTheme[] = [
  {
    barBg: 'bg-[#EF6922]',
    barText: 'text-black',
    borderColor: 'border-[#EF6922]',
    ringColor: 'ring-[#EF6922]/35',
    hoverBg: 'hover:bg-[#EF6922]',
    hoverText: 'hover:text-black',
  },
  {
    barBg: 'bg-[#27AAE0]',
    barText: 'text-black',
    borderColor: 'border-[#27AAE0]',
    ringColor: 'ring-[#27AAE0]/35',
    hoverBg: 'hover:bg-[#27AAE0]',
    hoverText: 'hover:text-black',
  },
  {
    barBg: 'bg-[#FDCB33]',
    barText: 'text-black',
    borderColor: 'border-[#FDCB33]',
    ringColor: 'ring-[#FDCB33]/40',
    hoverBg: 'hover:bg-[#FDCB33]',
    hoverText: 'hover:text-black',
  },
  {
    barBg: 'bg-[#CBCBCB]',
    barText: 'text-black',
    borderColor: 'border-[#CBCBCB]',
    ringColor: 'ring-[#CBCBCB]/50',
    hoverBg: 'hover:bg-[#CBCBCB]',
    hoverText: 'hover:text-black',
  },
];

interface CadModalProps {
  project: ProjectData | null;
  initialImageIndex?: number;
  initialShowSpecs?: boolean;
  onClose: () => void;
}

export const CadModal: React.FC<CadModalProps> = ({
  project,
  initialImageIndex = 0,
  initialShowSpecs = false,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialImageIndex);
  const [isSpecsOpen, setIsSpecsOpen] = useState(initialShowSpecs);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    setCurrentIndex(initialImageIndex);
    setIsSpecsOpen(initialShowSpecs);
    setZoomLevel(1);
  }, [project, initialImageIndex, initialShowSpecs]);

  useEffect(() => {
    if (!project) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && !isSpecsOpen && project.images.length > 1) {
        e.preventDefault();
        setZoomLevel(1);
        setCurrentIndex((prev) => (prev === 0 ? project.images.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && !isSpecsOpen && project.images.length > 1) {
        e.preventDefault();
        setZoomLevel(1);
        setCurrentIndex((prev) => (prev === project.images.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [project, isSpecsOpen, onClose]);

  if (!project) return null;

  const activeImage = project.images[currentIndex] || project.images[0];
  const activeTheme = isSpecsOpen
    ? CLOSER_INSPECTION_THEMES[3]
    : CLOSER_INSPECTION_THEMES[currentIndex % CLOSER_INSPECTION_THEMES.length];

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(0.75, prev + delta), 2.5));
  };

  const resetZoom = () => setZoomLevel(1);

  const prevImage = () => {
    setIsSpecsOpen(false);
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev === 0 ? project.images.length - 1 : prev - 1));
  };

  const nextImage = () => {
    setIsSpecsOpen(false);
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev === project.images.length - 1 ? 0 : prev + 1));
  };

  const drawingTypeLabel = isSpecsOpen
    ? 'SPECIFICATION SCHEDULE'
    : `${activeImage.sheetNumber} · ${
        activeImage.type === 'cad' ? '2D CAD DRAWING' : '3D RENDERING'
      }`;

  const handleSavePortfolioSheet = async () => {
    await downloadWatermarkedSheet(
      {
        imageSrc: activeImage.src,
        projectHeader: `${project.code} — ${project.title}`,
        drawingTypeLabel: `${activeImage.sheetNumber} · ${
          activeImage.type === 'cad' ? '2D CAD DRAWING' : '3D RENDERING'
        }`,
        bottomSpecLine: `${activeImage.label} · ${project.materials}`,
        leftBoxFill: '#EF6922',
        leftBoxText: '#000000',
        rightBoxFill: activeImage.type === 'cad' ? '#FDCB33' : '#27AAE0',
        rightBoxText: '#000000',
      },
      `casegoods-${project.id}-${activeImage.sheetNumber.toLowerCase().replace(/\s+/g, '-')}.png`
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cad-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-6xl bg-white border-[1.5px] border-black rounded-[9px] p-3 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[94vh] transition-colors duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top 3-Zone Architectural Header:
            [Left Box: Project Name/Number] — [Center: Casegoods Logo] — [Right Box: Drawing/Rendering Name] */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 select-none">
          {/* Left Box: Project Name or Number */}
          <div
            className={`${activeTheme.barBg} ${activeTheme.barText} border border-black rounded-[9px] px-4 py-2.5 flex items-center justify-start text-left overflow-hidden`}
          >
            <span id="cad-modal-title" className="text-[0.74rem] tracking-cad uppercase font-medium truncate">
              {project.code} — {project.title}
            </span>
          </div>

          {/* Center: Casegoods Logo */}
          <div className="flex items-center justify-center px-2">
            <img
              src={ASSETS.brand.logoFull}
              alt="casegoods — handcrafted in omaha"
              className="h-12 sm:h-14 w-auto object-contain select-none"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Right Box: What Drawing or Rendering It Is + Close Button */}
          <div className="flex items-center justify-end gap-2">
            <div className="flex-1 bg-[#FDCB33] text-black border border-black rounded-[9px] px-4 py-2.5 flex items-center justify-center text-center overflow-hidden">
              <span className="text-[0.72rem] tracking-cad uppercase font-medium truncate">
                {drawingTypeLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2.5 rounded-[9px] border-[0.75px] border-black bg-white text-black text-[0.70rem] tracking-cad uppercase hover:bg-black hover:text-white transition-all cursor-pointer flex items-center gap-1 font-medium shrink-0"
              aria-label="Close high-resolution viewer"
            >
              <span>CLOSE</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* High-Resolution Image or Spec Sheet Stage — Outlined with Matching Spacing */}
        <div
          className={`relative flex-1 min-h-[360px] sm:min-h-[500px] overflow-auto flex items-center justify-center bg-white rounded-[9px] border border-black p-4 sm:p-8 transition-colors duration-300`}
        >
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out',
            }}
            className="w-full h-full flex items-center justify-center"
          >
            {!isSpecsOpen ? (
              <img
                src={activeImage.src}
                alt={activeImage.alt}
                className="max-w-full max-h-[64vh] w-auto h-auto object-contain select-none"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full max-w-4xl bg-white">
                <div
                  className={`border-[0.75px] border-black rounded-[9px] overflow-hidden`}
                >
                  <div
                    className={`${activeTheme.barBg} ${activeTheme.barText} px-5 py-3 text-[0.76rem] tracking-cad uppercase font-light flex flex-wrap items-center justify-between gap-2`}
                  >
                    <span>ARCHITECTURAL MATERIAL &amp; JOINERY SCHEDULE — {project.code}</span>
                    <span>{project.dimensions}</span>
                  </div>
                  <div className="divide-y divide-black/15 bg-white">
                    {project.specs.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 sm:px-6 sm:py-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-left"
                      >
                        <span className="text-[0.72rem] tracking-cad uppercase text-black/75 font-light">
                          {item.label}
                        </span>
                        <span className="sm:col-span-2 text-[0.90rem] font-light tracking-[0.015em] text-black leading-relaxed">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Left/Right Switchers if multiple images and not on Spec Sheet */}
          {!isSpecsOpen && project.images.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevImage}
                className={`fixed sm:absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[9px] bg-white/95 ${activeTheme.hoverBg} ${activeTheme.hoverText} text-black border-[0.75px] border-black flex items-center justify-center shadow-md transition-all cursor-pointer`}
                aria-label="Previous sheet"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextImage}
                className={`fixed sm:absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[9px] bg-white/95 ${activeTheme.hoverBg} ${activeTheme.hoverText} text-black border-[0.75px] border-black flex items-center justify-center shadow-md transition-all cursor-pointer`}
                aria-label="Next sheet"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Modal Bottom Controls & Sheet Selector Bar */}
        <div
          className={`p-3 sm:px-5 sm:py-3.5 bg-white border border-black rounded-[9px] flex flex-wrap items-center justify-between gap-3 text-[0.74rem] tracking-cad transition-colors duration-300`}
        >
          <div className="flex items-center gap-2">
            <span className="text-black/75 uppercase hidden sm:inline font-light">ZOOM:</span>
            <button
              type="button"
              onClick={() => handleZoom(0.25)}
              className={`p-2 border-[0.75px] border-black rounded-[9px] bg-white text-black ${activeTheme.hoverBg} ${activeTheme.hoverText} transition-all cursor-pointer`}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-0.25)}
              className={`p-2 border-[0.75px] border-black rounded-[9px] bg-white text-black ${activeTheme.hoverBg} ${activeTheme.hoverText} transition-all cursor-pointer`}
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className={`px-3 py-1.5 border-[0.75px] border-black rounded-[9px] bg-white text-black ${activeTheme.hoverBg} ${activeTheme.hoverText} transition-all cursor-pointer text-[0.70rem] font-light`}
              title="Reset Zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            {!isSpecsOpen && (
              <button
                type="button"
                onClick={handleSavePortfolioSheet}
                className="px-3 py-1.5 border-[0.75px] border-black rounded-[9px] bg-[#FDCB33] hover:bg-black text-black hover:text-white transition-all cursor-pointer text-[0.70rem] font-medium inline-flex items-center gap-1.5"
                title="Save Watermarked Sheet PNG"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SAVE PNG</span>
              </button>
            )}
          </div>

          {/* Sheet Selector Buttons + SPEC SHEET Button Matching Main Portfolio Page */}
          <div className="flex flex-wrap items-center gap-2">
            {project.images.map((img, idx) => {
              const sheetTheme =
                CLOSER_INSPECTION_THEMES[idx % CLOSER_INSPECTION_THEMES.length];
              const isSheetActive = !isSpecsOpen && currentIndex === idx;
              return (
                <button
                  key={img.src}
                  type="button"
                  onClick={() => {
                    setIsSpecsOpen(false);
                    setZoomLevel(1);
                    setCurrentIndex(idx);
                  }}
                  className={`px-3.5 py-2 rounded-[9px] border-[0.75px] text-[0.70rem] tracking-cad uppercase font-light transition-all cursor-pointer ${
                    isSheetActive
                      ? `${sheetTheme.barBg} ${sheetTheme.barText} ${sheetTheme.borderColor}`
                      : `bg-white text-black ${sheetTheme.borderColor} hover:opacity-80`
                  }`}
                >
                  {img.sheetNumber}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setIsSpecsOpen((prev) => !prev);
                setZoomLevel(1);
              }}
              className={`px-3.5 py-2 rounded-[9px] border-[0.75px] text-[0.70rem] tracking-cad uppercase font-light transition-all cursor-pointer ${
                isSpecsOpen
                  ? 'bg-[#CBCBCB] text-black border-[#CBCBCB]'
                  : 'bg-white text-black border-[#CBCBCB] hover:opacity-80'
              }`}
            >
              SPEC SHEET
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
