import React, { useMemo } from 'react';
import {
  INVOICE_LAYOUT,
  InvoiceTemplateData,
  buildInvoiceViewModel,
  formatCurrency,
  pieSliceBezierPath,
  roundedRectPathPt,
} from '../utils/invoiceGenerator.ts';
import { generateCasegoodsQrStandaloneSvg } from '../utils/casegoodsQr.ts';

interface InvoiceSvgPreviewProps {
  data: InvoiceTemplateData;
}

/**
 * Live inline React SVG preview of the US Letter Casegoods invoice.
 * Renders directly in the DOM so it inherits the website's loaded Nexa Light
 * webfont cleanly without SVG-in-<img> font sandboxing, while sharing exact
 * INVOICE_LAYOUT geometry with the Inkscape .SVG and PDFCraft .PDF exporters.
 */
export const InvoiceSvgPreview: React.FC<InvoiceSvgPreviewProps> = ({ data }) => {
  const vm = useMemo(() => buildInvoiceViewModel(data), [data]);
  const L = INVOICE_LAYOUT;
  const S = L.svgScale;
  const p = (pt: number) => +(pt * S).toFixed(2);
  const fontStack = "'Nexa Light', 'Montserrat', 'Questrial', sans-serif";

  const qrDataUri = useMemo(() => {
    if (!vm.hasDriveQr) return null;
    const svg = generateCasegoodsQrStandaloneSvg(vm.driveUrl, 240, {
      frameStyle: 'cg-badge',
    });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [vm.hasDriveQr, vm.driveUrl]);

  const mainLogoW = +(L.mainLogoH * L.mainLogoAspect).toFixed(2);
  const mainLogoX = +(L.centerX - mainLogoW / 2).toFixed(2);
  const iconsW = +(L.iconsH * L.iconsAspect).toFixed(2);
  const iconsX = +(L.centerX - iconsW / 2).toFixed(2);

  const rightHeaderX = L.marginX + L.contentW - L.headerBoxW;
  const rightFooterX = L.marginX + L.contentW - L.footerCardW;
  const footerTotalH = L.footerBarH + L.footerMidH + L.footerBotH;
  const scopeTotalH = L.scopeBarH + L.scopeBodyH;
  const budgetTotalH = L.budgetBarH + L.budgetBodyH;

  const strokes = L.strokes;

  const scopeStartY =
    L.scopeY +
    L.scopeBarH +
    (vm.scopeLines.length === 1 ? 26 : vm.scopeLines.length === 2 ? 20 : 14.5);

  return (
    <svg
      viewBox={`0 0 ${p(L.pageW)} ${p(L.pageH)}`}
      className="w-full h-auto block select-none bg-white"
      role="img"
      aria-label={`Live Casegoods Invoice Preview — ${data.invoiceNumber}`}
    >
      {/* Page Background */}
      <rect x={0} y={0} width={p(L.pageW)} height={p(L.pageH)} fill="#FFFFFF" />

      {/* Top 3-Zone Architectural Header */}
      <g>
        {/* Left Unified Recipient Card */}
        <rect
          x={p(L.marginX)}
          y={p(L.headerTopY)}
          width={p(L.headerBoxW)}
          height={p(L.headerBoxH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="#FFFFFF"
          stroke="none"
        />
        <path
          d={roundedRectPathPt(
            L.marginX,
            L.headerTopY,
            L.headerBoxW,
            L.headerBarH,
            L.rCad,
            L.rCad,
            0,
            0,
            S
          )}
          fill="#000000"
          stroke="none"
        />
        <text
          x={p(L.marginX + L.headerBoxW / 2)}
          y={p(L.headerTopY + 12)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(7.2)}
          fontWeight={400}
          letterSpacing="1.4"
          fill="#FFFFFF"
        >
          RECIPIENT
        </text>
        <text
          x={p(L.marginX + L.headerBoxW / 2)}
          y={p(L.headerTopY + L.headerBarH + 17.2)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(8.5)}
          fontWeight={400}
          letterSpacing="0.9"
          fill="#000000"
        >
          {data.recipientName}
        </text>
        <rect
          x={p(L.marginX)}
          y={p(L.headerTopY)}
          width={p(L.headerBoxW)}
          height={p(L.headerBoxH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="none"
          stroke="#000000"
          strokeWidth={p(strokes.card)}
        />

        {/* Center Brand Lockup */}
        <image
          x={p(mainLogoX)}
          y={p(L.headerTopY + 2)}
          width={p(mainLogoW)}
          height={p(L.mainLogoH)}
          preserveAspectRatio="xMidYMid meet"
          href="/assets/aistudio/CASEGOODS_LOGO_FINAL6.png"
        />

        {/* Right Unified Invoice Card */}
        <rect
          x={p(rightHeaderX)}
          y={p(L.headerTopY)}
          width={p(L.headerBoxW)}
          height={p(L.headerBoxH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="#FFFFFF"
          stroke="none"
        />
        <path
          d={roundedRectPathPt(
            rightHeaderX,
            L.headerTopY,
            L.headerBoxW,
            L.headerBarH,
            L.rCad,
            L.rCad,
            0,
            0,
            S
          )}
          fill="#000000"
          stroke="none"
        />
        <text
          x={p(rightHeaderX + L.headerBoxW / 2)}
          y={p(L.headerTopY + 12)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(7.2)}
          fontWeight={400}
          letterSpacing="1.4"
          fill="#FFFFFF"
        >
          INVOICE
        </text>
        <text
          x={p(rightHeaderX + L.headerBoxW / 2)}
          y={p(L.headerTopY + L.headerBarH + 17.2)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(8.5)}
          fontWeight={400}
          letterSpacing="0.9"
          fill="#000000"
        >
          {data.invoiceNumber}
        </text>
        <rect
          x={p(rightHeaderX)}
          y={p(L.headerTopY)}
          width={p(L.headerBoxW)}
          height={p(L.headerBoxH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="none"
          stroke="#000000"
          strokeWidth={p(strokes.card)}
        />

        {/* Architectural Header Bottom Rule */}
        <line
          x1={p(L.marginX)}
          y1={p(L.headerRuleY)}
          x2={p(L.marginX + L.contentW)}
          y2={p(L.headerRuleY)}
          stroke="#000000"
          strokeWidth={p(strokes.headerRule)}
        />
      </g>

      {/* Unified Section 01: Project Overview Card */}
      <g>
        <rect
          x={p(L.marginX)}
          y={p(L.scopeY)}
          width={p(L.contentW)}
          height={p(scopeTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="#FFFFFF"
          stroke="none"
        />
        <path
          d={roundedRectPathPt(
            L.marginX,
            L.scopeY,
            L.contentW,
            L.scopeBarH,
            L.rCad,
            L.rCad,
            0,
            0,
            S
          )}
          fill="#000000"
          stroke="none"
        />
        <text
          x={p(L.marginX + 12)}
          y={p(L.scopeY + 12.6)}
          fontFamily={fontStack}
          fontSize={p(7.8)}
          fontWeight={400}
          letterSpacing="1.4"
          fill="#FFFFFF"
        >
          {data.projectTitle}
        </text>
        <text
          x={p(L.marginX + L.contentW - 12)}
          y={p(L.scopeY + 12.6)}
          textAnchor="end"
          fontFamily={fontStack}
          fontSize={p(7.0)}
          fontWeight={400}
          letterSpacing="1.2"
          fill="#FDCB33"
        >
          PROJECT SCOPE
        </text>
        {vm.scopeLines.map((line, idx) => (
          <text
            key={idx}
            x={p(L.marginX + 12)}
            y={p(scopeStartY + idx * 11.6)}
            fontFamily={fontStack}
            fontSize={p(7.4)}
            fontWeight={300}
            letterSpacing="0.35"
            fill="#000000"
          >
            {line}
          </text>
        ))}
        <rect
          x={p(L.marginX)}
          y={p(L.scopeY)}
          width={p(L.contentW)}
          height={p(scopeTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="none"
          stroke="#000000"
          strokeWidth={p(strokes.card)}
        />
      </g>

      {/* Unified Section 02: Budget Distribution Card & Pie Chart */}
      <g>
        <rect
          x={p(L.marginX)}
          y={p(L.budgetY)}
          width={p(L.contentW)}
          height={p(budgetTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="#FFFFFF"
          stroke="none"
        />
        <path
          d={roundedRectPathPt(
            L.marginX,
            L.budgetY,
            L.contentW,
            L.budgetBarH,
            L.rCad,
            L.rCad,
            0,
            0,
            S
          )}
          fill="#000000"
          stroke="none"
        />
        <text
          x={p(L.marginX + 12)}
          y={p(L.budgetY + 12.6)}
          fontFamily={fontStack}
          fontSize={p(7.8)}
          fontWeight={400}
          letterSpacing="1.4"
          fill="#FFFFFF"
        >
          BUDGET DISTRIBUTION
        </text>
        <text
          x={p(L.marginX + L.contentW - 12)}
          y={p(L.budgetY + 12.6)}
          textAnchor="end"
          fontFamily={fontStack}
          fontSize={p(7.4)}
          fontWeight={400}
          letterSpacing="1.1"
          fill="#FDCB33"
        >
          TOTAL  ·  {formatCurrency(vm.summary.totalAmount)}
        </text>

        {/* Pie Slices */}
        {vm.summary.slices
          .filter((s) => s.endDeg - s.startDeg > 0.2)
          .map((s) => (
            <path
              key={s.key}
              d={pieSliceBezierPath(L.pieCx, L.pieCy, vm.pieR, s.startDeg, s.endDeg, S)}
              fill={s.colorHex}
              stroke="#FFFFFF"
              strokeWidth={p(strokes.pieGap)}
              strokeLinejoin="round"
            />
          ))}

        {/* Architectural Callouts */}
        {vm.callouts.map((c) => (
          <g key={c.key}>
            <path
              d={c.leaderPath(S)}
              fill="none"
              stroke="#000000"
              strokeWidth={p(strokes.leader)}
              strokeLinecap="round"
            />
            <text
              x={p(c.centerTextX)}
              y={p(c.labelY)}
              textAnchor="middle"
              fontFamily={fontStack}
              fontSize={p(7.2)}
              fontWeight={400}
              letterSpacing="0.9"
              fill="#000000"
            >
              {c.label}
            </text>
            <text
              x={p(c.centerTextX)}
              y={p(c.pctY)}
              textAnchor="middle"
              fontFamily={fontStack}
              fontSize={p(7.8)}
              fontWeight={400}
              letterSpacing="0.7"
              fill="#000000"
            >
              {c.percentText}
            </text>
          </g>
        ))}

        {/* Optional Symmetrical Left Total Card + Right Google Drive Folder QR */}
        {vm.hasDriveQr && qrDataUri && (
          <g>
            <rect
              x={p(46)}
              y={p(252)}
              width={p(92)}
              height={p(38)}
              rx={p(L.rCad)}
              ry={p(L.rCad)}
              fill="#FFFFFF"
              stroke="none"
            />
            <path
              d={roundedRectPathPt(46, 252, 92, 15, L.rCad, L.rCad, 0, 0, S)}
              fill="#CBCBCB"
              stroke="none"
            />
            <line
              x1={p(46)}
              y1={p(267)}
              x2={p(138)}
              y2={p(267)}
              stroke="#000000"
              strokeWidth={p(strokes.divider)}
            />
            <text
              x={p(92)}
              y={p(262.2)}
              textAnchor="middle"
              fontFamily={fontStack}
              fontSize={p(6.0)}
              fontWeight={400}
              letterSpacing="1.0"
              fill="#000000"
            >
              PROJECT TOTAL
            </text>
            <text
              x={p(92)}
              y={p(281.5)}
              textAnchor="middle"
              fontFamily={fontStack}
              fontSize={p(8.2)}
              fontWeight={400}
              letterSpacing="0.5"
              fill="#000000"
            >
              {formatCurrency(vm.summary.totalAmount)}
            </text>
            <rect
              x={p(46)}
              y={p(252)}
              width={p(92)}
              height={p(38)}
              rx={p(L.rCad)}
              ry={p(L.rCad)}
              fill="none"
              stroke="#000000"
              strokeWidth={p(strokes.card)}
            />

            <image
              x={p(528 - 28)}
              y={p(236)}
              width={p(56)}
              height={p(56)}
              href={qrDataUri}
            />
            <text
              x={p(528)}
              y={p(303)}
              textAnchor="middle"
              fontFamily={fontStack}
              fontSize={p(5.8)}
              fontWeight={400}
              letterSpacing="0.9"
              fill="#000000"
            >
              PROJECT DRIVE FILES
            </text>
            {vm.clippedFolder && (
              <text
                x={p(528)}
                y={p(312)}
                textAnchor="middle"
                fontFamily={fontStack}
                fontSize={p(5.3)}
                fontWeight={300}
                letterSpacing="0.5"
                fill="#000000"
              >
                {vm.clippedFolder}
              </text>
            )}
          </g>
        )}

        <rect
          x={p(L.marginX)}
          y={p(L.budgetY)}
          width={p(L.contentW)}
          height={p(budgetTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="none"
          stroke="#000000"
          strokeWidth={p(strokes.card)}
        />
      </g>

      {/* Sections 03-06: Four Unified Color-Coded Pillar Cards */}
      {vm.pillarCards.map((card) => {
        const bodyTopY = card.topY + card.barH;
        const lineStartY =
          bodyTopY +
          (card.descLines.length === 1
            ? card.bodyH / 2 + 2.6
            : card.descLines.length === 2
            ? card.bodyH / 2 - 3.2
            : 14);
        return (
          <g key={card.slice.key}>
            <rect
              x={p(L.marginX)}
              y={p(card.topY)}
              width={p(L.contentW)}
              height={p(card.totalH)}
              rx={p(L.rCad)}
              ry={p(L.rCad)}
              fill="#FFFFFF"
              stroke="none"
            />
            <path
              d={roundedRectPathPt(
                L.marginX,
                card.topY,
                L.contentW,
                card.barH,
                L.rCad,
                L.rCad,
                0,
                0,
                S
              )}
              fill={card.slice.colorHex}
              stroke="none"
            />
            <line
              x1={p(L.marginX)}
              y1={p(bodyTopY)}
              x2={p(L.marginX + L.contentW)}
              y2={p(bodyTopY)}
              stroke="#000000"
              strokeWidth={p(strokes.divider)}
            />
            <text
              x={p(L.marginX + 12)}
              y={p(card.topY + 12.6)}
              fontFamily={fontStack}
              fontSize={p(7.5)}
              fontWeight={400}
              letterSpacing="1.2"
              fill="#000000"
            >
              {card.slice.label}
            </text>
            <text
              x={p(L.marginX + L.contentW - 12)}
              y={p(card.topY + 12.6)}
              textAnchor="end"
              fontFamily={fontStack}
              fontSize={p(7.5)}
              fontWeight={400}
              letterSpacing="1.0"
              fill="#000000"
            >
              {card.rightMeta}
            </text>
            {card.descLines.map((line, idx) => (
              <text
                key={idx}
                x={p(L.marginX + 12)}
                y={p(lineStartY + idx * 11.4)}
                fontFamily={fontStack}
                fontSize={p(7.4)}
                fontWeight={300}
                letterSpacing="0.35"
                fill="#000000"
              >
                {line}
              </text>
            ))}
            <rect
              x={p(L.marginX)}
              y={p(card.topY)}
              width={p(L.contentW)}
              height={p(card.totalH)}
              rx={p(L.rCad)}
              ry={p(L.rCad)}
              fill="none"
              stroke="#000000"
              strokeWidth={p(strokes.card)}
            />
          </g>
        );
      })}

      {/* Integrated Bottom 3-Zone Payment Footer */}
      <g>
        <line
          x1={p(L.marginX)}
          y1={p(L.footerRuleY)}
          x2={p(L.marginX + L.contentW)}
          y2={p(L.footerRuleY)}
          stroke="#000000"
          strokeWidth={p(strokes.footerRule)}
        />

        {/* Left Unified Final Payment Card */}
        <rect
          x={p(L.marginX)}
          y={p(L.footerY)}
          width={p(L.footerCardW)}
          height={p(footerTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="#FFFFFF"
          stroke="none"
        />
        <path
          d={roundedRectPathPt(
            L.marginX,
            L.footerY,
            L.footerCardW,
            L.footerBarH,
            L.rCad,
            L.rCad,
            0,
            0,
            S
          )}
          fill="#000000"
          stroke="none"
        />
        <text
          x={p(L.marginX + L.footerCardW / 2)}
          y={p(L.footerY + 12.4)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(7.3)}
          fontWeight={400}
          letterSpacing="1.3"
          fill="#FFFFFF"
        >
          FINAL PAYMENT
        </text>
        <text
          x={p(L.marginX + L.footerCardW / 2)}
          y={p(L.footerY + L.footerBarH + 16.5)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(7.3)}
          fontWeight={300}
          letterSpacing="0.4"
          fill="#000000"
        >
          {vm.equationLine}
        </text>
        <path
          d={roundedRectPathPt(
            L.marginX,
            L.footerY + L.footerBarH + L.footerMidH,
            L.footerCardW,
            L.footerBotH,
            0,
            0,
            L.rCad,
            L.rCad,
            S
          )}
          fill="#CBCBCB"
          stroke="none"
        />
        <line
          x1={p(L.marginX)}
          y1={p(L.footerY + L.footerBarH + L.footerMidH)}
          x2={p(L.marginX + L.footerCardW)}
          y2={p(L.footerY + L.footerBarH + L.footerMidH)}
          stroke="#000000"
          strokeWidth={p(strokes.divider)}
        />
        <text
          x={p(L.marginX + L.footerCardW / 2)}
          y={p(L.footerY + L.footerBarH + L.footerMidH + 17.5)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(8.8)}
          fontWeight={400}
          letterSpacing="0.8"
          fill="#000000"
        >
          {vm.resultLine}
        </text>
        <rect
          x={p(L.marginX)}
          y={p(L.footerY)}
          width={p(L.footerCardW)}
          height={p(footerTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="none"
          stroke="#000000"
          strokeWidth={p(strokes.card)}
        />

        {/* Center 4-Icon Mark + Page Badge */}
        <image
          x={p(iconsX)}
          y={p(L.footerY + 10)}
          width={p(iconsW)}
          height={p(L.iconsH)}
          preserveAspectRatio="xMidYMid meet"
          href="/assets/aistudio/LOGO_4_IMAGES.png"
        />
        <rect
          x={p(L.centerX - L.pageBadgeW / 2)}
          y={p(L.pageBadgeY)}
          width={p(L.pageBadgeW)}
          height={p(L.pageBadgeH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="#000000"
          stroke="none"
        />
        <text
          x={p(L.centerX)}
          y={p(L.pageBadgeY + 16.2)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(7.6)}
          fontWeight={400}
          letterSpacing="1.4"
          fill="#FFFFFF"
        >
          {vm.pageBadgeText}
        </text>

        {/* Right Unified Deposit Required Card */}
        <rect
          x={p(rightFooterX)}
          y={p(L.footerY)}
          width={p(L.footerCardW)}
          height={p(footerTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="#FFFFFF"
          stroke="none"
        />
        <path
          d={roundedRectPathPt(
            rightFooterX,
            L.footerY,
            L.footerCardW,
            L.footerBarH,
            L.rCad,
            L.rCad,
            0,
            0,
            S
          )}
          fill="#000000"
          stroke="none"
        />
        <text
          x={p(rightFooterX + L.footerCardW / 2)}
          y={p(L.footerY + 12.4)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(7.3)}
          fontWeight={400}
          letterSpacing="1.3"
          fill="#FFFFFF"
        >
          DEPOSIT REQUIRED
        </text>
        <text
          x={p(rightFooterX + L.footerCardW / 2)}
          y={p(L.footerY + L.footerBarH + 16.8)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(8.6)}
          fontWeight={400}
          letterSpacing="0.6"
          fill="#000000"
        >
          {formatCurrency(vm.summary.depositAmount)}
        </text>
        <path
          d={roundedRectPathPt(
            rightFooterX,
            L.footerY + L.footerBarH + L.footerMidH,
            L.footerCardW,
            L.footerBotH,
            0,
            0,
            L.rCad,
            L.rCad,
            S
          )}
          fill="#FDCB33"
          stroke="none"
        />
        <line
          x1={p(rightFooterX)}
          y1={p(L.footerY + L.footerBarH + L.footerMidH)}
          x2={p(rightFooterX + L.footerCardW)}
          y2={p(L.footerY + L.footerBarH + L.footerMidH)}
          stroke="#000000"
          strokeWidth={p(strokes.divider)}
        />
        <text
          x={p(rightFooterX + L.footerCardW / 2)}
          y={p(L.footerY + L.footerBarH + L.footerMidH + 17.5)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(8.0)}
          fontWeight={400}
          letterSpacing="1.3"
          fill="#000000"
        >
          {data.depositStatus}
        </text>
        <rect
          x={p(rightFooterX)}
          y={p(L.footerY)}
          width={p(L.footerCardW)}
          height={p(footerTotalH)}
          rx={p(L.rCad)}
          ry={p(L.rCad)}
          fill="none"
          stroke="#000000"
          strokeWidth={p(strokes.card)}
        />

        {/* Bottom Studio Contact Footnote */}
        <text
          x={p(L.centerX)}
          y={p(L.contactLineY)}
          textAnchor="middle"
          fontFamily={fontStack}
          fontSize={p(6.4)}
          fontWeight={300}
          letterSpacing="1.4"
          fill="#000000"
        >
          {vm.contactFooterText}
        </text>
      </g>
    </svg>
  );
};
