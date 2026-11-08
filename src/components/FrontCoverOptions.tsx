import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import { ProposedPageId } from './ProposedStudio.tsx';

interface FrontCoverOptionsProps {
  onNavigate: (page: ProposedPageId) => void;
}

export const FrontCoverOptions: React.FC<FrontCoverOptionsProps> = ({ onNavigate }) => {
  return (
    <section
      aria-label="casegoods — handcrafted in omaha"
      className="w-full bg-white border-[1.5px] border-black rounded-[9px] px-6 py-10 sm:px-12 sm:py-12 flex flex-col items-center justify-center gap-8 text-center"
    >
      {/* Centerpiece: Casegoods Logo + Core Statement */}
      <div className="max-w-3xl mx-auto flex flex-col items-center gap-7">
        <img
          src={ASSETS.brand.logoFull}
          alt="casegoods — handcrafted in omaha"
          className="h-28 sm:h-36 md:h-40 w-auto object-contain select-none"
          referrerPolicy="no-referrer"
        />

        {/* 3-Color Bauhaus Divider */}
        <div className="w-36 h-[3px] grid grid-cols-3 rounded-full overflow-hidden">
          <div className="bg-[#EF6922]" />
          <div className="bg-[#27AAE0]" />
          <div className="bg-[#FDCB33]" />
        </div>

        <div className="border border-black rounded-[9px] px-6 py-4 sm:px-10 sm:py-6 bg-black">
          <h1 className="text-[1.65rem] sm:text-[2.25rem] md:text-[2.65rem] font-light tracking-[0.025em] text-white leading-[1.2] text-balance">
            we make things that have never been made before.
          </h1>
        </div>

        <p className="text-[0.76rem] sm:text-[0.82rem] tracking-cad-wide uppercase text-black/70 font-light">
          handcrafted in omaha · custom furniture &amp; architectural millwork
        </p>
      </div>

      {/* Clean Entry Actions */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate('methodology')}
          className="bg-black text-white hover:bg-[#EF6922] hover:text-black text-[0.75rem] tracking-cad uppercase py-3.5 px-8 rounded-[9px] border border-black transition-colors cursor-pointer font-medium inline-flex items-center gap-2.5 whitespace-nowrap"
        >
          <span>ENTER STUDIO</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('work')}
          className="bg-white text-black hover:bg-[#27AAE0] hover:text-black text-[0.75rem] tracking-cad uppercase py-3.5 px-7 rounded-[9px] border border-black transition-colors cursor-pointer font-medium whitespace-nowrap"
        >
          SELECTED WORK
        </button>
      </div>
    </section>
  );
};
