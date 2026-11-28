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

      {!compact && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.68rem] tracking-cad uppercase text-black/80 font-normal">
          <span>OMAHA, NEBRASKA</span>
          <span aria-hidden="true">·</span>
          <a
            href="tel:+14028308782"
            className="hover:text-[#EF6922] transition-colors"
          >
            402-830-8782
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="mailto:josh@casegoodsomaha.com"
            className="hover:text-[#EF6922] transition-colors"
          >
            JOSH@CASEGOODSOMAHA.COM
          </a>
        </div>
      )}

      {/* Mobile Business Card Action */}
      <div>
        <a
          href="/card"
          className="inline-block px-3 py-1 rounded-[9px] bg-white/92 backdrop-blur-[4px] border border-black/40 hover:border-black hover:bg-[#FDCB33] text-black text-[0.62rem] tracking-cad uppercase font-light transition-colors"
        >
          MOBILE BUSINESS CARD &amp; QR →
        </a>
      </div>
    </footer>
  );
};


