import { sqliteTable, text, integer, real, blob, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name"),
  onboarded: integer("onboarded").notNull().default(0),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const userPreferences = sqliteTable("user_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  topics: text("topics").notNull().default("[]"),
  contentTypes: text("content_types").notNull().default("[]"),
  digestSize: integer("digest_size").notNull().default(20),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  config: text("config").notNull().default("{}"),
  isDefault: integer("is_default").notNull().default(0),
  vetted: integer("vetted").notNull().default(1),
  description: text("description"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const userSources = sqliteTable(
  "user_sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    enabled: integer("enabled").notNull().default(1),
    addedByUser: integer("added_by_user").notNull().default(0),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
  },
  (table) => [
    uniqueIndex("user_source_unique").on(table.userId, table.sourceId),
  ]
);

export const contentItems = sqliteTable(
  "content_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    url: text("url").notNull(),
    author: text("author"),
    thumbnailUrl: text("thumbnail_url"),
    metadata: text("metadata").notNull().default("{}"),
    embedding: blob("embedding"),
    fetchedAt: text("fetched_at").notNull().default("(datetime('now'))"),
    publishedAt: text("published_at"),
  },
  (table) => [
    uniqueIndex("content_source_external").on(table.sourceId, table.externalId),
  ]
);

export const curatedItems = sqliteTable(
  "curated_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    contentItemId: integer("content_item_id")
      .notNull()
      .references(() => contentItems.id),
    score: real("score").notNull(),
    explanation: text("explanation").notNull(),
    reason: text("reason").notNull().default("topic_match"),
    digestDate: text("digest_date").notNull(),
    position: integer("position").notNull(),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
  },
  (table) => [
    uniqueIndex("curated_unique").on(
      table.userId,
      table.contentItemId,
      table.digestDate
    ),
  ]
);

export const interactions = sqliteTable("interactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  contentItemId: integer("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  type: text("type").notNull(),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
});
