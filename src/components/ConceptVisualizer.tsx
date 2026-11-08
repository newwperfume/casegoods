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
  Layers,
  Compass,
  MessageSquare,
  Mail,
  FolderOpen,
} from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import {
  renderWatermarkedSheet,
  downloadWatermarkedSheet,
} from '../utils/watermarkSheet.ts';

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
  'White Oak',
  'Maple',
  'Cherry',
  'Mahogany',
  'Laminate',
  'Something Exotic',
];

const DESIGN_STYLE_OPTIONS = [
  'Mid-Century Modern',
  'Minimalist & Contemporary',
  'Bauhaus & Color-Blocked',
  'Scandinavian & Organic',
  'Japandi & Exposed Joinery',
  'Traditional & Shaker',
  'Art Deco & Fluted Curves',
  'Industrial & Architectural',
  'Rustic & Live-Edge Modern',
  'Custom Style',
];

const ADDED_DETAILS_OPTIONS = [
  'Full Overlay Doors',
  'Flush Inset Doors & Drawers',
  'Pocket / Retracting Doors',
  'Open Cabinets (No Doors)',
  'Sliding Tambour Doors',
  'Glass-Front Display Doors',
  'Vertical Fluted / Reeded Door Panels',
  'Louvered / Slatted Doors',
  'Soft-Close Dovetail Drawers',
  'Push-to-Open (Touch Latch, No Hardware)',
  'Custom Turned Hardwood Pulls',
  'Integrated LED Shelf & Cabinet Lighting',
  'Adjustable Floating Shelves',
  'Waterfall Mitred Edges',
  'Exposed Finger / Through-Tenon Joinery',
  'Custom Detail',
];

/**
 * 4 Very Different, Basic Project Concept Templates
 */
