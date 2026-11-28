import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  PenTool,
  RotateCcw,
  Eraser,
  Lock,
  KeyRound,
  LogOut,
  ArrowLeft,
  FolderOpen,
  Search,
  QrCode,
  X,
  ExternalLink,
  Download,
  CreditCard,
  Smartphone,
} from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ASSETS } from '../assets/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DEFAULT_INVOICE_DATA,
  InvoiceAssets,
  InvoiceTemplateData,
  computeInvoiceSummary,
  formatCurrency,
  generateInvoicePdf,
  generateInvoiceSvg,
} from '../utils/invoiceGenerator.ts';
import {
  CASEGOODS_PUBLIC_URL,
  DEFAULT_CASEGOODS_CONTACT,
  CasegoodsContactInfo,
  buildCasegoodsVCard,
  drawCasegoodsQrPdf,
  generateCasegoodsQrStandaloneSvg,
  renderSvgStringToPngBlob,
} from '../utils/casegoodsQr.ts';
import {
  DriveFolderItem,
  listGoogleDriveFolders,
} from '../utils/googleDriveFolders.ts';
import { ProjectsManagerPanel } from './ProjectsManagerPanel.tsx';
import { InvoiceSvgPreview } from './InvoiceSvgPreview.tsx';

const OWNER_EMAIL = 'jmheinke1@gmail.com';

const NEW_PROJECT_TEMPLATE: InvoiceTemplateData = {
  recipientName: 'CLIENT NAME',
  invoiceNumber: '2026-10XX',
  projectTitle: 'PROJECT TITLE',
  projectSummary:
    'THIS PROJECT CONSISTS OF DESIGNING, ENGINEERING, AND FABRICATING A CUSTOM HEIRLOOM-QUALITY COMMISSION CONSTRUCTED FROM SELECT SOLID HARDWOOD AND ARCHITECTURAL MILLWORK DETAILS.',
  pillars: {
    design: {
      amount: 200,
      description:
        'COVERS 3D CAD MODELING IN RHINO, DETAILED 2D ARCHITECTURAL SHOP DRAWINGS, AND CUSTOM JOINERY / ROUTER TEMPLATES.',
    },
    resources: {
      amount: 1000,
      description:
        'COVERS SELECT HARDWOOD LUMBER STOCK, VENEERED PLYWOOD, SOFT-CLOSE HARDWARE, AND HAND-RUBBED HARDWAX OIL FINISH.',
    },
    fabrication: {
      amount: 1400,
      description:
        'CAPTURES CORE SHOP LABOR INCLUDING MILLING, PRECISION JOINERY, HAND SANDING, FINISHING, AND LOCAL BLANKET-WRAPPED DELIVERY.',
    },
    flex: {
      amount: 300,
      description: 'COVERS UNEXPECTED EXPENSES AND GUARANTEES THE PRICE WILL NOT CHANGE.',
    },
  },
  depositAmount: 1450,
  depositMethodNote: 'CHECK',
  depositStatus: 'DUE UPON APPROVAL',
  pageLabel: '1',
  driveFolderUrl: '',
  driveFolderName: '',
};

type StudioTab = 'invoice' | 'projects' | 'card-qr';
type StudioQrTarget = 'card-url' | 'vcard' | 'website' | 'custom';

