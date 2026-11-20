import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { requireAuth, optionalAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  saveConceptToDb,
  getRecentConceptsFromDb,
  getUserConceptsFromDb,
  saveInquiryToDb,
  getUserInquiriesFromDb,
} from './src/db/users.ts';
import {
  listPublishedPortfolioProjects,
  listAllPortfolioProjects,
  createPortfolioProject,
  updatePortfolioProject,
  deletePortfolioProject,
  reorderPortfolioProjects,
} from './src/db/portfolio.ts';
import { DEFAULT_PORTFOLIO_PROJECTS } from './src/data/defaultProjects.ts';

dotenv.config();

const OWNER_EMAIL = 'jmheinke1@gmail.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_DIR = path.join(__dirname, 'public', 'generated-concepts');
const LOG_FILE = path.join(GENERATED_DIR, 'concepts-log.json');

function ensureGeneratedDir() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export interface LoggedConceptRecord {
  id: string;
  filename: string;
  publicPath: string;
  fullImageUrl: string;
  visualStyle: 'render-3d' | 'cad-2d';
  ideaPrompt: string;
  woodSpecies: string;
  designStyle: string;
  addedDetails?: string;
  summarySpec: string;
  createdAt: string;
  modelEngine?: string;
  emailedToOwner?: boolean;
}

function readConceptLog(): LoggedConceptRecord[] {
  ensureGeneratedDir();
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendConceptLog(record: LoggedConceptRecord) {
  const existing = readConceptLog();
  const updated = [record, ...existing].slice(0, 100);
  fs.writeFileSync(LOG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
}

async function dispatchConceptEmailToOwner(record: LoggedConceptRecord) {
  try {
    const response = await fetch('https://formsubmit.co/ajax/josh@casegoodsomaha.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _subject: `New Custom Concept Generated on casegoods: ${record.woodSpecies} (${record.designStyle})`,
        _template: 'table',
        Concept_ID: record.id,
        Created_At: record.createdAt,
        Render_Engine: record.modelEngine || 'Open-Source FLUX.1-schnell',
        Visual_Format:
          record.visualStyle === 'cad-2d' ? '2D CAD Elevation Sketch' : '3D Hardwood Proposal',
        Customer_Idea: record.ideaPrompt,
        Primary_Timber: record.woodSpecies,
        Design_Style: record.designStyle,
        Added_Details: record.addedDetails || 'Standard Studio Construction',
        Summary_Spec: record.summarySpec,
        Generated_Image_URL: record.fullImageUrl,
      }),
    });
    return response.ok;
  } catch (err) {
    console.warn('Automatic email dispatch warning:', err);
    return false;
  }
}

/**
 * Strict Visual Woodworking Timber & Material Specifications (with color locks & negative exclusions)
 */
function buildTimberConstraint(woodSpecies: string): string {
  const key = woodSpecies.trim().toLowerCase();
  if (key.includes('walnut')) {
    return 'PRIMARY MATERIAL — AMERICAN BLACK WALNUT: Rich, dark chocolate-espresso brown FAS heartwood walnut with dramatic dark-chocolate cathedral grain and hand-rubbed satin oil sheen. STRICT COLOR LOCK: Must be unmistakably dark chocolate brown walnut — strictly NOT pale blonde oak, NOT yellow maple, NOT reddish cherry.';
  }
  if (key.includes('white oak') || key.includes('oak')) {
    return 'PRIMARY MATERIAL — RIFT-SAWN WHITE OAK: Cool, pale raw wheat-straw / light champagne-blonde rift-sawn white oak with tight, straight vertical pencil grain and a dead-flat clear matte raw-wood finish. STRICT COLOR LOCK: Must be pale neutral blonde-straw oak — strictly NOT dark brown walnut, NOT orange-red cherry, NOT yellow honey oak.';
  }
  if (key.includes('maple')) {
    return 'PRIMARY MATERIAL — HARD WHITE SUGAR MAPLE: Very bright, pale creamy ivory-blonde hard sugar maple with ultra-smooth, quiet fine grain and clear waterborne matte finish. STRICT COLOR LOCK: Must be light creamy pale blonde wood — strictly NOT dark brown walnut, NOT medium oak, NOT amber cherry.';
  }
  if (key.includes('cherry')) {
    return 'PRIMARY MATERIAL — AMERICAN BLACK CHERRY: Warm reddish-cinnamon amber heartwood cherry with silky closed-pore grain and warm satin oil sheen. STRICT COLOR LOCK: Must be unmistakable warm reddish-amber cinnamon cherry — strictly NOT pale blonde oak/maple and NOT dark espresso walnut.';
  }
  if (key.includes('mahogany')) {
    return 'PRIMARY MATERIAL — GENUINE HONDURAS MAHOGANY: Deep rich reddish-auburn brown mahogany with lustrous straight ribbon-stripe grain and satin architectural finish. STRICT COLOR LOCK: Deep reddish-brown auburn mahogany — strictly NOT pale blonde wood.';
  }
  if (key.includes('ebonized') || key.includes('blackened') || key.includes('charred')) {
    return 'PRIMARY MATERIAL — EBONIZED / BLACKENED ASH OR OAK: Deep matte jet-black stained open-pore solid hardwood where subtle tactile wood grain texture remains visible under raking light, finished dead-flat matte black. STRICT COLOR LOCK: True matte charcoal-black wood — strictly NOT natural brown or blonde wood.';
  }
  if (key.includes('laminate')) {
    return 'PRIMARY MATERIAL — ARCHITECTURAL MATTE LAMINATE + BALTIC BIRCH PLY EDGES: Smooth ultra-matte solid architectural high-pressure laminate (HPL) cabinet faces (crisp architectural off-white, warm putty, or matte charcoal) with clearly visible exposed multi-ply striped pale Baltic Birch plywood edges along every door and panel reveal. STRICT MATERIAL LOCK: Must show smooth matte laminate faces with exposed layered birch plywood edges — NOT solid stained timber.';
  }
  return `PRIMARY MATERIAL — ${woodSpecies.toUpperCase()}: Authentic architectural-grade ${woodSpecies} with unmistakable true-to-species color, continuous matched grain, and hand-rubbed satin finish.`;
}

