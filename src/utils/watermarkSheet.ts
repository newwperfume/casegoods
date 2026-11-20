import { ASSETS } from '../assets/index.ts';

export interface WatermarkSheetOptions {
  /** Source image URL or data URL */
  imageSrc: string;
  /** Top-left box: Project name or number (e.g. "PROJECT 01 / THE FAMILY ROOM" or "CG-001 / WALNUT CREDENZA") */
  projectHeader: string;
  /** Top-right box: What drawing or rendering it is (e.g. "3D HARDWOOD RENDER" or "2D CAD ELEVATION SKETCH") */
  drawingTypeLabel: string;
  /** Optional subtitle/spec line at the bottom of the inner frame */
  bottomSpecLine?: string;
  /** Fill color for the top-left project header box (defaults to #EF6922) */
  leftBoxFill?: string;
  /** Text color for the top-left box (defaults to #000000) */
  leftBoxText?: string;
  /** Fill color for the top-right drawing/rendering box (defaults to #FDCB33) */
  rightBoxFill?: string;
  /** Text color for the top-right box (defaults to #000000) */
  rightBoxText?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fillStyle?: string,
  strokeStyle?: string,
  lineWidth = 1.5
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle && lineWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function truncateTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 3 && ctx.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

/**
 * Renders a complete Casegoods architectural sheet PNG with:
 * - Outer 1.5px rounded frame matching the expanded modal window spacing
 * - Top-Left Box: Project Name or Number
 * - Top-Center: Casegoods Logo (ASSETS.brand.logoFull)
 * - Top-Right Box: Naming what drawing or rendering it is
 * - Inner 1px rounded stage frame around the image
 */
export async function renderWatermarkedSheet(
  options: WatermarkSheetOptions
): Promise<{ dataUrl: string; blob: Blob }> {
  const {
    imageSrc,
    projectHeader,
    drawingTypeLabel,
    bottomSpecLine,
    leftBoxFill = '#EF6922',
    leftBoxText = '#000000',
    rightBoxFill = '#FDCB33',
    rightBoxText = '#000000',
  } = options;

  const [mainImg, logoImg] = await Promise.all([
    loadImage(imageSrc),
    loadImage(ASSETS.brand.logoFull).catch(() => null),
  ]);

  // Base sheet dimensions modeled after the expanded modal window (1600px wide crisp sheet)
  const sheetWidth = 1600;
  const outerInset = 18; // Outer sheet border inset
  const innerPadding = 28; // Same breathing room as the expanded window
  const headerHeight = 96; // Top bar height holding Left Box, Center Logo, Right Box
  const gapBetweenHeaderAndStage = 22;
  const stageInternalPadding = 26;

  const stageX = outerInset + innerPadding;
  const stageWidth = sheetWidth - (outerInset + innerPadding) * 2;
  const maxArtWidth = stageWidth - stageInternalPadding * 2;

  // Scale main image proportionally to fit maxArtWidth
  const natW = mainImg.naturalWidth || 1280;
  const natH = mainImg.naturalHeight || 720;
  const scale = maxArtWidth / natW;
  const artWidth = Math.round(natW * scale);
  const artHeight = Math.round(natH * scale);

  const footerStripHeight = bottomSpecLine ? 34 : 0;
  const stageHeight = artHeight + stageInternalPadding * 2 + footerStripHeight;
  const sheetHeight =
    (outerInset + innerPadding) * 2 +
    headerHeight +
    gapBetweenHeaderAndStage +
    stageHeight;

  const canvas = document.createElement('canvas');
  canvas.width = sheetWidth;
  canvas.height = sheetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // 1. Pure white outer background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, sheetWidth, sheetHeight);

  // 2. Outer 1.5px Sheet Frame (scaled to 2.25px at 1600px canvas width to match 1.5px CSS weight)
  drawRoundedRect(
    ctx,
    outerInset,
    outerInset,
    sheetWidth - outerInset * 2,
    sheetHeight - outerInset * 2,
    14,
    '#FFFFFF',
    '#000000',
    2.25
  );

  // 3. Top 3-Zone Header Layout:
  //    [Left Box: Project Name / Number]  —  [Center: Casegoods Logo]  —  [Right Box: Drawing / Rendering Type]
  const headerTopY = outerInset + innerPadding;
  const sideBoxWidth = 440;
  const sideBoxHeight = 56;
  const sideBoxY = headerTopY + Math.round((headerHeight - sideBoxHeight) / 2);

  // 3A. Top-Left Box (Project Name or Number)
  const leftBoxX = stageX;
  drawRoundedRect(
    ctx,
    leftBoxX,
    sideBoxY,
    sideBoxWidth,
    sideBoxHeight,
    12,
    leftBoxFill,
    '#000000',
    1.5
  );

  ctx.fillStyle = leftBoxText;
  ctx.font = '500 17px "Plus Jakarta Sans", "Outfit", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const leftText = truncateTextToWidth(
    ctx,
    projectHeader.toUpperCase(),
    sideBoxWidth - 36
  );
  ctx.fillText(leftText, leftBoxX + 18, sideBoxY + sideBoxHeight / 2 + 1);

