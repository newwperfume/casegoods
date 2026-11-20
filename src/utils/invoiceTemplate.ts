import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';

export interface InvoiceLineItem {
  id: string;
  title: string;
  spec: string;
  qty: string;
  rate: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  jobCode: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  projectName: string;
  clientName: string;
  clientSubtitle: string;
  clientAddress1: string;
  clientAddress2: string;
  clientContact: string;
  statusNote: string;
  items: InvoiceLineItem[];
  taxOrFreightLabel: string;
  taxOrFreightAmount: number;
  depositPaid: number;
  notesLine1: string;
  notesLine2: string;
  notesLine3: string;
  notesLine4: string;
}

export interface InvoiceAssetPayloads {
  logoMainBytes: Uint8Array;
  logoIconsBytes: Uint8Array;
}

export const SAMPLE_INVOICE_DATA: InvoiceData = {
  invoiceNumber: 'INV-CG-2026-001',
  jobCode: '1074OMA',
  issueDate: '11/18/2026',
  dueDate: '12/02/2026',
  paymentTerms: '50% DEPOSIT / NET 14',
  projectName: 'Custom Architectural Millwork',
  clientName: 'Client Name / Studio',
  clientSubtitle: 'Attn: Homeowner or Architect',
  clientAddress1: '1234 Farnam Street',
  clientAddress2: 'Omaha, NE 68102',
  clientContact: 'client@email.com · 402-555-0199',
  statusNote: '50% DEPOSIT DUE TO SCHEDULE SHOP BUILD',
  items: [
    {
      id: '1',
      title: 'Design Engineering & 2D/3D Rhino CAD Submittal',
      spec: 'Site laser measure, dimensioned elevation/section drawings, material & reveal specs',
      qty: '1',
      rate: 650,
    },
    {
      id: '2',
      title: 'Custom Casework & Hardwood Fabrication',
      spec: 'Select domestic hardwood, exposed finger-joint / mortised joinery, satin finish',
      qty: '1',
      rate: 4800,
    },
    {
      id: '3',
      title: 'Hardware, CNC Machining & Delivery / Install',
      spec: 'Concealed soft-close hardware, studio finishing, Omaha local delivery & install',
      qty: '1',
      rate: 750,
    },
  ],
  taxOrFreightLabel: 'NE Sales Tax / Freight',
  taxOrFreightAmount: 0,
  depositPaid: 0,
  notesLine1: 'Please make checks payable to: Casegoods (Josh Heinke)',
  notesLine2: 'ACH / Venmo / Card arrangements available upon request.',
  notesLine3: '50% deposit secures hardwood procurement & Rhino CAD shop slot.',
  notesLine4: 'Remaining balance due upon completion and final installation.',
};

export const BLANK_TEMPLATE_INVOICE_DATA: InvoiceData = {
  invoiceNumber: 'INV-CG-2026-___',
  jobCode: '____OMA',
  issueDate: 'MM/DD/YYYY',
  dueDate: 'MM/DD/YYYY',
  paymentTerms: '50% DEPOSIT / NET 14',
  projectName: 'Project Title',
  clientName: 'Client Name',
  clientSubtitle: 'Company / Attention',
  clientAddress1: 'Street Address',
  clientAddress2: 'City, State ZIP',
  clientContact: 'Email · Phone',
  statusNote: 'PAYMENT DUE UPON RECEIPT',
  items: [
    {
      id: '1',
      title: 'Line Item 01 — Design / Engineering',
      spec: 'Dimensions, wood species, joinery details',
      qty: '1',
      rate: 0,
    },
    {
      id: '2',
      title: 'Line Item 02 — Fabrication / Millwork',
      spec: 'Materials, finish schedule, hardware',
      qty: '1',
      rate: 0,
    },
    {
      id: '3',
      title: 'Line Item 03 — Delivery & Installation',
      spec: 'Site installation & final fit',
      qty: '1',
      rate: 0,
    },
  ],
  taxOrFreightLabel: 'Tax / Shipping',
  taxOrFreightAmount: 0,
  depositPaid: 0,
  notesLine1: 'Please make checks payable to: Casegoods (Josh Heinke)',
  notesLine2: 'ACH / Venmo / Card arrangements available upon request.',
  notesLine3: '50% deposit secures hardwood procurement & CAD shop schedule.',
  notesLine4: 'Remaining balance due upon completion and final installation.',
};

