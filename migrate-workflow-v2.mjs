import { drizzle } from "drizzle-orm/mysql2";
import { clients, workflowSteps, subTasks } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

const newSteps = [
  { stepId: 'processo-venda', stepTitle: 'Processo de Venda' },
  { stepId: 'cadastro', stepTitle: 'Cadastro' },
  { stepId: 'boas-vindas', stepTitle: 'Boas Vindas' },
  { stepId: 'agendamento-psicotecnico', stepTitle: 'Agendamento Psicotécnico' },
  { stepId: 'juntada-documento', stepTitle: 'Juntada de Documento' },
  { stepId: 'laudo-arma', stepTitle: 'Laudo Arma de Fogo' },
  { stepId: 'despachante', stepTitle: 'Despachante' },
  { stepId: 'fim', stepTitle: 'Fim' },
];

const documents = [
  'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
  'Certidão de Antecedente Criminal Justiça Federal',
  'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
  'Documento de Identificação Pessoal',
  'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
  'Comprovante de Residência Fixa',
  'Comprovante de Ocupação Lícita',
  'Comprovante de filiação a entidade de caça',
  'Comprovante de Segundo Endereço de Guarda do Acervo',
  'Certidão de Antecedente Criminal Justiça Estadual',
  'Declaração de Segurança do Acervo',
  'Declaração com compromisso de comprovar a habitualidade na forma da norma vigente',
  'Comprovante da necessidade de abate de fauna invasora expedido pelo Ibama',
  'Comprovante de filiação a entidade de tiro desportivo',
  'Certidão de Antecedente Criminal Justiça Militar',
  'Certidão de Antecedente Criminal Justiça Eleitoral',
];

async function migrate() {
  console.log('Buscando clientes...');
  const allClients = await db.select().from(clients);
  console.log(`Encontrados ${allClients.length} clientes`);
  
  for (const client of allClients) {
    console.log(`\nAtualizando workflow do cliente ${client.name} (ID: ${client.id})...`);
    
    // Deletar subtasks antigas
    const oldSteps = await db.select().from(workflowSteps).where(eq(workflowSteps.clientId, client.id));
    for (const oldStep of oldSteps) {
      await db.delete(subTasks).where(eq(subTasks.workflowStepId, oldStep.id));
    }
    
    // Deletar steps antigos
    await db.delete(workflowSteps).where(eq(workflowSteps.clientId, client.id));
    
    // Inserir novos steps
    for (const step of newSteps) {
      const result = await db.insert(workflowSteps).values({
        clientId: client.id,
        stepId: step.stepId,
        stepTitle: step.stepTitle,
        completed: false,
      });
      
      const workflowStepId = result[0].insertId;
      
      // Se for "Juntada de Documento", criar as 16 subtarefas
      if (step.stepId === 'juntada-documento') {
        console.log('  Criando 16 documentos...');
        for (let i = 0; i < documents.length; i++) {
          await db.insert(subTasks).values({
            workflowStepId,
            subTaskId: `doc-${String(i + 1).padStart(2, '0')}`,
            label: documents[i],
            completed: false,
          });
        }
      }
    }
    
    console.log(`✓ Cliente ${client.name} atualizado`);
  }
  
  console.log('\nMigração concluída!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
