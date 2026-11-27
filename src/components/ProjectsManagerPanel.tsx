import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Upload,
  Check,
  X,
  Image as ImageIcon,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  PILLAR_PRESETS,
  type PortfolioCategoryTag,
  type PortfolioProject,
} from '../data/defaultProjects.ts';
import type { ProjectImage } from './CadModal.tsx';

interface ProjectFormState {
  dbId?: number;
  slug?: string;
  code: string;
  title: string;
  recipient: string;
  category: string;
  categoryTag: PortfolioCategoryTag;
  pillarBg: string;
  pillarCode: string;
  tolerance: string;
  materials: string;
  dimensions: string;
  description: string;
  images: ProjectImage[];
  specs: { label: string; value: string }[];
  published: boolean;
}

const EMPTY_PROJECT_FORM: ProjectFormState = {
  code: '',
  title: '',
  recipient: '',
  category: 'ARCHITECTURAL BUILT-IN',
  categoryTag: 'architectural',
  pillarBg: 'bg-[#EF6922]',
  pillarCode: 'PILLAR 01 / ARCHITECTURAL MILLWORK',
  tolerance: 'FINISHED BUILD · ± 1/32"',
  materials: '',
  dimensions: '',
  description: '',
  images: [],
  specs: [
    { label: 'PRIMARY HARDWOODS', value: '' },
    { label: 'FINISH', value: '' },
    { label: 'JOINERY & HARDWARE', value: '' },
  ],
  published: true,
};

function inferImageTypeFromName(filename: string): 'render' | 'cad' | 'photo' {
  const lower = filename.toLowerCase();
  if (/(cad|dwg|elev|section|plan|drawing|blueprint|ortho)/.test(lower)) return 'cad';
  if (/(render|3d|rhino|vray|keyshot)/.test(lower)) return 'render';
  return 'photo';
}

function cleanCaptionFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Unable to initialize image compressor.'));
          return;
        }

        // Fill crisp white background so transparent PNG CAD drawings render cleanly
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const isSmallPng = file.type === 'image/png' && file.size <= 650 * 1024;
        const dataUrl = isSmallPng
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', 0.84);

        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Unable to read image file: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

