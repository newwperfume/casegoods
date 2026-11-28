import { asc, count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { portfolioProjects } from './schema.ts';
import {
  DEFAULT_PORTFOLIO_PROJECTS,
  FAMILY_ROOM_CAD_SHEETS,
  type PortfolioCategoryTag,
  type PortfolioProject,
} from '../data/defaultProjects.ts';
import type { ProjectImage } from '../components/CadModal.tsx';

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function normalizeCategoryTag(value: string): PortfolioCategoryTag {
  if (value === 'furniture' || value === 'commercial' || value === 'architectural') {
    return value;
  }
  return 'architectural';
}

function rowToPortfolioProject(
  row: typeof portfolioProjects.$inferSelect
): PortfolioProject {
  const images = safeParseJson<ProjectImage[]>(row.imagesJson, []);
  const specs = safeParseJson<{ label: string; value: string }[]>(row.specsJson, []);

  return {
    dbId: row.id,
    id: row.slug,
    code: row.code,
    title: row.title,
    recipient: row.recipient || '',
    category: row.category,
    categoryTag: normalizeCategoryTag(row.categoryTag),
    pillarBg: row.pillarBg,
    pillarCode: row.pillarCode,
    tolerance: row.tolerance,
    materials: row.materials,
    dimensions: row.dimensions,
    description: row.description,
    images: Array.isArray(images) ? images : [],
    specs: Array.isArray(specs) ? specs : [],
    published: Boolean(row.published),
    sortOrder: row.sortOrder ?? 0,
  };
}

let seedPromise: Promise<void> | null = null;

/**
 * Places the 1064HEM A-101 – A-103 construction document sheets at the front of an
 * already-seeded `family-room` project, ahead of the 3D renders.
 * - If none of the sheets are present, they are prepended.
 * - If they were previously appended at the end (earlier backfill), they are moved to the front.
 * - Otherwise (row missing, already first, or manually rearranged) nothing is changed.
 */
async function backfillFamilyRoomCadSheets(): Promise<void> {
  const [row] = await db
    .select({ id: portfolioProjects.id, imagesJson: portfolioProjects.imagesJson })
    .from(portfolioProjects)
    .where(eq(portfolioProjects.slug, 'family-room'));
  if (!row) return;

  const images = safeParseJson<ProjectImage[]>(row.imagesJson, []);
  const current = Array.isArray(images) ? images : [];
  const sheetSrcs = FAMILY_ROOM_CAD_SHEETS.map((sheet) => sheet.src);
  const isSheet = (img: ProjectImage | undefined) => !!img && sheetSrcs.includes(img.src);

  let next: ProjectImage[] | null = null;

  if (!current.some(isSheet)) {
    next = [...FAMILY_ROOM_CAD_SHEETS, ...current];
  } else {
    const tail = current.slice(-sheetSrcs.length).map((img) => img?.src);
    const appendedAtEnd =
      current.length > sheetSrcs.length &&
      !isSheet(current[0]) &&
      tail.every((src, i) => src === sheetSrcs[i]);
    if (appendedAtEnd) {
      next = [
        ...current.slice(-sheetSrcs.length),
        ...current.slice(0, current.length - sheetSrcs.length),
      ];
    }
  }

  if (!next) return;

  await db
    .update(portfolioProjects)
    .set({
      imagesJson: JSON.stringify(next),
      updatedAt: new Date(),
    })
    .where(eq(portfolioProjects.id, row.id));
}

export async function ensureDefaultPortfolioProjectsSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const [{ value: existingCount }] = await db
        .select({ value: count() })
        .from(portfolioProjects);

      if (Number(existingCount) > 0) {
        await backfillFamilyRoomCadSheets();
        return;
      }

      for (let i = 0; i < DEFAULT_PORTFOLIO_PROJECTS.length; i++) {
        const proj = DEFAULT_PORTFOLIO_PROJECTS[i];
        await db
          .insert(portfolioProjects)
          .values({
            slug: proj.id,
            code: proj.code,
            title: proj.title,
            recipient: proj.recipient || '',
            category: proj.category,
            categoryTag: proj.categoryTag,
            pillarBg: proj.pillarBg,
            pillarCode: proj.pillarCode,
            tolerance: proj.tolerance,
            materials: proj.materials,
            dimensions: proj.dimensions,
            description: proj.description,
            imagesJson: JSON.stringify(proj.images || []),
            specsJson: JSON.stringify(proj.specs || []),
            published: true,
            sortOrder: i,
          })
          .onConflictDoNothing({ target: portfolioProjects.slug });
      }
    } catch (err) {
      seedPromise = null;
      throw err;
    }
  })();

  return seedPromise;
}

export async function listPublishedPortfolioProjects(): Promise<PortfolioProject[]> {
  await ensureDefaultPortfolioProjectsSeeded();
  const rows = await db
    .select()
    .from(portfolioProjects)
    .where(eq(portfolioProjects.published, true))
    .orderBy(asc(portfolioProjects.sortOrder), asc(portfolioProjects.id));

  return rows.map(rowToPortfolioProject);
}

