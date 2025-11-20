import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { sendEmail } from "./emailService";
import * as db from "./db";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Clients router
  clients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Admin vê todos os clientes, operador vê apenas os seus
      const clients = ctx.user.role === 'admin' 
        ? await db.getAllClients()
        : await db.getClientsByOperator(ctx.user.id);
      
      // Adicionar estatísticas de workflow para cada cliente
      const clientsWithProgress = await Promise.all(
        clients.map(async (client) => {
          const workflow = await db.getWorkflowByClient(client.id);
          const totalSteps = workflow.length;
          const completedSteps = workflow.filter((s: any) => s.completed).length;
          const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
          
          return {
            ...client,
            progress,
            totalSteps,
            completedSteps,
          };
        })
      );
      
      return clientsWithProgress;
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão: admin ou operador responsável
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para acessar este cliente' });
        }
        
        return client;
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        cpf: z.string().min(11),
        phone: z.string().min(1),
        email: z.string().email(),
        operatorId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Admin pode atribuir a qualquer operador, operador cria para si mesmo
        const operatorId = ctx.user.role === 'admin' && input.operatorId 
          ? input.operatorId 
          : ctx.user.id;
        
        let clientId: number;
        try {
          clientId = await db.createClient({
            ...input,
            operatorId,
          });
        } catch (error: any) {
          // Check for duplicate CPF error (MySQL error code 1062)
          if (error.message && error.message.includes('Duplicate entry')) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Este CPF já está cadastrado no sistema.',
            });
          }
          throw error;
        }
        
        // Criar workflow inicial para o cliente - 6 etapas principais
        const initialSteps = [
          { stepId: 'boas-vindas', stepTitle: 'Central de Mensagens' },
          { stepId: 'cadastro', stepTitle: 'Cadastro' },
          { stepId: 'agendamento-psicotecnico', stepTitle: 'Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo' },
          { stepId: 'agendamento-laudo', stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)' },
          { stepId: 'juntada-documento', stepTitle: 'Juntada de Documentos' },
          { stepId: 'acompanhamento-sinarm', stepTitle: 'Acompanhamento Sinarm-CAC' },
        ];
        
        for (const step of initialSteps) {
          const workflowStepId = await db.upsertWorkflowStep({
            clientId,
            stepId: step.stepId,
            stepTitle: step.stepTitle,
            completed: false,
          });
          
          // Se for a etapa "Juntada de Documento", criar as 16 subtarefas (documentos)
          if (step.stepId === 'juntada-documento') {
            const documents = [
              'Comprovante de Capacidade Técnica para o manuseio de arma de fogo',
              'Certidão de Antecedente Criminal Justiça Federal',
              'Declaração de não estar respondendo a inquérito policial ou a processo criminal',
              'Documento de Identificação Pessoal',
              'Laudo de Aptidão Psicológica para o manuseio de arma de fogo',
              'Comprovante de Residência Fixa',
              'Comprovante de Ocupação Lícita',
              'Comprovante de filiação a entidade de caça',
              'Comprovante de Segundo Endereço',
              'Certidão de Antecedente Criminal Justiça Estadual',
              'Declaração de Segurança do Acervo',
              'Declaração com compromisso de comprovar a habitualidade na forma da norma vigente',
              'Comprovante da necessidade de abate de fauna invasora expedido pelo Ibama',
              'Comprovante de filiação a entidade de tiro desportivo',
              'Certidão de Antecedente Criminal Justiça Militar',
              'Certidão de Antecedente Criminal Justiça Eleitoral',
            ];
            
            for (let i = 0; i < documents.length; i++) {
              await db.upsertSubTask({
                workflowStepId,
                subTaskId: `doc-${String(i + 1).padStart(2, '0')}`,
                label: documents[i],
                completed: false,
              });
            }
          }
        }
        
        return { id: clientId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        cpf: z.string().min(11).optional(),
        phone: z.string().min(1).optional(),
        email: z.string().email().optional(),
        operatorId: z.number().optional(),
        // Dados pessoais adicionais
        identityNumber: z.string().optional(),
        identityIssueDate: z.string().optional(),
        identityIssuer: z.string().optional(),
        identityUf: z.string().optional(),
        birthDate: z.string().optional(),
        birthCountry: z.string().optional(),
        birthUf: z.string().optional(),
        birthPlace: z.string().optional(),
        gender: z.string().optional(),
        profession: z.string().optional(),
        otherProfession: z.string().optional(),
        registrationNumber: z.string().optional(),
        currentActivities: z.string().optional(),
        phone2: z.string().optional(),
        motherName: z.string().optional(),
        fatherName: z.string().optional(),
        // Endereço
        cep: z.string().optional(),
        address: z.string().optional(),
        addressNumber: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        complement: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para editar este cliente' });
        }
        
        // Apenas admin pode alterar operador
        if (input.operatorId && ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem delegar clientes' });
        }
        
        const { id, ...updateData } = input;
        await db.updateClient(id, updateData);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const client = await db.getClientById(input.id);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Apenas admin pode deletar clientes
        await db.deleteClient(input.id);
        return { success: true };
      }),
  }),

  // Workflow router
  workflow: router({
    getByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        const steps = await db.getWorkflowByClient(input.clientId);
        
        // Buscar subtarefas para cada step
        const stepsWithSubTasks = await Promise.all(
          steps.map(async (step) => {
            const subTasksList = await db.getSubTasksByWorkflowStep(step.id);
            return {
              ...step,
              subTasks: subTasksList,
            };
          })
        );
        
        return stepsWithSubTasks;
      }),

    updateStep: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        stepId: z.number(),
        completed: z.boolean().optional(),
        sinarmStatus: z.string().optional(),
        protocolNumber: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Buscar etapa atual
        const currentStep = await db.getWorkflowStepById(input.stepId);
        if (!currentStep) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Etapa não encontrada' });
        }
        
        const client = await db.getClientById(currentStep.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        // Construir objeto de atualização apenas com campos fornecidos
        const updateData: any = {
          id: input.stepId,
          clientId: currentStep.clientId,
          stepId: currentStep.stepId,
          stepTitle: currentStep.stepTitle,
        };
        
        if (input.completed !== undefined) updateData.completed = input.completed;
        if (input.sinarmStatus !== undefined) updateData.sinarmStatus = input.sinarmStatus;
        if (input.protocolNumber !== undefined) updateData.protocolNumber = input.protocolNumber;
        
        await db.upsertWorkflowStep(updateData);
        
        return { success: true };
      }),

    updateSubTask: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        subTaskId: z.number(),
        completed: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        await db.updateSubTaskCompleted(input.subTaskId, input.completed);
        
        return { success: true };
      }),

    generateWelcomePDF: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        const { generateWelcomePDF } = await import('./generate-pdf');
        const pdfBuffer = await generateWelcomePDF(client);
        
        // Upload para S3
        const fileName = `boas-vindas-${client.name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
        const result = await storagePut(fileName, pdfBuffer, 'application/pdf');
        
        return { url: result.url, fileName };
      }),

    updateScheduling: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        stepId: z.number(),
        scheduledDate: z.string().optional(),
        examinerName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        await db.upsertWorkflowStep({
          id: input.stepId,
          clientId: input.clientId,
          stepId: '',
          stepTitle: '',
          scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
          examinerName: input.examinerName || null,
        });
        
        return { success: true };
      }),
  }),

  // Documents router
  documents: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        return await db.getDocumentsByClient(input.clientId);
      }),

    upload: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        workflowStepId: z.number().optional(),
        subTaskId: z.number().optional(),
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        // Upload para S3
        const buffer = Buffer.from(input.fileData, 'base64');
        const fileKey = `clients/${input.clientId}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Salvar no banco
        const documentId = await db.createDocument({
          clientId: input.clientId,
          workflowStepId: input.workflowStepId || null,
          subTaskId: input.subTaskId || null,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          uploadedBy: ctx.user.id,
        });
        
        return { id: documentId, url };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await db.getDocumentById(input.id);
        
        if (!doc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado' });
        }
        
        const client = await db.getClientById(doc.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        await db.deleteDocument(input.id);
        return { success: true };
      }),

    downloadEnxoval: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        const docs = await db.getDocumentsByClient(input.clientId);
        
        return {
          clientName: client.name,
          documents: docs.map(d => ({
            id: d.id,
            fileName: d.fileName,
            fileUrl: d.fileUrl,
            mimeType: d.mimeType,
            createdAt: d.createdAt,
          })),
        };
      }),

    // Upload de anexo para template (sem clientId)
    uploadTemplateAttachment: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Apenas admin pode fazer upload de anexos de template
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Apenas administradores podem adicionar anexos a templates' });
        }
        
        // Upload para S3
        const buffer = Buffer.from(input.fileData, 'base64');
        const fileKey = `templates/attachments/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        return { url, fileKey };
      }),
  }),

  // Email router
  emails: router({
    // Get email template
    getTemplate: protectedProcedure
      .input(z.object({
        templateKey: z.string(),
      }))
      .query(async ({ input }) => {
        return await db.getEmailTemplate(input.templateKey);
      }),

    // Get all email templates
    getAllTemplates: protectedProcedure
      .query(async () => {
        return await db.getAllEmailTemplates();
      }),

    // Save email template
    saveTemplate: protectedProcedure
      .input(z.object({
        templateKey: z.string(),
        templateTitle: z.string().optional(),
        subject: z.string(),
        content: z.string(),
        attachments: z.string().optional(), // JSON string of attachments
      }))
      .mutation(async ({ input }) => {
        const templateId = await db.saveEmailTemplate(input);
        return { success: true, templateId };
      }),

    // Get email log (check if email was sent and get details)
    getEmailLog: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        templateKey: z.string(),
      }))
      .query(async ({ input }) => {
        return await db.getEmailLog(input.clientId, input.templateKey);
      }),

    // Send email
    sendEmail: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        templateKey: z.string(),
        recipientEmail: z.string(),
        subject: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }

        const template = await db.getEmailTemplate(input.templateKey);
        const attachments = template?.attachments ? JSON.parse(template.attachments) : [];

        // Calcular progresso do workflow
        const workflow = await db.getWorkflowByClient(input.clientId);
        const totalSteps = workflow.length;
        const completedSteps = workflow.filter((s: any) => s.completed).length;
        const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        
        // Buscar status do Sinarm-CAC
        const sinarmStep = workflow.find((s: any) => s.stepId === 'acompanhamento-sinarm');
        const sinarmStatus = sinarmStep?.sinarmStatus || 'Nao iniciado';

        const replaceVariables = (text: string, clientData: any) => {
          let result = text;
          result = result.replace(/{{nome}}/g, clientData.name || '');
          result = result.replace(/{{data}}/g, new Date().toLocaleDateString('pt-BR'));
          result = result.replace(/{{status}}/g, progressPercentage + '% concluido');
          result = result.replace(/{{status_sinarm}}/g, sinarmStatus);
          result = result.replace(/{{email}}/g, clientData.email || '');
          result = result.replace(/{{cpf}}/g, clientData.cpf || '');
          result = result.replace(/{{telefone}}/g, clientData.phone || '');
          return result;
        };

        const finalSubject = replaceVariables(input.subject, client);
        const finalContent = replaceVariables(input.content, client);

        try {
          await sendEmail({
            to: input.recipientEmail,
            subject: finalSubject,
            html: finalContent,
            attachments: attachments.map((att: any) => ({ filename: att.fileName, path: att.fileUrl }))
          });
        } catch (error) {
          console.error("Email sending failed:", error);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Falha ao enviar o email. Verifique as configurações SMTP e tente novamente.',
          });
        }

        const logId = await db.logEmailSent({
          clientId: input.clientId,
          templateKey: input.templateKey,
          recipientEmail: input.recipientEmail,
          subject: finalSubject,
          content: finalContent,
          sentBy: ctx.user.id,
        });

        return { success: true, logId };
      }),

    // Get email logs for a client
    getLogs: protectedProcedure
      .input(z.object({
        clientId: z.number(),
      }))
      .query(async ({ input }) => {
        return await db.getEmailLogsByClient(input.clientId);
      }),
  }),

  // Users router (admin only)
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin']),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    assignRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin']),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    deleteUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Impedir exclusão do próprio usuário
        if (input.userId === ctx.user.id) {
          throw new Error('Você não pode excluir seu próprio usuário');
        }
        
        await db.deleteUser(input.userId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
