import { drizzle } from "drizzle-orm/mysql2";
import { clients, workflowSteps } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

const newSteps = [
  { stepId: 'doc-01', stepTitle: 'Comprovante de Capacidade Técnica para o manuseio de arma de fogo' },
  { stepId: 'doc-02', stepTitle: 'Certidão de Antecedente Criminal Justiça Federal' },
  { stepId: 'doc-03', stepTitle: 'Declaração de não estar respondendo a inquérito policial ou a processo criminal' },
  { stepId: 'doc-04', stepTitle: 'Documento de Identificação Pessoal' },
  { stepId: 'doc-05', stepTitle: 'Laudo de Aptidão Psicológica para o manuseio de arma de fogo' },
  { stepId: 'doc-06', stepTitle: 'Comprovante de Residência Fixa' },
  { stepId: 'doc-07', stepTitle: 'Comprovante de Ocupação Lícita' },
  { stepId: 'doc-08', stepTitle: 'Comprovante de filiação a entidade de caça' },
  { stepId: 'doc-09', stepTitle: 'Comprovante de Segundo Endereço de Guarda do Acervo' },
  { stepId: 'doc-10', stepTitle: 'Certidão de Antecedente Criminal Justiça Estadual' },
  { stepId: 'doc-11', stepTitle: 'Declaração de Segurança do Acervo' },
  { stepId: 'doc-12', stepTitle: 'Declaração com compromisso de comprovar a habitualidade na forma da norma vigente' },
  { stepId: 'doc-13', stepTitle: 'Comprovante da necessidade de abate de fauna invasora expedido pelo Ibama' },
  { stepId: 'doc-14', stepTitle: 'Comprovante de filiação a entidade de tiro desportivo' },
  { stepId: 'doc-15', stepTitle: 'Certidão de Antecedente Criminal Justiça Militar' },
  { stepId: 'doc-16', stepTitle: 'Certidão de Antecedente Criminal Justiça Eleitoral' },
];

async function migrate() {
  console.log('Buscando clientes...');
  const allClients = await db.select().from(clients);
  console.log(`Encontrados ${allClients.length} clientes`);
  
  for (const client of allClients) {
    console.log(`Atualizando workflow do cliente ${client.name} (ID: ${client.id})...`);
    
    // Deletar steps antigos
    await db.delete(workflowSteps).where(eq(workflowSteps.clientId, client.id));
    
    // Inserir novos steps
    for (const step of newSteps) {
      await db.insert(workflowSteps).values({
        clientId: client.id,
        stepId: step.stepId,
        stepTitle: step.stepTitle,
        completed: false,
      });
    }
    
    console.log(`✓ Cliente ${client.name} atualizado`);
  }
  
  console.log('Migração concluída!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
