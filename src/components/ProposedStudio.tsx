import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Mail,
  Copy,
  Check,
  Upload,
  X,
  FileText,
  ArrowDownRight,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import { type ProjectData, CadModal } from './CadModal.tsx';
import { Footer } from './Footer.tsx';
import {
  ConceptVisualizer,
  type ConceptVisualizerState,
  type GeneratedConceptItem,
} from './ConceptVisualizer.tsx';
import { FrontCoverOptions } from './FrontCoverOptions.tsx';
import {
  MortiseWallCanvas,
  useMortiseWallController,
} from './MortiseWallSystem.tsx';

type HeroViewMode = 'split' | 'cad' | 'render';
type TeaserLensId = 'joint' | 'grain' | 'line' | 'color';
export type ProposedPageId =
  | 'cover'
  | 'methodology'
  | 'work'
  | 'capabilities'
  | 'process'
  | 'inquire'
  | 'visualizer';

interface ProposedPageMeta {
  id: ProposedPageId;
  code: string;
  shortTag: string;
  label: string;
  headerTitle: string;
  headerRight: string;
  bgClass: string;
  textClass: string;
  hoverBgClass: string;
  hoverTextClass: string;
  badgeTextClass?: string;
}

/**
 * 6 Separated Studio Pages with Distinct Architectural Color Coding:
 * 01 -> Orange (#EF6922)
 * 02 -> Blue   (#27AAE0)
 * 03 -> Yellow (#FDCB33)
 * 04 -> Grey   (#CBCBCB)
 * 05 -> Black  (#000000)
 * 06 -> Orange (#EF6922) — Custom Concept Visualizer
 */
export const STUDIO_INDEX_PAGES: ProposedPageMeta[] = [
  {
    id: 'methodology',
    code: '01',
    shortTag: '01 / CAD & DESIGN',
    label: '01 / DESIGN & METHODOLOGY',
    headerTitle: '01 / DESIGN & METHODOLOGY — FROM 2D RHINO CAD TO HANDCRAFTED REALITY',
    headerRight: 'DWG-CG-001 · TOLERANCE: ± 1/32"',
    bgClass: 'bg-[#EF6922]',
    textClass: 'text-black',
    hoverBgClass: 'hover:bg-[#EF6922]',
    hoverTextClass: 'hover:text-black',
  },
  {
    id: 'work',
    code: '02',
    shortTag: '02 / WORK',
    label: '02 / SELECTED WORK',
    headerTitle: '02 / SELECTED WORK — 3D DESIGN PROPOSALS & 2D RHINO SHOP DRAWINGS',
    headerRight: 'CLICK ANY SHEET TO ZOOM FULLSCREEN',
    bgClass: 'bg-[#27AAE0]',
    textClass: 'text-black',
    hoverBgClass: 'hover:bg-[#27AAE0]',
    hoverTextClass: 'hover:text-black',
  },
  {
    id: 'capabilities',
    code: '03',
    shortTag: '03 / CAPABILITIES',
    label: '03 / CAPABILITIES & SPECS',
    headerTitle: '03 / STUDIO CAPABILITIES, MATERIALS & JOINERY',
    headerRight: 'SPEC-CG-003 · OMAHA STUDIO',
    bgClass: 'bg-[#FDCB33]',
    textClass: 'text-black',
    hoverBgClass: 'hover:bg-[#FDCB33]',
    hoverTextClass: 'hover:text-black',
  },
  {
    id: 'process',
    code: '04',
    shortTag: '04 / PROCESS',
    label: '04 / PROCESS & TRADE',
    headerTitle: '04 / CUSTOM DESIGN PROCESS & ARCHITECTURAL TRADE SUBMITTALS',
    headerRight: 'HOMEOWNERS · ARCHITECTS · BUILDERS',
    bgClass: 'bg-[#CBCBCB]',
    textClass: 'text-black',
    hoverBgClass: 'hover:bg-[#CBCBCB]',
    hoverTextClass: 'hover:text-black',
  },
  {
    id: 'inquire',
    code: '05',
    shortTag: '05 / INQUIRE',
    label: '05 / COMMISSION INQUIRY',
    headerTitle: '05 / COMMISSION A BUILD — PROJECT INQUIRY SCHEDULE',
    headerRight: 'DIRECT: 402-720-1377',
    bgClass: 'bg-black',
    textClass: 'text-white',
    hoverBgClass: 'hover:bg-black',
    hoverTextClass: 'hover:text-white',
    badgeTextClass: 'text-[#FDCB33]',
  },
  {
    id: 'visualizer',
    code: '06',
    shortTag: '06 / VISUALIZER',
    label: '06 / CONCEPT VISUALIZER',
    headerTitle:
      '06 / CUSTOM CONCEPT VISUALIZER — TEST YOUR CUSTOM BUILD IDEA IN 3D RENDER OR 2D CAD',
    headerRight: 'DWG-CG-006 · 3D PROPOSAL & 2D CAD',
    bgClass: 'bg-[#EF6922]',
    textClass: 'text-black',
    hoverBgClass: 'hover:bg-[#EF6922]',
    hoverTextClass: 'hover:text-black',
  },
];

interface LensItem {
  id: TeaserLensId;
  code: string;
  title: string;
  dwgRef: string;
  image: string;
  imageAlt: string;
  isCad?: boolean;
  headline: string;
  detail: string;
  targetProjectId: string;
}

const INSPECTION_LENSES: LensItem[] = [
  {
    id: 'joint',
    code: '01 / THE JOINT',
    title: 'EXPOSED FINGER-JOINTED WHITE OAK',
    dwgRef: 'DWG-1064HEM-S04',
    image: ASSETS.familyRoom.sheet4JoineryDetail,
    imageAlt: 'Exposed finger-jointed white oak and custom fluted walnut joinery',
    headline: 'Where structural engineering becomes the visual signature.',
    detail:
      'Precision 3/4" box finger-joints machined along solid Rift White Oak case corners, paired with custom scalloped drawer fronts and hand-fluted American Black Walnut.',
    targetProjectId: 'project-family-room',
  },
  {
    id: 'grain',
    code: '02 / THE TEXTURE',
    title: 'DEEP-FLUTED BLACK WALNUT & TURNED PULLS',
    dwgRef: 'DWG-1064HEM-S03',
    image: ASSETS.familyRoom.sheet3FlutedDetail,
    imageAlt: 'Macro detail of fluted walnut doors and bespoke turned pulls',
    headline: 'Tactile shadow lines carved into solid domestic hardwood.',
    detail:
      'Vertical and horizontal semicircular fluting milled in-house from select Black Walnut, fitted with 1-1/4" solid lathe-turned cylindrical pulls.',
    targetProjectId: 'project-family-room',
  },
  {
    id: 'line',
    code: '03 / THE DRAWING',
    title: 'DIMENSIONED 2D RHINO SHOP DRAWINGS',
    dwgRef: 'DWG-1070MCG-B1',
    image: ASSETS.kidsKitchen.sectionB1,
    imageAlt: '2D Rhino CAD Section Shop Drawing with fractional tolerances',
    isCad: true,
    headline: 'Resolved to 1/32 of an inch before a single board is cut.',
    detail:
      'Every commission begins as a full 3D Rhino model and fractional 2D architectural shop submittal so clearances, plumbing, and joinery leave nothing to guesswork.',
    targetProjectId: 'project-kids-kitchen',
  },
  {
    id: 'color',
    code: '04 / THE UNEXPECTED',
    title: 'TAMBOUR DOORS & BAUHAUS COLOR-BLOCKING',
    dwgRef: 'DWG-1064HEM-S07',
    image: ASSETS.wetBar.sheet7ColorBlockedDrawers,
    imageAlt: 'Custom wet bar with tambour doors and Bauhaus color-blocked drawer fronts',
    headline: 'Furniture and millwork that refuses to blend into the wall.',
    detail:
      'Book-matched walnut cabinetry and radiused white oak tambour islands accented with Bauhaus Orange, Fabrication Blue, and CAD Gray dovetail drawer stacks.',
    targetProjectId: 'project-wet-bar',
  },
];

interface AttachedFile {
  name: string;
  size: string;
  type: string;
  previewUrl?: string;
}

const VALID_PAGE_IDS: ProposedPageId[] = [
  'cover',
  'methodology',
  'work',
  'capabilities',
  'process',
  'inquire',
  'visualizer',
];

