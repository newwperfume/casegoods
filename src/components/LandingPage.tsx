import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import { STUDIO_PAGES } from './Header.tsx';

interface LandingPageProps {
  onEnterStudio: (targetSectionId?: string) => void;
}

type TeaserLens = 'joint' | 'grain' | 'line' | 'color';

interface LensData {
  id: TeaserLens;
  code: string;
  label: string;
  barColor: string;
  barText: string;
  borderColor: string;
  image: string;
  imageAlt: string;
  isCad?: boolean;
  hook: string;
  subHook: string;
  targetSection: string;
  ctaLabel: string;
}

const TEASER_LENSES: LensData[] = [
  {
    id: 'joint',
    code: '01 / THE JOINT',
    label: 'EXPOSED FINGER-JOINTED WHITE OAK',
    barColor: 'bg-[#EF6922]',
    barText: 'text-white font-medium',
    borderColor: 'border-[#EF6922]',
    image: ASSETS.familyRoom.sheet4JoineryDetail,
    imageAlt: 'Exposed finger-jointed white oak and custom fluted walnut joinery',
    hook: 'Where structural engineering becomes the visual signature.',
    subHook: 'Custom-milled White Oak meets hand-fluted American Black Walnut—designed and handcrafted in Omaha.',
    targetSection: 'work',
    ctaLabel: 'EXPLORE THE FULL COMMISSION →',
  },
  {
    id: 'grain',
    code: '02 / THE TEXTURE',
    label: 'DEEP-FLUTED BLACK WALNUT & TURNED PULLS',
    barColor: 'bg-[#27AAE0]',
    barText: 'text-white font-medium',
    borderColor: 'border-[#27AAE0]',
    image: ASSETS.familyRoom.sheet3FlutedDetail,
    imageAlt: 'Macro detail of fluted walnut doors and bespoke turned pulls',
    hook: 'Tactile shadow lines carved into solid domestic hardwood.',
    subHook: 'Every door profile, reveal, and solid-turned pull is shaped in-house to reward a closer look.',
    targetSection: 'capabilities',
    ctaLabel: 'INSPECT MATERIAL & JOINERY SPECS →',
  },
  {
    id: 'line',
    code: '03 / THE DRAWING',
    label: 'DIMENSIONED 2D RHINO SHOP DRAWINGS',
    barColor: 'bg-[#FDCB33]',
    barText: 'text-black font-medium',
    borderColor: 'border-[#FDCB33]',
    image: ASSETS.kidsKitchen.sectionB1,
    imageAlt: '2D Rhino CAD Section Shop Drawing with fractional tolerances',
    isCad: true,
    hook: 'Resolved to 1/32 of an inch before a single board is cut.',
    subHook: 'Every commission begins as a precision 2D & 3D Rhino model so nothing is left to guesswork.',
    targetSection: 'methodology',
    ctaLabel: 'SEE HOW CAD BECOMES CRAFT →',
  },
  {
    id: 'color',
    code: '04 / THE UNEXPECTED',
    label: 'TAMBOUR DOORS & COLOR-BLOCKED MILLWORK',
    barColor: 'bg-[#CBCBCB]',
    barText: 'text-black font-medium',
    borderColor: 'border-[#CBCBCB]',
    image: ASSETS.wetBar.sheet7ColorBlockedDrawers,
    imageAlt: 'Custom wet bar with tambour doors and Bauhaus color-blocked drawer fronts',
    hook: 'Furniture and millwork that refuses to blend into the wall.',
    subHook: 'Playful Bauhaus color blocking paired with retracting solid-wood tambour doors.',
    targetSection: 'work',
    ctaLabel: 'VIEW ALL STUDIO PROJECTS →',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterStudio }) => {
  const [activeLens, setActiveLens] = useState<TeaserLens>('joint');
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const hoverOpenedAtRef = useRef<number>(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleMenu = () => {
    if (menuOpen && Date.now() - hoverOpenedAtRef.current < 600) {
      hoverOpenedAtRef.current = 0;
      return;
    }
    setMenuOpen((prev) => !prev);
  };

  const currentLens =
    TEASER_LENSES.find((l) => l.id === activeLens) || TEASER_LENSES[0];

  return (
    <div className="min-h-screen bg-white text-black font-nexa antialiased flex flex-col selection:bg-[#EF6922] selection:text-white">
      {/* Shared Max-Width Container so Header Edges Align Pixel-for-Pixel with Studio Pages */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8 flex-1 flex flex-col">
        {/* Top Architectural Cover Bar — Equidistant Spacing (mb-7) to the Blue Section Below */}
        <header ref={headerRef} className="w-full mb-7 relative z-40">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_240px] lg:grid-cols-[260px_1fr_260px] items-center gap-6">
            {/* Left Top Button — Flush with Left Edge of Lower Boxes + Hover & Click Dropdown */}
            <div
              className="hidden md:flex items-center justify-start relative z-50"
              onMouseEnter={() => {
                if (!menuOpen) {
                  hoverOpenedAtRef.current = Date.now();
                  setMenuOpen(true);
                }
              }}
              onMouseLeave={() => {
                hoverOpenedAtRef.current = 0;
                setMenuOpen(false);
              }}
            >
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={handleToggleMenu}
                className="w-full bg-white text-black text-[0.76rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border border-black hover:bg-black hover:text-white transition-all cursor-pointer text-center font-normal whitespace-nowrap flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
              >
                <span>STUDIO INDEX</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {menuOpen && (
                <div className="absolute left-0 top-full pt-2 w-full z-50">
                  <div className="bg-white border border-black rounded-[9px] p-2.5 shadow-xl flex flex-col gap-2">
                    {STUDIO_PAGES.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => {
                          onEnterStudio(page.id);
                          setMenuOpen(false);
                        }}
                        className={`w-full py-2.5 px-3.5 rounded-[9px] text-[0.72rem] tracking-cad uppercase transition-all cursor-pointer text-center border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922] ${
                          page.id === 'inquire'
                            ? `bg-white text-black font-normal ${page.activeBorder} ${page.hoverBg} ${page.hoverText}`
                            : `${page.activeBg} ${page.activeText} ${page.activeBorder} hover:opacity-90`
                        }`}
                      >
                        {page.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Center Brand Lockup — Matching Scale with Studio Header */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => onEnterStudio()}
                className="group focus:outline-none cursor-pointer flex items-center justify-center"
                aria-label="Enter casegoods studio portfolio"
              >
                <img
                  src={ASSETS.brand.logoFull}
                  alt="casegoods — handcrafted in omaha"
                  className="h-20 sm:h-24 md:h-[100px] lg:h-[114px] w-auto object-contain select-none transition-transform duration-300 group-hover:scale-[1.01]"
                  referrerPolicy="no-referrer"
                />
              </button>
            </div>

            {/* Right Top Button — Flush with Right Edge of Lower Boxes */}
            <div className="hidden md:flex items-center justify-end">
              <button
                type="button"
                onClick={() => onEnterStudio('inquire')}
                className="w-full bg-black text-white text-[0.76rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border border-black hover:bg-black/85 transition-all cursor-pointer text-center font-normal whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
              >
                INQUIRE / COMMISSION
              </button>
            </div>

            {/* Mobile Top Buttons */}
            <div className="flex md:hidden flex-col gap-2.5 pt-1 relative z-50">
              <div className="flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex-1 bg-white text-black text-[0.70rem] sm:text-[0.72rem] tracking-cad uppercase py-2.5 px-3 rounded-[9px] border border-black text-center font-normal whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
                >
                  <span>STUDIO INDEX</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEnterStudio('inquire');
                  }}
                  className="flex-1 bg-black text-white text-[0.70rem] sm:text-[0.72rem] tracking-cad uppercase py-2.5 px-3 rounded-[9px] border border-black hover:bg-black/85 transition-all cursor-pointer text-center font-normal whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
                >
                  INQUIRE
                </button>
              </div>
              {menuOpen && (
                <div className="bg-white border border-black rounded-[9px] p-2.5 shadow-xl flex flex-col gap-2">
                  {STUDIO_PAGES.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        onEnterStudio(page.id);
                        setMenuOpen(false);
                      }}
                      className={`w-full py-2.5 px-3.5 rounded-[9px] text-[0.72rem] tracking-cad uppercase transition-all cursor-pointer text-center border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922] ${
                        page.id === 'inquire'
                          ? `bg-white text-black font-normal ${page.activeBorder} ${page.hoverBg} ${page.hoverText}`
                          : `${page.activeBg} ${page.activeText} ${page.activeBorder} hover:opacity-90`
                      }`}
                    >
                      {page.shortLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Focal Intrigue Portal */}
        <main className="flex flex-col">
          {/* 1. Cerulean Blue Statement Header Bar */}
          <div className="w-full bg-[#27AAE0] text-white text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium mb-3.5 select-none">
            WE BUILD THE PIECES THAT HAVE NEVER BEEN BUILT BEFORE
          </div>

          {/* 14px gap -> 1px Cerulean Blue Outlined Intrigue Box */}
          <div className="w-full bg-white text-black px-6 sm:px-14 py-6 sm:py-7 rounded-[9px] border border-[#27AAE0] mb-6 text-center">
            <p className="max-w-2xl mx-auto text-[0.96rem] sm:text-[1.06rem] font-light leading-relaxed tracking-[0.02em] text-black/90">
              Bespoke furniture, architectural millwork, and commercial &amp; residential cabinetry
              engineered in 3D CAD and handcrafted from raw timber in Omaha, Nebraska.
            </p>
          </div>

          {/* 2. Interactive Curiosity Showcase — Orange Brand Color Header Bar */}
          <div
            className="w-full bg-[#EF6922] text-white font-medium text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center mb-3.5 select-none"
          >
            CLOSER INSPECTION — {currentLens.label}
          </div>

          {/* 14px gap -> Matching 1px Outlined Interactive Reveal Container */}
          <div
            className="w-full bg-white text-black p-5 sm:p-7 rounded-[9px] border border-[#EF6922] mb-6"
          >
            {/* 4-Lens Selector Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
              {TEASER_LENSES.map((lens) => {
                const isSelected = lens.id === activeLens;
                return (
                  <button
                    key={lens.id}
                    onClick={() => setActiveLens(lens.id)}
                    className={`py-2.5 px-3 rounded-[9px] text-[0.72rem] tracking-cad uppercase transition-all cursor-pointer text-center border ${
                      isSelected
                        ? `${lens.barColor} ${lens.barText} ${lens.borderColor}`
                        : `bg-white text-black font-normal ${lens.borderColor} hover:opacity-80`
                    }`}
                  >
                    {lens.code}
                  </button>
                );
              })}
            </div>

            {/* Interactive Detail Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 items-center">
              {/* Visual Window — Clickable to enter studio */}
              <div
                onClick={() => onEnterStudio(currentLens.targetSection)}
                className={`group relative overflow-hidden rounded-[9px] border ${currentLens.borderColor} bg-white cursor-pointer flex items-center justify-center h-[260px] sm:h-[330px]`}
              >
                <img
                  key={currentLens.image}
                  src={currentLens.image}
                  alt={currentLens.imageAlt}
                  className={`w-full h-full ${
                    currentLens.isCad ? 'object-contain p-4' : 'object-cover'
                  } transition-transform duration-500 group-hover:scale-[1.03] select-none`}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-3 right-3 bg-black/90 text-white text-[0.68rem] tracking-cad uppercase py-1.5 px-3.5 rounded-[9px] font-medium opacity-95 group-hover:bg-[#EF6922] transition-colors">
                  CLICK TO INSPECT IN STUDIO →
                </div>
              </div>

              {/* Intrigue Hook & Portal Button */}
              <div className="flex flex-col justify-between gap-4 h-full">
                <div
                  className={`w-full bg-white text-black px-6 py-6 rounded-[9px] border ${currentLens.borderColor} flex-1 flex flex-col justify-center text-center lg:text-left`}
                >
                  <p className="text-[1.05rem] sm:text-[1.15rem] font-light leading-snug tracking-[0.02em] text-black mb-3">
                    {currentLens.hook}
                  </p>
                  <p className="text-[0.88rem] sm:text-[0.92rem] font-light leading-relaxed tracking-[0.015em] text-black/75">
                    {currentLens.subHook}
                  </p>
                </div>

                <button
                  onClick={() => onEnterStudio(currentLens.targetSection)}
                  className={`w-full ${currentLens.barColor} ${currentLens.barText} text-[0.76rem] tracking-cad uppercase py-3.5 px-5 rounded-[9px] border ${currentLens.borderColor} hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer text-center`}
                >
                  {currentLens.ctaLabel}
                </button>
              </div>
            </div>
          </div>

          {/* 3. Primary Full-Width Studio Entry Callout — Golden Yellow (#FDCB33) with AAA Black Text */}
          <div className="w-full bg-[#FDCB33] text-black text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium mb-3.5 select-none">
            STEP INSIDE THE OMAHA STUDIO
          </div>

          <div className="w-full bg-white text-black px-6 sm:px-10 py-6 rounded-[9px] border border-[#FDCB33] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[0.92rem] sm:text-[0.98rem] font-light leading-relaxed tracking-[0.02em] text-black/90 text-center sm:text-left">
              View multi-sheet 3D design proposals, fractional 2D Rhino shop drawings, and how to commission a build.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => onEnterStudio()}
                className="w-full sm:w-auto bg-black text-white text-[0.78rem] tracking-cad uppercase py-3.5 px-7 rounded-[9px] border border-black hover:bg-[#FDCB33] hover:border-[#FDCB33] hover:text-black active:scale-[0.99] transition-all cursor-pointer text-center font-medium whitespace-nowrap"
              >
                ENTER FULL STUDIO SITE →
              </button>
            </div>
          </div>
        </main>

        {/* Minimal Architectural Footer Strip */}
        <footer className="w-full py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[0.72rem] tracking-cad uppercase text-black/75 font-light">
            <span>CASEGOODS • HANDCRAFTED IN OMAHA, NEBRASKA</span>
            <span>JOSH HEINKE • MAKER OF THINGS • 402-830-8782</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
