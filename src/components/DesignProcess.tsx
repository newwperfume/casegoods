import React from 'react';

export const DesignProcess: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'CONSULTATION & CREATIVE VISION',
      colorBar: 'bg-[#CBCBCB]',
      borderBox: 'border-[#CBCBCB]',
      textColor: 'text-black font-medium',
      description:
        'Bring your space, floor plans, or a challenging custom concept. We collaborate across residential, commercial, and architectural projects of every scale.',
    },
    {
      step: '02',
      title: '3D CAD MODELING & SHOP DRAWINGS',
      colorBar: 'bg-[#EF6922]',
      borderBox: 'border-[#EF6922]',
      textColor: 'text-white font-medium',
      description:
        'Your idea is translated into photorealistic 3D renderings and dimensioned 2D Rhino line drawings so proportions and joinery are dialed in before a board is cut.',
    },
    {
      step: '03',
      title: 'MATERIAL SELECTION & FABRICATION',
      colorBar: 'bg-[#27AAE0]',
      borderBox: 'border-[#27AAE0]',
      textColor: 'text-white font-medium',
      description:
        'Handcrafted in our Omaha studio using select domestic hardwoods, precision machining, heirloom joinery, and zero-VOC natural oil finishes.',
    },
    {
      step: '04',
      title: 'DELIVERY & INSTALLATION',
      colorBar: 'bg-[#FDCB33]',
      borderBox: 'border-[#FDCB33]',
      textColor: 'text-black font-medium',
      description:
        'Careful transport and meticulous on-site installation, scribed and fitted seamlessly to your home or commercial space.',
    },
  ];

  return (
    <section
      id="process"
      aria-label="Our Custom Design and Build Experience"
      className="mb-12 scroll-mt-24"
    >
      {/* Top Black Section Bar (ALL CAPS) */}
      <div className="w-full bg-black text-white text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-normal mb-6 select-none">
        OUR CUSTOM DESIGN &amp; BUILD EXPERIENCE
      </div>

      {/* 4 Color-Coded Modular Rows */}
      <div className="space-y-5">
        {steps.map((item) => (
          <article key={item.step} aria-label={`${item.step} / ${item.title}`}>
            {/* Color Accent Bar (ALL CAPS) */}
            <div
              className={`w-full ${item.colorBar} ${item.textColor} text-[0.80rem] sm:text-[0.84rem] tracking-cad uppercase py-2.5 px-5 rounded-[9px] mb-2.5 text-center select-none`}
            >
              {item.step} / {item.title}
            </div>

            {/* 1px Outlined Content Container — Trimmed, Centered, Wide Horizontal Breathing Room */}
            <div
              className={`w-full bg-white text-black px-8 sm:px-16 py-6 sm:py-8 rounded-[9px] border ${item.borderBox} text-center`}
            >
              <p className="max-w-2xl mx-auto text-[0.94rem] sm:text-[1.0rem] font-light leading-relaxed tracking-[0.02em] text-black/85">
                {item.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
