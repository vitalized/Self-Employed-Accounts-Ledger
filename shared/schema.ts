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

// Transaction notes - keyed by description for shared notes across matching transactions
export const transactionNotes = pgTable("transaction_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull().unique(),
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

// Achievements for gamification
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // Lucide icon name
  points: integer("points").notNull().default(10),
  category: text("category").notNull(), // 'budgeting', 'savings', 'tracking', 'milestones'
  threshold: integer("threshold"), // Numeric threshold to unlock (e.g., 100 transactions)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievements.$inferSelect;

// User achievements - tracks which achievements a user has unlocked
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  achievementId: varchar("achievement_id").references(() => achievements.id).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  unlockedAt: true,
});

export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;

// Challenges for gamification
export const challenges = pgTable("challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  points: integer("points").notNull().default(25),
  challengeType: text("challenge_type").notNull(), // 'weekly', 'monthly', 'one-time'
  targetValue: integer("target_value").notNull(), // Target to achieve
  metricType: text("metric_type").notNull(), // 'transactions_categorized', 'savings_rate', 'expense_reduction', etc.
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
});

export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

// User challenge progress
export const userChallenges = pgTable("user_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengeId: varchar("challenge_id").references(() => challenges.id).notNull(),
  currentValue: integer("current_value").notNull().default(0),
  isCompleted: integer("is_completed").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertUserChallengeSchema = createInsertSchema(userChallenges).omit({
  id: true,
  startedAt: true,
});

export type InsertUserChallenge = z.infer<typeof insertUserChallengeSchema>;
export type UserChallenge = typeof userChallenges.$inferSelect;

// User points and level tracking
export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalPoints: integer("total_points").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0), // Days of consecutive activity
  lastActivityDate: timestamp("last_activity_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  updatedAt: true,
});

export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type UserStats = typeof userStats.$inferSelect;
