# Casegoods — Architectural CAD & Readability Overhaul (With Live "Original vs. Proposed" Preview Toggle)

This plan refines the Casegoods web experience to eliminate multi-click navigation bottlenecks, enforce WCAG AA/AAA typographic contrast across the strict 6-color Bauhaus palette, replace repetitive "rainbow box-stacking" with unified CAD drafting frames, and includes a **Live Version Switcher (`Proposed Overhaul` ↔ `Original Layout`)** so you can toggle between the exact state where we left off and the new design in real time.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Zero-Risk Live Comparison Mode Included**: Because the preview browser only updates after a plan is approved, I have generated a visual UI mockup in chat **and** updated this plan so that clicking **Proceed** preserves 100% of your current components while adding a non-destructive **`VIEW: PROPOSED | ORIGINAL`** toggle bar. You will be able to flip back and forth live in the browser to compare every detail side-by-side.

- **Decision Gate 1 — Non-Destructive Live Comparison Toggle**: Preserves your existing `Cover Page + 6-Tab Studio Pager` intact under the `Original` toggle state while rendering the new cohesive single-scroll architectural layout under the `Proposed` state.
- **Decision Gate 2 — Structural Framing & 60-30-10 Color Discipline**: Replaces the alternating colored `1px` borders around every paragraph and form field with unified `2px solid #000000` (`border-2 border-black`) CAD sheet frames and clean internal hairline dividers, reserving `#EF6922` (01 Design), `#27AAE0` (02 Fabrication), and `#FDCB33` (03 Products/Contracting) strictly for section title blocks, pillar indicators, and active interactive controls.
- **Decision Gate 3 — WCAG Contrast & Ink Pairing**: Switches text on `#27AAE0` (Fabrication Blue) and `#EF6922` (Bauhaus Orange) title bars from low-contrast white (`2.68:1` and `3.15:1`) to `#000000` Drafting Black (`7.8:1` and `6.6:1`), ensuring every header bar, technical badge, and button passes WCAG AA/AAA legibility.

---

## Side-by-Side Visual Diff: Where We Left Off vs. Proposed Overhaul

```
CURRENT ("WHERE WE LEFT OFF")                       PROPOSED ARCHITECTURAL CAD OVERHAUL
═══════════════════════════════════════════════     ═══════════════════════════════════════════════
1. NAVIGATION & ENTRY FLOW
┌─────────────────────────────────────────────┐     ┌─────────────────────────────────────────────┐
│ Cover Gate (LandingPage)                    │     │ Unified 3-Zone Studio Header (Sticky)       │
│  └─ Requires click to enter Studio          │     │  [01 Work · 02 Specs · 03 Process · Inquire]│
│      └─ Drops into isolated 6-Tab Pager     │     ├─────────────────────────────────────────────┤
│         (Must click Next 6x to see site)    │     │ Direct Continuous Scroll:                   │
└─────────────────────────────────────────────┘     │  Hero Split → Portfolio → Specs → Inquire   │
                                                    └─────────────────────────────────────────────┘

2. HERO SPLIT COMPARISON GEOMETRY
┌─────────────────────────────────────────────┐     ┌─────────────────────────────────────────────┐
│ [Orange Bar: White Text (3.15:1 Low Contr.)]│     │ [Orange Bar: Crisp #000000 Ink (6.6:1 AA)]  │
│ ┌───────────────────┐ ┌───────────────────┐ │     │ [Toolbar: Split Comparison | 2D CAD | 3D ]  │
│ │                   │ │ [Split][2D][3D]   │ │     ├─────────────────────┬───────────────────────┤
│ │  2D CAD Image     │ ├───────────────────┤ │     │                     │                       │
│ │  (Higher Top Edge)│ │  3D Render Image  │ │     │   2D CAD Drawing    │   3D Proposal Render  │
│ │                   │ │  (Pushed Down!)   │ │     │   (Top & Bottom     │   (Top & Bottom       │
│ └───────────────────┘ └───────────────────┘ │     │    Edges Aligned)   │    Edges Aligned)     │
│ ┌───────────────────┐ ┌───────────────────┐ │     ├─────────────────────┴───────────────────────┤
│ │ Centered Caption  │ │ Centered Caption  │ │     │ DWG-1070MCG / 1064HEM · Left-Aligned Specs  │
│ └───────────────────┘ └───────────────────┘ │     └─────────────────────────────────────────────┘
└─────────────────────────────────────────────┘

3. CARD & BORDER HIERARCHY (60-30-10 RULE)
┌─────────────────────────────────────────────┐     ┌─────────────────────────────────────────────┐
│ [Blue Pill Bar — White Text (2.68:1 Fail)]  │     │ ┌─────────────────────────────────────────┐ │
│   (14px gap)                                │     │ │ #27AAE0 Pillar Header · #000000 Ink     │ │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │     │ ├─────────────────────────────────────────┤ │
│   1px Blue Border Box (Centered Prose)      │     │ │ 2px Solid #000000 Structural CAD Frame  │ │
│ │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│ │     │ │  • Left-aligned readable prose (65ch)   │ │
│     Nested 9px Box Inside 9px Box           │     │ │  • Clean 1px internal drafting dividers │ │
│ │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│ │     │ │  • Woodwork renders take center stage   │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │     │ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘     └─────────────────────────────────────────────┘
```

