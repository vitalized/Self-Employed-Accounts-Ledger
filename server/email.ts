import * as postmark from "postmark";
import { db } from "./db";
import { sql } from "drizzle-orm";

interface EmailConfig {
  apiToken: string;
  fromEmail: string;
  fromName?: string;
}

class EmailService {
  private client: postmark.ServerClient | null = null;
  private fromEmail: string = "noreply@example.com";
  private fromName: string = "Viatlized";
  private configuredFromDb: boolean = false;

  configure(config: EmailConfig) {
    this.client = new postmark.ServerClient(config.apiToken);
    this.fromEmail = config.fromEmail;
    this.fromName = config.fromName || "Viatlized";
  }

  async loadFromDatabase(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT postmark_api_token, postmark_from_email, postmark_from_name
        FROM app_settings WHERE id = 'default'
      `);

      const settings = result.rows[0] as any;
      if (settings?.postmark_api_token && settings?.postmark_from_email) {
        this.configure({
          apiToken: settings.postmark_api_token,
          fromEmail: settings.postmark_from_email,
          fromName: settings.postmark_from_name || "Viatlized",
        });
        this.configuredFromDb = true;
        console.log("[Email] Configured from database settings");
        return true;
      }
    } catch (error) {
      console.warn("[Email] Failed to load settings from database:", error);
    }
    return false;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async ensureConfigured(): Promise<boolean> {
    if (this.client) {
      return true;
    }

    if (await this.loadFromDatabase()) {
      return true;
    }

    const apiToken = process.env.POSTMARK_SERVER_TOKEN || process.env.POSTMARK_API_TOKEN;
    if (apiToken) {
      this.configure({
        apiToken,
        fromEmail: process.env.POSTMARK_FROM_EMAIL || "noreply@example.com",
        fromName: process.env.POSTMARK_FROM_NAME || "Viatlized",
      });
      console.log("[Email] Configured from environment variables");
      return true;
    }

    return false;
  }

  private async sendEmail(to: string, subject: string, htmlBody: string, textBody: string): Promise<boolean> {
    await this.ensureConfigured();

    if (!this.client) {
      console.warn("[Email] Postmark not configured - email would be sent to:", to);
      console.log("[Email] Subject:", subject);
      console.log("[Email] Code preview from body:", textBody.match(/\d{6}/)?.[0] || "N/A");
      return false;
    }

    try {
      await this.client.sendEmail({
        From: `${this.fromName} <${this.fromEmail}>`,
        To: to,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: "outbound",
      });
      console.log("[Email] Successfully sent to:", to);
      return true;
    } catch (error) {
      console.error("[Email] Failed to send:", error);
      return false;
    }
  }

  refreshConfiguration() {
    this.client = null;
    this.configuredFromDb = false;
  }

  async send2FACode(email: string, code: string): Promise<boolean> {
    const subject = "Your verification code";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #1a1a1a;">Verification Code</h1>
    <p style="color: #666; margin: 0 0 24px 0;">Enter this code to sign in to your account:</p>
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
    </div>
    <p style="color: #999; font-size: 14px; margin: 0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
  </div>
</body>
</html>`;

    const textBody = `Your verification code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`;

    return this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendInviteEmail(email: string, inviteCode: string, appUrl: string): Promise<boolean> {
    const subject = "You've been invited to Viatlized - SA103F Self-Employment Accounts";
    const setupUrl = `${appUrl}/setup?code=${inviteCode}&email=${encodeURIComponent(email)}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #1a1a1a;">Welcome to Viatlized</h1>
    <p style="color: #666; margin: 0 0 24px 0;">You've been invited to access the SA103F self-employment accounts system. Click the button below to set up your account:</p>
    <a href="${setupUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-bottom: 24px;">Set Up Your Account</a>
    <p style="color: #999; font-size: 14px; margin: 16px 0 0 0;">This invitation expires in 7 days.</p>
    <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">If the button doesn't work, copy and paste this URL into your browser:<br>${setupUrl}</p>
  </div>
</body>
</html>`;

    const textBody = `You've been invited to Viatlized - SA103F Self-Employment Accounts.\n\nClick this link to set up your account:\n${setupUrl}\n\nThis invitation expires in 7 days.`;

    return this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendPasswordResetEmail(email: string, resetCode: string, appUrl: string): Promise<boolean> {
    const subject = "Reset your password";
    const resetUrl = `${appUrl}/reset-password?code=${resetCode}&email=${encodeURIComponent(email)}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #1a1a1a;">Reset Your Password</h1>
    <p style="color: #666; margin: 0 0 24px 0;">Click the button below to reset your password:</p>
    <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-bottom: 24px;">Reset Password</a>
    <p style="color: #999; font-size: 14px; margin: 16px 0 0 0;">This link expires in 1 hour.</p>
    <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">If you didn't request this, you can safely ignore this email.</p>
  </div>
</body>
</html>`;

    const textBody = `Reset your password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;

    return this.sendEmail(email, subject, htmlBody, textBody);
  }

  async sendWelcomeEmail(email: string, userName?: string): Promise<boolean> {
    const displayName = userName || "there";
    const subject = "Welcome to Viatlized";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #1a1a1a;">Welcome to Viatlized!</h1>
    <p style="color: #666; margin: 0 0 16px 0;">Hi ${displayName},</p>
    <p style="color: #666; margin: 0 0 24px 0;">Your account has been successfully created. You can now start tracking your self-employment income and expenses.</p>
    <p style="color: #666; margin: 0 0 8px 0;">Features available to you:</p>
    <ul style="color: #666; margin: 0 0 24px 0; padding-left: 20px;">
      <li>Track transactions with HMRC SA103F categories</li>
      <li>Calculate your UK Income Tax estimates</li>
      <li>Monitor VAT threshold (£90,000)</li>
      <li>Track mileage allowances (45p/25p per mile)</li>
      <li>Generate tax reports</li>
    </ul>
    <p style="color: #999; font-size: 14px; margin: 0;">If you have any questions, feel free to reach out.</p>
  </div>
</body>
</html>`;

    const textBody = `Hi ${displayName},\n\nYour account has been successfully created. You can now start tracking your self-employment income and expenses.\n\nViatlized - SA103F Self-Employment Accounts`;

    return this.sendEmail(email, subject, htmlBody, textBody);
  }
}

export const emailService = new EmailService();
