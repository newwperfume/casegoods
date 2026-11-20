import React from 'react';
import { ASSETS } from '../assets/index.ts';

/**
 * Exact Standalone Square CG Monogram Icon
 * Uses the high-resolution image asset from src/assets/logo_mark.png
 */
export const CgLogoMark: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 64,
}) => {
  return (
    <img
      src={ASSETS.brand.logoMark}
      alt="casegoods monogram mark"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`object-contain select-none ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

/**
 * Exact Full Horizontal Logo Lockup
 * Uses the high-resolution image asset from src/assets/logo_full.png
 */
export const FullLogo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={ASSETS.brand.logoFull}
        alt="casegoods — handcrafted in omaha"
        className="h-14 sm:h-16 md:h-[72px] w-auto object-contain select-none"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

/**
 * Exact 4 Studio Icons from src/assets/brand_icons_bc.png
 * (Chair, Casegoods Cabinet Elevation, Wood Log Grain Cross-Section, Bauhaus Orange Lightning Bolt)
 */
export const StudioIcons: React.FC<{ className?: string; variant?: 'business-card' | 'proposal' }> = ({
  className = '',
  variant = 'business-card',
}) => {
  const src =
    variant === 'proposal'
      ? ASSETS.brand.brandIconsPdf
      : ASSETS.brand.brandIconsBc;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={src}
        alt="casegoods studio icons — furniture, cabinetry, timber, craft"
        className="h-8 sm:h-10 w-auto object-contain select-none"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
