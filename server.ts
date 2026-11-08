import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

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
  const PORT = 3000;

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

  // GET /api/generated-concepts — Returns all concepts generated through the visualizer
  app.get('/api/generated-concepts', (_req, res) => {
    const records = readConceptLog();
    res.json({ concepts: records });
  });

  // POST /api/visualize-concept — Render a 3D Hardwood Proposal or 2D CAD Sketch using Cloud Open-Source FLUX.1
  app.post('/api/visualize-concept', async (req, res) => {
    try {
      const {
        ideaPrompt = '',
        visualStyle = 'render-3d',
        woodSpecies = 'American Black Walnut',
        designStyle = 'Mid-Century Modern',
        addedDetails = 'Full Overlay Doors',
        refinementPrompt = '',
      } = req.body || {};

      if (!ideaPrompt.trim() && !refinementPrompt.trim()) {
        res.status(400).json({
          error: 'Please enter a description of your custom furniture or millwork idea.',
        });
        return;
      }

      const timberSpec = buildTimberConstraint(woodSpecies);
      const joinerySpec = buildJoineryDetailConstraint(addedDetails);
      const styleSpec = buildStyleConstraint(designStyle);

      const refinementClause = refinementPrompt.trim()
        ? `Mandatory design revision: ${refinementPrompt.trim()}.`
        : '';

      const fullOpenSourcePrompt =
        visualStyle === 'cad-2d'
          ? [
              'Pure 2D orthographic front elevation architectural CAD shop drawing drafted in crisp black technical ink (#000000) on stark pure white drafting paper (#FFFFFF).',
              `Custom Millwork / Furniture Piece: ${ideaPrompt.trim()}.`,
              `Joinery & Elevation Linework Details: ${joinerySpec}`,
              `Architectural Proportions: ${styleSpec}`,
              refinementClause,
              'Show exact cabinet door divisions, stile-and-rail profiles, cross-section callout lines, and fractional inch dimension ticks. Strictly flat 2D technical vector linework: NO 3D perspective, NO room background, NO photorealistic wood shading, NO grey gradients.',
            ]
              .filter(Boolean)
              .join(' ')
          : [
              'Architectural studio photography of a single bespoke handcrafted furniture or architectural millwork commission, shot on a 50mm tilt-shift lens at eye level, straight-on front elevation or gentle 3/4 view with strictly vertical plumb lines and zero wide-angle distortion.',
              `Hero Piece: ${ideaPrompt.trim()}.`,
              `Timber & Finish Specification: ${timberSpec}`,
              `Joinery & Construction Specification: ${joinerySpec}`,
              `Architectural Style & Proportions: ${styleSpec}`,
              refinementClause,
              'Environment & Framing Constraint: The custom woodwork piece fills the center of the frame against a clean, quiet smooth white architectural gallery wall and neutral floor with soft natural side daylight. Strictly NO room clutter, NO houseplants, NO throw pillows, NO rugs, NO decorative knick-knacks, NO people.',
            ]
              .filter(Boolean)
              .join(' ');

      // 1. Try Primary Cloud Open-Source Engine: Black Forest Labs FLUX.1-schnell (8-Step HD)
      let generatedResult = await generateWithOpenSourceFluxSpace(fullOpenSourcePrompt);

      // 2. Fallback to Secondary Cloud Open-Source Engine: Pollinations FLUX (enhance=false)
      if (!generatedResult) {
        generatedResult = await generateWithPollinationsFlux(fullOpenSourcePrompt);
      }

      if (!generatedResult) {
        res.status(503).json({
          error:
            'The cloud open-source FLUX.1 render queue is momentarily busy. Please click GENERATE CUSTOM CONCEPT again in a few seconds.',
        });
        return;
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

      // Dispatch automatic email notification to Josh (casegoodsne@gmail.com) in background
      dispatchConceptEmailToOwner(record).then((sent) => {
        record.emailedToOwner = sent;
        appendConceptLog(record);
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
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
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
