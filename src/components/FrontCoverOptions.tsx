import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import { ProposedPageId } from './ProposedStudio.tsx';
import {
  MortiseWallController,
  MortiseWallToolbar,
  PillarColorKey,
} from './MortiseWallSystem.tsx';

interface FrontCoverOptionsProps {
  onNavigate: (page: ProposedPageId) => void;
  wall: MortiseWallController;
}

export const FrontCoverOptions: React.FC<FrontCoverOptionsProps> = ({
  onNavigate,
  wall,
}) => {
  const triggerPillarAccent = (
    pillar: PillarColorKey,
    el: HTMLElement | null
  ) => {
    if (el && typeof window !== 'undefined') {
      const rect = el.getBoundingClientRect();
      wall.setActivePillar(pillar, {
        x: (rect.left + rect.width * 0.5) / Math.max(1, window.innerWidth),
        y: (rect.top + rect.height * 0.5) / Math.max(1, window.innerHeight),
      });
    } else {
      wall.setActivePillar(pillar, { x: 0.5, y: 0.58 });
    }
  };

  return (
    <section
      id="hero-center-stack"
      aria-label="casegoods — handcrafted in omaha"
      className="w-full max-w-[780px] mx-auto py-4 sm:py-6 flex flex-col gap-4 sm:gap-5"
    >
      {/* 1. Full-Width Logo (No Outline — Scaled to Line Up Flush with the Lower Text Bubble Edges) */}
      <div className="w-full ui-surface">
        <img
          src={ASSETS.brand.logoFull}
          srcSet={ASSETS.brand.logoFullSrcSet}
          sizes="(max-width: 780px) 100vw, 780px"
          width={1560}
          height={368}
          decoding="sync"
          fetchPriority="high"
          alt="casegoods — maker of things"
          className="w-full h-auto block select-none"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* 2. Full-Width Thin Black Divider Line */}
      <div
        className="w-full h-[1px] bg-black"
        aria-hidden="true"
      />

      {/* 3. Full-Width Black Statement Box (Lowercase White Single-Line Scaled Text) */}
      <div className="@container ui-surface w-full bg-black text-white border-[1.5px] border-black rounded-[9px] py-4 sm:py-5 px-3 sm:px-5 text-center overflow-hidden flex items-center justify-center">
        <h1 className="w-full text-[3.55cqw] font-light tracking-[0.025em] lowercase text-white leading-none whitespace-nowrap select-none">
          we make the things that have never been made before
        </h1>
      </div>

      {/* 4. 3-Column Flush Bauhaus Entry Doors (Aligned to the Same Left & Right Edges) */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('methodology')}
          onMouseEnter={(e) => triggerPillarAccent('01', e.currentTarget)}
          onFocus={(e) => triggerPillarAccent('01', e.currentTarget)}
          className="ui-surface bg-[#EF6922] text-black border border-black rounded-[9px] p-4 sm:px-4 sm:py-4 flex items-center justify-between text-left hover:bg-black hover:text-white transition-colors cursor-pointer group"
        >
          <div>
            <div className="text-[0.62rem] tracking-cad uppercase font-medium opacity-80">
              01 / DESIGN &amp; METHODOLOGY
            </div>
            <div className="text-[0.80rem] tracking-cad uppercase font-medium mt-0.5">
              ENTER STUDIO
            </div>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('work')}
          onMouseEnter={(e) => triggerPillarAccent('02', e.currentTarget)}
          onFocus={(e) => triggerPillarAccent('02', e.currentTarget)}
          className="ui-surface bg-[#27AAE0] text-black border border-black rounded-[9px] p-4 sm:px-4 sm:py-4 flex items-center justify-between text-left hover:bg-black hover:text-white transition-colors cursor-pointer group"
        >
          <div>
            <div className="text-[0.62rem] tracking-cad uppercase font-medium opacity-80">
              02 / SELECTED WORK
            </div>
            <div className="text-[0.80rem] tracking-cad uppercase font-medium mt-0.5">
              3D RENDERS &amp; 2D CAD
            </div>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('visualizer')}
          onMouseEnter={(e) => triggerPillarAccent('06', e.currentTarget)}
          onFocus={(e) => triggerPillarAccent('06', e.currentTarget)}
          className="ui-surface bg-[#FDCB33] text-black border border-black rounded-[9px] p-4 sm:px-4 sm:py-4 flex items-center justify-between text-left hover:bg-black hover:text-white transition-colors cursor-pointer group"
        >
          <div>
            <div className="text-[0.62rem] tracking-cad uppercase font-medium opacity-80">
              06 / CONCEPT VISUALIZER
            </div>
            <div className="text-[0.80rem] tracking-cad uppercase font-medium mt-0.5">
              BUILD YOUR IDEA
            </div>
          </div>
          <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      {/* 5. Compact Bauhaus Modular Wall Toolbar */}
      <MortiseWallToolbar controller={wall} />
    </section>
  );
};
