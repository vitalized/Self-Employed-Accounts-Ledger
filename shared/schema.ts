import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  merchant: text("merchant").notNull(),
  type: text("type").notNull(), // Business, Personal, Unreviewed, Split
  category: text("category"),
  businessType: text("business_type"), // Income, Expense, Transfer
  status: text("status").notNull().default('Cleared'), // Pending, Cleared
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const selectUserSchema = createSelectSchema(users);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
