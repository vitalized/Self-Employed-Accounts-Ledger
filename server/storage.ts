import { users, transactions, settings, type User, type InsertUser, type Transaction, type InsertTransaction, type UpdateTransaction, type Settings, type InsertSettings } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
