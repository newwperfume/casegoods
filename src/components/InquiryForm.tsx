import React, { useState, useRef } from 'react';
import { MessageSquare, Mail, Copy, Check, Upload, X, FileText } from 'lucide-react';

interface AttachedFile {
  name: string;
  size: string;
  type: string;
  previewUrl?: string;
}

export const InquiryForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    projectType: 'CUSTOM FURNITURE',
    location: '',
    timeline: '',
    referenceLink: '',
    details: '',
  });

  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [submitState, setSubmitState] = useState<'idle' | 'modal'>('idle');
  const [submitMode, setSubmitMode] = useState<'sms' | 'email'>('sms');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Exact Studio Owner Contact Details from Uploaded Business Card
  const OWNER_PHONE = '+14028308782';
  const OWNER_PHONE_DISPLAY = '402-830-8782';
  const OWNER_EMAIL = 'josh@casegoodsomaha.com';

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = Array.from(files).map((file) => {
      const isImage = file.type.startsWith('image/');
      return {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || 'document',
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      };
    });

    setAttachments((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const formatSummary = () => {
    const attachmentNames =
      attachments.length > 0
        ? attachments.map((a) => `${a.name} (${a.size})`).join(', ')
        : 'None attached';

    return `CASEGOODS COMMISSION INQUIRY
Name: ${formData.name || 'Not provided'}
Contact: ${formData.contact || 'Not provided'}
Project Type: ${formData.projectType}
Timeline & Location: ${formData.timeline || 'Flexible'} / ${formData.location || 'Omaha, NE'}
Reference Photos / Sketches: ${attachmentNames}${
      formData.referenceLink ? `\nInspiration / Plan Link: ${formData.referenceLink}` : ''
    }
Details: ${formData.details || 'Custom woodworking commission'}`;
  };

  const handleSubmit = (e: React.FormEvent, mode: 'sms' | 'email') => {
    e.preventDefault();
    setSubmitMode(mode);
    const summary = formatSummary();

    if (mode === 'sms') {
      const smsUri = `sms:${OWNER_PHONE}?&body=${encodeURIComponent(summary)}`;
      window.location.href = smsUri;
    } else {
      const subject = `Commission Inquiry: ${formData.projectType} — ${formData.name}`;
      const mailUri = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
      window.location.href = mailUri;
    }

    setSubmitState('modal');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formatSummary());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section id="inquire" className="mb-12 scroll-mt-24">
      {/* Pitch Black Section Bar (ALL CAPS) */}
      <div className="w-full bg-black text-white text-[0.82rem] sm:text-[0.88rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-normal mb-3.5 select-none">
        COMMISSION A BUILD / PROJECT INQUIRY
      </div>

      {/* 1px Black Outlined Subtitle Box — Trimmed, Centered, Wide Horizontal Margins */}
      <div className="w-full bg-white text-black px-8 sm:px-16 py-6 sm:py-8 rounded-[9px] border border-black mb-8 text-center">
        <p className="max-w-2xl mx-auto text-[0.94rem] sm:text-[1.02rem] font-light leading-relaxed tracking-[0.02em] text-black/85">
          Have a custom piece or architectural build in mind? Share a few details below to text{' '}
          <span className="font-normal text-black">{OWNER_PHONE_DISPLAY}</span> or email{' '}
          <span className="font-normal text-black">{OWNER_EMAIL}</span> directly.
        </p>
      </div>

      {/* Form Container (Invoice Table Layout Style with Semantic Labels & Spacious Inputs) */}
      <form onSubmit={(e) => handleSubmit(e, submitMode)} className="space-y-5">
        {/* Row 1: Name, Contact, Project Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Field: Name */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="inquiry-name"
              className="block bg-[#CBCBCB] text-black text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
            >
              YOUR NAME
            </label>
            <input
              id="inquiry-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="First & last name"
              className="w-full h-[50px] bg-white text-black text-[0.92rem] px-5 py-3.5 rounded-[9px] border border-[#CBCBCB] font-light tracking-[0.015em] focus:outline-none focus:ring-1 focus:ring-[#EF6922] focus:border-[#EF6922] transition-all placeholder:text-black/40"
            />
          </div>

          {/* Field: Phone or Email */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="inquiry-contact"
              className="block bg-[#CBCBCB] text-black text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
            >
              PHONE OR EMAIL
            </label>
            <input
              id="inquiry-contact"
              type="text"
              required
              value={formData.contact}
              onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              placeholder="Best way to reach you"
              className="w-full h-[50px] bg-white text-black text-[0.92rem] px-5 py-3.5 rounded-[9px] border border-[#CBCBCB] font-light tracking-[0.015em] focus:outline-none focus:ring-1 focus:ring-[#EF6922] focus:border-[#EF6922] transition-all placeholder:text-black/40"
            />
          </div>

          {/* Field: Project Category */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="inquiry-category"
              className="block bg-[#CBCBCB] text-black text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
            >
              PROJECT CATEGORY
            </label>
            <select
              id="inquiry-category"
              value={formData.projectType}
              onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
              className="w-full h-[50px] bg-white text-black text-[0.92rem] px-5 py-0 rounded-[9px] border border-[#CBCBCB] font-light tracking-[0.015em] focus:outline-none focus:ring-1 focus:ring-[#EF6922] focus:border-[#EF6922] transition-all cursor-pointer"
            >
              <option value="Custom Furniture">Custom Furniture</option>
              <option value="Architectural Built-In / Cabinetry">Architectural Built-In / Cabinetry</option>
              <option value="Commercial Millwork">Commercial Millwork</option>
              <option value="Architect / Designer Submittal">Architect / Designer Submittal</option>
              <option value="One-of-a-Kind Design Challenge">One-of-a-Kind Design Challenge</option>
            </select>
          </div>
        </div>

        {/* Row 2: Timeline & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="inquiry-location"
              className="block bg-[#CBCBCB] text-black text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
            >
              LOCATION
            </label>
            <input
              id="inquiry-location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Omaha, NE or surrounding area"
              className="w-full bg-white text-black text-[0.92rem] px-5 py-3.5 rounded-[9px] border border-[#CBCBCB] font-light tracking-[0.015em] focus:outline-none focus:ring-1 focus:ring-[#EF6922] focus:border-[#EF6922] transition-all placeholder:text-black/40"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="inquiry-timeline"
              className="block bg-[#CBCBCB] text-black text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
            >
              TARGET TIMELINE
            </label>
            <input
              id="inquiry-timeline"
              type="text"
              value={formData.timeline}
              onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
              placeholder="e.g., Next 1–3 months or flexible"
              className="w-full bg-white text-black text-[0.92rem] px-5 py-3.5 rounded-[9px] border border-[#CBCBCB] font-light tracking-[0.015em] focus:outline-none focus:ring-1 focus:ring-[#EF6922] focus:border-[#EF6922] transition-all placeholder:text-black/40"
            />
          </div>
        </div>

        {/* Row 3: Reference Photo / Sketch / Floor Plan Attachment + Link */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Upload Reference Photo / Sketch / CAD File */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="inquiry-attachments"
              className="block bg-[#27AAE0] text-white text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
            >
              SPACE PHOTOS, SKETCHES OR PLANS (OPTIONAL)
            </label>

            <div className="w-full bg-white text-black p-4 rounded-[9px] border border-[#27AAE0] flex flex-col gap-2.5">
              <input
                id="inquiry-attachments"
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
                className="w-full py-2.5 px-5 rounded-[7px] border border-dashed border-black/35 hover:border-[#EF6922] hover:bg-[#EF6922]/5 text-[0.86rem] text-black/80 flex items-center justify-center gap-2 transition-all cursor-pointer font-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
              >
                <Upload className="w-4 h-4 text-[#EF6922]" />
                <span>Attach photos, sketches, or PDF plans</span>
              </button>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {attachments.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-2 bg-[#FAFAFA] border border-black/20 rounded-[6px] px-3 py-1.5 text-[0.78rem] font-light"
                    >
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="w-6 h-6 rounded-[4px] object-cover border border-black/15"
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-[#27AAE0]" />
                      )}
                      <span className="max-w-[160px] truncate">{file.name}</span>
                      <span className="text-black/75">({file.size})</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-black/75 hover:text-black cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional Pinterest / iCloud / Google Drive Link */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="inquiry-reference-link"
              className="block bg-[#27AAE0] text-white text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
            >
              INSPIRATION OR SHARED FOLDER LINK (OPTIONAL)
            </label>
            <input
              id="inquiry-reference-link"
              type="url"
              value={formData.referenceLink}
              onChange={(e) => setFormData({ ...formData, referenceLink: e.target.value })}
              placeholder="Pinterest, iCloud photo link, or Google Drive..."
              className="w-full h-full min-h-[62px] bg-white text-black text-[0.90rem] px-5 py-3.5 rounded-[9px] border border-[#27AAE0] font-light tracking-[0.015em] focus:outline-none focus:ring-1 focus:ring-[#EF6922] focus:border-[#EF6922] transition-all placeholder:text-black/40"
            />
          </div>
        </div>

        {/* Row 4: Project Explanation Textarea */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="inquiry-details"
            className="block bg-[#EF6922] text-white text-[0.75rem] tracking-cad uppercase py-2.5 px-4 rounded-[9px] text-center font-medium cursor-pointer select-none"
          >
            BRIEF PROJECT EXPLANATION
          </label>
          <textarea
            id="inquiry-details"
            required
            rows={4}
            value={formData.details}
            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            placeholder="Tell me briefly about the piece, room dimensions, or idea you have in mind..."
            className="w-full bg-white text-black text-[0.94rem] px-6 py-4 rounded-[9px] border border-[#EF6922] font-light tracking-[0.015em] focus:outline-none focus:ring-1 focus:ring-[#EF6922] focus:border-[#EF6922] transition-all resize-y placeholder:text-black/40 leading-relaxed"
          />
        </div>

        {/* Row 5: Dual Submission Triggers (SMS Text + Email with AAA Contrast on Yellow) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'sms')}
            className="w-full bg-[#FDCB33] text-black text-[0.80rem] tracking-cad uppercase py-3.5 px-6 rounded-[9px] border border-[#FDCB33] hover:bg-[#FDCB33]/90 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>TEXT JOSH ({OWNER_PHONE_DISPLAY})</span>
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'email')}
            className="w-full bg-[#FDCB33] text-black text-[0.80rem] tracking-cad uppercase py-3.5 px-6 rounded-[9px] border border-[#FDCB33] hover:bg-[#FDCB33]/90 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
          >
            <Mail className="w-4 h-4" />
            <span>EMAIL ({OWNER_EMAIL})</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {submitState === 'modal' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
          onClick={() => setSubmitState('idle')}
        >
          <div
            className="relative w-full max-w-lg bg-white border border-black rounded-[10px] p-7 shadow-2xl flex flex-col gap-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black pb-3">
              <span className="text-[0.78rem] tracking-cad uppercase font-medium text-[#EF6922]">
                COMMISSION INQUIRY READY
              </span>
              <button
                onClick={() => setSubmitState('idle')}
                className="text-[0.74rem] text-black/75 hover:text-black uppercase tracking-wider cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
              >
                [CLOSE]
              </button>
            </div>

            <p className="text-[0.92rem] text-black/85 leading-relaxed font-light">
              Your inquiry for Josh Heinke ({OWNER_PHONE_DISPLAY} / {OWNER_EMAIL}) has been formatted.
              {attachments.length > 0
                ? ' Remember to attach your selected photo or sketch files in the opened text or email window.'
                : ` Your default ${submitMode === 'sms' ? 'messaging app (SMS)' : 'email client'} was opened.`}
            </p>

            {/* Formatted Code Block */}
            <div className="bg-[#F8F9FA] border border-black/20 rounded-[8px] p-4 text-[0.78rem] font-mono whitespace-pre-wrap text-black select-all">
              {formatSummary()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 py-2 px-3.5 rounded-[6px] border border-black text-[0.74rem] tracking-cad uppercase hover:bg-black hover:text-white transition-all cursor-pointer font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF6922]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY SUMMARY'}</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={`sms:${OWNER_PHONE}?&body=${encodeURIComponent(formatSummary())}`}
                  className="py-2 px-3.5 rounded-[6px] bg-[#EF6922] text-white text-[0.74rem] tracking-cad uppercase hover:bg-[#EF6922]/90 transition-all font-medium"
                >
                  OPEN SMS ({OWNER_PHONE_DISPLAY})
                </a>
                <a
                  href={`mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(
                    `Commission Inquiry: ${formData.projectType}`
                  )}&body=${encodeURIComponent(formatSummary())}`}
                  className="py-2 px-3.5 rounded-[6px] bg-[#27AAE0] text-white text-[0.74rem] tracking-cad uppercase hover:bg-[#27AAE0]/90 transition-all font-medium"
                >
                  OPEN EMAIL
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
