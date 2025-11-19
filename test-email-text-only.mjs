import nodemailer from 'nodemailer';

const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'rodrigogpx@gmail.com',
    pass: 'qhou kvus uvre ivnv'
  }
};

console.log('🚀 Teste FINAL - Email com texto apenas...\n');

const transporter = nodemailer.createTransport(SMTP_CONFIG);

const htmlContent = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Boas Vindas - Firing Range</title></head><body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;"><table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center" style="padding: 40px 0;"><table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><tr><td style="background-color: #1c1c1c; padding: 30px; text-align: center;"><h1 style="color: #ff0000; font-size: 32px; margin: 0; font-weight: bold; letter-spacing: 2px;">FIRING RANGE</h1></td></tr><tr><td style="background-color: #ff0000; height: 6px;"></td></tr><tr><td style="padding: 40px 30px;"><h1 style="color: #1c1c1c; font-size: 28px; margin: 0 0 20px 0; font-weight: bold;"> Bem-vindo(a), Rodrigo! </h1><p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;"> É um prazer tê-lo(a) conosco na <strong>Firing Range</strong>. Estamos comprometidos em oferecer o melhor serviço e acompanhamento durante todo o seu processo de <strong>Certificado de Registro (CR)</strong>. </p><p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;"> Nossa equipe está à disposição para auxiliá-lo(a) em cada etapa do processo. Em breve, você receberá mais informações sobre os próximos passos. </p><table role="presentation" style="margin: 30px 0;"><tr><td style="border-radius: 4px; background-color: #ff0000;"><a href="https://firingrange.com.br" style="display: inline-block; padding: 14px 30px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;"> Acessar Meu Workflow </a></td></tr></table><p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;"> Se tiver alguma dúvida, não hesite em entrar em contato conosco. </p></td></tr><tr><td style="background-color: #1c1c1c; padding: 30px; text-align: center;"><p style="color: #ffffff; font-size: 14px; margin: 0 0 10px 0;"><strong>Firing Range</strong></p><p style="color: #cccccc; font-size: 12px; margin: 0 0 5px 0;"> Especialistas em Certificado de Registro </p><p style="color: #cccccc; font-size: 12px; margin: 0;"> 📧 contato@firingrange.com.br | 📞 (11) 1234-5678 </p></td></tr></table></td></tr></table></body></html>`;

const mailOptions = {
  from: '"Firing Range" <rodrigogpx@gmail.com>',
  to: 'rodrigogpx@gmail.com',
  subject: 'Teste FINAL - Bem-vindo(a) à Firing Range - Texto Apenas',
  html: htmlContent
};

try {
  console.log('📧 Enviando email...');
  const info = await transporter.sendMail(mailOptions);
  console.log('\n✅ Email enviado!');
  console.log('📬 Message ID:', info.messageId);
  console.log('\n🎯 Header com texto "FIRING RANGE" em vermelho sobre fundo preto');
} catch (error) {
  console.error('\n❌ Erro:', error.message);
  process.exit(1);
}
