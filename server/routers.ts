import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";
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
      if (ctx.user.role === 'admin') {
        return await db.getAllClients();
      } else {
        return await db.getClientsByOperator(ctx.user.id);
      }
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
        
        const clientId = await db.createClient({
          ...input,
          operatorId,
        });
        
        // Criar workflow inicial para o cliente - 6 etapas principais
        const initialSteps = [
          { stepId: 'cadastro', stepTitle: 'Cadastro' },
          { stepId: 'boas-vindas', stepTitle: 'Boas Vindas' },
          { stepId: 'agendamento-psicotecnico', stepTitle: 'Agendamento Psicotécnico' },
          { stepId: 'juntada-documento', stepTitle: 'Juntada de Documento' },
          { stepId: 'agendamento-laudo', stepTitle: 'Agendamento de Laudo para Manuseio de Arma de Fogo' },
          { stepId: 'despachante', stepTitle: 'Despachante' },
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
              'Comprovante de Segundo Endereço de Guarda do Acervo',
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
        clientId: z.number(),
        stepId: z.number(),
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
              // Buscar etapa atual para preservar stepId e stepTitle
        const currentStep = await db.getWorkflowStepById(input.stepId);
        if (!currentStep) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Etapa não encontrada' });
        }
        
        await db.upsertWorkflowStep({
          id: input.stepId,
          clientId: input.clientId,
          stepId: currentStep.stepId,
          stepTitle: currentStep.stepTitle,
          completed: input.completed,
        });
        
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
        
        await db.upsertSubTask({
          id: input.subTaskId,
          workflowStepId: 0,
          subTaskId: '',
          label: '',
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
        });
        
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

    // Save email template
    saveTemplate: protectedProcedure
      .input(z.object({
        templateKey: z.string(),
        subject: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const templateId = await db.saveEmailTemplate(input);
        return { success: true, templateId };
      }),

    // Check if email was sent
    checkSent: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        templateKey: z.string(),
      }))
      .query(async ({ input }) => {
        return await db.checkEmailSent(input.clientId, input.templateKey);
      }),

    // Send email (log only, actual sending would need email service)
    sendEmail: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        templateKey: z.string(),
        recipientEmail: z.string(),
        subject: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Log the email send
        const logId = await db.logEmailSent({
          clientId: input.clientId,
          templateKey: input.templateKey,
          recipientEmail: input.recipientEmail,
          subject: input.subject,
          content: input.content,
          sentBy: ctx.user.id,
        });

        // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
        // For now, we just log it
        
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
  }),
});

export type AppRouter = typeof appRouter;
