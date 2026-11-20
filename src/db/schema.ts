import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const concepts = pgTable('concepts', {
  id: serial('id').primaryKey(),
  conceptId: text('concept_id').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  filename: text('filename').notNull(),
  publicPath: text('public_path').notNull(),
  fullImageUrl: text('full_image_url').notNull(),
  visualStyle: text('visual_style').notNull(),
  ideaPrompt: text('idea_prompt').notNull(),
  woodSpecies: text('wood_species').notNull(),
  designStyle: text('design_style').notNull(),
  addedDetails: text('added_details'),
  summarySpec: text('summary_spec').notNull(),
  modelEngine: text('model_engine'),
  emailedToOwner: boolean('emailed_to_owner').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inquiries = pgTable('inquiries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  projectType: text('project_type').notNull(),
  timeline: text('timeline'),
  budget: text('budget'),
  dimensions: text('dimensions'),
  description: text('description').notNull(),
  conceptId: text('concept_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const portfolioProjects = pgTable('portfolio_projects', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  recipient: text('recipient').notNull().default(''),
  category: text('category').notNull(),
  categoryTag: text('category_tag').notNull().default('architectural'),
  pillarBg: text('pillar_bg').notNull().default('bg-[#EF6922]'),
  pillarCode: text('pillar_code').notNull().default('PILLAR 01 / ARCHITECTURAL MILLWORK'),
  tolerance: text('tolerance').notNull().default('± 1/32" RHINO 3D'),
  materials: text('materials').notNull().default(''),
  dimensions: text('dimensions').notNull().default(''),
  description: text('description').notNull().default(''),
  imagesJson: text('images_json').notNull().default('[]'),
  specsJson: text('specs_json').notNull().default('[]'),
  published: boolean('published').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  concepts: many(concepts),
  inquiries: many(inquiries),
}));

export const conceptsRelations = relations(concepts, ({ one }) => ({
  author: one(users, {
    fields: [concepts.userId],
    references: [users.id],
  }),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  author: one(users, {
    fields: [inquiries.userId],
    references: [users.id],
  }),
}));