---

## 1. Overview & Core Concept

- **What It Does**: Showcases Casegoods' custom furniture, architectural millwork, and commercial/residential cabinetry handcrafted in Omaha, pairing photorealistic 3D design proposals with fractional 2D Rhino CAD shop drawings, a direct SMS/Email commission inquiry workflow, and a live comparison switcher between the original multi-tab layout and the proposed cohesive architectural layout.
- **Target Audience / Persona**: Homeowners commissioning heirloom furniture or full-room built-ins, plus residential architects, interior designers, and custom home builders in Omaha evaluating technical CAD submittal quality and fabrication capacity.
- **Key Value**: Proves engineering precision (`1/32"` Rhino CAD tolerances) alongside material warmth (fluted Black Walnut, finger-jointed Rift White Oak, Bauhaus color-blocked casework) without forcing visitors through repetitive navigation hurdles or competing decorative borders.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Live Design Comparison Toggle (`Proposed Overhaul` ↔ `Original Layout`)**: A compact floating CAD control bar in the bottom-right corner lets you switch instantaneously between **Where We Left Off (Original)** and **Proposed Overhaul** so you can inspect the exact differences on desktop and mobile.
  2. **Immediate Proof on Arrival (Unified Hero + CAD-to-Craft Stage)**: Visitors land directly on the studio header and an integrated split-comparison stage showing `1070MCG` 2D Rhino shop drawings beside `1064HEM` 3D joinery renders, with aligned view-switcher controls (`Split Comparison` · `2D Rhino CAD` · `3D Proposal`) positioned in a shared toolbar above both panes so both viewports align horizontally.
  3. **Multi-Sheet Portfolio Inspection (`01 / Selected Work`)**: Placed immediately below the hero so visitors reach full commissions (`1064HEM` Family Room Built-In, `1064HEM` Wet Bar & Fluted Tambour Island, `1070MCG` Kids Kitchen & Storage Wall) on their first scroll. Filtering by category updates the displayed projects cleanly without repainting every project card's border and header into a single chameleon color.
  4. **High-Resolution CAD & Render Lightbox**: Clicking any sheet or `Fullscreen` opens a studio sheet modal with interactive zoom (`75%`–`250%`), keyboard navigation (`←`, `→`, `ESC`), drawing metadata (`DWG-CG-1064HEM`, scale, tolerance), and a toggleable Material & Joinery Schedule.
  5. **Direct Commission Inquiry (`SMS` + `Email` + File Summary)**: A unified CAD title-block form where labels and inputs sit inside a clean structural grid rather than 8 separate rainbow boxes, formatting a complete project brief for one-click SMS or Email dispatch to Josh Heinke (`402-720-1377` / `casegoodsne@gmail.com`).

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Industrial Bauhaus / Architectural Rhino CAD Submittal Sheet—disciplined, tactile, and structural.
  - *Color Palette & 60-30-10 Distribution (Strict 6-Color System)*:
    - **60% Dominant Canvas**: Canvas White (`#FFFFFF`) with subtle `.cad-grid-bg` (`24px` architectural grid) in technical inspection zones.
    - **30% Structural Surfaces & Ink**: Drafting Black (`#000000`) for `2px` outer sheet frames, primary typography, and high-contrast primary bars; CAD Neutral Gray (`#CBCBCB`) for secondary structural dividers and inactive states.
    - **10% Three-Pillar Accent Budget**:
      - **01 / Design & 3D CAD**: Bauhaus Orange (`#EF6922`) with `#000000` ink.
      - **02 / Fabrication & Millwork**: Fabrication Blue (`#27AAE0`) with `#000000` ink.
      - **03 / Products, Contracting & Primary Callouts**: Flex Yellow (`#FDCB33`) with `#000000` ink.
  - *Typography & Hierarchy*:
    - **Primary Typeface**: `'Nexa Light'` (`/assets/NexaLight.ttf`) with geometric fallback.
    - **Casing & Alignment Discipline**: Reserve wide-tracked uppercase (`.tracking-cad` `0.14em`) strictly for section title blocks, drawing codes (`DWG-1064HEM`), and interactive buttons. Set all multi-line descriptions, capability lists, and project narratives in natural sentence case, left-aligned on desktop (`max-w-[65ch]`) for effortless scanning.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Including a Live "Original vs. Proposed" Switcher**
  - *Chosen Approach*: Keep all current components (`LandingPage` + 6-tab `Studio` view) accessible via a 1-click toggle bar while rendering the new streamlined architectural layout as the default preview.
  - *Why*: Gives you a true interactive before-and-after comparison on your actual screen and assets without losing any prior work.

