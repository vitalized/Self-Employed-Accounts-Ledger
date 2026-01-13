import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertTransactionSchema, updateTransactionSchema, insertCategorizationRuleSchema, insertCategorySchema, insertBusinessSchema, users, passwordCredentials, authSessions, emailVerificationCodes } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { authService, isAuthenticated, require2FA, requireRole } from "./auth";

const STARLING_API_BASE = "https://api.starlingbank.com/api/v2";
const STARLING_SANDBOX_API_BASE = "https://api-sandbox.starlingbank.com/api/v2";

// Shared utility to create transaction fingerprint for duplicate detection
// Note: Reference is intentionally excluded from fingerprint because Starling API
// often returns null for reference while CSV exports include reference values,
// causing the same transaction to have different fingerprints between sources.
function createTransactionFingerprint(date: Date, amount: string | number, description: string, _reference?: string | null): string {
  const dateStr = date.toISOString().split('T')[0];
  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  const normalized = `${dateStr}|${amountNum.toFixed(2)}|${description.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
}

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
  
  // ===================
  // AUTH ROUTES
  // ===================

  // Check if initial setup is needed (no admin exists)
  app.get("/api/auth/needs-setup", async (req, res) => {
    try {
      const adminExists = await authService.checkIfAdminExists();
      res.json({ needsSetup: !adminExists });
    } catch (error) {
      console.error("Error checking setup status:", error);
      res.status(500).json({ error: "Failed to check setup status" });
    }
  });

  // Initial setup - creates first admin account
  app.post("/api/auth/initial-setup", async (req, res) => {
    try {
      const adminExists = await authService.checkIfAdminExists();
      if (adminExists) {
        return res.status(400).json({ error: "Setup already complete", message: "An admin account already exists" });
      }

      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
      });

      const data = schema.parse(req.body);

      const user = await authService.createUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: "admin",
        twoFactorMethod: null, // User will choose 2FA method in next step
        isActive: true,
      });

      await authService.createPasswordCredential(user.id, data.password);

      const session = await authService.createSession(
        user.id,
        req.ip,
        req.headers["user-agent"]
      );

      await authService.updateLastLogin(user.id);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        sessionToken: session.sessionToken,
        requires2FA: !!user.twoFactorMethod,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error during initial setup:", error);
      res.status(500).json({ error: "Failed to complete setup" });
    }
  });

  // Login with email/password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
      });

      const data = schema.parse(req.body);

      const user = await authService.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(401).json({ error: "Account disabled" });
      }

      const credential = await authService.getPasswordCredential(user.id);
      if (!credential) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await authService.verifyPassword(data.password, credential.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const session = await authService.createSession(
        user.id,
        req.ip,
        req.headers["user-agent"]
      );

      await authService.updateLastLogin(user.id);

      if (user.twoFactorMethod === "email") {
        await authService.generateVerificationCode(user.id, "two_factor", user.email);
        return res.json({
          sessionToken: session.sessionToken,
          requires2FA: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
        });
      }

      res.json({
        sessionToken: session.sessionToken,
        requires2FA: false,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error during login:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Logout
  app.post("/api/auth/logout", isAuthenticated, async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (sessionToken) {
        await authService.invalidateSession(sessionToken);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  // Verify 2FA code
  app.post("/api/auth/2fa/verify", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        code: z.string().length(6),
      });

      const data = schema.parse(req.body);

      const isValid = await authService.verifyCode(req.user!.id, data.code);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid or expired code" });
      }

      const authHeader = req.headers.authorization;
      const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (sessionToken) {
        await authService.markSessionAs2FAVerified(sessionToken);
      }

      res.json({ success: true, verified: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error verifying 2FA code:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  });

  // Resend 2FA code
  app.post("/api/auth/2fa/resend", isAuthenticated, async (req, res) => {
    try {
      if (!req.user!.twoFactorMethod) {
        return res.status(400).json({ error: "2FA not enabled for this user" });
      }

      await authService.generateVerificationCode(req.user!.id, "two_factor", req.user!.email);

      res.json({ success: true, message: "Verification code sent" });
    } catch (error) {
      console.error("Error resending 2FA code:", error);
      res.status(500).json({ error: "Failed to resend code" });
    }
  });

  // Get current authenticated user
  app.get("/api/auth/me", isAuthenticated, require2FA, async (req, res) => {
    try {
      const user = req.user!;
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
        twoFactorMethod: user.twoFactorMethod,
        lastLoginAt: user.lastLoginAt,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ===================
  // 2FA SETUP & WEBAUTHN ROUTES
  // ===================

  // Store WebAuthn challenges in memory (in production, use Redis or database)
  const webauthnChallenges = new Map<string, { challenge: string; expiresAt: Date }>();

  // Setup 2FA method
  app.post("/api/auth/2fa/setup", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        method: z.enum(["email", "webauthn"]),
      });

      const data = schema.parse(req.body);

      if (data.method === "email") {
        await authService.update2FAMethod(req.user!.id, "email");
        await authService.markSessionAs2FAVerified(req.session!.sessionToken);
        res.json({ success: true });
      } else {
        return res.status(400).json({ error: "Use WebAuthn registration endpoints for passkey setup" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error setting up 2FA:", error);
      res.status(500).json({ error: "Failed to setup 2FA" });
    }
  });

  // Disable 2FA
  app.delete("/api/auth/2fa", isAuthenticated, require2FA, async (req, res) => {
    try {
      await authService.update2FAMethod(req.user!.id, null);
      res.json({ success: true });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      res.status(500).json({ error: "Failed to disable 2FA" });
    }
  });

  // Get WebAuthn registration options
  app.get("/api/auth/webauthn/register/options", isAuthenticated, async (req, res) => {
    try {
      const options = await authService.generateWebAuthnRegistrationOptions(req.user!);
      
      webauthnChallenges.set(req.user!.id, {
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      res.json(options);
    } catch (error) {
      console.error("Error generating WebAuthn registration options:", error);
      res.status(500).json({ error: "Failed to generate registration options" });
    }
  });

  // Verify WebAuthn registration
  app.post("/api/auth/webauthn/register", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        response: z.any(),
        deviceName: z.string().optional(),
      });

      const data = schema.parse(req.body);

      const challengeData = webauthnChallenges.get(req.user!.id);
      if (!challengeData || challengeData.expiresAt < new Date()) {
        return res.status(400).json({ error: "Challenge expired or not found" });
      }

      const verification = await authService.verifyWebAuthnRegistration(
        req.user!,
        data.response,
        challengeData.challenge,
        data.deviceName
      );

      webauthnChallenges.delete(req.user!.id);

      if (verification.verified) {
        await authService.markSessionAs2FAVerified(req.session!.sessionToken);
        res.json({ success: true, verified: true });
      } else {
        res.status(400).json({ error: "Verification failed" });
      }
    } catch (error) {
      console.error("Error verifying WebAuthn registration:", error);
      res.status(500).json({ error: "Failed to verify registration", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Get passkey credentials
  app.get("/api/auth/webauthn/credentials", isAuthenticated, require2FA, async (req, res) => {
    try {
      const credentials = await authService.getPasskeyCredentials(req.user!.id);
      res.json(credentials.map(c => ({
        id: c.id,
        deviceName: c.deviceName,
        deviceType: c.deviceType,
        createdAt: c.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching credentials:", error);
      res.status(500).json({ error: "Failed to fetch credentials" });
    }
  });

  // Delete passkey credential
  app.delete("/api/auth/webauthn/credentials/:id", isAuthenticated, require2FA, async (req, res) => {
    try {
      await authService.deletePasskeyCredential(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting credential:", error);
      res.status(500).json({ error: "Failed to delete credential" });
    }
  });

  // Get WebAuthn authentication options (for 2FA verification - user already authenticated)
  app.post("/api/auth/webauthn/authenticate/options", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;

      if (user.twoFactorMethod !== 'webauthn') {
        return res.status(400).json({ error: "WebAuthn 2FA is not enabled for this user" });
      }

      const options = await authService.generateWebAuthnAuthenticationOptions(user);
      
      // Store challenge with session-specific key to prevent replay attacks
      const sessionKey = `auth_${user.id}_${req.session!.sessionToken}`;
      webauthnChallenges.set(sessionKey, {
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      res.json(options);
    } catch (error) {
      console.error("Error generating WebAuthn auth options:", error);
      res.status(500).json({ error: "Failed to generate authentication options" });
    }
  });

  // Verify WebAuthn authentication (for 2FA verification)
  app.post("/api/auth/webauthn/authenticate", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const sessionKey = `auth_${user.id}_${req.session!.sessionToken}`;
      
      const challengeData = webauthnChallenges.get(sessionKey);
      if (!challengeData) {
        return res.status(400).json({ error: "No authentication challenge found. Please try again." });
      }
      
      if (challengeData.expiresAt < new Date()) {
        webauthnChallenges.delete(sessionKey);
        return res.status(400).json({ error: "Challenge expired. Please try again." });
      }

      const { verification, userId } = await authService.verifyWebAuthnAuthentication(
        req.body,
        challengeData.challenge
      );

      // Always delete the challenge after use to prevent replay attacks
      webauthnChallenges.delete(sessionKey);

      if (verification.verified && userId === user.id) {
        await authService.markSessionAs2FAVerified(req.session!.sessionToken);
        res.json({ success: true, verified: true });
      } else {
        res.status(400).json({ error: "Verification failed. Please try again." });
      }
    } catch (error) {
      console.error("Error verifying WebAuthn authentication:", error);
      res.status(500).json({ error: "Authentication failed", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ===================
  // END AUTH ROUTES
  // ===================

  // ===================
  // USER MANAGEMENT ROUTES (Admin only)
  // ===================

  // List all users
  app.get("/api/users", isAuthenticated, require2FA, requireRole("admin"), async (req, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(users.createdAt);
      res.json(allUsers.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Create new user
  app.post("/api/users", isAuthenticated, require2FA, requireRole("admin"), async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.enum(["admin", "accountant"]).default("accountant"),
      });

      const data = schema.parse(req.body);

      const existingUser = await authService.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }

      const temporaryPassword = crypto.randomBytes(8).toString("hex");

      const user = await authService.createUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        twoFactorMethod: "email",
        isActive: true,
      });

      const passwordHash = await authService.hashPassword(temporaryPassword);
      await db.insert(passwordCredentials).values({
        userId: user.id,
        passwordHash,
        mustChangePassword: true,
      });

      console.log(`[ADMIN] Created user ${user.email} with temporary password: ${temporaryPassword}`);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
        temporaryPassword,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Update user (role, isActive)
  app.patch("/api/users/:id", isAuthenticated, require2FA, requireRole("admin"), async (req, res) => {
    try {
      const userId = req.params.id;
      
      const schema = z.object({
        role: z.enum(["admin", "accountant"]).optional(),
        isActive: z.boolean().optional(),
      });

      const data = schema.parse(req.body);

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const [updatedUser] = await db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        lastLoginAt: updatedUser.lastLoginAt,
        createdAt: updatedUser.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/users/:id", isAuthenticated, require2FA, requireRole("admin"), async (req, res) => {
    try {
      const userId = req.params.id;

      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      await db.delete(passwordCredentials).where(eq(passwordCredentials.userId, userId));
      await db.delete(authSessions).where(eq(authSessions.userId, userId));
      await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, userId));
      
      const [deletedUser] = await db.delete(users).where(eq(users.id, userId)).returning();

      if (!deletedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ success: true, message: "User deleted" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ===================
  // END USER MANAGEMENT ROUTES
  // ===================

  // Get available tax years based on transaction dates
  app.get("/api/tax-years", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      
      // UK tax year runs from April 6 to April 5
      // Calculate which tax years have transactions
      const taxYears = new Set<string>();
      
      for (const tx of transactions) {
        const date = new Date(tx.date);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-indexed
        const day = date.getDate();
        
        // If before April 6, it's the previous tax year
        // Tax year 2024-25 is from April 6 2024 to April 5 2025
        let taxYearStart: number;
        if (month < 3 || (month === 3 && day < 6)) {
          // Before April 6 - belongs to previous tax year
          taxYearStart = year - 1;
        } else {
          // April 6 onwards - belongs to current tax year
          taxYearStart = year;
        }
        
        taxYears.add(`${taxYearStart}-${(taxYearStart + 1).toString().slice(-2)}`);
      }
      
      // Sort tax years in descending order (most recent first)
      const sortedTaxYears = Array.from(taxYears).sort((a, b) => {
        const yearA = parseInt(a.split('-')[0]);
        const yearB = parseInt(b.split('-')[0]);
        return yearB - yearA;
      });
      
      res.json(sortedTaxYears);
    } catch (error) {
      console.error("Error fetching tax years:", error);
      res.status(500).json({ error: "Failed to fetch tax years" });
    }
  });

  // VAT threshold tracker - calculate rolling 12-month business income
  app.get("/api/vat-tracker", async (req, res) => {
    try {
      const endMonth = req.query.endMonth as string | undefined;
      const transactions = await storage.getTransactions();
      
      // Parse end month or default to current month
      let endDate: Date;
      if (endMonth && /^\d{4}-\d{2}$/.test(endMonth)) {
        const [year, month] = endMonth.split('-').map(Number);
        endDate = new Date(year, month - 1, 1); // First of the specified month
      } else {
        endDate = new Date();
      }
      
      // Calculate the 12-month window
      const endOfWindow = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0); // Last day of end month
      const startOfWindow = new Date(endDate.getFullYear(), endDate.getMonth() - 11, 1); // First day, 12 months back
      
      // Filter to business income only within the window
      const businessIncomeTransactions = transactions.filter(tx => {
        if (tx.type !== 'Business' || tx.businessType !== 'Income') return false;
        const txDate = new Date(tx.date);
        return txDate >= startOfWindow && txDate <= endOfWindow;
      });
      
      // Calculate monthly breakdown - only count positive amounts (actual income, not refunds)
      const monthlyBreakdown: Record<string, number> = {};
      let totalIncome = 0;
      
      for (const tx of businessIncomeTransactions) {
        const txDate = new Date(tx.date);
        const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
        const amount = Number(tx.amount);
        // Only count positive income amounts for VAT threshold
        if (amount > 0) {
          monthlyBreakdown[monthKey] = (monthlyBreakdown[monthKey] || 0) + amount;
          totalIncome += amount;
        }
      }
      
      // Determine warning status
      const VAT_THRESHOLD = 90000;
      const APPROACHING_THRESHOLD = 75000;
      const DANGER_THRESHOLD = 85000;
      
      let status: 'safe' | 'approaching' | 'danger' | 'exceeded';
      if (totalIncome >= VAT_THRESHOLD) {
        status = 'exceeded';
      } else if (totalIncome >= DANGER_THRESHOLD) {
        status = 'danger';
      } else if (totalIncome >= APPROACHING_THRESHOLD) {
        status = 'approaching';
      } else {
        status = 'safe';
      }
      
      // Format response
      const windowStart = `${startOfWindow.getFullYear()}-${String(startOfWindow.getMonth() + 1).padStart(2, '0')}`;
      const windowEnd = `${endOfWindow.getFullYear()}-${String(endOfWindow.getMonth() + 1).padStart(2, '0')}`;
      
      res.json({
        totalIncome,
        threshold: VAT_THRESHOLD,
        percentOfThreshold: Math.round((totalIncome / VAT_THRESHOLD) * 100),
        status,
        windowStart,
        windowEnd,
        monthlyBreakdown,
        remainingBeforeVAT: Math.max(0, VAT_THRESHOLD - totalIncome)
      });
    } catch (error) {
      console.error("Error calculating VAT tracker:", error);
      res.status(500).json({ error: "Failed to calculate VAT tracker" });
    }
  });

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
      
      // Generate fingerprint for duplicate detection
      const date = new Date(validatedData.date);
      const fingerprint = createTransactionFingerprint(
        date,
        validatedData.amount,
        validatedData.description,
        validatedData.reference || null
      );
      
      const transaction = await storage.createTransactionWithFingerprint(validatedData, fingerprint);
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

        // Generate fingerprint for duplicate detection
        const fingerprint = createTransactionFingerprint(date, amount, merchant.name, null);
        
        const transaction = await storage.createTransactionWithFingerprint({
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
        }, fingerprint);

        created.push(transaction);
      }

      res.json({ message: `Seeded ${created.length} transactions`, count: created.length });
    } catch (error) {
      console.error("Error seeding database:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  // ===== Transaction Notes API endpoints =====

  // Get all notes (both description-based and transaction-specific)
  app.get("/api/notes", async (req, res) => {
    try {
      const notes = await storage.getNotes();
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  // Get note for a specific transaction
  app.get("/api/notes/transaction/:transactionId", async (req, res) => {
    try {
      const note = await storage.getNoteByTransactionId(req.params.transactionId);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.json(note);
    } catch (error) {
      console.error("Error fetching note:", error);
      res.status(500).json({ error: "Failed to fetch note" });
    }
  });

  // Create or update note - supports both description-based and transaction-specific notes
  app.post("/api/notes", async (req, res) => {
    try {
      const { description, transactionId, note } = req.body;
      
      if (!note || typeof note !== 'string') {
        return res.status(400).json({ error: "Note text is required" });
      }
      
      if (transactionId && typeof transactionId === 'string') {
        // Transaction-specific note
        const savedNote = await storage.setNoteForTransaction(transactionId, note);
        return res.status(201).json(savedNote);
      } else if (description && typeof description === 'string') {
        // Description-based note (applies to all matching transactions)
        const savedNote = await storage.setNote(description, note);
        return res.status(201).json(savedNote);
      } else {
        return res.status(400).json({ error: "Either description or transactionId is required" });
      }
    } catch (error) {
      console.error("Error saving note:", error);
      res.status(500).json({ error: "Failed to save note" });
    }
  });

  // Set note for a description (legacy PUT endpoint for backward compatibility)
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

  // Delete note by ID
  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const success = await storage.deleteNoteById(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Failed to delete note" });
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
          // Only count as updated if any field actually changes
          const typeChanged = transaction.type !== match.type;
          const businessTypeChanged = transaction.businessType !== match.businessType;
          const categoryChanged = transaction.category !== match.category;
          
          if (typeChanged || businessTypeChanged || categoryChanged) {
            await storage.updateTransaction(transaction.id, {
              type: match.type,
              businessType: match.businessType,
              category: match.category,
            });
            updated++;
          }
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

  // ===== Categories API endpoints =====

  // Get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const cats = await storage.getCategories();
      res.json(cats);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Create category
  app.post("/api/categories", async (req, res) => {
    try {
      const data = { ...req.body };
      
      // Auto-generate unique code if not provided
      if (!data.code) {
        const timestamp = Date.now().toString(36).slice(-6).toUpperCase();
        if (data.type === "Expense" && data.hmrcBox) {
          data.code = `${data.hmrcBox}-${timestamp}`;
        } else {
          data.code = `I-${timestamp}`;
        }
      }
      
      const validatedData = insertCategorySchema.parse(data);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Update category
  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(req.params.id, validatedData);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  // Delete category with reassignment
  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { reassignTo } = req.query;
      
      // Get the category being deleted
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      // If reassignTo is specified, reassign all transactions
      let reassigned = 0;
      if (reassignTo && typeof reassignTo === 'string') {
        reassigned = await storage.reassignTransactionCategory(category.label, reassignTo);
      }
      
      const success = await storage.deleteCategory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      res.json({ success: true, reassigned, message: reassigned > 0 ? `Deleted category and reassigned ${reassigned} transactions` : 'Category deleted' });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Get transaction count for a category
  app.get("/api/categories/:id/count", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      const transactions = await storage.getTransactions();
      const count = transactions.filter(t => t.category === category.label).length;
      res.json({ count });
    } catch (error) {
      console.error("Error counting transactions:", error);
      res.status(500).json({ error: "Failed to count transactions" });
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
      let totalStatusUpdated = 0;

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
        const excludedFingerprintsSet = await storage.getExcludedFingerprints();
        
        for (const item of feedItems) {
          const feedItemUid = item.feedItemUid;
          
          // Check if we already have this transaction using full feedItemUid stored in tags
          const existingTx = existingTransactions.find(
            t => t.tags?.includes(`starling:${feedItemUid}`)
          );
          
          if (existingTx) {
            // Update status if it changed from Pending to Cleared
            // Starling statuses: PENDING, SETTLED, REVERSED, DECLINED, REFUNDED, RETRYING, ACCOUNT_CHECK
            // Any non-PENDING status means the transaction is no longer awaiting settlement
            const isNoLongerPending = item.status !== "PENDING";
            if (existingTx.status === "Pending" && isNoLongerPending) {
              await storage.updateTransaction(existingTx.id, { status: "Cleared" });
              totalStatusUpdated++;
            }
            continue;
          }
          
          // Check if this transaction fingerprint is excluded (user deleted and marked do not reimport)
          const checkTxDate = new Date(item.transactionTime);
          const checkTxDesc = item.counterPartyName || item.reference || "Unknown";
          const checkTxAmount = item.direction === "IN" 
            ? item.amount.minorUnits / 100 
            : -(item.amount.minorUnits / 100);
          const checkTxRef = item.reference || null;
          const checkFingerprint = createTransactionFingerprint(checkTxDate, checkTxAmount, checkTxDesc, checkTxRef);
          
          if (excludedFingerprintsSet.has(checkFingerprint)) {
            console.log(`Skipping excluded transaction: ${checkTxDesc} on ${checkTxDate.toISOString()}`);
            continue;
          }

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
            tags: [] as string[],
            fingerprint: null as string | null,
            createdAt: new Date(),
          };
          
          const ruleMatch = await storage.applyRulesToTransaction(tempTransaction);
          if (ruleMatch) {
            transactionType = ruleMatch.type;
            businessType = ruleMatch.businessType;
            category = ruleMatch.category;
          }

          // Generate fingerprint for duplicate detection
          const txDate = new Date(item.transactionTime);
          const txDescription = item.counterPartyName || item.reference || "Unknown";
          const txReference = item.reference || null;
          const fingerprint = createTransactionFingerprint(txDate, amount, txDescription, txReference);

          await storage.createTransactionWithFingerprint({
            userId: null,
            date: txDate,
            description: txDescription,
            reference: txReference,
            amount: String(amount),
            merchant: item.counterPartyName || "Unknown",
            type: transactionType,
            category,
            businessType,
            status: item.status !== "PENDING" ? "Cleared" : "Pending",
            tags: [`starling:${feedItemUid}`],
          }, fingerprint);

          totalImported++;
        }
      }

      // Save the last sync timestamp
      await storage.setLastSyncAt(new Date());
      
      const messageParts = [];
      if (totalImported > 0) {
        messageParts.push(`Imported ${totalImported} new transaction${totalImported === 1 ? '' : 's'}`);
      }
      if (totalStatusUpdated > 0) {
        messageParts.push(`Updated ${totalStatusUpdated} pending transaction${totalStatusUpdated === 1 ? '' : 's'} to cleared`);
      }
      const message = messageParts.length > 0 
        ? messageParts.join('. ') 
        : 'All transactions are up to date';
      
      res.json({ 
        success: true, 
        imported: totalImported,
        statusUpdated: totalStatusUpdated,
        message
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

  // ===== Backfill fingerprints for existing transactions =====
  app.post("/api/transactions/backfill-fingerprints", async (req, res) => {
    try {
      const allTransactions = await storage.getTransactions();
      let updated = 0;
      
      for (const tx of allTransactions) {
        // Skip if already has fingerprint
        if (tx.fingerprint) continue;
        
        // Compute fingerprint
        const fingerprint = createTransactionFingerprint(
          tx.date,
          tx.amount,
          tx.description,
          tx.reference
        );
        
        // Update transaction with fingerprint
        await storage.updateTransaction(tx.id, { fingerprint } as any);
        updated++;
      }
      
      res.json({
        success: true,
        updated,
        total: allTransactions.length,
        message: `Added fingerprints to ${updated} transactions`
      });
    } catch (error) {
      console.error("Error backfilling fingerprints:", error);
      res.status(500).json({ error: "Failed to backfill fingerprints" });
    }
  });

  // ===== CSV Import endpoint =====
  app.post("/api/import/csv", async (req, res) => {
    try {
      const { csvContent } = req.body;
      
      if (!csvContent || typeof csvContent !== "string") {
        return res.status(400).json({ error: "CSV content is required" });
      }

      // Parse CSV (Starling format: Date,Counter Party,Reference,Type,Amount (GBP),Balance (GBP),Spending Category,Notes)
      const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must have a header and at least one data row" });
      }

      // Validate header
      const header = lines[0].toLowerCase();
      if (!header.includes('date') || !header.includes('counter party') || !header.includes('amount')) {
        return res.status(400).json({ error: "Invalid CSV format. Expected Starling Bank statement format." });
      }

      // Get existing fingerprints and excluded fingerprints to check for duplicates
      const existingFingerprints = await storage.getExistingFingerprints();
      const excludedFingerprints = await storage.getExcludedFingerprints();

      // Parse CSV rows
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      let imported = 0;
      let skipped = 0;
      let categorized = 0;
      const errors: string[] = [];
      const skippedTransactions: Array<{date: string, description: string, amount: number, reason: string}> = [];
      
      // Track fingerprints of transactions added in this batch
      // This prevents the fuzzy duplicate check from matching newly-imported rows against each other
      const currentBatchFingerprints = new Set<string>();

      for (let i = 1; i < lines.length; i++) {
        try {
          const fields = parseCSVLine(lines[i]);
          
          // Expected fields: Date, Counter Party, Reference, Type, Amount (GBP), Balance (GBP), Spending Category, Notes
          if (fields.length < 5) {
            errors.push(`Line ${i + 1}: Not enough fields`);
            continue;
          }

          const [dateStr, counterParty, reference, txType, amountStr] = fields;
          
          // Parse date (DD/MM/YYYY format)
          const dateParts = dateStr.split('/');
          if (dateParts.length !== 3) {
            errors.push(`Line ${i + 1}: Invalid date format`);
            continue;
          }
          const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T00:00:00Z`);
          
          if (isNaN(date.getTime())) {
            errors.push(`Line ${i + 1}: Invalid date`);
            continue;
          }

          // Parse amount - convert comma format if needed and handle negative
          const cleanAmount = amountStr.replace(/,/g, '').replace(/£/g, '').trim();
          const amount = parseFloat(cleanAmount);
          
          if (isNaN(amount)) {
            errors.push(`Line ${i + 1}: Invalid amount`);
            continue;
          }

          // Create fingerprint for duplicate detection
          const fingerprint = createTransactionFingerprint(date, amount, counterParty, reference);
          
          // Check if this transaction is excluded (user deleted and marked as do not reimport)
          if (excludedFingerprints.has(fingerprint)) {
            skipped++;
            skippedTransactions.push({
              date: dateStr,
              description: counterParty,
              amount,
              reason: "Transaction excluded by user (do not reimport)"
            });
            continue;
          }
          
          // Check if this transaction already exists (exact fingerprint match in DB or current batch)
          if (existingFingerprints.has(fingerprint)) {
            skipped++;
            skippedTransactions.push({
              date: dateStr,
              description: counterParty,
              amount,
              reason: "Exact fingerprint match (already imported)"
            });
            continue;
          }
          
          // Also check for potential duplicates within +/- 1 day (handles Starling API vs CSV date discrepancy)
          // Exclude fingerprints from current batch so we don't self-collide
          const potentialDuplicate = await storage.findPotentialDuplicate(date, amount, counterParty, reference, currentBatchFingerprints);
          if (potentialDuplicate) {
            skipped++;
            const matchDate = new Date(potentialDuplicate.date).toLocaleDateString('en-GB');
            skippedTransactions.push({
              date: dateStr,
              description: counterParty,
              amount,
              reason: `Fuzzy match: API transaction on ${matchDate} (${potentialDuplicate.description}, £${potentialDuplicate.amount})`
            });
            continue;
          }

          // Determine initial transaction type based on amount
          const isIncome = amount > 0;
          let type = isIncome ? "Business" : "Unreviewed";
          let businessType: string | null = isIncome ? "Income" : "Expense";
          let category: string | null = isIncome ? "Sales" : null;

          // Build temp transaction for rule matching
          const tempTransaction = {
            id: "",
            userId: null,
            date,
            description: counterParty,
            reference: reference || null,
            amount: String(amount),
            merchant: counterParty,
            type,
            category,
            businessType,
            status: "Cleared",
            tags: [],
            fingerprint: null,
            createdAt: new Date(),
          };

          // Apply categorization rules
          const ruleMatch = await storage.applyRulesToTransaction(tempTransaction);
          if (ruleMatch) {
            type = ruleMatch.type;
            businessType = ruleMatch.businessType;
            category = ruleMatch.category;
            categorized++;
          }

          // Create the transaction
          await storage.createTransactionWithFingerprint({
            userId: null,
            date,
            description: counterParty,
            reference: reference || null,
            amount: String(amount),
            merchant: counterParty,
            type,
            category,
            businessType,
            status: "Cleared",
            tags: ["import:csv"],
          }, fingerprint);

          // Add fingerprint to batch set to prevent fuzzy match from matching other CSV rows
          // Note: We do NOT add to existingFingerprints - CSV is source of truth, so we only
          // check for duplicates against pre-existing database transactions, not other CSV rows
          currentBatchFingerprints.add(fingerprint);
          imported++;
        } catch (rowError) {
          errors.push(`Line ${i + 1}: ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
        }
      }

      res.json({
        success: true,
        imported,
        skipped,
        categorized,
        total: lines.length - 1,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        skippedTransactions: skippedTransactions.length > 0 ? skippedTransactions : undefined,
        message: `Imported ${imported} transactions (${skipped} duplicates skipped, ${categorized} auto-categorized)`
      });
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV" });
    }
  });

  // =========== Mileage Trips API ===========
  
  // Get all mileage trips
  app.get("/api/mileage-trips", async (req, res) => {
    try {
      const trips = await storage.getMileageTrips();
      res.json(trips);
    } catch (error) {
      console.error("Error fetching mileage trips:", error);
      res.status(500).json({ error: "Failed to fetch mileage trips" });
    }
  });

  // Get mileage summary for a tax year
  app.get("/api/mileage-summary", async (req, res) => {
    try {
      const { taxYear } = req.query;
      
      // Parse tax year (format: "2024-25")
      let taxYearStart: Date;
      let taxYearEnd: Date;
      
      if (taxYear && typeof taxYear === 'string') {
        const startYear = parseInt(taxYear.split('-')[0]);
        taxYearStart = new Date(startYear, 3, 6); // April 6
        taxYearEnd = new Date(startYear + 1, 3, 5, 23, 59, 59); // April 5 next year
      } else {
        // Default to current tax year
        const now = new Date();
        const startYear = now.getMonth() >= 3 && now.getDate() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
        taxYearStart = new Date(startYear, 3, 6);
        taxYearEnd = new Date(startYear + 1, 3, 5, 23, 59, 59);
      }
      
      const totalMiles = await storage.getMileageTotalForTaxYear(taxYearStart, taxYearEnd);
      
      // Calculate HMRC mileage allowance (45p first 10,000 miles, 25p thereafter)
      let allowance = 0;
      if (totalMiles <= 10000) {
        allowance = totalMiles * 0.45;
      } else {
        allowance = (10000 * 0.45) + ((totalMiles - 10000) * 0.25);
      }
      
      // Get all trips in the tax year range for the list
      const allTrips = await storage.getMileageTrips();
      const tripsInYear = allTrips.filter(t => {
        const tripDate = new Date(t.date);
        return tripDate >= taxYearStart && tripDate <= taxYearEnd;
      });
      
      res.json({
        taxYear: taxYear || `${taxYearStart.getFullYear()}-${String(taxYearEnd.getFullYear()).slice(-2)}`,
        totalMiles,
        allowance: parseFloat(allowance.toFixed(2)),
        tripCount: tripsInYear.length,
        trips: tripsInYear
      });
    } catch (error) {
      console.error("Error calculating mileage summary:", error);
      res.status(500).json({ error: "Failed to calculate mileage summary" });
    }
  });

  // Get mileage trip by transaction ID
  app.get("/api/mileage-trips/by-transaction/:transactionId", async (req, res) => {
    try {
      const trip = await storage.getMileageTripByTransactionId(req.params.transactionId);
      if (!trip) {
        return res.status(404).json({ error: "Mileage trip not found" });
      }
      res.json(trip);
    } catch (error) {
      console.error("Error fetching mileage trip:", error);
      res.status(500).json({ error: "Failed to fetch mileage trip" });
    }
  });

  // Create mileage trip
  app.post("/api/mileage-trips", async (req, res) => {
    try {
      const { date, description, miles, transactionId } = req.body;
      
      if (!date || !description || miles === undefined) {
        return res.status(400).json({ error: "Missing required fields: date, description, miles" });
      }
      
      const trip = await storage.createMileageTrip({
        date: new Date(date),
        description,
        miles: parseFloat(miles),
        transactionId: transactionId || null,
      });
      
      res.json(trip);
    } catch (error) {
      console.error("Error creating mileage trip:", error);
      res.status(500).json({ error: "Failed to create mileage trip" });
    }
  });

  // Update mileage trip
  app.patch("/api/mileage-trips/:id", async (req, res) => {
    try {
      const { date, description, miles } = req.body;
      const updates: Record<string, any> = {};
      
      if (date) updates.date = new Date(date);
      if (description) updates.description = description;
      if (miles !== undefined) updates.miles = parseFloat(miles);
      
      const trip = await storage.updateMileageTrip(req.params.id, updates);
      if (!trip) {
        return res.status(404).json({ error: "Mileage trip not found" });
      }
      res.json(trip);
    } catch (error) {
      console.error("Error updating mileage trip:", error);
      res.status(500).json({ error: "Failed to update mileage trip" });
    }
  });

  // Delete mileage trip
  app.delete("/api/mileage-trips/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMileageTrip(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Mileage trip not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting mileage trip:", error);
      res.status(500).json({ error: "Failed to delete mileage trip" });
    }
  });

  // Delete mileage trip by transaction ID (used when changing category away from mileage)
  app.delete("/api/mileage-trips/by-transaction/:transactionId", async (req, res) => {
    try {
      await storage.deleteMileageTripByTransactionId(req.params.transactionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting mileage trip:", error);
      res.status(500).json({ error: "Failed to delete mileage trip" });
    }
  });

  // Get business details
  app.get("/api/business", async (req, res) => {
    try {
      const biz = await storage.getBusiness();
      res.json(biz || null);
    } catch (error) {
      console.error("Error fetching business:", error);
      res.status(500).json({ error: "Failed to fetch business details" });
    }
  });

  // Create/update business details (upsert)
  app.post("/api/business", async (req, res) => {
    try {
      const data = req.body;
      
      // Convert startDate string to Date if provided
      if (data.startDate) {
        data.startDate = new Date(data.startDate);
      }
      
      // Validate periodStartMonth (1-12)
      if (data.periodStartMonth !== undefined && data.periodStartMonth !== null) {
        const month = parseInt(data.periodStartMonth);
        if (isNaN(month) || month < 1 || month > 12) {
          return res.status(400).json({ error: "Period start month must be between 1 and 12" });
        }
        data.periodStartMonth = month;
      }
      
      // Validate periodStartDay (1-31)
      if (data.periodStartDay !== undefined && data.periodStartDay !== null) {
        const day = parseInt(data.periodStartDay);
        if (isNaN(day) || day < 1 || day > 31) {
          return res.status(400).json({ error: "Period start day must be between 1 and 31" });
        }
        data.periodStartDay = day;
      }
      
      // Validate UTR format (10 digits)
      if (data.utr && !/^\d{10}$/.test(data.utr)) {
        return res.status(400).json({ error: "UTR must be exactly 10 digits" });
      }
      
      const biz = await storage.updateBusiness(data);
      res.json(biz);
    } catch (error) {
      console.error("Error updating business:", error);
      res.status(500).json({ error: "Failed to update business details" });
    }
  });

  // === EXPORT/IMPORT ROUTES ===

  // Export transactions as CSV
  app.get("/api/export/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      
      const headers = ["date", "description", "reference", "amount", "merchant", "type", "category", "businessType", "status", "tags"];
      const csvLines = [headers.join(",")];
      
      for (const tx of transactions) {
        const row = [
          new Date(tx.date).toISOString().split('T')[0],
          `"${(tx.description || '').replace(/"/g, '""')}"`,
          `"${(tx.reference || '').replace(/"/g, '""')}"`,
          tx.amount,
          `"${(tx.merchant || '').replace(/"/g, '""')}"`,
          tx.type,
          tx.category || '',
          tx.businessType || '',
          tx.status,
          tx.tags ? tx.tags.join(';') : ''
        ];
        csvLines.push(row.join(","));
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
      res.send(csvLines.join('\n'));
    } catch (error) {
      console.error("Error exporting transactions:", error);
      res.status(500).json({ error: "Failed to export transactions" });
    }
  });

  // Export categorization rules as CSV
  app.get("/api/export/rules", async (req, res) => {
    try {
      const rules = await storage.getRules();
      
      const headers = ["keyword", "type", "businessType", "category"];
      const csvLines = [headers.join(",")];
      
      for (const rule of rules) {
        const row = [
          `"${(rule.keyword || '').replace(/"/g, '""')}"`,
          rule.type,
          rule.businessType || '',
          `"${(rule.category || '').replace(/"/g, '""')}"`
        ];
        csvLines.push(row.join(","));
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="categorization-rules.csv"');
      res.send(csvLines.join('\n'));
    } catch (error) {
      console.error("Error exporting rules:", error);
      res.status(500).json({ error: "Failed to export rules" });
    }
  });

  // Export categories as CSV
  app.get("/api/export/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      
      const headers = ["code", "label", "description", "type", "hmrcBox"];
      const csvLines = [headers.join(",")];
      
      for (const cat of categories) {
        const row = [
          `"${(cat.code || '').replace(/"/g, '""')}"`,
          `"${(cat.label || '').replace(/"/g, '""')}"`,
          `"${(cat.description || '').replace(/"/g, '""')}"`,
          cat.type,
          cat.hmrcBox || ''
        ];
        csvLines.push(row.join(","));
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="categories.csv"');
      res.send(csvLines.join('\n'));
    } catch (error) {
      console.error("Error exporting categories:", error);
      res.status(500).json({ error: "Failed to export categories" });
    }
  });

  // Helper function to parse CSV content
  function parseCSV(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }
    
    const parseRow = (line: string): string[] => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };
    
    const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
    
    return { headers, rows };
  }

  // Import transactions from CSV
  app.post("/api/import/transactions", async (req, res) => {
    try {
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: "No CSV content provided" });
      }
      
      const { rows } = parseCSV(csvContent);
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      
      for (const row of rows) {
        try {
          const date = new Date(row.date);
          if (isNaN(date.getTime())) {
            skipped++;
            errors.push(`Invalid date: ${row.date}`);
            continue;
          }
          
          const amount = parseFloat(row.amount);
          if (isNaN(amount)) {
            skipped++;
            errors.push(`Invalid amount: ${row.amount}`);
            continue;
          }
          
          const description = row.description || row.merchant || 'Unknown';
          const fingerprint = createTransactionFingerprint(date, amount, description, row.reference || null);
          
          const existingFingerprints = await storage.getExistingFingerprints();
          if (existingFingerprints.has(fingerprint)) {
            skipped++;
            continue;
          }
          
          const tags = row.tags ? row.tags.split(';').filter(Boolean) : [];
          tags.push('import:csv');
          
          await storage.createTransactionWithFingerprint({
            date,
            description,
            reference: row.reference || null,
            amount: amount.toString(),
            merchant: row.merchant || description,
            type: row.type || 'Unreviewed',
            category: row.category || null,
            businessType: row.businesstype || null,
            status: row.status || 'Cleared',
            tags,
          }, fingerprint);
          
          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Error processing row: ${JSON.stringify(row).substring(0, 100)}`);
        }
      }
      
      res.json({
        imported,
        skipped,
        total: rows.length,
        errors: errors.slice(0, 10),
        message: `Imported ${imported} transactions, skipped ${skipped}`
      });
    } catch (error) {
      console.error("Error importing transactions:", error);
      res.status(500).json({ error: "Failed to import transactions" });
    }
  });

  // Import categorization rules from CSV
  app.post("/api/import/rules", async (req, res) => {
    try {
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: "No CSV content provided" });
      }
      
      const { rows } = parseCSV(csvContent);
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      
      const existingRules = await storage.getRules();
      const existingKeywords = new Set(existingRules.map(r => r.keyword.toLowerCase()));
      
      for (const row of rows) {
        try {
          if (!row.keyword) {
            skipped++;
            errors.push('Missing keyword');
            continue;
          }
          
          if (existingKeywords.has(row.keyword.toLowerCase())) {
            skipped++;
            continue;
          }
          
          const validTypes = ['Personal', 'Business'];
          const type = validTypes.includes(row.type) ? row.type : 'Personal';
          
          await storage.createRule({
            keyword: row.keyword,
            type,
            businessType: row.businesstype || null,
            category: row.category || null,
          });
          
          existingKeywords.add(row.keyword.toLowerCase());
          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Error processing rule: ${row.keyword}`);
        }
      }
      
      res.json({
        imported,
        skipped,
        total: rows.length,
        errors: errors.slice(0, 10),
        message: `Imported ${imported} rules, skipped ${skipped}`
      });
    } catch (error) {
      console.error("Error importing rules:", error);
      res.status(500).json({ error: "Failed to import rules" });
    }
  });

  // Import categories from CSV
  app.post("/api/import/categories", async (req, res) => {
    try {
      const { csvContent } = req.body;
      if (!csvContent) {
        return res.status(400).json({ error: "No CSV content provided" });
      }
      
      const { rows } = parseCSV(csvContent);
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];
      
      const existingCategories = await storage.getCategories();
      const existingCodes = new Set(existingCategories.map(c => c.code.toLowerCase()));
      
      for (const row of rows) {
        try {
          if (!row.code || !row.label) {
            skipped++;
            errors.push('Missing code or label');
            continue;
          }
          
          if (existingCodes.has(row.code.toLowerCase())) {
            skipped++;
            continue;
          }
          
          const validTypes = ['Income', 'Expense'];
          const type = validTypes.includes(row.type) ? row.type : 'Expense';
          
          await storage.createCategory({
            code: row.code,
            label: row.label,
            description: row.description || null,
            type,
            hmrcBox: row.hmrcbox || null,
          });
          
          existingCodes.add(row.code.toLowerCase());
          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Error processing category: ${row.code}`);
        }
      }
      
      res.json({
        imported,
        skipped,
        total: rows.length,
        errors: errors.slice(0, 10),
        message: `Imported ${imported} categories, skipped ${skipped}`
      });
    } catch (error) {
      console.error("Error importing categories:", error);
      res.status(500).json({ error: "Failed to import categories" });
    }
  });

  // ===================
  // EMAIL CONFIGURATION ROUTES
  // ===================

  // Get email config (admin only)
  app.get("/api/email/config", isAuthenticated, require2FA, requireRole("admin"), async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT postmark_api_token, postmark_from_email, postmark_from_name
        FROM app_settings WHERE id = 'default'
      `);

      const settings = result.rows[0] as any;
      
      // Mask the API token for security (only show last 4 chars)
      let maskedToken = "";
      if (settings?.postmark_api_token) {
        maskedToken = "•".repeat(32) + settings.postmark_api_token.slice(-4);
      }

      res.json({
        postmarkApiToken: maskedToken,
        postmarkFromEmail: settings?.postmark_from_email || "",
        postmarkFromName: settings?.postmark_from_name || "Viatlized",
        isConfigured: !!settings?.postmark_api_token && !!settings?.postmark_from_email,
      });
    } catch (error) {
      console.error("Error fetching email config:", error);
      res.status(500).json({ error: "Failed to fetch email configuration" });
    }
  });

  // Save email config (admin only)
  app.post("/api/email/config", isAuthenticated, require2FA, requireRole("admin"), async (req, res) => {
    try {
      const schema = z.object({
        postmarkApiToken: z.string().min(1),
        postmarkFromEmail: z.string().email(),
        postmarkFromName: z.string().optional(),
      });

      const data = schema.parse(req.body);

      // Check if the token is masked (not changed) - if so, don't update it
      const isMaskedToken = data.postmarkApiToken.startsWith("•");
      
      if (isMaskedToken) {
        // Only update email and name
        await db.execute(sql`
          INSERT INTO app_settings (id, postmark_from_email, postmark_from_name, updated_at)
          VALUES ('default', ${data.postmarkFromEmail}, ${data.postmarkFromName || 'Viatlized'}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            postmark_from_email = ${data.postmarkFromEmail},
            postmark_from_name = ${data.postmarkFromName || 'Viatlized'},
            updated_at = NOW()
        `);
      } else {
        // Update everything including the token
        await db.execute(sql`
          INSERT INTO app_settings (id, postmark_api_token, postmark_from_email, postmark_from_name, updated_at)
          VALUES ('default', ${data.postmarkApiToken}, ${data.postmarkFromEmail}, ${data.postmarkFromName || 'Viatlized'}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            postmark_api_token = ${data.postmarkApiToken},
            postmark_from_email = ${data.postmarkFromEmail},
            postmark_from_name = ${data.postmarkFromName || 'Viatlized'},
            updated_at = NOW()
        `);
      }

      // Refresh the email service configuration
      const { emailService } = await import("./email");
      emailService.refreshConfiguration();

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error saving email config:", error);
      res.status(500).json({ error: "Failed to save email configuration" });
    }
  });

  // Test email (admin only)
  app.post("/api/email/test", isAuthenticated, require2FA, requireRole("admin"), async (req, res) => {
    try {
      const { emailService } = await import("./email");
      
      const configured = await emailService.ensureConfigured();
      if (!configured) {
        return res.status(400).json({ error: "Email is not configured. Please save your Postmark settings first." });
      }

      const user = req.user!;
      const success = await emailService.send2FACode(user.email, "123456");

      if (success) {
        res.json({ success: true, sentTo: user.email });
      } else {
        res.status(500).json({ error: "Failed to send test email. Check the server logs for details." });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  return httpServer;
}