const QUICK_IDEA_PRESETS = [
  {
    label: '01 / DINING TABLE',
    prompt:
      'A solid wood dining table that seats 8 people with clean lines and sturdy legs.',
    wood: 'American Black Walnut',
    style: 'Mid-Century Modern',
    details: 'Exposed Finger / Through-Tenon Joinery',
  },
  {
    label: '02 / BUILT-IN BOOKCASE',
    prompt:
      'A floor-to-ceiling built-in living room bookcase with lower storage cabinets and open shelving above.',
    wood: 'White Oak',
    style: 'Minimalist & Contemporary',
    details: 'Full Overlay Doors',
  },
  {
    label: '03 / MEDIA CREDENZA',
    prompt:
      'A low media console and vinyl record cabinet with sliding doors and adjustable interior shelves.',
    wood: 'Cherry',
    style: 'Bauhaus & Color-Blocked',
    details: 'Pocket / Retracting Doors',
  },
  {
    label: '04 / RECEPTION DESK',
    prompt:
      'A commercial office reception desk with a raised transaction counter and clean wood paneling.',
    wood: 'Maple',
    style: 'Industrial & Architectural',
    details: 'Waterfall Mitred Edges',
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

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const OWNER_PHONE = '+14027201377';
  const OWNER_PHONE_DISPLAY = '402-720-1377';
  const OWNER_EMAIL = 'casegoodsne@gmail.com';

  const activeConcept =
    state.history.find((item) => item.id === state.activeConceptId) ||
    state.history[0] ||
    null;

  const resolvedWoodSpecies =
    state.woodSpecies === 'Something Exotic'
      ? state.customWoodText.trim() || 'Exotic Hardwood'
      : state.woodSpecies;

  const resolvedDesignStyle =
    state.designStyle === 'Custom Style'
      ? state.customStyleText.trim() || 'Custom Studio Style'
      : state.designStyle;

  const resolvedAddedDetails =
    state.addedDetails === 'Custom Detail'
      ? state.customDetailsText.trim() || 'Custom Millwork Detail'
      : state.addedDetails;

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
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const { mimeType, base64Data } = parseDataUrl(dataUrl);
      if (base64Data) {
        onChangeState((prev) => ({
          ...prev,
          uploadedPhoto: {
            name: file.name,
            mimeType: mimeType || file.type || 'image/jpeg',
            dataUrl,
            base64Data,
          },
        }));
      }
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
      state.woodSpecies === 'Something Exotic' &&
      !state.customWoodText.trim() &&
      mode === 'new'
    ) {
      setErrorMsg('Please enter the exotic timber or custom material you have in mind.');
      return;
    }

    if (
      state.addedDetails === 'Custom Detail' &&
      !state.customDetailsText.trim() &&
      mode === 'new'
    ) {
      setErrorMsg('Please enter the custom cabinetry or furniture detail you have in mind.');
      return;
    }

    if (mode === 'refine' && !refinementText.trim() && !overrideStyle) {
      setErrorMsg('Enter a refinement note (e.g., "Add brass pulls or change to white oak") first.');
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

      const response = await fetch('/api/visualize-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideaPrompt: promptToUse || activeConcept?.ideaPrompt || 'Custom wood project',
          visualStyle: targetStyle,
          woodSpecies: resolvedWoodSpecies,
          designStyle: resolvedDesignStyle,
          addedDetails: resolvedAddedDetails,
          refinementPrompt:
            mode === 'refine'
              ? refinementText.trim() ||
                (overrideStyle === 'cad-2d'
                  ? 'Convert this exact design into a dimensioned 2D Rhino CAD elevation and section shop drawing'
                  : 'Render this exact design as a photorealistic 3D studio hardwood proposal')
              : '',
          sourceImage,
          sourceImageMode,
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
      {/* Standalone Section Title Block Bar — Bauhaus Orange (#EF6922) + Black Ink */}
      <div
        className={`w-full ${headerBarBg} border-[1.5px] border-black rounded-[9px] px-5 py-3 mb-3.5 flex flex-wrap items-center justify-between gap-2 select-none`}
      >
        <span className="text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase font-medium">
          06 / CUSTOM CONCEPT VISUALIZER — TEST YOUR CUSTOM BUILD IDEA IN 3D RENDER OR 2D CAD
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[0.70rem] tracking-cad uppercase font-medium">
            DWG-CG-006
          </span>
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

      {/* Main Framed Concept Studio Container */}
      <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-7 space-y-6">
        {/* Top Row: Lead Instructions + Output Style Switcher (3D Hardwood Render vs 2D CAD Sketch) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black pb-5">
          <div className="text-left space-y-1">
            <p className="text-[0.72rem] tracking-cad uppercase font-medium text-black">
              DESCRIBE A PIECE OR UPLOAD A ROOM PHOTO / HAND SKETCH
            </p>
            <p className="text-[0.90rem] font-light text-black max-w-[64ch]">
              Choose a basic starter idea or write your own, pick your primary timber, design
              style, and added cabinetry details, and generate a visual concept that is shared with Josh.
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
              className={`py-2.5 px-4 rounded-[9px] border border-black text-[0.72rem] tracking-cad uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                state.visualStyle === 'render-3d'
                  ? 'bg-[#EF6922] text-black font-medium'
                  : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>3D HARDWOOD RENDER</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeState((prev) => ({ ...prev, visualStyle: 'cad-2d' }))
              }
              className={`py-2.5 px-4 rounded-[9px] border border-black text-[0.72rem] tracking-cad uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                state.visualStyle === 'cad-2d'
                  ? 'bg-[#FDCB33] text-black font-medium'
                  : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
              }`}
            >
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>2D CAD ELEVATION SKETCH</span>
            </button>
          </div>
        </div>

        {/* 2-Column Interactive Drafting Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 6 Columns: Prompt Input, 4 Basic Templates, Timber, Design Style & Added Details */}
          <div className="lg:col-span-6 space-y-4 text-left">
            {/* 4 Very Different, Basic Quick Concept Templates */}
            <div className="space-y-2">
              <span className="block text-[0.68rem] tracking-cad uppercase font-medium text-black">
                QUICK CONCEPT TEMPLATES (4 BASIC STARTING IDEAS):
              </span>
              <div className="grid grid-cols-2 gap-2">
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
                    className="py-2 px-3 rounded-[9px] border border-black bg-white hover:bg-[#EF6922] text-black text-[0.68rem] tracking-cad uppercase font-medium text-left transition-colors cursor-pointer truncate"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 01 / Custom Idea Prompt Input */}
            <div className="space-y-2">
              <label
                htmlFor={`visualizer-prompt-${placement}`}
                className="block bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
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
                className="w-full bg-white text-black text-[0.90rem] p-3.5 rounded-[9px] border border-black font-light focus:outline-none focus:bg-[#FDCB33]/10 placeholder:text-black/45 leading-relaxed resize-y"
              />
            </div>

            {/* 02 / Primary Timber & 03 / Design Style Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 02 / PRIMARY TIMBER */}
              <div className="space-y-2">
                <label
                  htmlFor={`visualizer-wood-${placement}`}
                  className="block bg-[#27AAE0] text-black border border-black rounded-[9px] py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
                >
                  02 / PRIMARY TIMBER
                </label>
                <select
                  id={`visualizer-wood-${placement}`}
                  value={state.woodSpecies}
                  onChange={(e) =>
                    onChangeState((prev) => ({ ...prev, woodSpecies: e.target.value }))
                  }
                  className="w-full h-[44px] bg-white text-black text-[0.86rem] px-3 rounded-[9px] border border-black font-normal focus:outline-none cursor-pointer"
                >
                  {WOOD_OPTIONS.map((wood) => (
                    <option key={wood} value={wood}>
                      {wood === 'Something Exotic'
                        ? 'Something Exotic (Enter Own Text)'
                        : wood}
                    </option>
                  ))}
                </select>

                {state.woodSpecies === 'Something Exotic' && (
                  <input
                    type="text"
                    value={state.customWoodText}
                    onChange={(e) =>
                      onChangeState((prev) => ({ ...prev, customWoodText: e.target.value }))
                    }
                    placeholder="Enter exotic wood or custom material..."
                    className="w-full h-[42px] bg-white text-black text-[0.86rem] px-3.5 rounded-[9px] border-[0.75px] border-black font-light focus:outline-none focus:bg-[#27AAE0]/10 placeholder:text-black/45"
                  />
                )}
              </div>

              {/* 03 / DESIGN STYLE */}
              <div className="space-y-2">
                <label
                  htmlFor={`visualizer-style-${placement}`}
                  className="block bg-[#FDCB33] text-black border border-black rounded-[9px] py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
                >
                  03 / DESIGN STYLE
                </label>
                <select
                  id={`visualizer-style-${placement}`}
                  value={state.designStyle}
                  onChange={(e) =>
                    onChangeState((prev) => ({ ...prev, designStyle: e.target.value }))
                  }
                  className="w-full h-[44px] bg-white text-black text-[0.86rem] px-3 rounded-[9px] border border-black font-normal focus:outline-none cursor-pointer"
                >
                  {DESIGN_STYLE_OPTIONS.map((styleOpt) => (
                    <option key={styleOpt} value={styleOpt}>
                      {styleOpt === 'Custom Style'
                        ? 'Custom Style (Enter Own Text)'
                        : styleOpt}
                    </option>
                  ))}
                </select>

                {state.designStyle === 'Custom Style' && (
                  <input
                    type="text"
                    value={state.customStyleText}
                    onChange={(e) =>
                      onChangeState((prev) => ({ ...prev, customStyleText: e.target.value }))
                    }
                    placeholder="Describe your preferred design style..."
                    className="w-full h-[42px] bg-white text-black text-[0.86rem] px-3.5 rounded-[9px] border-[0.75px] border-black font-light focus:outline-none focus:bg-[#FDCB33]/10 placeholder:text-black/45"
                  />
                )}
              </div>
            </div>

            {/* 04 / ADDED DETAILS */}
            <div className="space-y-2">
              <label
                htmlFor={`visualizer-details-${placement}`}
                className="block bg-[#EF6922] text-black border border-black rounded-[9px] py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
              >
                04 / ADDED DETAILS
              </label>
              <select
                id={`visualizer-details-${placement}`}
                value={state.addedDetails}
                onChange={(e) =>
                  onChangeState((prev) => ({ ...prev, addedDetails: e.target.value }))
                }
                className="w-full h-[44px] bg-white text-black text-[0.86rem] px-3 rounded-[9px] border border-black font-normal focus:outline-none cursor-pointer"
              >
                {ADDED_DETAILS_OPTIONS.map((detailOpt) => (
                  <option key={detailOpt} value={detailOpt}>
                    {detailOpt === 'Custom Detail'
                      ? 'Custom Detail (Enter Own Text)'
                      : detailOpt}
                  </option>
                ))}
              </select>

              {state.addedDetails === 'Custom Detail' && (
                <input
                  type="text"
                  value={state.customDetailsText}
                  onChange={(e) =>
                    onChangeState((prev) => ({ ...prev, customDetailsText: e.target.value }))
                  }
                  placeholder="Enter custom door, drawer, hardware, or joinery details..."
                  className="w-full h-[42px] bg-white text-black text-[0.86rem] px-3.5 rounded-[9px] border-[0.75px] border-black font-light focus:outline-none focus:bg-[#EF6922]/10 placeholder:text-black/45"
                />
              )}
            </div>

            {/* 05 / Room Photo or Sketch Upload (Optional Context) */}
            <div className="space-y-2">
              <label
                htmlFor={`visualizer-photo-${placement}`}
                className="block bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-3.5 text-[0.70rem] tracking-cad uppercase font-medium cursor-pointer"
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
                  className="w-full py-2.5 px-4 rounded-[9px] border border-black bg-white hover:bg-[#CBCBCB] text-[0.82rem] text-black flex items-center justify-center gap-2 transition-colors cursor-pointer font-normal"
                >
                  <Upload className="w-4 h-4 text-black shrink-0" />
                  <span>Upload a photo of your wall/alcove or a rough sketch</span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-[9px] border border-black bg-[#FDCB33]/20">
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

            {/* Bottom Button: GENERATE CUSTOM CONCEPT */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => runGeneration('new')}
              className={`w-full py-3.5 px-5 rounded-[9px] border border-black text-[0.78rem] tracking-cad uppercase font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 ${
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
          </div>

          {/* Right 6 Columns: Live Concept Sheet Stage, Iterative Edit Bar & Direct Send to Josh */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-4">
            <div className="border border-black rounded-[9px] bg-white p-4 space-y-3.5">
              {/* Viewport Header Strip */}
              <div
                className={`w-full ${
                  activeConcept?.visualStyle === 'cad-2d'
                    ? 'bg-[#FDCB33] text-black'
                    : 'bg-[#27AAE0] text-black'
                } border-[0.75px] border-black rounded-[9px] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[0.70rem] tracking-cad uppercase font-medium`}
              >
                <span>
                  {activeConcept
                    ? activeConcept.visualStyle === 'cad-2d'
                      ? 'GENERATED SHEET · 2D RHINO CAD SKETCH'
                      : 'GENERATED SHEET · 3D HARDWOOD PROPOSAL'
                    : 'CONCEPT PREVIEW STAGE · 16:9 SHEET'}
                </span>
                <span>
                  {activeConcept
                    ? `SAVED & SENT TO STUDIO (${activeConcept.timestamp})`
                    : 'READY TO GENERATE'}
                </span>
              </div>

              {/* Visual Canvas */}
              <div className="cad-grid-bg border-[0.75px] border-black rounded-[9px] overflow-hidden min-h-[270px] sm:min-h-[310px] flex items-center justify-center relative">
                {isGenerating ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-[9px] border-[0.75px] border-black bg-[#EF6922] flex items-center justify-center animate-pulse">
                      <RefreshCw className="w-5 h-5 text-black animate-spin" />
                    </div>
                    <p className="text-[0.76rem] tracking-cad uppercase font-medium text-black">
                      ENGINEERING CUSTOM CONCEPT SHEET...
                    </p>
                    <p className="text-[0.84rem] font-light text-black max-w-sm mx-auto">
                      Applying {resolvedWoodSpecies}, {resolvedDesignStyle} &amp;{' '}
                      {resolvedAddedDetails} in{' '}
                      {state.visualStyle === 'cad-2d'
                        ? '2D Rhino CAD elevation format'
                        : 'photorealistic 3D studio format'}
                      .
                    </p>
                  </div>
                ) : activeConcept ? (
                  <div className="w-full h-full relative group">
                    <img
                      src={activeConcept.imageUrl}
                      alt={activeConcept.summarySpec}
                      onClick={() => setFullscreenConcept(activeConcept)}
                      className="w-full max-h-[340px] object-contain cursor-zoom-in select-none mx-auto"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownloadConcept(activeConcept)}
                        className="bg-white hover:bg-[#FDCB33] text-black border-[0.75px] border-black rounded-[9px] py-1.5 px-3 text-[0.68rem] tracking-cad uppercase font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Download Concept PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>SAVE PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFullscreenConcept(activeConcept)}
                        className="bg-black hover:bg-[#EF6922] text-white hover:text-black border-[0.75px] border-black rounded-[9px] py-1.5 px-3 text-[0.68rem] tracking-cad uppercase font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="Zoom Fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>ZOOM</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 sm:p-8 text-center space-y-3">
                    <div className="w-11 h-11 mx-auto rounded-[9px] border-[0.75px] border-black bg-white flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-black" />
                    </div>
                    <p className="text-[0.76rem] tracking-cad uppercase font-medium text-black">
                      YOUR GENERATED 3D RENDER OR 2D CAD SKETCH WILL APPEAR HERE
                    </p>
                    <p className="text-[0.84rem] font-light text-black max-w-md mx-auto">
                      Click any of the 4 basic starter ideas on the left or describe your custom
                      piece and click GENERATE CUSTOM CONCEPT.
                    </p>
                  </div>
                )}
              </div>

              {/* Active Concept Controls: Automatic Dispatch Notice, Direct SMS/Email to Josh, Refine & Convert */}
              {activeConcept && (
                <div className="space-y-3 pt-1 text-left">
                  <div className="bg-[#CBCBCB]/40 border-[0.75px] border-black rounded-[9px] px-3.5 py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[0.68rem] tracking-cad uppercase font-medium text-black">
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
                  </div>

                  {/* Direct Send Concept Link & Specs to Josh via SMS or Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={refinementText}
                      onChange={(e) => setRefinementText(e.target.value)}
                      placeholder="Refine this concept (e.g., 'Add fluted doors' or 'Make it wider')..."
                      className="flex-1 h-[42px] bg-white text-black text-[0.84rem] px-3.5 rounded-[9px] border-[0.75px] border-black font-light focus:outline-none placeholder:text-black/45"
                    />
                    <button
                      type="button"
                      disabled={isGenerating || !refinementText.trim()}
                      onClick={() => runGeneration('refine')}
                      className="shrink-0 bg-[#27AAE0] text-black disabled:opacity-50 hover:bg-black hover:text-white text-[0.70rem] tracking-cad uppercase px-4 py-2.5 rounded-[9px] border-[0.75px] border-black font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      REFINE IMAGE
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
                        ? 'CONVERT THIS TO 3D HARDWOOD RENDER →'
                        : 'CONVERT THIS TO 2D CAD SKETCH →'}
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
            className="w-full max-w-4xl max-h-[85vh] bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-6 flex flex-col gap-4 overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#EF6922] text-black border border-black rounded-[9px] px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
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