export const ProjectsManagerPanel: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const authFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      if (!user) throw new Error('Not signed in.');
      const token = await user.getIdToken();
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    },
    [user]
  );

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authFetch('/api/admin/projects');
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load portfolio projects.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const openNewProjectForm = () => {
    setError(null);
    setConfirmDeleteId(null);
    setForm({
      ...EMPTY_PROJECT_FORM,
      specs: [
        { label: 'PRIMARY HARDWOODS', value: '' },
        { label: 'FINISH', value: '' },
        { label: 'JOINERY & HARDWARE', value: '' },
      ],
      images: [],
    });
    setMode('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditProjectForm = (project: PortfolioProject) => {
    setError(null);
    setConfirmDeleteId(null);
    setForm({
      dbId: project.dbId,
      slug: project.id,
      code: project.code,
      title: project.title,
      recipient: project.recipient || '',
      category: project.category,
      categoryTag: project.categoryTag,
      pillarBg: project.pillarBg,
      pillarCode: project.pillarCode,
      tolerance: project.tolerance,
      materials: project.materials,
      dimensions: project.dimensions,
      description: project.description,
      images: project.images.map((img) => ({ ...img })),
      specs:
        project.specs.length > 0
          ? project.specs.map((s) => ({ ...s }))
          : [{ label: 'PRIMARY HARDWOODS', value: '' }],
      published: project.published !== false,
    });
    setMode('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectPillar = (preset: (typeof PILLAR_PRESETS)[number]) => {
    setForm((prev) => ({
      ...prev,
      pillarBg: preset.pillarBg,
      pillarCode: preset.pillarCode,
      categoryTag: preset.categoryTag,
      category: prev.category.trim() ? prev.category : preset.defaultCategory,
    }));
  };

  const handleFilesSelected = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      setError('Please select JPG, PNG, or WebP image files.');
      return;
    }

    setError(null);
    setUploadingCount(imageFiles.length);

    try {
      const startIndex = form.images.length;
      const newSheets: ProjectImage[] = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const dataUrl = await compressImageFileToDataUrl(file);
        const type = inferImageTypeFromName(file.name);
        const sheetNum = String(startIndex + i + 1).padStart(2, '0');
        const caption = cleanCaptionFromFilename(file.name) || `Project view ${sheetNum}`;
        newSheets.push({
          src: dataUrl,
          sheetNumber: type === 'cad' ? `CAD ${sheetNum}` : type === 'photo' ? `PHOTO ${sheetNum}` : `SHEET ${sheetNum}`,
          label: caption,
          alt: `${form.title || 'Casegoods project'} — ${caption}`,
          type,
        });
      }

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...newSheets],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process selected images.');
    } finally {
      setUploadingCount(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const moveSheet = (index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.images.length) return prev;
      const next = [...prev.images];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, images: next };
    });
  };

  const updateSheet = (index: number, patch: Partial<ProjectImage>) => {
    setForm((prev) => {
      const next = [...prev.images];
      next[index] = {
        ...next[index],
        ...patch,
        alt:
          patch.label !== undefined
            ? `${prev.title || 'Casegoods project'} — ${patch.label}`
            : next[index].alt,
      };
      return { ...prev, images: next };
    });
  };

  const removeSheet = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const updateSpec = (index: number, field: 'label' | 'value', val: string) => {
    setForm((prev) => {
      const next = [...prev.specs];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, specs: next };
    });
  };

  const addSpecRow = () => {
    setForm((prev) => ({
      ...prev,
      specs: [...prev.specs, { label: '', value: '' }],
    }));
  };

  const removeSpecRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.filter((_, i) => i !== index),
    }));
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.code.trim()) {
      setError('Please enter both a Job / DWG Code and a Project Title.');
      return;
    }

    if (form.images.length === 0) {
      setError('Please upload at least one photo, 3D render, or 2D CAD sheet.');
      return;
    }

    setSaving(true);
    try {
      const cleanedSpecs = form.specs
        .map((s) => ({ label: s.label.trim().toUpperCase(), value: s.value.trim() }))
        .filter((s) => s.label || s.value);

      const cleanedImages = form.images.map((img, idx) => ({
        ...img,
        sheetNumber: img.sheetNumber.trim().toUpperCase() || `SHEET ${String(idx + 1).padStart(2, '0')}`,
        label: img.label.trim() || `${form.title.trim()} — View ${idx + 1}`,
        alt: img.alt.trim() || `${form.title.trim()} — ${img.label.trim() || `View ${idx + 1}`}`,
      }));

      const payload = {
        code: form.code.trim().toUpperCase(),
        title: form.title.trim().toUpperCase(),
        recipient: form.recipient.trim().toUpperCase(),
        category: form.category.trim().toUpperCase() || 'ARCHITECTURAL BUILT-IN',
        categoryTag: form.categoryTag,
        pillarBg: form.pillarBg,
        pillarCode: form.pillarCode,
        tolerance: form.tolerance.trim().toUpperCase() || 'FINISHED BUILD',
        materials: form.materials.trim().toUpperCase(),
        dimensions: form.dimensions.trim().toUpperCase(),
        description: form.description.trim(),
        images: cleanedImages,
        specs: cleanedSpecs,
        published: form.published,
      };

      if (form.dbId) {
        const res = await authFetch(`/api/admin/projects/${form.dbId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setProjects((prev) =>
          prev.map((p) => (p.dbId === form.dbId ? (res.project as PortfolioProject) : p))
        );
        showToast(`SAVED UPDATES TO ${payload.code} — ${payload.title}`);
      } else {
        const res = await authFetch('/api/admin/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setProjects((prev) => [...prev, res.project as PortfolioProject]);
        showToast(
          payload.published
            ? `PUBLISHED ${payload.code} LIVE ON 02 / SELECTED WORK`
            : `SAVED DRAFT ${payload.code}`
        );
      }

      setMode('list');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save project.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (project: PortfolioProject) => {
    if (!project.dbId) return;
    setError(null);
    const nextPublished = project.published === false;
    try {
      const res = await authFetch(`/api/admin/projects/${project.dbId}`, {
        method: 'PUT',
        body: JSON.stringify({ published: nextPublished }),
      });
      setProjects((prev) =>
        prev.map((p) => (p.dbId === project.dbId ? (res.project as PortfolioProject) : p))
      );
      showToast(
        nextPublished
          ? `${project.code} IS NOW LIVE ON PUBLIC PORTFOLIO`
          : `${project.code} MOVED TO DRAFT (HIDDEN FROM PUBLIC SITE)`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update visibility.');
    }
  };

  const handleDeleteProject = async (dbId: number, code: string) => {
    setError(null);
    try {
      await authFetch(`/api/admin/projects/${dbId}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.dbId !== dbId));
      setConfirmDeleteId(null);
      showToast(`DELETED PROJECT ${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete project.');
    }
  };

  const handleMoveProject = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= projects.length || reordering) return;

    const reordered = [...projects];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    setProjects(reordered);

    const orderedIds = reordered
      .map((p) => p.dbId)
      .filter((id): id is number => typeof id === 'number');

    setReordering(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/projects/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds }),
      });
      if (Array.isArray(res.projects)) {
        setProjects(res.projects);
      }
      showToast('PORTFOLIO ORDER UPDATED ON LIVE SITE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save new project order.');
      await loadProjects();
    } finally {
      setReordering(false);
    }
  };

  const publishedCount = projects.filter((p) => p.published !== false).length;

  return (
    <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Top Studio Banner */}
      <div className="bg-[#FDCB33] text-black border-[1.5px] border-black rounded-[9px] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Layers className="w-4 h-4 shrink-0" />
          <span className="text-[0.76rem] sm:text-[0.82rem] tracking-cad uppercase font-medium">
            {mode === 'list'
              ? `PORTFOLIO MANAGER — ${publishedCount} LIVE · ${projects.length} TOTAL`
              : form.dbId
              ? `EDITING PROJECT — ${form.code || 'UNTITLED'}`
              : 'NEW PORTFOLIO PROJECT'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'list' ? (
            <>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-[9px] border border-black bg-white hover:bg-[#CBCBCB] text-black text-[0.66rem] tracking-cad uppercase font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>VIEW LIVE SITE</span>
              </a>
              <button
                type="button"
                onClick={openNewProjectForm}
                className="px-3.5 py-1.5 rounded-[9px] border border-black bg-[#EF6922] hover:bg-black text-black hover:text-white text-[0.68rem] tracking-cad uppercase font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD NEW PROJECT</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('list');
                setError(null);
              }}
              className="px-3.5 py-1.5 rounded-[9px] border border-black bg-white hover:bg-[#CBCBCB] text-black text-[0.68rem] tracking-cad uppercase font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>BACK TO ALL PROJECTS</span>
            </button>
          )}
        </div>
      </div>

      {/* Status & Error Banners */}
      {statusBanner && (
        <div className="bg-[#27AAE0]/20 border-[1.5px] border-black rounded-[9px] px-4 py-2.5 flex items-center justify-between gap-3 text-[0.74rem] tracking-cad uppercase font-medium">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 hover:bg-black/10 rounded cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-[#EF6922]/20 border-[1.5px] border-[#EF6922] rounded-[9px] px-4 py-2.5 flex items-center justify-between gap-3 text-[0.78rem] text-black">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="p-1 hover:bg-black/10 rounded cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =====================================================================
          MODE 1: PROJECT LIST VIEW
      ===================================================================== */}
      {mode === 'list' && (
        <div className="space-y-4">
          {loading ? (
            <div className="border-[1.5px] border-black rounded-[9px] bg-white p-10 text-center text-[0.76rem] tracking-cad uppercase text-black/70">
              LOADING PORTFOLIO PROJECTS...
            </div>
          ) : projects.length === 0 ? (
            <div className="border-[1.5px] border-black rounded-[9px] bg-white p-10 text-center space-y-4">
              <p className="text-[0.86rem] text-black/75">
                No portfolio projects yet. Add your first build to publish it live to 02 / SELECTED WORK.
              </p>
              <button
                type="button"
                onClick={openNewProjectForm}
                className="px-5 py-2.5 rounded-[9px] border-[1.5px] border-black bg-[#EF6922] hover:bg-black text-black hover:text-white text-[0.72rem] tracking-cad uppercase font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ADD FIRST PROJECT</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {projects.map((project, idx) => {
                const cover = project.images[0];
                const isPublished = project.published !== false;
                const isDeletingThis = confirmDeleteId === project.dbId;

                return (
                  <div
                    key={project.dbId ?? project.id}
                    className="border-[1.5px] border-black rounded-[9px] bg-white overflow-hidden"
                  >
                    {/* Pillar Strip */}
                    <div
                      className={`${project.pillarBg} text-black border-b border-black px-4 py-2 flex flex-wrap items-center justify-between gap-2`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[0.72rem] tracking-cad uppercase font-medium">
                        <span>#{String(idx + 1).padStart(2, '0')}</span>
                        <span>·</span>
                        <span>DWG {project.code}</span>
                        <span>—</span>
                        <span>{project.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-[6px] border border-black text-[0.62rem] tracking-cad uppercase font-medium ${
                            isPublished ? 'bg-white text-black' : 'bg-[#CBCBCB] text-black'
                          }`}
                        >
                          {isPublished ? 'LIVE ON SITE' : 'DRAFT / HIDDEN'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-[6px] border border-black bg-white text-black text-[0.62rem] tracking-cad uppercase">
                          {project.images.length}{' '}
                          {project.images.length === 1 ? 'SHEET' : 'SHEETS'}
                        </span>
                      </div>
                    </div>

                    {/* Row Body */}
                    <div className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4">
                      {/* Cover Thumbnail */}
                      <div className="w-full md:w-40 h-28 rounded-[9px] border border-black bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        {cover ? (
                          <img
                            src={cover.src}
                            alt={cover.alt}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-black/40" />
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex-1 min-w-0 space-y-1.5 text-left">
                        <div className="flex flex-wrap items-center gap-2 text-[0.68rem] tracking-cad uppercase text-black/75">
                          <span>{project.category}</span>
                          {project.dimensions && (
                            <>
                              <span>·</span>
                              <span>{project.dimensions}</span>
                            </>
                          )}
                        </div>
                        {project.materials && (
                          <div className="text-[0.72rem] tracking-cad uppercase font-medium text-black truncate">
                            {project.materials}
                          </div>
                        )}
                        {project.description && (
                          <p className="text-[0.84rem] font-light text-black/80 line-clamp-2 leading-relaxed">
                            {project.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="w-full md:w-auto flex flex-wrap items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-black/15">
                        {/* Reorder Up/Down */}
                        <div className="inline-flex rounded-[9px] border border-black overflow-hidden">
                          <button
                            type="button"
                            disabled={idx === 0 || reordering}
                            onClick={() => handleMoveProject(idx, -1)}
                            title="Move up in portfolio"
                            className="px-2.5 py-2 bg-white hover:bg-[#CBCBCB] disabled:opacity-35 text-black transition-colors cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === projects.length - 1 || reordering}
                            onClick={() => handleMoveProject(idx, 1)}
                            title="Move down in portfolio"
                            className="px-2.5 py-2 bg-white hover:bg-[#CBCBCB] disabled:opacity-35 text-black border-l border-black transition-colors cursor-pointer disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTogglePublished(project)}
                          className="px-3 py-2 rounded-[9px] border border-black bg-white hover:bg-[#FDCB33] text-black text-[0.66rem] tracking-cad uppercase font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={isPublished ? 'Hide from public site' : 'Publish to public site'}
                        >
                          {isPublished ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>HIDE</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>PUBLISH</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditProjectForm(project)}
                          className="px-3.5 py-2 rounded-[9px] border border-black bg-[#27AAE0] hover:bg-black text-black hover:text-white text-[0.66rem] tracking-cad uppercase font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>EDIT</span>
                        </button>

                        {project.dbId && !isDeletingThis && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(project.dbId ?? null)}
                            className="px-2.5 py-2 rounded-[9px] border border-black bg-white hover:bg-[#EF6922] text-black transition-colors cursor-pointer"
                            title="Delete project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {project.dbId && isDeletingThis && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteProject(project.dbId!, project.code)}
                              className="px-3 py-2 rounded-[9px] border border-black bg-[#EF6922] text-black text-[0.64rem] tracking-cad uppercase font-medium cursor-pointer"
                            >
                              CONFIRM DELETE
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-2 rounded-[9px] border border-black bg-white text-black text-[0.64rem] tracking-cad uppercase cursor-pointer"
                            >
                              CANCEL
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 2: ADD / EDIT PROJECT FORM
      ===================================================================== */}
      {mode === 'edit' && (
        <form onSubmit={handleSaveProject} className="space-y-5">
          {/* SECTION 01: PROJECT IDENTITY & PILLAR */}
          <div className="border-[1.5px] border-black rounded-[9px] p-4 sm:p-6 bg-white space-y-4">
            <span className="block text-[0.74rem] tracking-cad uppercase font-medium">
              01 / PROJECT IDENTITY &amp; COLOR PILLAR
            </span>

            {/* Pillar Color Selector */}
            <div>
              <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1.5">
                PORTFOLIO PILLAR COLOR &amp; SECTION
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PILLAR_PRESETS.map((preset) => {
                  const isActive = form.pillarBg === preset.pillarBg;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPillar(preset)}
                      className={`px-3.5 py-2.5 rounded-[9px] border-[1.5px] border-black text-[0.66rem] tracking-cad uppercase font-medium transition-all cursor-pointer text-left flex items-center gap-2.5 ${
                        isActive
                          ? `${preset.pillarBg} text-black`
                          : 'bg-white text-black hover:bg-[#CBCBCB]/40'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full border border-black shrink-0 ${preset.pillarBg}`}
                      />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 1: Job Code (3) + Title (6) + Client (3) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                  JOB / DWG CODE *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1075ABC"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] uppercase"
                />
              </div>

              <div className="md:col-span-6">
                <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                  PROJECT TITLE *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WALNUT MEDIA CONSOLE & FLOATING SHELVES"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] uppercase"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                  CLIENT / LOCATION (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. OMAHA, NE"
                  value={form.recipient}
                  onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] uppercase"
                />
              </div>
            </div>

            {/* Row 2: Filter Tab (4) + Dimensions (4) + Tolerance / Build Tag (4) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4">
                <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                  PORTFOLIO FILTER TAB
                </label>
                <select
                  value={form.categoryTag}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      categoryTag: e.target.value as PortfolioCategoryTag,
                    }))
                  }
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem] bg-white uppercase"
                >
                  <option value="architectural">02 / ARCHITECTURAL</option>
                  <option value="commercial">03 / WET BARS &amp; ISLANDS</option>
                  <option value="furniture">04 / HEIRLOOM &amp; CAD</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                  OVERALL DIMENSIONS
                </label>
                <input
                  type="text"
                  placeholder='e.g. 96" W × 32" H × 20" D'
                  value={form.dimensions}
                  onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))}
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] uppercase"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                  BUILD / TOLERANCE TAG
                </label>
                <input
                  type="text"
                  placeholder='e.g. FINISHED BUILD · ± 1/32"'
                  value={form.tolerance}
                  onChange={(e) => setForm((f) => ({ ...f, tolerance: e.target.value }))}
                  className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] uppercase"
                />
              </div>
            </div>

            {/* Row 3: Materials Tag */}
            <div>
              <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                MATERIALS HIGHLIGHT BAR (SEPARATE WITH ·)
              </label>
              <input
                type="text"
                placeholder="e.g. SOLID BLACK WALNUT · RIFT WHITE OAK · SOFT-CLOSE DRAWERS"
                value={form.materials}
                onChange={(e) => setForm((f) => ({ ...f, materials: e.target.value }))}
                className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.84rem] uppercase"
              />
            </div>

            {/* Row 4: Description */}
            <div>
              <label className="block text-[0.64rem] tracking-cad uppercase text-black/75 mb-1">
                PROJECT NOTES / DESCRIPTION
              </label>
              <textarea
                rows={3}
                placeholder="Describe the design, hardwoods, joinery, and finished space..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.86rem] leading-relaxed"
              />
            </div>
          </div>

          {/* SECTION 02: MULTI-IMAGE UPLOAD & SHEETS */}
          <div className="border-[1.5px] border-black rounded-[9px] p-4 sm:p-6 bg-white space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.74rem] tracking-cad uppercase font-medium">
                02 / PROJECT PHOTOS, 3D RENDERS &amp; 2D CAD SHEETS ({form.images.length})
              </span>
              <span className="text-[0.66rem] tracking-cad uppercase text-black/70">
                FIRST SHEET = COVER PHOTO · AUTO-OPTIMIZED ON UPLOAD
              </span>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesSelected(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-[1.5px] border-dashed border-black rounded-[9px] p-6 sm:p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'bg-[#27AAE0]/20' : 'bg-[#CBCBCB]/15 hover:bg-[#CBCBCB]/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <Upload className="w-6 h-6 mx-auto mb-2 text-black" />
              <div className="text-[0.76rem] tracking-cad uppercase font-medium text-black">
                {uploadingCount > 0
                  ? `OPTIMIZING ${uploadingCount} IMAGE${uploadingCount > 1 ? 'S' : ''}...`
                  : 'DROP PHOTOS, RENDERS, OR CAD DRAWINGS HERE — OR CLICK TO BROWSE'}
              </div>
              <p className="text-[0.78rem] font-light text-black/70 mt-1">
                Select multiple JPG, PNG, or WebP files at once from your computer or phone.
              </p>
            </div>

            {/* Uploaded Sheets List */}
            {form.images.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {form.images.map((sheet, idx) => (
                  <div
                    key={`${sheet.sheetNumber}-${idx}`}
                    className="border border-black rounded-[9px] overflow-hidden bg-white flex flex-col"
                  >
                    {/* Preview Stage */}
                    <div
                      className={`relative h-48 border-b border-black flex items-center justify-center overflow-hidden bg-white ${
                        sheet.type === 'cad' ? 'p-3' : ''
                      }`}
                    >
                      <img
                        src={sheet.src}
                        alt={sheet.alt}
                        className={
                          sheet.type === 'cad'
                            ? 'max-w-full max-h-full object-contain block'
                            : 'w-full h-full object-cover object-center block'
                        }
                      />

                      {idx === 0 && (
                        <span className="absolute top-2 left-2 px-2.5 py-1 rounded-[6px] border border-black bg-[#EF6922] text-black text-[0.60rem] tracking-cad uppercase font-medium">
                          COVER PHOTO
                        </span>
                      )}

                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSheet(idx, -1)}
                          title="Move sheet left"
                          className="w-7 h-7 rounded-[6px] border border-black bg-white hover:bg-[#CBCBCB] disabled:opacity-35 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === form.images.length - 1}
                          onClick={() => moveSheet(idx, 1)}
                          title="Move sheet right"
                          className="w-7 h-7 rounded-[6px] border border-black bg-white hover:bg-[#CBCBCB] disabled:opacity-35 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSheet(idx)}
                          title="Remove sheet"
                          className="w-7 h-7 rounded-[6px] border border-black bg-white hover:bg-[#EF6922] flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Sheet Metadata Inputs */}
                    <div className="p-3 space-y-2.5 bg-white">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                          <label className="block text-[0.58rem] tracking-cad uppercase text-black/70 mb-0.5">
                            SHEET TAB LABEL
                          </label>
                          <input
                            type="text"
                            value={sheet.sheetNumber}
                            onChange={(e) => updateSheet(idx, { sheetNumber: e.target.value })}
                            placeholder="SHEET 01"
                            className="w-full px-2.5 py-1.5 border border-black rounded-[7px] text-[0.74rem] uppercase"
                          />
                        </div>
                        <div className="col-span-7">
                          <label className="block text-[0.58rem] tracking-cad uppercase text-black/70 mb-0.5">
                            SHEET TYPE
                          </label>
                          <div className="grid grid-cols-3 rounded-[7px] border border-black overflow-hidden">
                            {(
                              [
                                { id: 'photo', label: 'PHOTO' },
                                { id: 'render', label: '3D' },
                                { id: 'cad', label: '2D CAD' },
                              ] as const
                            ).map((t, tIdx) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => updateSheet(idx, { type: t.id })}
                                className={`py-1.5 text-[0.60rem] tracking-cad uppercase font-medium cursor-pointer transition-colors ${
                                  tIdx > 0 ? 'border-l border-black' : ''
                                } ${
                                  sheet.type === t.id
                                    ? 'bg-[#27AAE0] text-black'
                                    : 'bg-white text-black hover:bg-[#CBCBCB]'
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[0.58rem] tracking-cad uppercase text-black/70 mb-0.5">
                          CAPTION
                        </label>
                        <input
                          type="text"
                          value={sheet.label}
                          onChange={(e) => updateSheet(idx, { label: e.target.value })}
                          placeholder="e.g. Installed elevation — solid black walnut doors"
                          className="w-full px-2.5 py-1.5 border border-black rounded-[7px] text-[0.78rem]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 03: TECHNICAL SPECIFICATION SCHEDULE */}
          <div className="border-[1.5px] border-black rounded-[9px] p-4 sm:p-6 bg-white space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.74rem] tracking-cad uppercase font-medium">
                03 / SPECIFICATION SCHEDULE ROWS (OPTIONAL)
              </span>
              <button
                type="button"
                onClick={addSpecRow}
                className="px-3 py-1.5 rounded-[9px] border border-black bg-white hover:bg-[#FDCB33] text-black text-[0.64rem] tracking-cad uppercase font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD SPEC ROW</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {form.specs.map((spec, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <div className="md:col-span-4">
                    <input
                      type="text"
                      placeholder="e.g. PRIMARY HARDWOODS"
                      value={spec.label}
                      onChange={(e) => updateSpec(idx, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.78rem] uppercase"
                    />
                  </div>
                  <div className="md:col-span-7">
                    <input
                      type="text"
                      placeholder="e.g. Select American Black Walnut & Rift White Oak"
                      value={spec.value}
                      onChange={(e) => updateSpec(idx, 'value', e.target.value)}
                      className="w-full px-3 py-2 border border-black rounded-[9px] text-[0.82rem]"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeSpecRow(idx)}
                      className="p-2 rounded-[9px] border border-black bg-white hover:bg-[#EF6922] text-black transition-colors cursor-pointer"
                      title="Remove spec row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 04: VISIBILITY & SAVE BAR */}
          <div className="border-[1.5px] border-black rounded-[9px] p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="inline-flex rounded-[9px] border-[1.5px] border-black overflow-hidden">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, published: true }))}
                className={`px-4 py-2.5 text-[0.68rem] tracking-cad uppercase font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  form.published
                    ? 'bg-[#27AAE0] text-black'
                    : 'bg-white text-black hover:bg-[#CBCBCB]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>PUBLISHED (LIVE)</span>
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, published: false }))}
                className={`px-4 py-2.5 text-[0.68rem] tracking-cad uppercase font-medium border-l-[1.5px] border-black inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  !form.published
                    ? 'bg-[#CBCBCB] text-black'
                    : 'bg-white text-black hover:bg-[#CBCBCB]'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>DRAFT (HIDDEN)</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMode('list');
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-[9px] border border-black bg-white hover:bg-[#CBCBCB] text-black text-[0.70rem] tracking-cad uppercase font-medium transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={saving || uploadingCount > 0}
                className="px-6 py-2.5 rounded-[9px] border-[1.5px] border-black bg-[#EF6922] hover:bg-black text-black hover:text-white disabled:opacity-50 text-[0.72rem] tracking-cad uppercase font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {saving
                    ? 'SAVING...'
                    : form.dbId
                    ? 'SAVE CHANGES'
                    : form.published
                    ? 'PUBLISH PROJECT TO SITE'
                    : 'SAVE DRAFT'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}
    </main>
  );
};