/**
 * Single Cabinetry / Joinery Detail Specification (with high visual salience & explicit exclusions)
 */
function buildSingleDetailConstraint(detail: string): string {
  const key = detail.trim().toLowerCase();
  if (!key) return '';
  if (key.includes('full overlay')) {
    return 'DOOR CONSTRUCTION — FULL OVERLAY SLAB DOORS: Completely frameless full-overlay flat slab doors and drawer fronts covering the entire front face edge-to-edge with ZERO visible face frame and razor-sharp uniform 1/16-inch black shadow reveals between panels.';
  }
  if (key.includes('flush inset')) {
    return 'DOOR CONSTRUCTION — FLUSH INSET WITH FACE FRAME: Every cabinet door and drawer front sits recessed completely flush INSIDE a clearly visible solid 3/4-inch hardwood outer face frame (stiles and rails framing every opening) with crisp uniform 1/16-inch perimeter shadow gaps.';
  }
  if (key.includes('pocket') || key.includes('retracting')) {
    return 'DOOR MECHANISM — RETRACTING POCKET DOORS: Tall solid hardwood doors slid partway back into concealed vertical side pockets along the left and right edges of the cabinet, clearly showcasing the fitted hardwood interior inside.';
  }
  if (key.includes('open cabinets') || key.includes('no doors')) {
    return 'OPEN SHELVING — STRICTLY NO DOORS: Every single bay and cubby across the entire piece is 100% open front-facing architectural shelving with thick 1-1/4-inch solid hardwood shelves and vertical dividers. STRICT EXCLUSION: ZERO cabinet doors anywhere on the piece.';
  }
  if (key.includes('tambour')) {
    return 'DOOR MECHANISM — SLIDING TAMBOUR DOORS: Clearly visible narrow 1/2-inch vertical solid hardwood tambour slats wrapping smoothly around curved/radiused cabinet corners, with one tambour door slid partway open to show the curved track.';
  }
  if (key.includes('glass-front') || key.includes('glass')) {
    return 'DOOR STYLE — GLASS-FRONT DISPLAY DOORS: Slim solid hardwood stile-and-rail frame doors fitted with crystal-clear low-iron transparent glass panes so the interior hardwood shelves behind the glass are clearly visible.';
  }
  if (key.includes('fluted') || key.includes('reeded')) {
    return 'SURFACE TEXTURE — DEEP VERTICAL FLUTED / REEDED PANELS: Every cabinet door and drawer face is covered edge-to-edge in bold, deep, CNC-carved semicircular vertical wood flutes/reeds casting crisp parallel vertical shadows across the entire front elevation — strictly NOT flat smooth slab doors.';
  }
  if (key.includes('louvered') || key.includes('slatted')) {
    return 'DOOR STYLE — HORIZONTAL LOUVERED / SLATTED DOORS: Every cabinet door is built from crisp, evenly spaced horizontal solid wood slats/louvers with dark shadow air gaps between every bar — strictly NOT solid flat slab panels.';
  }
  if (key.includes('dovetail')) {
    return 'DRAWER JOINERY — EXPOSED DOVETAIL DRAWERS: Show one solid wood drawer pulled partway open (about 6 inches) so precision interlocking angled dovetail joints along the solid hardwood drawer side are prominently visible in the photograph.';
  }
  if (key.includes('push-to-open') || key.includes('touch latch')) {
    return 'HARDWARE — HANDLELESS PUSH-TO-OPEN (ZERO HARDWARE): Completely clean, unbroken door and drawer faces with ZERO knobs, ZERO pulls, ZERO metal handles, and ZERO finger-pull cutouts anywhere on the entire piece.';
  }
  if (key.includes('turned hardwood pulls') || key.includes('turned')) {
    return 'HARDWARE — CUSTOM LATHE-TURNED SOLID WOOD PULLS: Prominent, tactile solid hardwood lathe-turned cylindrical/stacked wood pulls mounted cleanly on every door and drawer front. STRICT EXCLUSION: ZERO metal, brass, or black iron hardware pulls.';
  }
  if (key.includes('led')) {
    return 'LIGHTING — INTEGRATED WARM 2700K LED SHELF LIGHTING: Glowing recessed warm 2700K linear LED light strips milled flush into the underside of every upper shelf and cabinet bay, casting a clearly visible warm golden light graze downward across the hardwood back panel.';
  }
  if (key.includes('floating shelves')) {
    return 'SHELVING — THICK CANTILEVERED FLOATING SHELVES: Thick 2-inch solid hardwood floating shelves projecting cleanly from the wall/back panel with completely concealed brackets — ZERO visible corbels, ZERO metal brackets, ZERO vertical side supports beneath the shelves.';
  }
  if (key.includes('waterfall')) {
    return 'CASE CORNERS — 45-DEGREE WATERFALL MITRED EDGES: Continuous unbroken wood grain flowing seamlessly across the horizontal top and wrapping directly over razor-sharp 45-degree mitered waterfall corners straight down both vertical side panels to the floor.';
  }
  if (key.includes('finger') || key.includes('tenon')) {
    return 'CORNER JOINERY — EXPOSED BOX FINGER / THROUGH-TENON JOINTS: Prominent, unmistakably visible interlocking 3/4-inch square box finger-joints and exposed wedged through-tenons wrapping the outer case corners with alternating contrasting end-grain blocks as the signature architectural detail.';
  }
  return `CUSTOM MILLWORK DETAIL: Prominently feature "${detail.trim()}" executed with +/- 1/32-inch cabinetmaker precision so it is immediately unmistakable in the visual.`;
}

/**
 * Supports single or multiple (' + ' separated) cabinetry/joinery details
 */
function buildJoineryDetailConstraint(addedDetails: string): string {
  const parts = addedDetails
    .split(/\s*(?:\+|\||;)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return buildSingleDetailConstraint('Full Overlay Doors');
  }
  return parts.map((p, idx) => `${idx + 1}) ${buildSingleDetailConstraint(p)}`).join('\n');
}

