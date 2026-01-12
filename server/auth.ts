import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { users, passwordCredentials, authSessions, emailVerificationCodes, type User, type InsertUser, type AuthSession } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const SALT_ROUNDS = 12;
const SESSION_EXPIRY_HOURS = 24;
const VERIFICATION_CODE_EXPIRY_MINUTES = 10;

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<AuthSession> {
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    const [session] = await db
      .insert(authSessions)
      .values({
        userId,
        sessionToken,
        expiresAt,
        twoFactorVerified: false,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      })
      .returning();

    return session;
  }

  async validateSession(sessionToken: string): Promise<{ user: User; session: AuthSession } | null> {
    const [session] = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.sessionToken, sessionToken),
          gt(authSessions.expiresAt, new Date())
        )
      );

    if (!session) {
      return null;
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId));

    if (!user || !user.isActive) {
      return null;
    }

    return { user, session };
  }

  async invalidateSession(sessionToken: string): Promise<void> {
    await db.delete(authSessions).where(eq(authSessions.sessionToken, sessionToken));
  }

  async generateVerificationCode(userId: string, purpose: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    await db.insert(emailVerificationCodes).values({
      userId,
      codeHash,
      expiresAt,
      attempts: 0,
      used: false,
      purpose,
    });

    console.log(`[2FA] Verification code for user ${userId}: ${code}`);

    return code;
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const [verificationCode] = await db
      .select()
      .from(emailVerificationCodes)
      .where(
        and(
          eq(emailVerificationCodes.userId, userId),
          eq(emailVerificationCodes.used, false),
          gt(emailVerificationCodes.expiresAt, new Date())
        )
      )
      .orderBy(emailVerificationCodes.createdAt);

    if (!verificationCode) {
      return false;
    }

    await db
      .update(emailVerificationCodes)
      .set({ attempts: verificationCode.attempts + 1 })
      .where(eq(emailVerificationCodes.id, verificationCode.id));

    if (verificationCode.attempts >= 5) {
      await db
        .update(emailVerificationCodes)
        .set({ used: true })
        .where(eq(emailVerificationCodes.id, verificationCode.id));
      return false;
    }

    const isValid = await bcrypt.compare(code, verificationCode.codeHash);

    if (isValid) {
      await db
        .update(emailVerificationCodes)
        .set({ used: true })
        .where(eq(emailVerificationCodes.id, verificationCode.id));
    }

    return isValid;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || undefined;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...data,
        email: data.email.toLowerCase(),
      })
      .returning();
    return user;
  }

  async createPasswordCredential(userId: string, password: string): Promise<void> {
    const passwordHash = await this.hashPassword(password);
    await db.insert(passwordCredentials).values({
      userId,
      passwordHash,
      mustChangePassword: false,
    });
  }

  async getPasswordCredential(userId: string) {
    const [credential] = await db
      .select()
      .from(passwordCredentials)
      .where(eq(passwordCredentials.userId, userId));
    return credential || undefined;
  }

  async checkIfAdminExists(): Promise<boolean> {
    const [admin] = await db.select().from(users).where(eq(users.role, "admin"));
    return !!admin;
  }

  async markSessionAs2FAVerified(sessionToken: string): Promise<void> {
    await db
      .update(authSessions)
      .set({ twoFactorVerified: true })
      .where(eq(authSessions.sessionToken, sessionToken));
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export const authService = new AuthService();

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: AuthSession;
    }
  }
}

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!sessionToken) {
    return res.status(401).json({ error: "Unauthorized", message: "No session token provided" });
  }

  const result = await authService.validateSession(sessionToken);

  if (!result) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired session" });
  }

  req.user = result.user;
  req.session = result.session;
  next();
}

export async function require2FA(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return res.status(401).json({ error: "Unauthorized", message: "No session" });
  }

  if (!req.session.twoFactorVerified && req.user?.twoFactorMethod) {
    return res.status(403).json({ error: "2FA Required", message: "Two-factor authentication required" });
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized", message: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
    }

    next();
  };
}
