import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
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
import {
  checkStudioRateLimit,
  claimFirstRunStudioPasscode,
  clearStudioRateLimit,
  getStudioPasscodeMode,
  issueStudioUnlockToken,
  recordFailedStudioAttempt,
  revokeStudioUnlockToken,
  verifyStudioUnlockToken,
  verifySubmittedStudioPasscode,
} from './src/lib/studioAuth.ts';

dotenv.config();

const OWNER_EMAIL = 'jmheinke1@gmail.com';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_DIR = path.join(__dirname, 'public', 'generated-concepts');
const LOG_FILE = path.join(GENERATED_DIR, 'concepts-log.json');
const CUSTOM_SCONCES_DIR = path.resolve(__dirname, 'public', 'downloads', 'sconces', 'custom');
const CUSTOM_SCONCES_CATALOG = path.join(CUSTOM_SCONCES_DIR, 'catalog.json');
const MAX_CUSTOM_STL_BYTES = 15 * 1024 * 1024;
const SAFE_STL_FILENAME_RE = /^[a-z0-9][a-z0-9-]{0,80}\.stl$/;

export interface CustomSconceRecord {
  id: string;
  filename: string;
  title: string;
  notes: string;
  publicUrl: string;
  format: 'binary' | 'ascii';
  triangleCount: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  bytes: number;
  uploadedAt: string;
}

