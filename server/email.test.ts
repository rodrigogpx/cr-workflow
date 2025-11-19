import { describe, it, expect } from 'vitest';
import nodemailer from 'nodemailer';

describe('SMTP Configuration', () => {
  it('should validate SMTP credentials', async () => {
    // Verificar se as variáveis de ambiente estão configuradas
    expect(process.env.SMTP_HOST).toBeDefined();
    expect(process.env.SMTP_PORT).toBeDefined();
    expect(process.env.SMTP_USER).toBeDefined();
    expect(process.env.SMTP_PASS).toBeDefined();
    expect(process.env.SMTP_FROM).toBeDefined();

    // Criar transporter com as credenciais
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verificar conexão SMTP
    const verified = await transporter.verify();
    expect(verified).toBe(true);
  }, 15000); // 15 segundos de timeout para conexão SMTP
});
