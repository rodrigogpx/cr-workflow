import nodemailer from 'nodemailer';
import type { Attachment } from 'nodemailer/lib/mailer';
import { getEmailSettings, getEmailSettingsFromDb, type EmailSettings } from './db';

const POSTMANGPX_BASE_URL = process.env.POSTMANGPX_BASE_URL;
const POSTMANGPX_API_KEY = process.env.POSTMANGPX_API_KEY;

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

function extractEmailAddress(fromValue: string | undefined | null): string | undefined {
  if (!fromValue) return undefined;
  const match = fromValue.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  const trimmed = fromValue.trim();
  // If it's already an email without display name
  if (trimmed.includes('@') && !trimmed.includes(' ')) return trimmed;
  return undefined;
}

async function resolveSmtpConfig(tenantDb?: any, tenantId?: number): Promise<SmtpConfig> {
  if (tenantId) {
    const { getTenantSmtpSettings } = await import('./db');
    const tenantConfig = await getTenantSmtpSettings(tenantId);
    if (tenantConfig && tenantConfig.emailMethod === 'smtp' && tenantConfig.smtpHost) {
      return {
        smtpHost: tenantConfig.smtpHost,
        smtpPort: tenantConfig.smtpPort || 587,
        smtpUser: tenantConfig.smtpUser || '',
        smtpPass: tenantConfig.smtpPassword || '',
        smtpFrom: tenantConfig.smtpFrom || '',
        useSecure: tenantConfig.smtpPort === 465,
      };
    }
  }

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
    smtpFrom: process.env.SMTP_FROM || `"CAC 360" <${process.env.SMTP_USER}>`,
    useSecure: Number(process.env.SMTP_PORT) === 465,
  };
}

async function getTransporterWithConfig(tenantDb?: any, tenantId?: number): Promise<{ transporter: nodemailer.Transporter; config: SmtpConfig }> {
  const config = await resolveSmtpConfig(tenantDb, tenantId);
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
    contentType?: string;
    cid?: string;
    disposition?: 'inline' | 'attachment';
  }>;
}

function parseDataUri(dataUri: string): { contentType: string; content: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUri || '');
  if (!match?.[1] || !match?.[2]) return null;
  try {
    return {
      contentType: match[1],
      content: Buffer.from(match[2], 'base64'),
    };
  } catch {
    return null;
  }
}

async function resolveAttachmentToBase64(att: {
  filename: string;
  path?: string;
  content?: Buffer;
  contentType?: string;
  cid?: string;
  disposition?: 'inline' | 'attachment';
}): Promise<{ filename: string; contentType: string; contentBase64: string; cid?: string; disposition?: 'inline' | 'attachment' } | null> {
  let content: Buffer | null = att.content || null;
  let contentType = att.contentType || 'application/octet-stream';

  if (!content && att.path) {
    const resp = await fetch(att.path);
    if (!resp.ok) return null;
    contentType = resp.headers.get('content-type') || contentType;
    const ab = await resp.arrayBuffer();
    content = Buffer.from(ab);
  }

  if (!content) return null;

  return {
    filename: att.filename,
    contentType,
    contentBase64: content.toString('base64'),
    cid: att.cid,
    disposition: att.disposition,
  };
}

