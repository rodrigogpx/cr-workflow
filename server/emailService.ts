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
 * Send email via Gateway (production) or SMTP (development)
 */
export async function sendEmail(options: SendEmailOptions & { tenantDb?: any; tenantId?: number }): Promise<{ success: boolean; messageId?: string }> {
  const { tenantDb, tenantId, ...emailOptions } = options;
  // Em produção, usar Gateway para contornar restrições SMTP do Railway
  const useGateway = process.env.NODE_ENV === 'production' || process.env.USE_EMAIL_GATEWAY === 'true';
  
  if (useGateway) {
    console.log('[EmailService] Using PostmanGPX for sendEmail (gateway mode)');
    const result = await sendEmailViaPostmanGpx({
      to: emailOptions.to,
      subject: emailOptions.subject,
      html: emailOptions.html,
    }, tenantId);
    
    if (!result.success) {
      throw new Error(result.error || 'Falha ao enviar email via Gateway');
    }
    
    return { success: true, messageId: 'gateway-' + Date.now() };
  }
  
  // Desenvolvimento: usar SMTP direto
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
      replyTo: extractEmailAddress(config.smtpFrom),
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
async function sendEmailViaPostmanGpx(
  options: {
    to: string;
    subject: string;
    html: string;
  },
  tenantId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { getTenantSmtpSettings } = await import('./db');

    let baseUrl = POSTMANGPX_BASE_URL;
    let apiKey = POSTMANGPX_API_KEY;
    let smtpFrom: string | undefined;

    try {
      if (tenantId) {
        console.log(`[EmailService] Looking up PostmanGPX settings for tenant ${tenantId}`);
        const tenantSettings = await getTenantSmtpSettings(tenantId);
        console.log(`[EmailService] Tenant settings found:`, tenantSettings ? 'yes' : 'no');
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

    console.log('[EmailService] Sending email via PostmanGPX to:', options.to);
    console.log('[EmailService] PostmanGPX Base URL:', normalizedBaseUrl);

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
      console.log('[EmailService] Email queued via PostmanGPX successfully:', (data as any).id);
      return { success: true };
    }

    console.log('[EmailService] PostmanGPX response (non-standard but ok)');
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
    console.log('[EmailService] Using PostmanGPX (gateway mode)');

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
    
    console.log(`[EmailTrigger] Processing event: ${event} for client ${client.id}`);
    
    // Fetch tenant settings to get logo URL
    const tenantSettings = tenantId ? await db.getTenantSmtpSettings(tenantId) : null;
    const emailLogoUrl = (tenantSettings as any)?.emailLogoUrl || '';
    
    // Get active triggers for this event
    const triggers = tenantDb
      ? await db.getActiveTriggersByEventFromDb(tenantDb, event, tenantId)
      : await db.getActiveTriggersByEvent(event, tenantId);
    
    if (triggers.length === 0) {
      console.log(`[EmailTrigger] No active triggers for event: ${event}`);
      return;
    }
    
    console.log(`[EmailTrigger] Found ${triggers.length} trigger(s) for event: ${event}`);
    
    for (const trigger of triggers) {
      // Get templates for this trigger
      const templates = tenantDb
        ? await db.getTemplatesByTriggerIdFromDb(tenantDb, trigger.id)
        : await db.getTemplatesByTriggerId(trigger.id);
      
      if (templates.length === 0) {
        console.log(`[EmailTrigger] No templates configured for trigger: ${trigger.name}`);
        continue;
      }
      
      // Determine recipients
      const recipients = await resolveRecipients(trigger, client, users, tenantDb);
      
      if (recipients.length === 0) {
        console.log(`[EmailTrigger] No recipients for trigger: ${trigger.name}`);
        continue;
      }
      
      console.log(`[EmailTrigger] Recipients resolved: ${JSON.stringify(recipients.map(r => r.email))}`);
      
      // Process each template
      for (const templateLink of templates) {
        const template = templateLink.template;
        if (!template) {
          console.log(`[EmailTrigger] Template link ${templateLink.id} has no template, skipping`);
          continue;
        }
        
        // Render template with client data
        const renderedSubject = renderTemplate(template.subject, client, extraData, emailLogoUrl);
        const renderedContent = renderTemplate(template.content, client, extraData, emailLogoUrl);
        
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
              
              console.log(`[EmailTrigger] Scheduled reminder for ${recipient.email} at ${reminderDate.toISOString()}`);
            }
          }
        }
        
        // Send immediate email if configured
        console.log(`[EmailTrigger] Trigger sendImmediate=${trigger.sendImmediate}, template isForReminder=${templateLink.isForReminder}`);
        if (trigger.sendImmediate && !templateLink.isForReminder) {
          for (const recipient of recipients) {
            if (!recipient.email || !recipient.email.trim()) {
              console.log(`[EmailTrigger] Skipping recipient with invalid email`);
              continue;
            }
            try {
              await sendEmail({
                to: recipient.email,
                subject: renderedSubject,
                html: renderedContent,
                tenantDb,
                tenantId,
              });
              console.log(`[EmailTrigger] Sent immediate email to ${recipient.email}`);
              
              // Registrar envio na Central de Mensagens
              try {
                if (tenantDb) {
                  await db.logEmailSentToDb(tenantDb, {
                    clientId: client.id,
                    templateKey: template.key || `trigger_${trigger.id}`,
                    recipientEmail: recipient.email,
                    subject: renderedSubject,
                    content: renderedContent,
                    sentBy: 0, // 0 = sistema automático
                  });
                  console.log(`[EmailTrigger] Logged email to Central de Mensagens for client ${client.id}`);
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
    } else {
      console.log(`[EmailTrigger] Client ${client.id} has no valid email, skipping client recipient`);
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
  
  // Logo placeholder - renders as <img> tag if logo is configured
  if (emailLogoUrl) {
    rendered = rendered.replace(/\{\{logo\}\}/gi, `<img src="${emailLogoUrl}" alt="Logo" style="max-height: 80px; max-width: 200px;" />`);
  } else {
    rendered = rendered.replace(/\{\{logo\}\}/gi, '');
  }
  
  return rendered;
}

/**
 * Process pending scheduled emails (should be called periodically)
 */
export async function processScheduledEmails(tenantDb?: any): Promise<number> {
  try {
    const pendingEmails = tenantDb
      ? await db.getPendingScheduledEmailsFromDb(tenantDb)
      : await db.getPendingScheduledEmails();
    
    console.log(`[EmailTrigger] Processing ${pendingEmails.length} scheduled email(s)`);
    
    let sent = 0;
    for (const scheduled of pendingEmails) {
      try {
        await sendEmail({
          to: scheduled.recipientEmail,
          subject: scheduled.subject,
          html: scheduled.content,
          tenantDb,
          tenantId: scheduled.tenantId,
        });
        
        tenantDb
          ? await db.markScheduledEmailSentToDb(tenantDb, scheduled.id)
          : await db.markScheduledEmailSent(scheduled.id);
        
        sent++;
        console.log(`[EmailTrigger] Sent scheduled email ${scheduled.id} to ${scheduled.recipientEmail}`);
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