  // 3B. Top-Center Casegoods Logo
  if (logoImg) {
    const maxLogoH = headerHeight - 4;
    const maxLogoW = sheetWidth - (stageX + sideBoxWidth) * 2 - 48;
    const logoScale = Math.min(
      maxLogoH / (logoImg.naturalHeight || 100),
      maxLogoW / (logoImg.naturalWidth || 300)
    );
    const drawLogoW = (logoImg.naturalWidth || 300) * logoScale;
    const drawLogoH = (logoImg.naturalHeight || 100) * logoScale;
    const drawLogoX = (sheetWidth - drawLogoW) / 2;
    const drawLogoY = headerTopY + (headerHeight - drawLogoH) / 2;
    ctx.drawImage(logoImg, drawLogoX, drawLogoY, drawLogoW, drawLogoH);
  } else {
    ctx.fillStyle = '#000000';
    ctx.font = '300 32px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('casegoods', sheetWidth / 2, headerTopY + headerHeight / 2);
  }

  // 3C. Top-Right Box (Naming What Drawing or Rendering It Is)
  const rightBoxX = stageX + stageWidth - sideBoxWidth;
  drawRoundedRect(
    ctx,
    rightBoxX,
    sideBoxY,
    sideBoxWidth,
    sideBoxHeight,
    12,
    rightBoxFill,
    '#000000',
    1.5
  );

  ctx.fillStyle = rightBoxText;
  ctx.font = '500 17px "Plus Jakarta Sans", "Outfit", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const rightText = truncateTextToWidth(
    ctx,
    drawingTypeLabel.toUpperCase(),
    sideBoxWidth - 32
  );
  ctx.fillText(rightText, rightBoxX + sideBoxWidth / 2, sideBoxY + sideBoxHeight / 2 + 1);

  // 4. Inner Outlined Image Stage (Matches Expanded Modal Stage Spacing)
  const stageY = headerTopY + headerHeight + gapBetweenHeaderAndStage;
  drawRoundedRect(
    ctx,
    stageX,
    stageY,
    stageWidth,
    stageHeight,
    14,
    '#FFFFFF',
    '#000000',
    1.5
  );

  // Draw the main rendering or CAD drawing centered inside the inner stage
  const artX = stageX + Math.round((stageWidth - artWidth) / 2);
  const artY = stageY + stageInternalPadding;
  ctx.drawImage(mainImg, artX, artY, artWidth, artHeight);

  // Thin 0.75px hairline around the image canvas itself
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(artX, artY, artWidth, artHeight);

  // Optional bottom specification & studio watermark line inside the stage
  if (bottomSpecLine) {
    const specY = artY + artHeight + Math.round((footerStripHeight + stageInternalPadding) / 2) - 4;
    ctx.fillStyle = '#000000';
    ctx.font = '400 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const cleanSpec = truncateTextToWidth(ctx, bottomSpecLine, stageWidth - 360);
    ctx.fillText(cleanSpec, artX, specY);

    ctx.textAlign = 'right';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      'CASEGOODS · HANDCRAFTED IN OMAHA · 402-720-1377',
      artX + artWidth,
      specY
    );
  }

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to create watermarked PNG blob'));
    }, 'image/png');
  });

  return { dataUrl, blob };
}

/**
 * Triggers a browser download of a watermarked Casegoods sheet PNG
 */
export async function downloadWatermarkedSheet(
  options: WatermarkSheetOptions,
  downloadFilename: string
): Promise<void> {
  const { blob } = await renderWatermarkedSheet(options);
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = downloadFilename.endsWith('.png')
    ? downloadFilename
    : `${downloadFilename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}