export function buildInlineLogoAttachment(emailLogoValue: string | undefined | null): { filename: string; content: Buffer; contentType: string; cid: string; disposition: 'inline' } | null {
  if (!emailLogoValue) return null;
  const parsed = parseDataUri(emailLogoValue);
  if (!parsed) return null;
  const ext = (parsed.contentType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
  return {
    filename: `logo.${ext}`,
    content: parsed.content,
    contentType: parsed.contentType,
    cid: 'email-logo',
    disposition: 'inline',
  };
}

/**
 * Send email via Gateway (production) or SMTP (development)
 */
export async function sendEmail(options: SendEmailOptions & { tenantDb?: any; tenantId?: number }): Promise<{ success: boolean; messageId?: string }> {
  const { tenantDb, tenantId, ...emailOptions } = options;
  
  let finalTenantId = tenantId;
  
  if (!finalTenantId) {
    const { getAllTenants } = await import('./db');
    const allTenants = await getAllTenants();
    if (allTenants && allTenants.length > 0) {
      finalTenantId = allTenants[0].id;
    }
  }

  const { getTenantSmtpSettings } = await import('./db');
  let emailMethod = process.env.NODE_ENV === 'production' || process.env.USE_EMAIL_GATEWAY === 'true' ? 'gateway' : 'smtp';
  
  if (finalTenantId) {
    const tenantSettings = await getTenantSmtpSettings(finalTenantId);
    if (tenantSettings && tenantSettings.emailMethod) {
      emailMethod = tenantSettings.emailMethod;
    }
  }

  const useGateway = emailMethod === 'gateway';

  if (useGateway) {
    const result = await sendEmailViaPostmanGpx({
      to: emailOptions.to,
      subject: emailOptions.subject,
      html: emailOptions.html,
      attachments: emailOptions.attachments,
    }, finalTenantId);

    if (!result.success) {
      throw new Error(result.error || 'Falha ao enviar email via Gateway');
    }

    return { success: true, messageId: 'gateway-' + Date.now() };
  }

  // SMTP direto
  try {
    const { transporter: transport, config } = await getTransporterWithConfig(tenantDb, finalTenantId);

    // Prepare attachments for Nodemailer
    const attachments: Attachment[] = options.attachments?.map(att => ({
      filename: att.filename,
      path: att.path,
      content: att.content,
      contentType: att.contentType,
      cid: att.cid,
      disposition: att.disposition,
    })) || [];

    const info = await transport.sendMail({
      from: config.smtpFrom,
      replyTo: extractEmailAddress(config.smtpFrom),
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
    throw error;
  }
}

/**
 * Send email via HTTP Gateway - contorna restrições SMTP do Railway
 */
async function sendEmailViaPostmanGpx(
  options: {
    to: string;
    subject: string;
    html: string;
    attachments?: SendEmailOptions['attachments'];
  },
  tenantId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getTenantSmtpSettings, getAllTenants } = await import('./db');
    
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      const allTenants = await getAllTenants();
      if (allTenants && allTenants.length > 0) {
        finalTenantId = allTenants[0].id;
      }
    }

    let baseUrl = POSTMANGPX_BASE_URL;
    let apiKey = POSTMANGPX_API_KEY;
    let smtpFrom: string | undefined;

    try {
      if (finalTenantId) {
        const tenantSettings = await getTenantSmtpSettings(finalTenantId);
        baseUrl = tenantSettings?.postmanGpxBaseUrl || baseUrl;
        apiKey = tenantSettings?.postmanGpxApiKey || apiKey;
        smtpFrom = tenantSettings?.smtpFrom || undefined;
      }
    } catch (err) {
      console.error('[EmailService] Error looking up tenant settings:', err);
      // ignore tenant lookup errors and fallback to env
    }

    if (!baseUrl || !apiKey) {
      return {
        success: false,
        error: 'PostmanGPX não configurado. Informe Base URL e API Key nas configurações do tenant (ou defina POSTMANGPX_BASE_URL e POSTMANGPX_API_KEY).',
      };
    }

    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

    let gatewayAttachments: Array<{ filename: string; contentType: string; contentBase64: string; cid?: string; disposition?: 'inline' | 'attachment' }> | undefined;
    if (options.attachments?.length) {
      const resolved = await Promise.all(options.attachments.map(resolveAttachmentToBase64));
      gatewayAttachments = resolved.filter(Boolean) as any;
    }

    const response = await fetch(`${normalizedBaseUrl}/api/v1/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
        from: smtpFrom,
        replyTo: extractEmailAddress(smtpFrom),
        attachments: gatewayAttachments,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const maybeJson = contentType.includes('application/json');
    const data = maybeJson ? safeJsonParse(rawText) : null;

    if (!response.ok) {
      return {
        success: false,
        error: (data as any)?.message || rawText || `Erro ao chamar PostmanGPX (HTTP ${response.status})`,
      };
    }

    // postmangpx retorna { id, status, createdAt }
    if (data && (data as any).id) {
      return { success: true };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[EmailService] PostmanGPX request failed:', error);
    return { success: false, error: `Falha na conexão com PostmanGPX: ${error.message}` };
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Fetch image from URL and convert to base64 data URI
 * This embeds the image directly in the email HTML, avoiding external URL issues
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      console.error('[EmailService] Failed to fetch image:', response.status);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('[EmailService] Error converting image to base64:', error);
    return null;
  }
}

/**
 * Send a test email - usa HTTP Gateway (Railway) ou SMTP direto (local)
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
  postmanGpxBaseUrl?: string;
  postmanGpxApiKey?: string;
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
    if (!settings.postmanGpxBaseUrl || !settings.postmanGpxApiKey) {
      return {
        success: false,
        error: 'PostmanGPX não configurado. Informe Base URL e API Key nas configurações.',
      };
    }

    const normalizedBaseUrl = settings.postmanGpxBaseUrl.replace(/\/$/, '');
    const response = await fetch(`${normalizedBaseUrl}/api/v1/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': settings.postmanGpxApiKey,
      },
      body: JSON.stringify({
        to: settings.toEmail,
        subject,
        html: htmlBody,
        from: settings.from,
        replyTo: extractEmailAddress(settings.from),
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const data = contentType.includes('application/json') ? safeJsonParse(rawText) : null;

    if (!response.ok) {
      return {
        success: false,
        error: (data as any)?.message || rawText || `Erro ao enviar teste via PostmanGPX (HTTP ${response.status})`,
      };
    }

    return { success: true };
  }

  // Fallback para SMTP direto (desenvolvimento local)
  try {
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

    const info = await transporter.sendMail({
      from: settings.from,
      to: settings.toEmail,
      subject,
      html: htmlBody,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao enviar email' };
  }
}

// ============================================
// EMAIL TRIGGER AUTOMATION
// ============================================

import * as db from './db';
import type { Client, User } from '../drizzle/schema';

interface TriggerContext {
  tenantDb?: any;
  tenantId?: number;
  client: Client;
  users?: User[];
  scheduledDate?: Date; // For scheduled events (e.g., appointments)
  extraData?: Record<string, any>;
}

/**
 * Process email triggers for a specific event
 * @param event - The trigger event (e.g., 'CLIENT_CREATED', 'STEP_COMPLETED:2')
 * @param context - Context containing client, users, and optional scheduled date
 */
export async function triggerEmails(event: string, context: TriggerContext): Promise<void> {
  try {
    const { tenantDb, tenantId, client, users = [], scheduledDate, extraData } = context;
    
    console.log(`[EmailTrigger] Processing event="${event}" client=${client.id} (${client.name}) tenant=${tenantId || 'none'}`);
    
    // Fetch tenant settings to get logo and name (already saved as base64 data URI)
    const tenantSettings = tenantId ? await db.getTenantSmtpSettings(tenantId) : null;
    const emailLogoUrl = (tenantSettings as any)?.emailLogoUrl || '';

    // Injeta nome do clube no extraData para substituição de {{nome_clube}}
    const enrichedExtraData: Record<string, any> = {
      nome_clube: tenantSettings?.name || 'CAC 360',
      ...extraData,
    };

    const inlineLogo = buildInlineLogoAttachment(emailLogoUrl);

    // Get active triggers for this event
    const triggers = tenantDb
      ? await db.getActiveTriggersByEventFromDb(tenantDb, event, tenantId)
      : await db.getActiveTriggersByEvent(event, tenantId);
    
    if (triggers.length === 0) {
      console.log(`[EmailTrigger] No active triggers found for event="${event}" tenant=${tenantId}`);
      return;
    }
    
    console.log(`[EmailTrigger] Found ${triggers.length} trigger(s) for event="${event}"`);
    
    for (const trigger of triggers) {
      // Get templates for this trigger
      const templates = tenantDb
        ? await db.getTemplatesByTriggerIdFromDb(tenantDb, trigger.id)
        : await db.getTemplatesByTriggerId(trigger.id);
      
      if (templates.length === 0) {
        console.warn(`[EmailTrigger] Trigger "${trigger.name}" (id=${trigger.id}) has no linked templates — skipping`);
        continue;
      }
      
      // Determine recipients
      const recipients = await resolveRecipients(trigger, client, users, tenantDb);
      
      if (recipients.length === 0) {
        console.warn(`[EmailTrigger] Trigger "${trigger.name}" — no recipients resolved (recipientType=${trigger.recipientType}, clientEmail=${client.email || 'none'})`);
        continue;
      }
      
      // Process each template
      for (const templateLink of templates) {
        const template = templateLink.template;
        if (!template) {
          continue;
        }
        
        // Render template with client data (logo is already base64 from database)
        const renderedSubject = renderTemplate(template.subject, client, enrichedExtraData, emailLogoUrl);
        const renderedContent = renderTemplate(template.content, client, enrichedExtraData, emailLogoUrl);
        
        // Check if this is a reminder template and we have a scheduled date
        if (templateLink.isForReminder && scheduledDate && trigger.sendBeforeHours) {
          // Schedule the reminder email
          const reminderDate = new Date(scheduledDate);
          reminderDate.setHours(reminderDate.getHours() - trigger.sendBeforeHours);
          
          // Only schedule if the reminder date is in the future
          if (reminderDate > new Date()) {
            for (const recipient of recipients) {
              const scheduledData = {
                tenantId,
                clientId: client.id,
                triggerId: trigger.id,
                templateId: template.id,
                recipientEmail: recipient.email,
                recipientName: recipient.name,
                subject: renderedSubject,
                content: renderedContent,
                scheduledFor: reminderDate,
                referenceDate: scheduledDate,
                status: 'pending' as const,
              };
              
              tenantDb
                ? await db.scheduleEmailToDb(tenantDb, scheduledData)
                : await db.scheduleEmail(scheduledData);
            }
          }
        }
        
        // Send immediate email if configured
        if (trigger.sendImmediate && !templateLink.isForReminder) {
          for (const recipient of recipients) {
            if (!recipient.email || !recipient.email.trim()) {
              continue;
            }
            try {
              console.log(`[EmailTrigger] Sending email to ${recipient.email} — trigger="${trigger.name}" template="${template.templateKey}" subject="${renderedSubject}"`);
              await sendEmail({
                to: recipient.email,
                subject: renderedSubject,
                html: renderedContent,
                attachments: inlineLogo ? [inlineLogo] : undefined,
                tenantDb,
                tenantId,
              });
              console.log(`[EmailTrigger] ✓ Email sent successfully to ${recipient.email}`);
              
              // Registrar envio na Central de Mensagens
              try {
                if (tenantDb) {
                  await db.logEmailSentToDb(tenantDb, {
                    clientId: client.id,
                    templateKey: template.templateKey,
                    recipientEmail: recipient.email,
                    subject: renderedSubject,
                    content: renderedContent,
                    sentBy: 0, // 0 = sistema automático
                  });
                }
              } catch (logError) {
                console.error(`[EmailTrigger] Failed to log email:`, logError);
              }
            } catch (error) {
              console.error(`[EmailTrigger] Failed to send email to ${recipient.email}:`, error);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[EmailTrigger] Error processing triggers:', error);
  }
}

/**
 * Resolve recipients based on trigger configuration
 */
async function resolveRecipients(
  trigger: any,
  client: Client,
  users: User[],
  tenantDb?: any
): Promise<Array<{ email: string; name: string | null }>> {
  const recipients: Array<{ email: string; name: string | null }> = [];
  
  // Add client if recipientType includes client
  if (trigger.recipientType === 'client' || trigger.recipientType === 'both') {
    if (client.email && client.email.trim()) {
      recipients.push({ email: client.email, name: client.name });
    }
  }
  
  // Add operator if recipientType is operator
  if (trigger.recipientType === 'operator') {
    const operator = tenantDb
      ? await db.getUserByIdFromDb(tenantDb, client.operatorId)
      : await db.getUserById(client.operatorId);
    if (operator) {
      recipients.push({ email: operator.email, name: operator.name });
    }
  }
  
  // Add specific users if recipientType includes users
  if (trigger.recipientType === 'users' || trigger.recipientType === 'both') {
    if (trigger.recipientUserIds) {
      const userIds: number[] = JSON.parse(trigger.recipientUserIds);
      for (const userId of userIds) {
        const user = users.find(u => u.id === userId) || (tenantDb
          ? await db.getUserByIdFromDb(tenantDb, userId)
          : await db.getUserById(userId));
        if (user) {
          recipients.push({ email: user.email, name: user.name });
        }
      }
    }
  }
  
  // Remove duplicates
  const uniqueRecipients = recipients.filter((r, i, arr) => 
    arr.findIndex(x => x.email === r.email) === i
  );
  
  return uniqueRecipients;
}

/**
 * Render template with client data (replace placeholders)
 */
function renderTemplate(template: string, client: Client, extraData?: Record<string, any>, emailLogoUrl?: string): string {
  let rendered = template;
  
  // Client placeholders
  rendered = rendered.replace(/\{\{nome\}\}/gi, client.name || '');
  rendered = rendered.replace(/\{\{email\}\}/gi, client.email || '');
  rendered = rendered.replace(/\{\{cpf\}\}/gi, client.cpf || '');
  rendered = rendered.replace(/\{\{telefone\}\}/gi, client.phone || '');
  rendered = rendered.replace(/\{\{endereco\}\}/gi, client.address || '');
  rendered = rendered.replace(/\{\{cidade\}\}/gi, client.city || '');
  rendered = rendered.replace(/\{\{cep\}\}/gi, client.cep || '');
  
  // Extra data placeholders
  if (extraData) {
    for (const [key, value] of Object.entries(extraData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      rendered = rendered.replace(regex, String(value || ''));
    }
  }
  
  // Date placeholder
  rendered = rendered.replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'));
  
  // Logo placeholder — CID inline se tenant tiver logo; caso contrário, logo
  // texto da plataforma CAC 360 (compatível com todos os clientes de email).
  const CAC360_LOGO_FALLBACK =
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">` +
    `<tr><td style="background-color:#123A63;border-radius:6px;padding:10px 28px;text-align:center;">` +
    `<span style="font-family:'Arial Black',Arial,sans-serif;font-size:24px;font-weight:900;` +
    `color:#ffffff;letter-spacing:2px;text-decoration:none;">CAC&#160;</span>` +
    `<span style="font-family:'Arial Black',Arial,sans-serif;font-size:24px;font-weight:900;` +
    `color:#28a745;letter-spacing:2px;text-decoration:none;">360</span>` +
    `</td></tr></table>`;

  if (emailLogoUrl) {
    rendered = rendered.replace(/\{\{logo\}\}/gi, `<img src="cid:email-logo" alt="Logo" style="max-height: 80px; max-width: 200px; display: block;" />`);
  } else {
    rendered = rendered.replace(/\{\{logo\}\}/gi, CAC360_LOGO_FALLBACK);
  }
  
  return rendered;
}

/**
 * Build HTML email for psychological evaluation referral (standard or custom)
 */
export function buildPsychReferralEmailHtml(
  clientName: string,
  type: 'standard' | 'custom',
  dateStr: string,
): string {
  const intro = type === 'standard'
    ? `Segue em anexo o seu <strong>Encaminhamento para Avaliação Psicológica</strong> emitido pela plataforma CAC 360.`
    : `Segue em anexo o <strong>encaminhamento personalizado</strong> para Avaliação Psicológica, encaminhado pelo seu gestor de processo, junto com sua ficha de dados cadastrais.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center"
             style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background-color:#123A63;padding:28px 32px;text-align:center;">
            <span style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:2px;">CAC&#160;</span><span style="font-family:'Arial Black',Arial,sans-serif;font-size:26px;font-weight:900;color:#4ade80;letter-spacing:2px;">360</span>
            <p style="margin:8px 0 0;color:#cbd5e1;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Gestão de Workflow CR</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">Olá, <strong>${clientName}</strong>!</p>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">${intro}</p>
            <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:16px 20px;border-radius:0 6px 6px 0;margin-bottom:20px;">
              <p style="margin:0;font-size:13px;color:#0369a1;font-weight:bold;">⚠️ Importante</p>
              <p style="margin:6px 0 0;font-size:13px;color:#0369a1;line-height:1.6;">
                Apresente este encaminhamento ao profissional de psicologia no dia da sua avaliação.<br>
                O documento tem validade de <strong>90 dias</strong> a partir da data de emissão.
              </p>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Após a realização da avaliação, encaminhe o laudo de aptidão psicológica para a sua equipe CAC 360 para dar prosseguimento ao processo.</p>
            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">Emitido em: ${dateStr}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">CAC 360 — Plataforma de Gestão CR &bull; <a href="https://www.cac360.com.br" style="color:#123A63;text-decoration:none;">www.cac360.com.br</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Process pending scheduled emails (should be called periodically)
 */
export async function processScheduledEmails(tenantDb?: any): Promise<number> {
  try {
    const pendingEmails = tenantDb
      ? await db.getPendingScheduledEmailsFromDb(tenantDb)
      : await db.getPendingScheduledEmails();
    
    let sent = 0;
    for (const scheduled of pendingEmails) {
      try {
        const tenantSettings = scheduled.tenantId ? await db.getTenantSmtpSettings(scheduled.tenantId) : null;
        const emailLogoUrl = (tenantSettings as any)?.emailLogoUrl || '';
        const inlineLogo = buildInlineLogoAttachment(emailLogoUrl);

        await sendEmail({
          to: scheduled.recipientEmail,
          subject: scheduled.subject,
          html: scheduled.content,
          attachments: inlineLogo ? [inlineLogo] : undefined,
          tenantDb,
          tenantId: scheduled.tenantId,
        });
        
        tenantDb
          ? await db.markScheduledEmailSentToDb(tenantDb, scheduled.id)
          : await db.markScheduledEmailSent(scheduled.id);
        
        sent++;
      } catch (error: any) {
        console.error(`[EmailTrigger] Failed to send scheduled email ${scheduled.id}:`, error);
        tenantDb
          ? await db.markScheduledEmailFailedToDb(tenantDb, scheduled.id, error.message)
          : await db.markScheduledEmailFailed(scheduled.id, error.message);
      }
    }
    
    return sent;
  } catch (error) {
    console.error('[EmailTrigger] Error processing scheduled emails:', error);
    return 0;
  }
}