export function parseQty(qtyStr: string): number {
  const n = parseFloat(qtyStr.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function calculateInvoiceTotals(data: InvoiceData) {
  const subtotal = data.items.reduce((sum, item) => {
    return sum + parseQty(item.qty) * (Number.isFinite(item.rate) ? item.rate : 0);
  }, 0);
  const tax = Number.isFinite(data.taxOrFreightAmount) ? data.taxOrFreightAmount : 0;
  const total = subtotal + tax;
  const deposit = Number.isFinite(data.depositPaid) ? data.depositPaid : 0;
  const balanceDue = Math.max(0, total - deposit);
  return { subtotal, tax, total, deposit, balanceDue };
}

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function fetchBrowserInvoiceAssets(): Promise<InvoiceAssetPayloads> {
  const [mainRes, iconsRes] = await Promise.all([
    fetch('/assets/aistudio/CASEGOODS_LOGO_FINAL6.png'),
    fetch('/assets/aistudio/LOGO_4_IMAGES.png'),
  ]);
  if (!mainRes.ok || !iconsRes.ok) {
    throw new Error('Could not load Casegoods logo assets for invoice export.');
  }
  const [mainBuf, iconsBuf] = await Promise.all([
    mainRes.arrayBuffer(),
    iconsRes.arrayBuffer(),
  ]);
  return {
    logoMainBytes: new Uint8Array(mainBuf),
    logoIconsBytes: new Uint8Array(iconsBuf),
  };
}

/**
 * Generates an Inkscape-native, multi-layer US Letter SVG (8.5in x 11in @ 96 DPI -> 816 x 1056)
 * matching the remixed Casegoods Bauhaus / Architectural CAD design system.
 * Every text field is a standalone, ungrouped <text> element so it can be clicked & edited directly in Inkscape.
 */
export async function generateInkscapeInvoiceSvg(
  data: InvoiceData,
  providedAssets?: InvoiceAssetPayloads
): Promise<string> {
  const assets = providedAssets || (await fetchBrowserInvoiceAssets());
  const logoMainB64 = uint8ToBase64(assets.logoMainBytes);
  const logoIconsB64 = uint8ToBase64(assets.logoIconsBytes);
  const { subtotal, tax, total, deposit, balanceDue } = calculateInvoiceTotals(data);

  const fontStack = "'Nexa Light', 'Montserrat', 'Helvetica Neue', Arial, sans-serif";
  const maxRows = 8;
  const rowsToRender = data.items.slice(0, maxRows);

  // Path helper for rounded top corners only (for colored card headers without needing <clipPath>)
  const topRoundedPath = (x: number, y: number, w: number, h: number, r: number) =>
    `M ${x},${y + r} Q ${x},${y} ${x + r},${y} L ${x + w - r},${y} Q ${x + w},${y} ${x + w},${y + r} L ${x + w},${y + h} L ${x},${y + h} Z`;

  const rowDividersSvg: string[] = [];
  const rowTextSvg: string[] = [];

  for (let idx = 0; idx < maxRows; idx++) {
    const rowY = 388 + idx * 40;
    if (idx < maxRows - 1) {
      rowDividersSvg.push(
        `<line x1="48" y1="${rowY + 40}" x2="768" y2="${rowY + 40}" stroke="#CBCBCB" stroke-width="0.75" />`
      );
    }

    const item = rowsToRender[idx];
    if (item) {
      const itemNum = String(idx + 1).padStart(2, '0');
      const lineTotal = parseQty(item.qty) * (Number.isFinite(item.rate) ? item.rate : 0);

      rowTextSvg.push(`
        <text x="64" y="${rowY + 18}" font-family="${fontStack}" font-size="10" font-weight="600" fill="#000000" letter-spacing="0.08em">${itemNum}</text>
        <text x="108" y="${rowY + 17}" font-family="${fontStack}" font-size="10.5" font-weight="600" fill="#000000">${escapeXml(item.title)}</text>
        <text x="108" y="${rowY + 31}" font-family="${fontStack}" font-size="8.5" font-weight="300" fill="#333333">${escapeXml(item.spec)}</text>
        <text x="530" y="${rowY + 23}" text-anchor="end" font-family="${fontStack}" font-size="10" font-weight="400" fill="#000000">${escapeXml(item.qty)}</text>
        <text x="640" y="${rowY + 23}" text-anchor="end" font-family="${fontStack}" font-size="10" font-weight="400" fill="#000000">${escapeXml(formatCurrency(item.rate))}</text>
        <text x="754" y="${rowY + 23}" text-anchor="end" font-family="${fontStack}" font-size="10.5" font-weight="600" fill="#000000">${escapeXml(formatCurrency(lineTotal))}</text>
      `);
    } else {
      const itemNum = String(idx + 1).padStart(2, '0');
      rowTextSvg.push(`
        <text x="64" y="${rowY + 23}" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#CBCBCB" letter-spacing="0.08em">${itemNum}</text>
      `);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
  width="8.5in"
  height="11in"
  viewBox="0 0 816 1056"
  version="1.1"
  id="casegoods-invoice-template">
  <title>casegoods — Custom Project Invoice Template (${escapeXml(data.invoiceNumber)})</title>
  <sodipodi:namedview
    id="namedview1"
    pagecolor="#ffffff"
    bordercolor="#000000"
    borderopacity="0.25"
    inkscape:document-units="in"
    showgrid="false" />

  <!-- LAYER 01: Sheet Background & CAD Framing -->
  <g inkscape:groupmode="layer" inkscape:label="01 - Sheet Frame &amp; CAD Borders" id="layer-frame">
    <rect x="0" y="0" width="816" height="1056" fill="#FFFFFF" />
    <!-- Outer Architectural Sheet Border (1.5px, 9px Radius) -->
    <rect x="28" y="28" width="760" height="1000" rx="9" ry="9" fill="#FFFFFF" stroke="#000000" stroke-width="1.5" />
    <!-- Thin Black Divider Rule Under Header -->
    <line x1="48" y1="124" x2="768" y2="124" stroke="#000000" stroke-width="1" />
    <!-- Top Bauhaus Orange Title Block Bar -->
    <rect x="48" y="136" width="720" height="32" rx="9" ry="9" fill="#EF6922" stroke="#000000" stroke-width="1" />

    <!-- Card 1 Frame: Bill To -->
    <rect x="48" y="182" width="232" height="136" rx="9" ry="9" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <path d="${topRoundedPath(48, 182, 232, 26, 9)}" fill="#000000" stroke="#000000" stroke-width="1" />

    <!-- Card 2 Frame: Project & Schedule -->
    <rect x="292" y="182" width="232" height="136" rx="9" ry="9" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <path d="${topRoundedPath(292, 182, 232, 26, 9)}" fill="#27AAE0" stroke="#000000" stroke-width="1" />

    <!-- Card 3 Frame: Balance Due Summary -->
    <rect x="536" y="182" width="232" height="136" rx="9" ry="9" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <path d="${topRoundedPath(536, 182, 232, 26, 9)}" fill="#FDCB33" stroke="#000000" stroke-width="1" />

    <!-- Line Items Schedule Frame -->
    <rect x="48" y="332" width="720" height="376" rx="9" ry="9" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <path d="${topRoundedPath(48, 332, 720, 28, 9)}" fill="#000000" stroke="#000000" stroke-width="1" />
    <rect x="48" y="360" width="720" height="28" fill="#CBCBCB" stroke="#000000" stroke-width="1" />
    ${rowDividersSvg.join('\n    ')}

    <!-- Left Footer Card: Notes & Payment Instructions -->
    <rect x="48" y="724" width="416" height="190" rx="9" ry="9" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <path d="${topRoundedPath(48, 724, 416, 26, 9)}" fill="#CBCBCB" stroke="#000000" stroke-width="1" />

    <!-- Right Footer Card: Totals Breakdown -->
    <rect x="478" y="724" width="290" height="190" rx="9" ry="9" fill="#FFFFFF" stroke="#000000" stroke-width="1" />
    <path d="${topRoundedPath(478, 724, 290, 26, 9)}" fill="#27AAE0" stroke="#000000" stroke-width="1" />
    <line x1="490" y1="786" x2="756" y2="786" stroke="#CBCBCB" stroke-width="0.75" />
    <line x1="490" y1="812" x2="756" y2="812" stroke="#CBCBCB" stroke-width="0.75" />
    <line x1="490" y1="838" x2="756" y2="838" stroke="#CBCBCB" stroke-width="0.75" />
    <rect x="488" y="866" width="270" height="38" rx="7" ry="7" fill="#FDCB33" stroke="#000000" stroke-width="1" />

    <!-- Bottom Footer Divider Line -->
    <line x1="48" y1="932" x2="768" y2="932" stroke="#000000" stroke-width="0.75" />
  </g>

  <!-- LAYER 02: Brand Logos & Header Block -->
  <g inkscape:groupmode="layer" inkscape:label="02 - Logos &amp; Header" id="layer-logos">
    <!-- Remixed Casegoods Logo (CASEGOODS_LOGO_FINAL6) -->
    <image
      x="48"
      y="46"
      width="280"
      height="66"
      preserveAspectRatio="xMinYMid meet"
      xlink:href="data:image/png;base64,${logoMainB64}" />

    <!-- Top-Right Black Invoice Title Block -->
    <rect x="508" y="46" width="260" height="66" rx="9" ry="9" fill="#000000" />
    <text x="752" y="74" text-anchor="end" font-family="${fontStack}" font-size="18" font-weight="600" fill="#FFFFFF" letter-spacing="0.18em">INVOICE</text>
    <text x="752" y="96" text-anchor="end" font-family="${fontStack}" font-size="9.5" font-weight="500" fill="#FDCB33" letter-spacing="0.10em">${escapeXml(data.invoiceNumber)}  ·  JOB #${escapeXml(data.jobCode)}</text>

    <!-- Bauhaus Title Bar Labels -->
    <text x="62" y="156" font-family="${fontStack}" font-size="9.5" font-weight="600" fill="#000000" letter-spacing="0.12em">PROJECT BILLING SCHEDULE — HANDCRAFTED IN OMAHA, NEBRASKA</text>
    <text x="754" y="156" text-anchor="end" font-family="${fontStack}" font-size="9.5" font-weight="600" fill="#000000" letter-spacing="0.10em">ISSUE DATE: ${escapeXml(data.issueDate)}</text>

    <!-- Centered 4-Icon Footer Strip (LOGO_4_IMAGES) -->
    <image
      x="303"
      y="944"
      width="210"
      height="41"
      preserveAspectRatio="xMidYMid meet"
      xlink:href="data:image/png;base64,${logoIconsB64}" />
    <text x="408" y="1004" text-anchor="middle" font-family="${fontStack}" font-size="8.5" font-weight="400" fill="#000000" letter-spacing="0.14em">CASEGOODS  •  JOSH HEINKE  •  402-720-1377  •  CASEGOODSNE@GMAIL.COM  •  OMAHA, NEBRASKA</text>
  </g>

  <!-- LAYER 03: Client & Project Info (Double-Click Any Text to Edit) -->
  <g inkscape:groupmode="layer" inkscape:label="03 - Client &amp; Project Info" id="layer-client">
    <!-- Card 01 Header & Fields -->
    <text x="60" y="199" font-family="${fontStack}" font-size="8.5" font-weight="600" fill="#FFFFFF" letter-spacing="0.14em">01 / BILL TO</text>
    <text x="60" y="230" font-family="${fontStack}" font-size="11" font-weight="600" fill="#000000">${escapeXml(data.clientName)}</text>
    <text x="60" y="248" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#000000">${escapeXml(data.clientSubtitle)}</text>
    <text x="60" y="266" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#000000">${escapeXml(data.clientAddress1)}</text>
    <text x="60" y="284" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#000000">${escapeXml(data.clientAddress2)}</text>
    <text x="60" y="302" font-family="${fontStack}" font-size="9" font-weight="400" fill="#333333">${escapeXml(data.clientContact)}</text>

    <!-- Card 02 Header & Fields -->
    <text x="304" y="199" font-family="${fontStack}" font-size="8.5" font-weight="600" fill="#000000" letter-spacing="0.14em">02 / PROJECT &amp; TERMS</text>
    <text x="304" y="230" font-family="${fontStack}" font-size="10.5" font-weight="600" fill="#000000">${escapeXml(data.projectName)}</text>
    <text x="304" y="248" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#000000">JOB CODE: ${escapeXml(data.jobCode)}</text>
    <text x="304" y="266" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#000000">ISSUED: ${escapeXml(data.issueDate)}</text>
    <text x="304" y="284" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#000000">DUE DATE: ${escapeXml(data.dueDate)}</text>
    <text x="304" y="302" font-family="${fontStack}" font-size="9" font-weight="500" fill="#000000">TERMS: ${escapeXml(data.paymentTerms)}</text>

    <!-- Card 03 Header & Fields -->
    <text x="548" y="199" font-family="${fontStack}" font-size="8.5" font-weight="600" fill="#000000" letter-spacing="0.14em">03 / AMOUNT DUE</text>
    <text x="548" y="254" font-family="${fontStack}" font-size="25" font-weight="600" fill="#000000">${escapeXml(formatCurrency(balanceDue))}</text>
    <text x="548" y="278" font-family="${fontStack}" font-size="8" font-weight="600" fill="#000000" letter-spacing="0.08em">${escapeXml(data.statusNote)}</text>
    <text x="548" y="302" font-family="${fontStack}" font-size="9" font-weight="400" fill="#333333">TOTAL CONTRACT: ${escapeXml(formatCurrency(total))}</text>
  </g>

  <!-- LAYER 04: Line Items Schedule (Double-Click Any Cell to Edit) -->
  <g inkscape:groupmode="layer" inkscape:label="04 - Line Items Schedule" id="layer-items">
    <text x="62" y="350" font-family="${fontStack}" font-size="8.5" font-weight="600" fill="#FFFFFF" letter-spacing="0.14em">04 / ITEMIZED SCOPE OF WORK &amp; MILLWORK SCHEDULE</text>
    <text x="754" y="350" text-anchor="end" font-family="${fontStack}" font-size="8" font-weight="500" fill="#FDCB33" letter-spacing="0.12em">TOLERANCE: ± 1/32"</text>

    <!-- Table Column Headers -->
    <text x="64" y="378" font-family="${fontStack}" font-size="8" font-weight="600" fill="#000000" letter-spacing="0.12em">ITEM</text>
    <text x="108" y="378" font-family="${fontStack}" font-size="8" font-weight="600" fill="#000000" letter-spacing="0.12em">DESCRIPTION &amp; SPECIFICATION</text>
    <text x="530" y="378" text-anchor="end" font-family="${fontStack}" font-size="8" font-weight="600" fill="#000000" letter-spacing="0.12em">QTY</text>
    <text x="640" y="378" text-anchor="end" font-family="${fontStack}" font-size="8" font-weight="600" fill="#000000" letter-spacing="0.12em">RATE</text>
    <text x="754" y="378" text-anchor="end" font-family="${fontStack}" font-size="8" font-weight="600" fill="#000000" letter-spacing="0.12em">AMOUNT</text>

    <!-- Editable Item Rows -->
    ${rowTextSvg.join('\n    ')}
  </g>

  <!-- LAYER 05: Totals & Payment Instructions -->
  <g inkscape:groupmode="layer" inkscape:label="05 - Totals &amp; Payment Terms" id="layer-totals">
    <!-- Left Card Text -->
    <text x="60" y="741" font-family="${fontStack}" font-size="8.5" font-weight="600" fill="#000000" letter-spacing="0.14em">05 / PAYMENT INSTRUCTIONS &amp; NOTES</text>
    <text x="60" y="776" font-family="${fontStack}" font-size="9.5" font-weight="500" fill="#000000">${escapeXml(data.notesLine1)}</text>
    <text x="60" y="798" font-family="${fontStack}" font-size="9.5" font-weight="400" fill="#000000">${escapeXml(data.notesLine2)}</text>
    <text x="60" y="824" font-family="${fontStack}" font-size="9" font-weight="400" fill="#333333">${escapeXml(data.notesLine3)}</text>
    <text x="60" y="844" font-family="${fontStack}" font-size="9" font-weight="400" fill="#333333">${escapeXml(data.notesLine4)}</text>
    <text x="60" y="896" font-family="${fontStack}" font-size="8" font-weight="500" fill="#000000" letter-spacing="0.10em">THANK YOU FOR SUPPORTING INDEPENDENT OMAHA CRAFT.</text>

    <!-- Right Card Totals -->
    <text x="490" y="741" font-family="${fontStack}" font-size="8.5" font-weight="600" fill="#000000" letter-spacing="0.14em">06 / INVOICE TOTALS</text>

    <text x="490" y="775" font-family="${fontStack}" font-size="9.5" font-weight="500" fill="#000000" letter-spacing="0.06em">SUBTOTAL</text>
    <text x="754" y="775" text-anchor="end" font-family="${fontStack}" font-size="10" font-weight="500" fill="#000000">${escapeXml(formatCurrency(subtotal))}</text>

    <text x="490" y="803" font-family="${fontStack}" font-size="9" font-weight="400" fill="#333333">${escapeXml(data.taxOrFreightLabel.toUpperCase())}</text>
    <text x="754" y="803" text-anchor="end" font-family="${fontStack}" font-size="10" font-weight="400" fill="#000000">${escapeXml(formatCurrency(tax))}</text>

    <text x="490" y="829" font-family="${fontStack}" font-size="9.5" font-weight="600" fill="#000000" letter-spacing="0.06em">PROJECT TOTAL</text>
    <text x="754" y="829" text-anchor="end" font-family="${fontStack}" font-size="10.5" font-weight="600" fill="#000000">${escapeXml(formatCurrency(total))}</text>

    <text x="490" y="855" font-family="${fontStack}" font-size="9" font-weight="400" fill="#333333">LESS DEPOSIT / PAYMENTS</text>
    <text x="754" y="855" text-anchor="end" font-family="${fontStack}" font-size="10" font-weight="400" fill="#000000">-${escapeXml(formatCurrency(deposit))}</text>

    <text x="500" y="890" font-family="${fontStack}" font-size="10" font-weight="600" fill="#000000" letter-spacing="0.12em">BALANCE DUE</text>
    <text x="746" y="891" text-anchor="end" font-family="${fontStack}" font-size="14" font-weight="600" fill="#000000">${escapeXml(formatCurrency(balanceDue))}</text>
  </g>
</svg>
`;
}

/**
 * Helper to draw a vector rounded rectangle in pdf-lib (using top-down coordinates matching the 816x1056 SVG scaled by 0.75).
 */
function drawPdfRoundedRect(
  page: PDFPage,
  svgX: number,
  svgY: number,
  svgW: number,
  svgH: number,
  svgR: number,
  options: {
    fill?: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
    topRoundedOnly?: boolean;
  }
) {
  const s = 0.75; // 96dpi -> 72pt
  const x = svgX * s;
  const yTop = 792 - svgY * s;
  const w = svgW * s;
  const h = svgH * s;
  const r = svgR * s;

  // pdf-lib drawSvgPath uses top-left origin internally relative to its own path coordinate system,
  // OR its y-offset shifts downward cleanly when using SVG coordinates with y = 792!
  // Let's pass an SVG path string in 72pt top-down coordinates anchored at (0, 792):
  const px = x;
  const py = svgY * s;
  const path = options.topRoundedOnly
    ? `M ${px},${py + r} Q ${px},${py} ${px + r},${py} L ${px + w - r},${py} Q ${px + w},${py} ${px + w},${py + r} L ${px + w},${py + h} L ${px},${py + h} Z`
    : `M ${px + r},${py} L ${px + w - r},${py} Q ${px + w},${py} ${px + w},${py + r} L ${px + w},${py + h - r} Q ${px + w},${py + h} ${px + w - r},${py + h} L ${px + r},${py + h} Q ${px},${py + h} ${px},${py + h - r} L ${px},${py + r} Q ${px},${py} ${px + r},${py} Z`;

  // Note: yTop is not needed directly when passing x: 0, y: 792 to drawSvgPath because drawSvgPath flips Y downward from y!
  void yTop;
  page.drawSvgPath(path, {
    x: 0,
    y: 792,
    color: options.fill,
    borderColor: options.borderColor,
    borderWidth: options.borderWidth,
  });
}

/**
 * Generates a pure vector, US Letter PDF (612 x 792 pt) with real selectable & editable
 * Standard PDF text objects so Josh can open and edit any invoice cleanly in PDFCraft or Inkscape.
 */
export async function generatePdfCraftInvoicePdf(
  data: InvoiceData,
  providedAssets?: InvoiceAssetPayloads
): Promise<Uint8Array> {
  const assets = providedAssets || (await fetchBrowserInvoiceAssets());
  const { subtotal, tax, total, deposit, balanceDue } = calculateInvoiceTotals(data);

  const pdfDoc = await pdfDocumentWithMetadata(data);
  const page = pdfDoc.addPage([612, 792]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [logoMainImg, logoIconsImg] = await Promise.all([
    pdfDoc.embedPng(assets.logoMainBytes),
    pdfDoc.embedPng(assets.logoIconsBytes),
  ]);

  const cBlack = rgb(0, 0, 0);
  const cWhite = rgb(1, 1, 1);
  const cOrange = rgb(239 / 255, 105 / 255, 34 / 255);
  const cBlue = rgb(39 / 255, 170 / 255, 224 / 255);
  const cYellow = rgb(253 / 255, 203 / 255, 51 / 255);
  const cGray = rgb(203 / 255, 203 / 255, 203 / 255);
  const cMuted = rgb(0.22, 0.22, 0.22);

  const s = 0.75;
  const ptY = (svgBaselineY: number) => 792 - svgBaselineY * s;

  const drawTextLeft = (
    text: string,
    svgX: number,
    svgY: number,
    sizeSvg: number,
    bold = false,
    color = cBlack
  ) => {
    const font = bold ? fontBold : fontRegular;
    page.drawText(text || '', {
      x: svgX * s,
      y: ptY(svgY),
      size: sizeSvg * s,
      font,
      color,
    });
  };

  const drawTextRight = (
    text: string,
    svgRightX: number,
    svgY: number,
    sizeSvg: number,
    bold = false,
    color = cBlack
  ) => {
    const font = bold ? fontBold : fontRegular;
    const size = sizeSvg * s;
    const width = font.widthOfTextAtSize(text || '', size);
    page.drawText(text || '', {
      x: svgRightX * s - width,
      y: ptY(svgY),
      size,
      font,
      color,
    });
  };

  const drawTextCenter = (
    text: string,
    svgCenterX: number,
    svgY: number,
    sizeSvg: number,
    bold = false,
    color = cBlack
  ) => {
    const font = bold ? fontBold : fontRegular;
    const size = sizeSvg * s;
    const width = font.widthOfTextAtSize(text || '', size);
    page.drawText(text || '', {
      x: svgCenterX * s - width / 2,
      y: ptY(svgY),
      size,
      font,
      color,
    });
  };

  // 1. Outer Architectural Sheet Border (1.5px, 9px Radius)
  drawPdfRoundedRect(page, 28, 28, 760, 1000, 9, {
    fill: cWhite,
    borderColor: cBlack,
    borderWidth: 1.5 * s,
  });

  // 2. Top-Left Casegoods Logo (CASEGOODS_LOGO_FINAL6.png)
  const logoDims = logoMainImg.scaleToFit(280 * s, 66 * s);
  page.drawImage(logoMainImg, {
    x: 48 * s,
    y: 792 - (46 + 66) * s + (66 * s - logoDims.height) / 2,
    width: logoDims.width,
    height: logoDims.height,
  });

  // Top-Right Black Invoice Title Block
  drawPdfRoundedRect(page, 508, 46, 260, 66, 9, { fill: cBlack });
  drawTextRight('INVOICE', 752, 74, 18, true, cWhite);
  drawTextRight(`${data.invoiceNumber}  ·  JOB #${data.jobCode}`, 752, 96, 9.5, true, cYellow);

  // Thin Black Divider Rule Under Header
  page.drawLine({
    start: { x: 48 * s, y: ptY(124) },
    end: { x: 768 * s, y: ptY(124) },
    thickness: 1 * s,
    color: cBlack,
  });

  // 3. Full-Width Bauhaus Orange Title Block Bar
  drawPdfRoundedRect(page, 48, 136, 720, 32, 9, {
    fill: cOrange,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawTextLeft('PROJECT BILLING SCHEDULE — HANDCRAFTED IN OMAHA, NEBRASKA', 62, 156, 9, true, cBlack);
  drawTextRight(`ISSUE DATE: ${data.issueDate}`, 754, 156, 9, true, cBlack);

  // 4. Metadata Cards Row (Bill To / Project & Terms / Amount Due)
  // Card 1: Bill To
  drawPdfRoundedRect(page, 48, 182, 232, 136, 9, {
    fill: cWhite,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawPdfRoundedRect(page, 48, 182, 232, 26, 9, {
    fill: cBlack,
    borderColor: cBlack,
    borderWidth: 1 * s,
    topRoundedOnly: true,
  });
  drawTextLeft('01 / BILL TO', 60, 199, 8.5, true, cWhite);
  drawTextLeft(data.clientName, 60, 230, 11, true, cBlack);
  drawTextLeft(data.clientSubtitle, 60, 248, 9.5, false, cBlack);
  drawTextLeft(data.clientAddress1, 60, 266, 9.5, false, cBlack);
  drawTextLeft(data.clientAddress2, 60, 284, 9.5, false, cBlack);
  drawTextLeft(data.clientContact, 60, 302, 8.5, false, cMuted);

  // Card 2: Project & Terms
  drawPdfRoundedRect(page, 292, 182, 232, 136, 9, {
    fill: cWhite,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawPdfRoundedRect(page, 292, 182, 232, 26, 9, {
    fill: cBlue,
    borderColor: cBlack,
    borderWidth: 1 * s,
    topRoundedOnly: true,
  });
  drawTextLeft('02 / PROJECT & TERMS', 304, 199, 8.5, true, cBlack);
  drawTextLeft(data.projectName, 304, 230, 10.5, true, cBlack);
  drawTextLeft(`JOB CODE: ${data.jobCode}`, 304, 248, 9.5, false, cBlack);
  drawTextLeft(`ISSUED: ${data.issueDate}`, 304, 266, 9.5, false, cBlack);
  drawTextLeft(`DUE DATE: ${data.dueDate}`, 304, 284, 9.5, false, cBlack);
  drawTextLeft(`TERMS: ${data.paymentTerms}`, 304, 302, 8.8, true, cBlack);

  // Card 3: Amount Due
  drawPdfRoundedRect(page, 536, 182, 232, 136, 9, {
    fill: cWhite,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawPdfRoundedRect(page, 536, 182, 232, 26, 9, {
    fill: cYellow,
    borderColor: cBlack,
    borderWidth: 1 * s,
    topRoundedOnly: true,
  });
  drawTextLeft('03 / AMOUNT DUE', 548, 199, 8.5, true, cBlack);
  drawTextLeft(formatCurrency(balanceDue), 548, 254, 24, true, cBlack);
  drawTextLeft(data.statusNote, 548, 278, 7.5, true, cBlack);
  drawTextLeft(`TOTAL CONTRACT: ${formatCurrency(total)}`, 548, 302, 9, false, cMuted);

  // 5. Line Items Schedule Table
  drawPdfRoundedRect(page, 48, 332, 720, 376, 9, {
    fill: cWhite,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawPdfRoundedRect(page, 48, 332, 720, 28, 9, {
    fill: cBlack,
    borderColor: cBlack,
    borderWidth: 1 * s,
    topRoundedOnly: true,
  });
  drawTextLeft('04 / ITEMIZED SCOPE OF WORK & MILLWORK SCHEDULE', 62, 350, 8.5, true, cWhite);
  drawTextRight('TOLERANCE: ± 1/32"', 754, 350, 8, true, cYellow);

  page.drawRectangle({
    x: 48 * s,
    y: ptY(388),
    width: 720 * s,
    height: 28 * s,
    color: cGray,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawTextLeft('ITEM', 64, 378, 8, true, cBlack);
  drawTextLeft('DESCRIPTION & SPECIFICATION', 108, 378, 8, true, cBlack);
  drawTextRight('QTY', 530, 378, 8, true, cBlack);
  drawTextRight('RATE', 640, 378, 8, true, cBlack);
  drawTextRight('AMOUNT', 754, 378, 8, true, cBlack);

  const maxRows = 8;
  for (let idx = 0; idx < maxRows; idx++) {
    const rowY = 388 + idx * 40;
    if (idx < maxRows - 1) {
      page.drawLine({
        start: { x: 48 * s, y: ptY(rowY + 40) },
        end: { x: 768 * s, y: ptY(rowY + 40) },
        thickness: 0.75 * s,
        color: cGray,
      });
    }

    const item = data.items[idx];
    const itemNum = String(idx + 1).padStart(2, '0');
    if (item) {
      const lineTotal = parseQty(item.qty) * (Number.isFinite(item.rate) ? item.rate : 0);
      drawTextLeft(itemNum, 64, rowY + 18, 9.5, true, cBlack);
      drawTextLeft(item.title, 108, rowY + 17, 10.2, true, cBlack);
      drawTextLeft(item.spec, 108, rowY + 31, 8.2, false, cMuted);
      drawTextRight(item.qty, 530, rowY + 23, 10, false, cBlack);
      drawTextRight(formatCurrency(item.rate), 640, rowY + 23, 10, false, cBlack);
      drawTextRight(formatCurrency(lineTotal), 754, rowY + 23, 10.2, true, cBlack);
    } else {
      drawTextLeft(itemNum, 64, rowY + 23, 9, false, cGray);
    }
  }

  // 6. Notes & Totals Row
  // Left Card: Payment Instructions & Notes
  drawPdfRoundedRect(page, 48, 724, 416, 190, 9, {
    fill: cWhite,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawPdfRoundedRect(page, 48, 724, 416, 26, 9, {
    fill: cGray,
    borderColor: cBlack,
    borderWidth: 1 * s,
    topRoundedOnly: true,
  });
  drawTextLeft('05 / PAYMENT INSTRUCTIONS & NOTES', 60, 741, 8.5, true, cBlack);
  drawTextLeft(data.notesLine1, 60, 776, 9.5, true, cBlack);
  drawTextLeft(data.notesLine2, 60, 798, 9.5, false, cBlack);
  drawTextLeft(data.notesLine3, 60, 824, 9, false, cMuted);
  drawTextLeft(data.notesLine4, 60, 844, 9, false, cMuted);
  drawTextLeft('THANK YOU FOR SUPPORTING INDEPENDENT OMAHA CRAFT.', 60, 896, 7.8, true, cBlack);

  // Right Card: Totals Breakdown
  drawPdfRoundedRect(page, 478, 724, 290, 190, 9, {
    fill: cWhite,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawPdfRoundedRect(page, 478, 724, 290, 26, 9, {
    fill: cBlue,
    borderColor: cBlack,
    borderWidth: 1 * s,
    topRoundedOnly: true,
  });
  drawTextLeft('06 / INVOICE TOTALS', 490, 741, 8.5, true, cBlack);

  drawTextLeft('SUBTOTAL', 490, 775, 9.5, true, cBlack);
  drawTextRight(formatCurrency(subtotal), 754, 775, 10, true, cBlack);
  page.drawLine({
    start: { x: 490 * s, y: ptY(786) },
    end: { x: 756 * s, y: ptY(786) },
    thickness: 0.75 * s,
    color: cGray,
  });

  drawTextLeft(data.taxOrFreightLabel.toUpperCase(), 490, 803, 8.5, false, cMuted);
  drawTextRight(formatCurrency(tax), 754, 803, 10, false, cBlack);
  page.drawLine({
    start: { x: 490 * s, y: ptY(812) },
    end: { x: 756 * s, y: ptY(812) },
    thickness: 0.75 * s,
    color: cGray,
  });

  drawTextLeft('PROJECT TOTAL', 490, 829, 9.5, true, cBlack);
  drawTextRight(formatCurrency(total), 754, 829, 10.5, true, cBlack);
  page.drawLine({
    start: { x: 490 * s, y: ptY(838) },
    end: { x: 756 * s, y: ptY(838) },
    thickness: 0.75 * s,
    color: cGray,
  });

  drawTextLeft('LESS DEPOSIT / PAYMENTS', 490, 855, 8.5, false, cMuted);
  drawTextRight(`-${formatCurrency(deposit)}`, 754, 855, 10, false, cBlack);

  drawPdfRoundedRect(page, 488, 866, 270, 38, 7, {
    fill: cYellow,
    borderColor: cBlack,
    borderWidth: 1 * s,
  });
  drawTextLeft('BALANCE DUE', 500, 890, 10, true, cBlack);
  drawTextRight(formatCurrency(balanceDue), 746, 891, 14, true, cBlack);

  // 7. Bottom Footer Strip
  page.drawLine({
    start: { x: 48 * s, y: ptY(932) },
    end: { x: 768 * s, y: ptY(932) },
    thickness: 0.75 * s,
    color: cBlack,
  });

  const iconsDims = logoIconsImg.scaleToFit(210 * s, 41 * s);
  page.drawImage(logoIconsImg, {
    x: (612 - iconsDims.width) / 2,
    y: 792 - (944 + 41) * s + (41 * s - iconsDims.height) / 2,
    width: iconsDims.width,
    height: iconsDims.height,
  });

  drawTextCenter(
    'CASEGOODS  •  JOSH HEINKE  •  402-720-1377  •  CASEGOODSNE@GMAIL.COM  •  OMAHA, NEBRASKA',
    408,
    1004,
    8,
    false,
    cBlack
  );

  return pdfDoc.save();
}

async function pdfDocumentWithMetadata(data: InvoiceData): Promise<PDFDocument> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`casegoods Invoice — ${data.invoiceNumber}`);
  pdfDoc.setAuthor('Josh Heinke — casegoods (Omaha, NE)');
  pdfDoc.setSubject(`Custom Woodworking & Millwork Invoice (${data.projectName})`);
  pdfDoc.setCreator('casegoods Studio Template (PDFCraft & Inkscape Ready)');
  return pdfDoc;
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