function getPageFromHash(): ProposedPageId {
  if (typeof window === 'undefined') return 'cover';
  const raw = window.location.hash.replace(/^#/, '').toLowerCase() as ProposedPageId;
  return VALID_PAGE_IDS.includes(raw) ? raw : 'cover';
}

export const ProposedStudio: React.FC = () => {
  const [activePage, setActivePage] = useState<ProposedPageId>(() => getPageFromHash());
  const wall = useMortiseWallController('01');
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroView, setHeroView] = useState<HeroViewMode>('split');
  const [activeLens, setActiveLens] = useState<TeaserLensId>('joint');
  const [filter, setFilter] = useState<'all' | 'architectural' | 'furniture' | 'commercial'>('all');
  const [activeImageIdx, setActiveImageIdx] = useState<Record<string, number>>({
    'family-room': 0,
    'wet-bar': 0,
    'kids-kitchen': 0,
  });
  const [showSpecs, setShowSpecs] = useState<Record<string, boolean>>({});
  const [lightboxState, setLightboxState] = useState<{
    project: ProjectData | null;
    imageIndex: number;
    showSpecs?: boolean;
  }>({ project: null, imageIndex: 0, showSpecs: false });

  // Inquiry Form State
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    projectType: 'Custom Furniture',
    location: '',
    timeline: '',
    referenceLink: '',
    details: '',
  });
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [submitState, setSubmitState] = useState<'idle' | 'modal'>('idle');
  const [submitMode, setSubmitMode] = useState<'sms' | 'email'>('sms');
  const [copied, setCopied] = useState(false);

  // Shared Custom Concept Visualizer State (Synced across Page 06 and Page 05)
  const [visualizerState, setVisualizerState] = useState<ConceptVisualizerState>({
    ideaPrompt: '',
    visualStyle: 'render-3d',
    woodSpecies: 'American Black Walnut',
    customWoodText: '',
    designStyle: 'Mid-Century Modern',
    customStyleText: '',
    addedDetails: 'Full Overlay Doors',
    customDetailsText: '',
    uploadedPhoto: null,
    history: [],
    activeConceptId: null,
  });

  const applyConceptToInquiryForm = (concept: GeneratedConceptItem) => {
    setFormData((prev) => {
      const imageLine = concept.fullImageUrl ? `\nGenerated Concept Image: ${concept.fullImageUrl}` : '';
      const specBlock = `[GENERATED CONCEPT: ${concept.summarySpec}]${imageLine}`;
      if (prev.details.includes(concept.summarySpec)) return prev;
      return {
        ...prev,
        referenceLink: prev.referenceLink || concept.fullImageUrl || '',
        details: prev.details.trim()
          ? `${prev.details.trim()}\n\n${specBlock}`
          : `${concept.ideaPrompt}\n\n${specBlock}`,
      };
    });
  };

  const handleSendConceptToInquiry = (concept: GeneratedConceptItem | null) => {
    if (concept) {
      applyConceptToInquiryForm(concept);
    }
    navigateToPage('inquire');
  };

  const headerRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inquiryFormRef = useRef<HTMLFormElement | null>(null);
  const attachmentsRef = useRef<AttachedFile[]>([]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const OWNER_PHONE = '+14027201377';
  const OWNER_PHONE_DISPLAY = '402-720-1377';
  const OWNER_EMAIL = 'casegoodsne@gmail.com';

  const activePageMeta =
    STUDIO_INDEX_PAGES.find((p) => p.id === activePage) || STUDIO_INDEX_PAGES[0];
  const currentPageIdx = STUDIO_INDEX_PAGES.findIndex((p) => p.id === activePage);
  const prevPageMeta = currentPageIdx > 0 ? STUDIO_INDEX_PAGES[currentPageIdx - 1] : null;
  const nextPageMeta =
    currentPageIdx < STUDIO_INDEX_PAGES.length - 1 ? STUDIO_INDEX_PAGES[currentPageIdx + 1] : null;

  // Sync browser Back/Forward navigation with activePage
  useEffect(() => {
    const syncFromUrl = () => {
      setActivePage(getPageFromHash());
      setMenuOpen(false);
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen) setMenuOpen(false);
        if (submitState === 'modal') setSubmitState('idle');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, submitState]);

  useEffect(() => {
    if (submitState !== 'modal') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [submitState]);

  const pendingTargetRef = useRef<string | undefined>(undefined);

  const scrollToTopImmediate = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  useEffect(() => {
    if (pendingTargetRef.current) {
      const targetId = pendingTargetRef.current;
      pendingTargetRef.current = undefined;
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          scrollToTopImmediate();
        }
      }, 60);
      return () => clearTimeout(timer);
    }

    scrollToTopImmediate();
    const rafId = requestAnimationFrame(() => {
      scrollToTopImmediate();
    });
    return () => cancelAnimationFrame(rafId);
  }, [activePage]);

  const navigateToPage = (pageId: ProposedPageId, targetElementId?: string) => {
    setMenuOpen(false);
    // Blur the clicked bottom button so mobile browsers do not keep scroll anchored at the bottom
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (pageId === 'work' && targetElementId) {
      setFilter('all');
    }
    pendingTargetRef.current = targetElementId;
    setActivePage(pageId);

    const targetHash = pageId === 'cover' ? '' : `#${pageId}`;
    if (typeof window !== 'undefined' && window.location.hash !== targetHash) {
      const nextUrl = targetHash
        ? `${window.location.pathname}${window.location.search}${targetHash}`
        : `${window.location.pathname}${window.location.search}`;
      window.history.pushState(null, '', nextUrl);
    }

    if (!targetElementId) {
      scrollToTopImmediate();
      requestAnimationFrame(() => {
        scrollToTopImmediate();
      });
    }
  };

  /**
   * Each project is anchored to one of the Three Core Pillars:
   * - 1064HEM Family Room -> Pillar 01: #EF6922 (Bauhaus Orange)
   * - 1064HEM-WB Wet Bar  -> Pillar 02: #27AAE0 (Fabrication Blue)
   * - 1070MCG Kids Kitchen-> Pillar 03: #FDCB33 (Flex Yellow)
   */
  const projects: (ProjectData & {
    pillarBg: string;
    pillarCode: string;
    tolerance: string;
  })[] = [
    {
      id: 'family-room',
      code: '1064HEM',
      pillarCode: 'PILLAR 01 / ARCHITECTURAL MILLWORK',
      pillarBg: 'bg-[#EF6922]',
      tolerance: '± 1/32" RHINO 3D',
      title: 'FAMILY ROOM CABINETS & WINDOW BENCH',
      category: 'ARCHITECTURAL BUILT-IN',
      categoryTag: 'architectural',
      materials: 'FLUTED BLACK WALNUT · FINGER-JOINTED WHITE OAK · TURNED PULLS',
      dimensions: '144" W × 96" H FULL-WALL INSTALLATION',
      description:
        'Vertical and horizontal fluted American Black Walnut doors paired with exposed box-jointed Rift White Oak casework, integrated window bench storage, and custom lathe-turned cylindrical pulls.',
      images: [
        {
          src: ASSETS.familyRoom.sheet1FullElevation,
          sheetNumber: 'SHEET 01',
          label: 'Full architectural elevation — fluted walnut tower, window bench & floating shelves',
          alt: '3D architectural elevation of 144-inch full-wall built-in showing 96-inch fluted black walnut tower, 18-inch-high window bench storage, floating shelves, and exposed box finger-jointed white oak casework',
          type: 'render',
        },
        {
          src: ASSETS.familyRoom.sheet2CornerReturn,
          sheetNumber: 'SHEET 02',
          label: 'Corner return & tower perspective — exposed finger-joint white oak casing',
          alt: 'Corner return perspective detailing 24-inch-deep rift-sawn white oak casework with 0.75-inch exposed box finger-jointed corners and full-height semicircular fluted walnut doors',
          type: 'render',
        },
        {
          src: ASSETS.familyRoom.sheet3FlutedDetail,
          sheetNumber: 'SHEET 03',
          label: 'Close-up detail — vertical & horizontal fluted walnut doors & turned hardware',
          alt: 'Close-up millwork detail showing 0.5-inch-radius vertical and horizontal semicircular fluted black walnut doors paired with 1.25-inch lathe-turned solid wood cylindrical pulls',
          type: 'render',
        },
        {
          src: ASSETS.familyRoom.sheet4JoineryDetail,
          sheetNumber: 'SHEET 04',
          label: 'Joinery detail — exposed finger-joint casework & scalloped drawer profiles',
          alt: 'Joinery detail highlighting precision 0.75-inch exposed box finger-jointed solid white oak case corners, custom scalloped drawer fronts, and concealed soft-close undermount runners',
          type: 'render',
        },
      ],
      specs: [
        { label: 'PRIMARY HARDWOODS', value: 'Select American Black Walnut & Rift/Quarter-Sawn White Oak' },
        { label: 'DOOR & DRAWER MILLWORK', value: 'Custom vertical and horizontal semicircular fluting machined in-house' },
        { label: 'CASEWORK JOINERY', value: 'Exposed 3/4" box finger-joints along solid white oak case corners' },
        { label: 'HARDWARE & PULLS', value: 'Custom lathe-turned solid wood cylindrical pulls & concealed soft-close runners' },
      ],
    },
    {
      id: 'wet-bar',
      code: '1064HEM-WB',
      pillarCode: 'PILLAR 02 / SPATIAL & COMMERCIAL FABRICATION',
      pillarBg: 'bg-[#27AAE0]',
      tolerance: '± 1/32" RHINO 3D',
      title: 'WET BAR CREDENZA & FLUTED TAMBOUR ISLAND',
      category: 'WET BAR & SPECIALTY CABINETRY',
      categoryTag: 'commercial',
      materials: 'BAUHAUS COLOR-BLOCKED DRAWERS · FLUTED OAK TAMBOUR · WALNUT RAIL',
      dimensions: '96" BACK BAR + 84" × 36" RADIUS ISLAND',
      description:
        'Radiused White Oak fluted tambour peninsula island with a mortised solid walnut foot rail and matte black top, paired with a book-matched walnut back bar concealing Bauhaus color-blocked dovetail drawers.',
      images: [
        {
          src: ASSETS.wetBar.sheet6TambourIsland,
          sheetNumber: 'SHEET 01',
          label: 'Island perspective — fluted oak tambour front, walnut foot rail & matte black top',
          alt: '3D rendering of 84-inch by 36-inch radiused wet bar peninsula island featuring 42-inch-high oversized vertical fluted white oak tambour columns, mortised solid walnut foot rail, and 1.5-inch matte black top',
          type: 'render',
        },
        {
          src: ASSETS.wetBar.sheet7ColorBlockedDrawers,
          sheetNumber: 'SHEET 02',
          label: 'Interior elevation — color-blocked drawer stack in gray, blue & Bauhaus orange',
          alt: 'Interior elevation of 96-inch walnut back bar credenza showing 36-inch counter height, book-matched walnut doors with routed finger-pull joinery, and Bauhaus color-blocked dovetail drawer stack',
          type: 'render',
        },
        {
          src: ASSETS.wetBar.sheet5OverheadLayout,
          sheetNumber: 'SHEET 03',
          label: 'Overhead spatial layout — back bar credenza & peninsula sink island',
          alt: 'Overhead architectural plan view showing 96-inch back bar credenza, 42-inch walkway clearance, and 84-inch radiused fluted white oak tambour peninsula island with undermount stainless bar sink',
          type: 'render',
        },
      ],
      specs: [
        { label: 'ISLAND FRONT', value: 'Oversized vertical fluted white oak columns with solid walnut base rail' },
        { label: 'ACCENT DRAWER FRONTS', value: 'Color-blocked in Bauhaus Orange (#EF6922), Fabrication Blue (#27AAE0) & Gray (#CBCBCB)' },
        { label: 'CASEWORK & DOORS', value: 'Vertical book-matched walnut doors with integrated black finger pulls' },
        { label: 'COUNTERTOPS', value: 'Matte black radiused countertop with stainless undermount bar sink' },
      ],
    },
    {
      id: 'kids-kitchen',
      code: '1070MCG',
      pillarCode: 'PILLAR 03 / HEIRLOOM PRODUCTS & 2D CAD',
      pillarBg: 'bg-[#FDCB33]',
      tolerance: 'FRACTIONAL 2D CAD',
      title: 'HEIRLOOM PLAY KITCHEN & BUILT-IN WALL — SHOP DRAWINGS',
      category: 'HEIRLOOM FURNITURE & CAD SUBMITTAL',
      categoryTag: 'furniture',
      materials: 'SOLID BLACK WALNUT · STACKED-BALL LATHE LEGS · SCALLOPED APRON',
      dimensions: '48 1/4" W KITCHENETTE + 72 3/4" W × 101" H BUILT-IN',
      description:
        'Dimensioned 2D Rhino CAD elevation and section shop drawings for a solid walnut heirloom play kitchen featuring lathe-turned stacked-ball legs, a continuous scalloped apron, and full-height adjacent storage.',
      images: [
        {
          src: ASSETS.kidsKitchen.elevationA1,
          sheetNumber: 'ELEVATION A1',
          label: 'Kids kitchen elevation drawing — full fractional dimensions (48 1/4" width / 101" height)',
          alt: 'Rhino 2D CAD elevation drawing showing 48.25-inch overall countertop span and stacked-ball lathe legs',
          type: 'cad',
        },
        {
          src: ASSETS.kidsKitchen.sectionB1,
          sheetNumber: 'SECTION B1',
          label: 'Section view through kids kitchen & plumbing clearance detail',
          alt: 'Rhino 2D CAD section B1 shop drawing detailing 30.5-inch countertop height, 9.75-inch stacked-ball lathe leg tenon joinery, continuous scalloped apron profile, and 72.75-inch by 101-inch built-in storage wall',
          type: 'cad',
        },
      ],
      specs: [
        { label: 'ENGINEERING SOFTWARE', value: 'Rhino 3D CAD Modeling & Dimensioned 2D Architectural Shop Drawings' },
        { label: 'KITCHENETTE WIDTH', value: '48 1/4" Overall Countertop Span × 30 1/2" Counter Height' },
        { label: 'TURNED & SHAPED DETAILS', value: 'Lathe-turned stacked-ball legs (9 3/4" H) with continuous scalloped apron' },
        { label: 'ADJACENT MILLWORK', value: '72 3/4" W × 101" H full-height architectural storage cabinetry' },
      ],
    },
  ];

  const filteredProjects = projects.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'architectural') return p.id === 'family-room' || p.id === 'wet-bar';
    if (filter === 'furniture') return p.id === 'kids-kitchen';
    if (filter === 'commercial') return p.id === 'wet-bar';
    return true;
  });

  const handleInquireAboutProject = (project: ProjectData) => {
    const mappedType =
      project.categoryTag === 'architectural'
        ? 'Architectural Built-In / Cabinetry'
        : project.categoryTag === 'commercial'
        ? 'Commercial Millwork'
        : 'Custom Furniture';
    const refLine = `Inspired by ${project.code} (${project.title}).`;

    setFormData((prev) => ({
      ...prev,
      projectType: mappedType,
      details: prev.details.includes(project.code)
        ? prev.details
        : prev.details.trim()
        ? `${refLine}\n\n${prev.details.trim()}`
        : `${refLine} `,
    }));
    navigateToPage('inquire');
  };

  const currentLens =
    INSPECTION_LENSES.find((l) => l.id === activeLens) || INSPECTION_LENSES[0];

  const setSheetIndex = (projectId: string, index: number) => {
    setActiveImageIdx((prev) => ({ ...prev, [projectId]: index }));
    setShowSpecs((prev) => ({ ...prev, [projectId]: false }));
  };

  // File Upload & Inquiry Formatting
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = Array.from(files).map((file) => ({
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type || 'document',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setAttachments((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const formatSummary = () => {
    const attachmentNames =
      attachments.length > 0
        ? attachments.map((a) => `${a.name} (${a.size})`).join(', ')
        : 'None attached';

    const activeConcept =
      visualizerState.history.find((c) => c.id === visualizerState.activeConceptId) ||
      visualizerState.history[0] ||
      null;

    return `CASEGOODS COMMISSION INQUIRY
Name: ${formData.name || 'Not provided'}
Contact: ${formData.contact || 'Not provided'}
Project Type: ${formData.projectType}
Timeline & Location: ${formData.timeline || 'Flexible'} / ${formData.location || 'Omaha, NE'}
Reference Photos / Sketches: ${attachmentNames}${
      activeConcept ? `\nVisualized Concept Sheet: ${activeConcept.summarySpec}` : ''
    }${
      activeConcept?.fullImageUrl ? `\nGenerated Concept Image Link: ${activeConcept.fullImageUrl}` : ''
    }${
      formData.referenceLink ? `\nInspiration / Plan Link: ${formData.referenceLink}` : ''
    }
Details: ${formData.details || 'Custom woodworking commission'}`;
  };

  const handleSubmit = (e: React.FormEvent, mode: 'sms' | 'email') => {
    e.preventDefault();
    if (inquiryFormRef.current && !inquiryFormRef.current.reportValidity()) {
      return;
    }
    setSubmitMode(mode);
    const summary = formatSummary();

    if (mode === 'sms') {
      window.location.href = `sms:${OWNER_PHONE}?&body=${encodeURIComponent(summary)}`;
    } else {
      const subject = `Commission Inquiry: ${formData.projectType}${
        formData.name.trim() ? ` — ${formData.name.trim()}` : ''
      }`;
      window.location.href = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
    }
    setSubmitState('modal');
  };

  const handleCopy = async () => {
    const text = formatSummary();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        // Ignore if copy is blocked
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      {activePage === 'cover' && (
        <MortiseWallCanvas
          controller={wall}
          heroSelector="#hero-center-stack"
          headerSelector="header"
          footerSelector="footer"
          isModalOpen={Boolean(lightboxState.project) || submitState === 'modal'}
        />
      )}
      <div
        className={`min-h-screen text-black font-nexa antialiased flex flex-col selection:bg-[#EF6922] selection:text-black ${
          activePage === 'cover' ? 'mortise-page-shell' : 'bg-white'
        }`}
      >
      {/* =======================================================================
          TOP BAR CONTRACT: 3-Zone Architectural Header
          Hidden on the initial minimal front page ('cover'); appears once the
          visitor enters the studio pages (01–06).
      ======================================================================= */}
      {activePage !== 'cover' && (
        <header
          ref={headerRef}
          className="sticky top-0 z-40 bg-white border-b-[1.5px] border-black"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_260px] lg:grid-cols-[280px_1fr_280px] items-center gap-4">
              {/* Zone 1: Studio Index Dropdown — Reflects Selected Page Color */}
              <div className="hidden md:flex items-center justify-start relative z-50">
                <button
                  type="button"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className={`w-full ${activePageMeta.bgClass} ${activePageMeta.textClass} hover:opacity-90 text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border-[1.5px] border-black transition-colors cursor-pointer font-medium whitespace-nowrap flex items-center justify-between gap-2`}
                >
                  <span>STUDIO INDEX {activePageMeta.code}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {menuOpen && (
                  <div className="absolute left-0 top-full pt-2 w-full z-50">
                    <div className="bg-white border-[1.5px] border-black rounded-[9px] p-2.5 shadow-xl flex flex-col gap-2">
                      {STUDIO_INDEX_PAGES.map((sec) => {
                        const isSelected = sec.id === activePage;
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => navigateToPage(sec.id)}
                            className={`w-full py-2.5 px-3 rounded-[9px] border border-black text-[0.70rem] tracking-cad uppercase transition-colors cursor-pointer text-left font-medium whitespace-nowrap ${
                              isSelected
                                ? `${sec.bgClass} ${sec.textClass}`
                                : `bg-white text-black ${sec.hoverBgClass} ${sec.hoverTextClass}`
                            }`}
                          >
                            {sec.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Zone 2: Center Brand Lockup (Returns to Minimal Front Cover) */}
              <div className="flex items-center justify-center">
                <a
                  href="#cover"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateToPage('cover');
                  }}
                  className="inline-flex items-center justify-center group focus:outline-none"
                  aria-label="casegoods — handcrafted in omaha"
                >
                  <img
                    src={ASSETS.brand.logoFull}
                    alt="casegoods — handcrafted in omaha"
                    className="h-16 sm:h-20 md:h-[88px] w-auto object-contain select-none transition-transform duration-200 group-hover:scale-[1.01]"
                    referrerPolicy="no-referrer"
                  />
                </a>
              </div>

              {/* Zone 3: Primary Action Button */}
              <div className="hidden md:flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => navigateToPage('inquire')}
                  className={`w-full text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] border-[1.5px] border-black transition-colors cursor-pointer text-center font-medium whitespace-nowrap ${
                    activePage === 'inquire'
                      ? 'bg-[#FDCB33] text-black hover:bg-[#EF6922]'
                      : 'bg-black text-white hover:bg-[#EF6922] hover:text-black'
                  }`}
                >
                  COMMISSION A BUILD →
                </button>
              </div>

              {/* Mobile Top Controls */}
              <div className="flex md:hidden items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className={`flex-1 ${activePageMeta.bgClass} ${activePageMeta.textClass} text-[0.70rem] tracking-cad uppercase py-2.5 px-3 rounded-[9px] border-[1.5px] border-black font-medium whitespace-nowrap flex items-center justify-between gap-1.5 cursor-pointer`}
                >
                  <span>STUDIO INDEX {activePageMeta.code}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => navigateToPage('inquire')}
                  className="shrink-0 bg-black text-white text-[0.70rem] tracking-cad uppercase py-2.5 px-3.5 rounded-[9px] border-[1.5px] border-black font-medium whitespace-nowrap text-center cursor-pointer"
                >
                  INQUIRE
                </button>
              </div>

              {menuOpen && (
                <div className="md:hidden bg-white border-[1.5px] border-black rounded-[9px] p-2.5 flex flex-col gap-2">
                  {STUDIO_INDEX_PAGES.map((sec) => {
                    const isSelected = sec.id === activePage;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => navigateToPage(sec.id)}
                        className={`w-full py-2.5 px-3.5 rounded-[9px] border border-black text-[0.72rem] tracking-cad uppercase text-left font-medium ${
                          isSelected
                            ? `${sec.bgClass} ${sec.textClass}`
                            : `bg-white text-black ${sec.hoverBgClass} ${sec.hoverTextClass}`
                        }`}
                      >
                        {sec.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* =======================================================================
          SEPARATED SINGLE-PAGE STUDIO VIEWPORT
          Opens on the clean minimal front page ('cover'), or renders the
          currently selected studio sheet (01–06) without information overload.
      ======================================================================= */}
      <main
        className={`flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 ${
          activePage === 'cover'
            ? 'py-8 sm:py-12 flex flex-col justify-center'
            : 'pt-8 pb-16 flex flex-col justify-between'
        }`}
      >
        <div>
          {/* ===================================================================
              MINIMAL FRONT PAGE (5 Options Switcher — Not Listed in Studio Index)
          =================================================================== */}
          {activePage === 'cover' && (
            <FrontCoverOptions onNavigate={navigateToPage} wall={wall} />
          )}

          {/* ===================================================================
              PAGE 01: DESIGN & 3D CAD METHODOLOGY (#EF6922 ORANGE)
          =================================================================== */}
          {activePage === 'methodology' && (
            <section id="methodology" aria-label="01 Design and Methodology">
              {/* Standalone Section Title Block Bar — Bauhaus Orange (#EF6922) + Black Ink */}
              <div className="w-full bg-[#EF6922] text-black border-[1.5px] border-black rounded-[9px] px-5 py-3 mb-3.5 flex flex-wrap items-center justify-between gap-2 select-none">
                <span className="text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase font-medium">
                  01 / DESIGN &amp; METHODOLOGY — FROM 2D RHINO CAD TO HANDCRAFTED REALITY
                </span>
                <span className="text-[0.72rem] tracking-cad uppercase font-medium">
                  DWG-CG-001 · TOLERANCE: ± 1/32&quot;
                </span>
              </div>

              {/* Primary Sheet Container — 1.5px Solid Black with 9px Radius */}
              <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-7 space-y-6">
                {/* Top Lead Row: Left-Aligned Studio Proposition + 3 Pillar Spec Badges */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  <div className="lg:col-span-8 bg-white border border-black rounded-[9px] p-6 flex flex-col justify-center text-left">
                    <p className="text-[0.72rem] tracking-cad uppercase text-black font-medium mb-2">
                      OMAHA, NEBRASKA · CUSTOM FURNITURE &amp; ARCHITECTURAL MILLWORK
                    </p>
                    <h1 className="text-[1.35rem] sm:text-[1.65rem] font-normal text-black leading-snug mb-3">
                      We engineer and handcraft the pieces that have never been built before.
                    </h1>
                    <p className="text-[0.94rem] sm:text-[1.0rem] font-light leading-relaxed text-black max-w-[62ch]">
                      Every commission in our Omaha studio starts as a dimensioned 2D &amp; 3D Rhino
                      CAD proposal—resolving every reveal, finger-joint, and spatial clearance to
                      1/32 of an inch before a single board of domestic hardwood is cut.
                    </p>
                  </div>

                  {/* Right 4 Columns: Interactive Three-Pillar Quick Links */}
                  <div className="lg:col-span-4 flex flex-col justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setHeroView('cad')}
                      className="flex-1 bg-[#EF6922] text-black border border-black rounded-[9px] px-4 py-3 flex flex-col justify-center text-left hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <span className="text-[0.68rem] tracking-cad uppercase font-medium">
                        01 / DESIGN &amp; 3D CAD
                      </span>
                      <span className="text-[0.88rem] font-normal mt-0.5">
                        Rhino 3D Proposals &amp; 2D Shop Drawings
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToPage('work')}
                      className="flex-1 bg-[#27AAE0] text-black border border-black rounded-[9px] px-4 py-3 flex flex-col justify-center text-left hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <span className="text-[0.68rem] tracking-cad uppercase font-medium">
                        02 / SELECTED WORK →
                      </span>
                      <span className="text-[0.88rem] font-normal mt-0.5">
                        Explore Completed Proposals &amp; Sheets
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateToPage('capabilities')}
                      className="flex-1 bg-[#FDCB33] text-black border border-black rounded-[9px] px-4 py-3 flex flex-col justify-center text-left hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <span className="text-[0.68rem] tracking-cad uppercase font-medium">
                        03 / CAPABILITIES &amp; SPECS →
                      </span>
                      <span className="text-[0.88rem] font-normal mt-0.5">
                        Hardwoods, Millwork &amp; Joinery
                      </span>
                    </button>
                  </div>
                </div>

                {/* Shared Toolbar Above the Split Stage (Unified Pillar 01 Orange Active State) */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-[0.74rem] tracking-cad uppercase font-medium text-black">
                    TECHNICAL CAD DRAWINGS &amp; PHOTOREALISTIC PROPOSALS:
                  </span>

                  <div
                    className="flex flex-wrap items-center gap-2.5"
                    role="group"
                    aria-label="Methodology View Switcher"
                  >
                    {[
                      { id: 'split', label: 'SPLIT COMPARISON' },
                      { id: 'cad', label: '2D RHINO CAD' },
                      { id: 'render', label: '3D PROPOSAL' },
                    ].map((mode) => {
                      const isActive = heroView === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setHeroView(mode.id as HeroViewMode)}
                          className={`text-[0.72rem] tracking-cad uppercase px-4 py-2 rounded-[9px] border border-black transition-colors cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'bg-[#EF6922] text-black font-medium'
                              : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aligned 2-Column Split Comparison */}
                {heroView === 'split' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                    {/* Left Card: 2D Rhino CAD */}
                    <div className="border border-black rounded-[9px] bg-white p-4 sm:p-5 flex flex-col justify-between gap-4">
                      <div className="bg-[#CBCBCB] text-black border-[0.75px] border-black rounded-[9px] px-4 py-2 flex items-center justify-between text-[0.70rem] tracking-cad uppercase font-medium">
                        <span>SHEET A1 · 2D RHINO ELEVATION</span>
                        <span>DWG-1070MCG</span>
                      </div>

                      <div className="cad-grid-bg border-[0.75px] border-black rounded-[9px] p-4 flex items-center justify-center h-[280px] sm:h-[320px]">
                        <img
                          src={ASSETS.kidsKitchen.elevationA1}
                          alt="Rhino 2D CAD Elevation Shop Drawing with Fractional Callouts"
                          className="w-full h-full object-contain select-none"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <p className="text-[0.88rem] font-light text-black leading-relaxed text-left px-1">
                        <strong className="font-medium uppercase tracking-cad-tight text-[0.74rem] mr-2">
                          2D CAD:
                        </strong>
                        Every joint, reveal, and spatial clearance dialed in prior to milling.
                      </p>
                    </div>

                    {/* Right Card: 3D Proposal */}
                    <div className="border border-black rounded-[9px] bg-white p-4 sm:p-5 flex flex-col justify-between gap-4">
                      <div className="bg-[#EF6922] text-black border-[0.75px] border-black rounded-[9px] px-4 py-2 flex items-center justify-between text-[0.70rem] tracking-cad uppercase font-medium">
                        <span>SHEET 04 · 3D HARDWOOD PROPOSAL</span>
                        <span>DWG-1064HEM</span>
                      </div>

                      <div className="bg-white border-[0.75px] border-black rounded-[9px] overflow-hidden flex items-center justify-center h-[280px] sm:h-[320px]">
                        <img
                          src={ASSETS.familyRoom.sheet4JoineryDetail}
                          alt="3D Design Proposal showing exposed finger-jointed white oak and fluted walnut"
                          className="w-full h-full object-cover select-none"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <p className="text-[0.88rem] font-light text-black leading-relaxed text-left px-1">
                        <strong className="font-medium uppercase tracking-cad-tight text-[0.74rem] mr-2">
                          3D RENDER:
                        </strong>
                        Visualize exact hardwood grain, fluting profiles, and proportions in your space.
                      </p>
                    </div>
                  </div>
                )}

                {heroView === 'cad' && (
                  <div className="border border-black rounded-[9px] bg-white p-5 space-y-4">
                    <div className="cad-grid-bg border-[0.75px] border-black rounded-[9px] p-6 flex items-center justify-center">
                      <img
                        src={ASSETS.kidsKitchen.elevationA1}
                        alt="Full Rhino 2D CAD Elevation Drawing"
                        className="w-full max-h-[440px] object-contain select-none"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[0.92rem] font-light text-black">
                        Dimensioned 2D Rhino shop drawing showing 48 1/4&quot; span, stacked-ball
                        lathe legs, and 101&quot; built-in storage wall.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateToPage('work', 'project-kids-kitchen')}
                        className="text-[0.72rem] tracking-cad uppercase font-medium px-4 py-2.5 rounded-[9px] bg-[#EF6922] text-black border border-black cursor-pointer"
                      >
                        OPEN 1070MCG IN SELECTED WORK →
                      </button>
                    </div>
                  </div>
                )}

                {heroView === 'render' && (
                  <div className="border border-black rounded-[9px] bg-white p-5 space-y-4">
                    <div className="bg-white border-[0.75px] border-black rounded-[9px] overflow-hidden flex items-center justify-center">
                      <img
                        src={ASSETS.familyRoom.sheet3FlutedDetail}
                        alt="Close-up of fluted American black walnut doors and custom turned wood pulls"
                        className="w-full max-h-[440px] object-contain select-none"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[0.92rem] font-light text-black">
                        Photorealistic 3D proposal detailing vertical and horizontal semicircular
                        fluted Black Walnut doors and solid turned pulls.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigateToPage('work', 'project-family-room')}
                        className="text-[0.72rem] tracking-cad uppercase font-medium px-4 py-2.5 rounded-[9px] bg-[#EF6922] text-black border border-black cursor-pointer"
                      >
                        OPEN 1064HEM IN SELECTED WORK →
                      </button>
                    </div>
                  </div>
                )}

                {/* Closer Inspection 4-Lens Sub-Module */}
                <div className="pt-2 space-y-4">
                  <div className="bg-black text-white border border-black rounded-[9px] px-5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[0.74rem] tracking-cad uppercase font-normal">
                      CLOSER INSPECTION — SELECT A DETAIL LENS TO EXAMINE JOINERY &amp; FINISHES
                    </span>
                    <span className="text-[0.70rem] tracking-cad uppercase text-[#FDCB33]">
                      {currentLens.dwgRef}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {INSPECTION_LENSES.map((lens) => {
                      const isSelected = lens.id === activeLens;
                      return (
                        <button
                          key={lens.id}
                          type="button"
                          onClick={() => setActiveLens(lens.id)}
                          className={`py-2.5 px-3 rounded-[9px] border border-black text-[0.72rem] tracking-cad uppercase transition-colors cursor-pointer text-center ${
                            isSelected
                              ? 'bg-[#EF6922] text-black font-medium'
                              : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
                          }`}
                        >
                          {lens.code}
                        </button>
                      );
                    })}
                  </div>

                  <div className="border border-black rounded-[9px] p-5 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <button
                      type="button"
                      onClick={() => navigateToPage('work', currentLens.targetProjectId)}
                      aria-label={`Inspect ${currentLens.title} in Selected Work`}
                      className={`lg:col-span-5 h-[220px] w-full rounded-[9px] border-[0.75px] border-black overflow-hidden cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922] ${
                        currentLens.isCad ? 'cad-grid-bg p-3' : 'bg-white'
                      }`}
                    >
                      <img
                        src={currentLens.image}
                        alt={currentLens.imageAlt}
                        className={`w-full h-full ${
                          currentLens.isCad ? 'object-contain' : 'object-cover'
                        }`}
                        referrerPolicy="no-referrer"
                      />
                    </button>

                    <div className="lg:col-span-7 flex flex-col justify-between gap-4 text-left">
                      <div>
                        <div className="inline-block bg-[#CBCBCB] text-black border-[0.75px] border-black rounded-[9px] px-3.5 py-1 text-[0.68rem] tracking-cad uppercase font-medium mb-3">
                          {currentLens.title}
                        </div>
                        <h2 className="text-[1.12rem] sm:text-[1.25rem] font-normal text-black leading-snug mb-2">
                          {currentLens.headline}
                        </h2>
                        <p className="text-[0.92rem] font-light text-black leading-relaxed max-w-[60ch]">
                          {currentLens.detail}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigateToPage('work', currentLens.targetProjectId)}
                          className="bg-black text-white hover:bg-[#EF6922] hover:text-black text-[0.74rem] tracking-cad uppercase py-2.5 px-5 rounded-[9px] border-[0.75px] border-black transition-colors cursor-pointer font-medium inline-flex items-center gap-2"
                        >
                          <span>OPEN COMMISSION SHEET IN 02 / WORK</span>
                          <ArrowDownRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dedicated Callout & Orange Button on Page 01 to Launch Studio Index 06 Concept Visualizer */}
                <div className="border border-black rounded-[9px] p-5 sm:p-6 bg-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 text-left">
                  <div className="space-y-1.5">
                    <div className="inline-block bg-[#EF6922] text-black border-[0.75px] border-black rounded-[9px] px-3.5 py-1 text-[0.68rem] tracking-cad uppercase font-medium">
                      06 / INTERACTIVE CONCEPT VISUALIZER
                    </div>
                    <h3 className="text-[1.08rem] sm:text-[1.2rem] font-normal text-black leading-snug">
                      Have a custom furniture or built-in idea? See a visual concept in 3D or 2D CAD.
                    </h3>
                    <p className="text-[0.90rem] font-light text-black leading-relaxed max-w-[62ch]">
                      Describe your project, choose your hardwood and joinery profile, or upload a
                      photo of your room to generate a 3D Hardwood Proposal or 2D CAD Sketch on Page 06.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigateToPage('visualizer')}
                    className="w-full lg:w-auto shrink-0 bg-[#EF6922] text-black hover:bg-black hover:text-white text-[0.76rem] tracking-cad uppercase py-3.5 px-6 rounded-[9px] border border-black transition-colors cursor-pointer font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <span>OPEN 06 / CONCEPT VISUALIZER</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              PAGE 02: SELECTED WORK PORTFOLIO (#27AAE0 FABRICATION BLUE)
          =================================================================== */}
          {activePage === 'work' && (
            <section id="work" aria-label="02 Selected Work">
              {/* Standalone Section Title Block Bar — Fabrication Blue (#27AAE0) + Black Ink */}
              <div className="w-full bg-[#27AAE0] text-black border-[1.5px] border-black rounded-[9px] px-5 py-3 mb-3.5 flex flex-wrap items-center justify-between gap-2 select-none">
                <span className="text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase font-medium">
                  02 / SELECTED WORK — 3D DESIGN PROPOSALS &amp; 2D RHINO SHOP DRAWINGS
                </span>
                <span className="text-[0.72rem] tracking-cad uppercase font-medium">
                  CLICK ANY SHEET TO ZOOM FULLSCREEN
                </span>
              </div>

              {/* Filter Control Row (4 Symmetric rounded-[9px] border border-black Buttons) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {[
                  { id: 'all', label: '01 / ALL COMMISSIONS' },
                  { id: 'architectural', label: '02 / ARCHITECTURAL' },
                  { id: 'commercial', label: '03 / WET BARS & ISLANDS' },
                  { id: 'furniture', label: '04 / HEIRLOOM & CAD' },
                ].map((tab) => {
                  const isSelected = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setFilter(tab.id as 'all' | 'architectural' | 'furniture' | 'commercial')
                      }
                      className={`py-2.5 px-3 text-[0.72rem] tracking-cad uppercase rounded-[9px] border border-black transition-colors cursor-pointer text-center ${
                        isSelected
                          ? 'bg-[#27AAE0] text-black font-medium'
                          : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Individual Commission Sheets */}
              <div className="space-y-12">
                {filteredProjects.map((project) => {
                  const currentIdx = activeImageIdx[project.id] ?? 0;
                  const currentImg = project.images[currentIdx] || project.images[0];
                  const isSpecsOpen = !!showSpecs[project.id];

                  return (
                    <article
                      key={project.id}
                      id={`project-${project.id}`}
                      className="scroll-mt-28"
                    >
                      {/* Standalone Project Title Bar in its True Pillar Color (#EF6922, #27AAE0, or #FDCB33) + 14px mb-3.5 gap */}
                      <div
                        className={`w-full ${project.pillarBg} text-black border-[1.5px] border-black rounded-[9px] px-5 py-3 mb-3.5 flex flex-wrap items-center justify-between gap-2 select-none`}
                      >
                        <span className="text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase font-medium">
                          {project.title} — DWG {project.code}
                        </span>
                        <span className="text-[0.72rem] tracking-cad uppercase font-medium">
                          {project.pillarCode}
                        </span>
                      </div>

                      {/* Unified Black-Framed Project Sheet Container */}
                      <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-7 space-y-5">
                        {/* Top Control Strip: Materials Tag + Sheet Switcher Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium select-none">
                            {project.materials}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {project.images.map((img, idx) => {
                              const isSheetActive = !isSpecsOpen && currentIdx === idx;
                              return (
                                <button
                                  key={img.src}
                                  type="button"
                                  onClick={() => setSheetIndex(project.id, idx)}
                                  className={`text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-black transition-colors cursor-pointer ${
                                    isSheetActive
                                      ? `${project.pillarBg} text-black font-medium`
                                      : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
                                  }`}
                                >
                                  {img.sheetNumber}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() =>
                                setShowSpecs((prev) => ({
                                  ...prev,
                                  [project.id]: !prev[project.id],
                                }))
                              }
                              className={`text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-black transition-colors cursor-pointer ${
                                isSpecsOpen
                                  ? `${project.pillarBg} text-black font-medium`
                                  : 'bg-white text-black hover:bg-[#CBCBCB] font-normal'
                              }`}
                            >
                              SPEC SCHEDULE
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setLightboxState({
                                  project,
                                  imageIndex: currentIdx,
                                  showSpecs: isSpecsOpen,
                                })
                              }
                              className="text-[0.70rem] tracking-cad uppercase px-3.5 py-2 rounded-[9px] border border-black bg-black text-white hover:bg-[#EF6922] hover:text-black transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
                              title="Open High-Resolution Fullscreen Viewer"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">FULLSCREEN</span>
                            </button>
                          </div>
                        </div>

                        {/* Visual Stage or Spec Schedule Table */}
                        {!isSpecsOpen ? (
                          <div className="space-y-4">
                            <div
                              className={`relative w-full rounded-[9px] border border-black overflow-hidden flex items-center justify-center ${
                                currentImg.type === 'cad' ? 'cad-grid-bg p-4 sm:p-8' : 'bg-white'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxState({ project, imageIndex: currentIdx })
                                }
                                aria-label={`Zoom ${project.title} ${currentImg.sheetNumber}`}
                                className="w-full cursor-zoom-in flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
                              >
                                <img
                                  src={currentImg.src}
                                  alt={currentImg.alt}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full max-h-[540px] object-contain select-none"
                                  referrerPolicy="no-referrer"
                                />
                              </button>

                              {project.images.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSheetIndex(
                                        project.id,
                                        currentIdx === 0
                                          ? project.images.length - 1
                                          : currentIdx - 1
                                      )
                                    }
                                    aria-label="Previous sheet"
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[9px] bg-white hover:bg-[#CBCBCB] text-black border-[0.75px] border-black flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSheetIndex(
                                        project.id,
                                        currentIdx === project.images.length - 1
                                          ? 0
                                          : currentIdx + 1
                                      )
                                    }
                                    aria-label="Next sheet"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-[9px] bg-white hover:bg-[#CBCBCB] text-black border-[0.75px] border-black flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Thumbnail Strip */}
                            {project.images.length > 1 && (
                              <div className="w-full px-5 py-3.5 rounded-[9px] border border-black bg-white flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3 overflow-x-auto">
                                  {project.images.map((thumb, idx) => {
                                    const isSelected = currentIdx === idx;
                                    return (
                                      <button
                                        key={thumb.src}
                                        type="button"
                                        onClick={() => setSheetIndex(project.id, idx)}
                                        className={`relative rounded-[9px] overflow-hidden border-[0.75px] border-black transition-all cursor-pointer shrink-0 ${
                                          isSelected
                                            ? 'opacity-100 ring-2 ring-[#EF6922]'
                                            : 'opacity-60 hover:opacity-100'
                                        }`}
                                      >
                                        <img
                                          src={thumb.src}
                                          alt={thumb.alt}
                                          loading="lazy"
                                          className="w-20 sm:w-24 h-12 sm:h-14 object-cover bg-white"
                                          referrerPolicy="no-referrer"
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                                <span className="text-[0.82rem] font-normal text-black">
                                  {currentImg.sheetNumber} — {currentImg.label}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Spec Schedule View */
                          <div className="border border-black rounded-[9px] overflow-hidden bg-white">
                            <div
                              className={`${project.pillarBg} text-black border-b border-black px-5 py-3 text-[0.76rem] tracking-cad uppercase font-medium flex flex-wrap items-center justify-between gap-2`}
                            >
                              <span>
                                ARCHITECTURAL MATERIAL &amp; JOINERY SCHEDULE — {project.code}
                              </span>
                              <span>{project.dimensions}</span>
                            </div>
                            <div className="divide-y divide-black bg-white">
                              {project.specs.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="p-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-2 text-left"
                                >
                                  <span className="text-[0.74rem] tracking-cad uppercase font-medium text-black">
                                    {item.label}
                                  </span>
                                  <span className="sm:col-span-2 text-[0.92rem] font-light text-black">
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bottom CAD Title-Block Description & Action Box */}
                        <div className="w-full rounded-[9px] border border-black bg-white p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 text-left">
                          <div className="space-y-1">
                            <div className="text-[0.70rem] tracking-cad uppercase font-medium text-black">
                              PROJECT NOTES · {project.dimensions} · {project.tolerance}
                            </div>
                            <p className="text-[0.94rem] font-light text-black leading-relaxed max-w-[65ch]">
                              {project.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInquireAboutProject(project)}
                            className={`shrink-0 ${project.pillarBg} text-black hover:bg-black hover:text-white text-[0.74rem] tracking-cad uppercase py-3 px-5 rounded-[9px] border-[0.75px] border-black transition-colors cursor-pointer font-medium whitespace-nowrap`}
                          >
                            INQUIRE ABOUT THIS BUILD →
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ===================================================================
              PAGE 03: CAPABILITIES, MATERIALS & JOINERY (#FDCB33 FLEX YELLOW)
          =================================================================== */}
          {activePage === 'capabilities' && (
            <section id="capabilities" aria-label="03 Studio Capabilities and Specifications">
              {/* Standalone Section Title Block Bar — Flex Yellow (#FDCB33) + Black Ink */}
              <div className="w-full bg-[#FDCB33] text-black border-[1.5px] border-black rounded-[9px] px-5 py-3 mb-3.5 flex flex-wrap items-center justify-between gap-2 select-none">
                <span className="text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase font-medium">
                  03 / STUDIO CAPABILITIES, MATERIALS &amp; JOINERY
                </span>
                <span className="text-[0.72rem] tracking-cad uppercase font-medium">
                  SPEC-CG-003 · OMAHA STUDIO
                </span>
              </div>

              {/* Outer Black Sheet Frame with Intro Overview + 4 Symmetric Inner rounded-[9px] Cards */}
              <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-7 space-y-6">
                {/* Introductory Specification Overview Box */}
                <div className="border border-black rounded-[9px] p-5 sm:p-6 bg-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-left">
                  <div className="space-y-1.5">
                    <div className="inline-block bg-[#FDCB33] text-black border-[0.75px] border-black rounded-[9px] px-3.5 py-1 text-[0.68rem] tracking-cad uppercase font-medium">
                      MATERIAL &amp; FABRICATION STANDARDS
                    </div>
                    <p className="text-[0.94rem] sm:text-[1.0rem] font-light text-black leading-relaxed max-w-[66ch]">
                      From single heirloom furniture commissions to full-room architectural millwork,
                      every project is engineered in 3D Rhino CAD and fabricated in-house from select
                      domestic hardwoods in Omaha, Nebraska.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToPage('work')}
                    className="shrink-0 bg-black text-white hover:bg-[#FDCB33] hover:text-black text-[0.72rem] tracking-cad uppercase py-3 px-5 rounded-[9px] border border-black transition-colors cursor-pointer font-medium whitespace-nowrap"
                  >
                    VIEW COMPLETED WORK (02) →
                  </button>
                </div>

                {/* 4-Column Capabilities Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    {
                      code: '01 / ARCHITECTURAL',
                      headerBg: 'bg-[#EF6922]',
                      items: [
                        'Custom alcove & living room cabinetry',
                        'Integrated window benches & drawers',
                        'Wet bars & fluted tambour islands',
                        'Library walls, pole wraps & mouldings',
                      ],
                    },
                    {
                      code: '02 / HEIRLOOM FURNITURE',
                      headerBg: 'bg-[#27AAE0]',
                      items: [
                        'Solid hardwood dining & conference tables',
                        'Credenzas, consoles & sideboards',
                        'Custom lathe-turned legs & profiles',
                        'One-of-a-kind heirloom commissions',
                      ],
                    },
                    {
                      code: '03 / COMMERCIAL & SPATIAL',
                      headerBg: 'bg-[#FDCB33]',
                      items: [
                        'Reception desks & lobby installations',
                        'Acoustic slatted hardwood partitions',
                        'Hospitality, bar & restaurant millwork',
                        'Custom retail displays & fixtures',
                      ],
                    },
                    {
                      code: '04 / MATERIALS & JOINERY',
                      headerBg: 'bg-[#CBCBCB]',
                      items: [
                        'Select Black Walnut & Rift White Oak',
                        'Exposed finger-joint & dovetail casework',
                        'Custom fluted & tambour millwork',
                        'Bauhaus color-blocking & natural oils',
                      ],
                    },
                  ].map((pillar) => (
                    <div key={pillar.code} className="flex flex-col gap-3">
                      {/* Standalone rounded-[9px] Pillar Header Bar */}
                      <div
                        className={`w-full ${pillar.headerBg} text-black border border-black rounded-[9px] py-2.5 px-4 text-[0.74rem] tracking-cad uppercase font-medium text-center select-none`}
                      >
                        {pillar.code}
                      </div>

                      {/* Matching rounded-[9px] border border-black Spec Card */}
                      <div className="flex-1 bg-white border border-black rounded-[9px] p-5 flex flex-col justify-center text-left">
                        <ul className="space-y-3">
                          {pillar.items.map((item) => (
                            <li
                              key={item}
                              className="text-[0.88rem] font-light leading-relaxed text-black flex items-start gap-2.5"
                            >
                              <span className="text-black font-medium select-none">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              PAGE 04: PROCESS & TRADE PARTNERS (#CBCBCB CAD GREY)
          =================================================================== */}
          {activePage === 'process' && (
            <section id="process" aria-label="04 Process and Trade Partners">
              {/* Standalone Section Title Block Bar — CAD Grey (#CBCBCB) + Black Ink */}
              <div className="w-full bg-[#CBCBCB] text-black border-[1.5px] border-black rounded-[9px] px-5 py-3 mb-3.5 flex flex-wrap items-center justify-between gap-2 select-none">
                <span className="text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase font-medium">
                  04 / CUSTOM DESIGN PROCESS &amp; ARCHITECTURAL TRADE SUBMITTALS
                </span>
                <span className="text-[0.72rem] tracking-cad uppercase font-medium">
                  HOMEOWNERS · ARCHITECTS · BUILDERS
                </span>
              </div>

              {/* Sheet Container */}
              <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-7 space-y-6">
                {/* 4-Step Process Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    {
                      step: '01 / CONSULTATION',
                      headerBg: 'bg-[#CBCBCB]',
                      description:
                        'Bring your space, floor plans, or a custom concept. We collaborate across residential, commercial, and architectural builds.',
                    },
                    {
                      step: '02 / 3D CAD & DRAWINGS',
                      headerBg: 'bg-[#EF6922]',
                      description:
                        'Your idea is translated into photorealistic 3D renderings and dimensioned 2D Rhino shop drawings before a board is cut.',
                    },
                    {
                      step: '03 / FABRICATION',
                      headerBg: 'bg-[#27AAE0]',
                      description:
                        'Handcrafted in our Omaha studio using select domestic hardwoods, precision CNC & traditional joinery, and natural oil finishes.',
                    },
                    {
                      step: '04 / INSTALLATION',
                      headerBg: 'bg-[#FDCB33]',
                      description:
                        'Careful transport and meticulous on-site installation, scribed and fitted seamlessly to your home or commercial space.',
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex flex-col gap-3">
                      <div
                        className={`w-full ${item.headerBg} text-black border border-black rounded-[9px] py-2.5 px-4 text-[0.74rem] tracking-cad uppercase font-medium text-center select-none`}
                      >
                        {item.step}
                      </div>
                      <div className="flex-1 bg-white border border-black rounded-[9px] p-5 text-left">
                        <p className="text-[0.88rem] font-light leading-relaxed text-black">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trade Partner Submittal Callout Card */}
                <div
                  id="trade"
                  className="border border-black rounded-[9px] p-5 sm:p-6 bg-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
                >
                  <div className="lg:col-span-7 space-y-4 text-left">
                    <div className="inline-block bg-[#CBCBCB] text-black border-[0.75px] border-black rounded-[9px] px-4 py-1.5 text-[0.72rem] tracking-cad uppercase font-medium">
                      FOR ARCHITECTS, INTERIOR DESIGNERS &amp; CUSTOM BUILDERS
                    </div>
                    <h2 className="text-[1.15rem] sm:text-[1.3rem] font-normal text-black leading-snug">
                      Partner with an Omaha fabricator who speaks architectural CAD.
                    </h2>
                    <p className="text-[0.92rem] font-light text-black leading-relaxed max-w-[60ch]">
                      We provide complete 2D Rhino elevation, section, and plan submittals with
                      fractional callouts, photorealistic 3D client renders, and direct on-site
                      coordination with your electrical, plumbing, and general contracting teams.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => navigateToPage('inquire')}
                        className="bg-[#FDCB33] text-black hover:bg-black hover:text-white text-[0.74rem] tracking-cad uppercase py-3 px-5 rounded-[9px] border border-black transition-colors cursor-pointer font-medium"
                      >
                        SUBMIT FLOOR PLANS OR DRAWINGS →
                      </button>
                      <a
                        href="mailto:casegoodsne@gmail.com?subject=Trade%20%2F%20Architectural%20Collaboration%20Inquiry"
                        className="bg-white text-black hover:bg-[#CBCBCB] text-[0.74rem] tracking-cad uppercase py-3 px-5 rounded-[9px] border border-black transition-colors font-medium"
                      >
                        EMAIL CASEGOODSNE@GMAIL.COM
                      </a>
                    </div>
                  </div>

                  <div className="lg:col-span-5 border border-black rounded-[9px] p-4 bg-white space-y-3">
                    <div className="bg-[#CBCBCB] text-black border-[0.75px] border-black rounded-[9px] px-4 py-2 text-[0.70rem] tracking-cad uppercase font-medium flex items-center justify-between">
                      <span>SAMPLE SUBMITTAL — 1070MCG</span>
                      <span>SECTION B1</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxState({
                          project: projects[2],
                          imageIndex: 1,
                        })
                      }
                      aria-label="Zoom Sample Rhino 2D CAD Section B1 Submittal"
                      className="cad-grid-bg border-[0.75px] border-black rounded-[9px] p-4 w-full flex items-center justify-center cursor-zoom-in h-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
                    >
                      <img
                        src={ASSETS.kidsKitchen.sectionB1}
                        alt="Sample Rhino 2D CAD Section & Plumbing Submittal"
                        loading="lazy"
                        className="w-full h-full object-contain select-none"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ===================================================================
              PAGE 05: COMMISSION INQUIRY SHEET (#000000 BLACK)
          =================================================================== */}
          {activePage === 'inquire' && (
            <section id="inquire" aria-label="05 Commission Inquiry">
              {/* Standalone Section Title Block Bar — Drafting Black (#000000) + White Ink */}
              <div className="w-full bg-black text-white border-[1.5px] border-black rounded-[9px] px-5 py-3 mb-3.5 flex flex-wrap items-center justify-between gap-2 select-none">
                <span className="text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase font-normal">
                  05 / COMMISSION A BUILD — PROJECT INQUIRY SCHEDULE
                </span>
                <span className="text-[0.72rem] tracking-cad uppercase text-[#FDCB33] font-medium">
                  DIRECT: {OWNER_PHONE_DISPLAY}
                </span>
              </div>

              {/* Unified Black-Framed Inquiry Sheet */}
              <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] p-5 sm:p-7 space-y-6">
                <div className="border border-black rounded-[9px] p-5 bg-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 text-left">
                  <p className="text-[0.95rem] sm:text-[1.0rem] font-light text-black leading-relaxed max-w-[64ch]">
                    Have a custom furniture piece, architectural built-in, or commercial build in
                    mind? Enter your project details below to text Josh directly at{' '}
                    <strong className="font-medium">{OWNER_PHONE_DISPLAY}</strong> or email{' '}
                    <strong className="font-medium">{OWNER_EMAIL}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateToPage('visualizer')}
                    className="shrink-0 bg-[#EF6922] text-black hover:bg-black hover:text-white text-[0.72rem] tracking-cad uppercase py-3 px-5 rounded-[9px] border border-black transition-colors cursor-pointer font-medium inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>VISUALIZE YOUR IDEA FIRST (PAGE 06)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {visualizerState.history.length > 0 && (
                  <div className="border border-black rounded-[9px] p-4 bg-[#FDCB33]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={
                          (
                            visualizerState.history.find(
                              (c) => c.id === visualizerState.activeConceptId
                            ) || visualizerState.history[0]
                          ).imageUrl
                        }
                        alt="Generated Custom Concept"
                        className="w-20 h-12 object-cover rounded-[6px] border-[0.75px] border-black bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="block text-[0.68rem] tracking-cad uppercase font-medium text-black">
                          ATTACHED CONCEPT FROM PAGE 06 VISUALIZER
                        </span>
                        <p className="text-[0.82rem] font-light text-black truncate">
                          {
                            (
                              visualizerState.history.find(
                                (c) => c.id === visualizerState.activeConceptId
                              ) || visualizerState.history[0]
                            ).summarySpec
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToPage('visualizer')}
                      className="shrink-0 bg-[#EF6922] text-black hover:bg-black hover:text-white text-[0.68rem] tracking-cad uppercase py-2 px-3.5 rounded-[9px] border-[0.75px] border-black font-medium cursor-pointer"
                    >
                      EDIT ON PAGE 06 →
                    </button>
                  </div>
                )}

                <form
                  ref={inquiryFormRef}
                  onSubmit={(e) => handleSubmit(e, submitMode)}
                  className="space-y-5"
                >
                  {/* Row 1: Name, Contact, Category */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="flex flex-col gap-2 text-left">
                      <label
                        htmlFor="prop-inquiry-name"
                        className="bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                      >
                        01 / YOUR NAME *
                      </label>
                      <input
                        id="prop-inquiry-name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="First & last name"
                        className="w-full h-[48px] bg-white text-black text-[0.92rem] px-4 rounded-[9px] border border-black font-light focus:outline-none focus:bg-[#FDCB33]/10 placeholder:text-black/45"
                      />
                    </div>

                    <div className="flex flex-col gap-2 text-left">
                      <label
                        htmlFor="prop-inquiry-contact"
                        className="bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                      >
                        02 / PHONE OR EMAIL *
                      </label>
                      <input
                        id="prop-inquiry-contact"
                        type="text"
                        required
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        placeholder="Best number or email"
                        className="w-full h-[48px] bg-white text-black text-[0.92rem] px-4 rounded-[9px] border border-black font-light focus:outline-none focus:bg-[#FDCB33]/10 placeholder:text-black/45"
                      />
                    </div>

                    <div className="flex flex-col gap-2 text-left">
                      <label
                        htmlFor="prop-inquiry-category"
                        className="bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                      >
                        03 / PROJECT CATEGORY
                      </label>
                      <select
                        id="prop-inquiry-category"
                        value={formData.projectType}
                        onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                        className="w-full h-[48px] bg-white text-black text-[0.92rem] px-4 rounded-[9px] border border-black font-normal focus:outline-none cursor-pointer"
                      >
                        <option value="Custom Furniture">Custom Furniture</option>
                        <option value="Architectural Built-In / Cabinetry">
                          Architectural Built-In / Cabinetry
                        </option>
                        <option value="Commercial Millwork">Commercial Millwork</option>
                        <option value="Architect / Designer Submittal">
                          Architect / Designer Submittal
                        </option>
                        <option value="One-of-a-Kind Design Challenge">
                          One-of-a-Kind Design Challenge
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Location & Timeline */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2 text-left">
                      <label
                        htmlFor="prop-inquiry-location"
                        className="bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                      >
                        04 / LOCATION
                      </label>
                      <input
                        id="prop-inquiry-location"
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Omaha, NE or surrounding area"
                        className="w-full h-[48px] bg-white text-black text-[0.92rem] px-4 rounded-[9px] border border-black font-light focus:outline-none placeholder:text-black/45"
                      />
                    </div>

                    <div className="flex flex-col gap-2 text-left">
                      <label
                        htmlFor="prop-inquiry-timeline"
                        className="bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                      >
                        05 / TARGET TIMELINE
                      </label>
                      <input
                        id="prop-inquiry-timeline"
                        type="text"
                        value={formData.timeline}
                        onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                        placeholder="e.g., Next 1–3 months or flexible"
                        className="w-full h-[48px] bg-white text-black text-[0.92rem] px-4 rounded-[9px] border border-black font-light focus:outline-none placeholder:text-black/45"
                      />
                    </div>
                  </div>

                  {/* Row 3: Attachments & Link */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2 text-left">
                      <label
                        htmlFor="prop-inquiry-attachments"
                        className="bg-[#27AAE0] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                      >
                        06 / SPACE PHOTOS, SKETCHES OR PLANS (OPTIONAL)
                      </label>
                      <input
                        id="prop-inquiry-attachments"
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.dwg,.dxf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-[48px] px-4 rounded-[9px] border border-black bg-white hover:bg-[#CBCBCB] text-[0.86rem] text-black flex items-center justify-center gap-2 transition-colors cursor-pointer font-normal"
                      >
                        <Upload className="w-4 h-4 text-black" />
                        <span>Attach photos, sketches, or PDF plans</span>
                      </button>

                      {attachments.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex flex-wrap gap-2">
                            {attachments.map((file, idx) => (
                              <div
                                key={`${file.name}-${idx}`}
                                className="flex items-center gap-2 bg-[#CBCBCB] border-[0.75px] border-black rounded-[9px] px-3 py-1.5 text-[0.76rem] font-medium"
                              >
                                {file.previewUrl ? (
                                  <img
                                    src={file.previewUrl}
                                    alt={file.name}
                                    className="w-5 h-5 rounded-[4px] object-cover border border-black/30 bg-white shrink-0"
                                  />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 text-black shrink-0" />
                                )}
                                <span className="max-w-[150px] truncate">{file.name}</span>
                                <span>({file.size})</span>
                                <button
                                  type="button"
                                  onClick={() => removeAttachment(idx)}
                                  className="text-black hover:text-[#EF6922] cursor-pointer"
                                  aria-label={`Remove ${file.name}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <p className="text-[0.74rem] font-light text-black/70">
                            Listed in your inquiry summary — remember to attach these files inside
                            your SMS or email app after clicking send.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 text-left">
                      <label
                        htmlFor="prop-inquiry-link"
                        className="bg-[#27AAE0] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                      >
                        07 / INSPIRATION OR SHARED FOLDER LINK (OPTIONAL)
                      </label>
                      <input
                        id="prop-inquiry-link"
                        type="url"
                        value={formData.referenceLink}
                        onChange={(e) =>
                          setFormData({ ...formData, referenceLink: e.target.value })
                        }
                        placeholder="Pinterest, iCloud photo link, or Google Drive..."
                        className="w-full h-[48px] bg-white text-black text-[0.92rem] px-4 rounded-[9px] border border-black font-light focus:outline-none placeholder:text-black/45"
                      />
                    </div>
                  </div>

                  {/* Row 4: Project Explanation */}
                  <div className="flex flex-col gap-2 text-left">
                    <label
                      htmlFor="prop-inquiry-details"
                      className="bg-[#EF6922] text-black border border-black rounded-[9px] py-2 px-4 text-[0.72rem] tracking-cad uppercase font-medium cursor-pointer"
                    >
                      08 / BRIEF PROJECT EXPLANATION *
                    </label>
                    <textarea
                      id="prop-inquiry-details"
                      required
                      rows={4}
                      value={formData.details}
                      onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                      placeholder="Tell me briefly about the piece, room dimensions, or idea you have in mind..."
                      className="w-full bg-white text-black text-[0.94rem] p-4 rounded-[9px] border border-black font-light focus:outline-none resize-y placeholder:text-black/45 leading-relaxed"
                    />
                  </div>

                  {/* Row 5: Dual Submission Triggers */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'sms')}
                      className="w-full bg-[#FDCB33] text-black text-[0.78rem] tracking-cad uppercase py-3.5 px-6 rounded-[9px] border border-black hover:bg-black hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>TEXT JOSH ({OWNER_PHONE_DISPLAY})</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, 'email')}
                      className="w-full bg-black text-white text-[0.78rem] tracking-cad uppercase py-3.5 px-6 rounded-[9px] border border-black hover:bg-[#EF6922] hover:text-black transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium"
                    >
                      <Mail className="w-4 h-4" />
                      <span>EMAIL ({OWNER_EMAIL})</span>
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* ===================================================================
              PAGE 06: CUSTOM CONCEPT VISUALIZER (#EF6922 BAUHAUS ORANGE)
          =================================================================== */}
          {activePage === 'visualizer' && (
            <section id="visualizer" aria-label="06 Custom Concept Visualizer">
              <ConceptVisualizer
                placement="visualizer"
                state={visualizerState}
                onChangeState={setVisualizerState}
                onSendToInquiry={handleSendConceptToInquiry}
                onApplyToInquiryForm={applyConceptToInquiryForm}
              />
            </section>
          )}
        </div>

        {/* ===================================================================
            BOTTOM MULTI-PAGE NAVIGATION BAR (01–06)
            Hidden on the minimal front page ('cover') so it remains uncluttered
        =================================================================== */}
        {activePage !== 'cover' && (
          <nav
            aria-label="Studio Page Navigation"
            className="mt-10 pt-6 border-t-[1.5px] border-black flex flex-col gap-4"
          >
            {/* 6-Page Direct Color Switcher Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {STUDIO_INDEX_PAGES.map((sec) => {
                const isSelected = sec.id === activePage;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => navigateToPage(sec.id)}
                    className={`py-2.5 px-3 rounded-[9px] border border-black text-[0.68rem] tracking-cad uppercase transition-colors cursor-pointer text-center whitespace-nowrap ${
                      isSelected
                        ? `${sec.bgClass} ${sec.textClass} font-medium`
                        : `bg-white text-black ${sec.hoverBgClass} ${sec.hoverTextClass} font-normal`
                    }`}
                  >
                    {sec.shortTag}
                  </button>
                );
              })}
            </div>

            {/* Previous / Next Page Row */}
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-3">
              {prevPageMeta ? (
                <button
                  type="button"
                  onClick={() => navigateToPage(prevPageMeta.id)}
                  className={`w-full sm:w-auto ${prevPageMeta.bgClass} ${prevPageMeta.textClass} text-[0.72rem] tracking-cad uppercase py-2.5 px-5 rounded-[9px] border border-black hover:opacity-90 transition-opacity cursor-pointer font-medium inline-flex items-center justify-center gap-2`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{prevPageMeta.label}</span>
                </button>
              ) : (
                <div className="hidden sm:block" />
              )}

              <span className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 text-center whitespace-nowrap text-[0.70rem] tracking-cad uppercase font-medium text-black select-none">
                STUDIO PAGE {activePageMeta.code} OF 06
              </span>

              {nextPageMeta ? (
                <button
                  type="button"
                  onClick={() => navigateToPage(nextPageMeta.id)}
                  className={`w-full sm:w-auto ${nextPageMeta.bgClass} ${nextPageMeta.textClass} text-[0.72rem] tracking-cad uppercase py-2.5 px-5 rounded-[9px] border border-black hover:opacity-90 transition-opacity cursor-pointer font-medium inline-flex items-center justify-center gap-2`}
                >
                  <span>{nextPageMeta.label}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToPage('methodology')}
                  className="w-full sm:w-auto bg-[#EF6922] text-black text-[0.72rem] tracking-cad uppercase py-2.5 px-5 rounded-[9px] border border-black hover:opacity-90 transition-opacity cursor-pointer font-medium inline-flex items-center justify-center gap-2"
                >
                  <span>RETURN TO 01 / DESIGN &amp; METHODOLOGY</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </nav>
        )}
      </main>

      {/* Architectural Business Card Footer */}
      <Footer />

      {/* High-Resolution CAD & Render Lightbox Modal */}
      <CadModal
        project={lightboxState.project}
        initialImageIndex={lightboxState.imageIndex}
        initialShowSpecs={lightboxState.showSpecs}
        onClose={() => setLightboxState({ project: null, imageIndex: 0, showSpecs: false })}
      />

      {/* Inquiry Dispatch Confirmation Modal */}
      {submitState === 'modal' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSubmitState('idle')}
        >
          <div
            className="relative w-full max-w-lg bg-white border-[1.5px] border-black rounded-[9px] p-6 shadow-2xl flex flex-col gap-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#FDCB33] text-black border border-black rounded-[9px] px-4 py-2.5 flex items-center justify-between">
              <span
                id="inquiry-modal-title"
                className="text-[0.76rem] tracking-cad uppercase font-medium"
              >
                COMMISSION INQUIRY READY
              </span>
              <button
                type="button"
                onClick={() => setSubmitState('idle')}
                className="text-[0.72rem] text-black font-medium uppercase tracking-cad cursor-pointer hover:underline"
              >
                [CLOSE]
              </button>
            </div>

            <p className="text-[0.92rem] text-black leading-relaxed font-light">
              Your inquiry for Josh Heinke ({OWNER_PHONE_DISPLAY} / {OWNER_EMAIL}) is formatted.
              {attachments.length > 0
                ? ' Remember to attach your selected photo or sketch files in the opened text or email window.'
                : ` Your default ${submitMode === 'sms' ? 'messaging app (SMS)' : 'email client'} was opened.`}
            </p>

            <div className="bg-white border border-black rounded-[9px] p-4 text-[0.78rem] font-mono whitespace-pre-wrap text-black select-all">
              {formatSummary()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 py-2.5 px-4 rounded-[9px] border-[0.75px] border-black text-[0.72rem] tracking-cad uppercase hover:bg-black hover:text-white transition-colors cursor-pointer font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY SUMMARY'}</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={`sms:${OWNER_PHONE}?&body=${encodeURIComponent(formatSummary())}`}
                  className="py-2.5 px-4 rounded-[9px] bg-[#EF6922] text-black border-[0.75px] border-black text-[0.72rem] tracking-cad uppercase font-medium"
                >
                  OPEN SMS
                </a>
                <a
                  href={`mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(
                    `Commission Inquiry: ${formData.projectType}${
                      formData.name.trim() ? ` — ${formData.name.trim()}` : ''
                    }`
                  )}&body=${encodeURIComponent(formatSummary())}`}
                  className="py-2.5 px-4 rounded-[9px] bg-[#27AAE0] text-black border-[0.75px] border-black text-[0.72rem] tracking-cad uppercase font-medium"
                >
                  OPEN EMAIL
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};