/**
 * Complete Architectural Design Movement Specifications (all 10 UI styles explicitly defined)
 */
function buildStyleConstraint(designStyle: string): string {
  const key = designStyle.trim().toLowerCase();
  if (key.includes('bauhaus')) {
    return 'ARCHITECTURAL STYLE — BAUHAUS & COLOR-BLOCKED: Disciplined asymmetrical Bauhaus geometric grid divisions pairing the selected primary timber with bold, unmistakable solid-color matte drawer fronts or accent bays in Bauhaus Orange (#EF6922), Fabrication Blue (#27AAE0), and Golden Yellow (#FDCB33). Must clearly display geometric Bauhaus color-blocking integrated into the woodwork.';
  }
  if (key.includes('mid-century')) {
    return 'ARCHITECTURAL STYLE — MID-CENTURY MODERN: Authentic 1950s/60s Mid-Century Modern horizontal proportions with clean low-slung casework, slender tapered or gently splayed solid hardwood legs (or recessed shadow plinth), crisp chamfered outer edges, and unbroken horizontal grain matching. Strictly NO traditional crown molding or ornate trim.';
  }
  if (key.includes('minimalist') || key.includes('contemporary')) {
    return 'ARCHITECTURAL STYLE — MINIMALIST & CONTEMPORARY: Ultra-clean monolithic architectural geometry with razor-sharp 90-degree edges, completely flat uninterrupted planes, flush recessed shadow toe-kick, zero applied molding, zero decorative trim, and strict grid alignment.';
  }
  if (key.includes('scandinavian') || key.includes('organic')) {
    return 'ARCHITECTURAL STYLE — SCANDINAVIAN & ORGANIC: Light, airy Nordic furniture proportions featuring softly rounded/bullnosed wood edges, slender gently tapered round solid wood legs, gentle organic curves, and calm open negative space beneath the piece.';
  }
  if (key.includes('japandi')) {
    return 'ARCHITECTURAL STYLE — JAPANDI & EXPOSED JOINERY: Serene low-slung Japanese-Scandinavian architectural balance featuring delicate timber rhythm, recessed shadow reveals, visibly celebrated wood-on-wood mortise/tenon craft, and meditative calm symmetry.';
  }
  if (key.includes('shaker') || key.includes('traditional') || key.includes('transitional')) {
    return 'ARCHITECTURAL STYLE — TRADITIONAL & SHAKER: Classic crisp five-piece recessed flat-panel Shaker doors and drawer fronts with clean 2-1/4-inch stiles and rails, understated square-stepped base and crown trim, and timeless balanced symmetry — strictly NOT flat modern slab doors unless overridden.';
  }
  if (key.includes('art deco')) {
    return 'ARCHITECTURAL STYLE — ART DECO & FLUTED CURVES: Bold sculptural Art Deco geometry featuring sweeping curved/radiused waterfall ends, vertical fluted relief accents, stepped architectural symmetry, and refined dark bronze or satin brass plinth trim.';
  }
  if (key.includes('industrial')) {
    return 'ARCHITECTURAL STYLE — INDUSTRIAL & ARCHITECTURAL: Bold structural contrast pairing thick solid timber slabs/casework with matte blackened hot-rolled steel frame accents, dark steel leg supports or architectural steel reveal strips, and crisp workshop honesty.';
  }
  if (key.includes('rustic') || key.includes('live-edge')) {
    return 'ARCHITECTURAL STYLE — RUSTIC & LIVE-EDGE MODERN: Dramatic thick solid-wood live-edge slab top or front edge preserving natural organic waney tree contours, rich grain character, and inlaid contrasting wood butterfly/bowtie keys, grounded on clean modern architectural supports.';
  }
  if (key.includes('brutalist')) {
    return 'ARCHITECTURAL STYLE — ARCHITECTURAL BRUTALIST: Monolithic thick-slab hardwood geometry, deep carved relief shadows, heavy structural massing, and bold geometric blocks.';
  }
  return `ARCHITECTURAL STYLE — ${designStyle.toUpperCase()}: Faithfully express unmistakable ${designStyle} proportions, silhouette, edge profiles, and structural detailing throughout the entire piece.`;
}

interface SourceImagePayload {
  data: string;
  mimeType: string;
}

interface PreviousSpecsPayload {
  visualStyle?: 'render-3d' | 'cad-2d';
  woodSpecies?: string;
  designStyle?: string;
  addedDetails?: string;
}

const ALLOWED_INPUT_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const MAX_SOURCE_IMAGE_BASE64_LEN = 12 * 1024 * 1024; // ~9 MB raw image

function getGeminiApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return '';
  return key;
}

const CASEGOODS_GEMINI_SYSTEM_INSTRUCTION =
  'You are the architectural cabinetmaking and bespoke furniture visualization engine for casegoods (Omaha, Nebraska). ' +
  'Your #1 rule is 100% LITERAL ADHERENCE to every user-selected specification in the prompt: exact wood species/color, exact architectural style silhouette, and every selected door, drawer, hardware, lighting, and joinery detail. ' +
  'Never default to generic medium-brown wood when a specific timber (such as dark chocolate Black Walnut, pale straw White Oak, creamy blonde Maple, or reddish Cherry) is requested. ' +
  'Never add knobs or handles when handleless/push-to-open is requested. Never add doors when open cabinets/no doors is requested. ' +
  'When editing a room photo, preserve the room architecture, lighting, and perspective faithfully while installing the custom piece cleanly at accurate scale. ' +
  'When generating a 2D CAD drawing, produce strictly flat pure-black technical elevation linework on stark pure white paper with zero 3D perspective and zero photorealistic shading.';

/**
 * Primary Multimodal Image Engine: Google Gemini (Nano Banana 2.1 / 3.1 Flash Image / 2.5 Flash Image)
 * Supports true image-to-image room-photo compositing, hand-sketch translation, iterative refinement,
 * and 3D <-> 2D CAD conversion via @google/genai.
 */
