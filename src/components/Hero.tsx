import React, { useState } from 'react';
import { ASSETS } from '../assets/index.ts';

interface HeroProps {
  onNavigateInquire?: () => void;
}

type HeroViewMode = 'split' | 'cad' | 'render';

export const Hero: React.FC<HeroProps> = ({ onNavigateInquire }) => {
  const [heroView, setHeroView] = useState<HeroViewMode>('split');

  return (
    <section aria-label="Studio Overview and Methodology" className="mb-12">
      {/* Primary Section Bar: Architectural Grey (#CBCBCB) (ALL CAPS, font-medium for contrast) */}
      <div className="w-full bg-[#CBCBCB] text-black text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium mb-3.5 select-none">
        DESIGN-DRIVEN CUSTOM FURNITURE • ARCHITECTURAL MILLWORK • COMMERCIAL &amp; RESIDENTIAL DESIGN
      </div>

      {/* 1px Architectural Grey (#CBCBCB) Outlined Studio Statement */}
      <div className="w-full bg-white text-black px-8 sm:px-16 py-7 sm:py-9 rounded-[9px] border border-[#CBCBCB] mb-7 text-center">
        <p className="max-w-2xl mx-auto text-[0.95rem] sm:text-[1.05rem] font-light leading-relaxed tracking-[0.02em] text-black/90">
          One-of-a-kind residential, commercial, and architectural commissions handcrafted in Omaha.
          We thrive on engineering and building pieces that have never been built before.
        </p>
      </div>

      {/* Standalone Solid Black Rounded Header Bar — White Text */}
      <div
        id="methodology"
        className="scroll-mt-28 w-full bg-black text-white text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium mb-3.5 select-none"
      >
        STUDIO METHODOLOGY — FROM 2D RHINO CAD TO HANDCRAFTED REALITY
      </div>

      {/* 1px Black Outlined Container Box */}
      <article
        aria-label="Technical CAD Drawings and Photorealistic Proposals"
        className="w-full bg-white text-black p-6 sm:p-8 rounded-[9px] border border-black mb-7"
      >
        {/* Full-Width Solid Orange (#EF6922) Rounded Title Bar — Centered Text */}
        <div className="w-full bg-[#EF6922] text-white border border-[#EF6922] text-[0.72rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium select-none transition-colors duration-300">
          TECHNICAL CAD DRAWINGS &amp; PHOTOREALISTIC PROPOSALS
        </div>

        {/* Viewport Content */}
        {heroView === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 bg-white">
            {/* Left Pane: 2D Rhino CAD Shop Drawing */}
            <article
              aria-label="Dimensioned Rhino 2D CAD Shop Drawings"
              className="flex flex-col justify-between gap-4 pt-5 bg-white"
            >
              {/* Image Viewport */}
              <div className="flex-1 flex items-center justify-center">
                <img
                  src={ASSETS.kidsKitchen.elevationA1}
                  alt="Rhino 2D CAD Elevation Shop Drawing with Fractional Callouts"
                  fetchPriority="high"
                  loading="eager"
                  className="w-full h-auto max-h-[340px] object-contain rounded-[9px] border border-[#27AAE0] p-2 bg-white select-none transition-colors duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Bottom Caption Box — Outlined in Blue when Split Comparison is Selected */}
              <div className="w-full bg-white text-black px-6 py-4 rounded-[9px] border border-[#27AAE0] text-center transition-colors duration-300">
                <p className="max-w-md mx-auto text-[0.88rem] font-light leading-relaxed tracking-[0.015em] text-black/85">
                  Every joint, reveal, and spatial clearance dialed in prior to milling.
                </p>
              </div>
            </article>

            {/* Right Pane: View Switcher Buttons Centered Above 3D Proposal Rendering */}
            <article
              aria-label="3D Proposal and Bespoke Craft"
              className="flex flex-col justify-between gap-4 bg-white"
            >
              <div className="flex-1 flex flex-col">
                {/* Image Buttons Centered Between Title Block and Right Image */}
                <div
                  className="flex-1 flex flex-wrap items-center justify-center gap-2 py-4"
                  role="group"
                  aria-label="Methodology View Switcher"
                >
                  <button
                    type="button"
                    onClick={() => setHeroView('split')}
                    className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#27AAE0] transition-all cursor-pointer bg-[#27AAE0] text-white font-medium"
                  >
                    SPLIT COMPARISON
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroView('cad')}
                    className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#FDCB33] transition-all cursor-pointer bg-white text-black hover:bg-[#FDCB33] hover:text-black font-normal"
                  >
                    2D CAD
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeroView('render')}
                    className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#CBCBCB] transition-all cursor-pointer bg-white text-black hover:bg-[#CBCBCB] hover:text-black font-normal"
                  >
                    3D PROPOSAL
                  </button>
                </div>

                {/* Image Viewport */}
                <div className="flex items-center justify-center">
                  <img
                    src={ASSETS.familyRoom.sheet4JoineryDetail}
                    alt="3D Design Proposal showing exposed finger-jointed white oak and fluted walnut"
                    fetchPriority="high"
                    loading="eager"
                    className="w-full h-auto max-h-[340px] object-cover rounded-[9px] border border-[#27AAE0] select-none transition-colors duration-300"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Bottom Caption Box — Outlined in Blue when Split Comparison is Selected */}
              <div className="w-full bg-white text-black px-6 py-4 rounded-[9px] border border-[#27AAE0] text-center transition-colors duration-300">
                <p className="max-w-md mx-auto text-[0.88rem] font-light leading-relaxed tracking-[0.015em] text-black/85">
                  Visualize exact hardwood grain, fluting profiles, and proportions in your space.
                </p>
              </div>
            </article>
          </div>
        )}

        {heroView === 'cad' && (
          <article aria-label="Dimensioned Rhino 2D CAD Shop Drawings" className="flex flex-col gap-4">
            <div
              className="flex flex-wrap items-center justify-center gap-2 pt-4"
              role="group"
              aria-label="Methodology View Switcher"
            >
              <button
                type="button"
                onClick={() => setHeroView('split')}
                className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#27AAE0] transition-all cursor-pointer bg-white text-black hover:bg-[#27AAE0] hover:text-white font-normal"
              >
                SPLIT COMPARISON
              </button>
              <button
                type="button"
                onClick={() => setHeroView('cad')}
                className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#FDCB33] transition-all cursor-pointer bg-[#FDCB33] text-black font-medium"
              >
                2D CAD
              </button>
              <button
                type="button"
                onClick={() => setHeroView('render')}
                className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#CBCBCB] transition-all cursor-pointer bg-white text-black hover:bg-[#CBCBCB] hover:text-black font-normal"
              >
                3D PROPOSAL
              </button>
            </div>
            <div className="bg-white flex flex-col items-center justify-center">
              <img
                src={ASSETS.kidsKitchen.elevationA1}
                alt="Full Rhino 2D CAD Elevation Drawing"
                fetchPriority="high"
                loading="eager"
                className="w-full h-auto max-h-[480px] object-contain rounded-[9px] border border-[#FDCB33] p-4 sm:p-6 bg-white select-none transition-colors duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="w-full bg-white text-black px-8 py-5 rounded-[9px] border border-[#FDCB33] text-center transition-colors duration-300">
              <p className="max-w-2xl mx-auto text-[0.94rem] font-light leading-relaxed tracking-[0.02em] text-black/85">
                Every joint, reveal, and spatial clearance dialed in prior to milling.
              </p>
            </div>
          </article>
        )}

        {heroView === 'render' && (
          <article aria-label="3D Proposal and Bespoke Craft" className="flex flex-col gap-4">
            <div
              className="flex flex-wrap items-center justify-center gap-2 pt-4"
              role="group"
              aria-label="Methodology View Switcher"
            >
              <button
                type="button"
                onClick={() => setHeroView('split')}
                className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#27AAE0] transition-all cursor-pointer bg-white text-black hover:bg-[#27AAE0] hover:text-white font-normal"
              >
                SPLIT COMPARISON
              </button>
              <button
                type="button"
                onClick={() => setHeroView('cad')}
                className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#FDCB33] transition-all cursor-pointer bg-white text-black hover:bg-[#FDCB33] hover:text-black font-normal"
              >
                2D CAD
              </button>
              <button
                type="button"
                onClick={() => setHeroView('render')}
                className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-[#CBCBCB] transition-all cursor-pointer bg-[#CBCBCB] text-black font-medium"
              >
                3D PROPOSAL
              </button>
            </div>
            <div className="bg-white flex flex-col items-center justify-center">
              <img
                src={ASSETS.familyRoom.sheet3FlutedDetail}
                alt="Close-up of fluted American black walnut doors and custom turned wood pulls"
                fetchPriority="high"
                loading="eager"
                className="w-full h-auto max-h-[480px] object-contain rounded-[9px] border border-[#CBCBCB] bg-white select-none transition-colors duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="w-full bg-white text-black px-8 py-5 rounded-[9px] border border-[#CBCBCB] text-center transition-colors duration-300">
              <p className="max-w-2xl mx-auto text-[0.94rem] font-light leading-relaxed tracking-[0.02em] text-black/85">
                Visualize exact hardwood grain, fluting profiles, and proportions in your space.
              </p>
            </div>
          </article>
        )}
      </article>

      {/* Golden Yellow (#FDCB33) Accent Bar (ALL CAPS, font-medium for contrast) */}
      <div className="w-full bg-[#FDCB33] text-black text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium mb-3.5 select-none">
        PUSHING THE LIMITS OF DESIGN &amp; CRAFT
      </div>

      {/* 1px Golden Yellow (#FDCB33) Outlined Box — Concise Sentence Case with Wide Horizontal Margins */}
      <div className="w-full bg-white text-black px-8 sm:px-14 py-7 sm:py-8 rounded-[9px] border border-[#FDCB33] flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="max-w-xl text-[0.95rem] sm:text-[1.02rem] font-light leading-relaxed tracking-[0.02em] text-black/90 text-center md:text-left">
          Handcrafted from select raw timber in our Omaha studio—combining 3D Rhino CAD engineering
          with heirloom fine-furniture joinery.
        </p>
        <button
          type="button"
          onClick={() => onNavigateInquire && onNavigateInquire()}
          className="shrink-0 bg-[#FDCB33] text-black text-[0.76rem] tracking-cad uppercase py-3 px-6 rounded-[9px] border border-[#FDCB33] hover:bg-[#FDCB33]/90 active:scale-[0.98] transition-all cursor-pointer text-center whitespace-nowrap font-medium"
        >
          START A PROJECT INQUIRY
        </button>
      </div>
    </section>
  );
};
