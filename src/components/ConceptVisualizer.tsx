import React, { useRef, useState, useEffect } from 'react';
import {
  Upload,
  X,
  Download,
  Maximize2,
  ArrowRight,
  RefreshCw,
  Check,
  Image as ImageIcon,
  MessageSquare,
  Mail,
  FolderOpen,
} from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import {
  renderWatermarkedSheet,
  downloadWatermarkedSheet,
} from '../utils/watermarkSheet.ts';
import { useAuth } from '../context/AuthContext.tsx';

/**
 * Loads /assets/aistudio/IMG_4823_b2889f31.JPG, strips out the checkerboard background
 * pixels, and tightly crops to the isometric 3D wireframe cube so it renders cleanly.
 */
const ProcessedCubeIcon: React.FC<{ src: string; className?: string }> = ({
  src,
  className = 'w-4 h-4 object-contain shrink-0',
}) => {
  const [cleanDataUrl, setCleanDataUrl] = useState<string>(src);

  useEffect(() => {
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const lum = (d[idx] + d[idx + 1] + d[idx + 2]) / 3;
            if (lum > 175) {
              d[idx + 3] = 0;
            } else {
              const alpha = Math.min(255, Math.max(0, Math.round(((195 - lum) / 155) * 255)));
              d[idx] = 0;
              d[idx + 1] = 0;
              d[idx + 2] = 0;
              d[idx + 3] = alpha;
              if (alpha > 25) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        if (maxX > minX && maxY > minY) {
          const pad = 6;
          const cropX = Math.max(0, minX - pad);
          const cropY = Math.max(0, minY - pad);
          const cropW = Math.min(w - cropX, maxX - minX + pad * 2);
          const cropH = Math.min(h - cropY, maxY - minY + pad * 2);

          const outCanvas = document.createElement('canvas');
          outCanvas.width = cropW;
          outCanvas.height = cropH;
          const outCtx = outCanvas.getContext('2d');
          if (outCtx) {
            outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            if (active) {
              setCleanDataUrl(outCanvas.toDataURL('image/png'));
            }
          }
        }
      } catch {
        // Fallback to raw src if canvas manipulation fails
      }
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);

  return <img src={cleanDataUrl} alt="" className={className} />;
};

export type VisualStyleMode = 'render-3d' | 'cad-2d';

export interface GeneratedConceptItem {
  id: string;
  filename?: string;
  imageUrl: string;
  publicPath?: string;
  fullImageUrl?: string;
  base64Data: string;
  mimeType: string;
  visualStyle: VisualStyleMode;
  ideaPrompt: string;
  woodSpecies: string;
  designStyle: string;
  addedDetails: string;
  summarySpec: string;
  modelEngine?: string;
  timestamp: string;
}

export interface UploadedRoomPhoto {
  name: string;
  mimeType: string;
  dataUrl: string;
  base64Data: string;
}

export interface ConceptVisualizerState {
  ideaPrompt: string;
  visualStyle: VisualStyleMode;
  woodSpecies: string;
  customWoodText: string;
  designStyle: string;
  customStyleText: string;
  addedDetails: string;
  customDetailsText: string;
  uploadedPhoto: UploadedRoomPhoto | null;
  history: GeneratedConceptItem[];
  activeConceptId: string | null;
}

interface ConceptVisualizerProps {
  placement: 'visualizer' | 'methodology' | 'inquire';
  state: ConceptVisualizerState;
  onChangeState: React.Dispatch<React.SetStateAction<ConceptVisualizerState>>;
  onSendToInquiry?: (concept: GeneratedConceptItem | null) => void;
  onApplyToInquiryForm?: (concept: GeneratedConceptItem) => void;
}

const WOOD_OPTIONS = [
  'American Black Walnut',
  'Rift White Oak',
  'Hard White Maple',
  'Ebonized / Blackened Ash',
  'Matte HPL + Exposed Baltic Birch Ply',
  'Custom / Exotic Material',
];

const WOOD_SWATCH_META: Record<
  string,
  { color: string; hint: string; textureUrl?: string }
> = {
  'American Black Walnut': {
    color: '#4A3222',
    hint: 'Dark chocolate heartwood',
    textureUrl: '/assets/textures/american-black-walnut.jpg',
  },
  'Rift White Oak': {
    color: '#CBB89D',
    hint: 'Pale raw wheat-straw',
    textureUrl: '/assets/textures/rift-white-oak.jpg',
  },
  'Hard White Maple': {
    color: '#E8D8BE',
    hint: 'Bright creamy blonde',
    textureUrl: '/assets/textures/hard-white-maple.jpg',
  },
  'Ebonized / Blackened Ash': {
    color: '#1E1E1E',
    hint: 'Matte jet-black open grain',
    textureUrl: '/assets/textures/ebonized-blackened-ash.jpg',
  },
  'Matte HPL + Exposed Baltic Birch Ply': {
    color: '#E5E1D8',
    hint: 'Matte laminate + ply edges',
    textureUrl: '/assets/textures/matte-hpl-baltic-birch.jpg',
  },
  'Custom / Exotic Material': {
    color: '#EF6922',
    hint: 'Custom timber, metal or stone',
  },
};

const DESIGN_STYLE_OPTIONS = [
  'Bauhaus & Color-Blocked',
  'Architectural Minimalist',
  'Sculptural & Radiused',
  'Mid-Century Low-Slung',
  'Modular & Structural',
  'Custom Direction',
];

const ADDED_DETAILS_GROUPS: { group: string; options: string[] }[] = [
  {
    group: 'DOORS & ACCESS',
    options: [
      'Curved Sliding Tambour',
      'Retracting Pocket Doors',
      'Flush Inset Frame',
      'Open Architectural Shelving',
    ],
  },
  {
    group: 'TEXTURE & JOINERY',
    options: [
      'Deep Fluted / Reeded Faces',
      'Exposed Box Finger-Joints',
      'Exposed Dovetail Drawers',
      '45° Waterfall Miters',
    ],
  },
  {
    group: 'HARDWARE & LIGHTING',
    options: [
      'Turned Hardwood Pulls',
      'Handleless Push-to-Open',
      'Recessed 2700K LED Lighting',
      'Custom Detail',
    ],
  },
];

/**
 * Mutually exclusive detail groups so the user never sends contradictory instructions to Gemini.
 */
const EXCLUSIVE_DETAIL_GROUPS: string[][] = [
  [
    'Open Architectural Shelving',
    'Curved Sliding Tambour',
    'Retracting Pocket Doors',
    'Flush Inset Frame',
  ],
  ['Handleless Push-to-Open', 'Turned Hardwood Pulls'],
];

const MAX_SELECTED_DETAILS = 3;

/**
 * 4 Signature Casegoods Project Concept Templates
 */
const QUICK_IDEA_PRESETS = [
  {
    label: '01 / SCULPTURAL WET BAR',
    prompt:
      'A curved, freestanding wet bar island with wraparound fluted tambour paneling, a cantilevered solid-wood bartop, hidden bottle storage, and unexpected Bauhaus color-blocked interior drawers.',
    wood: 'Rift White Oak',
    style: 'Sculptural & Radiused',
    details: 'Curved Sliding Tambour + Recessed 2700K LED Lighting',
  },
  {
    label: '02 / MODULAR MORTISE WALL',
    prompt:
      'A floor-to-ceiling architectural peg-and-mortise hardwood wall system with reconfigurable cantilevered shelves, a drop-down writing desk, hidden cable channels, and suspended credenza modules.',
    wood: 'Hard White Maple',
    style: 'Modular & Structural',
    details: 'Exposed Box Finger-Joints + Open Architectural Shelving',
  },
  {
    label: '03 / HI-FI LISTENING CONSOLE',
    prompt:
      'A statement audiophile credenza engineered for a turntable, tube amp, and vinyl archive—featuring deep-fluted solid walnut doors, acoustic slatted speaker bays, exposed box-jointed corners, and lathe-turned hardwood pulls.',
    wood: 'American Black Walnut',
    style: 'Mid-Century Low-Slung',
    details:
      'Deep Fluted / Reeded Faces + Exposed Box Finger-Joints + Turned Hardwood Pulls',
  },
  {
    label: '04 / HIDDEN-FUNCTION BUILT-IN',
    prompt:
      'A full-wall architectural built-in wrapping an awkward alcove—combining a deep window bench, retracting pocket doors that conceal a full home bar or workspace, and asymmetrical display cubbies.',
    wood: 'Ebonized / Blackened Ash',
    style: 'Architectural Minimalist',
    details:
      'Retracting Pocket Doors + Recessed 2700K LED Lighting + Handleless Push-to-Open',
  },
];

interface ServerLoggedConcept {
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
}

export const ConceptVisualizer: React.FC<ConceptVisualizerProps> = ({
  placement,
  state,
  onChangeState,
  onSendToInquiry,
  onApplyToInquiryForm,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [refinementText, setRefinementText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fullscreenConcept, setFullscreenConcept] = useState<GeneratedConceptItem | null>(null);
  const [syncedNotice, setSyncedNotice] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveList, setArchiveList] = useState<ServerLoggedConcept[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const { user, getFreshToken, signInWithGoogle, signOutUser } = useAuth();
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const OWNER_PHONE = '+14028308782';
  const OWNER_PHONE_DISPLAY = '402-830-8782';
  const OWNER_EMAIL = 'josh@casegoodsomaha.com';

  const activeConcept =
    state.history.find((item) => item.id === state.activeConceptId) ||
    state.history[0] ||
    null;

  const resolvedWoodSpecies =
    state.woodSpecies === 'Custom / Exotic Material'
      ? state.customWoodText.trim() || 'Exotic Hardwood'
      : state.woodSpecies;

  const selectedDetailsList = state.addedDetails
    .split(/\s*\+\s*/)
    .map((d) => d.trim())
    .filter(Boolean);

  const hasCustomDetailSelected = selectedDetailsList.includes('Custom Detail');

  const toggleAddedDetail = (detailOpt: string) => {
    onChangeState((prev) => {
      const current = prev.addedDetails
        .split(/\s*\+\s*/)
        .map((d) => d.trim())
        .filter(Boolean);

      if (current.includes(detailOpt)) {
        const next = current.filter((d) => d !== detailOpt);
        return {
          ...prev,
          addedDetails: next.join(' + '),
        };
      }

      // Remove any mutually exclusive option from the same group
      let filtered = [...current];
      for (const group of EXCLUSIVE_DETAIL_GROUPS) {
        if (group.includes(detailOpt)) {
          filtered = filtered.filter((d) => !group.includes(d));
        }
      }

      // Cap at MAX_SELECTED_DETAILS (dropping the oldest selected if already at max)
      if (filtered.length >= MAX_SELECTED_DETAILS) {
        filtered = filtered.slice(filtered.length - (MAX_SELECTED_DETAILS - 1));
      }
      filtered.push(detailOpt);

      return {
        ...prev,
        addedDetails: filtered.join(' + '),
      };
    });
  };

  const resolvedDesignStyle =
    state.designStyle === 'Custom Direction'
      ? state.customStyleText.trim() || 'Custom Studio Direction'
      : state.designStyle;

  const resolvedAddedDetails =
    selectedDetailsList
      .map((d) =>
        d === 'Custom Detail' ? state.customDetailsText.trim() || 'Custom Millwork Detail' : d
      )
      .filter(Boolean)
      .join(' + ') || 'Clean Architectural Millwork';

  const hasSettingsChanged = Boolean(
    activeConcept &&
      (activeConcept.woodSpecies !== resolvedWoodSpecies ||
        activeConcept.designStyle !== resolvedDesignStyle ||
        activeConcept.addedDetails !== resolvedAddedDetails ||
        activeConcept.visualStyle !== state.visualStyle)
  );

  const fetchServerArchive = async () => {
    setLoadingArchive(true);
    try {
      const res = await fetch('/api/generated-concepts');
      if (res.ok) {
        const data = await res.json();
        setArchiveList(Array.isArray(data.concepts) ? data.concepts : []);
      }
    } catch {
      // Ignore background archive fetch errors
    } finally {
      setLoadingArchive(false);
    }
  };

  useEffect(() => {
    if (showArchiveModal) {
      fetchServerArchive();
    }
  }, [showArchiveModal]);

  const parseDataUrl = (dataUrl: string): { mimeType: string; base64Data: string } => {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return { mimeType: 'image/png', base64Data: '' };
    }
    return { mimeType: match[1], base64Data: match[2] };
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;

      const applyPhoto = (dataUrl: string, fallbackMime: string) => {
        const { mimeType, base64Data } = parseDataUrl(dataUrl);
        if (base64Data) {
          onChangeState((prev) => ({
            ...prev,
            uploadedPhoto: {
              name: file.name,
              mimeType: mimeType || fallbackMime,
              dataUrl,
              base64Data,
            },
          }));
        }
      };

      // Downscale very large phone photos (>1600px) so room-photo uploads stay fast & under Gemini's inline limit
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let targetW = img.naturalWidth || 1200;
        let targetH = img.naturalHeight || 900;

        if (targetW > MAX_DIM || targetH > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
          targetW = Math.round(targetW * ratio);
          targetH = Math.round(targetH * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressedUrl =
            outputMime === 'image/png'
              ? canvas.toDataURL('image/png')
              : canvas.toDataURL('image/jpeg', 0.88);
          applyPhoto(compressedUrl, outputMime);
          return;
        }
        applyPhoto(rawDataUrl, file.type || 'image/jpeg');
      };
      img.onerror = () => applyPhoto(rawDataUrl, file.type || 'image/jpeg');
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearPhoto = () => {
    onChangeState((prev) => ({ ...prev, uploadedPhoto: null }));
  };

  const runGeneration = async (mode: 'new' | 'refine', overrideStyle?: VisualStyleMode) => {
    const targetStyle = overrideStyle ?? state.visualStyle;
    const promptToUse = state.ideaPrompt.trim();

    if (!promptToUse && mode === 'new') {
      setErrorMsg('Please describe your custom furniture or built-in idea first.');
      return;
    }

    if (
      state.woodSpecies === 'Custom / Exotic Material' &&
      !state.customWoodText.trim() &&
      mode === 'new'
    ) {
      setErrorMsg('Please enter the custom timber, metal, or material you have in mind.');
      return;
    }

    if (hasCustomDetailSelected && !state.customDetailsText.trim() && mode === 'new') {
      setErrorMsg('Please enter the custom cabinetry or furniture detail you have in mind.');
      return;
    }

    if (mode === 'refine' && !refinementText.trim() && !overrideStyle && !hasSettingsChanged) {
      setErrorMsg(
        'Change a timber, style, or detail setting above — or enter a refinement note first.'
      );
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);

    try {
      let sourceImage: { data: string; mimeType: string } | null = null;
      let sourceImageMode: 'room-photo' | 'refine-concept' = 'room-photo';

      if (mode === 'refine' && activeConcept) {
        sourceImage = {
          data: activeConcept.base64Data,
          mimeType: activeConcept.mimeType,
        };
        sourceImageMode = 'refine-concept';
      } else if (state.uploadedPhoto) {
        sourceImage = {
          data: state.uploadedPhoto.base64Data,
          mimeType: state.uploadedPhoto.mimeType,
        };
        sourceImageMode = 'room-photo';
      }

      const token = await getFreshToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const previousSpecs =
        mode === 'refine' && activeConcept
          ? {
              visualStyle: activeConcept.visualStyle,
              woodSpecies: activeConcept.woodSpecies,
              designStyle: activeConcept.designStyle,
              addedDetails: activeConcept.addedDetails,
            }
          : null;

      const effectiveRefinementPrompt =
        mode === 'refine'
          ? refinementText.trim() ||
            (overrideStyle === 'cad-2d'
              ? 'Convert this exact design into a dimensioned 2D Rhino CAD elevation shop drawing'
              : overrideStyle === 'render-3d'
              ? 'Render this exact design as a photorealistic 3D studio hardwood proposal'
              : 'Update this exact piece to match the newly selected timber, style, and cabinetry details while keeping its core layout and proportions')
          : '';

      const response = await fetch('/api/visualize-concept', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ideaPrompt: promptToUse || activeConcept?.ideaPrompt || 'Custom wood project',
          visualStyle: targetStyle,
          woodSpecies: resolvedWoodSpecies,
          designStyle: resolvedDesignStyle,
          addedDetails: resolvedAddedDetails,
          refinementPrompt: effectiveRefinementPrompt,
          sourceImage,
          sourceImageMode,
          previousSpecs,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate concept preview.');
      }

      const { mimeType, base64Data } = parseDataUrl(data.imageUrl);
      const conceptId = data.id || `concept-${Date.now()}`;
      const newConcept: GeneratedConceptItem = {
        id: conceptId,
        filename: data.filename,
        imageUrl: data.imageUrl,
        publicPath: data.publicPath,
        fullImageUrl: data.fullImageUrl || `${window.location.origin}${data.publicPath || ''}`,
        base64Data,
        mimeType,
        visualStyle: targetStyle,
        ideaPrompt: promptToUse || activeConcept?.ideaPrompt || '',
        woodSpecies: resolvedWoodSpecies,
        designStyle: resolvedDesignStyle,
        addedDetails: resolvedAddedDetails,
        summarySpec: data.summarySpec,
        modelEngine: data.modelEngine,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Automatically render the watermarked Casegoods sheet and save it back to the server file
      if (data.filename) {
        renderWatermarkedSheet({
          imageSrc: data.imageUrl,
          projectHeader: `${conceptId.toUpperCase()} — ${resolvedWoodSpecies}`,
          drawingTypeLabel:
            targetStyle === 'cad-2d' ? '2D CAD ELEVATION SKETCH' : '3D HARDWOOD RENDERING',
          bottomSpecLine: `${resolvedWoodSpecies} · ${resolvedDesignStyle} · ${resolvedAddedDetails}`,
          leftBoxFill: '#EF6922',
          leftBoxText: '#000000',
          rightBoxFill: targetStyle === 'cad-2d' ? '#FDCB33' : '#27AAE0',
          rightBoxText: '#000000',
        })
          .then(({ dataUrl: watermarkedDataUrl }) => {
            fetch('/api/save-watermarked-concept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: data.filename,
                watermarkedDataUrl,
              }),
            }).catch(() => {});
          })
          .catch(() => {});
      }

      onChangeState((prev) => ({
        ...prev,
        visualStyle: targetStyle,
        history: [newConcept, ...prev.history],
        activeConceptId: newConcept.id,
      }));

      if (mode === 'refine') {
        setRefinementText('');
      }

      if (onApplyToInquiryForm) {
        onApplyToInquiryForm(newConcept);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to generate visualization right now. Please try again.';
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Reliable Watermarked PNG Download:
   * Composites the full Casegoods architectural sheet frame (1.5px outer border,
   * top-left project name/number box, top-center Casegoods logo, top-right
   * drawing/rendering box, and inner 1px stage frame) onto the saved PNG.
   */
  const handleDownloadConcept = async (concept: GeneratedConceptItem) => {
    const styleSlug = concept.visualStyle === 'cad-2d' ? '2d-cad' : '3d-proposal';
    const downloadFileName = `casegoods-concept-${styleSlug}-${Date.now()}.png`;

    try {
      await downloadWatermarkedSheet(
        {
          imageSrc: concept.imageUrl || concept.publicPath || '',
          projectHeader: `${concept.id.toUpperCase()} — ${concept.woodSpecies}`,
          drawingTypeLabel:
            concept.visualStyle === 'cad-2d'
              ? '2D CAD ELEVATION SKETCH'
              : '3D HARDWOOD RENDERING',
          bottomSpecLine: `${concept.woodSpecies} · ${concept.designStyle} · ${concept.addedDetails}`,
          leftBoxFill: '#EF6922',
          leftBoxText: '#000000',
          rightBoxFill: concept.visualStyle === 'cad-2d' ? '#FDCB33' : '#27AAE0',
          rightBoxText: '#000000',
        },
        downloadFileName
      );
      return;
    } catch {
      // Fallback to server attachment endpoint if canvas conversion fails
    }

    const serverFile =
      concept.filename ||
      (concept.publicPath ? concept.publicPath.split('/').pop() : '');
    if (serverFile) {
      const link = document.createElement('a');
      link.href = `/api/download-concept/${encodeURIComponent(serverFile)}`;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDirectSendToJosh = (concept: GeneratedConceptItem, channel: 'sms' | 'email') => {
    const imageLink = concept.fullImageUrl || `${window.location.origin}${concept.publicPath || ''}`;
    const bodyText = `CASEGOODS CUSTOM CONCEPT GENERATED
Idea: ${concept.ideaPrompt}
Primary Timber: ${concept.woodSpecies}
Design Style: ${concept.designStyle}
Added Details: ${concept.addedDetails}
Format: ${concept.visualStyle === 'cad-2d' ? '2D CAD Elevation Sketch' : '3D Hardwood Render'}
Concept Image Link: ${imageLink}`;

    if (channel === 'sms') {
      window.location.href = `sms:${OWNER_PHONE}?&body=${encodeURIComponent(bodyText)}`;
    } else {
      const subject = `Custom Concept Generated: ${concept.woodSpecies} (${concept.designStyle})`;
      window.location.href = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(bodyText)}`;
    }
  };

  const headerBarBg = 'bg-[#EF6922] text-black';

  return (
    <div>
      {/* Unified Main Framed Concept Studio Container with Incorporated Bauhaus Orange Header */}
      <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] overflow-hidden">
        {/* Incorporated Section Title Block Bar — Bauhaus Orange (#EF6922) + Black Ink */}
        <div
          className={`w-full ${headerBarBg} border-b-[1.5px] border-black px-5 py-3 flex flex-wrap items-center justify-between gap-2 select-none`}
        >
          <span className="text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase font-medium">
            06 / CUSTOM CONCEPT VISUALIZER — TEST YOUR CUSTOM BUILD IDEA IN 3D RENDER OR 2D CAD
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-[0.70rem] tracking-cad uppercase font-medium">
              DWG-CG-006
            </span>
            {user ? (
              <button
                type="button"
                onClick={() => signOutUser()}
                className="bg-black text-white hover:bg-white hover:text-black border border-black rounded-[9px] px-3 py-1 text-[0.66rem] tracking-cad uppercase font-medium transition-colors cursor-pointer"
                title="Sign out of your account"
              >
                {user.displayName || user.email || 'SIGNED IN'} · SIGN OUT
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="bg-[#FDCB33] hover:bg-black text-black hover:text-white border border-black rounded-[9px] px-3 py-1 text-[0.66rem] tracking-cad uppercase font-medium transition-colors cursor-pointer"
                title="Sign in with Google to link your saved concepts to your account"
              >
                GOOGLE SIGN IN
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowArchiveModal(true)}
              className="bg-white hover:bg-black text-black hover:text-white border border-black rounded-[9px] px-3 py-1 text-[0.66rem] tracking-cad uppercase font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
              title="View all customer concepts generated through this visualizer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>STUDIO CONCEPT LOG</span>
            </button>
          </div>
        </div>

        {/* Inner Sheet Body */}
        <div className="p-5 sm:p-7 space-y-6">
          {/* Top Row: Lead Instructions + Output Style Switcher (3D Realistic Rendering vs 2D Elevation Sketch) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black/20 pb-5">
            <div className="text-left space-y-1">
              <p className="text-[0.72rem] tracking-cad uppercase font-medium text-black">
                DESCRIBE A PIECE OR UPLOAD A ROOM PHOTO / HAND SKETCH
              </p>
              <p className="text-[0.90rem] font-light text-black max-w-[68ch]">
                Choose a signature studio template or write your own idea, pick your primary timber,
                design style, and added cabinetry details, and generate a visual concept that is shared with Josh.
              </p>
            </div>

            {/* Visual Representation Mode Toggle */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0"
              role="group"
              aria-label="Visual Output Style"
            >
              <button
                type="button"
                onClick={() =>
                  onChangeState((prev) => ({ ...prev, visualStyle: 'render-3d' }))
                }
                className={`py-2.5 px-4 rounded-[9px] border border-black text-[0.72rem] tracking-cad uppercase transition-colors cursor-pointer flex items-center justify-center gap-2.5 whitespace-nowrap ${
                  state.visualStyle === 'render-3d'
                    ? 'bg-[#EF6922] text-black font-medium'
                    : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
                }`}
              >
                <ProcessedCubeIcon
                  src="/assets/aistudio/IMG_4823_b2889f31.JPG"
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span>3D REALISTIC RENDERING</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeState((prev) => ({ ...prev, visualStyle: 'cad-2d' }))
                }
                className={`py-2.5 px-4 rounded-[9px] border border-black text-[0.72rem] tracking-cad uppercase transition-colors cursor-pointer flex items-center justify-center gap-2.5 whitespace-nowrap ${
                  state.visualStyle === 'cad-2d'
                    ? 'bg-[#FDCB33] text-black font-medium'
                    : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
                }`}
              >
                <img
                  src="/assets/aistudio/Asset-1_70446043.png"
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span>2D ELEVATION SKETCH</span>
              </button>
            </div>
          </div>

          {/* Full-Width Customization Workbench + Full-Width Concept Preview Stage Below */}
          <div className="w-full space-y-5 text-left">
            {/* Row 1: 4 Signature Quick Concept Templates (Full-Width 4-Column Strip) */}
            <div className="space-y-2">
              <span className="block text-[0.68rem] tracking-cad uppercase font-medium text-black">
                QUICK CONCEPT TEMPLATES (4 SIGNATURE STARTING IDEAS):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {QUICK_IDEA_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onChangeState((prev) => ({
                        ...prev,
                        ideaPrompt: preset.prompt,
                        woodSpecies: preset.wood,
                        designStyle: preset.style,
                        addedDetails: preset.details,
                      }))
                    }
                    className="py-2.5 px-3.5 rounded-[9px] border border-black bg-white hover:bg-[#EF6922] text-black text-[0.70rem] tracking-cad uppercase font-medium text-left transition-colors cursor-pointer truncate"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: 01 / Custom Idea Prompt Input (Unified Flush-Header Card) */}
            <div className="border border-black rounded-[9px] bg-white overflow-hidden flex flex-col">
              <label
                htmlFor={`visualizer-prompt-${placement}`}
                className="block bg-[#CBCBCB] text-black border-b border-black py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
              >
                01 / DESCRIBE YOUR CUSTOM PIECE, BUILT-IN OR DIMENSIONS *
              </label>
              <textarea
                id={`visualizer-prompt-${placement}`}
                rows={3}
                value={state.ideaPrompt}
                onChange={(e) =>
                  onChangeState((prev) => ({ ...prev, ideaPrompt: e.target.value }))
                }
                placeholder="Describe what you want to build (e.g., a dining table, built-in bookcase, media console, desk, or custom bar)..."
                className="w-full bg-white text-black text-[0.90rem] p-3.5 font-light focus:outline-none focus:bg-[#FDCB33]/10 placeholder:text-black/45 leading-relaxed resize-y"
              />
            </div>

            {/* Row 3: 2-Column Bauhaus Selectors (02 Primary Material with Real Swatch · 03 Architectural Direction) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* 02 / PRIMARY MATERIAL */}
              <div className="border border-black rounded-[9px] bg-white overflow-hidden flex flex-col">
                <label
                  htmlFor={`visualizer-wood-${placement}`}
                  className="flex items-center justify-between gap-2 bg-[#27AAE0] text-black border-b border-black py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
                >
                  <span>02 / PRIMARY MATERIAL</span>
                  {WOOD_SWATCH_META[state.woodSpecies] && (
                    <span className="inline-flex items-center gap-1.5 text-[0.62rem] tracking-normal normal-case font-medium bg-white/95 px-2 py-0.5 rounded-[5px] border border-black">
                      {WOOD_SWATCH_META[state.woodSpecies].textureUrl ? (
                        <img
                          src={WOOD_SWATCH_META[state.woodSpecies].textureUrl}
                          alt=""
                          className="w-3.5 h-3.5 rounded-[3px] border border-black object-cover shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black shrink-0"
                          style={{ backgroundColor: WOOD_SWATCH_META[state.woodSpecies].color }}
                        />
                      )}
                      <span>{WOOD_SWATCH_META[state.woodSpecies].hint}</span>
                    </span>
                  )}
                </label>

                <div className="flex items-stretch">
                  {WOOD_SWATCH_META[state.woodSpecies]?.textureUrl && (
                    <div
                      className="w-[46px] h-[44px] border-r border-black shrink-0 overflow-hidden bg-white"
                      title={`Linked studio texture swatch: ${state.woodSpecies}`}
                    >
                      <img
                        src={WOOD_SWATCH_META[state.woodSpecies].textureUrl}
                        alt={`${state.woodSpecies} studio texture swatch`}
                        className="w-full h-full object-cover select-none"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <select
                    id={`visualizer-wood-${placement}`}
                    value={state.woodSpecies}
                    onChange={(e) =>
                      onChangeState((prev) => ({ ...prev, woodSpecies: e.target.value }))
                    }
                    className="w-full h-[44px] bg-white text-black text-[0.86rem] px-3 font-normal focus:outline-none cursor-pointer"
                  >
                    {WOOD_OPTIONS.map((wood) => (
                      <option key={wood} value={wood}>
                        {wood === 'Custom / Exotic Material'
                          ? 'Custom / Exotic Material (Enter Own Text)'
                          : wood}
                      </option>
                    ))}
                  </select>
                </div>

                {state.woodSpecies === 'Custom / Exotic Material' && (
                  <input
                    type="text"
                    value={state.customWoodText}
                    onChange={(e) =>
                      onChangeState((prev) => ({ ...prev, customWoodText: e.target.value }))
                    }
                    placeholder="Enter custom timber, metal, stone, or finish..."
                    className="w-full h-[42px] bg-white text-black text-[0.86rem] px-3.5 border-t border-black/20 font-light focus:outline-none focus:bg-[#27AAE0]/10 placeholder:text-black/45"
                  />
                )}
              </div>

              {/* 03 / ARCHITECTURAL DIRECTION */}
              <div className="border border-black rounded-[9px] bg-white overflow-hidden flex flex-col">
                <label
                  htmlFor={`visualizer-style-${placement}`}
                  className="block bg-[#FDCB33] text-black border-b border-black py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
                >
                  03 / ARCHITECTURAL DIRECTION
                </label>
                <select
                  id={`visualizer-style-${placement}`}
                  value={state.designStyle}
                  onChange={(e) =>
                    onChangeState((prev) => ({ ...prev, designStyle: e.target.value }))
                  }
                  className="w-full h-[44px] bg-white text-black text-[0.86rem] px-3 font-normal focus:outline-none cursor-pointer"
                >
                  {DESIGN_STYLE_OPTIONS.map((styleOpt) => (
                    <option key={styleOpt} value={styleOpt}>
                      {styleOpt === 'Custom Direction'
                        ? 'Custom Direction (Enter Own Text)'
                        : styleOpt}
                    </option>
                  ))}
                </select>

                {state.designStyle === 'Custom Direction' && (
                  <input
                    type="text"
                    value={state.customStyleText}
                    onChange={(e) =>
                      onChangeState((prev) => ({ ...prev, customStyleText: e.target.value }))
                    }
                    placeholder="Describe your preferred architectural direction..."
                    className="w-full h-[42px] bg-white text-black text-[0.86rem] px-3.5 border-t border-black/20 font-light focus:outline-none focus:bg-[#FDCB33]/10 placeholder:text-black/45"
                  />
                )}
              </div>
            </div>

            {/* Row 3B: Full-Width Grouped Multi-Select 04 / SIGNATURE MILLWORK & JOINERY */}
            <div className="border border-black rounded-[9px] bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#EF6922] text-black border-b border-black py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium select-none">
                <span>04 / SIGNATURE MILLWORK &amp; JOINERY — PICK UP TO {MAX_SELECTED_DETAILS}</span>
                <span className="bg-white text-black border border-black rounded-[5px] px-2 py-0.5 text-[0.62rem]">
                  {selectedDetailsList.length} / {MAX_SELECTED_DETAILS} SELECTED
                </span>
              </div>

              <div
                className="p-3.5 bg-white space-y-3"
                role="group"
                aria-label="Signature millwork and joinery details"
              >
                {ADDED_DETAILS_GROUPS.map((section) => (
                  <div
                    key={section.group}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
                  >
                    <span className="text-[0.62rem] tracking-cad uppercase font-medium text-black/70 sm:w-[148px] shrink-0">
                      {section.group}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {section.options.map((detailOpt) => {
                        const isSelected = selectedDetailsList.includes(detailOpt);
                        return (
                          <button
                            key={detailOpt}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleAddedDetail(detailOpt)}
                            className={`px-3 py-1.5 rounded-[7px] border border-black text-[0.76rem] transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#EF6922] text-black font-medium'
                                : 'bg-white text-black hover:bg-[#CBCBCB]/60 font-light'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                            <span>{detailOpt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {hasCustomDetailSelected && (
                <input
                  type="text"
                  value={state.customDetailsText}
                  onChange={(e) =>
                    onChangeState((prev) => ({ ...prev, customDetailsText: e.target.value }))
                  }
                  placeholder="Enter custom door, drawer, hardware, or joinery details..."
                  className="w-full h-[42px] bg-white text-black text-[0.86rem] px-3.5 border-t border-black/20 font-light focus:outline-none focus:bg-[#EF6922]/10 placeholder:text-black/45"
                />
              )}
            </div>

            {/* Row 4: 05 / Room Photo or Sketch Upload (Unified Flush-Header Card) */}
            <div className="border border-black rounded-[9px] bg-white overflow-hidden">
              <label
                htmlFor={`visualizer-photo-${placement}`}
                className="block bg-[#CBCBCB] text-black border-b border-black py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
              >
                05 / UPLOAD ROOM PHOTO OR HAND SKETCH (OPTIONAL)
              </label>
              <input
                id={`visualizer-photo-${placement}`}
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              {!state.uploadedPhoto ? (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-white hover:bg-[#CBCBCB] text-[0.82rem] text-black flex items-center justify-center gap-2 transition-colors cursor-pointer font-normal"
                >
                  <Upload className="w-4 h-4 text-black shrink-0" />
                  <span>Upload a photo of your wall/alcove or a rough sketch</span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 p-3 bg-[#FDCB33]/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={state.uploadedPhoto.dataUrl}
                      alt={state.uploadedPhoto.name}
                      className="w-12 h-12 rounded-[6px] border-[0.75px] border-black object-cover shrink-0 bg-white"
                    />
                    <div className="min-w-0">
                      <p className="text-[0.72rem] tracking-cad uppercase font-medium text-black truncate">
                        {state.uploadedPhoto.name}
                      </p>
                      <p className="text-[0.76rem] font-light text-black">
                        Will visualize piece inside this photo / sketch
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="p-2 rounded-[9px] border-[0.75px] border-black bg-white hover:bg-[#EF6922] text-black transition-colors cursor-pointer shrink-0"
                    aria-label="Remove uploaded room photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-[9px] border border-black bg-[#EF6922] text-black text-[0.82rem] font-medium">
                {errorMsg}
              </div>
            )}

            {/* Row 5: Full-Width GENERATE CUSTOM CONCEPT Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => runGeneration('new')}
              className={`w-full py-4 px-6 rounded-[9px] border border-black text-[0.80rem] tracking-cad uppercase font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                isGenerating
                  ? 'bg-[#CBCBCB] text-black cursor-wait'
                  : 'bg-[#EF6922] text-black hover:bg-black hover:text-white'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>GENERATING CUSTOM CONCEPT...</span>
                </>
              ) : (
                <span>GENERATE CUSTOM CONCEPT</span>
              )}
            </button>

            {/* Row 6: Full-Width Flush-Header Concept Preview Stage (Matching Sheet A1 / Sheet 04) */}
            <div className="w-full border border-black rounded-[9px] bg-white overflow-hidden">
              {/* Flush Viewport Header Strip */}
              <div
                className={`w-full ${
                  activeConcept?.visualStyle === 'cad-2d'
                    ? 'bg-[#FDCB33] text-black'
                    : 'bg-[#27AAE0] text-black'
                } border-b border-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[0.70rem] tracking-cad uppercase font-medium select-none`}
              >
                <span>
                  {activeConcept
                    ? activeConcept.visualStyle === 'cad-2d'
                      ? 'GENERATED SHEET · 2D ELEVATION SKETCH'
                      : 'GENERATED SHEET · 3D REALISTIC RENDERING'
                    : 'CONCEPT PREVIEW STAGE · 16:9 SHEET'}
                </span>
                <span>
                  {activeConcept
                    ? `SAVED & SENT TO STUDIO (${activeConcept.timestamp})`
                    : 'READY TO GENERATE'}
                </span>
              </div>

              {/* Flush Full-Width Visual Canvas */}
              <div className="w-full cad-hatch-bg overflow-hidden min-h-[320px] sm:min-h-[440px] flex items-center justify-center relative">
                {isGenerating ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-[9px] border-[0.75px] border-black bg-[#EF6922] flex items-center justify-center animate-pulse">
                      <RefreshCw className="w-5 h-5 text-black animate-spin" />
                    </div>
                    <p className="text-[0.76rem] tracking-cad uppercase font-medium text-black">
                      ENGINEERING CUSTOM CONCEPT SHEET...
                    </p>
                    <p className="text-[0.84rem] font-light text-black max-w-md mx-auto">
                      Applying {resolvedWoodSpecies}, {resolvedDesignStyle} &amp;{' '}
                      {resolvedAddedDetails} in{' '}
                      {state.visualStyle === 'cad-2d'
                        ? '2D elevation sketch format'
                        : '3D realistic rendering format'}
                      .
                    </p>
                  </div>
                ) : activeConcept ? (
                  <div className="w-full h-full relative group p-2 sm:p-4">
                    <img
                      src={activeConcept.imageUrl}
                      alt={activeConcept.summarySpec}
                      onClick={() => setFullscreenConcept(activeConcept)}
                      className="w-full max-h-[540px] object-contain cursor-zoom-in select-none mx-auto"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadConcept(activeConcept)}
                        className="bg-white hover:bg-[#FDCB33] text-black border-[0.75px] border-black rounded-[9px] py-1.5 px-3.5 text-[0.68rem] tracking-cad uppercase font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Download Concept PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>SAVE PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFullscreenConcept(activeConcept)}
                        className="bg-black hover:bg-[#EF6922] text-white hover:text-black border-[0.75px] border-black rounded-[9px] py-1.5 px-3.5 text-[0.68rem] tracking-cad uppercase font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Zoom Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>ZOOM</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 sm:p-12 text-center space-y-3">
                    <div className="w-11 h-11 mx-auto rounded-[9px] border-[0.75px] border-black bg-white flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-black" />
                    </div>
                    <p className="text-[0.76rem] tracking-cad uppercase font-medium text-black">
                      YOUR GENERATED 3D REALISTIC RENDERING OR 2D ELEVATION SKETCH WILL APPEAR HERE
                    </p>
                    <p className="text-[0.84rem] font-light text-black max-w-md mx-auto">
                      Click any of the 4 signature templates above or describe your custom
                      piece and click GENERATE CUSTOM CONCEPT.
                    </p>
                  </div>
                )}
              </div>

              {/* Active Concept Controls: Automatic Dispatch Notice, Direct SMS/Email to Josh, Refine & Convert */}
              {activeConcept && (
                <div className="border-t border-black p-4 sm:p-5 bg-white space-y-3.5 text-left">
                  <div className="border-b border-black/15 pb-3 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem] tracking-cad uppercase font-medium text-black">
                      <span>✓ LOGGED &amp; DISPATCHED TO JOSH ({OWNER_EMAIL})</span>
                      {activeConcept.publicPath && (
                        <a
                          href={activeConcept.publicPath}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-[#EF6922]"
                        >
                          DIRECT IMAGE LINK ↗
                        </a>
                      )}
                    </div>
                    <p className="text-[0.82rem] font-light text-black">
                      {activeConcept.summarySpec}
                    </p>
                    {activeConcept.modelEngine && (
                      <p className="text-[0.65rem] tracking-cad uppercase text-black/65 font-medium pt-0.5">
                        ENGINE: {activeConcept.modelEngine}
                      </p>
                    )}
                  </div>

                  {/* Live Settings-Changed Banner so changing Timber / Style / Details applies directly to the active image */}
                  {hasSettingsChanged && (
                    <div className="bg-[#FDCB33]/35 border border-black rounded-[9px] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="block text-[0.68rem] tracking-cad uppercase font-medium text-black">
                          SETTINGS UPDATED — READY TO APPLY TO THIS DESIGN
                        </span>
                        <span className="block text-[0.80rem] font-light text-black">
                          {resolvedWoodSpecies} · {resolvedDesignStyle} · {resolvedAddedDetails}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={() => runGeneration('refine')}
                        className="shrink-0 bg-[#FDCB33] hover:bg-black text-black hover:text-white border border-black rounded-[9px] px-4 py-2 text-[0.70rem] tracking-cad uppercase font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        APPLY TO THIS IMAGE →
                      </button>
                    </div>
                  )}

                  {/* Direct Send Concept Link & Specs to Josh via SMS or Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleDirectSendToJosh(activeConcept, 'sms')}
                      className="bg-[#FDCB33] hover:bg-black text-black hover:text-white text-[0.68rem] tracking-cad uppercase py-2.5 px-3 rounded-[9px] border-[0.75px] border-black font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>TEXT IMAGE LINK TO JOSH ({OWNER_PHONE_DISPLAY})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDirectSendToJosh(activeConcept, 'email')}
                      className="bg-black hover:bg-[#EF6922] text-white hover:text-black text-[0.68rem] tracking-cad uppercase py-2.5 px-3 rounded-[9px] border-[0.75px] border-black font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span>EMAIL IMAGE LINK TO JOSH</span>
                    </button>
                  </div>

                  {/* Iterative Refinement Input Bar */}
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={refinementText}
                      onChange={(e) => setRefinementText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isGenerating && (refinementText.trim() || hasSettingsChanged)) {
                          e.preventDefault();
                          runGeneration('refine');
                        }
                      }}
                      placeholder="Refine this concept (e.g., 'Make it 96 inches wide' or 'Add brass toe-kick')..."
                      className="flex-1 h-[42px] bg-white text-black text-[0.84rem] px-3.5 rounded-[9px] border-[0.75px] border-black font-light focus:outline-none placeholder:text-black/45"
                    />
                    <button
                      type="button"
                      disabled={isGenerating || (!refinementText.trim() && !hasSettingsChanged)}
                      onClick={() => runGeneration('refine')}
                      className="shrink-0 bg-[#27AAE0] text-black disabled:opacity-50 hover:bg-black hover:text-white text-[0.70rem] tracking-cad uppercase px-5 py-2.5 rounded-[9px] border-[0.75px] border-black font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {hasSettingsChanged && !refinementText.trim()
                        ? 'APPLY UPDATED SETTINGS'
                        : 'REFINE IMAGE'}
                    </button>
                  </div>

                  {/* One-Click Style Conversion + Send to Inquiry */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() =>
                        runGeneration(
                          'refine',
                          activeConcept.visualStyle === 'cad-2d' ? 'render-3d' : 'cad-2d'
                        )
                      }
                      className="bg-white hover:bg-[#CBCBCB] text-black text-[0.68rem] tracking-cad uppercase py-2 px-3.5 rounded-[9px] border-[0.75px] border-black font-medium transition-colors cursor-pointer"
                    >
                      {activeConcept.visualStyle === 'cad-2d'
                        ? 'CONVERT THIS TO 3D REALISTIC RENDERING →'
                        : 'CONVERT THIS TO 2D ELEVATION SKETCH →'}
                    </button>

                    {(placement === 'visualizer' || placement === 'methodology') &&
                      onSendToInquiry && (
                        <button
                          type="button"
                          onClick={() => onSendToInquiry(activeConcept)}
                          className="bg-[#EF6922] hover:bg-black text-black hover:text-white text-[0.70rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border-[0.75px] border-black font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>OPEN IN PAGE 05 COMMISSION INQUIRY</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                    {placement === 'inquire' && onApplyToInquiryForm && (
                      <button
                        type="button"
                        onClick={() => {
                          onApplyToInquiryForm(activeConcept);
                          setSyncedNotice(true);
                          setTimeout(() => setSyncedNotice(false), 2500);
                        }}
                        className="bg-[#FDCB33] hover:bg-black text-black hover:text-white text-[0.70rem] tracking-cad uppercase py-2 px-3.5 rounded-[9px] border-[0.75px] border-black font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {syncedNotice
                            ? 'CONCEPT SPECS COPIED TO INQUIRY FORM'
                            : 'INSERT SPECS INTO INQUIRY FORM BELOW'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Concept History Strip if multiple variations generated */}
                  {state.history.length > 1 && (
                    <div className="pt-2 border-t border-black/20 flex items-center gap-2.5 overflow-x-auto">
                      <span className="text-[0.66rem] tracking-cad uppercase font-medium text-black shrink-0">
                        VARIATIONS ({state.history.length}):
                      </span>
                      {state.history.map((item) => {
                        const isSelected = item.id === activeConcept.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              onChangeState((prev) => ({ ...prev, activeConceptId: item.id }))
                            }
                            className={`relative rounded-[6px] overflow-hidden border-[0.75px] border-black shrink-0 cursor-pointer transition-all ${
                              isSelected ? 'ring-2 ring-[#EF6922] opacity-100' : 'opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.summarySpec}
                              className="w-16 h-10 object-cover bg-white"
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Studio Concept Archive Modal (Allows Josh to view & download all customer-generated images) */}
      {showArchiveModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowArchiveModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[85vh] bg-white border-[1.5px] border-black rounded-[9px] flex flex-col overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#EF6922] text-black border-b-[1.5px] border-black px-5 py-3 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[0.76rem] tracking-cad uppercase font-medium">
                STUDIO CONCEPT LOG — ALL GENERATED CUSTOMER VISUALIZATIONS
              </span>
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="bg-white text-black border-[0.75px] border-black rounded-[6px] px-3 py-1 text-[0.68rem] tracking-cad uppercase font-medium cursor-pointer"
              >
                CLOSE [X]
              </button>
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1 overflow-hidden">
              <p className="text-[0.86rem] font-light text-black shrink-0">
                Every image generated through the Custom Concept Visualizer is automatically saved to
                the studio server and dispatched to <strong className="font-medium">{OWNER_EMAIL}</strong>.
              </p>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingArchive ? (
                <div className="p-8 text-center text-[0.78rem] tracking-cad uppercase font-medium">
                  LOADING SAVED CUSTOMER CONCEPTS...
                </div>
              ) : archiveList.length === 0 ? (
                <div className="p-8 border border-black rounded-[9px] text-center text-[0.84rem] font-light text-black">
                  No customer concepts have been generated yet in this session.
                </div>
              ) : (
                archiveList.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-black rounded-[9px] p-3.5 bg-white grid grid-cols-1 sm:grid-cols-12 gap-4 items-center"
                  >
                    <a
                      href={entry.publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="sm:col-span-4 h-[110px] border-[0.75px] border-black rounded-[6px] overflow-hidden bg-white flex items-center justify-center"
                    >
                      <img
                        src={entry.publicPath}
                        alt={entry.summarySpec}
                        className="w-full h-full object-cover"
                      />
                    </a>
                    <div className="sm:col-span-8 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem] tracking-cad uppercase font-medium text-black">
                        <span>
                          {entry.woodSpecies} · {entry.designStyle}
                          {entry.addedDetails ? ` · ${entry.addedDetails}` : ''}
                        </span>
                        <span>{entry.createdAt}</span>
                      </div>
                      <p className="text-[0.86rem] font-normal text-black">
                        &ldquo;{entry.ideaPrompt}&rdquo;
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <a
                          href={`/api/download-concept/${encodeURIComponent(entry.filename)}`}
                          download={`casegoods-${entry.filename}`}
                          className="bg-[#FDCB33] text-black border-[0.75px] border-black rounded-[6px] px-3 py-1 text-[0.66rem] tracking-cad uppercase font-medium"
                        >
                          DOWNLOAD IMAGE
                        </a>
                        <a
                          href={entry.publicPath}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-white text-black border-[0.75px] border-black rounded-[6px] px-3 py-1 text-[0.66rem] tracking-cad uppercase font-medium"
                        >
                          OPEN FULL IMAGE ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal for Generated Concept */}
      {fullscreenConcept && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6"
          onClick={() => setFullscreenConcept(null)}
        >
          <div
            className="w-full max-w-6xl bg-white border-[1.5px] border-black rounded-[9px] p-3 sm:p-5 space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top 3-Zone Architectural Header:
                [Left Box: Project Name/Number] — [Center: Casegoods Logo] — [Right Box: Drawing/Rendering Name] */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 select-none">
              {/* Left Box: Project Name or Number */}
              <div className="bg-[#EF6922] text-black border border-black rounded-[9px] px-4 py-2.5 flex items-center justify-start text-left overflow-hidden">
                <span className="text-[0.74rem] tracking-cad uppercase font-medium truncate">
                  {fullscreenConcept.id.toUpperCase()} — {fullscreenConcept.woodSpecies}
                </span>
              </div>

              {/* Center: Casegoods Logo */}
              <div className="flex items-center justify-center px-2">
                <img
                  src={ASSETS.brand.logoFull}
                  alt="casegoods — handcrafted in omaha"
                  className="h-12 sm:h-14 w-auto object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Right Box: What Drawing or Rendering It Is + Actions */}
              <div className="flex items-center justify-end gap-2">
                <div
                  className={`flex-1 ${
                    fullscreenConcept.visualStyle === 'cad-2d'
                      ? 'bg-[#FDCB33] text-black'
                      : 'bg-[#27AAE0] text-black'
                  } border border-black rounded-[9px] px-4 py-2.5 flex items-center justify-center text-center overflow-hidden`}
                >
                  <span className="text-[0.72rem] tracking-cad uppercase font-medium truncate">
                    {fullscreenConcept.visualStyle === 'cad-2d'
                      ? '2D CAD ELEVATION SKETCH'
                      : '3D HARDWOOD RENDERING'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadConcept(fullscreenConcept)}
                  className="bg-[#FDCB33] hover:bg-black text-black hover:text-white border-[0.75px] border-black py-2.5 px-3 rounded-[9px] text-[0.68rem] tracking-cad uppercase font-medium cursor-pointer shrink-0"
                >
                  SAVE PNG
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenConcept(null)}
                  className="bg-white hover:bg-black text-black hover:text-white border-[0.75px] border-black py-2.5 px-3 rounded-[9px] text-[0.68rem] tracking-cad uppercase font-medium cursor-pointer shrink-0"
                >
                  CLOSE
                </button>
              </div>
            </div>

            <div className="bg-white border border-black rounded-[9px] p-4 sm:p-6 flex items-center justify-center">
              <img
                src={fullscreenConcept.imageUrl}
                alt={fullscreenConcept.summarySpec}
                className="w-full max-h-[68vh] object-contain select-none"
              />
            </div>

            <p className="text-[0.84rem] font-light text-black text-left px-1">
              {fullscreenConcept.summarySpec}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
