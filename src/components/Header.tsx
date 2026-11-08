import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { ASSETS } from '../assets/index.ts';

export type StudioPageId =
  | 'methodology'
  | 'capabilities'
  | 'work'
  | 'process'
  | 'trade'
  | 'inquire';

export interface StudioPageMeta {
  id: StudioPageId;
  code: string;
  shortLabel: string;
  fullTitle: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  hoverBg: string;
  hoverText: string;
}

export const STUDIO_PAGES: StudioPageMeta[] = [
  {
    id: 'methodology',
    code: '01',
    shortLabel: '01 / METHODOLOGY',
    fullTitle: 'STUDIO METHODOLOGY — CAD TO CRAFT',
    activeBg: 'bg-[#CBCBCB]',
    activeText: 'text-black font-medium',
    activeBorder: 'border-[#CBCBCB]',
    hoverBg: 'hover:bg-[#CBCBCB]',
    hoverText: 'hover:text-black',
  },
  {
    id: 'capabilities',
    code: '02',
    shortLabel: '02 / CAPABILITIES',
    fullTitle: 'CAPABILITIES, MATERIALS & JOINERY',
    activeBg: 'bg-black',
    activeText: 'text-white font-normal',
    activeBorder: 'border-black',
    hoverBg: 'hover:bg-black',
    hoverText: 'hover:text-white',
  },
  {
    id: 'work',
    code: '03',
    shortLabel: '03 / PORTFOLIO',
    fullTitle: 'SELECTED WORK, 3D RENDERINGS & 2D CAD',
    activeBg: 'bg-[#EF6922]',
    activeText: 'text-white font-medium',
    activeBorder: 'border-[#EF6922]',
    hoverBg: 'hover:bg-[#EF6922]',
    hoverText: 'hover:text-white',
  },
  {
    id: 'process',
    code: '04',
    shortLabel: '04 / PROCESS',
    fullTitle: 'CUSTOM DESIGN & BUILD EXPERIENCE',
    activeBg: 'bg-[#FDCB33]',
    activeText: 'text-black font-medium',
    activeBorder: 'border-[#FDCB33]',
    hoverBg: 'hover:bg-[#FDCB33]',
    hoverText: 'hover:text-black',
  },
  {
    id: 'trade',
    code: '05',
    shortLabel: '05 / TRADE PARTNERS',
    fullTitle: 'ARCHITECTS, DESIGNERS & BUILDERS',
    activeBg: 'bg-[#27AAE0]',
    activeText: 'text-white font-medium',
    activeBorder: 'border-[#27AAE0]',
    hoverBg: 'hover:bg-[#27AAE0]',
    hoverText: 'hover:text-white',
  },
  {
    id: 'inquire',
    code: '06',
    shortLabel: '06 / INQUIRE',
    fullTitle: 'COMMISSION A BUILD / PROJECT INQUIRY',
    activeBg: 'bg-black',
    activeText: 'text-white font-normal',
    activeBorder: 'border-black',
    hoverBg: 'hover:bg-black',
    hoverText: 'hover:text-white',
  },
];

interface HeaderProps {
  activePage: StudioPageId;
  onSelectPage: (page: StudioPageId) => void;
  onReturnHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  onSelectPage,
  onReturnHome,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const hoverOpenedAtRef = useRef<number>(0);
  const currentPageMeta =
    STUDIO_PAGES.find((p) => p.id === activePage) || STUDIO_PAGES[0];

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

