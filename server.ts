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
    const response = await fetch('https://formsubmit.co/ajax/casegoodsne@gmail.com', {
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
 * Exact Woodworking Timber & Material Specifications for FLUX.1
 */
function buildTimberConstraint(woodSpecies: string): string {
  const key = woodSpecies.trim().toLowerCase();
  if (key.includes('walnut')) {
    return 'Select FAS heartwood American Black Walnut with continuous vertical book-matched cathedral grain, rich chocolate-brown tones, and a hand-rubbed satin oil-urethane finish.';
  }
  if (key.includes('white oak') || key.includes('oak')) {
    return 'Select rift-sawn and quarter-sawn White Oak with tight straight vertical grain, subtle medullary rays, and a dead-flat clear matte waterborne finish.';
  }
  if (key.includes('maple')) {
    return 'Select hard white Sugar Maple with creamy uniform fine grain, crisp machined edges, and a satin clear waterborne finish.';
  }
  if (key.includes('cherry')) {
    return 'Select American Black Cherry hardwood with warm reddish-amber heartwood grain, smooth closed pores, and a hand-rubbed satin finish.';
  }
  if (key.includes('mahogany')) {
    return 'Select Genuine Honduras Mahogany with deep ribbon-stripe interlocking grain and an architectural satin finish.';
  }
  if (key.includes('laminate')) {
    return 'Architectural-grade ultra-matte high-pressure laminate (HPL) cabinet faces bonded to exposed multi-ply Baltic Birch plywood edges with crisp CNC-machined reveals.';
  }
  return `Select architectural-grade ${woodSpecies} hardwood with continuous grain-matched boards and a hand-rubbed satin finish.`;
}

/**
 * Exact Cabinetry & Joinery Detail Specifications for FLUX.1
 */
function buildJoineryDetailConstraint(addedDetails: string): string {
  const key = addedDetails.trim().toLowerCase();
  if (key.includes('full overlay')) {
    return 'Frameless full-overlay flat-panel slab doors and drawer fronts with razor-sharp, uniform 1/16-inch vertical and horizontal shadow-line reveals.';
  }
  if (key.includes('flush inset')) {
    return 'Precision flush-inset cabinet doors and drawer fronts sitting perfectly coplanar inside a solid 3/4-inch hardwood face frame with uniform 1/16-inch perimeter reveals.';
  }
  if (key.includes('pocket') || key.includes('retracting')) {
    return 'Tall retracting pocket doors engineered to slide cleanly back into concealed side bays, shown partially open to reveal the fitted interior millwork.';
  }
  if (key.includes('open cabinets') || key.includes('no doors')) {
    return 'Open architectural shelving bays and cubbies with no doors, showcasing thick 1-1/4-inch solid hardwood dividers and clean interior joinery.';
  }
  if (key.includes('tambour')) {
    return 'Precision-milled narrow vertical solid hardwood tambour slats tracking smoothly around radiused cabinet corners.';
  }
  if (key.includes('glass-front') || key.includes('glass')) {
    return 'Solid hardwood stile-and-rail display doors with narrow architectural profiles and clear low-iron tempered glass panes.';
  }
  if (key.includes('fluted') || key.includes('reeded')) {
    return 'Deep CNC-milled vertical semicircular fluting and reeded texture carved directly into solid hardwood door and drawer panels.';
  }
  if (key.includes('louvered') || key.includes('slatted')) {
    return 'Architectural horizontal slatted and louvered solid hardwood doors with uniform shadow gaps between each wood bar.';
  }
  if (key.includes('dovetail')) {
    return 'Exposed through-dovetail and half-blind dovetail solid hardwood drawer boxes with clean architectural drawer fronts.';
  }
  if (key.includes('push-to-open') || key.includes('touch latch')) {
    return 'Handleless push-to-open architectural doors and drawers with zero visible hardware pulls or knobs, relying on crisp shadow-line reveals.';
  }
  if (key.includes('turned hardwood pulls') || key.includes('turned')) {
    return 'Bespoke lathe-turned solid hardwood cylindrical and stacked-profile pulls mounted cleanly to the cabinet faces.';
  }
  if (key.includes('led')) {
    return 'Recessed warm 2700K architectural LED linear light channels milled flush into the underside of shelves and cabinet stiles, casting a soft warm graze across the wood grain.';
  }
  if (key.includes('floating shelves')) {
    return 'Thick 1-3/4-inch solid hardwood floating shelves with concealed steel knife-brackets and continuous grain wrap.';
  }
  if (key.includes('waterfall')) {
    return 'Precision 45-degree compound waterfall mitred top-to-side case corners where the wood grain wraps continuously over the edge and down the vertical side gable.';
  }
  if (key.includes('finger') || key.includes('tenon')) {
    return 'Exposed 3/4-inch box finger-joints and wedged through-tenon joinery along the solid hardwood case corners as the signature structural detail.';
  }
  return `Custom architectural millwork detail: ${addedDetails}, executed with +/- 1/32-inch shop tolerances and crisp shadow-line reveals.`;
}

/**
 * Exact Architectural Design Movement Proportions for FLUX.1
 */
function buildStyleConstraint(designStyle: string): string {
  const key = designStyle.trim().toLowerCase();
  if (key.includes('bauhaus')) {
    return 'Bauhaus architectural proportions with disciplined geometric grid divisions and subtle color-blocked drawer fronts or accents in Bauhaus Orange (#EF6922), Fabrication Blue (#27AAE0), and Golden Yellow (#FDCB33) paired with natural hardwood.';
  }
  if (key.includes('mid-century')) {
    return 'Authentic Mid-Century Modern architectural proportions with clean horizontal lines, tapered or recessed hardwood base plinth, and continuous grain-matched casework.';
  }
  if (key.includes('japandi')) {
    return 'Japandi minimalist architectural proportions with serene horizontal balance, fine slatted or flush joinery, and quiet sculptural restraint.';
  }
  if (key.includes('brutalist')) {
    return 'Architectural Brutalist woodworking with monolithic thick-slab hardwood geometry, deep carved relief shadows, and bold structural massing.';
  }
  if (key.includes('shaker') || key.includes('transitional')) {
    return 'Refined modern Shaker architectural proportions with crisp flat recessed center panels, narrow 2-1/4-inch stiles and rails, and timeless symmetry.';
  }
  return `${designStyle} architectural proportions with disciplined geometric alignment and bespoke cabinetmaker detailing.`;
}

interface SourceImagePayload {
  data: string;
  mimeType: string;
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

function buildVisualizationPrompt(opts: {
  visualStyle: 'render-3d' | 'cad-2d';
  ideaPrompt: string;
  timberSpec: string;
  joinerySpec: string;
  styleSpec: string;
  refinementClause: string;
  hasSourceImage: boolean;
  sourceImageMode: 'room-photo' | 'refine-concept';
}): string {
  const {
    visualStyle,
    ideaPrompt,
    timberSpec,
    joinerySpec,
    styleSpec,
    refinementClause,
    hasSourceImage,
    sourceImageMode,
  } = opts;

  if (hasSourceImage && sourceImageMode === 'room-photo') {
    if (visualStyle === 'cad-2d') {
      return [
        'Use the attached room photo or hand sketch strictly as the spatial layout and architectural reference.',
        'Translate the requested custom woodwork commission into a pure 2D orthographic front elevation architectural CAD shop drawing drafted in crisp black technical ink (#000000) on stark pure white drafting paper (#FFFFFF).',
        `Custom Millwork / Furniture Piece: ${ideaPrompt}.`,
        `Joinery & Elevation Linework Details: ${joinerySpec}`,
        `Architectural Proportions: ${styleSpec}`,
        refinementClause,
        'Match the width, height, alcove proportions, and bay layout suggested by the reference image. Include cabinet door divisions, stile-and-rail profiles, cross-section callouts, and fractional inch dimension lines. Strictly flat 2D technical vector linework: NO 3D perspective, NO photo background, NO photorealistic shading.',
      ]
        .filter(Boolean)
        .join(' ');
    }

    return [
      'Use the attached image as the direct architectural reference. If it is a photograph of a room, wall, or alcove, preserve the exact existing room architecture, walls, flooring, windows, camera angle, perspective, and natural daylight while seamlessly building and installing the custom hardwood furniture or millwork piece directly into the space at realistic physical scale with accurate contact shadows. If the attached image is a hand-drawn sketch, faithfully preserve its exact layout, compartments, and proportions and render it as a finished handcrafted studio photograph.',
      `Custom Commission to Build: ${ideaPrompt}.`,
      `Timber & Finish Specification: ${timberSpec}`,
      `Joinery & Construction Specification: ${joinerySpec}`,
      `Architectural Style & Proportions: ${styleSpec}`,
      refinementClause,
      'Photorealistic architectural photography, crisp natural lighting, realistic wood grain continuity, +/- 1/32-inch cabinetmaker reveals, no text watermarks or labels.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (hasSourceImage && sourceImageMode === 'refine-concept') {
    if (visualStyle === 'cad-2d') {
      return [
        'Edit and translate the exact custom furniture or millwork design shown in the attached image into a pure 2D orthographic front elevation architectural CAD shop drawing in crisp black technical ink (#000000) on stark pure white drafting paper (#FFFFFF).',
        `Original Commission Context: ${ideaPrompt}.`,
        `Joinery & Elevation Linework Details: ${joinerySpec}`,
        `Architectural Proportions: ${styleSpec}`,
        refinementClause,
        'Preserve the exact bay layout, door count, drawer configuration, and overall silhouette from the attached image while applying any requested revision. Show exact cabinet divisions, stile-and-rail profiles, and fractional inch dimension lines. Strictly flat 2D CAD linework with NO perspective, NO shading, NO room background.',
      ]
        .filter(Boolean)
        .join(' ');
    }

    return [
      'Edit the custom furniture or architectural millwork design shown in the attached image while preserving its core structure, silhouette, camera framing, and clean studio setting (or room setting if already placed in a room).',
      `Commission Context: ${ideaPrompt}.`,
      `Timber & Finish Specification: ${timberSpec}`,
      `Joinery & Construction Specification: ${joinerySpec}`,
      `Architectural Style & Proportions: ${styleSpec}`,
      refinementClause,
      'Apply the requested refinement accurately with photorealistic studio architectural lighting, continuous hardwood grain, crisp +/- 1/32-inch joinery reveals, and zero text watermarks.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return visualStyle === 'cad-2d'
    ? [
        'Pure 2D orthographic front elevation architectural CAD shop drawing drafted in crisp black technical ink (#000000) on stark pure white drafting paper (#FFFFFF).',
        `Custom Millwork / Furniture Piece: ${ideaPrompt}.`,
        `Joinery & Elevation Linework Details: ${joinerySpec}`,
        `Architectural Proportions: ${styleSpec}`,
        refinementClause,
        'Show exact cabinet door divisions, stile-and-rail profiles, cross-section callout lines, and fractional inch dimension ticks. Strictly flat 2D technical vector linework: NO 3D perspective, NO room background, NO photorealistic wood shading, NO grey gradients.',
      ]
        .filter(Boolean)
        .join(' ')
    : [
        'Architectural studio photography of a single bespoke handcrafted furniture or architectural millwork commission, shot on a 50mm tilt-shift lens at eye level, straight-on front elevation or gentle 3/4 view with strictly vertical plumb lines and zero wide-angle distortion.',
        `Hero Piece: ${ideaPrompt}.`,
        `Timber & Finish Specification: ${timberSpec}`,
        `Joinery & Construction Specification: ${joinerySpec}`,
        `Architectural Style & Proportions: ${styleSpec}`,
        refinementClause,
        'Environment & Framing Constraint: The custom woodwork piece fills the center of the frame against a clean, quiet smooth white architectural gallery wall and neutral floor with soft natural side daylight. Strictly NO room clutter, NO houseplants, NO throw pillows, NO rugs, NO decorative knick-knacks, NO people.',
      ]
        .filter(Boolean)
        .join(' ');
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

      const timberSpec = buildTimberConstraint(String(woodSpecies));
      const joinerySpec = buildJoineryDetailConstraint(String(addedDetails));
      const styleSpec = buildStyleConstraint(String(designStyle));
      const refinementClause = cleanRefinement
        ? `Mandatory design revision: ${cleanRefinement}.`
        : '';

      const prompt = buildVisualizationPrompt({
        visualStyle: safeVisualStyle,
        ideaPrompt: cleanIdeaPrompt || 'Custom handcrafted hardwood furniture commission',
        timberSpec,
        joinerySpec,
        styleSpec,
        refinementClause,
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
