import React, { useState, useEffect, useRef } from 'react';
import { ProjectData, CadModal } from './CadModal.tsx';
import { Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ASSETS } from '../assets/index.ts';

interface LazyPortfolioImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectClassName?: string;
}

const LazyPortfolioImage: React.FC<LazyPortfolioImageProps> = ({
  src,
  alt,
  className = '',
  aspectClassName = 'aspect-[3070/1434]',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsLoaded(false);
  }, [src]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '250px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden flex items-center justify-center ${aspectClassName}`}
    >
      {!isLoaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-2 animate-pulse"
        >
          <div className="w-8 h-8 rounded-[6px] border border-black/30 flex items-center justify-center text-[0.65rem] tracking-cad text-black/75">
            CG
          </div>
          <span className="text-[0.68rem] tracking-cad uppercase text-black/75">
            LOADING HIGH-RES SHEET...
          </span>
        </div>
      )}

      {isInView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`${className} transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
};

interface SheetColorTheme {
  barBg: string;
  barText: string;
  borderColor: string;
  ringColor: string;
  hoverBg: string;
  hoverText: string;
}

const CLOSER_INSPECTION_THEMES: SheetColorTheme[] = [
  {
    barBg: 'bg-[#27AAE0]',
    barText: 'text-white',
    borderColor: 'border-[#27AAE0]',
    ringColor: 'ring-[#27AAE0]/35',
    hoverBg: 'hover:bg-[#27AAE0]',
    hoverText: 'hover:text-white',
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
  {
    barBg: 'bg-black',
    barText: 'text-white',
    borderColor: 'border-black',
    ringColor: 'ring-black/35',
    hoverBg: 'hover:bg-black',
    hoverText: 'hover:text-white',
  },
];

const FILTER_TABS: {
  id: 'all' | 'architectural' | 'furniture' | 'commercial';
  label: string;
  theme: SheetColorTheme;
}[] = [
  {
    id: 'all',
    label: '01 / ALL COMMISSIONS',
    theme: CLOSER_INSPECTION_THEMES[0],
  },
  {
    id: 'architectural',
    label: '02 / ARCHITECTURAL & BUILT-INS',
    theme: CLOSER_INSPECTION_THEMES[1],
  },
  {
    id: 'furniture',
    label: '03 / HEIRLOOM FURNITURE & CAD',
    theme: CLOSER_INSPECTION_THEMES[2],
  },
  {
    id: 'commercial',
    label: '04 / WET BARS & SPECIALTY',
    theme: CLOSER_INSPECTION_THEMES[3],
  },
];

export const Portfolio: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'architectural' | 'furniture' | 'commercial'>('all');
  const [activeImageIdx, setActiveImageIdx] = useState<Record<string, number>>({
    'family-room': 0,
    'wet-bar': 0,
    'kids-kitchen': 0,
  });
  const [showSpecs, setShowSpecs] = useState<Record<string, boolean>>({});
  const [lightboxState, setLightboxState] = useState<{
    project: ProjectData | null;
    imageIndex: number;
    showSpecs?: boolean;
  }>({ project: null, imageIndex: 0, showSpecs: false });

  const projects: ProjectData[] = [
    {
      id: 'family-room',
      code: '1064HEM',
      title: 'FAMILY ROOM CABINETS & BENCH',
      recipient: 'HOLLYE HEMPEL',
      category: 'ARCHITECTURAL BUILT-IN',
      categoryTag: 'architectural',
      materials: 'FLUTED WALNUT • FINGER-JOINTED WHITE OAK • WINDOW BENCH',
      dimensions: 'CUSTOM FULL-WALL ARCHITECTURAL INSTALLATION',
      description:
        'Vertical and horizontal fluted American black walnut doors paired with exposed box-jointed white oak casework, integrated window bench storage, and custom turned pulls.',
      images: [
        {
          src: ASSETS.familyRoom.sheet1FullElevation,
          sheetNumber: 'SHEET 01',
          label: 'Full architectural elevation — fluted walnut tower, window bench & floating shelves',
          alt: '3D architectural elevation of 144-inch full-wall built-in showing 96-inch fluted black walnut tower, 18-inch-high window bench storage, floating shelves, and exposed box finger-jointed white oak casework',
          type: 'render',
        },
        {
          src: ASSETS.familyRoom.sheet2CornerReturn,
          sheetNumber: 'SHEET 02',
          label: 'Corner return & tower perspective — exposed finger-joint white oak casing',
          alt: 'Corner return perspective detailing 24-inch-deep rift-sawn white oak casework with 0.75-inch exposed box finger-jointed corners and full-height semicircular fluted walnut doors',
          type: 'render',
        },
        {
          src: ASSETS.familyRoom.sheet3FlutedDetail,
          sheetNumber: 'SHEET 03',
          label: 'Close-up detail — vertical & horizontal fluted walnut doors & turned hardware',
          alt: 'Close-up millwork detail showing 0.5-inch-radius vertical and horizontal semicircular fluted black walnut doors paired with 1.25-inch lathe-turned solid wood cylindrical pulls',
          type: 'render',
        },
        {
          src: ASSETS.familyRoom.sheet4JoineryDetail,
          sheetNumber: 'SHEET 04',
          label: 'Joinery detail — exposed finger-joint casework & scalloped drawer profiles',
          alt: 'Joinery detail highlighting precision 0.75-inch exposed box finger-jointed solid white oak case corners, custom scalloped drawer fronts, and concealed soft-close undermount runners',
          type: 'render',
        },
      ],
      specs: [
        { label: 'PRIMARY HARDWOODS', value: 'Select American Black Walnut & Rift/Quarter-Sawn White Oak' },
        { label: 'DOOR & DRAWER MILLWORK', value: 'Custom vertical and horizontal semicircular fluting machined in-house' },
        { label: 'CASEWORK JOINERY', value: 'Exposed box finger-joints along solid white oak case corners' },
        { label: 'HARDWARE & PULLS', value: 'Custom lathe-turned solid wood cylindrical pulls & concealed soft-close runners' },
      ],
    },
    {
      id: 'wet-bar',
      code: '1064HEM',
      title: 'WET BAR CABINETS & FLUTED ISLAND',
      recipient: 'HOLLYE HEMPEL',
      category: 'ARCHITECTURAL & COMMERCIAL CABINETRY',
      categoryTag: 'commercial',
      materials: 'COLOR-BLOCKED DRAWERS • FLUTED OAK ISLAND • MATTE BLACK TOPS',
      dimensions: 'TWO-PIECE WET BAR & RADIUS PENINSULA ISLAND',
      description:
        'Radiused white oak fluted tambour island and walnut back bar accented with Bauhaus color-blocked drawer fronts in orange, cerulean blue, and industrial gray.',
      images: [
        {
          src: ASSETS.wetBar.sheet6TambourIsland,
          sheetNumber: 'SHEET 06',
          label: 'Island perspective — fluted oak tambour front, walnut foot rail & matte black top',
          alt: '3D rendering of 84-inch by 36-inch radiused wet bar peninsula island featuring 42-inch-high oversized vertical fluted white oak tambour columns, mortised solid walnut foot rail, and 1.5-inch matte black top',
          type: 'render',
        },
        {
          src: ASSETS.wetBar.sheet7ColorBlockedDrawers,
          sheetNumber: 'SHEET 07',
          label: 'Interior elevation — color-blocked drawer stack in gray, blue & Bauhaus orange',
          alt: 'Interior elevation of 96-inch walnut back bar credenza showing 36-inch counter height, book-matched walnut doors with routed finger-pull joinery, and Bauhaus color-blocked dovetail drawer stack',
          type: 'render',
        },
        {
          src: ASSETS.wetBar.sheet5OverheadLayout,
          sheetNumber: 'SHEET 05',
          label: 'Overhead spatial layout — back bar credenza & peninsula sink island',
          alt: 'Overhead architectural plan view showing 96-inch back bar credenza, 42-inch walkway clearance, and 84-inch radiused fluted white oak tambour peninsula island with undermount stainless bar sink',
          type: 'render',
        },
      ],
      specs: [
        { label: 'ISLAND FRONT', value: 'Oversized vertical fluted white oak columns with solid walnut base rail' },
        { label: 'ACCENT DRAWER FRONTS', value: 'Color-blocked in Bauhaus Orange (#EF6922), Cerulean Blue (#27AAE0) & Gray (#CBCBCB)' },
        { label: 'CASEWORK & DOORS', value: 'Vertical book-matched walnut doors with integrated black finger pulls' },
        { label: 'COUNTERTOPS', value: 'Matte black radiused countertop with stainless undermount bar sink' },
      ],
    },
    {
      id: 'kids-kitchen',
      code: '1070MCG',
      title: 'KIDS KITCHEN & BUILT-IN WALL — CAD SHOP DRAWINGS',
      recipient: 'LAUREN & JOE MCGILL',
      category: 'CUSTOM HEIRLOOM FURNITURE & CAD',
      categoryTag: 'furniture',
      materials: 'SOLID BLACK WALNUT • STACKED-BALL LATHE LEGS • SCALLOPED APRON',
      dimensions: '48 1/4" W PLAY KITCHENETTE + 72 3/4" W × 101" H BUILT-IN STORAGE',
      description:
        'Dimensioned 2D Rhino CAD elevation and section shop drawings for a solid walnut heirloom play kitchen featuring lathe-turned stacked-ball legs and a scalloped apron.',
      images: [
        {
          src: ASSETS.kidsKitchen.elevationA1,
          sheetNumber: 'ELEVATION A1',
          label: 'Kids kitchen elevation drawing — full fractional dimensions (48 1/4" width / 101" height)',
          alt: 'Rhino 2D CAD elevation drawing showing 48.25-inch overall countertop span and stacked-ball lathe legs',
          type: 'cad',
        },
        {
          src: ASSETS.kidsKitchen.sectionB1,
          sheetNumber: 'SECTION B1',
          label: 'Section view through kids kitchen & plumbing detail',
          alt: 'Rhino 2D CAD section B1 shop drawing detailing 30.5-inch countertop height, 9.75-inch stacked-ball lathe leg tenon joinery, continuous scalloped apron profile, and 72.75-inch by 101-inch built-in storage wall',
          type: 'cad',
        },
      ],
      specs: [
        { label: 'ENGINEERING SOFTWARE', value: 'Rhino 3D CAD Modeling & Dimensioned 2D Architectural Shop Drawings' },
        { label: 'KITCHENETTE WIDTH', value: '48 1/4" Overall Countertop Span × 30 1/2" Counter Height' },
        { label: 'TURNED & SHAPED DETAILS', value: 'Lathe-turned stacked-ball legs (9 3/4" H) with continuous scalloped apron' },
        { label: 'ADJACENT MILLWORK', value: '72 3/4" W × 101" H full-height architectural storage cabinetry' },
      ],
    },
  ];

  const filteredProjects = projects.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'architectural') return p.id === 'family-room' || p.id === 'wet-bar';
    if (filter === 'furniture') return p.id === 'kids-kitchen';
    if (filter === 'commercial') return p.id === 'wet-bar' || p.id === 'kids-kitchen';
    return true;
  });

  const selectedFilterTheme =
    FILTER_TABS.find((tab) => tab.id === filter)?.theme ?? CLOSER_INSPECTION_THEMES[0];

  const setSheetIndex = (projectId: string, index: number) => {
    setActiveImageIdx((prev) => ({ ...prev, [projectId]: index }));
    setShowSpecs((prev) => ({ ...prev, [projectId]: false }));
  };

  return (
    <section id="work" className="mb-12 scroll-mt-24">
      {/* Bauhaus Orange Section Bar (ALL CAPS) */}
      <div className="w-full bg-[#EF6922] text-white text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-light mb-3.5 select-none">
        SELECTED WORK, 3D RENDERINGS &amp; 2D CAD DRAWINGS
      </div>

      {/* Filter Tabs — Styled & Colored to Match Closer Inspection Section of Landing Page */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-9">
        {FILTER_TABS.map((tab) => {
          const isSelected = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`py-2.5 px-3 text-[0.72rem] tracking-cad uppercase rounded-[9px] border transition-all font-light cursor-pointer text-center ${
                isSelected
                  ? `${tab.theme.barBg} ${tab.theme.barText} ${tab.theme.borderColor}`
                  : `bg-white text-black ${tab.theme.borderColor} hover:opacity-80`
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Project Sheets Stack */}
      <div className="space-y-12">
        {filteredProjects.map((project) => {
          const currentIdx = activeImageIdx[project.id] ?? 0;
          const currentImg = project.images[currentIdx] || project.images[0];
          const isSpecsOpen = !!showSpecs[project.id];

          return (
            <article key={project.id} className="w-full">
              {/* Project Identification Header Bar — Matches Selected Top Filter Button Color Across All Projects */}
              <div
                className={`w-full ${selectedFilterTheme.barBg} ${selectedFilterTheme.barText} text-[0.80rem] sm:text-[0.85rem] tracking-cad uppercase py-2.5 px-5 rounded-[9px] font-light mb-3.5 flex items-center justify-between transition-colors duration-300 select-none`}
              >
                <span>
                  {project.title} — {project.code}
                </span>
                <span className="hidden sm:inline opacity-85 text-[0.72rem]">
                  {project.category}
                </span>
              </div>

              {/* Main Proposal Frame Container — 1px Outline Matching Selected Top Filter Button Color */}
              <div
                className={`w-full bg-white text-black p-5 sm:p-7 rounded-[9px] border ${selectedFilterTheme.borderColor} transition-colors duration-300 space-y-5`}
              >
                {/* Top Sub-bar: Solid Colored Image Title Pill & Image Sheet Buttons Matching Project Title Color */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    className={`inline-block ${selectedFilterTheme.barBg} ${selectedFilterTheme.barText} text-[0.72rem] tracking-cad uppercase py-2 px-4 rounded-[9px] border ${selectedFilterTheme.borderColor} font-light transition-colors duration-300 select-none`}
                  >
                    {project.materials}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {project.images.map((img, idx) => {
                      const isSheetActive = !isSpecsOpen && currentIdx === idx;
                      return (
                        <button
                          key={img.src}
                          type="button"
                          onClick={() => setSheetIndex(project.id, idx)}
                          className={`text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border transition-all font-light cursor-pointer ${
                            isSheetActive
                              ? `${selectedFilterTheme.barBg} ${selectedFilterTheme.barText} ${selectedFilterTheme.borderColor}`
                              : `bg-white text-black ${selectedFilterTheme.borderColor} hover:opacity-80`
                          }`}
                        >
                          {img.sheetNumber}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() =>
                        setShowSpecs((prev) => ({ ...prev, [project.id]: !prev[project.id] }))
                      }
                      className={`text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border transition-all font-light cursor-pointer ${
                        isSpecsOpen
                          ? `${selectedFilterTheme.barBg} ${selectedFilterTheme.barText} ${selectedFilterTheme.borderColor}`
                          : `bg-white text-black ${selectedFilterTheme.borderColor} hover:opacity-80`
                      }`}
                    >
                      SPEC SHEET
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setLightboxState({ project, imageIndex: currentIdx, showSpecs: isSpecsOpen })
                      }
                      className={`text-[0.70rem] tracking-cad uppercase px-3 py-2 rounded-[9px] border ${selectedFilterTheme.borderColor} bg-white text-black ${selectedFilterTheme.hoverBg} ${selectedFilterTheme.hoverText} transition-all font-light cursor-pointer flex items-center gap-1.5`}
                      title="Open High-Resolution Fullscreen Viewer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span className="hidden md:inline">FULLSCREEN</span>
                    </button>
                  </div>
                </div>

                {/* High-Resolution Lazy-Loaded Visual Stage */}
                {!isSpecsOpen ? (
                  <div className="w-full space-y-4">
                    <div
                      className={`relative w-full bg-white rounded-[9px] border ${selectedFilterTheme.borderColor} overflow-hidden flex flex-col items-center justify-center group transition-colors duration-300`}
                    >
                      <div
                        onClick={() =>
                          setLightboxState({ project, imageIndex: currentIdx })
                        }
                        className={`w-full cursor-zoom-in flex items-center justify-center overflow-hidden ${
                          currentImg.type === 'cad'
                            ? 'p-4 sm:p-8 bg-white'
                            : 'bg-white'
                        }`}
                      >
                        <LazyPortfolioImage
                          src={currentImg.src}
                          alt={currentImg.alt}
                          aspectClassName={
                            currentImg.type === 'cad'
                              ? 'aspect-[2660/1865] max-h-[620px]'
                              : 'aspect-[3070/1434] max-h-[620px]'
                          }
                          className="w-full h-full object-contain select-none"
                        />
                      </div>

                      {/* Left / Right Arrows on Image Stage */}
                      {project.images.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setSheetIndex(
                                project.id,
                                currentIdx === 0 ? project.images.length - 1 : currentIdx - 1
                              )
                            }
                            aria-label="Previous sheet"
                            className={`absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-[9px] bg-white/95 ${selectedFilterTheme.hoverBg} ${selectedFilterTheme.hoverText} text-black border ${selectedFilterTheme.borderColor} flex items-center justify-center transition-all cursor-pointer shadow-sm`}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSheetIndex(
                                project.id,
                                currentIdx === project.images.length - 1 ? 0 : currentIdx + 1
                              )
                            }
                            aria-label="Next sheet"
                            className={`absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-[9px] bg-white/95 ${selectedFilterTheme.hoverBg} ${selectedFilterTheme.hoverText} text-black border ${selectedFilterTheme.borderColor} flex items-center justify-center transition-all cursor-pointer shadow-sm`}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Thumbnail Strip for Multi-Sheet Projects — Outlined with Project Title Color */}
                    {project.images.length > 1 && (
                      <div
                        className={`w-full px-5 py-3.5 rounded-[9px] border ${selectedFilterTheme.borderColor} bg-white flex items-center justify-between gap-4 overflow-x-auto transition-colors duration-300`}
                      >
                        <div className="flex items-center gap-2.5">
                          {project.images.map((thumb, idx) => {
                            const isSelected = currentIdx === idx;
                            return (
                              <button
                                key={thumb.src}
                                type="button"
                                onClick={() => setSheetIndex(project.id, idx)}
                                className={`relative rounded-[9px] overflow-hidden border ${selectedFilterTheme.borderColor} transition-all cursor-pointer shrink-0 ${
                                  isSelected
                                    ? `ring-2 ${selectedFilterTheme.ringColor} opacity-100`
                                    : 'opacity-65 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={thumb.src}
                                  alt={thumb.alt}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-20 sm:w-24 h-12 sm:h-14 object-cover bg-white"
                                  referrerPolicy="no-referrer"
                                />
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-[0.80rem] font-light tracking-[0.015em] text-black/80 hidden md:inline whitespace-nowrap">
                          {currentImg.label}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Spec Sheet Table View */
                  <div className="bg-white">
                    <div
                      className={`border ${selectedFilterTheme.borderColor} rounded-[9px] overflow-hidden`}
                    >
                      <div
                        className={`${selectedFilterTheme.barBg} ${selectedFilterTheme.barText} px-5 py-3 text-[0.76rem] tracking-cad uppercase font-light flex items-center justify-between`}
                      >
                        <span>ARCHITECTURAL MATERIAL &amp; JOINERY SCHEDULE — {project.code}</span>
                        <span>{project.dimensions}</span>
                      </div>
                      <div className="divide-y divide-black/15 bg-white">
                        {project.specs.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-4 sm:px-6 sm:py-4 grid grid-cols-1 sm:grid-cols-3 gap-2"
                          >
                            <span className="text-[0.72rem] tracking-cad uppercase text-black/75">
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

                {/* Project Description Box — Outlined with Project Title Color */}
                <div
                  className={`w-full px-8 sm:px-14 py-6 rounded-[9px] border ${selectedFilterTheme.borderColor} bg-white text-center transition-colors duration-300`}
                >
                  <p className="max-w-2xl mx-auto text-[0.92rem] sm:text-[0.98rem] text-black/85 font-light leading-relaxed tracking-[0.015em]">
                    {project.description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Fullscreen High-Resolution Zoomable Modal */}
      <CadModal
        project={lightboxState.project}
        initialImageIndex={lightboxState.imageIndex}
        initialShowSpecs={lightboxState.showSpecs}
        onClose={() => setLightboxState({ project: null, imageIndex: 0, showSpecs: false })}
      />
    </section>
  );
};
