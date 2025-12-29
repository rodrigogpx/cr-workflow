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
 * Send email via Gateway (production) or SMTP (development)
 */
export async function sendEmail(options: SendEmailOptions, tenantDb?: any): Promise<{ success: boolean; messageId?: string }> {
  // Em produção, usar Gateway para contornar restrições SMTP do Railway
  const useGateway = process.env.NODE_ENV === 'production' || process.env.USE_EMAIL_GATEWAY === 'true';
  
  if (useGateway) {
    console.log('[EmailService] Using Gateway for sendEmail (production mode)');
    const result = await sendEmailViaGateway({
      to: options.to,
      subject: options.subject,
      body: options.html,
      isHtml: true,
    });
    
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
    console.log('[EmailService] Gateway URL:', EMAIL_GATEWAY_URL);
    
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

    // Verificar se a resposta é JSON válido
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[EmailService] Gateway returned non-JSON response:', text.substring(0, 200));
      return { 
        success: false, 
        error: `Gateway indisponível ou retornou resposta inválida (HTTP ${response.status}). Verifique se o serviço está ativo.` 
      };
    }

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
    return { success: false, error: `Falha na conexão com gateway: ${error.message}` };
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
      
      // Process each template
      for (const templateLink of templates) {
        const template = templateLink.template;
        if (!template) continue;
        
        // Render template with client data
        const renderedSubject = renderTemplate(template.subject, client, extraData);
        const renderedContent = renderTemplate(template.content, client, extraData);
        
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
        if (trigger.sendImmediate && !templateLink.isForReminder) {
          for (const recipient of recipients) {
            try {
              await sendEmail({
                to: recipient.email,
                subject: renderedSubject,
                html: renderedContent,
                tenantDb,
              });
              console.log(`[EmailTrigger] Sent immediate email to ${recipient.email}`);
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
    recipients.push({ email: client.email, name: client.name });
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
function renderTemplate(template: string, client: Client, extraData?: Record<string, any>): string {
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
