import nodemailer from 'nodemailer';
import fs from 'fs';

// Ler logo PNG Base64
const logoPngDataUri = fs.readFileSync('/tmp/logo_png_base64.txt', 'utf-8').trim();

// Configurações SMTP
const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'rodrigogpx@gmail.com',
    pass: 'qhou kvus uvre ivnv'
  }
};

console.log('🚀 Iniciando teste de envio de email com logo PNG...\n');

// Criar transporter
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// HTML do template com logo PNG Base64
const htmlContent = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Boas Vindas - CAC 360</title></head><body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;"><table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center" style="padding: 40px 0;"><table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><tr><td style="background-color: #1c1c1c; padding: 30px; text-align: center;"><img src="${logoPngDataUri}" alt="CAC 360" style="max-width: 180px; height: auto;"></td></tr><tr><td style="background-color: #ff0000; height: 6px;"></td></tr><tr><td style="padding: 40px 30px;"><h1 style="color: #1c1c1c; font-size: 28px; margin: 0 0 20px 0; font-weight: bold;"> Bem-vindo(a), Rodrigo! </h1><p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;"> É um prazer tê-lo(a) conosco na <strong>CAC 360</strong>. Estamos comprometidos em oferecer o melhor serviço e acompanhamento durante todo o seu processo de <strong>Certificado de Registro (CR)</strong>. </p><p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;"> Nossa equipe está à disposição para auxiliá-lo(a) em cada etapa do processo. Em breve, você receberá mais informações sobre os próximos passos. </p><table role="presentation" style="margin: 30px 0;"><tr><td style="border-radius: 4px; background-color: #ff0000;"><a href="https://firingrange.com.br" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;"> Acessar Meu Workflow </a></td></tr></table><p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;"> Se tiver alguma dúvida, não hesite em entrar em contato conosco. </p></td></tr><tr><td style="background-color: #1c1c1c; padding: 30px; text-align: center;"><p style="color: #ffffff; font-size: 14px; margin: 0 0 10px 0;"><strong>CAC 360</strong></p><p style="color: #cccccc; font-size: 12px; margin: 0 0 5px 0;"> Especialistas em Certificado de Registro </p><p style="color: #cccccc; font-size: 12px; margin: 0;"> 📧 contato@firingrange.com.br | 📞 (11) 1234-5678 </p></td></tr></table></td></tr></table></body></html>`;

// Configurar email
const mailOptions = {
  from: '"CAC 360" <rodrigogpx@gmail.com>',
  to: 'rodrigogpx@gmail.com',
  subject: 'Teste FINAL - Bem-vindo(a) à CAC 360 - Logo PNG',
  html: htmlContent
};

// Enviar email
try {
  console.log('📧 Enviando email de teste com logo PNG para rodrigogpx@gmail.com...');
  const info = await transporter.sendMail(mailOptions);
  console.log('\n✅ Email enviado com sucesso!');
  console.log('📬 Message ID:', info.messageId);
  console.log('📨 Response:', info.response);
  console.log('\n🎉 Verifique sua caixa de entrada em rodrigogpx@gmail.com');
  console.log('🖼️  A logo PNG deve aparecer corretamente agora!');
} catch (error) {
  console.error('\n❌ Erro ao enviar email:');
  console.error(error.message);
  if (error.code) {
    console.error('Código do erro:', error.code);
  }
  process.exit(1);
}
