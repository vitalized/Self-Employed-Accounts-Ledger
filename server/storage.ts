import { users, transactions, settings, categorizationRules, transactionNotes, categories, excludedFingerprints, type User, type InsertUser, type Transaction, type InsertTransaction, type UpdateTransaction, type Settings, type InsertSettings, type CategorizationRule, type InsertCategorizationRule, type TransactionNote, type InsertTransactionNote, type Category, type InsertCategory, type InsertExcludedFingerprint, type ExcludedFingerprint } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, ilike, between, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Transaction methods
  getTransactions(userId?: string): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  createTransactionWithFingerprint(transaction: InsertTransaction, fingerprint: string): Promise<Transaction>;
  updateTransaction(id: string, updates: UpdateTransaction): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  getExistingFingerprints(): Promise<Set<string>>;
  findPotentialDuplicate(date: Date, amount: number, description: string, reference: string | null, excludeFingerprints?: Set<string>): Promise<Transaction | null>;
  
  // Settings methods
  getSetting(key: string): Promise<Settings | undefined>;
  setSetting(key: string, value: string): Promise<Settings>;
  deleteSetting(key: string): Promise<boolean>;
  
  // Sync status methods
  getLastSyncAt(): Promise<Date | null>;
  setLastSyncAt(date: Date): Promise<void>;
  
  // Categorization rules methods
  getRules(): Promise<CategorizationRule[]>;
  getRule(id: string): Promise<CategorizationRule | undefined>;
  createRule(rule: InsertCategorizationRule): Promise<CategorizationRule>;
  updateRule(id: string, updates: Partial<InsertCategorizationRule>): Promise<CategorizationRule | undefined>;
  deleteRule(id: string): Promise<boolean>;
  applyRulesToTransaction(transaction: Transaction): Promise<{ type: string; businessType: string | null; category: string | null } | null>;
  
  // Transaction notes methods
  getNotes(): Promise<TransactionNote[]>;
  getNoteByDescription(description: string): Promise<TransactionNote | undefined>;
  setNote(description: string, note: string): Promise<TransactionNote>;
  deleteNote(description: string): Promise<boolean>;
  
  // Category methods
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryByCode(code: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  reassignTransactionCategory(oldCategory: string, newCategory: string): Promise<number>;
  seedDefaultCategories(): Promise<void>;
  
  // Exclusion methods
  getExcludedFingerprints(): Promise<Set<string>>;
  addExcludedFingerprint(exclusion: InsertExcludedFingerprint): Promise<ExcludedFingerprint>;
  isExcluded(fingerprint: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Transaction methods
  async getTransactions(userId?: string): Promise<Transaction[]> {
    if (userId) {
      return await db.select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.date));
    }
    return await db.select()
      .from(transactions)
      .orderBy(desc(transactions.date));
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    // Convert amount to string if it's a number
    const values = {
      ...insertTransaction,
      amount: String(insertTransaction.amount),
    };
    
    const [transaction] = await db
      .insert(transactions)
      .values(values)
      .returning();
    return transaction;
  }

  async createTransactionWithFingerprint(insertTransaction: InsertTransaction, fingerprint: string): Promise<Transaction> {
    const values = {
      ...insertTransaction,
      amount: String(insertTransaction.amount),
      fingerprint,
    };
    
    const [transaction] = await db
      .insert(transactions)
      .values(values)
      .returning();
    return transaction;
  }

  async getExistingFingerprints(): Promise<Set<string>> {
    const results = await db.select({ fingerprint: transactions.fingerprint })
      .from(transactions);
    const fingerprints = new Set<string>();
    for (const row of results) {
      if (row.fingerprint) {
        fingerprints.add(row.fingerprint);
      }
    }
    return fingerprints;
  }

  async findPotentialDuplicate(date: Date, amount: number, description: string, _reference: string | null, excludeFingerprints?: Set<string>): Promise<Transaction | null> {
    // Check for transactions with matching amount and description within +/- 1 day
    // This handles Starling API vs CSV date discrepancies
    // Note: Reference is intentionally excluded because Starling API often returns null
    // while CSV exports include reference values, causing false negatives
    // excludeFingerprints: fingerprints to ignore (e.g., rows added in current import batch)
    
    const inputDateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD in UTC
    const dayBefore = new Date(date);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
    const dayBeforeStr = dayBefore.toISOString().split('T')[0];
    const dayAfter = new Date(date);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];
    
    // Allowed date strings for matching
    const allowedDates = new Set([dayBeforeStr, inputDateStr, dayAfterStr]);
    
    const descLower = description.toLowerCase().trim();
    
    // Query transactions within date range (more efficient than full table scan)
    const startDate = new Date(dayBeforeStr + 'T00:00:00Z');
    const endDate = new Date(dayAfterStr + 'T23:59:59Z');
    
    const candidates = await db.select()
      .from(transactions)
      .where(between(transactions.date, startDate, endDate));
    
    // Find matching transactions (same amount/description, reference excluded)
    const matchingTxs: Array<{tx: Transaction, dateStr: string, isFromCSV: boolean}> = [];
    
    for (const tx of candidates) {
      // Skip transactions from current batch (identified by fingerprint)
      if (excludeFingerprints && tx.fingerprint && excludeFingerprints.has(tx.fingerprint)) {
        continue;
      }
      
      const txAmount = parseFloat(tx.amount);
      if (Math.abs(txAmount - amount) > 0.01) continue;
      if (tx.description.toLowerCase().trim() !== descLower) continue;
      const txDateStr = new Date(tx.date).toISOString().split('T')[0];
      if (!allowedDates.has(txDateStr)) continue;
      
      const isFromCSV = tx.tags && tx.tags.includes('import:csv');
      matchingTxs.push({ tx, dateStr: txDateStr, isFromCSV: !!isFromCSV });
    }
    
    // Check for exact same date match first (definitely a duplicate)
    const sameDateMatch = matchingTxs.find(m => m.dateStr === inputDateStr);
    if (sameDateMatch) {
      return sameDateMatch.tx;
    }
    
    // For ±1 day matches, only treat as duplicate if there's exactly ONE API transaction
    // This prevents blocking legitimate consecutive-day transactions (like daily TfL fares)
    const apiMatches = matchingTxs.filter(m => !m.isFromCSV);
    
    if (apiMatches.length === 1) {
      // Single API transaction on adjacent day - likely same transaction with date mismatch
      return apiMatches[0].tx;
    }
    
    // Multiple API transactions on different days = recurring pattern, allow CSV import
    // Zero API matches = no duplicate
    return null;
  }

  async updateTransaction(id: string, updates: UpdateTransaction): Promise<Transaction | undefined> {
    // Convert amount to string if it's a number
    const values: Record<string, any> = { ...updates };
    if (updates.amount !== undefined) {
      values.amount = String(updates.amount);
    }
    
    const [transaction] = await db
      .update(transactions)
      .set(values)
      .where(eq(transactions.id, id))
      .returning();
    return transaction || undefined;
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const result = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning();
    return result.length > 0;
  }

  // Settings methods
  async getSetting(key: string): Promise<Settings | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async setSetting(key: string, value: string): Promise<Settings> {
    // Upsert: try to update, if not found insert
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(settings)
      .values({ key, value })
      .returning();
    return created;
  }

  async deleteSetting(key: string): Promise<boolean> {
    const result = await db
      .delete(settings)
      .where(eq(settings.key, key))
      .returning();
    return result.length > 0;
  }

  // Sync status methods
  async getLastSyncAt(): Promise<Date | null> {
    const setting = await this.getSetting('lastSyncAt');
    if (setting?.value) {
      return new Date(setting.value);
    }
    return null;
  }

  async setLastSyncAt(date: Date): Promise<void> {
    await this.setSetting('lastSyncAt', date.toISOString());
  }

  // Categorization rules methods
  async getRules(): Promise<CategorizationRule[]> {
    return await db.select()
      .from(categorizationRules)
      .orderBy(desc(categorizationRules.createdAt));
  }

  async getRule(id: string): Promise<CategorizationRule | undefined> {
    const [rule] = await db.select()
      .from(categorizationRules)
      .where(eq(categorizationRules.id, id));
    return rule || undefined;
  }

  async createRule(insertRule: InsertCategorizationRule): Promise<CategorizationRule> {
    const [rule] = await db
      .insert(categorizationRules)
      .values(insertRule)
      .returning();
    return rule;
  }

  async updateRule(id: string, updates: Partial<InsertCategorizationRule>): Promise<CategorizationRule | undefined> {
    const [rule] = await db
      .update(categorizationRules)
      .set(updates)
      .where(eq(categorizationRules.id, id))
      .returning();
    return rule || undefined;
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await db
      .delete(categorizationRules)
      .where(eq(categorizationRules.id, id))
      .returning();
    return result.length > 0;
  }

  async applyRulesToTransaction(transaction: Transaction): Promise<{ type: string; businessType: string | null; category: string | null } | null> {
    const rules = await this.getRules();
    const description = transaction.description.toLowerCase();
    const merchant = transaction.merchant.toLowerCase();
    const reference = (transaction.reference || '').toLowerCase();
    
    for (const rule of rules) {
      const keyword = rule.keyword.toLowerCase();
      if (description.includes(keyword) || merchant.includes(keyword) || reference.includes(keyword)) {
        return {
          type: rule.type,
          businessType: rule.businessType,
          category: rule.category,
        };
      }
    }
    return null;
  }

  // Transaction notes methods
  async getNotes(): Promise<TransactionNote[]> {
    return await db.select().from(transactionNotes);
  }

  async getNoteByDescription(description: string): Promise<TransactionNote | undefined> {
    const [note] = await db.select()
      .from(transactionNotes)
      .where(eq(transactionNotes.description, description));
    return note || undefined;
  }

  async setNote(description: string, note: string): Promise<TransactionNote> {
    const existing = await this.getNoteByDescription(description);
    if (existing) {
      const [updated] = await db
        .update(transactionNotes)
        .set({ note, updatedAt: new Date() })
        .where(eq(transactionNotes.description, description))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(transactionNotes)
      .values({ description, note })
      .returning();
    return created;
  }

  async deleteNote(description: string): Promise<boolean> {
    const result = await db
      .delete(transactionNotes)
      .where(eq(transactionNotes.description, description))
      .returning();
    return result.length > 0;
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.type, categories.label);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryByCode(code: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.code, code));
    return category || undefined;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(insertCategory)
      .returning();
    return category;
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning();
    return result.length > 0;
  }

  async reassignTransactionCategory(oldCategory: string, newCategory: string): Promise<number> {
    const result = await db
      .update(transactions)
      .set({ category: newCategory })
      .where(eq(transactions.category, oldCategory))
      .returning();
    return result.length;
  }

  async seedDefaultCategories(): Promise<void> {
    const existingCategories = await this.getCategories();
    if (existingCategories.length > 0) {
      return;
    }

    const expenseCategories = [
      { code: "C10", label: "Accountancy", description: "Accountancy and bookkeeping fees", type: "Expense" },
      { code: "24", label: "Advertising", description: "Advertising and business entertainment costs", type: "Expense" },
      { code: "27", label: "Bad Debts", description: "Irrecoverable debts written off", type: "Expense" },
      { code: "26", label: "Bank Charges", description: "Bank, credit card and other financial charges", type: "Expense" },
      { code: "C9", label: "Books and Professional Magazines", description: "Professional books, journals and publications", type: "Expense" },
      { code: "C3", label: "Broadband", description: "Internet and broadband costs", type: "Expense" },
      { code: "17", label: "Cost of Goods", description: "Cost of goods bought for resale or goods used", type: "Expense" },
      { code: "C8", label: "Courses and Training", description: "Training courses including CPE/CPD", type: "Expense" },
      { code: "29", label: "Depreciation", description: "Depreciation and loss/profit on sale of assets", type: "Expense" },
      { code: "C11", label: "Hotels and Business Accommodation", description: "Hotel stays and accommodation for business travel", type: "Expense" },
      { code: "C6", label: "Insurance & Licences", description: "Business insurance and professional licences", type: "Expense" },
      { code: "25", label: "Loan Interest", description: "Interest on bank and other loans", type: "Expense" },
      { code: "C2", label: "Mobile Phone", description: "Mobile phone bills and top-ups", type: "Expense" },
      { code: "23", label: "Office Costs", description: "Phone, fax, stationery and other office costs", type: "Expense" },
      { code: "30", label: "Other Expenses", description: "Other business expenses", type: "Expense" },
      { code: "C1", label: "Postage and Stationery", description: "Postage, stamps, envelopes, paper and stationery", type: "Expense" },
      { code: "21", label: "Premises Costs", description: "Rent, rates, power and insurance costs", type: "Expense" },
      { code: "28", label: "Professional Fees", description: "Accountancy, legal and other professional fees", type: "Expense" },
      { code: "22", label: "Repairs & Maintenance", description: "Repairs and maintenance of property and equipment", type: "Expense" },
      { code: "C5", label: "Software and Computer Incidentals", description: "Software subscriptions, licenses and computer consumables", type: "Expense" },
      { code: "19", label: "Staff Costs", description: "Wages, salaries and other staff costs", type: "Expense" },
      { code: "18", label: "Subcontractor Costs", description: "Construction industry payments to subcontractors", type: "Expense" },
      { code: "C7", label: "Subscriptions", description: "Professional and trade subscriptions", type: "Expense" },
      { code: "20", label: "Travel & Vehicle", description: "Car, van and travel expenses", type: "Expense" },
      { code: "C4", label: "Website and Hosting", description: "Website hosting, domain names and web services", type: "Expense" },
    ];

    const incomeCategories = [
      { code: "I3", label: "Commission", description: "Commission income", type: "Income" },
      { code: "I2", label: "Consulting", description: "Consulting or freelance income", type: "Income" },
      { code: "I4", label: "Grants", description: "Business grants received", type: "Income" },
      { code: "I6", label: "Other Income", description: "Other business income", type: "Income" },
      { code: "I5", label: "Refunds", description: "Business refunds received", type: "Income" },
      { code: "I1", label: "Sales", description: "Sales of goods or services", type: "Income" },
    ];

    for (const cat of [...expenseCategories, ...incomeCategories]) {
      await this.createCategory(cat);
    }
  }

  // Exclusion methods
  async getExcludedFingerprints(): Promise<Set<string>> {
    const excluded = await db.select({ fingerprint: excludedFingerprints.fingerprint })
      .from(excludedFingerprints);
    return new Set(excluded.map(e => e.fingerprint));
  }

  async addExcludedFingerprint(exclusion: InsertExcludedFingerprint): Promise<ExcludedFingerprint> {
    const [result] = await db
      .insert(excludedFingerprints)
      .values(exclusion)
      .returning();
    return result;
  }

  async isExcluded(fingerprint: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(excludedFingerprints)
      .where(eq(excludedFingerprints.fingerprint, fingerprint));
    return !!result;
  }
}

export const storage = new DatabaseStorage();
