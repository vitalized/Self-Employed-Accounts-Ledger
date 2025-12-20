import { storage } from "./storage";
import { pool } from "./db";
import crypto from "crypto";

const STARLING_API_BASE = "https://api.starlingbank.com/api/v2";
const STARLING_SANDBOX_API_BASE = "https://api-sandbox.starlingbank.com/api/v2";

const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  const secret = process.env.STARLING_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) {
    console.warn("Warning: No encryption key configured. Using derived key from DATABASE_URL.");
  }
  const baseSecret = secret || process.env.DATABASE_URL || "taxtrack-dev-mode";
  return crypto.scryptSync(baseSecret, crypto.createHash('sha256').update(baseSecret).digest(), 32);
}

function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      return encryptedText;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.warn("Token decryption failed, treating as legacy token");
    return encryptedText;
  }
}

async function syncStarlingTransactions(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting Starling Bank sync...`);
  
  try {
    const tokenSetting = await storage.getSetting("starling_token");
    const sandboxSetting = await storage.getSetting("starling_sandbox");
    
    if (!tokenSetting) {
      console.log("No Starling token configured. Skipping sync.");
      return;
    }

    const apiBase = sandboxSetting?.value === "true" ? STARLING_SANDBOX_API_BASE : STARLING_API_BASE;
    const token = decrypt(tokenSetting.value);

    const accountsRes = await fetch(`${apiBase}/accounts`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });

    if (!accountsRes.ok) {
      console.error("Failed to fetch accounts. Token may be invalid.");
      return;
    }

    const accountsData = await accountsRes.json();
    const accounts = accountsData.accounts || [];
    
    if (accounts.length === 0) {
      console.log("No accounts found.");
      return;
    }

    let totalImported = 0;

    for (const account of accounts) {
      const accountUid = account.accountUid;
      const categoryUid = account.defaultCategory;

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

      const existingTransactions = await storage.getTransactions();
      
      for (const item of feedItems) {
        const feedItemUid = item.feedItemUid;
        
        const alreadyExists = existingTransactions.some(
          t => t.tags?.includes(`starling:${feedItemUid}`)
        );
        
        if (alreadyExists) continue;

        const isIncoming = item.direction === "IN";
        const amount = isIncoming 
          ? item.amount.minorUnits / 100 
          : -(item.amount.minorUnits / 100);

        const transactionType = isIncoming ? "Business" : "Unreviewed";

        await storage.createTransaction({
          userId: null,
          date: new Date(item.transactionTime),
          description: item.counterPartyName || item.reference || "Unknown",
          amount: String(amount),
          merchant: item.counterPartyName || "Unknown",
          type: transactionType,
          category: isIncoming ? "Sales" : null,
          businessType: isIncoming ? "Income" : "Expense",
          status: item.status === "SETTLED" ? "Cleared" : "Pending",
          tags: [`starling:${feedItemUid}`],
        });

        totalImported++;
      }
    }

    console.log(`[${new Date().toISOString()}] Sync complete. Imported ${totalImported} new transactions.`);
  } catch (error) {
    console.error("Error during Starling sync:", error);
  }
}

syncStarlingTransactions()
  .then(async () => {
    console.log("Sync job finished.");
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Sync job failed:", error);
    await pool.end();
    process.exit(1);
  });
