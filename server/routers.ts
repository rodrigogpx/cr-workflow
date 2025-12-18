import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { sendEmail, verifyConnection, verifyConnectionWithSettings, sendTestEmailWithSettings } from "./emailService";
import * as db from "./db";
import { invalidateTenantCache } from "./config/tenant.config";
import { storagePut } from "./storage";
import { saveClientDocumentFile } from "./fileStorage";
import { TRPCError } from "@trpc/server";
import { comparePassword, hashPassword } from "./_core/auth";
import { sdk } from "./_core/sdk";
import { getTenantDb } from "./config/tenant.config";

async function getTenantDbOrNull(ctx: any) {
  if (ctx?.tenantSlug && ctx?.tenant) {
    const tenantDb = await getTenantDb(ctx.tenant);
    if (!tenantDb) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Banco do tenant indisponível' });
    }
    return tenantDb;
  }
  return null;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      console.log("DEBUG /me user:", JSON.stringify(opts.ctx.user, null, 2));
      return opts.ctx.user;
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const tenantSlug = ctx.tenantSlug;
        console.log("[auth.login] attempt", {
          email: input.email,
          tenantSlug,
          hasTenantConfig: Boolean(ctx.tenant),
          tenantDbMode: process.env.TENANT_DB_MODE,
          nodeEnv: process.env.NODE_ENV,
        });

        const user = tenantSlug && ctx.tenant
          ? await (async () => {
              const tenantDb = await getTenantDb(ctx.tenant);
              if (!tenantDb) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Banco do tenant indisponível' });
              }
              return await db.getUserByEmailFromDb(tenantDb, input.email);
            })()
          : await db.getUserByEmail(input.email);

        console.log("[auth.login] user lookup", {
          email: input.email,
          found: Boolean(user),
          userId: user?.id,
          role: (user as any)?.role,
          hashLen: user?.hashedPassword?.length,
          hashPrefix: user?.hashedPassword?.slice?.(0, 10),
        });

        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }

        const passwordMatch = await comparePassword(input.password, user.hashedPassword);
        console.log("[auth.login] password match", {
          email: input.email,
          userId: user.id,
          passwordMatch,
        });
        if (!passwordMatch) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }

        const sessionToken = await sdk.createSessionToken(user.id.toString(), {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
          tenantSlug,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { 
          ...cookieOptions, 
          maxAge: ONE_YEAR_MS, 
          path: "/",
          httpOnly: true,
          sameSite: "lax",
        });

        console.log(`DEBUG Login success for ${user.email}, role: ${user.role}`);

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      // Garantir que os atributos de limpeza correspondam aos de criação
      ctx.res.clearCookie(COOKIE_NAME, { 
        ...cookieOptions, 
        maxAge: -1,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
      return {
        success: true,
      } as const;
    }),
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantSlug = ctx.tenantSlug;

        // Verificar se email já existe
        const existingUser = tenantSlug && ctx.tenant
          ? await (async () => {
              const tenantDb = await getTenantDb(ctx.tenant);
              if (!tenantDb) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Banco do tenant indisponível' });
              }
              return await db.getUserByEmailFromDb(tenantDb, input.email);
            })()
          : await db.getUserByEmail(input.email);

        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Este email já está cadastrado' });
        }

        // Hash da senha
        const hashedPassword = await hashPassword(input.password);

        // Criar usuário sem role (aguardando aprovação)
        const userId = tenantSlug && ctx.tenant
          ? await (async () => {
              const tenantDb = await getTenantDb(ctx.tenant);
              if (!tenantDb) {
                throw new TRPCError({ code: 'FORBIDDEN', message: 'Banco do tenant indisponível' });
              }
              return await db.upsertUserToDb(tenantDb, {
                name: input.name,
                email: input.email,
                hashedPassword,
                role: null, // Aguardando aprovação do admin
              });
            })()
          : await db.upsertUser({
              name: input.name,
              email: input.email,
              hashedPassword,
              role: null, // Aguardando aprovação do admin
            });

        return {
          success: true,
          message: 'Cadastro realizado com sucesso! Aguarde a aprovação de um administrador.',
          userId,
        };
      }),
  }),

  // Clients router
  clients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      // Admin vê todos os clientes, operador vê apenas os seus
      const clients = ctx.user.role === 'admin' 
        ? (tenantDb ? await db.getAllClientsFromDb(tenantDb, tenantId) : await db.getAllClients())
        : (tenantDb ? await db.getClientsByOperatorFromDb(tenantDb, ctx.user.id, tenantId) : await db.getClientsByOperator(ctx.user.id));
      
      // Adicionar estatísticas de workflow para cada cliente
      const clientsWithProgress = await Promise.all(
        clients.map(async (client) => {
          const workflow = tenantDb
            ? await db.getWorkflowByClientFromDb(tenantDb, client.id)
            : await db.getWorkflowByClient(client.id);
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
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.id)
          : await db.getClientById(input.id);
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
        const tenantDb = await getTenantDbOrNull(ctx);
        // Admin pode atribuir a qualquer operador, operador cria para si mesmo
        const operatorId = ctx.user.role === 'admin' && input.operatorId 
          ? input.operatorId 
          : ctx.user.id;
        
        let clientId: number;
        try {
          clientId = tenantDb
            ? await db.createClientToDb(tenantDb, {
                ...input,
                operatorId,
                tenantId: ctx.tenant?.id,
              })
            : await db.createClient({
                ...input,
                operatorId,
                tenantId: ctx.tenant?.id,
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
          const workflowStepId = tenantDb
            ? await db.upsertWorkflowStepToDb(tenantDb, {
                clientId,
                stepId: step.stepId,
                stepTitle: step.stepTitle,
                completed: false,
              })
            : await db.upsertWorkflowStep({
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
              if (tenantDb) {
                await db.upsertSubTaskToDb(tenantDb, {
                  workflowStepId,
                  subTaskId: `doc-${String(i + 1).padStart(2, '0')}`,
                  label: documents[i],
                  completed: false,
                });
              } else {
                await db.upsertSubTask({
                  workflowStepId,
                  subTaskId: `doc-${String(i + 1).padStart(2, '0')}`,
                  label: documents[i],
                  completed: false,
                });
              }
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
            maritalStatus: z.string().optional(),
            requestType: z.string().optional(),
            cacNumber: z.string().optional(),
            cacCategory: z.string().optional(),
            previousCrNumber: z.string().optional(),
            psychReportValidity: z.string().optional(),
            techReportValidity: z.string().optional(),
            residenceUf: z.string().optional(),
            // Endereço
            cep: z.string().optional(),
            address: z.string().optional(),
            addressNumber: z.string().optional(),
            neighborhood: z.string().optional(),
            city: z.string().optional(),
            complement: z.string().optional(),
          }))
          .mutation(async ({ ctx, input }) => {
            const tenantDb = await getTenantDbOrNull(ctx);
            const client = tenantDb
              ? await db.getClientByIdFromDb(tenantDb, input.id)
              : await db.getClientById(input.id);
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
            if (tenantDb) {
              await db.updateClientToDb(tenantDb, id, updateData);
            } else {
              await db.updateClient(id, updateData);
            }
            return { success: true };
          }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.id)
          : await db.getClientById(input.id);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Apenas admin pode deletar clientes
        if (tenantDb) {
          await db.deleteClientFromDb(tenantDb, input.id);
        } else {
          await db.deleteClient(input.id);
        }
        return { success: true };
      }),
  }),

  // Workflow router
  workflow: router({
    getByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        const steps = tenantDb
          ? await db.getWorkflowByClientFromDb(tenantDb, input.clientId)
          : await db.getWorkflowByClient(input.clientId);
        
        // Buscar subtarefas para cada step
        const stepsWithSubTasks = await Promise.all(
          steps.map(async (step) => {
            const subTasksList = tenantDb
              ? await db.getSubTasksByWorkflowStepFromDb(tenantDb, step.id)
              : await db.getSubTasksByWorkflowStep(step.id);
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
        const tenantDb = await getTenantDbOrNull(ctx);
        // Buscar etapa atual
        const currentStep = tenantDb
          ? await db.getWorkflowStepByIdFromDb(tenantDb, input.stepId)
          : await db.getWorkflowStepById(input.stepId);
        if (!currentStep) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Etapa não encontrada' });
        }
        
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, currentStep.clientId)
          : await db.getClientById(currentStep.clientId);
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
        
        if (tenantDb) {
          await db.upsertWorkflowStepToDb(tenantDb, updateData);
        } else {
          await db.upsertWorkflowStep(updateData);
        }
        
        return { success: true };
      }),

    updateSubTask: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        subTaskId: z.number(),
        completed: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        if (tenantDb) {
          await db.updateSubTaskCompletedToDb(tenantDb, input.subTaskId, input.completed);
        } else {
          await db.updateSubTaskCompleted(input.subTaskId, input.completed);
        }
        
        return { success: true };
      }),

    generateWelcomePDF: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
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
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        const currentStep = tenantDb
          ? await db.getWorkflowStepByIdFromDb(tenantDb, input.stepId)
          : await db.getWorkflowStepById(input.stepId);
        if (!currentStep) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Etapa não encontrada' });
        }

        // Atualizar apenas campos de agendamento, preservando identificadores e título da etapa
        if (tenantDb) {
          await db.upsertWorkflowStepToDb(tenantDb, {
            id: currentStep.id,
            clientId: currentStep.clientId,
            stepId: currentStep.stepId,
            stepTitle: currentStep.stepTitle,
            scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
            examinerName: input.examinerName || null,
          });
        } else {
          await db.upsertWorkflowStep({
            id: currentStep.id,
            clientId: currentStep.clientId,
            stepId: currentStep.stepId,
            stepTitle: currentStep.stepTitle,
            scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
            examinerName: input.examinerName || null,
          });
        }
        
        return { success: true };
      }),
  }),

  // Documents router
  documents: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        return tenantDb
          ? await db.getDocumentsByClientFromDb(tenantDb, input.clientId)
          : await db.getDocumentsByClient(input.clientId);
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
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        const buffer = Buffer.from(input.fileData, "base64");

        let fileKey: string;
        let fileUrl: string;
        let fileSize: number;

        // Se DOCUMENTS_STORAGE_DIR estiver definido, usa Volume (filesystem)
        if (process.env.DOCUMENTS_STORAGE_DIR) {
          const stored = await saveClientDocumentFile({
            clientId: input.clientId,
            fileName: input.fileName,
            buffer,
          });
          fileKey = stored.key;
          fileUrl = stored.publicPath;
          fileSize = stored.size;
        } else {
          // Fallback para storage padrão (proxy/S3)
          const relKey = `clients/${input.clientId}/${Date.now()}-${input.fileName}`;
          const { url } = await storagePut(relKey, buffer, input.mimeType);
          fileKey = relKey;
          fileUrl = url;
          fileSize = buffer.length;
        }

        // Salvar no banco
        const documentId = tenantDb
          ? await db.createDocumentToDb(tenantDb, {
              clientId: input.clientId,
              workflowStepId: input.workflowStepId || null,
              subTaskId: input.subTaskId || null,
              fileName: input.fileName,
              fileKey,
              fileUrl,
              mimeType: input.mimeType,
              fileSize,
              uploadedBy: ctx.user.id,
            })
          : await db.createDocument({
              clientId: input.clientId,
              workflowStepId: input.workflowStepId || null,
              subTaskId: input.subTaskId || null,
              fileName: input.fileName,
              fileKey,
              fileUrl,
              mimeType: input.mimeType,
              fileSize,
              uploadedBy: ctx.user.id,
            });
        
        return { id: documentId, url: fileUrl };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const doc = tenantDb
          ? await db.getDocumentByIdFromDb(tenantDb, input.id)
          : await db.getDocumentById(input.id);
        
        if (!doc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Documento não encontrado' });
        }
        
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, doc.clientId)
          : await db.getClientById(doc.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        if (tenantDb) {
          await db.deleteDocumentFromDb(tenantDb, input.id);
        } else {
          await db.deleteDocument(input.id);
        }
        return { success: true };
      }),

    downloadEnxoval: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }
        
        // Verificar permissão
        if (ctx.user.role !== 'admin' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }
        
        const docs = tenantDb
          ? await db.getDocumentsByClientFromDb(tenantDb, input.clientId)
          : await db.getDocumentsByClient(input.clientId);
        
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
    // SMTP configuration - admin only (tenant-isolated)
    getSmtpConfig: adminProcedure
      .query(async ({ ctx }) => {
        const tenantId = ctx.tenant?.id;
        
        // Se tem tenantId, busca da tabela tenants
        if (tenantId) {
          const settings = await db.getTenantSmtpSettings(tenantId);
          
          if (!settings || !settings.smtpHost) {
            return {
              smtpHost: "",
              smtpPort: 587,
              smtpUser: "",
              smtpFrom: "",
              useSecure: false,
              hasPassword: false,
              source: "none",
            };
          }

          return {
            smtpHost: settings.smtpHost || "",
            smtpPort: settings.smtpPort || 587,
            smtpUser: settings.smtpUser || "",
            smtpFrom: settings.smtpFrom || "",
            useSecure: settings.smtpPort === 465,
            hasPassword: Boolean(settings.smtpPassword),
            source: "tenant",
          };
        }

        // Fallback para env vars (sem tenant)
        return {
          smtpHost: process.env.SMTP_HOST || "",
          smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
          smtpUser: process.env.SMTP_USER || "",
          smtpFrom: process.env.SMTP_FROM || "",
          useSecure: process.env.SMTP_PORT === "465",
          hasPassword: Boolean(process.env.SMTP_PASS),
          source: process.env.SMTP_HOST ? "env" : "none",
        };
      }),

    updateSmtpConfig: adminProcedure
      .input(z.object({
        smtpHost: z.string().min(1),
        smtpPort: z.number().int().positive(),
        smtpUser: z.string().min(1),
        smtpPass: z.string().optional(),
        smtpFrom: z.string().min(1),
        useSecure: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantId = ctx.tenant?.id;
        
        if (!tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant não identificado. Faça login novamente.",
          });
        }

        // Busca configuração existente para manter senha se não informada
        const existing = await db.getTenantSmtpSettings(tenantId);
        const smtpPassword = input.smtpPass !== undefined && input.smtpPass !== ""
          ? input.smtpPass
          : existing?.smtpPassword || "";

        if (!smtpPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe a senha SMTP.",
          });
        }

        await db.updateTenantSmtpSettings(tenantId, {
          smtpHost: input.smtpHost,
          smtpPort: input.smtpPort,
          smtpUser: input.smtpUser,
          smtpPassword,
          smtpFrom: input.smtpFrom,
        });

        return { success: true };
      }),

    testSmtpConnection: adminProcedure
      .input(z.object({
        testEmail: z.string().email().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const tenantId = ctx.tenant?.id;
        
        if (!tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant não identificado.",
          });
        }

        const settings = await db.getTenantSmtpSettings(tenantId);
        if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Configure as credenciais SMTP antes de testar.",
          });
        }

        // Email destinatário: usa o email informado, ou o email do usuário logado
        const toEmail = input?.testEmail || ctx.user?.email;
        if (!toEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe um email para receber o teste.",
          });
        }

        // Enviar email de teste real
        const result = await sendTestEmailWithSettings({
          host: settings.smtpHost,
          port: settings.smtpPort || 587,
          user: settings.smtpUser,
          pass: settings.smtpPassword,
          secure: settings.smtpPort === 465,
          from: settings.smtpFrom || settings.smtpUser,
          toEmail,
        });
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Falha ao enviar email de teste. Verifique as configurações.",
          });
        }

        return { success: true, sentTo: toEmail };
      }),

    // Get email template
    getTemplate: protectedProcedure
      .input(z.object({
        templateKey: z.string(),
        module: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        if (tenantDb) {
          return await db.getEmailTemplateFromDb(tenantDb, input.templateKey, input.module);
        }
        return await db.getEmailTemplate(input.templateKey, input.module);
      }),

    // Get all email templates (optionally filtered by module)
    getAllTemplates: protectedProcedure
      .input(z.object({
        module: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        if (tenantDb) {
          return await db.getAllEmailTemplatesFromDb(tenantDb, input?.module);
        }
        return await db.getAllEmailTemplates(input?.module);
      }),

    // Save email template
    saveTemplate: protectedProcedure
      .input(z.object({
        templateKey: z.string(),
        module: z.string().optional(),
        templateTitle: z.string().optional(),
        subject: z.string(),
        content: z.string(),
        attachments: z.string().optional(), // JSON string of attachments
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const templateId = tenantDb
          ? await db.saveEmailTemplateToDb(tenantDb, input)
          : await db.saveEmailTemplate(input);
        return { success: true, templateId };
      }),

    // Get email log (check if email was sent and get details)
    getEmailLog: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        templateKey: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        if (tenantDb) {
          return await db.getEmailLogFromDb(tenantDb, input.clientId, input.templateKey);
        }
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
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }

        const template = tenantDb
          ? await db.getEmailTemplateFromDb(tenantDb, input.templateKey)
          : await db.getEmailTemplate(input.templateKey);
        const attachments = template?.attachments ? JSON.parse(template.attachments) : [];

        // Calcular progresso do workflow
        const workflow = tenantDb
          ? await db.getWorkflowByClientFromDb(tenantDb, input.clientId)
          : await db.getWorkflowByClient(input.clientId);
        const totalSteps = workflow.length;
        const completedSteps = workflow.filter((s: any) => s.completed).length;
        const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        
        // Buscar status do Sinarm-CAC
        const sinarmStep = workflow.find((s: any) => s.stepId === 'acompanhamento-sinarm');
        const sinarmStatus = sinarmStep?.sinarmStatus || 'Nao iniciado';

        // Buscar dados de agendamento de laudo (data e examinador)
        const schedulingStep = workflow.find((s: any) => s.stepId === 'agendamento-laudo');
        let schedulingDateFormatted = '';
        let schedulingExaminer = '';

        if (schedulingStep?.scheduledDate) {
          schedulingDateFormatted = new Date(schedulingStep.scheduledDate).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          });
        }

        if (schedulingStep?.examinerName) {
          schedulingExaminer = schedulingStep.examinerName;
        }

        const replaceVariables = (text: string, clientData: any) => {
          let result = text;
          result = result.replace(/{{nome}}/g, clientData.name || '');
          result = result.replace(/{{data}}/g, new Date().toLocaleDateString('pt-BR'));
          result = result.replace(/{{status}}/g, progressPercentage + '% concluido');
          result = result.replace(/{{status_sinarm}}/g, sinarmStatus);
          result = result.replace(/{{email}}/g, clientData.email || '');
          result = result.replace(/{{cpf}}/g, clientData.cpf || '');
          result = result.replace(/{{telefone}}/g, clientData.phone || '');

          // Variáveis específicas de agendamento de laudo
          if (schedulingDateFormatted) {
            result = result.replace(/{{data_agendamento}}/g, schedulingDateFormatted);
          }
          if (schedulingExaminer) {
            result = result.replace(/{{examinador}}/g, schedulingExaminer);
          }

          return result;
        };

        const finalSubject = replaceVariables(input.subject, client);
        const finalContent = replaceVariables(input.content, client);

        try {
          if (tenantDb) {
            await sendEmail({
              to: input.recipientEmail,
              subject: finalSubject,
              html: finalContent,
              attachments: attachments.map((att: any) => ({ filename: att.fileName, path: att.fileUrl }))
            }, tenantDb);
          } else {
            await sendEmail({
              to: input.recipientEmail,
              subject: finalSubject,
              html: finalContent,
              attachments: attachments.map((att: any) => ({ filename: att.fileName, path: att.fileUrl }))
            });
          }
        } catch (error) {
          console.error("Email sending failed:", error);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Falha ao enviar o email. Verifique as configurações SMTP e tente novamente.',
          });
        }

        const logId = tenantDb
          ? await db.logEmailSentToDb(tenantDb, {
              clientId: input.clientId,
              templateKey: input.templateKey,
              recipientEmail: input.recipientEmail,
              subject: finalSubject,
              content: finalContent,
              sentBy: ctx.user.id,
            })
          : await db.logEmailSent({
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
      .query(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        if (tenantDb) {
          return await db.getEmailLogsByClientFromDb(tenantDb, input.clientId);
        }
        return await db.getEmailLogsByClient(input.clientId);
      }),
  }),

  // Users router (admin only)
  users: router({
    list: adminProcedure.query(async ({ ctx }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      return tenantDb ? await db.getAllUsersFromDb(tenantDb, tenantId) : await db.getAllUsers();
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
        role: z.enum(['operator', 'admin']),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const existingUser = tenantDb
          ? await db.getUserByEmailFromDb(tenantDb, input.email)
          : await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Este email já está cadastrado' });
        }

        const hashedPassword = await hashPassword(input.password);
        const userId = tenantDb
          ? await db.upsertUserToDb(tenantDb, {
              name: input.name,
              email: input.email,
              hashedPassword,
              role: input.role,
            })
          : await db.upsertUser({
              name: input.name,
              email: input.email,
              hashedPassword,
              role: input.role,
            });

        console.log('[AUDIT] User created', {
          actorId: ctx.user.id,
          targetUserId: userId,
          email: input.email,
          role: input.role,
        });

        return { success: true, userId };
      }),

    update: adminProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        role: z.enum(['operator', 'admin']).optional(),
        password: z.string().min(6).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const user = tenantDb
          ? await db.getUserByIdFromDb(tenantDb, input.userId)
          : await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }

        const admins = (tenantDb ? await db.getAllUsersFromDb(tenantDb) : await db.getAllUsers()).filter((u: any) => u.role === 'admin');
        const isLastAdmin = admins.length === 1 && admins[0].id === input.userId;

        const updateData: any = {};

        if (input.name !== undefined) {
          updateData.name = input.name;
        }

        if (input.email !== undefined) {
          const other = tenantDb
            ? await db.getUserByEmailFromDb(tenantDb, input.email)
            : await db.getUserByEmail(input.email);
          if (other && other.id !== input.userId) {
            throw new TRPCError({ code: 'CONFLICT', message: 'Este email já está em uso por outro usuário' });
          }
          updateData.email = input.email;
        }

        if (input.role !== undefined) {
          if (isLastAdmin && input.role !== 'admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Não é possível rebaixar o último administrador do sistema.',
            });
          }
          updateData.role = input.role;
        }

        if (input.password !== undefined) {
          updateData.hashedPassword = await hashPassword(input.password);
        }

        if (Object.keys(updateData).length === 0) {
          return { success: true };
        }

        if (tenantDb) {
          await db.updateUserToDb(tenantDb, input.userId, updateData);
        } else {
          await db.updateUser(input.userId, updateData);
        }

        console.log('[AUDIT] User updated', {
          actorId: ctx.user.id,
          targetUserId: input.userId,
          updatedFields: Object.keys(updateData),
        });

        return { success: true };
      }),

    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin']),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const user = tenantDb
          ? await db.getUserByIdFromDb(tenantDb, input.userId)
          : await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }

        const admins = (tenantDb ? await db.getAllUsersFromDb(tenantDb) : await db.getAllUsers()).filter((u: any) => u.role === 'admin');
        const isLastAdmin = admins.length === 1 && admins[0].id === input.userId;

        if (isLastAdmin && input.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Não é possível rebaixar o último administrador do sistema.',
          });
        }

        if (tenantDb) {
          await db.updateUserRoleToDb(tenantDb, input.userId, input.role);
        } else {
          await db.updateUserRole(input.userId, input.role);
        }

        console.log('[AUDIT] User role updated', {
          actorId: ctx.user.id,
          targetUserId: input.userId,
          newRole: input.role,
        });

        return { success: true };
      }),

    assignRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin']),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const user = tenantDb
          ? await db.getUserByIdFromDb(tenantDb, input.userId)
          : await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }

        const admins = (tenantDb ? await db.getAllUsersFromDb(tenantDb) : await db.getAllUsers()).filter((u: any) => u.role === 'admin');
        const isLastAdmin = admins.length === 1 && admins[0].id === input.userId;

        if (isLastAdmin && input.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Não é possível rebaixar o último administrador do sistema.',
          });
        }

        if (tenantDb) {
          await db.updateUserRoleToDb(tenantDb, input.userId, input.role);
        } else {
          await db.updateUserRole(input.userId, input.role);
        }

        console.log('[AUDIT] User role assigned', {
          actorId: ctx.user.id,
          targetUserId: input.userId,
          newRole: input.role,
        });

        return { success: true };
      }),

    deleteUser: adminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        // Impedir exclusão do próprio usuário
        if (input.userId === ctx.user.id) {
          throw new Error('Você não pode excluir seu próprio usuário');
        }

        const user = tenantDb
          ? await db.getUserByIdFromDb(tenantDb, input.userId)
          : await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado' });
        }

        const admins = (tenantDb ? await db.getAllUsersFromDb(tenantDb) : await db.getAllUsers()).filter((u: any) => u.role === 'admin');
        const isLastAdmin = admins.length === 1 && admins[0].id === input.userId;

        if (isLastAdmin) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Não é possível excluir o último administrador do sistema.',
          });
        }
        
        if (tenantDb) {
          await db.deleteUserFromDb(tenantDb, input.userId);
        } else {
          await db.deleteUser(input.userId);
        }

        console.log('[AUDIT] User deleted', {
          actorId: ctx.user.id,
          targetUserId: input.userId,
        });

        return { success: true };
      }),

    // Listar operadores com estatísticas de clientes
    listOperatorsWithStats: adminProcedure.query(async ({ ctx }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      const allUsers = tenantDb ? await db.getAllUsersFromDb(tenantDb, tenantId) : await db.getAllUsers();
      const operators = allUsers.filter((u: any) => u.role === 'operator' || u.role === 'admin');
      const allClients = tenantDb ? await db.getAllClientsFromDb(tenantDb, tenantId) : await db.getAllClients();

      return operators.map((operator: any) => {
        const operatorClients = allClients.filter((c: any) => c.operatorId === operator.id);
        return {
          id: operator.id,
          name: operator.name,
          email: operator.email,
          role: operator.role,
          clientCount: operatorClients.length,
        };
      });
    }),

    // Listar clientes disponíveis para atribuição
    listClientsForAssignment: adminProcedure.query(async ({ ctx }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      const allClients = tenantDb ? await db.getAllClientsFromDb(tenantDb, tenantId) : await db.getAllClients();
      return allClients.map((c: any) => ({
        id: c.id,
        name: c.name,
        cpf: c.cpf,
        operatorId: c.operatorId,
      }));
    }),

    // Atribuir cliente a operador
    assignClientToOperator: adminProcedure
      .input(z.object({
        clientId: z.number(),
        operatorId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.clientId)
          : await db.getClientById(input.clientId);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }

        const operator = tenantDb
          ? await db.getUserByIdFromDb(tenantDb, input.operatorId)
          : await db.getUserById(input.operatorId);
        if (!operator) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Operador não encontrado' });
        }

        if (tenantDb) {
          await db.updateClientToDb(tenantDb, input.clientId, { operatorId: input.operatorId });
        } else {
          await db.updateClient(input.clientId, { operatorId: input.operatorId });
        }

        console.log('[AUDIT] Client assigned to operator', {
          actorId: ctx.user.id,
          clientId: input.clientId,
          operatorId: input.operatorId,
        });

        return { success: true };
      }),
  }),

  // ===========================================
  // TENANTS (Super Admin - Multi-Tenant)
  // ===========================================
  tenants: router({
    // Limpar dados de mocks (tenants/users/clients @example.com)
    clearMocks: adminProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await db.clearMockTenants();
        invalidateTenantCache();

        console.log("[AUDIT] Clear mock tenants executed", {
          actorId: ctx.user.id,
          result,
        });

        return { success: true, ...result };
      } catch (error: any) {
        console.error("[ERROR] Clear mock tenants failed", {
          actorId: ctx.user.id,
          error: error?.message || String(error),
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "Falha ao limpar dados de tenants mock",
        });
      }
    }),

    // Rodar seed de mocks (limpa e recria tenants/users/clients @example.com)
    seedMocks: adminProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await db.seedMockTenants();
        invalidateTenantCache();

        console.log("[AUDIT] Seed mock tenants executed", {
          actorId: ctx.user.id,
          result,
        });

        return { success: true, ...result };
      } catch (error: any) {
        console.error("[ERROR] Seed mock tenants failed", {
          actorId: ctx.user.id,
          error: error?.message || String(error),
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "Falha ao executar seed de tenants mock",
        });
      }
    }),

    // Listar todos os tenants
    list: adminProcedure.query(async () => {
      const tenantsList = await db.getAllTenants();
      return tenantsList;
    }),

    // Buscar tenant por ID
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        return tenant;
      }),

    // Buscar tenant por slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        const tenant = await db.getTenantBySlug(input.slug);
        return tenant;
      }),

    // Criar novo tenant
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
        name: z.string().min(2).max(255),
        // DB config - opcional no modo single-db (usa DATABASE_URL)
        dbHost: z.string().optional(),
        dbPort: z.number().default(5432),
        dbName: z.string().optional(),
        dbUser: z.string().optional(),
        dbPassword: z.string().optional(),
        // Admin credentials
        adminName: z.string().min(2).max(255),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(6),
        // Customization
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        featureWorkflowCR: z.boolean().default(true),
        featureApostilamento: z.boolean().default(false),
        featureRenovacao: z.boolean().default(false),
        featureInsumos: z.boolean().default(false),
        plan: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
        maxUsers: z.number().default(10),
        maxClients: z.number().default(500),
        maxStorageGB: z.number().default(50),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verificar se slug já existe
        const existing = await db.getTenantBySlug(input.slug);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Este slug já está em uso' });
        }

        // Verificar se email do admin já existe
        const existingUser = await db.getUserByEmail(input.adminEmail);
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Este email já está cadastrado' });
        }

        // No modo single-db, usar valores do DATABASE_URL
        const isSingleDbMode = process.env.TENANT_DB_MODE === 'single';
        let dbConfig = {
          dbHost: input.dbHost || 'localhost',
          dbPort: input.dbPort,
          dbName: input.dbName || `cac360_${input.slug}`,
          dbUser: input.dbUser || '',
          dbPassword: input.dbPassword || '',
        };

        if (isSingleDbMode) {
          // Extrair config do DATABASE_URL
          const rawUrl = process.env.DATABASE_URL;
          if (rawUrl) {
            try {
              const url = new URL(rawUrl);
              dbConfig = {
                dbHost: url.hostname,
                dbPort: Number(url.port || 5432),
                dbName: (url.pathname || '').replace(/^\//, ''),
                dbUser: decodeURIComponent(url.username || ''),
                dbPassword: decodeURIComponent(url.password || ''),
              };
            } catch { /* ignore parse errors */ }
          }
        }

        const tenantId = await db.createTenant({
          slug: input.slug,
          name: input.name,
          ...dbConfig,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
          featureWorkflowCR: input.featureWorkflowCR,
          featureApostilamento: input.featureApostilamento,
          featureRenovacao: input.featureRenovacao,
          featureInsumos: input.featureInsumos,
          plan: input.plan,
          maxUsers: input.maxUsers,
          maxClients: input.maxClients,
          maxStorageGB: input.maxStorageGB,
          subscriptionStatus: 'trial',
          isActive: true,
        });

        // Criar admin do tenant
        const hashedPassword = await hashPassword(input.adminPassword);
        await db.upsertUser({
          tenantId,
          name: input.adminName,
          email: input.adminEmail,
          hashedPassword,
          role: 'admin',
        });

        await db.logTenantActivity({
          tenantId,
          action: 'created',
          details: JSON.stringify({ slug: input.slug, plan: input.plan, adminEmail: input.adminEmail }),
          performedBy: ctx.user.id,
        });
        invalidateTenantCache(input.slug);

        console.log('[AUDIT] Tenant created', {
          actorId: ctx.user.id,
          tenantId,
          slug: input.slug,
        });

        return { success: true, tenantId };
      }),

    // Atualizar tenant
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        logo: z.string().optional(),
        favicon: z.string().optional(),
        featureWorkflowCR: z.boolean().optional(),
        featureApostilamento: z.boolean().optional(),
        featureRenovacao: z.boolean().optional(),
        featureInsumos: z.boolean().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        smtpUser: z.string().optional(),
        smtpPassword: z.string().optional(),
        smtpFrom: z.string().optional(),
        plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
        maxUsers: z.number().optional(),
        maxClients: z.number().optional(),
        maxStorageGB: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        
        const tenant = await db.getTenantById(id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        await db.updateTenant(id, updates);
        invalidateTenantCache(tenant.slug);

        await db.logTenantActivity({
          tenantId: id,
          action: 'updated',
          details: JSON.stringify(Object.keys(updates)),
          performedBy: ctx.user.id,
        });

        console.log('[AUDIT] Tenant updated', {
          actorId: ctx.user.id,
          tenantId: id,
          updates: Object.keys(updates),
        });

        return { success: true };
      }),

    // Suspender/Ativar tenant
    setStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'suspended', 'trial', 'cancelled']),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        await db.updateTenant(input.id, { subscriptionStatus: input.status });
        invalidateTenantCache(tenant.slug);

        await db.logTenantActivity({
          tenantId: input.id,
          action: 'status_changed',
          details: JSON.stringify({ from: tenant.subscriptionStatus, to: input.status }),
          performedBy: ctx.user.id,
        });

        console.log('[AUDIT] Tenant status changed', {
          actorId: ctx.user.id,
          tenantId: input.id,
          oldStatus: tenant.subscriptionStatus,
          newStatus: input.status,
        });

        return { success: true };
      }),

    // Deletar tenant (soft delete)
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        await db.updateTenant(input.id, { isActive: false, subscriptionStatus: 'cancelled' });
        invalidateTenantCache(tenant.slug);

        await db.logTenantActivity({
          tenantId: input.id,
          action: 'deleted',
          details: JSON.stringify({ slug: tenant.slug }),
          performedBy: ctx.user.id,
        });

        console.log('[AUDIT] Tenant deleted (soft)', {
          actorId: ctx.user.id,
          tenantId: input.id,
          slug: tenant.slug,
        });

        return { success: true };
      }),

    // Estatísticas do tenant
    getStats: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        // TODO: Conectar ao banco do tenant e buscar estatísticas reais
        return {
          usersCount: 0,
          clientsCount: 0,
          storageUsedGB: 0,
          lastActivity: null,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