export const PrivateInvoiceStudio: React.FC = () => {
  const {
    user,
    driveAccessToken,
    studioToken,
    loading,
    signInWithGoogle,
    connectGoogleDrive,
    clearDriveAccessToken,
    setStudioToken,
    clearStudioToken,
    lockStudio,
    signOutUser,
    getFreshToken,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<StudioTab>('invoice');
  const [data, setData] = useState<InvoiceTemplateData>(DEFAULT_INVOICE_DATA);
  const [assets, setAssets] = useState<InvoiceAssets | null>(null);
  const [downloading, setDownloading] = useState<'svg' | 'pdf' | 'qr-svg' | 'qr-png' | 'qr-pdf' | null>(
    null
  );
  const [authError, setAuthError] = useState<string | null>(null);

  // Step 2: Server-verified Studio Passcode gate state
  const [passcodeMode, setPasscodeMode] = useState<'loading' | 'env' | 'claimed' | 'unclaimed'>(
    'loading'
  );
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeConfirm, setPasscodeConfirm] = useState('');
  const [passcodeSubmitting, setPasscodeSubmitting] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Google Drive Folder Picker state
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveQuery, setDriveQuery] = useState('');
  const [driveFolders, setDriveFolders] = useState<DriveFolderItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Mobile Card & CG QR Studio state — always defaults to permanent custom domain
  const origin = CASEGOODS_PUBLIC_URL;
  const [contactInfo, setContactInfo] = useState<CasegoodsContactInfo>({
    ...DEFAULT_CASEGOODS_CONTACT,
    websiteUrl: origin,
  });
  const [qrTarget, setQrTarget] = useState<StudioQrTarget>('card-url');
  const [customQrUrl, setCustomQrUrl] = useState<string>(`${origin}/card`);

  const isOwner = Boolean(user?.email && user.email.toLowerCase() === OWNER_EMAIL);
  const isStudioUnlocked = Boolean(isOwner && studioToken);

  // Check server-side passcode status whenever owner or unlock state changes
  useEffect(() => {
    if (!isOwner || !user) {
      setPasscodeMode('loading');
      setPasscodeInput('');
      setPasscodeConfirm('');
      setPasscodeError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setPasscodeError(null);
      try {
        const fbToken = await user.getIdToken();
        if (!fbToken || cancelled) return;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${fbToken}`,
        };
        if (studioToken) {
          headers['X-Studio-Token'] = studioToken;
        }
        const res = await fetch('/api/studio-auth/status', { headers });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setPasscodeError(payload.error || 'Unable to verify studio security status.');
          setPasscodeMode('claimed');
          return;
        }
        const nextMode =
          payload.mode === 'env' || payload.mode === 'claimed' || payload.mode === 'unclaimed'
            ? payload.mode
            : 'claimed';
        setPasscodeMode(nextMode);
        if (studioToken && !payload.unlocked) {
          clearStudioToken();
        }
      } catch {
        if (!cancelled) {
          setPasscodeError('Unable to reach server to check studio passcode status.');
          setPasscodeMode('claimed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, user, studioToken]);

  useEffect(() => {
    if (!isStudioUnlocked || assets) return;
    let cancelled = false;
    (async () => {
      try {
        const [mainRes, iconsRes, fontRes] = await Promise.all([
          fetch('/assets/aistudio/CASEGOODS_LOGO_FINAL6.png'),
          fetch('/assets/aistudio/LOGO_4_IMAGES.png'),
          fetch('/assets/NexaLight.ttf'),
        ]);
        const [mainBuf, iconsBuf, fontBuf] = await Promise.all([
          mainRes.arrayBuffer(),
          iconsRes.arrayBuffer(),
          fontRes.arrayBuffer(),
        ]);
        if (!cancelled) {
          setAssets({
            logoMainPng: new Uint8Array(mainBuf),
            logoIconsPng: new Uint8Array(iconsBuf),
            nexaLightTtf: new Uint8Array(fontBuf),
          });
        }
      } catch (err) {
        console.error('Unable to load brand assets for private invoice studio:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStudioUnlocked, assets]);

  const summary = useMemo(() => computeInvoiceSummary(data), [data]);

  const invoiceQrPreviewUri = useMemo(() => {
    if (!data.driveFolderUrl?.trim()) return null;
    const svg = generateCasegoodsQrStandaloneSvg(data.driveFolderUrl.trim(), 220, {
      frameStyle: 'cg-badge',
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [data.driveFolderUrl]);

  const cardQrPayload = useMemo(() => {
    if (qrTarget === 'vcard') return buildCasegoodsVCard(contactInfo, true);
    if (qrTarget === 'website') return contactInfo.websiteUrl.trim() || origin;
    if (qrTarget === 'custom') return customQrUrl.trim() || origin;
    const base = contactInfo.websiteUrl.trim().replace(/\/+$/, '') || origin;
    return `${base}/card`;
  }, [qrTarget, contactInfo, customQrUrl, origin]);

  const cardQrSvg = useMemo(
    () =>
      generateCasegoodsQrStandaloneSvg(cardQrPayload, 540, {
        frameStyle: 'cg-badge',
      }),
    [cardQrPayload]
  );

  const cardQrSvgUri = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cardQrSvg)}`,
    [cardQrSvg]
  );

  const handleOwnerLogin = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to complete Google sign-in.');
    }
  };

  const handlePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasscodeError(null);

    const trimmed = passcodeInput.trim();
    if (!trimmed) {
      setPasscodeError('Enter your studio passcode.');
      return;
    }

    if (passcodeMode === 'unclaimed') {
      if (trimmed.length < 6) {
        setPasscodeError('Passcode must be at least 6 characters.');
        return;
      }
      if (trimmed !== passcodeConfirm.trim()) {
        setPasscodeError('Passcodes do not match.');
        return;
      }
    }

    setPasscodeSubmitting(true);
    try {
      const fbToken = await getFreshToken();
      if (!fbToken) {
        setPasscodeError('Session expired. Please sign in with Google again.');
        return;
      }

      const endpoint =
        passcodeMode === 'unclaimed' ? '/api/studio-auth/setup' : '/api/studio-auth/verify';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fbToken}`,
        },
        body: JSON.stringify({ passcode: trimmed }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (payload?.code === 'STUDIO_UNCLAIMED') {
          setPasscodeMode('unclaimed');
        }
        setPasscodeError(payload.error || 'Unable to verify studio passcode.');
        return;
      }

      if (typeof payload.studioToken === 'string' && payload.studioToken) {
        setStudioToken(payload.studioToken);
        setPasscodeMode(payload.mode === 'env' ? 'env' : 'claimed');
        setPasscodeInput('');
        setPasscodeConfirm('');
      } else {
        setPasscodeError('Server did not return an unlock token. Please retry.');
      }
    } catch {
      setPasscodeError('Network error while verifying passcode. Please try again.');
    } finally {
      setPasscodeSubmitting(false);
    }
  };

  const fetchDriveFolders = async (tokenOverride?: string, queryText = driveQuery) => {
    setDriveError(null);
    setDriveLoading(true);
    try {
      let token = tokenOverride || driveAccessToken;
      if (!token) {
        token = await connectGoogleDrive();
      }
      if (!token) throw new Error('Google Drive authorization not granted.');
      const items = await listGoogleDriveFolders(token, queryText);
      setDriveFolders(items);
      setDriveOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to browse Google Drive folders.';
      if (msg === 'DRIVE_TOKEN_EXPIRED') {
        clearDriveAccessToken();
        setDriveError('Google Drive session expired. Click Browse Google Drive again to reconnect.');
      } else {
        setDriveError(msg);
      }
    } finally {
      setDriveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-6">
        <div className="border-[1.5px] border-black rounded-[9px] px-6 py-4 text-[0.76rem] tracking-cad uppercase">
          VERIFYING STUDIO OWNER ACCESS...
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border-[1.5px] border-black rounded-[9px] overflow-hidden">
          <div className="bg-black text-white px-5 py-3 flex items-center justify-between border-b border-black">
            <span className="text-[0.74rem] tracking-cad uppercase font-medium">
              PRIVATE STUDIO TOOL
            </span>
            <Lock className="w-4 h-4 text-[#FDCB33]" />
          </div>

          <div className="p-6 space-y-5 text-center">
            <img
              src={ASSETS.brand.logoFull}
              alt="casegoods"
              className="h-12 w-auto mx-auto select-none"
            />

            <div className="space-y-1.5">
              <h1 className="text-[1.05rem] font-medium tracking-cad uppercase">
                OWNER-ONLY INVOICE &amp; QR STUDIO
              </h1>
              <p className="text-[0.84rem] font-light text-black/80 leading-relaxed">
                This workspace is separated from the public website and restricted exclusively to{' '}
                <strong className="font-medium">{OWNER_EMAIL}</strong>.
              </p>
            </div>

            {user && user.email?.toLowerCase() !== OWNER_EMAIL && (
              <div className="bg-[#EF6922]/15 border border-[#EF6922] rounded-[9px] p-3 text-[0.78rem] text-black">
                Signed in as <strong>{user.email}</strong>. Access is restricted to {OWNER_EMAIL}.
              </div>
            )}

            {authError && (
              <div className="bg-[#EF6922]/15 border border-[#EF6922] rounded-[9px] p-3 text-[0.78rem] text-black">
                {authError}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-1">
              {!user ? (
                <button
                  type="button"
                  onClick={handleOwnerLogin}
                  className="w-full bg-white hover:bg-[#CBCBCB]/40 text-black border-[1.5px] border-black rounded-[9px] py-3 px-4 text-[0.76rem] tracking-cad uppercase font-medium transition-colors cursor-pointer inline-flex items-center justify-center gap-3"
                >
                  <svg viewBox="0 0 48 48" className="w-4 h-4 shrink-0" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="w-full bg-[#FDCB33] hover:bg-black text-black hover:text-white border border-black rounded-[9px] py-3 px-4 text-[0.74rem] tracking-cad uppercase font-medium transition-colors cursor-pointer"
                >
                  SIGN OUT &amp; SWITCH ACCOUNT
                </button>
              )}

              <a
                href="/"
                className="w-full bg-white hover:bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2.5 px-4 text-[0.70rem] tracking-cad uppercase font-medium transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>RETURN TO CASEGOODS</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isStudioUnlocked) {
    const isFirstRunSetup = passcodeMode === 'unclaimed';
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border-[1.5px] border-black rounded-[9px] overflow-hidden">
          <div className="bg-black text-white px-5 py-3 flex items-center justify-between border-b border-black">
            <span className="text-[0.72rem] tracking-cad uppercase font-medium">
              {isFirstRunSetup
                ? 'STEP 2 OF 2 · SET STUDIO PASSCODE'
                : 'STEP 2 OF 2 · STUDIO PASSCODE'}
            </span>
            <KeyRound className="w-4 h-4 text-[#FDCB33]" />
          </div>

          <div className="p-6 space-y-5">
            <img
              src={ASSETS.brand.logoFull}
              alt="casegoods"
              className="h-12 w-auto mx-auto select-none"
            />

            <div className="text-center space-y-1.5">
              <div className="inline-block bg-[#CBCBCB] text-black border border-black rounded-[9px] px-3 py-1 text-[0.62rem] tracking-cad uppercase font-medium">
                GOOGLE VERIFIED · {user?.email}
              </div>
              <h1 className="text-[0.98rem] font-medium tracking-cad uppercase pt-1">
                {isFirstRunSetup ? 'CREATE PRIVATE STUDIO PASSCODE' : 'UNLOCK PRIVATE STUDIO'}
              </h1>
              <p className="text-[0.80rem] font-light text-black/80 leading-relaxed">
                {isFirstRunSetup
                  ? 'Choose a passcode (minimum 6 characters) to protect your private tools on top of Google Sign-In. Setting STUDIO_PASSCODE in server secrets always overrides this.'
                  : 'Enter your server-verified Studio Passcode to unlock Invoice Generator, Projects Manager, and Card & QR tools.'}
              </p>
            </div>

            {passcodeMode === 'loading' ? (
              <div className="border border-black rounded-[9px] px-4 py-3 text-center text-[0.72rem] tracking-cad uppercase">
                CHECKING STUDIO SECURITY STATUS...
              </div>
            ) : (
              <form onSubmit={handlePasscodeSubmit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                    {isFirstRunSetup ? 'NEW STUDIO PASSCODE' : 'STUDIO PASSCODE'}
                  </label>
                  <input
                    type="password"
                    autoFocus
                    autoComplete={isFirstRunSetup ? 'new-password' : 'current-password'}
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder={isFirstRunSetup ? 'Minimum 6 characters' : 'Enter passcode'}
                    className="w-full px-3.5 py-2.5 border border-black rounded-[9px] text-[0.86rem] font-nexa"
                  />
                </div>

                {isFirstRunSetup && (
                  <div className="space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      CONFIRM STUDIO PASSCODE
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passcodeConfirm}
                      onChange={(e) => setPasscodeConfirm(e.target.value)}
                      placeholder="Re-enter passcode"
                      className="w-full px-3.5 py-2.5 border border-black rounded-[9px] text-[0.86rem] font-nexa"
                    />
                  </div>
                )}

                {passcodeError && (
                  <div className="bg-[#EF6922]/15 border border-[#EF6922] rounded-[9px] p-3 text-[0.76rem] text-black">
                    {passcodeError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passcodeSubmitting}
                  className="w-full bg-black hover:bg-[#EF6922] text-white hover:text-black border border-black rounded-[9px] py-3 px-4 text-[0.74rem] tracking-cad uppercase font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {passcodeSubmitting
                    ? 'VERIFYING...'
                    : isFirstRunSetup
                    ? 'SET PASSCODE & UNLOCK STUDIO'
                    : 'UNLOCK PRIVATE STUDIO'}
                </button>
              </form>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => signOutUser()}
                className="bg-white hover:bg-[#FDCB33] text-black border border-black rounded-[9px] py-2.5 px-3 text-[0.66rem] tracking-cad uppercase font-medium transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>SIGN OUT</span>
              </button>
              <a
                href="/"
                className="bg-white hover:bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2.5 px-3 text-[0.66rem] tracking-cad uppercase font-medium transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>PUBLIC SITE</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const updatePillar = (
    key: 'design' | 'resources' | 'fabrication' | 'flex',
    patch: { amount?: number; description?: string }
  ) => {
    setData((prev) => ({
      ...prev,
      pillars: {
        ...prev.pillars,
        [key]: {
          ...prev.pillars[key],
          ...patch,
        },
      },
    }));
  };

  const safeSlug = (data.invoiceNumber || 'template')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-');

  const handleDownloadSvg = () => {
    if (!assets) return;
    setDownloading('svg');
    try {
      const svg = generateInvoiceSvg(data, assets);
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casegoods-invoice-${safeSlug}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!assets) return;
    setDownloading('pdf');
    try {
      const pdfBytes = await generateInvoicePdf(data, assets);
      const blob = new Blob([pdfBytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casegoods-invoice-${safeSlug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadCardQrSvg = () => {
    setDownloading('qr-svg');
    try {
      const blob = new Blob([cardQrSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casegoods-cg-qr-${qrTarget}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadCardQrPng = async () => {
    setDownloading('qr-png');
    try {
      const blob = await renderSvgStringToPngBlob(cardQrSvg, 1200);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casegoods-cg-qr-${qrTarget}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadBusinessCardPdf = async () => {
    if (!assets) return;
    setDownloading('qr-pdf');
    try {
      // Standard US Business Card 3.5" x 2.0" (252pt x 144pt) with CG QR Back
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);
      const fontNexa = await pdfDoc.embedFont(assets.nexaLightTtf, { subset: false });
      const logoIcons = await pdfDoc.embedPng(assets.logoIconsPng);
      const logoMain = await pdfDoc.embedPng(assets.logoMainPng);

      // Page 1: QR Scan Side (252pt x 144pt)
      const W = 252;
      const H = 144;
      const page1 = pdfDoc.addPage([W, H]);
      page1.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
      drawCasegoodsQrPdf(page1, H, cardQrPayload, 16, 20, 104, { frameStyle: 'cg-badge' });

      const rightX = 132;
      page1.drawText(contactInfo.fullName, {
        x: rightX,
        y: H - 44,
        size: 13,
        font: fontNexa,
        color: rgb(0, 0, 0),
      });
      page1.drawText(contactInfo.title, {
        x: rightX,
        y: H - 60,
        size: 8.5,
        font: fontNexa,
        color: rgb(0, 0, 0),
      });
      page1.drawText(contactInfo.phoneDisplay, {
        x: rightX,
        y: H - 82,
        size: 8.2,
        font: fontNexa,
        color: rgb(0, 0, 0),
      });
      page1.drawText(contactInfo.email, {
        x: rightX,
        y: H - 96,
        size: 7.4,
        font: fontNexa,
        color: rgb(0, 0, 0),
      });
      page1.drawText(contactInfo.cityState, {
        x: rightX,
        y: H - 110,
        size: 7.2,
        font: fontNexa,
        color: rgb(0, 0, 0),
      });

      const iconsH = 14;
      const iconsW = iconsH * (logoIcons.width / logoIcons.height);
      page1.drawImage(logoIcons, {
        x: rightX,
        y: 12,
        width: iconsW,
        height: iconsH,
      });

      // Page 2: Front Brand Side
      const page2 = pdfDoc.addPage([W, H]);
      page2.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
      const mainH = 42;
      const mainW = mainH * (logoMain.width / logoMain.height);
      page2.drawImage(logoMain, {
        x: (W - mainW) / 2,
        y: (H - mainH) / 2,
        width: mainW,
        height: mainH,
      });

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes.slice()], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'casegoods-business-card-qr.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const pillarConfigs = [
    {
      key: 'design' as const,
      title: 'DESIGN / ENGINEERING',
      bgClass: 'bg-[#CBCBCB]',
    },
    {
      key: 'resources' as const,
      title: 'RESOURCES / MATERIALS',
      bgClass: 'bg-[#EF6922]',
    },
    {
      key: 'fabrication' as const,
      title: 'FABRICATION / DELIVERY',
      bgClass: 'bg-[#27AAE0]',
    },
    {
      key: 'flex' as const,
      title: 'FLEX',
      bgClass: 'bg-[#FDCB33]',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-black font-nexa antialiased flex flex-col">
      {/* 3-Zone Architectural Header — Exact Match to Studio Index Pages */}
      <header className="sticky top-0 z-40 bg-white border-b-[1.5px] border-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr_260px] lg:grid-cols-[280px_1fr_280px] items-center gap-4">
            {/* Zone 1: Left 3-Way Merged Bubble (Same Size as Studio Index Bubble) */}
            <div className="hidden md:flex items-center justify-start">
              <div className="w-full grid grid-cols-3 rounded-[9px] border-[1.5px] border-black overflow-hidden bg-white">
                <a
                  href="/card"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[42px] px-1.5 bg-white hover:bg-[#FDCB33] text-black text-[0.58rem] lg:text-[0.62rem] tracking-[0.07em] uppercase font-medium transition-colors flex items-center justify-center text-center whitespace-nowrap"
                >
                  MOBILE CARD
                </a>
                <button
                  type="button"
                  onClick={() => lockStudio()}
                  className="h-[42px] px-1.5 bg-white hover:bg-[#CBCBCB] text-black text-[0.58rem] lg:text-[0.62rem] tracking-[0.07em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap"
                >
                  LOCK STUDIO
                </button>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="h-[42px] px-1.5 bg-black hover:bg-[#EF6922] text-white hover:text-black text-[0.58rem] lg:text-[0.62rem] tracking-[0.07em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap"
                >
                  SIGN OUT
                </button>
              </div>
            </div>

            {/* Zone 2: Center Brand Lockup — Exact Same Size as Studio Index Pages */}
            <div className="flex items-center justify-center">
              <a
                href="/"
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

            {/* Zone 3: Right 3-Way Merged Bubble (Same Size as Left 3-Way Bubble) */}
            <div className="hidden md:flex items-center justify-end">
              <div className="w-full grid grid-cols-3 rounded-[9px] border-[1.5px] border-black overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setActiveTab('invoice')}
                  className={`h-[42px] px-1.5 text-[0.58rem] lg:text-[0.62rem] tracking-[0.07em] uppercase font-medium transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap ${
                    activeTab === 'invoice'
                      ? 'bg-[#27AAE0] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  INVOICES
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('projects')}
                  className={`h-[42px] px-1.5 text-[0.58rem] lg:text-[0.62rem] tracking-[0.07em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap ${
                    activeTab === 'projects'
                      ? 'bg-[#FDCB33] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  PROJECTS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('card-qr')}
                  className={`h-[42px] px-1.5 text-[0.58rem] lg:text-[0.62rem] tracking-[0.07em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap ${
                    activeTab === 'card-qr'
                      ? 'bg-[#EF6922] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  CARD &amp; QR
                </button>
              </div>
            </div>

            {/* Mobile Controls (3-Way Mode Bubble + 3-Way Nav Bubble) */}
            <div className="flex md:hidden flex-col gap-2 pt-1">
              <div className="w-full grid grid-cols-3 rounded-[9px] border-[1.5px] border-black overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setActiveTab('invoice')}
                  className={`h-[40px] px-1.5 text-[0.60rem] tracking-[0.08em] uppercase font-medium transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap ${
                    activeTab === 'invoice'
                      ? 'bg-[#27AAE0] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  INVOICES
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('projects')}
                  className={`h-[40px] px-1.5 text-[0.60rem] tracking-[0.08em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap ${
                    activeTab === 'projects'
                      ? 'bg-[#FDCB33] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  PROJECTS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('card-qr')}
                  className={`h-[40px] px-1.5 text-[0.60rem] tracking-[0.08em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap ${
                    activeTab === 'card-qr'
                      ? 'bg-[#EF6922] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  CARD &amp; QR
                </button>
              </div>

              <div className="w-full grid grid-cols-3 rounded-[9px] border-[1.5px] border-black overflow-hidden bg-white">
                <a
                  href="/card"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[38px] px-1.5 bg-white hover:bg-[#FDCB33] text-black text-[0.60rem] tracking-[0.08em] uppercase font-medium transition-colors flex items-center justify-center text-center whitespace-nowrap"
                >
                  MOBILE CARD
                </a>
                <button
                  type="button"
                  onClick={() => lockStudio()}
                  className="h-[38px] px-1.5 bg-white hover:bg-[#CBCBCB] text-black text-[0.60rem] tracking-[0.08em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap"
                >
                  LOCK STUDIO
                </button>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="h-[38px] px-1.5 bg-black hover:bg-[#EF6922] text-white hover:text-black text-[0.60rem] tracking-[0.08em] uppercase font-medium border-l-[1.5px] border-black transition-colors cursor-pointer flex items-center justify-center text-center whitespace-nowrap"
                >
                  SIGN OUT
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {activeTab === 'invoice' ? (
        /* TAB 1: PRIVATE INVOICE GENERATOR + GOOGLE DRIVE PROJECT FOLDER QR */
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-8 pb-16">
          {/* Unified Sheet Container with Incorporated Fabrication Blue Header (Matches Website Pages 01-06) */}
          <div className="w-full bg-white border-[1.5px] border-black rounded-[9px] overflow-hidden">
            {/* Incorporated Section Title Block Bar */}
            <div className="w-full bg-[#27AAE0] text-black border-b-[1.5px] border-black px-5 py-3 flex flex-wrap items-center justify-between gap-2 select-none">
              <span className="text-[0.80rem] sm:text-[0.86rem] tracking-cad uppercase font-medium">
                STUDIO TOOLS / INVOICE GENERATOR — US LETTER 8.5&quot; × 11&quot;
              </span>
              <span className="text-[0.72rem] tracking-cad uppercase font-medium">
                INVOICE {data.invoiceNumber} · NEXA LIGHT
              </span>
            </div>

            {/* Inner Sheet Body */}
            <div className="p-5 sm:p-7 space-y-6">
              {/* Top Export & Quick Reset Controls */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.72rem] tracking-cad uppercase font-medium">
                    EXPORT VECTOR INVOICE (.SVG FOR INKSCAPE · .PDF FOR PDFCRAFT)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setData(NEW_PROJECT_TEMPLATE)}
                      className="text-[0.66rem] tracking-cad uppercase font-medium px-3 py-1.5 rounded-[9px] border border-black bg-white hover:bg-[#FDCB33] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Eraser className="w-3 h-3" />
                      <span>NEW PROJECT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setData(DEFAULT_INVOICE_DATA)}
                      className="text-[0.66rem] tracking-cad uppercase font-medium px-3 py-1.5 rounded-[9px] border border-black bg-white hover:bg-[#CBCBCB] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>1070MCG(B) SAMPLE</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!assets || downloading === 'svg'}
                    onClick={handleDownloadSvg}
                    className="bg-[#EF6922] hover:bg-black text-black hover:text-white border border-black rounded-[9px] py-3 px-4 text-[0.72rem] tracking-cad uppercase font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <PenTool className="w-4 h-4 shrink-0" />
                    <span>{downloading === 'svg' ? 'EXPORTING...' : 'DOWNLOAD INKSCAPE (.SVG)'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!assets || downloading === 'pdf'}
                    onClick={handleDownloadPdf}
                    className="bg-[#27AAE0] hover:bg-black text-black hover:text-white border border-black rounded-[9px] py-3 px-4 text-[0.72rem] tracking-cad uppercase font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>{downloading === 'pdf' ? 'EXPORTING...' : 'DOWNLOAD PDFCRAFT (.PDF)'}</span>
                  </button>
                </div>
              </div>

              {/* 01 / Recipient, Invoice & Project Overview — Unified Framed Card */}
              <div className="border border-black rounded-[9px] overflow-hidden bg-white">
                <div className="bg-[#CBCBCB] text-black border-b border-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[0.70rem] tracking-cad uppercase font-medium select-none">
                  <span>01 / RECIPIENT, INVOICE &amp; PROJECT OVERVIEW</span>
                  <span>HEADER &amp; SCOPE</span>
                </div>

                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      RECIPIENT NAME
                    </label>
                    <input
                      type="text"
                      value={data.recipientName}
                      onChange={(e) => setData((p) => ({ ...p, recipientName: e.target.value }))}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      INVOICE / JOB #
                    </label>
                    <input
                      type="text"
                      value={data.invoiceNumber}
                      onChange={(e) => setData((p) => ({ ...p, invoiceNumber: e.target.value }))}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      PROJECT TITLE BAR
                    </label>
                    <input
                      type="text"
                      value={data.projectTitle}
                      onChange={(e) => setData((p) => ({ ...p, projectTitle: e.target.value }))}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa"
                    />
                  </div>
                  <div className="sm:col-span-12 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      PROJECT SCOPE PARAGRAPH
                    </label>
                    <textarea
                      rows={3}
                      value={data.projectSummary}
                      onChange={(e) => setData((p) => ({ ...p, projectSummary: e.target.value }))}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* 02 / Google Drive Project Folder QR — Unified Framed Card */}
              <div className="border border-black rounded-[9px] overflow-hidden bg-white">
                <div className="bg-[#CBCBCB] text-black border-b border-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[0.70rem] tracking-cad uppercase font-medium select-none">
                  <span className="inline-flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-black" />
                    <span>02 / GOOGLE DRIVE PROJECT FOLDER QR</span>
                  </span>
                  {data.driveFolderUrl?.trim() ? (
                    <button
                      type="button"
                      onClick={() =>
                        setData((p) => ({ ...p, driveFolderUrl: '', driveFolderName: '' }))
                      }
                      className="text-[0.62rem] tracking-cad uppercase px-2 py-0.5 rounded-[9px] border border-black bg-white hover:bg-[#EF6922] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>CLEAR QR</span>
                    </button>
                  ) : (
                    <span>OPTIONAL EMBED</span>
                  )}
                </div>

                <div className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="flex-1 w-full space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={driveLoading}
                          onClick={() => fetchDriveFolders()}
                          className="px-3.5 py-2 rounded-[9px] border border-black bg-[#FDCB33] hover:bg-black text-black hover:text-white text-[0.68rem] tracking-cad uppercase font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>
                            {driveLoading
                              ? 'LOADING FOLDERS...'
                              : driveAccessToken
                              ? 'BROWSE GOOGLE DRIVE FOLDERS'
                              : 'CONNECT & PICK DRIVE FOLDER'}
                          </span>
                        </button>

                        {data.driveFolderUrl?.trim() && (
                          <a
                            href={data.driveFolderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 rounded-[9px] border border-black bg-white hover:bg-[#27AAE0] text-black text-[0.68rem] tracking-cad uppercase inline-flex items-center gap-1 transition-colors"
                          >
                            <span>OPEN FOLDER</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-7 space-y-1">
                          <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                            GOOGLE DRIVE FOLDER URL
                          </label>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/drive/folders/..."
                            value={data.driveFolderUrl || ''}
                            onChange={(e) =>
                              setData((p) => ({ ...p, driveFolderUrl: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem] font-nexa"
                          />
                        </div>

                        <div className="sm:col-span-5 space-y-1">
                          <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                            FOLDER CAPTION (OPTIONAL)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 2026-1070MCG KIDS KITCHEN"
                            value={data.driveFolderName || ''}
                            onChange={(e) =>
                              setData((p) => ({ ...p, driveFolderName: e.target.value }))
                            }
                            className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem] font-nexa"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Live Mini Casegoods QR Preview */}
                    {invoiceQrPreviewUri && (
                      <div className="shrink-0 w-28 border border-black rounded-[9px] p-2 bg-white text-center space-y-1 self-center sm:self-start">
                        <img
                          src={invoiceQrPreviewUri}
                          alt="Project Drive Folder QR Preview"
                          className="w-24 h-24 mx-auto block"
                        />
                        <div className="text-[0.55rem] tracking-cad uppercase text-black/75 leading-tight">
                          EMBEDDED IN PDF &amp; SVG
                        </div>
                      </div>
                    )}
                  </div>

                  {driveError && (
                    <div className="bg-[#EF6922]/15 border border-[#EF6922] rounded-[9px] p-2.5 text-[0.74rem] text-black">
                      {driveError}
                    </div>
                  )}

                  {/* Interactive Drive Folder Search & Picker */}
                  {driveOpen && (
                    <div className="border border-black rounded-[9px] p-3 bg-white space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-black/60" />
                          <input
                            type="text"
                            placeholder="Search folder name (e.g. 1070MCG)..."
                            value={driveQuery}
                            onChange={(e) => setDriveQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') fetchDriveFolders(undefined, driveQuery);
                            }}
                            className="w-full pl-8 pr-3 py-1.5 border border-black rounded-[9px] text-[0.78rem] font-nexa"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchDriveFolders(undefined, driveQuery)}
                          className="px-3 py-1.5 rounded-[9px] border border-black bg-black text-white hover:bg-[#27AAE0] hover:text-black text-[0.64rem] tracking-cad uppercase cursor-pointer"
                        >
                          SEARCH
                        </button>
                        <button
                          type="button"
                          onClick={() => setDriveOpen(false)}
                          className="p-1.5 rounded-[9px] border border-black hover:bg-[#CBCBCB] cursor-pointer"
                          title="Close picker"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="max-h-48 overflow-y-auto divide-y divide-black/15 border border-black/30 rounded-[9px]">
                        {driveFolders.length === 0 ? (
                          <div className="p-3 text-center text-[0.74rem] text-black/65">
                            No matching Google Drive folders found.
                          </div>
                        ) : (
                          driveFolders.map((folder) => (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => {
                                setData((p) => ({
                                  ...p,
                                  driveFolderUrl: folder.webViewLink,
                                  driveFolderName: folder.name,
                                }));
                                setDriveOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#FDCB33]/40 flex items-center justify-between gap-2 text-[0.76rem] transition-colors cursor-pointer"
                            >
                              <span className="inline-flex items-center gap-2 font-medium truncate">
                                <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#EF6922]" />
                                <span className="truncate">{folder.name}</span>
                              </span>
                              <span className="text-[0.62rem] tracking-cad uppercase text-black/60 shrink-0">
                                SELECT →
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 03 / 4-Pillar Budget Distribution Inputs — Unified Framed Card */}
              <div className="border border-black rounded-[9px] overflow-hidden bg-white">
                <div className="bg-[#CBCBCB] text-black border-b border-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[0.70rem] tracking-cad uppercase font-medium select-none">
                  <span>03 / BUDGET DISTRIBUTION (AUTO-CALCULATES PIE CHART)</span>
                  <span className="tabular-nums">TOTAL: {formatCurrency(summary.totalAmount)}</span>
                </div>

                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {pillarConfigs.map((cfg) => {
                    const slice = summary.slices.find((s) => s.key === cfg.key);
                    const pillar = data.pillars[cfg.key];
                    return (
                      <div
                        key={cfg.key}
                        className="border border-black rounded-[9px] overflow-hidden flex flex-col"
                      >
                        <div
                          className={`${cfg.bgClass} px-3.5 py-2 border-b border-black flex items-center justify-between gap-2`}
                        >
                          <span className="text-[0.68rem] tracking-cad uppercase font-medium">
                            {cfg.title} ({slice?.percent ?? 0}%)
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[0.74rem] font-medium">$</span>
                            <input
                              type="number"
                              min="0"
                              step="25"
                              value={pillar.amount}
                              onChange={(e) =>
                                updatePillar(cfg.key, { amount: parseFloat(e.target.value) || 0 })
                              }
                              className="w-24 px-2 py-1 bg-white border-[0.75px] border-black rounded-[9px] text-[0.82rem] font-nexa text-right font-medium tabular-nums"
                            />
                          </div>
                        </div>
                        <div className="p-2.5 bg-white flex-1">
                          <textarea
                            rows={3}
                            value={pillar.description}
                            onChange={(e) => updatePillar(cfg.key, { description: e.target.value })}
                            className="w-full h-full px-2.5 py-1.5 border-[0.75px] border-black/40 rounded-[9px] text-[0.78rem] font-nexa leading-relaxed"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 04 / Deposit & Final Payment — Unified Framed Card */}
              <div className="border border-black rounded-[9px] overflow-hidden bg-white">
                <div className="bg-[#CBCBCB] text-black border-b border-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[0.70rem] tracking-cad uppercase font-medium select-none">
                  <span>04 / DEPOSIT &amp; FINAL PAYMENT</span>
                  <span className="tabular-nums">
                    FINAL PAYMENT: {formatCurrency(summary.finalPayment)}
                  </span>
                </div>

                <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-12 gap-3.5">
                  <div className="col-span-1 sm:col-span-3 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      DEPOSIT ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="25"
                      value={data.depositAmount}
                      onChange={(e) =>
                        setData((p) => ({ ...p, depositAmount: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa tabular-nums"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-3 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      METHOD TAG
                    </label>
                    <input
                      type="text"
                      placeholder="CHECK"
                      value={data.depositMethodNote}
                      onChange={(e) =>
                        setData((p) => ({ ...p, depositMethodNote: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-4 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      DEPOSIT STATUS
                    </label>
                    <input
                      type="text"
                      placeholder="PAID"
                      value={data.depositStatus}
                      onChange={(e) => setData((p) => ({ ...p, depositStatus: e.target.value }))}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <label className="block text-[0.64rem] tracking-cad uppercase font-medium">
                      PAGE #
                    </label>
                    <input
                      type="text"
                      value={data.pageLabel}
                      onChange={(e) => setData((p) => ({ ...p, pageLabel: e.target.value }))}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] font-nexa text-center tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Live US Letter Invoice Preview — Unified Framed Sheet Card */}
              <section className="pt-1">
                <div className="max-w-[760px] mx-auto bg-white border border-black rounded-[9px] overflow-hidden">
                  <div className="bg-[#CBCBCB] text-black border-b border-black px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[0.70rem] tracking-cad uppercase font-medium select-none">
                    <span>LIVE US LETTER INVOICE PREVIEW · 8.5&quot; × 11&quot;</span>
                    <span>{data.invoiceNumber}</span>
                  </div>
                  <div className="bg-white">
                    <InvoiceSvgPreview data={data} />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      ) : (
        /* TAB 2: MOBILE BUSINESS CARD & CASEGOODS CG-STYLED QR STUDIO */
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
          <div className="border border-black rounded-[9px] p-4 sm:p-5 space-y-3.5 bg-white">
            <span className="block text-[0.72rem] tracking-cad uppercase font-medium">
              01 / CASEGOODS CG QR DESTINATION MODE
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'card-url', label: 'MOBILE CARD + SITE', bg: 'bg-[#27AAE0]' },
                  { id: 'vcard', label: 'DIRECT CONTACT', bg: 'bg-[#FDCB33]' },
                  { id: 'website', label: 'WEBSITE ONLY', bg: 'bg-[#EF6922]' },
                  { id: 'custom', label: 'CUSTOM LINK', bg: 'bg-[#CBCBCB]' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setQrTarget(item.id)}
                  className={`py-2.5 px-2.5 rounded-[9px] border border-black text-[0.62rem] tracking-cad uppercase transition-colors cursor-pointer ${
                    qrTarget === item.id
                      ? `${item.bg} text-black font-medium`
                      : 'bg-white text-black hover:bg-[#CBCBCB]/40'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {qrTarget === 'custom' && (
              <div className="space-y-1">
                <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                  CUSTOM URL / FOLDER LINK
                </label>
                <input
                  type="url"
                  value={customQrUrl}
                  onChange={(e) => setCustomQrUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem]"
                />
              </div>
            )}

            <div className="bg-black/5 border border-black/30 rounded-[9px] p-3 text-[0.74rem] leading-relaxed">
              {qrTarget === 'card-url' && (
                <span>
                  <strong>Recommended for Mobile Card:</strong> Scanning opens your live mobile Casegoods card (
                  <code>/card</code>) with one-tap Save Contact (.vcf), Call, Text, Email, and direct link to your portfolio.
                </span>
              )}
              {qrTarget === 'vcard' && (
                <span>
                  <strong>Instant Phonebook Add:</strong> Embeds a vCard directly inside the QR matrix so iPhone &amp; Android cameras prompt &ldquo;Add Josh Heinke to Contacts&rdquo; offline with zero webpage load.
                </span>
              )}
              {qrTarget === 'website' && (
                <span>
                  <strong>Direct Website:</strong> Sends scanners straight to your Casegoods studio landing page.
                </span>
              )}
              {qrTarget === 'custom' && (
                <span>
                  <strong>Custom Link:</strong> Point this Casegoods-styled QR to any Google Drive folder, submittal PDF, or page.
                </span>
              )}
            </div>
          </div>

          <div className="border border-black rounded-[9px] p-4 sm:p-5 space-y-3.5 bg-white">
            <span className="block text-[0.72rem] tracking-cad uppercase font-medium">
              02 / CONTACT &amp; DOMAIN DETAILS
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-4 space-y-1">
                <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                  NAME
                </label>
                <input
                  type="text"
                  value={contactInfo.fullName}
                  onChange={(e) =>
                    setContactInfo((c) => ({ ...c, fullName: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem]"
                />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                  TITLE / TAGLINE
                </label>
                <input
                  type="text"
                  value={contactInfo.title}
                  onChange={(e) =>
                    setContactInfo((c) => ({ ...c, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem]"
                />
              </div>
              <div className="sm:col-span-4 space-y-1">
                <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                  PHONE
                </label>
                <input
                  type="text"
                  value={contactInfo.phoneDisplay}
                  onChange={(e) =>
                    setContactInfo((c) => ({
                      ...c,
                      phoneDisplay: e.target.value,
                      phoneE164: e.target.value.replace(/[^+\d]/g, ''),
                    }))
                  }
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem] tabular-nums"
                />
              </div>
              <div className="sm:col-span-5 space-y-1">
                <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                  EMAIL
                </label>
                <input
                  type="email"
                  value={contactInfo.email}
                  onChange={(e) =>
                    setContactInfo((c) => ({ ...c, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem]"
                />
              </div>
              <div className="sm:col-span-7 space-y-1">
                <label className="block text-[0.62rem] tracking-cad uppercase font-medium">
                  STUDIO WEBSITE URL
                </label>
                <input
                  type="url"
                  value={contactInfo.websiteUrl}
                  onChange={(e) =>
                    setContactInfo((c) => ({ ...c, websiteUrl: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem]"
                />
              </div>
            </div>
          </div>

          <div className="border border-black rounded-[9px] p-4 sm:p-5 space-y-3 bg-white">
            <span className="block text-[0.72rem] tracking-cad uppercase font-medium">
              03 / EXPORT CG QR MARK &amp; PRINTABLE BUSINESS CARD
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                disabled={downloading === 'qr-svg'}
                onClick={handleDownloadCardQrSvg}
                className="bg-[#EF6922] hover:bg-black text-black hover:text-white border border-black rounded-[9px] py-2.5 px-3 text-[0.68rem] tracking-cad uppercase font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>QR (.SVG)</span>
              </button>
              <button
                type="button"
                disabled={downloading === 'qr-png'}
                onClick={handleDownloadCardQrPng}
                className="bg-[#27AAE0] hover:bg-black text-black hover:text-white border border-black rounded-[9px] py-2.5 px-3 text-[0.68rem] tracking-cad uppercase font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>QR (.PNG)</span>
              </button>
              <button
                type="button"
                disabled={!assets || downloading === 'qr-pdf'}
                onClick={handleDownloadBusinessCardPdf}
                className="bg-[#FDCB33] hover:bg-black text-black hover:text-white border border-black rounded-[9px] py-2.5 px-3 text-[0.68rem] tracking-cad uppercase font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>CARD 3.5×2&quot; (.PDF)</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="/card"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-[9px] border border-black bg-black text-white hover:bg-[#EF6922] hover:text-black text-[0.68rem] tracking-cad uppercase inline-flex items-center gap-1.5 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>OPEN MOBILE CARD VIEW</span>
              </a>
              <a
                href="/card?view=qr"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-[9px] border border-black bg-white hover:bg-[#CBCBCB] text-black text-[0.68rem] tracking-cad uppercase inline-flex items-center gap-1.5 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>BOOKMARKABLE QR SCREEN (/card?view=qr)</span>
              </a>
            </div>
          </div>

          {/* Live Casegoods CG QR Preview — Cleanly Below Export Controls */}
          <div className="border border-black rounded-[9px] bg-white p-6 flex flex-col items-center justify-center gap-4">
            <img
              src={cardQrSvgUri}
              alt="Casegoods CG Monogram QR Preview"
              className="w-64 sm:w-72 h-auto block select-none"
            />
            <div className="text-[0.68rem] tracking-cad uppercase text-black/75 text-center">
              CONCENTRIC ROUNDED-SQUARE CASEGOODS QR · ECC-H (30% RECOVERY)
            </div>
          </div>
        </main>
      )}

      {activeTab === 'projects' && <ProjectsManagerPanel />}
    </div>
  );
};
