import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, updateTransactionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all transactions
  app.get("/api/transactions", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Get single transaction
  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  });

  // Create transaction
  app.post("/api/transactions", async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid transaction data", details: error.errors });
      }
      console.error("Error creating transaction:", error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  // Update transaction
  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const validatedData = updateTransactionSchema.parse(req.body);
      const transaction = await storage.updateTransaction(req.params.id, validatedData);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid transaction data", details: error.errors });
      }
      console.error("Error updating transaction:", error);
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  // Delete transaction
  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const success = await storage.deleteTransaction(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Seed database with sample data
  app.post("/api/seed", async (req, res) => {
    try {
      // Generate sample transactions
      const merchants = [
        { name: 'Client Payment Ref: 9932', type: 'Business', businessType: 'Income' },
        { name: 'Stripe Payments UK', type: 'Business', businessType: 'Income' },
        { name: 'Shopify Sales', type: 'Business', businessType: 'Income' },
        { name: 'Upwork Earning', type: 'Business', businessType: 'Income' },
        { name: 'Apple Store', type: 'Business', businessType: 'Expense' },
        { name: 'Adobe Creative Cloud', type: 'Business', businessType: 'Expense' },
        { name: 'Google Ads', type: 'Business', businessType: 'Expense' },
        { name: 'WeWork', type: 'Business', businessType: 'Expense' },
        { name: 'Uber Trip', type: 'Business', businessType: 'Expense' },
        { name: 'Shell Garage', type: 'Business', businessType: 'Expense' },
        { name: 'Waitrose', type: 'Personal', businessType: null },
        { name: 'Amazon', type: 'Unreviewed', businessType: null },
        { name: 'Tesco', type: 'Personal', businessType: null },
        { name: 'Netflix', type: 'Personal', businessType: null },
      ];

      const categories: Record<string, string[]> = {
        Income: ['Sales', 'Consulting'],
        Expense: ['Software', 'Office Supplies', 'Travel', 'Equipment'],
        Personal: ['Groceries', 'Entertainment', 'Shopping'],
      };

      const created = [];
      const now = new Date();

      // Generate 100 transactions over the last 12 months
      for (let i = 0; i < 100; i++) {
        const daysAgo = Math.floor(Math.random() * 365);
        const date = new Date(now);
        date.setDate(date.getDate() - daysAgo);
        
        const merchant = merchants[Math.floor(Math.random() * merchants.length)];
        const isIncome = merchant.businessType === 'Income';
        
        let amount: number;
        if (isIncome) {
          amount = Math.floor(Math.random() * 2500) + 500;
        } else {
          amount = -(Math.floor(Math.random() * 300) + 20);
        }

        let category = null;
        if (merchant.businessType === 'Income') {
          const cats = categories.Income;
          category = cats[Math.floor(Math.random() * cats.length)];
        } else if (merchant.businessType === 'Expense') {
          const cats = categories.Expense;
          category = cats[Math.floor(Math.random() * cats.length)];
        } else if (merchant.type === 'Personal') {
          const cats = categories.Personal;
          category = cats[Math.floor(Math.random() * cats.length)];
        }

        const transaction = await storage.createTransaction({
          userId: null,
          date,
          description: merchant.name,
          amount: String(amount),
          merchant: merchant.name,
          type: merchant.type,
          category,
          businessType: merchant.businessType || null,
          status: 'Cleared',
          tags: [],
        });

        created.push(transaction);
      }

      res.json({ message: `Seeded ${created.length} transactions`, count: created.length });
    } catch (error) {
      console.error("Error seeding database:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  return httpServer;
}