  return (
    <header ref={headerRef} className="relative z-40 bg-white pt-6 sm:pt-8 mb-7">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Desktop 3-Column Architectural Header — Flush with Content Below & Equidistant Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_240px] lg:grid-cols-[260px_1fr_260px] items-center gap-6">
          {/* Left Column (Navigation Stack with Hover + Click Dropdown on Top Button) */}
          <div className="hidden md:flex flex-col gap-3.5">
            {/* Master 6-Page Studio Index Switcher */}
            <div
              className="relative w-full z-50"
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
                className={`w-full ${currentPageMeta.activeBg} ${currentPageMeta.activeText} ${currentPageMeta.activeBorder} text-[0.76rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border hover:opacity-90 transition-all cursor-pointer text-center whitespace-nowrap flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]`}
              >
                <span>STUDIO INDEX {currentPageMeta.code}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu Revealing Each Section Button */}
              {menuOpen && (
                <div className="absolute left-0 top-full pt-2 w-full z-50">
                  <div className="bg-white border border-black rounded-[9px] p-2.5 shadow-xl flex flex-col gap-2">
                    {STUDIO_PAGES.map((page) => {
                      const isActive = activePage === page.id;
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => {
                            onSelectPage(page.id);
                            setMenuOpen(false);
                          }}
                          className={`w-full py-2.5 px-3.5 rounded-[9px] text-[0.72rem] tracking-cad uppercase transition-all cursor-pointer text-center border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922] ${
                            page.id === 'inquire'
                              ? isActive
                                ? `${page.activeBg} ${page.activeText} ${page.activeBorder}`
                                : `bg-white text-black font-normal ${page.activeBorder} ${page.hoverBg} ${page.hoverText}`
                              : isActive
                                ? `bg-white text-black font-medium ${page.activeBorder}`
                                : `${page.activeBg} ${page.activeText} ${page.activeBorder} hover:opacity-90`
                          }`}
                        >
                          {page.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (onReturnHome) {
                  onReturnHome();
                } else {
                  onSelectPage('methodology');
                }
              }}
              className="w-full bg-white text-black text-[0.74rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border border-black hover:bg-black hover:text-white transition-all cursor-pointer text-center font-normal whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
            >
              ← HOME COVER
            </button>
          </div>

          {/* Center Column: Scaled Up Logo to Fit the Center Space Between Button Stacks */}
          <div className="flex justify-center items-center">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (onReturnHome) {
                  onReturnHome();
                } else {
                  onSelectPage('methodology');
                }
              }}
              className="inline-flex items-center justify-center group focus:outline-none w-full"
              aria-label="casegoods — handcrafted in omaha (Return to Home Cover)"
              title="Return to Home Cover"
            >
              <img
                src={ASSETS.brand.logoFull}
                alt="casegoods — handcrafted in omaha"
                className="h-20 sm:h-24 md:h-[100px] lg:h-[114px] w-auto max-w-full object-contain select-none transition-transform duration-300 group-hover:scale-[1.01]"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>

          {/* Right Column: Inquire Stack */}
          <div className="hidden md:flex flex-col gap-3.5">
            <button
              type="button"
              onClick={() => onSelectPage('inquire')}
              className="w-full bg-black text-white text-[0.78rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border border-black hover:bg-black/85 active:scale-[0.99] transition-all cursor-pointer text-center font-normal whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
            >
              COMMISSION A BUILD
            </button>
            <div className="w-full bg-white text-black text-[0.74rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border border-black text-center font-normal select-none whitespace-nowrap">
              OMAHA, NEBRASKA
            </div>
          </div>

          {/* Mobile Navigation Bar with Dropdown Menu */}
          <div className="flex md:hidden flex-col gap-2.5 pt-1 relative z-50">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (onReturnHome) {
                    onReturnHome();
                  } else {
                    onSelectPage('methodology');
                  }
                }}
                className="shrink-0 bg-white text-black text-[0.68rem] sm:text-[0.72rem] tracking-cad uppercase py-2.5 px-3 rounded-[9px] border border-black hover:bg-black hover:text-white transition-all cursor-pointer text-center font-normal whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
              >
                ← HOME
              </button>
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                onClick={() => setMenuOpen((prev) => !prev)}
                className={`flex-1 min-w-0 ${currentPageMeta.activeBg} ${currentPageMeta.activeText} ${currentPageMeta.activeBorder} text-[0.68rem] sm:text-[0.72rem] tracking-cad uppercase py-2.5 px-2.5 sm:px-3 rounded-[9px] border text-center whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]`}
              >
                <span className="truncate">STUDIO INDEX {currentPageMeta.code}</span>
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
                  onSelectPage('inquire');
                }}
                className="shrink-0 bg-black text-white text-[0.68rem] sm:text-[0.72rem] tracking-cad uppercase py-2.5 px-3 rounded-[9px] border border-black hover:bg-black/85 transition-all cursor-pointer text-center font-normal whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
              >
                INQUIRE
              </button>
            </div>

            {menuOpen && (
              <div className="bg-white border border-black rounded-[9px] p-2.5 shadow-xl flex flex-col gap-2">
                {STUDIO_PAGES.map((page) => {
                  const isActive = activePage === page.id;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => {
                        onSelectPage(page.id);
                        setMenuOpen(false);
                      }}
                      className={`w-full py-2.5 px-3.5 rounded-[9px] text-[0.72rem] tracking-cad uppercase transition-all cursor-pointer text-center border whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922] ${
                        page.id === 'inquire'
                          ? isActive
                            ? `${page.activeBg} ${page.activeText} ${page.activeBorder}`
                            : `bg-white text-black font-normal ${page.activeBorder} ${page.hoverBg} ${page.hoverText}`
                          : isActive
                            ? `bg-white text-black font-medium ${page.activeBorder}`
                            : `${page.activeBg} ${page.activeText} ${page.activeBorder} hover:opacity-90`
                      }`}
                    >
                      {page.shortLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
