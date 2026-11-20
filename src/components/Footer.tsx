import React from 'react';
import { ASSETS } from '../assets/index.ts';

export const Footer: React.FC = () => {
  return (
    <footer className="ui-surface mt-14 pb-16 flex flex-col items-center justify-center gap-6 text-center px-4">
      {/* Centered 4-Icon Brand Strip (Chair, Cabinet, Tree Ring, Lightning Bolt) */}
      <div className="w-full max-w-[360px] flex items-center justify-center select-none">
        <img
          src={ASSETS.brand.brandIconsBc}
          alt="casegoods signature icons — furniture, cabinetry, solid timber, and studio craft"
          className="w-full h-auto block object-contain"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Studio Location & Attribution */}
      <div className="space-y-1 text-black/80 text-[0.72rem] tracking-cad uppercase font-light">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>casegoods</span>
          <span aria-hidden="true">•</span>
          <span>josh heinke</span>
          <span aria-hidden="true">•</span>
          <a
            href="tel:+14027201377"
            className="hover:text-[#EF6922] underline-offset-4 hover:underline transition-colors"
          >
            402-720-1377
          </a>
          <span aria-hidden="true">•</span>
          <a
            href="mailto:casegoodsne@gmail.com"
            className="hover:text-[#EF6922] underline-offset-4 hover:underline transition-colors"
          >
            casegoodsne@gmail.com
          </a>
        </div>
        <div className="text-[0.68rem] text-black/75">
          handcrafted in omaha, nebraska • architectural built-ins &amp; custom furniture
        </div>
      </div>
    </footer>
  );
};