async function generateWithGeminiImage(params: {
  prompt: string;
  sourceImage: SourceImagePayload | null;
  sourceImageMode: 'room-photo' | 'refine-concept';
}): Promise<{
  base64: string;
  mimeType: string;
  engine: string;
} | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const configuredModel = (process.env.GEMINI_IMAGE_MODEL || '').trim();
  const candidateModels = Array.from(
    new Set(
      [
        configuredModel,
        'gemini-nano-banana-2.1',
        'gemini-3.1-flash-image',
        'gemini-2.5-flash-image',
      ].filter(Boolean)
    )
  );

  const contents = params.sourceImage
    ? [
        {
          inlineData: {
            mimeType: params.sourceImage.mimeType,
            data: params.sourceImage.data,
          },
        },
        params.prompt,
      ]
    : params.prompt;

  for (const model of candidateModels) {
    try {
      const supportsImageSize = model !== 'gemini-2.5-flash-image';
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: CASEGOODS_GEMINI_SYSTEM_INSTRUCTION,
          temperature: 0.4,
          responseModalities: ['IMAGE'],
          imageConfig: supportsImageSize
            ? { aspectRatio: '16:9', imageSize: '1K' }
            : { aspectRatio: '16:9' },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData?.mimeType?.startsWith('image/')) {
          const modeTag = params.sourceImage
            ? params.sourceImageMode === 'room-photo'
              ? 'Room/Sketch Edit'
              : 'Iterative Refinement'
            : 'Studio Render';
          return {
            base64: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
            engine: `Gemini ${model} (${modeTag})`,
          };
        }
      }
      console.warn(`Gemini model ${model} returned no image part; trying next fallback.`);
    } catch (err) {
      console.warn(`Gemini model ${model} error:`, err instanceof Error ? err.message : err);
    }
  }

  return null;
}

function buildRefinementDiffs(
  previousSpecs: PreviousSpecsPayload | null,
  current: {
    visualStyle: 'render-3d' | 'cad-2d';
    woodSpecies: string;
    designStyle: string;
    addedDetails: string;
  }
): string[] {
  if (!previousSpecs) return [];
  const diffs: string[] = [];
  if (
    previousSpecs.woodSpecies &&
    previousSpecs.woodSpecies.trim().toLowerCase() !== current.woodSpecies.trim().toLowerCase()
  ) {
    diffs.push(
      `MANDATORY MATERIAL SWAP: Replace ALL wood/finish from "${previousSpecs.woodSpecies}" to "${current.woodSpecies}".`
    );
  }
  if (
    previousSpecs.designStyle &&
    previousSpecs.designStyle.trim().toLowerCase() !== current.designStyle.trim().toLowerCase()
  ) {
    diffs.push(
      `MANDATORY STYLE SWAP: Restyle the piece from "${previousSpecs.designStyle}" into unmistakable "${current.designStyle}" proportions and detailing.`
    );
  }
  if (
    previousSpecs.addedDetails &&
    previousSpecs.addedDetails.trim().toLowerCase() !== current.addedDetails.trim().toLowerCase()
  ) {
    diffs.push(
      `MANDATORY DETAIL SWAP: Replace the previous cabinetry/joinery details ("${previousSpecs.addedDetails}") with "${current.addedDetails}".`
    );
  }
  if (previousSpecs.visualStyle && previousSpecs.visualStyle !== current.visualStyle) {
    diffs.push(
      current.visualStyle === 'cad-2d'
        ? 'MANDATORY FORMAT CONVERSION: Convert this exact piece from a 3D render into a flat 2D orthographic black-and-white Rhino CAD front elevation drawing.'
        : 'MANDATORY FORMAT CONVERSION: Convert this exact 2D CAD elevation drawing into a photorealistic 3D architectural studio photograph.'
    );
  }
  return diffs;
}

