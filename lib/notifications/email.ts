/**
 * Email notification service
 * Supports Resend (recommended) and Nodemailer fallback
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailNotificationService {
  private resendApiKey: string | null = null;
  private smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      password: string;
    };
  } | null = null;

  constructor() {
    // Check for Resend API key
    if (process.env.RESEND_API_KEY) {
      this.resendApiKey = process.env.RESEND_API_KEY;
    }

    // Check for SMTP config (fallback)
    if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
    ) {
      this.smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          password: process.env.SMTP_PASSWORD,
        },
      };
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Prefer Resend if available
    if (this.resendApiKey) {
      return this.sendViaResend(options);
    }

    // Fallback to SMTP
    if (this.smtpConfig) {
      return this.sendViaSMTP(options);
    }

    console.warn("No email service configured. Email not sent.");
    return false;
  }

  /**
   * Send email via Resend API
   */
  private async sendViaResend(options: EmailOptions): Promise<boolean> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "LinguaFlow <noreply@linguaflow.com>",
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Resend API error:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error sending email via Resend:", error);
      return false;
    }
  }

  /**
   * Send email via SMTP (Nodemailer)
   */
  private async sendViaSMTP(options: EmailOptions): Promise<boolean> {
    try {
      // Dynamic import to avoid requiring nodemailer if not used
      const nodemailer = await import("nodemailer");

      const transporter = nodemailer.createTransport({
        host: this.smtpConfig!.host,
        port: this.smtpConfig!.port,
        secure: this.smtpConfig!.secure,
        auth: this.smtpConfig!.auth,
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || this.smtpConfig!.auth.user,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ""),
      });

      return true;
    } catch (error) {
      console.error("Error sending email via SMTP:", error);
      return false;
    }
  }

  /**
   * Generate HTML email template
   */
  generateEmailHTML(
    title: string,
    message: string,
    actionLink?: string,
    actionText?: string
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">LinguaFlow</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Seamless Translation Management</p>
  </div>
  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h2 style="color: #333; margin-top: 0;">${title}</h2>
    <p style="color: #666; font-size: 16px;">${message}</p>
    ${actionLink && actionText
        ? `<a href="${actionLink}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">${actionText}</a>`
        : ""
      }
  </div>
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>This is an automated notification from LinguaFlow.</p>
    <p>You can manage your notification preferences in your account settings.</p>
  </div>
</body>
</html>
    `.trim();
  }
}

