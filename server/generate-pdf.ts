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

export function generateClientDataPDF(client: Client): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).fillColor('#1a5c00').text('DADOS DO CADASTRO', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666666').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.moveDown(2);

    // Dados Pessoais
    doc.fontSize(14).fillColor('#1a5c00').text('Dados Pessoais');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5c00');
    doc.moveDown(0.5);
    
    doc.fontSize(11).fillColor('#000000');
    doc.text(`Nome Completo: ${client.name || '-'}`);
    doc.text(`CPF: ${client.cpf || '-'}`);
    doc.text(`RG: ${(client as any).rg || '-'}`);
    doc.text(`Data de Nascimento: ${client.birthDate ? new Date(client.birthDate).toLocaleDateString('pt-BR') : '-'}`);
    doc.text(`Sexo: ${(client as any).gender || '-'}`);
    doc.text(`Naturalidade: ${(client as any).naturalidade || '-'}`);
    doc.text(`Nacionalidade: ${(client as any).nacionalidade || '-'}`);
    doc.text(`Estado Civil: ${(client as any).maritalStatus || '-'}`);
    doc.text(`Profissão: ${(client as any).profession || '-'}`);
    doc.moveDown(1);

    // Contato
    doc.fontSize(14).fillColor('#1a5c00').text('Contato');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5c00');
    doc.moveDown(0.5);
    
    doc.fontSize(11).fillColor('#000000');
    doc.text(`E-mail: ${client.email || '-'}`);
    doc.text(`Telefone: ${client.phone || '-'}`);
    doc.moveDown(1);

    // Endereço
    doc.fontSize(14).fillColor('#1a5c00').text('Endereço');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5c00');
    doc.moveDown(0.5);
    
    doc.fontSize(11).fillColor('#000000');
    doc.text(`Logradouro: ${(client as any).street || '-'}`);
    doc.text(`Número: ${(client as any).number || '-'}`);
    doc.text(`Complemento: ${(client as any).complement || '-'}`);
    doc.text(`Bairro: ${(client as any).neighborhood || '-'}`);
    doc.text(`Cidade: ${(client as any).city || '-'}`);
    doc.text(`Estado: ${(client as any).state || '-'}`);
    doc.text(`CEP: ${(client as any).zipCode || '-'}`);
    doc.moveDown(1);

    // Filiação
    doc.fontSize(14).fillColor('#1a5c00').text('Filiação');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5c00');
    doc.moveDown(0.5);
    
    doc.fontSize(11).fillColor('#000000');
    doc.text(`Nome do Pai: ${(client as any).fatherName || '-'}`);
    doc.text(`Nome da Mãe: ${(client as any).motherName || '-'}`);
    doc.moveDown(2);

    // Footer
    doc.fontSize(9).fillColor('#999999').text(
      'Documento gerado automaticamente pelo sistema CAC 360',
      { align: 'center' }
    );

    doc.end();
  });
}
