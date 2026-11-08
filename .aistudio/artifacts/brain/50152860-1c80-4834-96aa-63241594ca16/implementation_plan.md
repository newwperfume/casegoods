# Casegoods Custom Concept Visualizer (3D Proposal & 2D CAD Generator)

Enable prospective clients, architects, and homeowners to describe a custom furniture or built-in millwork concept—and optionally upload a photo of their room or hand sketch—to generate an instant **3D Hardwood Proposal Rendering** or **2D Architectural CAD Elevation Sketch** powered by `gemini-nano-banana-2.1`, seamlessly carrying their concept into a commission inquiry for Josh Heinke.

### User Review & Critical Decisions

> [!IMPORTANT]
> The decisions below incorporate your confirmed preferences from our planning questions and preserve the existing 5-page Studio Index layout (`STUDIO INDEX 01`–`05`) and Bauhaus color system (`#EF6922` Orange, `#27AAE0` Blue, `#FDCB33` Yellow, `#CBCBCB` Grey, `#000000` Black).

- **Confirmed Decision 1 — Dual Placement (Page 01 & Page 05 with Shared State)**: The Custom Concept Visualizer will be accessible on **both Page 01 (`01 / DESIGN & METHODOLOGY`) and Page 05 (`05 / COMMISSION INQUIRY`)**. Any concept prompt, material choice, room photo, or generated rendering created on Page 01 automatically syncs to Page 05 so the customer never has to re-enter or regenerate their design when submitting an inquiry.
- **Confirmed Decision 2 — Dual Visual Representation Modes**: Customers can switch between two studio-authentic output modes:
  1. **3D Hardwood Proposal Render**: Photorealistic architectural millwork and fine furniture visualization showcasing grain direction, fluted profiles, finger-jointed corners, and natural oil finishes.
  2. **2D Rhino CAD Elevation Sketch**: Crisp architectural shop-drawing linework on a drafting sheet with orthographic proportions and technical dimension callouts.
- **Confirmed Decision 3 — Multimodal Room Photo / Sketch Upload + Text Prompting**: Customers can either generate a concept from scratch using text + material selectors, or upload a photo of their existing wall, alcove, or rough sketch so `gemini-nano-banana-2.1` visualizes the custom piece directly inside their space.

---

### 1. Overview & Core Concept

- **What It Does**: Provides an interactive architectural drafting & visualization studio block where visitors can test custom build ideas in real time, refine existing generated concepts with follow-up edits, download the resulting concept sheet, and attach it directly to their SMS or Email project inquiry.
- **Target Audience / Persona**: Homeowners envisioning custom built-ins or heirloom furniture, and interior designers, architects, or builders exploring early spatial concepts before commissioning formal Rhino 3D models and shop drawings.
- **Key Value**: Bridges the gap between a rough idea and a tangible commission—turning passive portfolio browsing into an interactive design consultation that gives Josh clear visual context when an inquiry arrives.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Concept Input & Material Selection**: On either Page 01 (`01 / DESIGN & METHODOLOGY`) or Page 05 (`05 / COMMISSION INQUIRY`), the visitor enters a description of their idea (e.g., *"Full-wall living room built-in with a white oak window bench and fluted walnut towers"*), selects a **Visual Output Style** (`3D Hardwood Render` or `2D CAD Elevation Sketch`), and picks optional studio signatures (**Primary Timber**: *American Black Walnut*, *Rift White Oak*, *Walnut + White Oak Mix*; **Detail Profile**: *Vertical Fluting*, *Exposed Finger-Joints*, *Tambour Doors*, *Bauhaus Color-Blocked Accents*, *Turned Legs/Pulls*).
  2. **Optional Room Photo / Sketch Upload**: The visitor can upload a photo of their room, alcove, or hand-drawn sketch. When provided, the visualizer uses image-to-image editing to integrate the custom furniture or built-in directly into their uploaded room photo or translate their sketch into a refined rendering.
  3. **Generation & Iterative Refinement**: Clicking **GENERATE CONCEPT PREVIEW** displays an architectural drafting progress state and renders the 16:9 concept sheet inside a framed CAD viewport. Visitors can type a quick refinement (e.g., *"Add brass foot rail and Bauhaus orange inner drawers"*) to iterate on the generated image, or click **FULLSCREEN** to inspect it in high resolution.
  4. **One-Click Carryover to Inquiry**: From Page 01, clicking **SEND CONCEPT TO COMMISSION INQUIRY (PAGE 05) →** switches to Page 05, pre-fills the inquiry form's project explanation with the concept specifications, and attaches the generated concept sheet so the customer can download/attach it and text or email Josh immediately.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Bauhaus architectural drafting sheet aesthetic matching Casegoods' signature `rounded-[9px]` and `border-2 border-black` structural geometry.
  - *Color Palette & Mood*: Crisp white drafting canvas (`#FFFFFF`), 2px solid black linework (`#000000`), CAD Grid backdrop (`cad-grid-bg`), and the studio's five architectural index colors (`#EF6922` Bauhaus Orange on Page 01, `#27AAE0` Fabrication Blue, `#FDCB33` Flex Yellow, `#CBCBCB` CAD Grey, and `#000000` Drafting Black on Page 05).
  - *Typography & Hierarchy*: `Nexa Light` (`font-nexa`) with `tracking-cad` (`0.14em`) uppercase title bars and clean, readable sentence-case descriptions and inputs.