function buildVisualizationPrompt(opts: {
  visualStyle: 'render-3d' | 'cad-2d';
  ideaPrompt: string;
  woodSpecies: string;
  designStyle: string;
  addedDetails: string;
  timberSpec: string;
  joinerySpec: string;
  styleSpec: string;
  refinementClause: string;
  refinementDiffs: string[];
  hasSourceImage: boolean;
  sourceImageMode: 'room-photo' | 'refine-concept';
}): string {
  const {
    visualStyle,
    ideaPrompt,
    woodSpecies,
    designStyle,
    addedDetails,
    timberSpec,
    joinerySpec,
    styleSpec,
    refinementClause,
    refinementDiffs,
    hasSourceImage,
    sourceImageMode,
  } = opts;

  const changeBlock =
    refinementDiffs.length > 0 || refinementClause
      ? [
          '=== MANDATORY REVISIONS TO APPLY (HIGHEST PRIORITY) ===',
          ...refinementDiffs,
          refinementClause,
        ]
          .filter(Boolean)
          .join('\n')
      : '';

  const checklistBlock = [
    '=== FINAL STRICT COMPLIANCE CHECKLIST (VERIFY EVERY ITEM BEFORE RENDERING) ===',
    `- Subject matches user description: "${ideaPrompt}"`,
    visualStyle === 'render-3d'
      ? `- Wood/Material visibly matches "${woodSpecies}" (exact color tone & grain, never substituted)`
      : '- Pure flat 2D black vector linework (#000000) on stark white paper (#FFFFFF), NO 3D perspective, NO color shading',
    `- Overall silhouette & details unmistakably reflect "${designStyle}"`,
    `- Every selected detail is clearly and prominently visible: ${addedDetails}`,
    '- Zero text watermarks, zero logos, zero room clutter or unrelated props.',
  ].join('\n');

  if (visualStyle === 'cad-2d') {
    const taskHeader =
      hasSourceImage && sourceImageMode === 'room-photo'
        ? 'TASK: Using the attached room photo or hand sketch strictly as the spatial/layout reference, draft a pure 2D orthographic front elevation architectural CAD shop drawing (Rhino 3D style) in crisp black technical ink (#000000) on stark pure white drafting paper (#FFFFFF).'
        : hasSourceImage && sourceImageMode === 'refine-concept'
        ? 'TASK: Translate/update the exact custom furniture or millwork design shown in the attached image into a pure 2D orthographic front elevation architectural CAD shop drawing (Rhino 3D style) in crisp black ink (#000000) on pure white paper (#FFFFFF), preserving its bay layout and applying all mandatory revisions below.'
        : 'TASK: Draft a pure 2D orthographic front elevation architectural CAD shop drawing (Rhino 3D style) in crisp black technical ink (#000000) on stark pure white drafting paper (#FFFFFF).';

    return [
      taskHeader,
      '',
      '=== SUBJECT ===',
      ideaPrompt,
      '',
      changeBlock,
      '',
      '=== MANDATORY ARCHITECTURAL STYLE ===',
      styleSpec,
      '',
      '=== MANDATORY CABINETRY, DOORS & JOINERY LINEWORK ===',
      joinerySpec,
      '',
      '=== CAD DRAFTING RULES ===',
      'Show crisp straight orthographic cabinet divisions, stile-and-rail profiles, joinery linework (fluting lines, tambour lines, finger-joints, or drawer reveals matching the selected details), section callout markers, and clean fractional inch dimension ticks. Strictly flat 2D vector linework: NO 3D perspective, NO wood color/photo texture, NO grey background, NO room scene.',
      '',
      checklistBlock,
    ]
      .filter((s) => s !== undefined && s !== '')
      .join('\n');
  }

  // 3D Photorealistic Studio or Room-Photo Composite Render
  const taskHeader =
    hasSourceImage && sourceImageMode === 'room-photo'
      ? 'TASK: Use the attached image as the direct architectural reference. If it is a photograph of a room, wall, or alcove, preserve the exact existing room walls, floor, windows, lighting, and camera perspective while seamlessly installing the specified custom hardwood furniture/millwork piece directly into the space at true physical scale with realistic contact shadows. If it is a hand-drawn sketch, preserve its exact layout and compartments and render it as a finished photorealistic studio piece.'
      : hasSourceImage && sourceImageMode === 'refine-concept'
      ? 'TASK: Edit the custom woodwork design shown in the attached image. Keep its core structure, silhouette, camera angle, and clean backdrop (or room setting if already in a room), while strictly applying ALL mandatory revisions and updated selections below.'
      : 'TASK: Create a sharp architectural studio photograph of a single bespoke handcrafted furniture or architectural millwork commission, shot on a 50mm tilt-shift lens at eye level, straight-on or gentle 3/4 view with strictly vertical plumb lines, centered against a clean smooth white architectural gallery wall and neutral floor with soft natural side daylight. Strictly NO clutter, NO plants, NO rugs, NO pillows, NO people.';

  return [
    taskHeader,
    '',
    '=== SUBJECT ===',
    ideaPrompt,
    '',
    changeBlock,
    '',
    '=== MANDATORY TIMBER / MATERIAL (DO NOT SUBSTITUTE) ===',
    timberSpec,
    '',
    '=== MANDATORY ARCHITECTURAL STYLE ===',
    styleSpec,
    '',
    '=== MANDATORY CABINETRY, DOORS & JOINERY DETAILS (MAKE UNMISTAKABLY VISIBLE) ===',
    joinerySpec,
    '',
    checklistBlock,
  ]
    .filter((s) => s !== undefined && s !== '')
    .join('\n');
}

/**
 * Primary Open-Source Image Generator: Black Forest Labs FLUX.1-schnell (Cloud Gradio Space API)
 * Configured at 1344x768 resolution and 8 inference steps for sharper joinery, grain, and straight lines.
 */
async function generateWithOpenSourceFluxSpace(prompt: string): Promise<{
  base64: string;
  mimeType: string;
  engine: string;
} | null> {
  const spaceBase = 'https://black-forest-labs-flux-1-schnell.hf.space';
  const callUrl = `${spaceBase}/gradio_api/call/infer`;
  const seed = Math.floor(Math.random() * 1000000);

  try {
    const initRes = await fetch(callUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // [prompt, seed, randomize_seed=false, width=1344, height=768, num_inference_steps=8]
        data: [prompt, seed, false, 1344, 768, 8],
      }),
    });

    if (!initRes.ok) return null;
    const initJson = (await initRes.json()) as { event_id?: string };
    if (!initJson.event_id) return null;

    const streamRes = await fetch(`${callUrl}/${initJson.event_id}`);
    if (!streamRes.ok) return null;

    const streamText = await streamRes.text();
    const lines = streamText.split('\n');
    let dataLine = '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        dataLine = line.slice(6).trim();
      }
    }

    if (!dataLine) return null;
    const parsed = JSON.parse(dataLine);
    const fileEntry = Array.isArray(parsed) ? parsed[0] : null;
    const imageUrl: string | undefined =
      fileEntry?.url ||
      (fileEntry?.path ? `${spaceBase}/gradio_api/file=${fileEntry.path}` : undefined);

    if (!imageUrl) return null;

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 2000) return null;

    const mimeType = imgRes.headers.get('content-type') || 'image/webp';
    return {
      base64: buffer.toString('base64'),
      mimeType,
      engine: 'Open-Source FLUX.1-schnell (8-Step HD)',
    };
  } catch (err) {
    console.warn('FLUX.1-schnell Space fallback notice:', err);
    return null;
  }
}

/**
 * Secondary Open-Source Image Generator: Pollinations Open-Source FLUX
 * Configured with enhance=false so woodworking & CAD constraints are never rewritten or diluted.
 */
