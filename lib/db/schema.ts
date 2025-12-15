import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
  integer,
  varchar,
  unique,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { AdapterAccount } from "@auth/core/adapters";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "translator", "reviewer"]);
export const translationStateEnum = pgEnum("translation_state", [
  "draft",
  "review",
  "approved",
]);
export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "gemini",
  "google-translate",
]);
export const projectMemberRoleEnum = pgEnum("project_member_role", [
  "translator",
  "reviewer",
]);

// NextAuth tables
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("translator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compositePk: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
);

// Languages table
export const languages = pgTable("languages", {
  id: text("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: text("name").notNull(),
  flagEmoji: text("flag_emoji"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  defaultLanguageId: text("default_language_id").references(() => languages.id),
  apiKey: text("api_key").notNull().unique(),
  apiKeyHash: text("api_key_hash").notNull(),
  requiresReview: boolean("requires_review").notNull().default(true),
  aiProvider: aiProviderEnum("ai_provider"),
  aiFallbackProvider: aiProviderEnum("ai_fallback_provider"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project languages (many-to-many)
export const projectLanguages = pgTable(
  "project_languages",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    languageId: text("language_id")
      .notNull()
      .references(() => languages.id, { onDelete: "cascade" }),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: unique().on(t.projectId, t.languageId),
  })
);

// Translation keys
export const translationKeys = pgTable(
  "translation_keys",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    description: text("description"),
    namespace: text("namespace"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    projectKeyIdx: unique().on(t.projectId, t.key),
    projectIdx: index("translation_keys_project_idx").on(t.projectId),
  })
);

// Key screenshots
export const keyScreenshots = pgTable("key_screenshots", {
  id: text("id").primaryKey(),
  keyId: text("key_id")
    .notNull()
    .references(() => translationKeys.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  altText: text("alt_text"),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Translations
export const translations = pgTable(
  "translations",
  {
    id: text("id").primaryKey(),
    keyId: text("key_id")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    languageId: text("language_id")
      .notNull()
      .references(() => languages.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    state: translationStateEnum("state").notNull().default("draft"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    reviewedBy: text("reviewed_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    keyLanguageIdx: unique().on(t.keyId, t.languageId),
    keyIdx: index("translations_key_idx").on(t.keyId),
    languageIdx: index("translations_language_idx").on(t.languageId),
  })
);

// Translation history
export const translationHistory = pgTable("translation_history", {
  id: text("id").primaryKey(),
  translationId: text("translation_id")
    .notNull()
    .references(() => translations.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
  state: translationStateEnum("state").notNull(),
  changedBy: text("changed_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Translation memory
export const translationMemory = pgTable("translation_memory", {
  id: text("id").primaryKey(),
  sourceLanguageId: text("source_language_id")
    .notNull()
    .references(() => languages.id),
  targetLanguageId: text("target_language_id")
    .notNull()
    .references(() => languages.id),
  sourceText: text("source_text").notNull(),
  targetText: text("target_text").notNull(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Comments
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  translationId: text("translation_id")
    .notNull()
    .references(() => translations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project members
export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: projectMemberRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    pk: unique().on(t.projectId, t.userId),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  translations: many(translations),
  reviewedTranslations: many(translations, { relationName: "reviewedBy" }),
  comments: many(comments),
  projectMemberships: many(projectMembers),
  uploadedScreenshots: many(keyScreenshots),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  languages: many(projectLanguages),
  defaultLanguage: one(languages, {
    fields: [projects.defaultLanguageId],
    references: [languages.id],
  }),
  translationKeys: many(translationKeys),
  translationMemory: many(translationMemory),
  members: many(projectMembers),
}));

export const languagesRelations = relations(languages, ({ many }) => ({
  projects: many(projectLanguages),
  translations: many(translations),
  translationMemorySource: many(translationMemory, { relationName: "sourceLanguage" }),
  translationMemoryTarget: many(translationMemory, { relationName: "targetLanguage" }),
}));

export const translationKeysRelations = relations(translationKeys, ({ one, many }) => ({
  project: one(projects, {
    fields: [translationKeys.projectId],
    references: [projects.id],
  }),
  translations: many(translations),
  screenshots: many(keyScreenshots),
}));

export const translationsRelations = relations(translations, ({ one, many }) => ({
  key: one(translationKeys, {
    fields: [translations.keyId],
    references: [translationKeys.id],
  }),
  language: one(languages, {
    fields: [translations.languageId],
    references: [languages.id],
  }),
  createdByUser: one(users, {
    fields: [translations.createdBy],
    references: [users.id],
  }),
  reviewedByUser: one(users, {
    fields: [translations.reviewedBy],
    references: [users.id],
    relationName: "reviewedBy",
  }),
  history: many(translationHistory),
  comments: many(comments),
}));

