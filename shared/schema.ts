import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

import { users } from "./models/auth";

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  reference: text("reference"), // Transaction reference from bank API
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  merchant: text("merchant").notNull(),
  type: text("type").notNull(), // Business, Personal, Unreviewed, Split
  category: text("category"),
  businessType: text("business_type"), // Income, Expense, Transfer
  status: text("status").notNull().default('Cleared'), // Pending, Cleared
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  fingerprint: text("fingerprint").unique(), // For duplicate detection: date+amount+description+reference hash
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transaction schemas
export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()), // Allow both string and number for amount
});

export const selectTransactionSchema = createSelectSchema(transactions);

export const updateTransactionSchema = insertTransactionSchema.partial();

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;

// App settings for storing API tokens and preferences
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Categorization rules for auto-assigning transaction types and categories
export const categorizationRules = pgTable("categorization_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyword: text("keyword").notNull(),
  type: text("type").notNull(), // Business, Personal
  businessType: text("business_type"), // Income, Expense (for Business type)
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCategorizationRuleSchema = createInsertSchema(categorizationRules).omit({
  id: true,
  createdAt: true,
});

export type InsertCategorizationRule = z.infer<typeof insertCategorizationRuleSchema>;
export type CategorizationRule = typeof categorizationRules.$inferSelect;

// Transaction notes - keyed by description for shared notes or transactionId for specific notes
export const transactionNotes = pgTable("transaction_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description"),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  note: text("note").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTransactionNoteSchema = createInsertSchema(transactionNotes).omit({
  id: true,
  updatedAt: true,
});

export type InsertTransactionNote = z.infer<typeof insertTransactionNoteSchema>;
export type TransactionNote = typeof transactionNotes.$inferSelect;

// Categories for income and expenses (user-editable)
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'Income' or 'Expense'
  hmrcBox: text("hmrc_box"), // HMRC SA103F box number (17-30) for expense categories
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Excluded fingerprints - transactions that should not be re-imported
export const excludedFingerprints = pgTable("excluded_fingerprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fingerprint: text("fingerprint").notNull().unique(),
  description: text("description").notNull(), // For reference
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  reason: text("reason").default('User deleted'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertExcludedFingerprintSchema = createInsertSchema(excludedFingerprints).omit({
  id: true,
  createdAt: true,
});

export type InsertExcludedFingerprint = z.infer<typeof insertExcludedFingerprintSchema>;
export type ExcludedFingerprint = typeof excludedFingerprints.$inferSelect;

// Mileage trips for tracking business miles and calculating HMRC mileage allowance
export const mileageTrips = pgTable("mileage_trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  miles: decimal("miles", { precision: 10, scale: 2 }).notNull(),
  transactionId: varchar("transaction_id").references(() => transactions.id), // Optional link to a transaction
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMileageTripSchema = createInsertSchema(mileageTrips).omit({
  id: true,
  createdAt: true,
}).extend({
  miles: z.string().or(z.number()),
});

export type InsertMileageTrip = z.infer<typeof insertMileageTripSchema>;
export type MileageTrip = typeof mileageTrips.$inferSelect;

// Business details for sole trader
export const business = pgTable("business", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  registeredAddress: text("registered_address"),
  startDate: timestamp("start_date"),
  periodStartMonth: integer("period_start_month"), // 1-12
  periodStartDay: integer("period_start_day"), // 1-31
  preferredBank: text("preferred_bank"),
  utr: text("utr").unique(), // Unique Tax Reference
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBusinessSchema = createInsertSchema(business).omit({
  id: true,
  createdAt: true,
});

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof business.$inferSelect;

// App settings for storing email configuration and other app-wide settings
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default("default"),
  postmarkApiToken: text("postmark_api_token"),
  postmarkFromEmail: text("postmark_from_email"),
  postmarkFromName: text("postmark_from_name"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  updatedAt: true,
});

export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;
