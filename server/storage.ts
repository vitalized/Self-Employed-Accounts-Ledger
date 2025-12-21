import { users, transactions, settings, categorizationRules, transactionNotes, type User, type InsertUser, type Transaction, type InsertTransaction, type UpdateTransaction, type Settings, type InsertSettings, type CategorizationRule, type InsertCategorizationRule, type TransactionNote, type InsertTransactionNote } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, ilike } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Transaction methods
  getTransactions(userId?: string): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: UpdateTransaction): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;
  
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
}

export const storage = new DatabaseStorage();
