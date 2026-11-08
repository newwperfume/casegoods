import React from 'react';
import { ASSETS } from '../assets/index.ts';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-14 pb-16 flex flex-col items-center justify-center gap-6 text-center select-none px-4">
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
      <div className="space-y-1 text-black/75 text-[0.72rem] tracking-cad uppercase font-light">
        <div>casegoods • josh heinke • 402-720-1377 • casegoodsne@gmail.com</div>
        <div className="text-[0.68rem] text-black/75">
          handcrafted in omaha, nebraska • architectural built-ins &amp; custom furniture
        </div>
      </div>
    </footer>
  );
};
