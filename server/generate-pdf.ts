import PDFDocument from 'pdfkit';
import type { Client } from '../drizzle/schema';

export function generateWelcomePDF(client: Client): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header com logo (texto por enquanto)
    doc.fontSize(24).fillColor('#C41E3A').text('FIRING RANGE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#000000').text('Clube de Tiro Desportivo', { align: 'center' });
    doc.moveDown(2);

    // Título
    doc.fontSize(20).fillColor('#C41E3A').text('Boas-Vindas!', { align: 'center' });
    doc.moveDown(1);

    // Saudação personalizada
    doc.fontSize(14).fillColor('#000000').text(`Olá, ${client.name}!`, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(
      'Seja bem-vindo(a) ao Firing Range! Estamos muito felizes em tê-lo(a) conosco nesta jornada para obtenção do seu Certificado de Registro (CR) de Atirador Desportivo.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    // Seção: O que é o CR
    doc.fontSize(14).fillColor('#C41E3A').text('O que é o Certificado de Registro (CR)?');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000').text(
      'O Certificado de Registro (CR) é o documento que autoriza você a possuir armas de fogo de uso permitido no Brasil. Com ele, você poderá adquirir, registrar e manter armas em sua residência de forma legal e segura.',
      { align: 'justify' }
    );
    doc.moveDown(1);

    // Seção: Checklist de Documentos
    doc.fontSize(14).fillColor('#C41E3A').text('Documentos Necessários');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000');
    
    const documentos = [
      'Identificação Pessoal (RG, CNH ou Passaporte)',
      'Comprovante de Residência Recente (menos de 30 dias)',
      'Comprovantes de Residência Anteriores (2020-2024)',
      'Comprovante de Ocupação Lícita (contracheque, CNPJ, etc.)',
      'Laudo de Aptidão Psicológica (fornecido pela clínica)',
      'Certidões Negativas (Federal, Militar, Eleitoral, Estadual)',
    ];

    documentos.forEach((doc_item, index) => {
      doc.text(`${index + 1}. ${doc_item}`, { indent: 20 });
    });
    doc.moveDown(1);

    // Seção: Próximos Passos
    doc.fontSize(14).fillColor('#C41E3A').text('Próximos Passos');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000').text(
      '1. Agendamento Psicotécnico: Agende sua avaliação psicológica na clínica credenciada.',
      { indent: 20 }
    );
    doc.moveDown(0.5);
    doc.text(
      '2. Reúna os Documentos: Providencie todos os documentos listados acima.',
      { indent: 20 }
    );
    doc.moveDown(0.5);
    doc.text(
      '3. Emita as Certidões: Acesse os sites oficiais e emita as certidões negativas.',
      { indent: 20 }
    );
    doc.moveDown(0.5);
    doc.text(
      '4. Envie para Nós: Envie toda a documentação via WhatsApp para nossa equipe.',
      { indent: 20 }
    );
    doc.moveDown(1);

    // Seção: Informações de Contato
    doc.fontSize(14).fillColor('#C41E3A').text('Informações de Contato');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000');
    doc.text(`Seu CPF: ${client.cpf}`, { indent: 20 });
    doc.text(`Seu Telefone: ${client.phone}`, { indent: 20 });
    doc.text(`Seu E-mail: ${client.email}`, { indent: 20 });
    doc.moveDown(1);

    // Seção: Horário de Atendimento
    doc.fontSize(14).fillColor('#C41E3A').text('Horário de Atendimento');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000');
    doc.text('Terça a Sexta: 9h às 17h30', { indent: 20 });
    doc.text('Sábados: 9h às 15h', { indent: 20 });
    doc.text('Domingos: 9h às 14h', { indent: 20 });
    doc.moveDown(2);

    // Footer
    doc.fontSize(10).fillColor('#666666').text(
      'Firing Range - Clube de Tiro Desportivo | www.firingrange.com.br',
      { align: 'center' }
    );

    doc.end();
  });
}
