import React from 'react';

export const Capabilities: React.FC = () => {
  const pillars = [
    {
      code: '01',
      title: 'ARCHITECTURAL',
      headerBg: 'bg-[#CBCBCB]',
      headerText: 'text-black font-medium',
      borderClass: 'border-[#CBCBCB]',
      items: [
        'Custom alcove & living room cabinetry',
        'Integrated window benches & drawers',
        'Wet bars & fluted tambour islands',
        'Library walls, pole wraps & mouldings',
      ],
    },
    {
      code: '02',
      title: 'HEIRLOOM FURNITURE',
      headerBg: 'bg-[#EF6922]',
      headerText: 'text-white font-medium',
      borderClass: 'border-[#EF6922]',
      items: [
        'Solid hardwood dining & conference tables',
        'Credenzas, consoles & sideboards',
        'Custom lathe-turned legs & profiles',
        'One-of-a-kind heirloom commissions',
      ],
    },
    {
      code: '03',
      title: 'COMMERCIAL & SPATIAL',
      headerBg: 'bg-[#27AAE0]',
      headerText: 'text-white font-medium',
      borderClass: 'border-[#27AAE0]',
      items: [
        'Reception desks & lobby installations',
        'Acoustic slatted hardwood partitions',
        'Hospitality, bar & restaurant millwork',
        'Custom retail displays & fixtures',
      ],
    },
    {
      code: '04',
      title: 'MATERIALS & JOINERY',
      headerBg: 'bg-[#FDCB33]',
      headerText: 'text-black font-medium',
      borderClass: 'border-[#FDCB33]',
      items: [
        'Select Black Walnut & Rift White Oak',
        'Exposed finger-joint & dovetail casework',
        'Custom fluted & tambour millwork',
        'Bauhaus color-blocking & natural oils',
      ],
    },
  ];

  return (
    <section
      id="capabilities"
      aria-label="Studio Capabilities, Materials, and Joinery"
      className="mb-12 scroll-mt-24"
    >
      {/* Top Pitch Black Section Bar (ALL CAPS) */}
      <div className="w-full bg-black text-white text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-normal mb-3.5 select-none">
        STUDIO CAPABILITIES, MATERIALS &amp; JOINERY
      </div>

      {/* Introductory 1px Outlined Box — Trimmed, Centered, Generous Padding */}
      <div className="w-full bg-white text-black px-8 sm:px-16 py-7 sm:py-8 rounded-[9px] border border-black mb-6 text-center">
        <p className="max-w-2xl mx-auto text-[0.95rem] sm:text-[1.02rem] font-light leading-relaxed tracking-[0.02em] text-black/90">
          From single heirloom pieces to full-room architectural millwork, every commission is
          modeled in 3D CAD and crafted from raw lumber in Omaha.
        </p>
      </div>

      {/* 4-Column Color-Coded Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {pillars.map((pillar) => (
          <article
            key={pillar.code}
            aria-label={`${pillar.code} / ${pillar.title}`}
            className="flex flex-col"
          >
            {/* Solid Rounded Header Pill (ALL CAPS) */}
            <div
              className={`w-full ${pillar.headerBg} ${pillar.headerText} text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center mb-2.5 select-none whitespace-nowrap flex items-center justify-center`}
            >
              {pillar.code} / {pillar.title}
            </div>

            {/* 1px Outlined Spec List Box — Clean Sentence Case & Airy Padding */}
            <div
              className={`flex-1 bg-white text-black px-6 py-6 sm:px-7 sm:py-7 rounded-[9px] border ${pillar.borderClass} flex flex-col justify-center`}
            >
              <ul className="space-y-3">
                {pillar.items.map((item) => (
                  <li
                    key={item}
                    className="text-[0.88rem] font-light leading-relaxed tracking-[0.015em] text-black/85 flex items-start gap-2.5"
                  >
                    <span className="text-black/75 select-none">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