- **Interactive Feedback & Motion**:
  - Blueprint grid skeleton loader during generation with clear elapsed status.
  - Instant mode toggles (`3D HARDWOOD RENDER` vs. `2D CAD ELEVATION SKETCH`) and clickable quick-prompt chips for inspiration.
  - High-contrast error banner with retry action if a generation request fails or requires API key selection.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Shared Visualizer State Across Page 01 and Page 05**
  - *Chosen Approach*: Lift the Concept Visualizer state (prompt, visual mode, selected wood species, joinery details, uploaded reference image, and generated concept history) into the parent studio state and pass it to a reusable visualizer module rendered in both Page 01 and Page 05.
  - *Why*: Because the website is separated into 5 distinct pages, a visitor who experiments with a concept on Page 01 shouldn't lose their generated image when they navigate to Page 05 to inquire.
  - *Alternatives Considered*: Keeping isolated state per page (rejected because it forces users to regenerate or re-upload when moving from Page 01 to Page 05).

- **Decision 2 — Server-Side Express Proxy for `@google/genai` (`gemini-nano-banana-2.1`)**
  - *Chosen Approach*: Run an Express server (`server.ts`) on port 3000 with Vite middleware mounted in development and a dedicated `/api/visualize-concept` POST endpoint that calls `ai.models.generateContent` with `model: 'gemini-nano-banana-2.1'`.
  - *Why*: Protects `process.env.GEMINI_API_KEY` on the server side, supports both text-to-image creation and multimodal image+text editing (for room photo uploads and iterative refinements), and delivers high-resolution `1K` 16:9 architectural visualizations.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ProposedStudio (Shared Studio State)                 │
│  • activePage: 'methodology' (01) .. 'inquire' (05)                     │
│  • visualizerState: { prompt, styleMode, wood, joinery,                 │
│                       roomPhotoBase64, generatedImages[], activeIdx }   │
└──────────────────┬───────────────────────────────────┬──────────────────┘
                   │                                   │
                   ▼                                   ▼
┌─────────────────────────────────────┐ ┌─────────────────────────────────┐
│   Page 01: Design & Methodology     │ │   Page 05: Commission Inquiry   │
│   (#EF6922 Bauhaus Orange Header)   │ │   (#000000 Drafting Black)      │
│  ┌───────────────────────────────┐  │ │  ┌───────────────────────────┐  │
│  │   ConceptVisualizer Studio    │  │ │  │ ConceptVisualizer Studio  │  │
│  │  • 3D Render / 2D CAD Toggle  │  │ │  │ • Attached Concept Preview│  │
│  │  • Wood & Joinery Selectors   │  │ │  │ • Live Refinement Input   │  │
│  │  • Room Photo / Sketch Upload │  │ │  └─────────────┬─────────────┘  │
│  │  • "Send to Page 05 Inquiry"  │  │ │                ▼                │
│  └───────────────┬───────────────┘  │ │  ┌───────────────────────────┐  │
└──────────────────┼──────────────────┘ │  │ Project Inquiry Form      │  │
                   │                    │  │ • Auto-populates Concept  │  │
                   │                    │  │   Specs & Download Sheet  │  │
                   │                    │  └───────────────────────────┘  │
                   └─────────────────┬──┴──────────────┘
                                     │
                                     ▼ POST /api/visualize-concept
┌─────────────────────────────────────────────────────────────────────────┐
│                 Express Server Proxy (/api/visualize-concept)           │
│  • GoogleGenAI SDK (process.env.GEMINI_API_KEY)                         │
│  • Model: 'gemini-nano-banana-2.1' (imageConfig: 16:9, 1K)              │
│  • Handles Text-to-Image & Image-to-Image (Room Photo / Refinement)     │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `ConceptVisualizerState`:
    - `ideaPrompt`: User's natural language description of the piece or space.
    - `visualStyle`: `'render-3d'` (Photorealistic 3D Hardwood Proposal) | `'cad-2d'` (2D Rhino CAD Elevation & Section Line Drawing).
    - `woodSpecies`: `'Black Walnut'` | `'Rift White Oak'` | `'Walnut & White Oak Mix'` | `'Hardwood + Bauhaus Color-Block'`.
    - `signatureDetail`: `'Vertical Fluting'` | `'Exposed Finger-Joints'` | `'Fluted Tambour Doors'` | `'Turned Stacked-Ball Legs'` | `'Clean Minimalist Miters'`.
    - `referenceImage`: Optional `{ name, mimeType, dataUrl, base64 }` for uploaded room photos or hand sketches.
    - `generatedHistory`: Array of generated concept items `{ id, imageUrl, style, summarySpec, timestamp }` so users can compare variations and download their concept sheet.

- **Interactive Component & State Mapping**:
  - **Style & Material Controls**: Clicking any style, wood species, or joinery button immediately updates `visualizerState` with active Bauhaus color highlighting.
  - **Room Photo Upload & Clear**: File input reads the user's room photo or sketch into a base64 data URL with thumbnail preview and one-click removal.
  - **Generate & Refine Handlers**: Sends the structured prompt + optional base64 image (either the uploaded room photo or the currently active generated image when refining) to `POST /api/visualize-concept`, appends the returned base64 image to `generatedHistory`, and syncs the concept summary with the Page 05 inquiry form.
  - **Carryover & Download**: Clicking "USE THIS CONCEPT IN INQUIRY" on Page 01 navigates to Page 05 (`inquire`), populates the project description with the selected wood/joinery/concept summary, and provides a one-click `DOWNLOAD CONCEPT SHEET (.PNG)` button alongside the SMS and Email dispatch triggers.
