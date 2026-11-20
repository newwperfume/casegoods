import React, { useMemo, useState } from 'react';
import {
  Phone,
  MessageSquare,
  Mail,
  Globe,
  UserPlus,
  QrCode,
  CreditCard,
  Download,
  ArrowUpRight,
  Check,
  Copy,
} from 'lucide-react';
import { ASSETS } from '../assets/index.ts';
import {
  CASEGOODS_PUBLIC_URL,
  DEFAULT_CASEGOODS_CONTACT,
  buildCasegoodsVCard,
  generateCasegoodsQrStandaloneSvg,
  renderSvgStringToPngBlob,
} from '../utils/casegoodsQr.ts';
import {
  MortiseWallCanvas,
  PillarColorKey,
  useMortiseWallController,
} from './MortiseWallSystem.tsx';

type CardTabMode = 'card' | 'qr';
type QrTargetMode = 'card-url' | 'vcard' | 'website';

export const MobileBusinessCard: React.FC = () => {
  const initialTab: CardTabMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('view') === 'qr'
      ? 'qr'
      : 'card';

  const [tab, setTab] = useState<CardTabMode>(initialTab);
  const [qrMode, setQrMode] = useState<QrTargetMode>('card-url');
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [downloading, setDownloading] = useState<'svg' | 'png' | null>(null);

  const wall = useMortiseWallController('01');

  const triggerWallAccent = (pillar: PillarColorKey, el: HTMLElement | null) => {
    if (el && typeof window !== 'undefined') {
      const rect = el.getBoundingClientRect();
      wall.setActivePillar(pillar, {
        x: (rect.left + rect.width * 0.5) / Math.max(1, window.innerWidth),
        y: (rect.top + rect.height * 0.5) / Math.max(1, window.innerHeight),
      });
    } else {
      wall.setActivePillar(pillar, { x: 0.5, y: 0.5 });
    }
  };

  const publicOrigin = CASEGOODS_PUBLIC_URL;

  const contact = useMemo(
    () => ({
      ...DEFAULT_CASEGOODS_CONTACT,
      websiteUrl: publicOrigin,
    }),
    [publicOrigin]
  );

  const qrPayload = useMemo(() => {
    if (qrMode === 'vcard') {
      return buildCasegoodsVCard(contact, true);
    }
    if (qrMode === 'website') {
      return publicOrigin;
    }
    return `${publicOrigin}/card`;
  }, [qrMode, contact, publicOrigin]);

  const qrSvg = useMemo(
    () =>
      generateCasegoodsQrStandaloneSvg(qrPayload, 520, {
        frameStyle: 'cg-badge',
      }),
    [qrPayload]
  );

  const qrSvgUri = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`,
    [qrSvg]
  );

  const handleSaveVCard = () => {
    const vcf = buildCasegoodsVCard(contact, false);
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'josh-heinke-casegoods.vcf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(contact.phoneDisplay);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1800);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const handleDownloadQrSvg = () => {
    setDownloading('svg');
    try {
      const blob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casegoods-qr-${qrMode}.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadQrPng = async () => {
    setDownloading('png');
    try {
      const blob = await renderSvgStringToPngBlob(qrSvg, 1200);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casegoods-qr-${qrMode}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <MortiseWallCanvas
        controller={wall}
        heroSelector="#card-main-stack"
        headerSelector=""
        footerSelector="#card-footer"
      />
      <div className="mortise-page-shell min-h-screen text-black font-nexa antialiased flex flex-col p-4 sm:p-6">
        <div className="flex-1 flex flex-col justify-center py-6">
          <div id="card-main-stack" className="w-full max-w-[430px] mx-auto space-y-3.5">
            {/* Compact CARD / MY QR Switcher (No Top Logo or Outer Bar) */}
            <div className="flex justify-center">
              <div className="ui-surface inline-flex border border-black rounded-[9px] overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => setTab('card')}
                  className={`px-3.5 py-1.5 text-[0.64rem] tracking-cad uppercase inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    tab === 'card'
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  <CreditCard className="w-3 h-3" />
                  <span>CARD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('qr')}
                  className={`px-3.5 py-1.5 text-[0.64rem] tracking-cad uppercase inline-flex items-center gap-1.5 border-l border-black transition-colors cursor-pointer ${
                    tab === 'qr'
                      ? 'bg-[#EF6922] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  <QrCode className="w-3 h-3" />
                  <span>MY QR</span>
                </button>
              </div>
            </div>

            {tab === 'card' ? (
              <>
                {/* Exact Visual Replica of Buss_Card_Final_Josh.pdf (3.5 x 2 Ratio) */}
                <div className="ui-surface bg-white border border-black rounded-[22px] sm:rounded-[26px] aspect-[3.5/2] px-6 sm:px-8 py-5 sm:py-6 flex flex-col justify-between">
                  {/* Top Row: 4 Signature Studio Icons */}
                  <div className="w-full pt-0.5">
                    <img
                      src="/assets/brand_icons_bc.png"
                      alt="casegoods studio icons — furniture, cabinetry, solid timber, and studio craft"
                      className="w-[84%] mx-auto h-auto block select-none"
                    />
                  </div>

                  {/* Bottom Row: CG Monogram (Left) + Contact Details (Right) */}
                  <div className="flex items-end justify-between gap-4 pb-0.5">
                    <img
                      src={ASSETS.brand.logoMark}
                      alt="casegoods CG monogram"
                      className="w-[25%] min-w-[66px] max-w-[94px] aspect-square shrink-0 object-contain select-none"
                    />
                    <div className="text-right min-w-0 leading-tight">
                      <h1 className="text-[1.45rem] sm:text-[1.72rem] leading-none font-light tracking-[0.02em] text-black">
                        {contact.fullName}
                      </h1>
                      <div className="mt-2.5 sm:mt-3 space-y-1">
                        <p className="text-[0.74rem] sm:text-[0.82rem] font-light tracking-[0.015em] text-black/90">
                          {contact.title}
                        </p>
                        <p className="text-[0.74rem] sm:text-[0.82rem] font-light tracking-[0.015em] text-black/90 truncate">
                          {contact.email}
                        </p>
                        <button
                          type="button"
                          onClick={handleCopyPhone}
                          className="inline-flex items-center justify-end gap-1 text-[0.74rem] sm:text-[0.82rem] font-light tracking-[0.015em] text-black/90 hover:text-[#EF6922] transition-colors cursor-pointer"
                          title="Tap to copy phone number"
                        >
                          <span>{contact.phoneDisplay}</span>
                          {copiedPhone ? (
                            <Check className="w-3 h-3 text-[#27AAE0]" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-black/35 opacity-70" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Save Contact Action — Casegoods Orange */}
                <button
                  type="button"
                  onClick={handleSaveVCard}
                  onMouseEnter={(e) => triggerWallAccent('01', e.currentTarget)}
                  onFocus={(e) => triggerWallAccent('01', e.currentTarget)}
                  className="ui-surface w-full bg-[#EF6922] hover:bg-black text-black hover:text-white border-[1.5px] border-black rounded-[9px] py-3.5 px-4 text-[0.76rem] tracking-cad uppercase inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>SAVE TO CONTACTS (.VCF)</span>
                </button>

                {/* Quick 2x2 Action Grid */}
                <div className="ui-surface grid grid-cols-2 gap-2.5">
                  <a
                    href={`tel:${contact.phoneE164}`}
                    onMouseEnter={(e) => triggerWallAccent('02', e.currentTarget)}
                    onFocus={(e) => triggerWallAccent('02', e.currentTarget)}
                    className="bg-[#27AAE0] hover:bg-black text-black hover:text-white border-[1.5px] border-black rounded-[9px] py-3 px-3 text-[0.72rem] tracking-cad uppercase inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>CALL</span>
                  </a>

                  <a
                    href={`sms:${contact.phoneE164}`}
                    onMouseEnter={(e) => triggerWallAccent('06', e.currentTarget)}
                    onFocus={(e) => triggerWallAccent('06', e.currentTarget)}
                    className="bg-[#FDCB33] hover:bg-black text-black hover:text-white border-[1.5px] border-black rounded-[9px] py-3 px-3 text-[0.72rem] tracking-cad uppercase inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>TEXT</span>
                  </a>

                  <a
                    href={`mailto:${contact.email}`}
                    className="bg-[#CBCBCB] hover:bg-black text-black hover:text-white border-[1.5px] border-black rounded-[9px] py-3 px-3 text-[0.72rem] tracking-cad uppercase inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>EMAIL</span>
                  </a>

                  <a
                    href="/"
                    className="bg-white hover:bg-[#EF6922] text-black border-[1.5px] border-black rounded-[9px] py-3 px-3 text-[0.72rem] tracking-cad uppercase inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>WEBSITE</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </>
            ) : (
            /* SCAN QR VIEW — Full-Contrast Casegoods CG Rounded-Square QR */
            <div className="ui-surface bg-white border-[1.5px] border-black rounded-[9px] p-5 space-y-4">
              <div className="bg-black text-white rounded-[9px] px-3 py-2 text-center text-[0.68rem] tracking-cad uppercase">
                SCAN WITH PHONE CAMERA · CASEGOODS OMAHA
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setQrMode('card-url')}
                  className={`py-2 px-2 rounded-[9px] border border-black text-[0.60rem] tracking-cad uppercase transition-colors cursor-pointer ${
                    qrMode === 'card-url'
                      ? 'bg-[#27AAE0] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  CARD + SITE
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('vcard')}
                  className={`py-2 px-2 rounded-[9px] border border-black text-[0.60rem] tracking-cad uppercase transition-colors cursor-pointer ${
                    qrMode === 'vcard'
                      ? 'bg-[#FDCB33] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  CONTACT ONLY
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode('website')}
                  className={`py-2 px-2 rounded-[9px] border border-black text-[0.60rem] tracking-cad uppercase transition-colors cursor-pointer ${
                    qrMode === 'website'
                      ? 'bg-[#EF6922] text-black'
                      : 'bg-white text-black hover:bg-[#CBCBCB]'
                  }`}
                >
                  WEBSITE
                </button>
              </div>

              {/* Oversized Casegoods CG-Styled QR Mark */}
              <div className="p-3 bg-white flex flex-col items-center justify-center">
                <img
                  src={qrSvgUri}
                  alt="Casegoods CG QR Code"
                  className="w-full max-w-[270px] h-auto block select-none"
                />
              </div>

              <div className="border-t border-black pt-3 text-center space-y-1">
                <div className="text-[0.72rem] tracking-cad uppercase">
                  {qrMode === 'vcard'
                    ? 'INSTANT ADD-TO-CONTACTS (NO BROWSER NEEDED)'
                    : qrMode === 'website'
                    ? 'OPENS CASEGOODS STUDIO PORTFOLIO'
                    : 'OPENS MOBILE CARD + SAVE CONTACT + WEBSITE'}
                </div>
                <div className="text-[0.64rem] text-black/70 truncate px-2">
                  {qrMode === 'vcard'
                    ? `${contact.fullName} · ${contact.phoneDisplay} · ${contact.email}`
                    : qrPayload}
                </div>
              </div>

              {/* Quick Save SVG / PNG */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={downloading === 'svg'}
                  onClick={handleDownloadQrSvg}
                  className="bg-white hover:bg-[#CBCBCB] text-black border border-black rounded-[9px] py-2.5 px-3 text-[0.66rem] tracking-cad uppercase inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>SAVE .SVG</span>
                </button>
                <button
                  type="button"
                  disabled={downloading === 'png'}
                  onClick={handleDownloadQrPng}
                  className="bg-black hover:bg-[#EF6922] text-white hover:text-black border border-black rounded-[9px] py-2.5 px-3 text-[0.66rem] tracking-cad uppercase inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>SAVE .PNG</span>
                </button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Minimal Footer Note */}
        <footer
          id="card-footer"
          className="ui-surface w-full max-w-md mx-auto pt-3 text-center text-[0.62rem] tracking-cad uppercase text-black/65"
        >
          casegoods — handcrafted in omaha · architectural built-ins &amp; furniture
        </footer>
      </div>
    </>
  );
};
