import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/mysql2';
import { emailTemplates } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

// Ler templates
const welcome = readFileSync('./email-templates/welcome.html', 'utf8');
const processTemplate = readFileSync('./email-templates/process.html', 'utf8');
const statusTemplate = readFileSync('./email-templates/status.html', 'utf8');
const psicotecnicoTemplate = readFileSync('./email-templates/psicotecnico.html', 'utf8');
const laudoTecnicoTemplate = readFileSync('./email-templates/laudo_tecnico.html', 'utf8');
const juntadaDocumentosTemplate = readFileSync('./email-templates/juntada_documentos.html', 'utf8');
const psicotecnicoConcluidoTemplate = readFileSync('./email-templates/psicotecnico_concluido.html', 'utf8');
const laudoTecnicoConcluidoTemplate = readFileSync('./email-templates/laudo_tecnico_concluido.html', 'utf8');
const sinarmMontagemIniciadaTemplate = readFileSync('./email-templates/sinarm_montagem_iniciada.html', 'utf8');
const sinarmProtocoladoTemplate = readFileSync('./email-templates/sinarm_protocolado.html', 'utf8');
const sinarmAguardandoGruTemplate = readFileSync('./email-templates/sinarm_aguardando_gru.html', 'utf8');
const sinarmEmAnaliseTemplate = readFileSync('./email-templates/sinarm_em_analise.html', 'utf8');
const sinarmRestituidoTemplate = readFileSync('./email-templates/sinarm_restituido.html', 'utf8');

const templates = [
  {
    templateKey: 'boasvindas-filiado',
    templateTitle: 'Boas Vindas (AutomÃ¡tico)',
    subject: 'Bem-vindo(a) Ã  {{nome_clube}} - {{nome}}',
    content: welcome,
    attachments: '[]'
  },
  {
    templateKey: 'process_cr',
    templateTitle: 'Processo CR',
    subject: 'InformaÃ§Ãµes sobre o Processo CR - {{nome}}',
    content: processTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'psicotecnico',
    templateTitle: 'Encaminhamento PsicotÃ©cnico',
    subject: 'Encaminhamento para AvaliaÃ§Ã£o PsicolÃ³gica - {{nome}}',
    content: psicotecnicoTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'laudo_tecnico',
    templateTitle: 'Agendamento Laudo TÃ©cnico',
    subject: 'Agendamento de Laudo de Capacidade TÃ©cnica - {{nome}}',
    content: laudoTecnicoTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'juntada_documentos',
    templateTitle: 'Juntada de Documentos',
    subject: 'ConclusÃ£o da Juntada de Documentos - {{nome}}',
    content: juntadaDocumentosTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'psicotecnico_concluido',
    templateTitle: 'AvaliaÃ§Ã£o PsicolÃ³gica ConcluÃ­da',
    subject: 'Sua AvaliaÃ§Ã£o PsicolÃ³gica foi recebida - {{nome}}',
    content: psicotecnicoConcluidoTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'laudo_tecnico_concluido',
    templateTitle: 'Laudo TÃ©cnico ConcluÃ­do',
    subject: 'Seu Laudo TÃ©cnico foi recebido - {{nome}}',
    content: laudoTecnicoConcluidoTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'sinarm_montagem_iniciada',
    templateTitle: 'Status Sinarm: Montagem Iniciada',
    subject: 'Montagem do Processo Iniciada - {{nome}}',
    content: sinarmMontagemIniciadaTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'sinarm_protocolado',
    templateTitle: 'Status Sinarm: Processo Protocolado',
    subject: 'Seu Processo foi Protocolado - {{nome}}',
    content: sinarmProtocoladoTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'sinarm_aguardando_gru',
    templateTitle: 'Status Sinarm: Aguardando Baixa GRU',
    subject: 'Aguardando Baixa do Pagamento (GRU) - {{nome}}',
    content: sinarmAguardandoGruTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'sinarm_em_analise',
    templateTitle: 'Status Sinarm: Em AnÃ¡lise',
    subject: 'Seu Processo estÃ¡ em AnÃ¡lise - {{nome}}',
    content: sinarmEmAnaliseTemplate,
    attachments: '[]'
  },
  {
    templateKey: 'sinarm_restituido',
    templateTitle: 'Status Sinarm: Processo RestituÃ­do',
    subject: 'AÃ§Ã£o NecessÃ¡ria: Processo RestituÃ­do - {{nome}}',
    content: sinarmRestituidoTemplate,
    attachments: '[]'
  }
];

async function seedTemplates() {
  console.log('Inserindo templates...');
  
  for (const template of templates) {
    try {
      // Check if exists
      const existing = await db.select().from(emailTemplates)
        .where(eq(emailTemplates.templateKey, template.templateKey))
        .limit(1);
      
      if (existing.length > 0) {
        // Update
        await db.update(emailTemplates)
          .set({
            templateTitle: template.templateTitle,
            subject: template.subject,
            content: template.content,
            attachments: template.attachments,
            updatedAt: new Date()
          })
          .where(eq(emailTemplates.templateKey, template.templateKey));
        console.log(`âœ… Template "${template.templateKey}" atualizado`);
      } else {
        // Insert
        await db.insert(emailTemplates).values({
          templateKey: template.templateKey,
          templateTitle: template.templateTitle,
          subject: template.subject,
          content: template.content,
          attachments: template.attachments,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`âœ… Template "${template.templateKey}" inserido`);
      }
    } catch (error) {
      console.error(`âŒ Erro ao processar template "${template.templateKey}":`, error.message);
    }
  }
  
  console.log('\nâœ… Seed concluÃ­do!');
  process.exit(0);
}

seedTemplates();

