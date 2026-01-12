import * as postmark from "postmark";

const POSTMARK_SERVER_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@viatlized.com";

let client: postmark.ServerClient | null = null;

function getClient(): postmark.ServerClient {
  if (!client) {
    if (!POSTMARK_SERVER_TOKEN) {
      throw new Error("POSTMARK_SERVER_TOKEN environment variable is not set");
    }
    client = new postmark.ServerClient(POSTMARK_SERVER_TOKEN);
  }
  return client;
}

export async function sendVerificationCode(
  to: string,
  code: string,
  userName?: string
): Promise<boolean> {
  if (!POSTMARK_SERVER_TOKEN) {
    console.log(`[Email] POSTMARK_SERVER_TOKEN not set. Would send code ${code} to ${to}`);
    return true;
  }

  try {
    const displayName = userName || "there";
    
    await getClient().sendEmail({
      From: FROM_EMAIL,
      To: to,
      Subject: "Your Viatlized Verification Code",
      HtmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Hi ${displayName},</p>
          <p>Your verification code is:</p>
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            Viatlized - SA103F Self-Employment Accounts
          </p>
        </div>
      `,
      TextBody: `Hi ${displayName},\n\nYour verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\nViatlized - SA103F Self-Employment Accounts`,
      MessageStream: "outbound",
    });

    console.log(`[Email] Verification code sent to ${to}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send verification code:", error);
    return false;
  }
}

export async function sendWelcomeEmail(
  to: string,
  userName?: string
): Promise<boolean> {
  if (!POSTMARK_SERVER_TOKEN) {
    console.log(`[Email] POSTMARK_SERVER_TOKEN not set. Would send welcome email to ${to}`);
    return true;
  }

  try {
    const displayName = userName || "there";
    
    await getClient().sendEmail({
      From: FROM_EMAIL,
      To: to,
      Subject: "Welcome to Viatlized",
      HtmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome to Viatlized!</h2>
          <p>Hi ${displayName},</p>
          <p>Your account has been successfully created. You can now start tracking your self-employment income and expenses.</p>
          <p>Features available to you:</p>
          <ul>
            <li>Track transactions with HMRC SA103F categories</li>
            <li>Calculate your UK Income Tax estimates</li>
            <li>Monitor VAT threshold</li>
            <li>Track mileage allowances</li>
            <li>Generate tax reports</li>
          </ul>
          <p>If you have any questions, feel free to reach out.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            Viatlized - SA103F Self-Employment Accounts
          </p>
        </div>
      `,
      TextBody: `Hi ${displayName},\n\nYour account has been successfully created. You can now start tracking your self-employment income and expenses.\n\nViatlized - SA103F Self-Employment Accounts`,
      MessageStream: "outbound",
    });

    console.log(`[Email] Welcome email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send welcome email:", error);
    return false;
  }
}
