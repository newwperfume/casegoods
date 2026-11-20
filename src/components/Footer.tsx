import React from 'react';
import { ASSETS } from '../assets/index.ts';

interface FooterProps {
  showBrandIcons?: boolean;
  compact?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  showBrandIcons = false,
  compact = false,
}) => {
  return (
    <footer
      className={`${
        compact ? 'mt-2 pt-2 pb-5' : 'mt-14 pb-16'
      } ui-surface flex flex-col items-center justify-center gap-5 text-center select-none px-4`}
    >
      {showBrandIcons && (
        <div className="w-full max-w-[360px] flex items-center justify-center select-none">
          <img
            src={ASSETS.brand.brandIconsBc}
            alt="casegoods signature icons — furniture, cabinetry, solid timber, and studio craft"
            className="w-full h-auto block object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Studio Location & Attribution */}
      <div
        className={`${
          compact
            ? 'bg-white/92 backdrop-blur-[4px] px-4 py-2 rounded-[9px]'
            : ''
        } space-y-1.5 text-black/80 text-[0.70rem] tracking-cad uppercase font-light`}
      >
        <div>casegoods • josh heinke • 402-720-1377 • casegoodsne@gmail.com</div>
        <div className="text-[0.66rem] text-black/75">
          handcrafted in omaha, nebraska • architectural built-ins &amp; custom furniture
        </div>
        <div className="pt-0.5">
          <a
            href="/card"
            className="inline-block px-3 py-1 rounded-[9px] border border-black/40 hover:border-black hover:bg-[#FDCB33] text-black text-[0.62rem] tracking-cad uppercase transition-colors"
          >
            MOBILE BUSINESS CARD &amp; QR →
          </a>
        </div>
      </div>
    </footer>
  );
};


