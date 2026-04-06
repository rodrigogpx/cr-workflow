import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import type { Client } from '../drizzle/schema';

function getCursiveFontPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'server', 'fonts', 'DancingScript-Regular.ttf'),
    path.join(__dirname, '..', 'server', 'fonts', 'DancingScript-Regular.ttf'),
    path.join(__dirname, 'fonts', 'DancingScript-Regular.ttf'),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? null;
}

export function generatePsychReferralPDF(client: Client): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const today = new Date();
    const dateStr = today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Header
    doc.fontSize(18).fillColor('#123A63').text('CAC 360', { align: 'center' });
    doc.fontSize(10).fillColor('#555555').text('Gestão de Workflow CR — Certificado de Registro', { align: 'center' });
    doc.moveDown(0.3);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).lineWidth(1.5).stroke('#123A63');
    doc.moveDown(1.5);

    // Title
    doc.fontSize(14).fillColor('#123A63').text('ENCAMINHAMENTO PARA AVALIAÇÃO PSICOLÓGICA', { align: 'center' });
    doc.moveDown(1.5);

    // Intro
    doc.fontSize(11).fillColor('#000000').text(
      'Encaminhamos o(a) Sr(a). abaixo identificado(a) para realização da Avaliação Psicológica, conforme exigência legal estabelecida pelo Estatuto do Desarmamento (Lei nº 10.826/2003), para fins de obtenção do Certificado de Registro (CR) de Atirador Desportivo junto ao Exército Brasileiro.',
      { align: 'justify' }
    );
    doc.moveDown(1.5);

    // Client data box
    doc.fontSize(12).fillColor('#123A63').text('Dados do Requerente');
    doc.moveDown(0.4);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).lineWidth(0.5).stroke('#cccccc');
    doc.moveDown(0.4);

    doc.fontSize(10).fillColor('#000000');
    const field = (label: string, value: string) => {
      doc.text(`${label}: ${value || '—'}`);
    };

    field('Nome Completo', (client as any).name || '');
    field('CPF', (client as any).cpf || '');
    field('RG', (client as any).identityNumber || '');
    field('Data de Nascimento', (client as any).birthDate
      ? new Date((client as any).birthDate).toLocaleDateString('pt-BR') : '');
    field('Sexo', (client as any).gender || '');
    field('Naturalidade', (client as any).birthPlace || '');
    field('Estado Civil', (client as any).maritalStatus || '');
    field('Profissão', (client as any).profession || '');
    doc.moveDown(0.3);
    field('Endereço', [
      (client as any).address, (client as any).addressNumber,
      (client as any).complement, (client as any).neighborhood,
      (client as any).city, (client as any).residenceUf
    ].filter(Boolean).join(', '));
    field('CEP', (client as any).cep || '');
    field('Telefone', (client as any).phone || '');
    field('E-mail', (client as any).email || '');

    doc.moveDown(1.5);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).lineWidth(0.5).stroke('#cccccc');
    doc.moveDown(1.5);

    // Body
    doc.fontSize(11).fillColor('#000000').text(
      'O(A) requerente encontra-se em processo de obtenção/renovação de seu Certificado de Registro junto ao Exército Brasileiro, necessitando de laudo psicológico conforme normativa vigente. Solicitamos que o(a) profissional avaliador(a) emita laudo conclusivo quanto à aptidão para o manuseio e guarda de arma de fogo.',
      { align: 'justify' }
    );
    doc.moveDown(1);
    doc.text(
      'Este encaminhamento é válido por 90 (noventa) dias a partir da data de emissão.',
      { align: 'justify' }
    );

    doc.moveDown(2.5);

    // Date & signature
    doc.fontSize(10).fillColor('#555555').text(`Emitido em: ${dateStr}`, { align: 'right' });
    doc.moveDown(2);

    const cursivePath = getCursiveFontPath();
    if (cursivePath) {
      try {
        doc.font(cursivePath).fontSize(26).fillColor('#123A63').text('CAC 360', { align: 'center' });
        doc.font('Helvetica');
      } catch {
        doc.fontSize(20).fillColor('#123A63').text('CAC 360', { align: 'center' });
      }
    } else {
      doc.fontSize(20).fillColor('#123A63').text('CAC 360', { align: 'center' });
    }
    doc.moveDown(0.3);
    doc.moveTo(200, doc.y).lineTo(440, doc.y).lineWidth(0.5).stroke('#000000');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#000000').text('Assinatura / Responsável CAC 360', { align: 'center' });

    // Footer
    doc.moveDown(3);
    doc.fontSize(8).fillColor('#999999').text(
      'Documento gerado automaticamente pelo sistema CAC 360 — www.cac360.com.br',
      { align: 'center' }
    );

    doc.end();
  });
}

export function generateWelcomePDF(client: Client): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header com logo (texto por enquanto)
    doc.fontSize(24).fillColor('#C41E3A').text('CAC 360', { align: 'center' });
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
      'Seja bem-vindo(a) ao CAC 360! Estamos muito felizes em tê-lo(a) conosco nesta jornada para obtenção do seu Certificado de Registro (CR) de Atirador Desportivo.',
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
      'CAC 360 - Clube de Tiro Desportivo | www.firingrange.com.br',
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
    doc.text(`RG: ${(client as any).identityNumber || '-'}`);
    doc.text(`Data de Nascimento: ${client.birthDate ? new Date(client.birthDate).toLocaleDateString('pt-BR') : '-'}`);
    doc.text(`Sexo: ${(client as any).gender || '-'}`);
    doc.text(`Naturalidade: ${(client as any).birthPlace || '-'}`);
    doc.text(`Nacionalidade: ${(client as any).birthCountry || '-'}`);
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
    doc.text(`Logradouro: ${(client as any).address || '-'}`);
    doc.text(`Número: ${(client as any).addressNumber || '-'}`);
    doc.text(`Complemento: ${(client as any).complement || '-'}`);
    doc.text(`Bairro: ${(client as any).neighborhood || '-'}`);
    doc.text(`Cidade: ${(client as any).city || '-'}`);
    doc.text(`Estado: ${(client as any).residenceUf || '-'}`);
    doc.text(`CEP: ${(client as any).cep || '-'}`);
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
