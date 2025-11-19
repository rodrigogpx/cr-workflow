import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/mysql2';
import { emailTemplates } from './drizzle/schema.ts';
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

const templates = [
  {
    templateKey: 'welcome',
    subject: 'Bem-vindo(a) à Firing Range - {{nome}}',
    content: welcome
  },
  {
    templateKey: 'process',
    subject: 'Informações sobre o Processo CR - {{nome}}',
    content: processTemplate
  },
  {
    templateKey: 'status',
    subject: 'Atualização do Seu Processo - {{nome}}',
    content: statusTemplate
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
            subject: template.subject,
            content: template.content,
            updatedAt: new Date()
          })
          .where(eq(emailTemplates.templateKey, template.templateKey));
        console.log(`✅ Template "${template.templateKey}" atualizado`);
      } else {
        // Insert
        await db.insert(emailTemplates).values({
          templateKey: template.templateKey,
          subject: template.subject,
          content: template.content,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Template "${template.templateKey}" inserido`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar template "${template.templateKey}":`, error.message);
    }
  }
  
  console.log('\n✅ Seed concluído!');
  process.exit(0);
}

seedTemplates();