function ensureGeneratedDir() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(CUSTOM_SCONCES_DIR)) {
    fs.mkdirSync(CUSTOM_SCONCES_DIR, { recursive: true });
  }
  if (!fs.existsSync(CUSTOM_SCONCES_CATALOG)) {
    fs.writeFileSync(CUSTOM_SCONCES_CATALOG, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readCustomSconcesCatalog(): CustomSconceRecord[] {
  ensureGeneratedDir();
  try {
    const raw = fs.readFileSync(CUSTOM_SCONCES_CATALOG, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomSconcesCatalog(records: CustomSconceRecord[]) {
  ensureGeneratedDir();
  fs.writeFileSync(CUSTOM_SCONCES_CATALOG, JSON.stringify(records.slice(0, 20), null, 2), 'utf-8');
}

function inspectStlBuffer(buf: Buffer): {
  format: 'binary' | 'ascii';
  triangleCount: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
} | null {
  if (buf.length < 84 || buf.length > MAX_CUSTOM_STL_BYTES) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const triCount = buf.readUInt32LE(80);
  if (triCount > 0 && 84 + triCount * 50 === buf.length) {
    let off = 84;
    for (let i = 0; i < triCount; i++) {
      for (let v = 0; v < 3; v++) {
        const vx = buf.readFloatLE(off + 12 + v * 12);
        const vy = buf.readFloatLE(off + 16 + v * 12);
        const vz = buf.readFloatLE(off + 20 + v * 12);
        if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) return null;
        if (vx < minX) minX = vx;
        if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy;
        if (vy > maxY) maxY = vy;
        if (vz < minZ) minZ = vz;
        if (vz > maxZ) maxZ = vz;
      }
      off += 50;
    }
    return {
      format: 'binary',
      triangleCount: triCount,
      sizeX: Number((maxX - minX).toFixed(2)),
      sizeY: Number((maxY - minY).toFixed(2)),
      sizeZ: Number((maxZ - minZ).toFixed(2)),
    };
  }

  // Fallback: ASCII STL validation
  const text = buf.toString('utf8');
  if (!/^\s*solid\b/i.test(text) || !/facet\s+normal/i.test(text)) return null;
  const vertexRe =
    /vertex\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/gi;
  let vertCount = 0;
  let match: RegExpExecArray | null;
  while ((match = vertexRe.exec(text)) !== null) {
    const vx = Number(match[1]);
    const vy = Number(match[2]);
    const vz = Number(match[3]);
    if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) continue;
    if (vx < minX) minX = vx;
    if (vx > maxX) maxX = vx;
    if (vy < minY) minY = vy;
    if (vy > maxY) maxY = vy;
    if (vz < minZ) minZ = vz;
    if (vz > maxZ) maxZ = vz;
    vertCount++;
  }
  const asciiTris = Math.floor(vertCount / 3);
  if (asciiTris < 1) return null;

  return {
    format: 'ascii',
    triangleCount: asciiTris,
    sizeX: Number((maxX - minX).toFixed(2)),
    sizeY: Number((maxY - minY).toFixed(2)),
    sizeZ: Number((maxZ - minZ).toFixed(2)),
  };
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
 * Local studio material texture swatch files attached directly as multimodal reference images to Gemini 3D renders.
 */
const TEXTURES_DIR = path.join(__dirname, 'public', 'assets', 'textures');
const textureSwatchCache = new Map<string, { data: string; mimeType: string; label: string }>();

function resolveMaterialTextureFile(woodSpecies: string): { filename: string; label: string } | null {
  const key = woodSpecies.trim().toLowerCase();
  if (key.includes('walnut')) {
    return { filename: 'american-black-walnut.jpg', label: 'American Black Walnut' };
  }
  if (key.includes('white oak') || key.includes('oak')) {
    return { filename: 'rift-white-oak.jpg', label: 'Rift White Oak' };
  }
  if (key.includes('maple')) {
    return { filename: 'hard-white-maple.jpg', label: 'Hard White Maple' };
  }
  if (key.includes('ebonized') || key.includes('blackened') || key.includes('ash')) {
    return { filename: 'ebonized-blackened-ash.jpg', label: 'Ebonized / Blackened Ash' };
  }
  if (key.includes('hpl') || key.includes('laminate') || key.includes('baltic birch')) {
    return {
      filename: 'matte-hpl-baltic-birch.jpg',
      label: 'Matte HPL + Exposed Baltic Birch Ply',
    };
  }
  return null;
}

function loadMaterialTextureRef(
  woodSpecies: string
): { data: string; mimeType: string; label: string } | null {
  const match = resolveMaterialTextureFile(woodSpecies);
  if (!match) return null;

  const cached = textureSwatchCache.get(match.filename);
  if (cached) return cached;

  try {
    const filePath = path.join(TEXTURES_DIR, match.filename);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath).toString('base64');
    const entry = { data, mimeType: 'image/jpeg', label: match.label };
    textureSwatchCache.set(match.filename, entry);
    return entry;
  } catch (err) {
    console.warn(`Unable to load material swatch ${match.filename}:`, err);
    return null;
  }
}

/**
 * Strict Visual Woodworking Timber & Material Specifications (with color locks & negative exclusions)
 */
function buildTimberConstraint(woodSpecies: string): string {
  const key = woodSpecies.trim().toLowerCase();
  if (key.includes('walnut')) {
    return 'PRIMARY MATERIAL — AMERICAN BLACK WALNUT: Rich, dark chocolate-espresso brown FAS heartwood walnut matching the attached studio material swatch with dramatic dark-chocolate cathedral/straight grain and hand-rubbed satin oil sheen. STRICT COLOR LOCK: Must be unmistakably dark chocolate brown walnut — strictly NOT pale blonde oak, NOT yellow maple, NOT reddish cherry.';
  }
  if (key.includes('white oak') || key.includes('oak')) {
    return 'PRIMARY MATERIAL — RIFT WHITE OAK: Cool, pale raw wheat-straw / light champagne-blonde rift-sawn white oak matching the attached studio material swatch with tight, straight vertical pencil grain and a dead-flat clear matte raw-wood finish. STRICT COLOR LOCK: Must be pale neutral blonde-straw oak — strictly NOT dark brown walnut, NOT orange-red cherry, NOT yellow honey oak.';
  }
  if (key.includes('maple')) {
    return 'PRIMARY MATERIAL — HARD WHITE MAPLE: Very bright, pale creamy ivory-blonde hard sugar maple matching the attached studio material swatch with ultra-smooth, quiet fine grain and clear waterborne matte finish. STRICT COLOR LOCK: Must be light creamy pale blonde wood — strictly NOT dark brown walnut, NOT medium oak, NOT amber cherry.';
  }
  if (key.includes('ebonized') || key.includes('blackened') || key.includes('charred')) {
    return 'PRIMARY MATERIAL — EBONIZED / BLACKENED ASH: Deep matte jet-black stained open-pore solid ash hardwood matching the attached studio material swatch where subtle tactile wood grain texture remains visible under raking light, finished dead-flat matte black. STRICT COLOR LOCK: True matte charcoal-black wood — strictly NOT natural brown or blonde wood.';
  }
  if (key.includes('hpl') || key.includes('laminate') || key.includes('baltic birch')) {
    return 'PRIMARY MATERIAL — MATTE HPL + EXPOSED BALTIC BIRCH PLY: Smooth ultra-matte architectural warm off-white high-pressure laminate (HPL) cabinet faces matching the attached studio material swatch with clearly visible exposed multi-ply striped pale Baltic Birch plywood edges along every door, panel, and box reveal. STRICT MATERIAL LOCK: Must show smooth velvety matte laminate faces with crisp exposed layered Baltic Birch plywood edges — NOT solid stained timber.';
  }
  return `PRIMARY MATERIAL — ${woodSpecies.toUpperCase()}: Authentic architectural-grade ${woodSpecies} with unmistakable true-to-species color, continuous matched grain, and hand-rubbed satin finish.`;
}

/**
 * Single Cabinetry / Joinery Detail Specification (with high visual salience & explicit exclusions)
 */
function buildSingleDetailConstraint(detail: string): string {
  const key = detail.trim().toLowerCase();
  if (!key || key === 'clean architectural millwork') return '';
  if (key.includes('full overlay')) {
    return 'DOOR CONSTRUCTION — FULL OVERLAY SLAB DOORS: Completely frameless full-overlay flat slab doors and drawer fronts covering the entire front face edge-to-edge with ZERO visible face frame and razor-sharp uniform 1/16-inch black shadow reveals between panels.';
  }
  if (key.includes('flush inset')) {
    return 'DOOR CONSTRUCTION — FLUSH INSET FRAME: Every cabinet door and drawer front sits recessed completely flush INSIDE a clearly visible solid 3/4-inch hardwood outer face frame (stiles and rails framing every opening) with crisp uniform 1/16-inch perimeter shadow gaps.';
  }
  if (key.includes('pocket') || key.includes('retracting')) {
    return 'DOOR MECHANISM — RETRACTING POCKET DOORS: Tall solid hardwood doors slid partway back into concealed vertical side pockets along the left and right edges of the cabinet, clearly showcasing the fitted hardwood interior inside.';
  }
  if (key.includes('open architectural shelving') || key.includes('open cabinets') || key.includes('no doors')) {
    return 'OPEN ARCHITECTURAL SHELVING — STRICTLY NO DOORS: Crisp open front-facing architectural shelving bays with thick 1-1/4-inch solid hardwood shelves and vertical dividers, keeping compartments open and sculptural.';
  }
  if (key.includes('tambour')) {
    return 'DOOR MECHANISM — CURVED SLIDING TAMBOUR: Clearly visible narrow 1/2-inch vertical solid hardwood tambour slats wrapping smoothly around curved/radiused cabinet corners, with one tambour door slid partway open to show the curved track.';
  }
  if (key.includes('fluted') || key.includes('reeded')) {
    return 'SURFACE TEXTURE — DEEP FLUTED / REEDED FACES: Cabinet door and drawer faces are covered edge-to-edge in bold, deep, CNC-carved semicircular vertical wood flutes/reeds casting crisp parallel vertical shadows across the elevation — strictly NOT flat smooth slab doors.';
  }
  if (key.includes('dovetail')) {
    return 'DRAWER JOINERY — EXPOSED DOVETAIL DRAWERS: Show one solid wood drawer pulled partway open (about 6 inches) so precision interlocking angled dovetail joints along the solid hardwood drawer side are prominently visible in the photograph.';
  }
  if (key.includes('push-to-open') || key.includes('handleless') || key.includes('touch latch')) {
    return 'HARDWARE — HANDLELESS PUSH-TO-OPEN (ZERO HARDWARE): Completely clean, unbroken door and drawer faces with ZERO knobs, ZERO pulls, ZERO metal handles, and ZERO finger-pull cutouts anywhere on the entire piece.';
  }
  if (key.includes('turned hardwood pulls') || key.includes('turned')) {
    return 'HARDWARE — TURNED HARDWOOD PULLS: Prominent, tactile solid hardwood lathe-turned cylindrical wood pulls mounted cleanly on every door and drawer front. STRICT EXCLUSION: ZERO metal, brass, or black iron hardware pulls.';
  }
  if (key.includes('led')) {
    return 'LIGHTING — RECESSED 2700K LED LIGHTING: Glowing recessed warm 2700K linear LED light strips milled flush into the underside of upper shelves and cabinet bays, casting a clearly visible warm golden light graze downward across the hardwood back panel.';
  }
  if (key.includes('waterfall')) {
    return 'CASE CORNERS — 45° WATERFALL MITERS: Continuous unbroken wood grain flowing seamlessly across the horizontal top and wrapping directly over razor-sharp 45-degree mitered waterfall corners straight down both vertical side panels.';
  }
  if (key.includes('finger') || key.includes('tenon')) {
    return 'CORNER JOINERY — EXPOSED BOX FINGER-JOINTS: Prominent, unmistakably visible interlocking 3/4-inch square box finger-joints wrapping the outer case corners with alternating contrasting end-grain blocks as the signature architectural detail.';
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
    return 'Clean, gallery-grade architectural millwork with razor-sharp 1/16-inch shadow reveals and +/- 1/32-inch cabinetmaker tolerances.';
  }
  return parts
    .map((p, idx) => {
      const text = buildSingleDetailConstraint(p);
      return text ? `${idx + 1}) ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Complete Architectural Direction Specifications (aligned with refined Casegoods palette)
 */
function buildStyleConstraint(designStyle: string): string {
  const key = designStyle.trim().toLowerCase();
  if (key.includes('bauhaus')) {
    return 'ARCHITECTURAL DIRECTION — BAUHAUS & COLOR-BLOCKED: Disciplined asymmetrical Bauhaus geometric grid divisions pairing the selected primary material with bold, unmistakable solid-color matte drawer fronts or accent bays in Bauhaus Orange (#EF6922), Fabrication Blue (#27AAE0), and Golden Yellow (#FDCB33). Must clearly display geometric Bauhaus color-blocking integrated into the woodwork.';
  }
  if (key.includes('minimalist') || key.includes('contemporary')) {
    return 'ARCHITECTURAL DIRECTION — ARCHITECTURAL MINIMALIST: Ultra-clean monolithic architectural geometry with razor-sharp 90-degree edges, completely flat uninterrupted planes, flush recessed shadow toe-kick, zero applied molding, zero decorative trim, and strict grid alignment.';
  }
  if (key.includes('sculptural') || key.includes('radiused') || key.includes('art deco')) {
    return 'ARCHITECTURAL DIRECTION — SCULPTURAL & RADIUSED: Bold sweeping curved ends, generous radiused outer case corners, flowing sculptural transitions, and architectural plinth balance with zero harsh boxy corners.';
  }
  if (key.includes('mid-century')) {
    return 'ARCHITECTURAL DIRECTION — MID-CENTURY LOW-SLUNG: Authentic 1950s/60s Mid-Century horizontal proportions with clean low-slung casework, slender tapered or gently splayed solid hardwood legs (or recessed shadow plinth), crisp chamfered outer edges, and unbroken horizontal grain matching.';
  }
  if (key.includes('modular') || key.includes('structural') || key.includes('industrial')) {
    return 'ARCHITECTURAL DIRECTION — MODULAR & STRUCTURAL: Honest architectural system design showcasing a disciplined modular grid rhythm, cantilevered shelves or suspended volumes, clear structural joinery logic, and refined workshop precision.';
  }
  return `ARCHITECTURAL DIRECTION — ${designStyle.toUpperCase()}: Faithfully express unmistakable ${designStyle} proportions, silhouette, edge profiles, and structural detailing throughout the entire piece.`;
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

const VALID_GEMINI_MODEL_RE = /^gemini-[a-z0-9.-]+$/i;

function isBillingOrCreditError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return (
    msg.includes('"code":402') ||
    msg.includes('402') ||
    /prepayment credits are depleted/i.test(msg) ||
    /billing/i.test(msg)
  );
}

/**
 * Primary Multimodal Image Engine: Google Gemini (Nano Banana 2.1 / 3.1 Flash Image / 2.5 Flash Image)
 * Supports true image-to-image room-photo compositing, hand-sketch translation, iterative refinement,
 * and 3D <-> 2D CAD conversion via @google/genai.
 */
async function generateWithGeminiImage(params: {
  prompt: string;
  sourceImage: SourceImagePayload | null;
  sourceImageMode: 'room-photo' | 'refine-concept';
  textureRef: { data: string; mimeType: string; label: string } | null;
}): Promise<{
  result: {
    base64: string;
    mimeType: string;
    engine: string;
  } | null;
  billingError?: string;
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return { result: null };

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const rawConfiguredModel = (process.env.GEMINI_IMAGE_MODEL || '').trim();
  const configuredModel = VALID_GEMINI_MODEL_RE.test(rawConfiguredModel) ? rawConfiguredModel : '';
  if (rawConfiguredModel && !configuredModel) {
    console.warn(
      'Ignoring invalid GEMINI_IMAGE_MODEL environment variable (must be a valid gemini-* model name, not an API key).'
    );
  }

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

  // Build multimodal parts combining optional room/refinement image + studio material texture swatch
  let contents: string | Array<string | { text: string } | { inlineData: { mimeType: string; data: string } }>;
  if (params.sourceImage && params.textureRef) {
    contents = [
      {
        text:
          params.sourceImageMode === 'room-photo'
            ? 'IMAGE 1 — ROOM PHOTO OR HAND SKETCH REFERENCE (preserve architecture/layout according to task instructions):'
            : 'IMAGE 1 — EXISTING CONCEPT TO REFINE (preserve core layout/perspective while applying requested changes):',
      },
      {
        inlineData: {
          mimeType: params.sourceImage.mimeType,
          data: params.sourceImage.data,
        },
      },
      {
        text: `IMAGE 2 — MANDATORY PRIMARY MATERIAL TEXTURE SWATCH (${params.textureRef.label}). Match this exact wood grain pattern, color tone, sheen, and edge layering across the primary cabinetry/furniture surfaces:`,
      },
      {
        inlineData: {
          mimeType: params.textureRef.mimeType,
          data: params.textureRef.data,
        },
      },
      { text: params.prompt },
    ];
  } else if (params.textureRef) {
    contents = [
      {
        text: `MANDATORY PRIMARY MATERIAL TEXTURE SWATCH (${params.textureRef.label}). Match this exact wood grain pattern, color tone, matte/satin finish, and edge layering strictly across all primary woodwork surfaces of the custom piece:`,
      },
      {
        inlineData: {
          mimeType: params.textureRef.mimeType,
          data: params.textureRef.data,
        },
      },
      { text: params.prompt },
    ];
  } else if (params.sourceImage) {
    contents = [
      {
        inlineData: {
          mimeType: params.sourceImage.mimeType,
          data: params.sourceImage.data,
        },
      },
      { text: params.prompt },
    ];
  } else {
    contents = params.prompt;
  }

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
          const baseModeTag = params.sourceImage
            ? params.sourceImageMode === 'room-photo'
              ? 'Room/Sketch Edit'
              : 'Iterative Refinement'
            : 'Studio Render';
          const modeTag = params.textureRef ? `${baseModeTag} + Swatch Ref` : baseModeTag;
          return {
            result: {
              base64: part.inlineData.data,
              mimeType: part.inlineData.mimeType,
              engine: `Gemini ${model} (${modeTag})`,
            },
          };
        }
      }
      console.warn(`Gemini model ${model} returned no image part; trying next fallback.`);
    } catch (err) {
      if (isBillingOrCreditError(err)) {
        return {
          result: null,
          billingError:
            'Your Gemini API prepayment credits are depleted. Please select a billing-enabled API key or add credits in AI Studio (Settings > Secrets / https://ai.studio/projects).',
        };
      }
      console.warn(`Gemini model ${model} error:`, err instanceof Error ? err.message : err);
    }
  }

  return { result: null };
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

  // Second-factor Studio Passcode middleware for Private Studio admin APIs
  const requireStudioUnlocked = (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    requireOwner(req, res, () => {
      const studioToken = req.header('x-studio-token') || undefined;
      const verified = verifyStudioUnlockToken(
        studioToken,
        req.user!.uid,
        req.user!.email!
      );
      if (!verified) {
        res.status(403).json({
          error: 'Studio passcode unlock required.',
          code: 'STUDIO_LOCKED',
        });
        return;
      }
      next();
    });
  };

  // GET /api/studio-auth/status — Check passcode configuration state & whether caller's studio token is active
  app.get('/api/studio-auth/status', requireOwner, async (req: AuthRequest, res) => {
    try {
      const mode = await getStudioPasscodeMode();
      const studioToken = req.header('x-studio-token') || undefined;
      const verified = verifyStudioUnlockToken(
        studioToken,
        req.user!.uid,
        req.user!.email!
      );
      res.json({
        mode,
        configured: mode !== 'unclaimed',
        unlocked: Boolean(verified),
        expiresAt: verified?.exp ?? null,
      });
    } catch (err) {
      console.error('Error checking studio auth status:', err);
      res.status(500).json({ error: 'Unable to check studio security status.' });
    }
  });

  // POST /api/studio-auth/setup — Atomic one-time first-run passcode setup (only when env secret is unset & no hash claimed)
  app.post('/api/studio-auth/setup', requireOwner, async (req: AuthRequest, res) => {
    try {
      const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
      const result = await claimFirstRunStudioPasscode(passcode, req.user!.email!);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      clearStudioRateLimit(req.user!.uid);
      const issued = issueStudioUnlockToken(req.user!.uid, req.user!.email!);
      res.status(201).json({
        ok: true,
        mode: 'claimed',
        studioToken: issued.token,
        expiresAt: issued.expiresAt,
      });
    } catch (err) {
      console.error('Error setting up studio passcode:', err);
      res.status(500).json({ error: 'Failed to save studio passcode.' });
    }
  });

  // POST /api/studio-auth/verify — Verify Studio Passcode on server with rate limiting & issue signed unlock token
  app.post('/api/studio-auth/verify', requireOwner, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const limit = checkStudioRateLimit(uid);
      if (!limit.allowed) {
        res.status(429).json({
          error: `Too many failed attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
          retryAfterSeconds: limit.retryAfterSeconds,
        });
        return;
      }

      const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
      const check = await verifySubmittedStudioPasscode(passcode);

      if (check.mode === 'unclaimed') {
        res.status(409).json({
          error: 'No studio passcode has been set yet. Complete first-run setup first.',
          code: 'STUDIO_UNCLAIMED',
        });
        return;
      }

      if (!check.ok) {
        recordFailedStudioAttempt(uid);
        res.status(401).json({ error: 'Incorrect studio passcode.' });
        return;
      }

      clearStudioRateLimit(uid);
      const issued = issueStudioUnlockToken(uid, req.user!.email!);
      res.json({
        ok: true,
        mode: check.mode,
        studioToken: issued.token,
        expiresAt: issued.expiresAt,
      });
    } catch (err) {
      console.error('Error verifying studio passcode:', err);
      res.status(500).json({ error: 'Failed to verify studio passcode.' });
    }
  });

  // POST /api/studio-auth/lock — Revoke active Studio Unlock Token immediately
  app.post('/api/studio-auth/lock', requireOwner, (req: AuthRequest, res) => {
    const studioToken = req.header('x-studio-token') || undefined;
    revokeStudioUnlockToken(studioToken, req.user!.uid, req.user!.email!);
    res.json({ ok: true });
  });

  // Serve uploaded custom sconce STL files statically
  app.use('/downloads/sconces/custom', express.static(CUSTOM_SCONCES_DIR));

  // GET /api/custom-sconces — Lists custom sconce STLs saved to the studio
  app.get('/api/custom-sconces', (_req, res) => {
    try {
      const records = readCustomSconcesCatalog().filter((rec) => {
        if (!SAFE_STL_FILENAME_RE.test(rec.filename)) return false;
        const resolved = path.resolve(CUSTOM_SCONCES_DIR, rec.filename);
        return resolved.startsWith(CUSTOM_SCONCES_DIR + path.sep) && fs.existsSync(resolved);
      });
      res.json({ sconces: records });
    } catch (err) {
      console.warn('Unable to list custom sconces:', err);
      res.status(500).json({ error: 'Failed to load uploaded sconces.' });
    }
  });

  // GET /api/custom-sconces/download/:filename — Attachment download for an uploaded custom STL
  app.get('/api/custom-sconces/download/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename || '');
    if (!SAFE_STL_FILENAME_RE.test(safeName)) {
      res.status(400).send('Invalid STL filename.');
      return;
    }
    const resolved = path.resolve(CUSTOM_SCONCES_DIR, safeName);
    if (!resolved.startsWith(CUSTOM_SCONCES_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).send('Custom STL file not found.');
      return;
    }
    res.download(resolved, safeName);
  });

  // POST /api/custom-sconces/upload — Owner-only upload of a custom Binary or ASCII .STL
  app.post('/api/custom-sconces/upload', requireOwner, (req: AuthRequest, res) => {
    try {
      const { filename = '', title = '', notes = '', stlBase64 = '' } = req.body || {};
      if (typeof stlBase64 !== 'string' || !stlBase64.trim()) {
        res.status(400).json({ error: 'Missing STL file data.' });
        return;
      }

      const cleanBase64 = stlBase64.includes(',') ? stlBase64.split(',').pop() || '' : stlBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      if (buffer.length > MAX_CUSTOM_STL_BYTES) {
        res.status(413).json({ error: 'STL file exceeds the 15 MB upload limit.' });
        return;
      }

      const inspected = inspectStlBuffer(buffer);
      if (!inspected) {
        res.status(400).json({
          error: 'Invalid .STL file. Please export a valid Binary or ASCII .STL mesh from your CAD software.',
        });
        return;
      }

      const rawBase = path
        .basename(String(filename || title || 'custom-sconce'))
        .replace(/\.stl$/i, '');
      const slug =
        rawBase
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48) || 'custom-sconce';

      const id = `${slug}-${Date.now()}`;
      const safeFilename = `${id}.stl`;
      if (!SAFE_STL_FILENAME_RE.test(safeFilename)) {
        res.status(400).json({ error: 'Unable to derive a valid STL filename.' });
        return;
      }

      const resolvedPath = path.resolve(CUSTOM_SCONCES_DIR, safeFilename);
      if (!resolvedPath.startsWith(CUSTOM_SCONCES_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid storage path.' });
        return;
      }

      ensureGeneratedDir();
      fs.writeFileSync(resolvedPath, buffer);

      const record: CustomSconceRecord = {
        id,
        filename: safeFilename,
        title: String(title || rawBase || 'Custom Wall Sconce').trim().slice(0, 120),
        notes: String(notes || '').trim().slice(0, 500),
        publicUrl: `/downloads/sconces/custom/${safeFilename}`,
        format: inspected.format,
        triangleCount: inspected.triangleCount,
        sizeX: inspected.sizeX,
        sizeY: inspected.sizeY,
        sizeZ: inspected.sizeZ,
        bytes: buffer.length,
        uploadedAt: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }),
      };

      const existing = readCustomSconcesCatalog();
      writeCustomSconcesCatalog([record, ...existing]);

      res.status(201).json({ sconce: record });
    } catch (err: unknown) {
      console.error('Error uploading custom sconce STL:', err);
      const message = err instanceof Error ? err.message : 'Failed to upload custom STL.';
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/custom-sconces/:filename — Owner-only delete of an uploaded custom STL
  app.delete('/api/custom-sconces/:filename', requireOwner, (req: AuthRequest, res) => {
    try {
      const safeName = path.basename(req.params.filename || '');
      if (!SAFE_STL_FILENAME_RE.test(safeName)) {
        res.status(400).json({ error: 'Invalid STL filename.' });
        return;
      }
      const resolvedPath = path.resolve(CUSTOM_SCONCES_DIR, safeName);
      if (!resolvedPath.startsWith(CUSTOM_SCONCES_DIR + path.sep)) {
        res.status(400).json({ error: 'Invalid storage path.' });
        return;
      }

      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
      const updated = readCustomSconcesCatalog().filter((r) => r.filename !== safeName);
      writeCustomSconcesCatalog(updated);
      res.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete custom STL.';
      res.status(500).json({ error: message });
    }
  });

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

  // GET /api/admin/projects — Owner + Passcode unlocked list of all projects (published + drafts)
  app.get('/api/admin/projects', requireStudioUnlocked, async (_req: AuthRequest, res) => {
    try {
      const projects = await listAllPortfolioProjects();
      res.json({ projects });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load studio projects';
      res.status(500).json({ error: message });
    }
  });

  // POST /api/admin/projects — Owner + Passcode unlocked create project
  app.post('/api/admin/projects', requireStudioUnlocked, async (req: AuthRequest, res) => {
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

  // POST /api/admin/projects/reorder — Owner + Passcode unlocked reorder projects
  app.post('/api/admin/projects/reorder', requireStudioUnlocked, async (req: AuthRequest, res) => {
    try {
      const orderedIds = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [];
      const projects = await reorderPortfolioProjects(orderedIds);
      res.json({ projects });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reorder projects';
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/admin/projects/:id — Owner + Passcode unlocked update project
  app.put('/api/admin/projects/:id', requireStudioUnlocked, async (req: AuthRequest, res) => {
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

  // DELETE /api/admin/projects/:id — Owner + Passcode unlocked delete project
  app.delete('/api/admin/projects/:id', requireStudioUnlocked, async (req: AuthRequest, res) => {
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

  // POST /api/admin/projects/analyze-images — Owner + Passcode unlocked multimodal analysis of CAD drawings, 3D renders, and project photos
  app.post('/api/admin/projects/analyze-images', requireStudioUnlocked, async (req: AuthRequest, res) => {
    try {
      const apiKey = getGeminiApiKey();
      if (!apiKey) {
        res.status(503).json({
          error:
            'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to enable automatic photo and drawing analysis.',
        });
        return;
      }

      const rawImages = Array.isArray(req.body?.images) ? req.body.images : [];
      if (rawImages.length === 0) {
        res.status(400).json({ error: 'Upload at least one drawing, rendering, or photograph to analyze.' });
        return;
      }
      if (rawImages.length > 10) {
        res.status(400).json({ error: 'Please analyze up to 10 images at a time.' });
        return;
      }

      const notesHint =
        typeof req.body?.notesHint === 'string' ? req.body.notesHint.trim().slice(0, 600) : '';

      const DATA_URL_RE = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/;
      const parts: Array<
        | { inlineData: { mimeType: string; data: string } }
        | { text: string }
      > = [];

      const sheetManifest: string[] = [];

      for (let i = 0; i < rawImages.length; i++) {
        const item = rawImages[i] || {};
        const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl.trim() : '';
        const match = dataUrl.match(DATA_URL_RE);
        if (!match) {
          res.status(400).json({
            error: `Image #${i + 1} is not a supported JPG, PNG, or WebP image payload.`,
          });
          return;
        }
        const rawMime = match[1].toLowerCase();
        const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
        const base64Data = match[2].replace(/\s+/g, '');
        if (base64Data.length > 8 * 1024 * 1024) {
          res.status(413).json({ error: `Image #${i + 1} exceeds the maximum size for analysis.` });
          return;
        }

        const filename =
          typeof item.filename === 'string' ? item.filename.trim().slice(0, 120) : `image-${i + 1}`;
        sheetManifest.push(`Image index ${i}: "${filename}"`);

        parts.push({ text: `--- IMAGE INDEX ${i} (filename: ${filename}) ---` });
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      const userPrompt = [
        `Analyze the ${rawImages.length} uploaded Casegoods project file(s) below (${sheetManifest.join(', ')}).`,
        notesHint ? `Maker's optional context note: "${notesHint}"` : '',
        'Extract all readable text, dimensions, job/DWG codes, materials, hardware, joinery, and visual details across every drawing, 3D rendering, and photograph.',
        'Return structured JSON matching the schema so the Casegoods Portfolio Manager form can be pre-filled accurately.',
      ]
        .filter(Boolean)
        .join('\n');

      parts.push({ text: userPrompt });

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are the senior architectural millwork estimator and portfolio archivist for casegoods (Omaha, Nebraska — custom furniture, architectural millwork, and specialty commissions). ' +
            'Inspect uploaded 2D CAD/Rhino shop drawings, 3D renderings, and finished build photographs to accurately fill out a portfolio project record.\n' +
            'Rules:\n' +
            '1. Read exact numbers, fractional inches, job codes (like 1070MCG, 1064HEM), or material callouts whenever visible on 2D CAD drawings or title blocks.\n' +
            '2. Never invent fake client names or fake drawing codes. Only populate "recipient" if a client or location is explicitly visible or provided in the maker note; leave "recipient" empty string otherwise. If no job/DWG code is visible in the drawings or filenames, suggest a clean short code like "CG-BUILD" or leave empty string.\n' +
            '3. Classify "categoryTag" strictly as one of: "architectural" (built-ins, cabinetry, credenzas, mudrooms, wall systems, residential millwork), "commercial" (wet bars, kitchen islands, reception desks, hospitality/retail fixtures), or "furniture" (standalone tables, heirloom furniture, specialty pieces, play kitchens).\n' +
            '4. Keep "title", "category", "materials", "dimensions", and "tolerance" crisp and uppercase-ready. Separate items in "materials" with " · " (e.g. "SOLID AMERICAN BLACK WALNUT · RIFT WHITE OAK · SOFT-CLOSE HARDWARE").\n' +
            '5. Write "description" as 2-3 understated, craft-focused sentences describing the joinery, wood species, proportions, and architectural integration — no hype or marketing clichés.\n' +
            '6. Provide 3 to 5 concise "specs" rows (e.g. PRIMARY HARDWOODS, FINISH, JOINERY & HARDWARE, DIMENSIONS / CLEARANCES).\n' +
            '7. For EVERY uploaded image (matching each 0-based index), return an entry in "sheets" classifying "type" as "cad" (2D technical line drawing/elevation/plan/section), "render" (3D computer rendering), or "photo" (real photograph of a built piece or installation), a crisp "sheetNumber" (e.g. "PHOTO 01", "SHEET 01", "CAD A1"), and a concise 1-sentence "caption" describing that specific view.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              code: {
                type: Type.STRING,
                description:
                  'Job or DWG code read from CAD title block or filename (e.g. 1070MCG), or empty string if none visible.',
              },
              title: {
                type: Type.STRING,
                description: 'Concise uppercase project title (e.g. FLUTED WALNUT CREDENZA & WINDOW BENCH).',
              },
              recipient: {
                type: Type.STRING,
                description:
                  'Client or location ONLY if explicitly visible in drawings or notes; otherwise empty string.',
              },
              category: {
                type: Type.STRING,
                description: 'Short uppercase category label (e.g. ARCHITECTURAL BUILT-IN, CUSTOM WET BAR, HEIRLOOM FURNITURE).',
              },
              categoryTag: {
                type: Type.STRING,
                description: 'Must be exactly one of: architectural, commercial, furniture.',
              },
              dimensions: {
                type: Type.STRING,
                description:
                  'Exact overall dimensions read from CAD drawings (e.g. 101" H × 72 3/4" W × 20" D), or empty string if not determinable.',
              },
              tolerance: {
                type: Type.STRING,
                description:
                  'Build status & tolerance tag (e.g. FINISHED BUILD · ± 1/32" or 3D DESIGN PROPOSAL · ± 1/32").',
              },
              materials: {
                type: Type.STRING,
                description:
                  'Materials highlight bar separated by middle dots (e.g. SOLID BLACK WALNUT · WHITE OAK · BRASS PULLS).',
              },
              description: {
                type: Type.STRING,
                description:
                  '2-3 understated, craft-focused sentences describing design, hardwoods, joinery, and finished installation.',
              },
              specs: {
                type: Type.ARRAY,
                description: '3 to 5 technical specification rows.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.STRING },
                  },
                  required: ['label', 'value'],
                },
              },
              sheets: {
                type: Type.ARRAY,
                description: 'Per-image classification and caption matching every uploaded image index.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    index: { type: Type.INTEGER },
                    type: {
                      type: Type.STRING,
                      description: 'Must be exactly one of: photo, render, cad.',
                    },
                    sheetNumber: {
                      type: Type.STRING,
                      description: 'Short uppercase tab label like PHOTO 01, SHEET 01, or CAD A1.',
                    },
                    caption: {
                      type: Type.STRING,
                      description: 'Concise 1-sentence description of this specific view.',
                    },
                  },
                  required: ['index', 'type', 'sheetNumber', 'caption'],
                },
              },
              confidenceNote: {
                type: Type.STRING,
                description:
                  'Brief 1-sentence note flagging anything uncertain or estimated so the maker can double-check (e.g. dimensions estimated or code left blank).',
              },
            },
            required: [
              'code',
              'title',
              'recipient',
              'category',
              'categoryTag',
              'dimensions',
              'tolerance',
              'materials',
              'description',
              'specs',
              'sheets',
              'confidenceNote',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Analysis returned an empty response. Please try again.' });
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        res.status(502).json({ error: 'Unable to parse structured analysis response. Please retry.' });
        return;
      }

      const rawTag = String(parsed.categoryTag || '').toLowerCase().trim();
      const categoryTag =
        rawTag === 'commercial' || rawTag === 'furniture' || rawTag === 'architectural'
          ? rawTag
          : 'architectural';

      const specs = Array.isArray(parsed.specs)
        ? parsed.specs
            .map((s: unknown) => {
              const obj = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
              return {
                label: String(obj.label || '').trim().toUpperCase(),
                value: String(obj.value || '').trim(),
              };
            })
            .filter((s) => s.label && s.value)
            .slice(0, 8)
        : [];

      const sheets = Array.isArray(parsed.sheets)
        ? parsed.sheets
            .map((s: unknown) => {
              const obj = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
              const t = String(obj.type || '').toLowerCase().trim();
              const type: 'photo' | 'render' | 'cad' =
                t === 'cad' || t === 'render' || t === 'photo' ? t : 'photo';
              return {
                index: Number(obj.index),
                type,
                sheetNumber: String(obj.sheetNumber || '').trim().toUpperCase(),
                caption: String(obj.caption || '').trim(),
              };
            })
            .filter((s) => Number.isInteger(s.index) && s.index >= 0 && s.index < rawImages.length)
        : [];

      res.json({
        analysis: {
          code: String(parsed.code || '').trim().toUpperCase(),
          title: String(parsed.title || '').trim().toUpperCase(),
          recipient: String(parsed.recipient || '').trim().toUpperCase(),
          category: String(parsed.category || '').trim().toUpperCase(),
          categoryTag,
          dimensions: String(parsed.dimensions || '').trim().toUpperCase(),
          tolerance: String(parsed.tolerance || '').trim().toUpperCase(),
          materials: String(parsed.materials || '').trim().toUpperCase(),
          description: String(parsed.description || '').trim(),
          specs,
          sheets,
          confidenceNote: String(parsed.confidenceNote || '').trim(),
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error || '');
      console.error('Error in /api/admin/projects/analyze-images:', error);
      if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
        res.status(403).json({
          error:
            'Gemini API key was rejected. Check your GEMINI_API_KEY in Settings > Secrets and try again.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error:
            'Gemini API quota limit reached. Try again shortly or attach a billed API key in Settings > Secrets.',
        });
        return;
      }
      res.status(500).json({
        error: msg || 'Failed to analyze project images.',
      });
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

      const textureRef = safeVisualStyle === 'render-3d' ? loadMaterialTextureRef(cleanWood) : null;

      let generatedResult: { base64: string; mimeType: string; engine: string } | null = null;
      let geminiBillingError: string | undefined;

      if (validatedSourceImage) {
        // True image-to-image requires Gemini multimodal API
        if (!getGeminiApiKey()) {
          res.status(503).json({
            error:
              'Room photo visualization and image refinement require GEMINI_API_KEY to be configured on the server.',
          });
          return;
        }
        const geminiAttempt = await generateWithGeminiImage({
          prompt,
          sourceImage: validatedSourceImage,
          sourceImageMode: safeSourceMode,
          textureRef,
        });
        generatedResult = geminiAttempt.result;
        geminiBillingError = geminiAttempt.billingError;

        if (!generatedResult) {
          res.status(geminiBillingError ? 402 : 503).json({
            error:
              geminiBillingError ||
              'Gemini image editing is momentarily busy or could not process this photo. Please try again in a few seconds.',
          });
          return;
        }
      } else {
        // 1. Primary: Gemini Image Generation (if GEMINI_API_KEY is configured)
        const geminiAttempt = await generateWithGeminiImage({
          prompt,
          sourceImage: null,
          sourceImageMode: 'room-photo',
          textureRef,
        });
        generatedResult = geminiAttempt.result;
        geminiBillingError = geminiAttempt.billingError;

        // 2. Fallback to Cloud Open-Source Engine: Black Forest Labs FLUX.1-schnell (8-Step HD)
        if (!generatedResult) {
          generatedResult = await generateWithOpenSourceFluxSpace(prompt);
        }

        // 3. Fallback to Secondary Cloud Open-Source Engine: Pollinations FLUX (enhance=false)
        if (!generatedResult) {
          generatedResult = await generateWithPollinationsFlux(prompt);
        }

        if (!generatedResult) {
          res.status(geminiBillingError ? 402 : 503).json({
            error:
              geminiBillingError ||
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
