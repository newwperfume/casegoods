import React from 'react';
import { ASSETS } from '../assets/index.ts';

interface TradePartnersProps {
  onNavigateInquire?: () => void;
}

export const TradePartners: React.FC<TradePartnersProps> = ({ onNavigateInquire }) => {
  const deliverables = [
    {
      label: '01 / 2D RHINO CAD SHOP DRAWINGS',
      headerBg: 'bg-[#CBCBCB]',
      headerText: 'text-black font-medium',
      borderClass: 'border-[#CBCBCB]',
      detail:
        'Dimensioned elevation, section, and plan sheets with fractional callouts ready for client and builder sign-off.',
    },
    {
      label: '02 / PHOTOREALISTIC 3D PROPOSALS',
      headerBg: 'bg-black',
      headerText: 'text-white font-medium',
      borderClass: 'border-black',
      detail:
        'High-resolution 3D renderings showing exact hardwood species, fluting profiles, and color-blocked finishes prior to milling.',
    },
    {
      label: '03 / SEAMLESS ON-SITE COORDINATION',
      headerBg: 'bg-[#EF6922]',
      headerText: 'text-white font-medium',
      borderClass: 'border-[#EF6922]',
      detail:
        'Direct coordination with Omaha contractors, electricians, and plumbers for blocking, tolerances, and white-glove installation.',
    },
  ];

  return (
    <section id="trade" className="mb-12 scroll-mt-24">
      {/* Top Cerulean Blue Section Bar (ALL CAPS) */}
      <div className="w-full bg-[#27AAE0] text-white text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium mb-3.5 select-none">
        FOR ARCHITECTS, INTERIOR DESIGNERS &amp; CUSTOM HOME BUILDERS
      </div>

      {/* Main Outlined Trade Partner Sheet — Generous Outer & Inner Padding */}
      <div className="w-full bg-white border border-[#27AAE0] rounded-[9px] p-7 sm:p-11">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left 7 Columns: Trade Value Proposition & Deliverables */}
          <div className="lg:col-span-7 space-y-5">
            <h3 className="text-[1.05rem] sm:text-[1.15rem] font-normal tracking-[0.02em] text-black leading-snug">
              Partner with an Omaha fabricator who speaks architectural CAD.
            </h3>
            <p className="max-w-xl text-[0.92rem] sm:text-[0.98rem] text-black/80 font-light leading-relaxed tracking-[0.015em]">
              We collaborate with interior designers, architects, and custom builders—providing
              complete technical submittals so you and your clients can approve every detail with
              confidence.
            </p>

            <div className="space-y-4 pt-1">
              {deliverables.map((item) => (
                <div key={item.label} className="space-y-2">
                  <div
                    className={`w-full ${item.headerBg} ${item.headerText} text-[0.74rem] sm:text-[0.78rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center select-none`}
                  >
                    {item.label}
                  </div>
                  <div
                    className={`w-full px-6 py-4 rounded-[9px] border ${item.borderClass} bg-white text-center sm:text-left`}
                  >
                    <p className="text-[0.88rem] text-black/85 font-light leading-relaxed tracking-[0.015em]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigateInquire && onNavigateInquire()}
                className="bg-[#FDCB33] text-black text-[0.76rem] tracking-cad uppercase py-3 px-6 rounded-[9px] border border-[#FDCB33] hover:bg-[#FDCB33]/90 transition-all cursor-pointer text-center font-medium"
              >
                SUBMIT FLOOR PLANS OR DRAWINGS
              </button>
              <a
                href="mailto:josh@casegoodsomaha.com?subject=Trade%20%2F%20Architectural%20Collaboration%20Inquiry"
                className="bg-white text-black text-[0.76rem] tracking-cad uppercase py-3 px-6 rounded-[9px] border border-[#FDCB33] hover:bg-[#FDCB33]/10 transition-all text-center font-normal"
              >
                EMAIL JOSH@CASEGOODSOMAHA.COM
              </a>
            </div>
          </div>

          {/* Right 5 Columns: Technical CAD Section Preview Card */}
          <div className="lg:col-span-5 border border-[#27AAE0] rounded-[9px] overflow-hidden bg-white">
            <div className="bg-[#27AAE0] text-white px-4 py-2.5 text-[0.70rem] tracking-cad uppercase font-medium flex items-center justify-between">
              <span>SAMPLE TRADE SUBMITTAL — 1070MCG</span>
              <span className="text-white/90">SECTION B1</span>
            </div>
            <div className="p-5 bg-white flex items-center justify-center">
              <img
                src={ASSETS.kidsKitchen.sectionB1}
                alt="Sample Rhino 2D CAD Section & Plumbing Submittal"
                loading="lazy"
                decoding="async"
                className="w-full h-auto max-h-[290px] object-contain select-none"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="px-4 py-2.5 border-t border-[#27AAE0] bg-[#FAFAFA] text-[0.80rem] font-light tracking-[0.015em] text-black/75 text-center">
              Dimensioned elevation, section &amp; plumbing clearances
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