export async function listAllPortfolioProjects(): Promise<PortfolioProject[]> {
  await ensureDefaultPortfolioProjectsSeeded();
  const rows = await db
    .select()
    .from(portfolioProjects)
    .orderBy(asc(portfolioProjects.sortOrder), asc(portfolioProjects.id));

  return rows.map(rowToPortfolioProject);
}

export interface UpsertPortfolioProjectInput {
  slug?: string;
  code: string;
  title: string;
  recipient?: string;
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
  sortOrder?: number;
}

function makeSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `project-${Date.now()}`;
}

export async function createPortfolioProject(
  input: UpsertPortfolioProjectInput
): Promise<PortfolioProject> {
  await ensureDefaultPortfolioProjectsSeeded();

  const existingAll = await db
    .select({ slug: portfolioProjects.slug, sortOrder: portfolioProjects.sortOrder })
    .from(portfolioProjects);

  const existingSlugs = new Set(existingAll.map((r) => r.slug));
  let slug = makeSlug(input.slug || `${input.code}-${input.title}`);
  if (existingSlugs.has(slug)) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  const maxSort = existingAll.reduce((acc, r) => Math.max(acc, r.sortOrder ?? 0), -1);
  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
      ? input.sortOrder
      : maxSort + 1;

  const [created] = await db
    .insert(portfolioProjects)
    .values({
      slug,
      code: input.code.trim(),
      title: input.title.trim(),
      recipient: (input.recipient || '').trim(),
      category: input.category.trim() || 'ARCHITECTURAL BUILT-IN',
      categoryTag: normalizeCategoryTag(input.categoryTag),
      pillarBg: input.pillarBg || 'bg-[#EF6922]',
      pillarCode: input.pillarCode || 'PILLAR 01 / ARCHITECTURAL MILLWORK',
      tolerance: input.tolerance.trim() || '± 1/32" RHINO 3D',
      materials: input.materials.trim(),
      dimensions: input.dimensions.trim(),
      description: input.description.trim(),
      imagesJson: JSON.stringify(Array.isArray(input.images) ? input.images : []),
      specsJson: JSON.stringify(Array.isArray(input.specs) ? input.specs : []),
      published: Boolean(input.published),
      sortOrder,
    })
    .returning();

  return rowToPortfolioProject(created);
}

export async function updatePortfolioProject(
  dbId: number,
  input: Partial<UpsertPortfolioProjectInput>
): Promise<PortfolioProject | null> {
  const existing = await db
    .select()
    .from(portfolioProjects)
    .where(eq(portfolioProjects.id, dbId));

  if (!existing.length) return null;

  const patch: Partial<typeof portfolioProjects.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof input.code === 'string') patch.code = input.code.trim();
  if (typeof input.title === 'string') patch.title = input.title.trim();
  if (typeof input.recipient === 'string') patch.recipient = input.recipient.trim();
  if (typeof input.category === 'string') patch.category = input.category.trim();
  if (typeof input.categoryTag === 'string')
    patch.categoryTag = normalizeCategoryTag(input.categoryTag);
  if (typeof input.pillarBg === 'string') patch.pillarBg = input.pillarBg;
  if (typeof input.pillarCode === 'string') patch.pillarCode = input.pillarCode;
  if (typeof input.tolerance === 'string') patch.tolerance = input.tolerance.trim();
  if (typeof input.materials === 'string') patch.materials = input.materials.trim();
  if (typeof input.dimensions === 'string') patch.dimensions = input.dimensions.trim();
  if (typeof input.description === 'string') patch.description = input.description.trim();
  if (Array.isArray(input.images)) patch.imagesJson = JSON.stringify(input.images);
  if (Array.isArray(input.specs)) patch.specsJson = JSON.stringify(input.specs);
  if (typeof input.published === 'boolean') patch.published = input.published;
  if (typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)) {
    patch.sortOrder = input.sortOrder;
  }

  const [updated] = await db
    .update(portfolioProjects)
    .set(patch)
    .where(eq(portfolioProjects.id, dbId))
    .returning();

  return updated ? rowToPortfolioProject(updated) : null;
}

export async function deletePortfolioProject(dbId: number): Promise<boolean> {
  const deleted = await db
    .delete(portfolioProjects)
    .where(eq(portfolioProjects.id, dbId))
    .returning({ id: portfolioProjects.id });
  return deleted.length > 0;
}

export async function reorderPortfolioProjects(orderedDbIds: number[]): Promise<PortfolioProject[]> {
  for (let idx = 0; idx < orderedDbIds.length; idx++) {
    const id = Number(orderedDbIds[idx]);
    if (!Number.isFinite(id)) continue;
    await db
      .update(portfolioProjects)
      .set({ sortOrder: idx, updatedAt: new Date() })
      .where(eq(portfolioProjects.id, id));
  }
  return listAllPortfolioProjects();
}
