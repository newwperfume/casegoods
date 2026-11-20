import { db } from './index.ts';
import { users, concepts, inquiries } from './schema.ts';
import { desc, eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string | null) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export interface CreateConceptRecordInput {
  conceptId: string;
  userId?: number | null;
  filename: string;
  publicPath: string;
  fullImageUrl: string;
  visualStyle: 'render-3d' | 'cad-2d';
  ideaPrompt: string;
  woodSpecies: string;
  designStyle: string;
  addedDetails?: string;
  summarySpec: string;
  modelEngine?: string;
  emailedToOwner?: boolean;
}

export async function saveConceptToDb(input: CreateConceptRecordInput) {
  try {
    const result = await db
      .insert(concepts)
      .values({
        conceptId: input.conceptId,
        userId: input.userId ?? null,
        filename: input.filename,
        publicPath: input.publicPath,
        fullImageUrl: input.fullImageUrl,
        visualStyle: input.visualStyle,
        ideaPrompt: input.ideaPrompt,
        woodSpecies: input.woodSpecies,
        designStyle: input.designStyle,
        addedDetails: input.addedDetails ?? null,
        summarySpec: input.summarySpec,
        modelEngine: input.modelEngine ?? null,
        emailedToOwner: input.emailedToOwner ?? false,
      })
      .onConflictDoUpdate({
        target: concepts.conceptId,
        set: {
          emailedToOwner: input.emailedToOwner ?? false,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in saveConceptToDb:', error);
    throw new Error('Failed to save generated concept to database.', { cause: error });
  }
}

export async function getRecentConceptsFromDb(limit = 50) {
  try {
    return await db
      .select()
      .from(concepts)
      .orderBy(desc(concepts.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed in getRecentConceptsFromDb:', error);
    throw new Error('Failed to load generated concepts from database.', { cause: error });
  }
}

export async function getUserConceptsFromDb(uid: string) {
  try {
    const rows = await db
      .select({
        concept: concepts,
      })
      .from(concepts)
      .innerJoin(users, eq(concepts.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(concepts.createdAt));

    return rows.map((r) => r.concept);
  } catch (error) {
    console.error('Database query failed in getUserConceptsFromDb:', error);
    throw new Error('Failed to load user concepts from database.', { cause: error });
  }
}

export interface CreateInquiryInput {
  userId?: number | null;
  name: string;
  email: string;
  phone?: string;
  projectType: string;
  timeline?: string;
  budget?: string;
  dimensions?: string;
  description: string;
  conceptId?: string;
}

export async function saveInquiryToDb(input: CreateInquiryInput) {
  try {
    const result = await db
      .insert(inquiries)
      .values({
        userId: input.userId ?? null,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        projectType: input.projectType,
        timeline: input.timeline ?? null,
        budget: input.budget ?? null,
        dimensions: input.dimensions ?? null,
        description: input.description,
        conceptId: input.conceptId ?? null,
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in saveInquiryToDb:', error);
    throw new Error('Failed to save commission inquiry to database.', { cause: error });
  }
}

export async function getUserInquiriesFromDb(uid: string) {
  try {
    const rows = await db
      .select({
        inquiry: inquiries,
      })
      .from(inquiries)
      .innerJoin(users, eq(inquiries.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(inquiries.createdAt));

    return rows.map((r) => r.inquiry);
  } catch (error) {
    console.error('Database query failed in getUserInquiriesFromDb:', error);
    throw new Error('Failed to load user inquiries from database.', { cause: error });
  }
}