async function generateWithPollinationsFlux(prompt: string): Promise<{
  base64: string;
  mimeType: string;
  engine: string;
} | null> {
  try {
    const seed = Math.floor(Math.random() * 1000000);
    const encoded = encodeURIComponent(prompt.slice(0, 1400));
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1344&height=768&nologo=true&enhance=false&seed=${seed}&model=flux`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 4000) return null;

    return {
      base64: buffer.toString('base64'),
      mimeType: contentType,
      engine: 'Open-Source FLUX (Strict Spec)',
    };
  } catch (err) {
    console.warn('Pollinations FLUX fallback notice:', err);
    return null;
  }
}

async function startServer() {
  ensureGeneratedDir();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  // Serve saved generated concept images statically so Josh can open or download any image directly via URL
  app.use('/generated-concepts', express.static(GENERATED_DIR));

  // Dedicated attachment download route so browser/iframe downloads always succeed
  app.get('/api/download-concept/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename || '');
    const filePath = path.join(GENERATED_DIR, safeName);
    if (!safeName || !fs.existsSync(filePath)) {
      res.status(404).send('Concept image file not found.');
      return;
    }
    res.download(filePath, `casegoods-${safeName}`);
  });

  // POST /api/save-watermarked-concept — Overwrites the server concept file with the Casegoods-watermarked sheet PNG
  app.post('/api/save-watermarked-concept', (req, res) => {
    try {
      const { filename, watermarkedDataUrl } = req.body || {};
      const safeName = path.basename(filename || '');
      if (!safeName || typeof watermarkedDataUrl !== 'string') {
        res.status(400).json({ error: 'Missing filename or watermarkedDataUrl' });
        return;
      }
      const match = watermarkedDataUrl.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Invalid data URL format' });
        return;
      }
      const filePath = path.join(GENERATED_DIR, safeName);
      fs.writeFileSync(filePath, Buffer.from(match[1], 'base64'));
      res.json({ ok: true });
    } catch (err) {
      console.warn('Unable to update watermarked server image:', err);
      res.status(500).json({ error: 'Failed to save watermarked image' });
    }
  });

  // Owner-only middleware for Private Studio Tools APIs
  const requireOwner = (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    requireAuth(req, res, () => {
      if (!req.user?.email || req.user.email.toLowerCase() !== OWNER_EMAIL) {
        res.status(403).json({ error: 'Forbidden: Studio owner access required.' });
        return;
      }
      next();
    });
  };

  // GET /api/projects — Public endpoint returning published portfolio projects
  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await listPublishedPortfolioProjects();
      res.json({ projects });
    } catch (error) {
      console.warn('Portfolio DB fallback notice:', error);
      res.json({ projects: DEFAULT_PORTFOLIO_PROJECTS });
    }
  });

  // GET /api/admin/projects — Owner-only list of all projects (published + drafts)
  app.get('/api/admin/projects', requireOwner, async (_req: AuthRequest, res) => {
    try {
      const projects = await listAllPortfolioProjects();
      res.json({ projects });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load studio projects';
      res.status(500).json({ error: message });
    }
  });

  // POST /api/admin/projects — Owner-only create project
  app.post('/api/admin/projects', requireOwner, async (req: AuthRequest, res) => {
    try {
      const body = req.body || {};
      if (!String(body.title || '').trim() || !String(body.code || '').trim()) {
        res.status(400).json({ error: 'Project title and job/DWG code are required.' });
        return;
      }

      const project = await createPortfolioProject({
        slug: typeof body.slug === 'string' ? body.slug : undefined,
        code: String(body.code),
        title: String(body.title),
        recipient: String(body.recipient || ''),
        category: String(body.category || 'ARCHITECTURAL BUILT-IN'),
        categoryTag: body.categoryTag || 'architectural',
        pillarBg: String(body.pillarBg || 'bg-[#EF6922]'),
        pillarCode: String(body.pillarCode || 'PILLAR 01 / ARCHITECTURAL MILLWORK'),
        tolerance: String(body.tolerance || '± 1/32" RHINO 3D'),
        materials: String(body.materials || ''),
        dimensions: String(body.dimensions || ''),
        description: String(body.description || ''),
        images: Array.isArray(body.images) ? body.images : [],
        specs: Array.isArray(body.specs) ? body.specs : [],
        published: body.published !== false,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
      });

      res.status(201).json({ project });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create project';
      res.status(500).json({ error: message });
    }
  });

  // POST /api/admin/projects/reorder — Owner-only reorder projects
  app.post('/api/admin/projects/reorder', requireOwner, async (req: AuthRequest, res) => {
    try {
      const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
      const projects = await reorderPortfolioProjects(orderedIds);
      res.json({ projects });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reorder projects';
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/admin/projects/:id — Owner-only update project
  app.put('/api/admin/projects/:id', requireOwner, async (req: AuthRequest, res) => {
    try {
      const dbId = Number(req.params.id);
      if (!Number.isFinite(dbId)) {
        res.status(400).json({ error: 'Invalid project ID.' });
        return;
      }

      const updated = await updatePortfolioProject(dbId, req.body || {});
      if (!updated) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      res.json({ project: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update project';
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/admin/projects/:id — Owner-only delete project
  app.delete('/api/admin/projects/:id', requireOwner, async (req: AuthRequest, res) => {
    try {
      const dbId = Number(req.params.id);
      if (!Number.isFinite(dbId)) {
        res.status(400).json({ error: 'Invalid project ID.' });
        return;
      }

      const ok = await deletePortfolioProject(dbId);
      if (!ok) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      res.json({ ok: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete project';
      res.status(500).json({ error: message });
    }
  });

  // POST /api/auth/sync — Synchronizes authenticated Firebase user into Cloud SQL
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const dbUser = await getOrCreateUser(
        req.user.uid,
        req.user.email || '',
        req.user.name || null
      );
      res.json({ user: dbUser });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sync user';
      res.status(500).json({ error: message });
    }
  });

  // GET /api/my-concepts — Returns concepts created by the signed-in user from Cloud SQL
  app.get('/api/my-concepts', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const userConcepts = await getUserConceptsFromDb(req.user.uid);
      res.json({ concepts: userConcepts });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load user concepts';
      res.status(500).json({ error: message });
    }
  });

  // POST /api/inquiries — Persists a commission inquiry to Cloud SQL
  app.post('/api/inquiries', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const {
        name = '',
        email = '',
        phone = '',
        projectType = 'Custom Furniture',
        timeline = '',
        budget = '',
        dimensions = '',
        description = '',
        conceptId = '',
      } = req.body || {};

      if (!name.trim() || !email.trim() || !description.trim()) {
        res.status(400).json({ error: 'Name, email, and project description are required.' });
        return;
      }

      let userId: number | null = null;
      if (req.user) {
        const dbUser = await getOrCreateUser(
          req.user.uid,
          req.user.email || email.trim(),
          req.user.name || name.trim()
        );
        userId = dbUser?.id ?? null;
      }

      const saved = await saveInquiryToDb({
        userId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        projectType,
        timeline,
        budget,
        dimensions: dimensions.trim(),
        description: description.trim(),
        conceptId: conceptId || undefined,
      });

      res.json({ inquiry: saved });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save inquiry';
      res.status(500).json({ error: message });
    }
  });

  // GET /api/my-inquiries — Returns commission inquiries for the signed-in user from Cloud SQL
  app.get('/api/my-inquiries', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const userInquiries = await getUserInquiriesFromDb(req.user.uid);
      res.json({ inquiries: userInquiries });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load user inquiries';
      res.status(500).json({ error: message });
    }
  });

  // GET /api/generated-concepts — Returns all concepts generated through the visualizer (Cloud SQL + local fallback)
  app.get('/api/generated-concepts', async (_req, res) => {
    try {
      const dbRecords = await getRecentConceptsFromDb(50);
      if (dbRecords.length > 0) {
        const formatted: LoggedConceptRecord[] = dbRecords.map((row) => ({
          id: row.conceptId,
          filename: row.filename,
          publicPath: row.publicPath,
          fullImageUrl: row.fullImageUrl,
          visualStyle: (row.visualStyle === 'cad-2d' ? 'cad-2d' : 'render-3d'),
          ideaPrompt: row.ideaPrompt,
          woodSpecies: row.woodSpecies,
          designStyle: row.designStyle,
          addedDetails: row.addedDetails || undefined,
          summarySpec: row.summarySpec,
          modelEngine: row.modelEngine || undefined,
          emailedToOwner: Boolean(row.emailedToOwner),
          createdAt: row.createdAt
            ? new Date(row.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })
            : '',
        }));
        res.json({ concepts: formatted });
        return;
      }
    } catch {
      // Fallback to local concept log if DB query fails
    }
    const records = readConceptLog();
    res.json({ concepts: records });
  });

  // POST /api/visualize-concept — True Multimodal Gemini Image-to-Image + Text-to-Image (with FLUX fallback)
  app.post('/api/visualize-concept', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const {
        ideaPrompt = '',
        visualStyle = 'render-3d',
        woodSpecies = 'American Black Walnut',
        designStyle = 'Mid-Century Modern',
        addedDetails = 'Full Overlay Doors',
        refinementPrompt = '',
        sourceImage = null,
        sourceImageMode = 'room-photo',
        previousSpecs = null,
      } = req.body || {};

      const cleanIdeaPrompt = typeof ideaPrompt === 'string' ? ideaPrompt.trim() : '';
      const cleanRefinement = typeof refinementPrompt === 'string' ? refinementPrompt.trim() : '';
      const safeVisualStyle: 'render-3d' | 'cad-2d' =
        visualStyle === 'cad-2d' ? 'cad-2d' : 'render-3d';
      const safeSourceMode: 'room-photo' | 'refine-concept' =
        sourceImageMode === 'refine-concept' ? 'refine-concept' : 'room-photo';

      if (!cleanIdeaPrompt && !cleanRefinement) {
        res.status(400).json({
          error: 'Please enter a description of your custom furniture or millwork idea.',
        });
        return;
      }

      // Validate optional sourceImage (room photo / sketch / existing concept for refinement)
      let validatedSourceImage: SourceImagePayload | null = null;
      if (sourceImage && typeof sourceImage === 'object') {
        const rawData = typeof sourceImage.data === 'string' ? sourceImage.data.trim() : '';
        const rawMime =
          typeof sourceImage.mimeType === 'string' ? sourceImage.mimeType.trim().toLowerCase() : '';
        if (rawData) {
          if (!ALLOWED_INPUT_MIMES.has(rawMime)) {
            res.status(400).json({
              error: 'Unsupported image format. Please upload a PNG, JPEG, or WebP photo.',
            });
            return;
          }
          if (rawData.length > MAX_SOURCE_IMAGE_BASE64_LEN) {
            res.status(400).json({
              error: 'Uploaded photo is too large. Please use an image under 8 MB.',
            });
            return;
          }
          validatedSourceImage = { data: rawData, mimeType: rawMime };
        }
      }

      const cleanWood = String(woodSpecies).trim() || 'American Black Walnut';
      const cleanStyle = String(designStyle).trim() || 'Mid-Century Modern';
      const cleanDetails = String(addedDetails).trim() || 'Full Overlay Doors';

      const timberSpec = buildTimberConstraint(cleanWood);
      const joinerySpec = buildJoineryDetailConstraint(cleanDetails);
      const styleSpec = buildStyleConstraint(cleanStyle);
      const refinementClause = cleanRefinement
        ? `USER REVISION REQUEST: ${cleanRefinement}`
        : '';

      const refinementDiffs =
        validatedSourceImage && safeSourceMode === 'refine-concept'
          ? buildRefinementDiffs(
              previousSpecs && typeof previousSpecs === 'object'
                ? (previousSpecs as PreviousSpecsPayload)
                : null,
              {
                visualStyle: safeVisualStyle,
                woodSpecies: cleanWood,
                designStyle: cleanStyle,
                addedDetails: cleanDetails,
              }
            )
          : [];

      const prompt = buildVisualizationPrompt({
        visualStyle: safeVisualStyle,
        ideaPrompt: cleanIdeaPrompt || 'Custom handcrafted hardwood furniture commission',
        woodSpecies: cleanWood,
        designStyle: cleanStyle,
        addedDetails: cleanDetails,
        timberSpec,
        joinerySpec,
        styleSpec,
        refinementClause,
        refinementDiffs,
        hasSourceImage: Boolean(validatedSourceImage),
        sourceImageMode: safeSourceMode,
      });

      let generatedResult: { base64: string; mimeType: string; engine: string } | null = null;

      if (validatedSourceImage) {
        // True image-to-image requires Gemini multimodal API
        if (!getGeminiApiKey()) {
          res.status(503).json({
            error:
              'Room photo visualization and image refinement require GEMINI_API_KEY to be configured on the server.',
          });
          return;
        }
        generatedResult = await generateWithGeminiImage({
          prompt,
          sourceImage: validatedSourceImage,
          sourceImageMode: safeSourceMode,
        });

        if (!generatedResult) {
          res.status(503).json({
            error:
              'Gemini image editing is momentarily busy or could not process this photo. Please try again in a few seconds.',
          });
          return;
        }
      } else {
        // 1. Primary: Gemini Image Generation (if GEMINI_API_KEY is configured)
        generatedResult = await generateWithGeminiImage({
          prompt,
          sourceImage: null,
          sourceImageMode: 'room-photo',
        });

        // 2. Fallback to Cloud Open-Source Engine: Black Forest Labs FLUX.1-schnell (8-Step HD)
        if (!generatedResult) {
          generatedResult = await generateWithOpenSourceFluxSpace(prompt);
        }

        // 3. Fallback to Secondary Cloud Open-Source Engine: Pollinations FLUX (enhance=false)
        if (!generatedResult) {
          generatedResult = await generateWithPollinationsFlux(prompt);
        }

        if (!generatedResult) {
          res.status(503).json({
            error:
              'The image render queue is momentarily busy. Please click GENERATE CUSTOM CONCEPT again in a few seconds.',
          });
          return;
        }
      }

      const { base64: generatedBase64, mimeType: generatedMime, engine: modelEngine } =
        generatedResult;

      const generatedImageUrl = `data:${generatedMime};base64,${generatedBase64}`;
      const summarySpec = `${visualStyle === 'cad-2d' ? '2D CAD Elevation Sketch' : '3D Hardwood Proposal'} · ${woodSpecies} · ${designStyle} · ${addedDetails} — "${ideaPrompt.trim()}"${
        refinementPrompt.trim() ? ` (Refined: ${refinementPrompt.trim()})` : ''
      }`;

      // Save the generated image file to /public/generated-concepts/ and log it for Josh
      const conceptId = `cg-${Date.now()}`;
      const ext = generatedMime.includes('webp')
        ? 'webp'
        : generatedMime.includes('jpeg') || generatedMime.includes('jpg')
        ? 'jpg'
        : 'png';
      const filename = `${conceptId}.${ext}`;
      const filePath = path.join(GENERATED_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(generatedBase64, 'base64'));

      const origin =
        process.env.APP_URL?.replace(/\/$/, '') ||
        `${req.protocol}://${req.get('host')}`;
      const publicPath = `/generated-concepts/${filename}`;
      const fullImageUrl = `${origin}${publicPath}`;

      const record: LoggedConceptRecord = {
        id: conceptId,
        filename,
        publicPath,
        fullImageUrl,
        visualStyle,
        ideaPrompt: ideaPrompt.trim(),
        woodSpecies,
        designStyle,
        addedDetails,
        summarySpec,
        modelEngine,
        createdAt: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      };

      // Persist generated concept to Cloud SQL and dispatch automatic email notification
      let userId: number | null = null;
      if (req.user) {
        try {
          const dbUser = await getOrCreateUser(
            req.user.uid,
            req.user.email || '',
            req.user.name || null
          );
          userId = dbUser?.id ?? null;
        } catch {
          // Proceed even if user sync fails
        }
      }

      saveConceptToDb({
        conceptId: record.id,
        userId,
        filename: record.filename,
        publicPath: record.publicPath,
        fullImageUrl: record.fullImageUrl,
        visualStyle: record.visualStyle,
        ideaPrompt: record.ideaPrompt,
        woodSpecies: record.woodSpecies,
        designStyle: record.designStyle,
        addedDetails: record.addedDetails,
        summarySpec: record.summarySpec,
        modelEngine: record.modelEngine,
        emailedToOwner: false,
      }).catch((err) => {
        console.warn('Cloud SQL concept insert notice:', err);
      });

      dispatchConceptEmailToOwner(record).then((sent) => {
        record.emailedToOwner = sent;
        appendConceptLog(record);
        saveConceptToDb({
          conceptId: record.id,
          userId,
          filename: record.filename,
          publicPath: record.publicPath,
          fullImageUrl: record.fullImageUrl,
          visualStyle: record.visualStyle,
          ideaPrompt: record.ideaPrompt,
          woodSpecies: record.woodSpecies,
          designStyle: record.designStyle,
          addedDetails: record.addedDetails,
          summarySpec: record.summarySpec,
          modelEngine: record.modelEngine,
          emailedToOwner: sent,
        }).catch(() => {});
      });

      res.json({
        id: conceptId,
        filename,
        imageUrl: generatedImageUrl,
        publicPath,
        fullImageUrl,
        summarySpec,
        modelEngine,
        notes: `Rendered with ${modelEngine}`,
      });
    } catch (err: unknown) {
      console.error('Error in /api/visualize-concept:', err);
      const message =
        err instanceof Error ? err.message : 'Unexpected error generating concept visualization.';
      res.status(500).json({
        error: message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
      plugins: [
        {
          name: 'disable-vite-client-ws',
          enforce: 'post',
          transform(code, id) {
            if (id.includes('vite/dist/client/client.mjs')) {
              return code
                .replace(
                  'transport.connect(createHMRHandler(handleMessage));',
                  '/* HMR websocket disabled in preview */'
                )
                .replace(
                  'setupForwardConsoleHandler(transport, forwardConsole);',
                  '/* forwardConsole disabled */'
                );
            }
            return null;
          },
        },
      ],
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Casegoods server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