- **Decision 2 — Replacing "Header Pill + Colored Outlined Box" Stacks with Unified CAD Sheet Frames**
  - *Chosen Approach*: Frame content sections in crisp `2px solid #000000` architectural sheets with integrated pillar-colored title blocks and internal `1px` drafting hairlines, removing the competing multi-color borders inside cards.
  - *Why*: Black structural linework acts as a neutral gallery mat that makes both the woodworking photography and the 3 pillar accent bars pop, while obeying concentric corner geometry.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     App Root (With Live Comparison Toggle)                 │
│     State: designMode ('proposed' | 'original'), activeSection, modal      │
└───────────────────┬───────────────────────────────────────┬────────────────┘
                    │                                       │
         (designMode === 'proposed')             (designMode === 'original')
                    │                                       │
                    ▼                                       ▼
┌───────────────────────────────────────────┐ ┌──────────────────────────────┐
│     Proposed Single-Scroll Studio         │ │   Original Layout Preserved  │
│ ───────────────────────────────────────── │ │ ──────────────────────────── │
│ • Clean 3-Zone Header + Section Jump Bar  │ │ • Cover Gate (LandingPage)   │
│ • Aligned 2-Col CAD & Render Split Stage  │ │ • 6-Tab Studio Pager         │
│   + 4 Material/Joinery Inspection Lenses  │ │ • Original Colored Borders   │
│ • Multi-Sheet Portfolio (Fixed Pillar     │ └──────────────────────────────┘
│   Themes + Spec Schedule + Lightbox)      │
│ • 4-Pillar Capabilities & Process Grid    │
│ • Trade Partner Submittal Sheet           │
│ • Unified CAD Title-Block Inquiry Form    │
│ • Interactive Business Card Footer        │
└───────────────────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - **Design Mode Switcher**: Toggles `designMode` between `'proposed'` and `'original'` at the top level of `App.tsx` so you can test both experiences side-by-side.
  - **Hero Split & Lens Controls**: Shared toolbar sits above the 2-column grid so switching between `Split Comparison`, `2D CAD`, and `3D Proposal` keeps top and bottom image edges aligned; clicking any of the 4 inspection lenses updates the highlighted detail callout or scrolls directly to the corresponding commission sheet.
  - **Portfolio Sheet & Spec Switcher**: Per-project state tracks `activeImageIdx[projectId]` and `showSpecs[projectId]`, keeping each project's native pillar color stable across filters and syncing with `CadModal`.
