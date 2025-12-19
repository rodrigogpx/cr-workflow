import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { getEmailSettings, getEmailSettingsFromDb, type EmailSettings } from './db';

// Gateway de Email Manus (contorna restrições SMTP do Railway)
const EMAIL_GATEWAY_URL = process.env.EMAIL_GATEWAY_URL || 'https://5000-ii462mn0wybzgbhgi63xz-a2535f82.manusvm.computer';

// Create reusable transporter with support for DB-backed configuration
let transporter: nodemailer.Transporter | null = null;
let currentConfigKey: string | null = null;

interface SmtpConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  useSecure: boolean;
}

async function resolveSmtpConfig(tenantDb?: any): Promise<SmtpConfig> {
  const dbConfig: EmailSettings | null = tenantDb
    ? await getEmailSettingsFromDb(tenantDb)
    : await getEmailSettings();

  if (dbConfig) {
    return {
      smtpHost: dbConfig.smtpHost,
      smtpPort: dbConfig.smtpPort,
      smtpUser: dbConfig.smtpUser,
      smtpPass: dbConfig.smtpPass,
      smtpFrom: dbConfig.smtpFrom,
      useSecure: dbConfig.useSecure,
    };
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP configuration missing. Please configure SMTP via the admin panel or set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.');
  }

  return {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM || `"Firing Range" <${process.env.SMTP_USER}>`,
    useSecure: Number(process.env.SMTP_PORT) === 465,
  };
}

async function getTransporterWithConfig(tenantDb?: any): Promise<{ transporter: nodemailer.Transporter; config: SmtpConfig }> {
  const config = await resolveSmtpConfig(tenantDb);
  const configKey = `${config.smtpHost}:${config.smtpPort}:${config.smtpUser}:${config.useSecure}`;

  if (!transporter || currentConfigKey !== configKey) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.useSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    currentConfigKey = configKey;
    console.log('[EmailService] SMTP transporter created/updated');
  }

  return { transporter, config };
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    path?: string; // URL or file path
    content?: Buffer; // Raw content
  }>;
}

/**
 * Send email via SMTP
 */
export async function sendEmail(options: SendEmailOptions, tenantDb?: any): Promise<{ success: boolean; messageId?: string }> {
  try {
    const { transporter: transport, config } = await getTransporterWithConfig(tenantDb);

    // Prepare attachments for Nodemailer
    const attachments: Attachment[] = options.attachments?.map(att => ({
      filename: att.filename,
      path: att.path,
      content: att.content,
    })) || [];

    const info = await transport.sendMail({
      from: config.smtpFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments,
    });

    console.log('[EmailService] Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
    throw error;
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection(tenantDb?: any): Promise<boolean> {
  try {
    const { transporter: transport } = await getTransporterWithConfig(tenantDb);
    await transport.verify();
    console.log('[EmailService] SMTP connection verified');
    return true;
  } catch (error) {
    console.error('[EmailService] SMTP connection failed:', error);
    return false;
  }
}

/**
 * Verify SMTP connection with explicit settings (tenant-isolated)
 */
export async function verifyConnectionWithSettings(settings: {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
    });
    await transporter.verify();
    console.log('[EmailService] SMTP connection verified with custom settings');
    return true;
  } catch (error) {
    console.error('[EmailService] SMTP connection failed:', error);
    return false;
  }
}

/**
 * Send email via Manus Gateway (HTTP) - contorna restrições SMTP do Railway
 */
async function sendEmailViaGateway(options: {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[EmailService] Sending email via Manus Gateway to:', options.to);
    
    const response = await fetch(`${EMAIL_GATEWAY_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        body: options.body,
        is_html: options.isHtml ?? true,
      }),
    });

    const data = await response.json();
    
    if (response.ok && data.status === 'success') {
      console.log('[EmailService] Email sent via Gateway successfully');
      return { success: true };
    } else {
      console.error('[EmailService] Gateway error:', data);
      return { success: false, error: data.message || 'Erro no gateway de email' };
    }
  } catch (error: any) {
    console.error('[EmailService] Gateway request failed:', error);
    return { success: false, error: error.message || 'Falha na conexão com gateway de email' };
  }
}

/**
 * Send a test email - usa Gateway Manus (Railway) ou SMTP direto (local)
 */
export async function sendTestEmailWithSettings(settings: {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  from: string;
  toEmail: string;
  subject?: string;
  body?: string;
  useGateway?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const defaultSubject = '✅ Teste de Configuração - CAC 360';
  const defaultBodyText = 'Este é um email de teste enviado pelo sistema CAC 360.\n\nSe você recebeu este email, as configurações estão corretas.';
  
  const subject = settings.subject || defaultSubject;
  const bodyText = settings.body || defaultBodyText;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a5c00;">✅ ${subject}</h2>
      <p>${bodyText.replace(/\n/g, '<br/>')}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
      <p style="color: #666; font-size: 12px;">Enviado via CAC 360</p>
    </div>
  `;

  // Usar Gateway se explicitamente solicitado, ou se em produção e não definido
  const shouldUseGateway = settings.useGateway !== undefined 
    ? settings.useGateway 
    : (process.env.NODE_ENV === 'production' || process.env.USE_EMAIL_GATEWAY === 'true');
  
  if (shouldUseGateway) {
    console.log('[EmailService] Using Manus Gateway (production mode)');
    return sendEmailViaGateway({
      to: settings.toEmail,
      subject,
      body: htmlBody,
      isHtml: true,
    });
  }

  // Fallback para SMTP direto (desenvolvimento local)
  try {
    console.log('[EmailService] Using direct SMTP (development mode)');
    console.log('[EmailService] Creating transporter with settings:', {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      user: settings.user,
      from: settings.from,
      to: settings.toEmail,
    });

    const useSecure = settings.port === 465;
    
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: useSecure,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.verify();
    console.log('[EmailService] SMTP connection verified');

    const info = await transporter.sendMail({
      from: settings.from,
      to: settings.toEmail,
      subject,
      html: htmlBody,
    });

    console.log('[EmailService] Test email sent successfully:', info.messageId);
    return { success: true };
  } catch (error: any) {
    console.error('[EmailService] Failed to send test email via SMTP:', error);
    return { success: false, error: error.message || 'Erro desconhecido ao enviar email' };
  }
}
