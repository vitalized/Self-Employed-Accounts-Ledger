import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, updateTransactionSchema, insertCategorizationRuleSchema } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

const STARLING_API_BASE = "https://api.starlingbank.com/api/v2";
const STARLING_SANDBOX_API_BASE = "https://api-sandbox.starlingbank.com/api/v2";

// Token encryption for secure storage
const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  // Use environment variable for the encryption key
  // In production, this should be a strong randomly generated key stored securely
  const secret = process.env.STARLING_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    console.warn("Warning: No encryption key configured. Using derived key from DATABASE_URL.");
  }
  // Derive a 32-byte key from available secret or DATABASE_URL
  const baseSecret = secret || process.env.DATABASE_URL || "taxtrack-dev-mode";
  return crypto.scryptSync(baseSecret, crypto.createHash('sha256').update(baseSecret).digest(), 32);
}

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      // Handle legacy unencrypted tokens
      return encryptedText;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    // If decryption fails, assume it's a legacy unencrypted token
    console.warn("Token decryption failed, treating as legacy token");
    return encryptedText;
  }
}

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

  // ===== Transaction Notes API endpoints =====

  // Get all notes
  app.get("/api/notes", async (req, res) => {
    try {
      const notes = await storage.getNotes();
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // Set note for a description
  app.put("/api/notes", async (req, res) => {
    try {
      const { description, note } = req.body;
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: "Description is required" });
      }
      if (note === undefined || note === null || note === '') {
        // Delete note if empty
        await storage.deleteNote(description);
        return res.status(204).send();
      }
      const savedNote = await storage.setNote(description, note);
      res.json(savedNote);
    } catch (error) {
      console.error("Error saving note:", error);
      res.status(500).json({ error: "Failed to save note" });
    }
  });

  // ===== Categorization Rules API endpoints =====

  // Get all rules
  app.get("/api/rules", async (req, res) => {
    try {
      const rules = await storage.getRules();
      res.json(rules);
    } catch (error) {
      console.error("Error fetching rules:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });

  // Create rule
  app.post("/api/rules", async (req, res) => {
    try {
      const validatedData = insertCategorizationRuleSchema.parse(req.body);
      const rule = await storage.createRule(validatedData);
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid rule data", details: error.errors });
      }
      console.error("Error creating rule:", error);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });

  // Update rule
  app.patch("/api/rules/:id", async (req, res) => {
    try {
      const validatedData = insertCategorizationRuleSchema.partial().parse(req.body);
      const rule = await storage.updateRule(req.params.id, validatedData);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid rule data", details: error.errors });
      }
      console.error("Error updating rule:", error);
      res.status(500).json({ error: "Failed to update rule" });
    }
  });

  // Delete rule
  app.delete("/api/rules/:id", async (req, res) => {
    try {
      const success = await storage.deleteRule(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });

  // Apply all rules to existing transactions
  app.post("/api/rules/apply-all", async (req, res) => {
    try {
      const allTransactions = await storage.getTransactions();
      const rules = await storage.getRules();
      
      let updated = 0;
      
      for (const transaction of allTransactions) {
        const match = await storage.applyRulesToTransaction(transaction);
        if (match) {
          await storage.updateTransaction(transaction.id, {
            type: match.type,
            businessType: match.businessType,
            category: match.category,
          });
          updated++;
        }
      }
      
      res.json({ 
        success: true, 
        updated,
        message: `Applied rules to ${updated} transactions`
      });
    } catch (error) {
      console.error("Error applying rules:", error);
      res.status(500).json({ error: "Failed to apply rules" });
    }
  });

  // ===== Starling Bank API endpoints =====

  // Check Starling connection status
  app.get("/api/starling/status", async (req, res) => {
    try {
      const tokenSetting = await storage.getSetting("starling_token");
      if (!tokenSetting) {
        return res.json({ connected: false });
      }
      
      // Use the correct API based on sandbox setting
      const sandboxSetting = await storage.getSetting("starling_sandbox");
      const apiBase = sandboxSetting?.value === "true" ? STARLING_SANDBOX_API_BASE : STARLING_API_BASE;
      
      // Decrypt and verify token is still valid by making a test API call
      const decryptedToken = decrypt(tokenSetting.value);
      const response = await fetch(`${apiBase}/accounts`, {
        headers: {
          "Authorization": `Bearer ${decryptedToken}`,
          "Accept": "application/json"
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        res.json({ 
          connected: true, 
          accountCount: data.accounts?.length || 0,
          isSandbox: sandboxSetting?.value === "true"
        });
      } else {
        // Only remove token on 401 Unauthorized (token truly invalid)
        if (response.status === 401) {
          await storage.deleteSetting("starling_token");
          await storage.deleteSetting("starling_sandbox");
          res.json({ connected: false, reason: "Token expired or invalid" });
        } else {
          // Temporary error, don't delete token
          res.json({ connected: true, reason: "Temporary API error" });
        }
      }
    } catch (error) {
      console.error("Error checking Starling status:", error);
      // Network error - don't delete token, assume still connected
      res.json({ connected: true, reason: "Connection check failed" });
    }
  });

  // Connect to Starling (save and verify token)
  app.post("/api/starling/connect", async (req, res) => {
    try {
      const { token, useSandbox } = req.body;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Personal Access Token is required" });
      }

      const apiBase = useSandbox ? STARLING_SANDBOX_API_BASE : STARLING_API_BASE;
      
      // Verify the token by calling the accounts endpoint
      const response = await fetch(`${apiBase}/accounts`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Starling API error:", response.status, errorText);
        return res.status(401).json({ 
          error: "Invalid token", 
          message: "Could not authenticate with Starling Bank. Please check your Personal Access Token."
        });
      }

      const accountsData = await response.json();
      
      // Save the token securely (encrypted)
      await storage.setSetting("starling_token", encrypt(token));
      await storage.setSetting("starling_sandbox", useSandbox ? "true" : "false");

      res.json({ 
        success: true, 
        message: "Successfully connected to Starling Bank",
        accounts: accountsData.accounts?.length || 0
      });
    } catch (error) {
      console.error("Error connecting to Starling:", error);
      res.status(500).json({ error: "Failed to connect to Starling Bank" });
    }
  });

  // Disconnect from Starling
  app.post("/api/starling/disconnect", async (req, res) => {
    try {
      await storage.deleteSetting("starling_token");
      await storage.deleteSetting("starling_sandbox");
      res.json({ success: true, message: "Disconnected from Starling Bank" });
    } catch (error) {
      console.error("Error disconnecting from Starling:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // Sync transactions from Starling
  app.post("/api/starling/sync", async (req, res) => {
    try {
      const tokenSetting = await storage.getSetting("starling_token");
      const sandboxSetting = await storage.getSetting("starling_sandbox");
      
      if (!tokenSetting) {
        return res.status(401).json({ error: "Not connected to Starling Bank" });
      }

      const apiBase = sandboxSetting?.value === "true" ? STARLING_SANDBOX_API_BASE : STARLING_API_BASE;
      const token = decrypt(tokenSetting.value);

      // Get accounts
      const accountsRes = await fetch(`${apiBase}/accounts`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      if (!accountsRes.ok) {
        return res.status(401).json({ error: "Failed to fetch accounts. Token may be invalid." });
      }

      const accountsData = await accountsRes.json();
      const accounts = accountsData.accounts || [];
      
      if (accounts.length === 0) {
        return res.json({ success: true, imported: 0, message: "No accounts found" });
      }

      let totalImported = 0;

      for (const account of accounts) {
        const accountUid = account.accountUid;
        const categoryUid = account.defaultCategory;

        // Get transactions from the last 90 days (API limit)
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 90);
        
        const transactionsRes = await fetch(
          `${apiBase}/feed/account/${accountUid}/category/${categoryUid}?changesSince=${fromDate.toISOString()}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/json"
            }
          }
        );

        if (!transactionsRes.ok) {
          console.error("Failed to fetch transactions for account:", accountUid);
          continue;
        }

        const feedData = await transactionsRes.json();
        const feedItems = feedData.feedItems || [];

        // Get all existing transactions once for this sync
        const existingTransactions = await storage.getTransactions();
        
        for (const item of feedItems) {
          const feedItemUid = item.feedItemUid;
          
          // Check if we already have this transaction using full feedItemUid stored in tags
          const alreadyExists = existingTransactions.some(
            t => t.tags?.includes(`starling:${feedItemUid}`)
          );
          
          if (alreadyExists) continue;

          // Convert Starling feed item to our transaction format
          const isIncoming = item.direction === "IN";
          const amount = isIncoming 
            ? item.amount.minorUnits / 100 
            : -(item.amount.minorUnits / 100);

          // Default values
          let transactionType = isIncoming ? "Business" : "Unreviewed";
          let category = isIncoming ? "Sales" : null;
          let businessType: string | null = isIncoming ? "Income" : "Expense";

          // Check if any rules match this transaction
          const tempTransaction = {
            id: "",
            userId: null,
            date: new Date(item.transactionTime),
            description: item.counterPartyName || item.reference || "Unknown",
            reference: item.reference || null,
            amount: String(amount),
            merchant: item.counterPartyName || "Unknown",
            type: transactionType,
            category,
            businessType,
            status: "Cleared",
            tags: [],
            createdAt: new Date(),
          };
          
          const ruleMatch = await storage.applyRulesToTransaction(tempTransaction);
          if (ruleMatch) {
            transactionType = ruleMatch.type;
            businessType = ruleMatch.businessType;
            category = ruleMatch.category;
          }

          await storage.createTransaction({
            userId: null,
            date: new Date(item.transactionTime),
            description: item.counterPartyName || item.reference || "Unknown",
            reference: item.reference || null,
            amount: String(amount),
            merchant: item.counterPartyName || "Unknown",
            type: transactionType,
            category,
            businessType,
            status: item.status === "SETTLED" ? "Cleared" : "Pending",
            tags: [`starling:${feedItemUid}`],
          });

          totalImported++;
        }
      }

      // Save the last sync timestamp
      await storage.setLastSyncAt(new Date());
      
      res.json({ 
        success: true, 
        imported: totalImported, 
        message: `Imported ${totalImported} new transactions from Starling Bank`
      });
    } catch (error) {
      console.error("Error syncing from Starling:", error);
      res.status(500).json({ error: "Failed to sync transactions" });
    }
  });

  // Get sync status (last sync time)
  app.get("/api/sync-status", async (req, res) => {
    try {
      const lastSyncAt = await storage.getLastSyncAt();
      res.json({ lastSyncAt: lastSyncAt?.toISOString() || null });
    } catch (error) {
      console.error("Error fetching sync status:", error);
      res.status(500).json({ error: "Failed to fetch sync status" });
    }
  });

  // Backfill references for existing transactions
  app.post("/api/starling/backfill-references", async (req, res) => {
    try {
      const tokenSetting = await storage.getSetting("starling_token");
      const sandboxSetting = await storage.getSetting("starling_sandbox");
      
      if (!tokenSetting) {
        return res.status(401).json({ error: "Not connected to Starling Bank" });
      }

      const apiBase = sandboxSetting?.value === "true" ? STARLING_SANDBOX_API_BASE : STARLING_API_BASE;
      const token = decrypt(tokenSetting.value);

      // Get accounts
      const accountsRes = await fetch(`${apiBase}/accounts`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      if (!accountsRes.ok) {
        return res.status(401).json({ error: "Failed to fetch accounts. Token may be invalid." });
      }

      const accountsData = await accountsRes.json();
      const accounts = accountsData.accounts || [];
      
      if (accounts.length === 0) {
        return res.json({ success: true, updated: 0, message: "No accounts found" });
      }

      // Get all existing transactions
      const existingTransactions = await storage.getTransactions();
      let totalUpdated = 0;

      for (const account of accounts) {
        const accountUid = account.accountUid;
        const categoryUid = account.defaultCategory;

        // Get transactions from the last 90 days
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 90);
        
        const transactionsRes = await fetch(
          `${apiBase}/feed/account/${accountUid}/category/${categoryUid}?changesSince=${fromDate.toISOString()}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/json"
            }
          }
        );

        if (!transactionsRes.ok) {
          console.error("Failed to fetch transactions for account:", accountUid);
          continue;
        }

        const feedData = await transactionsRes.json();
        const feedItems = feedData.feedItems || [];

        for (const item of feedItems) {
          const feedItemUid = item.feedItemUid;
          const reference = item.reference || null;
          
                    
          // Find matching transaction in our database
          const matchingTx = existingTransactions.find(
            t => t.tags?.includes(`starling:${feedItemUid}`)
          );
          
          // Update if found and reference is missing or different
          if (matchingTx && reference && matchingTx.reference !== reference) {
            await storage.updateTransaction(matchingTx.id, { reference });
            totalUpdated++;
          }
        }
      }

      res.json({ 
        success: true, 
        updated: totalUpdated, 
        message: `Updated ${totalUpdated} transactions with references`
      });
    } catch (error) {
      console.error("Error backfilling references:", error);
      res.status(500).json({ error: "Failed to backfill references" });
    }
  });

  return httpServer;
}
