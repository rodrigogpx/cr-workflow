/// <reference types="node" />
import { COOKIE_NAME, PLATFORM_COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure, tenantProcedure, tenantAdminProcedure, platformAdminProcedure } from "./_core/trpc";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { sendEmail, verifyConnection, verifyConnectionWithSettings, sendTestEmailWithSettings, triggerEmails, fetchImageAsBase64, buildInlineLogoAttachment } from "./emailService";
import * as db from "./db";
import { invalidateTenantCache, getTenantConfig, getTenantDb } from "./config/tenant.config";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import { saveClientDocumentFile, getTenantStorageUsage } from "./fileStorage";
import { TRPCError } from "@trpc/server";
import { comparePassword, hashPassword } from "./_core/auth";
import { sdk } from "./_core/sdk";
import { createClientSchema, updateClientSchema, createUserSchema, updateUserSchema } from "@shared/validations";
import { seedTenantEmailTemplates } from "./defaults/seedTenant";
import { iatRouter } from "./routers/iat";
import { Buffer } from "node:buffer";

async function getTenantDbOrNull(ctx: any) {
  if (ctx?.tenantSlug && ctx?.tenant) {
    // No single-db mode, usar o platformDb diretamente (sem healthcheck que falha no Railway)
    const isSingleDbMode = process.env.TENANT_DB_MODE === 'single' || process.env.NODE_ENV === 'production';
    if (isSingleDbMode) {
      const platformDb = await db.getDb();
      if (!platformDb) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Banco de dados não disponível' });
      }
      return platformDb;
    }
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
  iat: iatRouter,
  auth: router({
    me: publicProcedure.query((opts: any) => {
      if (!opts.ctx.user) return null;
      // Remover a senha (hashedPassword) do retorno do tRPC
      const { hashedPassword, ...safeUser } = opts.ctx.user;
      
      // Injetar também as features do tenant no payload de usuário, se existir, para o front-end
      const tenantFeatures = opts.ctx.tenant ? {
        featureWorkflowCR: opts.ctx.tenant.featureWorkflowCR,
        featureApostilamento: opts.ctx.tenant.featureApostilamento,
        featureRenovacao: opts.ctx.tenant.featureRenovacao,
        featureInsumos: opts.ctx.tenant.featureInsumos,
        featureIAT: opts.ctx.tenant.featureIAT,
      } : null;

      return {
        ...safeUser,
        tenantFeatures,
        tenantSlug: opts.ctx.tenantSlug ?? null,
      };
    }),
    platformMe: publicProcedure.query((opts: any) => {
      if (!opts.ctx.platformAdmin) return null;
      // Remover a senha do platformAdmin também, por segurança
      const { hashedPassword, ...safeAdmin } = opts.ctx.platformAdmin;
      return safeAdmin;
    }),
    platformLogin: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const admin = await db.getPlatformAdminByEmail(input.email);
        
        if (!admin || !admin.isActive) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }

        const passwordMatch = await comparePassword(input.password, admin.hashedPassword);
        if (!passwordMatch) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }

        const sessionToken = await sdk.createSessionToken(admin.id.toString(), {
          name: admin.name || "",
          expiresInMs: ONE_YEAR_MS,
          isPlatformAdmin: true,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(PLATFORM_COOKIE_NAME, sessionToken, { 
          ...cookieOptions, 
          maxAge: ONE_YEAR_MS, 
          path: "/",
          httpOnly: true,
          sameSite: "lax",
        });

        return {
          success: true,
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
          },
        };
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        let tenantSlug = ctx.tenantSlug;

        const user = tenantSlug && ctx.tenant
          ? await db.getUserByEmailAndTenant(input.email, ctx.tenant.id)
          : await db.getUserByEmail(input.email);

        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }

        const passwordMatch = await comparePassword(input.password, user.hashedPassword);
        if (!passwordMatch) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
        }

        // If no tenantSlug in context but user has tenantId, resolve it
        if (!tenantSlug && user.tenantId) {
          const userTenant = await db.getTenantById(user.tenantId);
          if (userTenant) {
            tenantSlug = userTenant.slug;
          }
        } else if (!user.tenantId) {
          // Fallback para usuários legados: associar ao primeiro tenant existente
          const allTenants = await db.getAllTenants();
          if (allTenants && allTenants.length > 0) {
            const firstTenant = allTenants[0];
            await db.updateUser(user.id, { tenantId: firstTenant.id });
            tenantSlug = firstTenant.slug;
            user.tenantId = firstTenant.id;
          }
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

        // Log audit entry for login
        if (ctx.tenant?.id || user.tenantId) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant?.id || user.tenantId!,
            userId: user.id,
            action: 'LOGIN',
            entity: 'AUTH',
            details: JSON.stringify({ email: user.email, role: user.role }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
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

        // Log audit entry for registration
        if (tenantSlug && ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: userId, // The newly created user ID
            action: 'CREATE',
            entity: 'USER',
            entityId: userId,
            details: JSON.stringify({ email: input.email, type: 'SELF_REGISTER' }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

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
      try {
        const tenantDb = await getTenantDbOrNull(ctx);
        const tenantId = ctx.tenant?.id;
        
        // Admin vê todos os clientes, operador vê todos os clientes
        // Despachante vê clientes com "Juntada de Documentos" concluída
        let clients: any[] = [];
        if (ctx.user.role === 'admin') {
          clients = tenantDb ? await db.getAllClientsFromDb(tenantDb, tenantId) : await db.getAllClients();
        } else if (ctx.user.role === 'operator') {
          clients = tenantDb ? await db.getAllClientsFromDb(tenantDb, tenantId) : await db.getAllClients();
        } else if (ctx.user.role === 'despachante') {
          // Despachante vê TODOS os clientes, mas filtraremos depois pela etapa concluída
          clients = tenantDb ? await db.getAllClientsFromDb(tenantDb, tenantId) : await db.getAllClients();
        } else {
          clients = tenantDb ? await db.getClientsByOperatorFromDb(tenantDb, ctx.user.id, tenantId) : await db.getClientsByOperator(ctx.user.id);
        }

        const safeClients: any[] = Array.isArray(clients) ? clients : [];

        const assignedUserIds: number[] = safeClients
          .map((c: any) => c.operatorId)
          .filter((id: any): id is number => typeof id === 'number');

        const uniqueAssignedUserIds: number[] = Array.from(new Set<number>(assignedUserIds));
        const assignedUsers = tenantDb
          ? await db.getUsersByIdsFromDb(tenantDb, uniqueAssignedUserIds)
          : await db.getUsersByIds(uniqueAssignedUserIds);
          
        const safeAssignedUsers: any[] = Array.isArray(assignedUsers) ? assignedUsers : [];
        const assignedUserMap = new Map<number, any>(safeAssignedUsers.map((u: any) => [u.id, u]));
        
        // Ordem canônica das fases do workflow
        const PHASE_ORDER = [
          'cadastro',
          'agendamento-psicotecnico',
          'agendamento-laudo',
          'juntada-documento',
          'acompanhamento-sinarm',
        ];

        // Adicionar estatísticas de workflow para cada cliente
        const clientsWithProgress = await Promise.all(
          safeClients.map(async (client) => {
            const rawWorkflow = tenantDb
              ? await db.getWorkflowByClientFromDb(tenantDb, client.id)
              : await db.getWorkflowByClient(client.id);
              
            const workflow: any[] = Array.isArray(rawWorkflow) ? rawWorkflow : [];
            
            const totalSteps = workflow.length;
            const completedSteps = workflow.filter((s: any) => s.completed).length;
            const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
            
            // Verificar se "Juntada de Documentos" está concluída (stepId 2 ou título contendo "juntada"/"documentos")
            const juntadaStep = workflow.find((s: any) => 
              s.stepId === 2 || 
              s.stepId === '2' ||
              s.stepId === 'juntada-documento' ||
              s.stepTitle?.toLowerCase()?.includes('juntada') ||
              s.stepTitle?.toLowerCase()?.includes('documentos')
            );
            const juntadaConcluida = juntadaStep?.completed === true;

            // Determinar a fase pendente atual (primeira não concluída na ordem canônica)
            let currentPendingStep: string | null = null;
            let completedPhases: Record<string, boolean> = {};

            for (const phaseId of PHASE_ORDER) {
              const step = workflow.find((s: any) => s.stepId === phaseId);
              const isCompleted = step ? step.completed : false;
              completedPhases[phaseId] = isCompleted;
              
              if (!isCompleted && !currentPendingStep) {
                currentPendingStep = phaseId;
              }
            }
            // Se todas as fases canônicas estão concluídas, marcar como 'concluido'
            if (!currentPendingStep && completedSteps > 0 && completedSteps >= totalSteps) {
              currentPendingStep = 'concluido';
            }

            // Extrair status detalhado do SINARM
            const sinarmStep = workflow.find((s: any) => s.stepId === 'acompanhamento-sinarm');
            const sinarmStatus: string | null = sinarmStep?.sinarmStatus || null;
            const protocolNumber: string | null = sinarmStep?.protocolNumber || null;
            
            return {
              ...client,
              progress,
              totalSteps,
              completedSteps,
              juntadaConcluida,
              currentPendingStep,
              completedPhases,
              sinarmStatus,
              protocolNumber,
              assignedOperator: client.operatorId ? (() => {
                const u = assignedUserMap.get(client.operatorId);
                return u ? { id: u.id, name: u.name, email: u.email } : null;
              })() : null,
            };
          })
        );
        
        // Se for despachante, filtrar apenas clientes com Juntada de Documentos concluída
        const filteredClients = ctx.user.role === 'despachante'
          ? clientsWithProgress.filter(c => c.juntadaConcluida)
          : clientsWithProgress;
        
        return filteredClients;
      } catch (error: any) {
        console.error('[clients.list] Error:', error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? `ERROR: ${error.message}\nSTACK: ${error.stack}` : (error?.message || 'Erro interno ao listar clientes'),
        });
      }
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
        
        // Verificar permissão: admin, despachante ou operador responsável
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'despachante' && client.operatorId !== ctx.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para acessar este cliente' });
        }
        
        return client;
      }),

    create: protectedProcedure
      .input(createClientSchema)
      .mutation(async ({ ctx, input }) => {
        // Permissão:
        // - admin: pode cadastrar e atribuir a qualquer operador
        // - operator: pode cadastrar apenas para si
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'operator') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Sem permissão para cadastrar novos clientes.',
          });
        }

        const tenantDb = await getTenantDbOrNull(ctx);
        const operatorId = ctx.user.role === 'admin' ? (input.operatorId || ctx.user.id) : ctx.user.id;
        
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
          // Check for duplicate CPF error (PostgreSQL code 23505)
          const errMsg = error?.message || '';
          if (
            error?.code === '23505' ||
            errMsg.includes('duplicate key value violates unique constraint') ||
            errMsg.includes('clients_cpf_unique') ||
            errMsg.includes('clients_tenantId_cpf_unique')
          ) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Este CPF já está cadastrado no sistema.',
            });
          }
          
          console.error('[Clients.create] Error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao cadastrar cliente: ${errMsg.substring(0, 100)}`,
          });
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

        try {
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
        } catch (wfError: any) {
          console.error('[Clients.create] Workflow/SubTask creation failed:', {
            clientId,
            message: wfError?.message,
            code: wfError?.code,
            detail: wfError?.detail,
          });
          // Cliente já foi criado — não falhar a mutação inteira
          console.warn('[Clients.create] Client created but workflow setup incomplete, clientId:', clientId);
        }

        // Enviar email de boas-vindas automaticamente
        try {
          const welcomeTemplate = tenantDb
            ? await db.getEmailTemplateFromDb(tenantDb, 'boasvindas-filiado', undefined, ctx.tenant?.id)
            : await db.getEmailTemplate('boasvindas-filiado');
          
          if (welcomeTemplate && input.email) {
            // Buscar logo do tenant para variável {{logo}} e converter para base64
            const tenantSettings = ctx.tenant?.id ? await db.getTenantSmtpSettings(ctx.tenant.id) : null;
            const emailLogoUrl = tenantSettings?.emailLogoUrl || '';
            const inlineLogo = buildInlineLogoAttachment(emailLogoUrl);
            
            // Logo já está salva como base64 no banco
            // Substituir variáveis no template
            const replaceVariables = (text: string) => {
              let result = text;
              result = result.replace(/{{nome}}/g, input.name || '');
              result = result.replace(/{{data}}/g, new Date().toLocaleDateString('pt-BR'));
              result = result.replace(/{{email}}/g, input.email || '');
              result = result.replace(/{{cpf}}/g, input.cpf || '');
              result = result.replace(/{{telefone}}/g, input.phone || '');
              // Variável {{logo}} - renderiza como inline attachment (CID)
              if (emailLogoUrl) {
                result = result.replace(/{{logo}}/g, `<img src="cid:email-logo" alt="Logo" style="max-height: 80px; max-width: 200px; display: block;" />`);
              } else {
                result = result.replace(/{{logo}}/g, '');
              }
              return result;
            };

            const finalSubject = replaceVariables(welcomeTemplate.subject);
            const finalContent = replaceVariables(welcomeTemplate.content);

            await sendEmail({
              to: input.email,
              subject: finalSubject,
              html: finalContent,
              attachments: inlineLogo ? [inlineLogo] : undefined,
              tenantDb,
              tenantId: ctx.tenant?.id,
            });

            // Registrar envio do email
            if (tenantDb) {
              await db.logEmailSentToDb(tenantDb, {
                clientId,
                templateKey: 'boasvindas-filiado',
                recipientEmail: input.email,
                subject: finalSubject,
                content: finalContent,
                sentBy: ctx.user.id,
              });
            } else {
              await db.logEmailSent({
                clientId,
                templateKey: 'boasvindas-filiado',
                recipientEmail: input.email,
                subject: finalSubject,
                content: finalContent,
                sentBy: ctx.user.id,
              });
            }
          }
        } catch (emailError) {
          // Não falhar a criação do cliente se o email falhar
          console.error('[Clients] Failed to send welcome email:', emailError);
        }

        // Log audit entry for client creation
        if (ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            action: 'CREATE',
            entity: 'CLIENT',
            entityId: clientId,
            details: JSON.stringify({ name: input.name, cpf: input.cpf, operatorId }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

        // Trigger email automation for CLIENT_CREATED event
        try {
          const newClient = tenantDb
            ? await db.getClientByIdFromDb(tenantDb, clientId)
            : await db.getClientById(clientId);
          if (newClient) {
            await triggerEmails('CLIENT_CREATED', {
              tenantDb,
              tenantId: ctx.tenant?.id,
              client: newClient,
            });
          }
        } catch (triggerError) {
          console.error('[Clients] Failed to process email triggers:', triggerError);
        }

        return { id: clientId };
      }),

        update: protectedProcedure
          .input(updateClientSchema)
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

            // Log audit entry for client update
            if (ctx.tenant?.id) {
              const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
              await db.logAudit({
                tenantId: ctx.tenant.id,
                userId: ctx.user.id,
                action: 'UPDATE',
                entity: 'CLIENT',
                entityId: id,
                details: JSON.stringify({ updatedFields: Object.keys(updateData) }),
                ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
              });
            }

            return { success: true };
          }),

    delegateOperator: tenantAdminProcedure
      .input(z.object({ id: z.number(), operatorId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, input.id)
          : await db.getClientById(input.id);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }

        if (tenantDb) {
          await db.updateClientToDb(tenantDb, input.id, { operatorId: input.operatorId });
        } else {
          await db.updateClient(input.id, { operatorId: input.operatorId });
        }

        if (ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            action: 'UPDATE',
            entity: 'CLIENT',
            entityId: input.id,
            details: JSON.stringify({ updatedFields: ['operatorId'] }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

        return { success: true };
      }),

    delete: tenantAdminProcedure
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

        // Log audit entry for client deletion
        if (ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            action: 'DELETE',
            entity: 'CLIENT',
            entityId: input.id,
            details: JSON.stringify({ name: client.name, cpf: client.cpf }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

        return { success: true };
      }),
  }),

  // Workflow router
  workflow: router({
    getByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const tenantDb = await getTenantDbOrNull(ctx);
          const client = tenantDb
            ? await db.getClientByIdFromDb(tenantDb, input.clientId)
            : await db.getClientById(input.clientId);
          if (!client) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
          }
          
          // Verificar permissão (despachante pode ver clientes do operador a que está vinculado)
          if (ctx.user.role !== 'admin' && ctx.user.role !== 'despachante' && client.operatorId !== ctx.user.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
          }
          
          const steps = tenantDb
            ? await db.getWorkflowByClientFromDb(tenantDb, input.clientId)
            : await db.getWorkflowByClient(input.clientId);
          
          // Etapas visíveis para despachante (por stepId ou título)
          const DESPACHANTE_VISIBLE_STEPS = [1, 2, 6]; // Cadastro, Juntada de Documentos, Acompanhamento Sinarm-CAC
          const DESPACHANTE_VISIBLE_TITLES = ['cadastro', 'juntada', 'documentos', 'sinarm', 'acompanhamento'];
          
          // Filtrar etapas se for despachante
          const filteredSteps = ctx.user.role === 'despachante'
            ? steps.filter(step => 
                DESPACHANTE_VISIBLE_STEPS.includes(step.stepId) ||
                DESPACHANTE_VISIBLE_TITLES.some(title => 
                  step.stepTitle?.toLowerCase()?.includes(title)
                )
              )
            : steps;
          
          // Buscar subtarefas para cada step
          const stepsWithSubTasks = await Promise.all(
            filteredSteps.map(async (step) => {
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
        } catch (error: any) {
          console.error('[workflow.getByClient] ERROR:', error?.message || error, { clientId: input.clientId, tenantSlug: ctx.tenantSlug });
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Erro ao carregar workflow: ${error?.message || 'erro desconhecido'}` });
        }
      }),

    updateStep: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        stepId: z.number(),
        completed: z.boolean().optional(),
        sinarmStatus: z.string().optional(),
        sinarmOpenDate: z.string().optional().nullable(),
        protocolNumber: z.string().optional().nullable(),
        sinarmComment: z.string().optional()
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
        // Despachantes podem alterar sinarmStatus e protocolNumber na fase Acompanhamento Sinarm-CAC
        const isDespachante = ctx.user.role === 'despachante';
        const isUpdatingSinarmOnly = (
          input.sinarmStatus !== undefined || 
          input.protocolNumber !== undefined ||
          input.sinarmOpenDate !== undefined ||
          input.sinarmComment !== undefined
        ) && input.completed === undefined;
        const hasGeneralPermission = ctx.user.role === 'admin' || client.operatorId === ctx.user.id;
        
        if (!hasGeneralPermission && !(isDespachante && isUpdatingSinarmOnly)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }

        // Regra: Agendamento de Laudo só pode ser concluído se Avaliação Psicológica estiver concluída
        if (input.completed === true) {
          const isLaudoStep =
            currentStep.stepId === 'agendamento-laudo' ||
            currentStep.stepTitle?.toLowerCase()?.includes('laudo') === true;

          if (isLaudoStep) {
            // Buscar todas as etapas do cliente
            const allSteps = tenantDb
              ? await db.getWorkflowByClientFromDb(tenantDb, currentStep.clientId)
              : await db.getWorkflowByClient(currentStep.clientId);
            
            const avaliacaoStep = allSteps.find((s: any) => 
              s.stepId === 'agendamento-psicotecnico' || 
              s.stepTitle?.toLowerCase()?.includes('avaliação psicológica') ||
              s.stepTitle?.toLowerCase()?.includes('psicotécnico')
            );
            
            if (avaliacaoStep && !avaliacaoStep.completed) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Não é possível concluir o Laudo de Capacidade Técnica: a fase de Avaliação Psicológica deve ser concluída primeiro.',
              });
            }
          }
        }

        // Regra: Juntada de Documentos só pode ser concluída se todos os documentos forem anexados
        if (input.completed === true) {
          const isJuntadaStep =
            currentStep.stepId === 'juntada-documento' ||
            currentStep.stepId === 'juntada-documentos' ||
            currentStep.stepTitle?.toLowerCase()?.includes('juntada') === true;

          if (isJuntadaStep) {
            const subTasksList = tenantDb
              ? await db.getSubTasksByWorkflowStepFromDb(tenantDb, currentStep.id)
              : await db.getSubTasksByWorkflowStep(currentStep.id);

            const docs = tenantDb
              ? await db.getDocumentsByClientFromDb(tenantDb, currentStep.clientId)
              : await db.getDocumentsByClient(currentStep.clientId);

            const missing = subTasksList.filter((st: any) => !docs.some((d: any) => d.subTaskId === st.id));
            if (subTasksList.length > 0 && missing.length > 0) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Não é possível concluir a Juntada de Documentos: ainda existem documentos obrigatórios não anexados.',
              });
            }
          }
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
        if (input.sinarmOpenDate !== undefined) updateData.sinarmOpenDate = input.sinarmOpenDate ? new Date(input.sinarmOpenDate) : null;
        if (input.protocolNumber !== undefined) updateData.protocolNumber = input.protocolNumber;
        
        if (tenantDb) {
          await db.upsertWorkflowStepToDb(tenantDb, updateData);
        } else {
          await db.upsertWorkflowStep(updateData);
        }

        // Registrar comentário no histórico para qualquer alteração Sinarm
        try {
          const hasStatusChange = input.sinarmStatus !== undefined && input.sinarmStatus !== (currentStep.sinarmStatus || '');
          const oldProtocol = currentStep.protocolNumber || '';
          const newProtocol = input.protocolNumber !== undefined ? (input.protocolNumber || '') : oldProtocol;
          const hasProtocolChange = input.protocolNumber !== undefined && newProtocol !== oldProtocol;

          const oldDateRaw = currentStep.sinarmOpenDate ? new Date(currentStep.sinarmOpenDate) : null;
          const newDateRaw = input.sinarmOpenDate !== undefined
            ? (input.sinarmOpenDate ? new Date(input.sinarmOpenDate) : null)
            : oldDateRaw;
          const oldDateStr = oldDateRaw ? oldDateRaw.toISOString().split('T')[0] : '';
          const newDateStr = newDateRaw ? newDateRaw.toISOString().split('T')[0] : '';
          const hasDateChange = input.sinarmOpenDate !== undefined && oldDateStr !== newDateStr;

          const hasUserComment = typeof input.sinarmComment === 'string' && input.sinarmComment.trim().length > 0;

          if (hasStatusChange || hasProtocolChange || hasDateChange || hasUserComment) {
            const parts: string[] = [];
            if (hasStatusChange) {
              parts.push(`Status: "${currentStep.sinarmStatus || 'Novo'}" → "${input.sinarmStatus}"`);
            }
            if (hasProtocolChange) {
              parts.push(`Protocolo: "${oldProtocol || '—'}" → "${newProtocol || '—'}"`);
            }
            if (hasDateChange) {
              const fmtOld = oldDateRaw ? oldDateRaw.toLocaleDateString('pt-BR') : '—';
              const fmtNew = newDateRaw ? newDateRaw.toLocaleDateString('pt-BR') : '—';
              parts.push(`Data abertura: "${fmtOld}" → "${fmtNew}"`);
            }

            const autoComment = parts.length > 0 ? parts.join(' | ') : 'Atualização registrada';
            const comment = hasUserComment ? input.sinarmComment!.trim() : autoComment;
            const newStatus = input.sinarmStatus || currentStep.sinarmStatus || 'Novo';
            const oldStatus = hasStatusChange ? (currentStep.sinarmStatus || 'Novo') : newStatus;

            const commentData = {
              workflowStepId: input.stepId,
              oldStatus,
              newStatus,
              comment,
              createdBy: ctx.user.id
            };

            if (tenantDb) {
              await db.insertSinarmCommentToDb(tenantDb, commentData);
            } else {
              await db.insertSinarmComment(commentData);
            }
          }
        } catch (commentError) {
          console.error('[Workflow] Failed to insert sinarm comment:', commentError);
        }

        // Log de auditoria
        try {
          const ipAddress = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0] || 
                            ctx.req?.headers?.['x-real-ip']?.toString() || 
                            ctx.req?.socket?.remoteAddress || 'unknown';
          const auditDetails: Record<string, unknown> = {
            clientId: currentStep.clientId,
            stepId: input.stepId,
            stepTitle: currentStep.stepTitle,
          };
          if (input.completed !== undefined) auditDetails.completed = input.completed;
          if (input.sinarmStatus !== undefined) auditDetails.sinarmStatus = input.sinarmStatus;
          if (input.sinarmOpenDate !== undefined) auditDetails.sinarmOpenDate = input.sinarmOpenDate;
          if (input.protocolNumber !== undefined) auditDetails.protocolNumber = input.protocolNumber;

          if (tenantDb) {
            const auditTenantId = ctx.tenant?.id ?? ctx.user.tenantId;
            if (auditTenantId) {
              await db.logAuditToDb(tenantDb, {
                tenantId: auditTenantId,
                userId: ctx.user.id,
                action: 'UPDATE',
                entity: 'WORKFLOW',
                entityId: input.stepId,
                details: JSON.stringify(auditDetails),
                ipAddress,
              });
            }
          } else {
            const auditTenantId = ctx.tenant?.id ?? ctx.user.tenantId;
            if (auditTenantId) {
              await db.logAudit({
                tenantId: auditTenantId,
                userId: ctx.user.id,
                action: 'UPDATE',
                entity: 'WORKFLOW',
                entityId: input.stepId,
                details: JSON.stringify(auditDetails),
                ipAddress,
              });
            }
          }
        } catch (auditError) {
          console.error('[Workflow] Failed to log audit:', auditError);
        }

        // Trigger email automation
        try {
          // Step completed trigger
          if (input.completed === true) {
            // Mapear stepId para número da etapa
            const stepIdToNumber: Record<string, string> = {
              'cadastro': '1',
              'juntada-documento': '2',
              'boas-vindas': '3',
              // aliases/compat
              'central-mensagens': '3',
              'agendamento-psicotecnico': '4',
              'agendamento-laudo': '5',
              'acompanhamento-sinarm': '6',
              // aliases/compat
              'juntada-documentos': '2',
              'acompanhamento-sinarm-cac': '6',
            };
            const stepNumber = stepIdToNumber[currentStep.stepId] || currentStep.stepId.match(/\d+/)?.[0] || currentStep.stepId;
            
            // Preparar extraData com informações de agendamento se disponíveis
            const stepExtraData: Record<string, any> = {};
            if (currentStep.scheduledDate) {
              const schedDate = new Date(currentStep.scheduledDate);
              stepExtraData.dataAgendamento = schedDate.toLocaleString('pt-BR');
            }
            if (currentStep.examinerName) {
              stepExtraData.examinador = currentStep.examinerName;
            }
            // Determinar tipo de agendamento baseado no step
            const isPsychStep = String(currentStep.stepId).includes('psico') || currentStep.stepTitle?.toLowerCase()?.includes('psico');
            const isLaudoStep = String(currentStep.stepId).includes('laudo') || currentStep.stepTitle?.toLowerCase()?.includes('laudo');
            if (isPsychStep) {
              stepExtraData.tipoAgendamento = 'Avaliação Psicológica';
            } else if (isLaudoStep) {
              stepExtraData.tipoAgendamento = 'Laudo Técnico';
            }
            
            await triggerEmails(`STEP_COMPLETED:${stepNumber}`, {
              tenantDb,
              tenantId: ctx.tenant?.id,
              client,
              extraData: Object.keys(stepExtraData).length > 0 ? stepExtraData : undefined,
            });
          }
          
          // Sinarm status change trigger
          if (input.sinarmStatus) {
            const sinarmEventStatus = input.sinarmStatus === 'Restituído'
              ? 'Correção Solicitada'
              : input.sinarmStatus;

            const effectiveProtocolNumber = input.protocolNumber !== undefined
              ? (input.protocolNumber || '')
              : (currentStep.protocolNumber || '');
            await triggerEmails(`SINARM_STATUS:${sinarmEventStatus}`, {
              tenantDb,
              tenantId: ctx.tenant?.id,
              client,
              extraData: { sinarmStatus: input.sinarmStatus, protocolNumber: effectiveProtocolNumber },
            });
          }
        } catch (triggerError) {
          console.error('[Workflow] Failed to process email triggers:', triggerError);
        }
        
        return { success: true };
      }),

    getSinarmCommentsHistory: protectedProcedure
      .input(z.object({ stepId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);

        const step = tenantDb
          ? await db.getWorkflowStepByIdFromDb(tenantDb, input.stepId)
          : await db.getWorkflowStepById(input.stepId);

        if (!step) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Etapa não encontrada' });
        }

        const client = tenantDb
          ? await db.getClientByIdFromDb(tenantDb, step.clientId)
          : await db.getClientById(step.clientId);

        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
        }

        const hasGeneralPermission = ctx.user.role === 'admin' || client.operatorId === ctx.user.id;
        const isDespachante = ctx.user.role === 'despachante';
        const isSinarmStep =
          step.stepId === 'acompanhamento-sinarm' ||
          step.stepId === 'acompanhamento-sinarm-cac' ||
          step.stepTitle?.toLowerCase()?.includes('sinarm') === true;

        if (!hasGeneralPermission && !(isDespachante && isSinarmStep)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
        }

        return tenantDb
          ? await db.getSinarmCommentsByWorkflowStepIdFromDb(tenantDb, input.stepId)
          : await db.getSinarmCommentsByWorkflowStepId(input.stepId);
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

        // Trigger email automation for scheduling
        if (input.scheduledDate) {
          try {
            const scheduledDate = new Date(input.scheduledDate);
            const isPsych = String(currentStep.stepId).includes('psico') || currentStep.stepTitle?.toLowerCase()?.includes('psico');
            const eventType = isPsych ? 'SCHEDULE_PSYCH_CREATED' : 'SCHEDULE_TECH_CONFIRMATION';
            
            await triggerEmails(eventType, {
              tenantDb,
              tenantId: ctx.tenant?.id,
              client,
              scheduledDate,
              extraData: {
                dataAgendamento: scheduledDate.toLocaleString('pt-BR'),
                examinador: input.examinerName || '',
                tipoAgendamento: isPsych ? 'Avaliação Psicológica' : 'Laudo Técnico',
              },
            });
          } catch (triggerError) {
            console.error('[Workflow] Failed to process scheduling email triggers:', triggerError);
          }
        }
        
        return { success: true };
      }),
  }),

  // Documents router
  documents: router({
    list: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const tenantDb = await getTenantDbOrNull(ctx);
          const client = tenantDb
            ? await db.getClientByIdFromDb(tenantDb, input.clientId)
            : await db.getClientById(input.clientId);
          if (!client) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado' });
          }
          
          // Verificar permissão
          if (ctx.user.role !== 'admin' && ctx.user.role !== 'despachante' && client.operatorId !== ctx.user.id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão' });
          }
          
          return tenantDb
            ? await db.getDocumentsByClientFromDb(tenantDb, input.clientId)
            : await db.getDocumentsByClient(input.clientId);
        } catch (error: any) {
          console.error('[documents.list] ERROR:', error?.message || error, { clientId: input.clientId, tenantSlug: ctx.tenantSlug });
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Erro ao listar documentos: ${error?.message || 'erro desconhecido'}` });
        }
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

        // Despachante não pode fazer upload de documentos
        if (ctx.user.role === 'despachante') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Despachante não pode fazer upload de documentos' });
        }
        
        const buffer = Buffer.from(input.fileData, "base64");

        let fileKey: string;
        let fileUrl: string;
        let fileSize: number;

        // Se DOCUMENTS_STORAGE_DIR estiver definido, usa Volume (filesystem)
        if (process.env.DOCUMENTS_STORAGE_DIR) {
          const stored = await saveClientDocumentFile({
            clientId: input.clientId,
            tenantId: ctx.tenant?.id,
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

        // Log de auditoria - UPLOAD
        const ipAddress = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0] || 
                          ctx.req?.headers?.['x-real-ip']?.toString() || 
                          ctx.req?.socket?.remoteAddress || 'unknown';
        const auditDetails = {
          clientId: input.clientId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize,
        };
        if (tenantDb) {
          await db.logAuditToDb(tenantDb, {
            tenantId: ctx.user.tenantId!,
            userId: ctx.user.id,
            action: 'UPLOAD',
            entity: 'DOCUMENT',
            entityId: documentId,
            details: JSON.stringify(auditDetails),
            ipAddress,
          });
        } else {
          await db.logAudit({
            tenantId: ctx.user.tenantId!,
            userId: ctx.user.id,
            action: 'UPLOAD',
            entity: 'DOCUMENT',
            entityId: documentId,
            details: JSON.stringify(auditDetails),
            ipAddress,
          });
        }
        
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

        // Despachante não pode excluir documentos
        if (ctx.user.role === 'despachante') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Despachante não pode excluir documentos' });
        }
        
        // Log de auditoria - DELETE (antes de deletar para ter os dados)
        const ipAddress = ctx.req?.headers?.['x-forwarded-for']?.toString().split(',')[0] || 
                          ctx.req?.headers?.['x-real-ip']?.toString() || 
                          ctx.req?.socket?.remoteAddress || 'unknown';
        const auditDetails = {
          clientId: doc.clientId,
          fileName: doc.fileName,
          fileKey: doc.fileKey,
        };
        if (tenantDb) {
          await db.logAuditToDb(tenantDb, {
            tenantId: ctx.user.tenantId!,
            userId: ctx.user.id,
            action: 'DELETE',
            entity: 'DOCUMENT',
            entityId: input.id,
            details: JSON.stringify(auditDetails),
            ipAddress,
          });
        } else {
          await db.logAudit({
            tenantId: ctx.user.tenantId!,
            userId: ctx.user.id,
            action: 'DELETE',
            entity: 'DOCUMENT',
            entityId: input.id,
            details: JSON.stringify(auditDetails),
            ipAddress,
          });
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
        
        // Gerar PDF com dados do cadastro
        const { generateClientDataPDF } = await import('./generate-pdf');
        const pdfBuffer = await generateClientDataPDF(client);
        const pdfBase64 = pdfBuffer.toString('base64');
        
        return {
          clientName: client.name,
          clientDataPdf: pdfBase64,
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
        let tenantId = ctx.tenant?.id || ctx.user?.tenantId;
        
        if (!tenantId) {
          const allTenants = await db.getAllTenants();
          if (allTenants && allTenants.length > 0) {
            tenantId = allTenants[0].id;
          }
        }
        
        // Se tem tenantId, busca da tabela tenants
        if (tenantId) {
          const settings = await db.getTenantSmtpSettings(tenantId);
          
          if (!settings) {
            return {
              emailMethod: "gateway" as const,
              smtpHost: "",
              smtpPort: 587,
              smtpUser: "",
              smtpFrom: "",
              postmanGpxBaseUrl: "",
              hasPostmanGpxApiKey: false,
              useSecure: false,
              hasPassword: false,
              source: "none",
            };
          }

          return {
            emailMethod: settings.emailMethod || "gateway",
            smtpHost: settings.smtpHost || "",
            smtpPort: settings.smtpPort || 587,
            smtpUser: settings.smtpUser || "",
            smtpFrom: settings.smtpFrom || "",
            postmanGpxBaseUrl: (settings as any).postmanGpxBaseUrl || "",
            hasPostmanGpxApiKey: Boolean((settings as any).postmanGpxApiKey),
            useSecure: settings.smtpPort === 465,
            hasPassword: Boolean(settings.smtpPassword),
            emailLogoUrl: (settings as any).emailLogoUrl || null,
            source: "tenant",
          };
        }

        // Fallback para env vars (sem tenant)
        return {
          emailMethod: "gateway" as const,
          smtpHost: process.env.SMTP_HOST || "",
          smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
          smtpUser: process.env.SMTP_USER || "",
          smtpFrom: process.env.SMTP_FROM || "",
          postmanGpxBaseUrl: process.env.POSTMANGPX_BASE_URL || "",
          hasPostmanGpxApiKey: Boolean(process.env.POSTMANGPX_API_KEY),
          useSecure: process.env.SMTP_PORT === "465",
          hasPassword: Boolean(process.env.SMTP_PASS),
          source: process.env.SMTP_HOST ? "env" : "none",
        };
      }),

    updateSmtpConfig: adminProcedure
      .input(z.object({
        emailMethod: z.enum(["smtp", "gateway"]),
        smtpHost: z.string().optional(),
        smtpPort: z.number().int().positive().optional(),
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        smtpFrom: z.string().min(1),
        postmanGpxBaseUrl: z.string().optional(),
        postmanGpxApiKey: z.string().optional(),
        useSecure: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        let tenantId = ctx.tenant?.id || ctx.user?.tenantId;
        
        if (!tenantId) {
          const allTenants = await db.getAllTenants();
          if (allTenants && allTenants.length > 0) {
            tenantId = allTenants[0].id;
          }
        }
        
        if (!tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant não identificado. Faça login novamente.",
          });
        }

        // Se método é SMTP, valida campos obrigatórios
        if (input.emailMethod === "smtp") {
          if (!input.smtpHost || !input.smtpUser) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Configure host e usuário SMTP.",
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
            emailMethod: "smtp",
            smtpHost: input.smtpHost,
            smtpPort: input.smtpPort || 587,
            smtpUser: input.smtpUser,
            smtpPassword,
            smtpFrom: input.smtpFrom,
          });
        } else {
          // Método gateway (PostmanGPX)
          if (!input.postmanGpxBaseUrl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Informe a Base URL do PostmanGPX.",
            });
          }

          const existing = await db.getTenantSmtpSettings(tenantId);
          const postmanGpxApiKey = input.postmanGpxApiKey !== undefined && input.postmanGpxApiKey !== ""
            ? input.postmanGpxApiKey
            : (existing as any)?.postmanGpxApiKey || "";

          if (!postmanGpxApiKey) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Informe a API Key do PostmanGPX.",
            });
          }

          await db.updateTenantSmtpSettings(tenantId, {
            emailMethod: "gateway",
            smtpFrom: input.smtpFrom,
            postmanGpxBaseUrl: input.postmanGpxBaseUrl,
            postmanGpxApiKey,
          });
        }

        return { success: true };
      }),

    testSmtpConnection: adminProcedure
      .input(z.object({
        testEmail: z.string().email().optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
        useMethod: z.enum(["smtp", "gateway"]).optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        let tenantId = ctx.tenant?.id || ctx.user?.tenantId;
        
        if (!tenantId) {
          const allTenants = await db.getAllTenants();
          if (allTenants && allTenants.length > 0) {
            tenantId = allTenants[0].id;
          }
        }
        
        // Buscar settings do tenant
        const tenantSettings = tenantId ? await db.getTenantSmtpSettings(tenantId) : null;
        
        // Determinar método: usa o informado no input ou o configurado no tenant
        const method = input?.useMethod || tenantSettings?.emailMethod || "gateway";

        // Email destinatário
        const toEmail = input?.testEmail || ctx.user?.email;
        if (!toEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe um email para receber o teste.",
          });
        }

        // Enviar email de teste via método escolhido
        const result = await sendTestEmailWithSettings({
          host: tenantSettings?.smtpHost || process.env.SMTP_HOST || "",
          port: tenantSettings?.smtpPort || Number(process.env.SMTP_PORT) || 587,
          user: tenantSettings?.smtpUser || process.env.SMTP_USER || "",
          pass: tenantSettings?.smtpPassword || process.env.SMTP_PASS || "",
          secure: (tenantSettings?.smtpPort || 587) === 465,
          from: tenantSettings?.smtpFrom || process.env.SMTP_FROM || "",
          toEmail,
          subject: input?.subject,
          body: input?.body,
          useGateway: method === "gateway",
          postmanGpxBaseUrl: (tenantSettings as any)?.postmanGpxBaseUrl || process.env.POSTMANGPX_BASE_URL,
          postmanGpxApiKey: (tenantSettings as any)?.postmanGpxApiKey || process.env.POSTMANGPX_API_KEY,
        });
        
        if (!result.success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.error || "Falha ao enviar email de teste. Verifique as configurações.",
          });
        }

        return { success: true, sentTo: toEmail };
      }),

    // Import logo from external URL
    importLogoFromUrl: adminProcedure
      .input(z.object({
        logoUrl: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        let tenantId = ctx.tenant?.id || ctx.user?.tenantId;
        
        if (!tenantId) {
          const allTenants = await db.getAllTenants();
          if (allTenants && allTenants.length > 0) {
            tenantId = allTenants[0].id;
          }
        }
        
        if (!tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant não identificado. Faça login novamente.",
          });
        }

        try {
          // Validar a imagem da URL externa (HEAD request primeiro para economizar banda)
          let contentType = "image/png";
          try {
            const headResponse = await fetch(input.logoUrl, { method: "HEAD" });
            if (headResponse.ok) {
              contentType = headResponse.headers.get("content-type") || "image/png";
            }
          } catch {
            // Se HEAD falhar, tenta GET para validar
          }

          // Se HEAD não funcionou ou não retornou content-type de imagem, tenta GET
          if (!contentType.startsWith("image/")) {
            const response = await fetch(input.logoUrl);
            
            if (!response.ok) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Não foi possível acessar a imagem: ${response.statusText}`,
              });
            }

            contentType = response.headers.get("content-type") || "image/png";
            
            if (!contentType.startsWith("image/")) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "A URL deve apontar para uma imagem (jpg, png, gif, etc).",
              });
            }
          }

          // IMPORTANTE: Converter a imagem para base64 e salvar diretamente no banco.
          // Isso garante que a imagem esteja sempre disponível, independente de URLs externas.
          
          const imageResponse = await fetch(input.logoUrl);
          if (!imageResponse.ok) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Não foi possível baixar a imagem: ${imageResponse.statusText}`,
            });
          }
          
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString('base64');
          const finalLogoUrl = `data:${contentType};base64,${base64}`;
          
          // Salvar o base64 no banco de dados
          await db.updateTenantSmtpSettings(tenantId, {
            emailLogoUrl: finalLogoUrl,
          });

          return { 
            success: true, 
            logoUrl: finalLogoUrl,
            message: "Logo importada com sucesso! Use {{logo}} nos templates de email.",
          };
        } catch (error: any) {
          if (error instanceof TRPCError) throw error;
          
          console.error("[ImportLogo] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Erro ao importar logo.",
          });
        }
      }),

    // Remove email logo
    removeEmailLogo: adminProcedure
      .mutation(async ({ ctx }) => {
        let tenantId = ctx.tenant?.id || ctx.user?.tenantId;
        
        if (!tenantId) {
          const allTenants = await db.getAllTenants();
          if (allTenants && allTenants.length > 0) {
            tenantId = allTenants[0].id;
          }
        }

        if (!tenantId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Tenant não identificado.",
          });
        }

        await db.updateTenantSmtpSettings(tenantId, {
          emailLogoUrl: null,
        });

        return { success: true };
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
          return await db.getEmailTemplateFromDb(tenantDb, input.templateKey, input.module, ctx.tenant?.id);
        }
        return await db.getEmailTemplate(input.templateKey, input.module);
      }),

    // Get all email templates (optionally filtered by module)
    getAllTemplates: protectedProcedure
      .input(z.object({
        module: z.string().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        try {
          const tenantDb = await getTenantDbOrNull(ctx);
          if (tenantDb) {
            return await db.getAllEmailTemplatesFromDb(tenantDb, input?.module, ctx.tenant?.id);
          }
          
          // For Super Admin (no tenant), return empty array since platform DB doesn't have emailTemplates
          // Super Admin should manage email templates through tenant impersonation or a separate interface
          if (ctx.platformAdmin) {
            return [];
          }
          
          return await db.getAllEmailTemplates(input?.module);
        } catch (error: any) {
          console.error('[emails.getAllTemplates] Error:', error);
          if (error instanceof TRPCError) throw error;
          return [];
        }
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
          ? await db.saveEmailTemplateToDb(tenantDb, input, ctx.tenant?.id)
          : await db.saveEmailTemplate(input);
        return { success: true, templateId };
      }),

    // Delete email template
    deleteTemplate: adminProcedure
      .input(z.object({
        templateKey: z.string(),
        module: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        if (tenantDb) {
          await db.deleteEmailTemplateFromDb(tenantDb, input.templateKey, input.module, ctx.tenant?.id);
        } else {
          await db.deleteEmailTemplate(input.templateKey, input.module);
        }
        return { success: true };
      }),

    seedTemplates: adminProcedure
      .mutation(async ({ ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const tenantId = ctx.tenant?.id;
        if (!tenantDb || !tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant não identificado ou banco indisponível' });
        }
        return await seedTenantEmailTemplates(tenantDb, tenantId);
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
          ? await db.getEmailTemplateFromDb(tenantDb, input.templateKey, undefined, ctx.tenant?.id)
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
        const sinarmStatus = sinarmStep?.sinarmStatus || 'Iniciado';
        const protocolNumber = sinarmStep?.protocolNumber || '';

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

        // Buscar logo do tenant (já salva como base64 no banco)
        const tenantSettings = ctx.tenant?.id ? await db.getTenantSmtpSettings(ctx.tenant.id) : null;
        const emailLogoUrl = tenantSettings?.emailLogoUrl || '';
        const inlineLogo = buildInlineLogoAttachment(emailLogoUrl);
        
        const isBase64Logo = emailLogoUrl.startsWith('data:');

        const replaceVariables = (text: string, clientData: any) => {
          let result = text;
          result = result.replace(/{{nome}}/g, clientData.name || '');
          result = result.replace(/{{data}}/g, new Date().toLocaleDateString('pt-BR'));
          result = result.replace(/{{status}}/g, progressPercentage + '% concluido');
          result = result.replace(/{{status_sinarm}}/g, sinarmStatus);
          result = result.replace(/{{protocolNumber}}/g, clientData.protocolNumber || '');
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

          // Variável {{logo}} - renderiza como inline attachment (CID)
          if (emailLogoUrl) {
            result = result.replace(/{{logo}}/g, `<img src="cid:email-logo" alt="Logo" style="max-height: 80px; max-width: 200px; display: block;" />`);
          } else {
            result = result.replace(/{{logo}}/g, '');
          }

          return result;
        };

        const clientWithProtocol = { ...client, protocolNumber };
        const finalSubject = replaceVariables(input.subject, clientWithProtocol);
        const finalContent = replaceVariables(input.content, clientWithProtocol);

        const templateAttachments = attachments.map((att: any) => ({ filename: att.fileName, path: att.fileUrl }));
        const mergedAttachments = inlineLogo ? [inlineLogo, ...templateAttachments] : templateAttachments;

        try {
          await sendEmail({
            to: input.recipientEmail,
            subject: finalSubject,
            html: finalContent,
            attachments: mergedAttachments,
            tenantDb,
            tenantId: ctx.tenant?.id,
          });
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
      .input(createUserSchema)
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const existingUser = tenantDb
          ? await db.getUserByEmailFromDb(tenantDb, input.email)
          : await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Este email já está cadastrado' });
        }

        const hashedPassword = await hashPassword(input.password);
        const tenantId = ctx.tenant?.id || ctx.user?.tenantId;
        const userId = tenantDb
          ? await db.upsertUserToDb(tenantDb, {
              name: input.name,
              email: input.email,
              hashedPassword,
              role: input.role,
              tenantId,
            })
          : await db.upsertUser({
              name: input.name,
              email: input.email,
              hashedPassword,
              role: input.role,
              tenantId,
            });

        // Log audit entry for user creation
        if (ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            action: 'CREATE',
            entity: 'USER',
            entityId: userId,
            details: JSON.stringify({ email: input.email, role: input.role }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

        return { success: true, userId };
      }),

    update: adminProcedure
      .input(updateUserSchema)
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

        // Log audit entry for user update
        if (ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            action: 'UPDATE',
            entity: 'USER',
            entityId: input.userId,
            details: JSON.stringify({ updatedFields: Object.keys(updateData) }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

        return { success: true };
      }),

    updateRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin', 'despachante']),
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

        // Log audit entry for user role update
        if (ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            action: 'UPDATE',
            entity: 'USER',
            entityId: input.userId,
            details: JSON.stringify({ roleChange: input.role }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

        return { success: true };
      }),

    assignRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin', 'despachante']),
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

        // Log audit entry for user deletion
        if (ctx.tenant?.id) {
          const ip = ctx.req.headers['x-forwarded-for'] || ctx.req.socket?.remoteAddress || null;
          await db.logAudit({
            tenantId: ctx.tenant.id,
            userId: ctx.user.id,
            action: 'DELETE',
            entity: 'USER',
            entityId: input.userId,
            details: JSON.stringify({ deletedUserId: input.userId }),
            ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : null,
          });
        }

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

        return { success: true };
      }),
  }),

  // ===========================================
  // TENANTS (Super Admin - Multi-Tenant)
  // ===========================================
  tenants: router({
    // Limpar dados de mocks (tenants/users/clients @example.com)
    clearMocks: platformAdminProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await db.clearMockTenants();
        invalidateTenantCache();

        return { success: true, ...result };
      } catch (error: any) {
        console.error("[ERROR] Clear mock tenants failed", {
          actorId: ctx.platformAdmin.id,
          error: error?.message || String(error),
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "Falha ao limpar dados de tenants mock",
        });
      }
    }),

    // Rodar seed de mocks (limpa e recria tenants/users/clients @example.com)
    seedMocks: platformAdminProcedure.mutation(async ({ ctx }) => {
      try {
        const result = await db.seedMockTenants();
        invalidateTenantCache();

        return { success: true, ...result };
      } catch (error: any) {
        console.error("[ERROR] Seed mock tenants failed", {
          actorId: ctx.platformAdmin.id,
          error: error?.message || String(error),
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message || "Falha ao executar seed de tenants mock",
        });
      }
    }),

    // Listar todos os tenants
    list: platformAdminProcedure.query(async () => {
      const tenantsList = await db.getAllTenants();
      return tenantsList;
    }),

    // Buscar tenant por ID
    getById: platformAdminProcedure
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
    create: platformAdminProcedure
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
        featureIAT: z.boolean().default(false),
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
          featureIAT: input.featureIAT,
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

        // Seed default email templates
        try {
          // Invalidate cache to ensure we fetch the fresh tenant record
          invalidateTenantCache(input.slug);
          
          // Fetch config using helper that handles password decryption
          const tenantConfig = await getTenantConfig(input.slug);
          
          if (tenantConfig) {
            const tenantDb = await getTenantDb(tenantConfig);
            if (tenantDb) {
              await seedTenantEmailTemplates(tenantDb, tenantId);
            } else {
              console.error(`[Tenant] Failed to connect to DB for seeding templates: ${input.slug}`);
            }
          } else {
            console.error(`[Tenant] Failed to load tenant config for seeding: ${input.slug}`);
          }
        } catch (seedError) {
          console.error(`[Tenant] Error seeding email templates for ${input.slug}:`, seedError);
          // Não falhar a criação do tenant se o seed falhar, apenas logar erro
        }

        await db.logTenantActivity({
          tenantId,
          action: 'created',
          details: JSON.stringify({ slug: input.slug, plan: input.plan, adminEmail: input.adminEmail }),
          performedBy: ctx.platformAdmin.id,
        });
        invalidateTenantCache(input.slug);

        return { id: tenantId, success: true };
      }),

    // Atualizar tenant
    update: platformAdminProcedure
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
        featureIAT: z.boolean().optional(),
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

        return { success: true };
      }),

    // Suspender/Ativar tenant
    setStatus: platformAdminProcedure
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
          performedBy: ctx.platformAdmin.id,
        });

        return { success: true };
      }),

    // Deletar tenant (soft delete)
    delete: platformAdminProcedure
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
          performedBy: ctx.platformAdmin.id,
        });

        return { success: true };
      }),

    // Deletar tenant DEFINITIVAMENTE (hard delete)
    hardDelete: platformAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        await db.hardDeleteTenant(input.id);
        invalidateTenantCache(tenant.slug);

        // Não conseguimos logar atividade no tenant pois ele foi deletado
        // Mas podemos logar se tivermos um log global de plataforma (futuro)
        
        return { success: true };
      }),

    // Estatísticas do tenant
    getStats: platformAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        try {
          const platformDb = await db.getDb();
          if (!platformDb) {
            return {
              usersCount: 0,
              clientsCount: 0,
              storageUsedGB: 0,
              lastActivity: null,
              error: 'Banco de dados não disponível',
            };
          }

          // Count users for this tenant
          const usersRes = await platformDb.execute(sql`SELECT count(*) as count FROM "users" WHERE "tenantId" = ${input.id}`);
          const usersCount = Number(usersRes[0]?.count || 0);

          // Count clients for this tenant
          const clientsRes = await platformDb.execute(sql`SELECT count(*) as count FROM "clients" WHERE "tenantId" = ${input.id}`);
          const clientsCount = Number(clientsRes[0]?.count || 0);

          // Get last activity log for this tenant
          const activityRes = await platformDb.execute(sql`SELECT "createdAt" FROM "auditLogs" WHERE "tenantId" = ${input.id} ORDER BY "createdAt" DESC LIMIT 1`);
          const lastActivity = activityRes[0]?.createdAt || null;

          // Calculate storage usage (filesystem)
          const storageBytes = await getTenantStorageUsage(input.id);
          const storageUsedGB = Number((storageBytes / (1024 * 1024 * 1024)).toFixed(3));

          // Calculate DB size
          let dbSizeMB = 0;
          try {
            const tenantDb = await getTenantDb(tenant);
            if (tenantDb) {
              const sizeBytes = await db.getDatabaseSize(tenantDb);
              dbSizeMB = Number((sizeBytes / (1024 * 1024)).toFixed(2));
            } else {
              console.warn(`[Stats] getTenantDb returned null for tenant ${tenant.id} (${tenant.slug})`);
            }
          } catch (dbErr: any) {
            console.error(`[Stats] Error getting DB size for tenant ${tenant.id}:`, dbErr?.message);
          }

          return {
            usersCount,
            clientsCount,
            storageUsedGB,
            dbSizeMB,
            lastActivity,
          };
        } catch (error: any) {
          console.error(`Error fetching stats for tenant ${tenant.id}:`, error);
          return {
            usersCount: 0,
            clientsCount: 0,
            storageUsedGB: 0,
            dbSizeMB: 0,
            lastActivity: null,
            error: error.message || 'Erro desconhecido',
          };
        }
      }),

    // Estatísticas Globais (Super Admin Dashboard)
    getGlobalStats: platformAdminProcedure
      .query(async () => {
        const platformDb = await db.getDb();
        if (!platformDb) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
        }

        try {
          // Contagens globais
          const [tenantsRes] = await platformDb.execute(sql`SELECT count(*) as count FROM "tenants"`);
          const [usersRes] = await platformDb.execute(sql`SELECT count(*) as count FROM "users"`);
          const [clientsRes] = await platformDb.execute(sql`SELECT count(*) as count FROM "clients"`);
          
          // Tamanho do banco da plataforma
          const platformDbSizeBytes = await db.getDatabaseSize(platformDb as any);
          const platformDbSizeMB = Number((platformDbSizeBytes / (1024 * 1024)).toFixed(2));

          // Armazenamento Global de Arquivos
          const { getGlobalStorageUsage } = await import('./fileStorage');
          const globalStorageBytes = await getGlobalStorageUsage();
          const globalStorageGB = Number((globalStorageBytes / (1024 * 1024 * 1024)).toFixed(3));

          return {
            totalTenants: Number(tenantsRes?.count || 0),
            totalUsers: Number(usersRes?.count || 0),
            totalClients: Number(clientsRes?.count || 0),
            platformDbSizeMB,
            globalStorageGB,
          };
        } catch (error: any) {
          console.error('[getGlobalStats] Error:', error);
          throw new TRPCError({ 
            code: 'INTERNAL_SERVER_ERROR', 
            message: 'Erro ao calcular estatísticas globais: ' + error.message 
          });
        }
      }),

    // Health check do tenant (verifica conexão com banco)
    healthCheck: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const startTime = Date.now();
        const tenant = await db.getTenantById(input.id);
        
        if (!tenant) {
          return {
            status: 'error' as const,
            message: 'Tenant não encontrado',
            latencyMs: Date.now() - startTime,
          };
        }

        try {
          const tenantDb = await getTenantDb(tenant);
          if (!tenantDb) {
            return {
              status: 'error' as const,
              message: 'Não foi possível conectar ao banco do tenant',
              latencyMs: Date.now() - startTime,
            };
          }

          // Testar query simples
          await tenantDb.execute(sql`SELECT 1`);
          
          return {
            status: 'healthy' as const,
            message: 'Conexão OK',
            latencyMs: Date.now() - startTime,
            tenant: {
              slug: tenant.slug,
              name: tenant.name,
              plan: tenant.plan,
              subscriptionStatus: tenant.subscriptionStatus,
            },
          };
        } catch (error: any) {
          return {
            status: 'error' as const,
            message: error?.message || 'Erro desconhecido',
            latencyMs: Date.now() - startTime,
          };
        }
      }),

    // Impersonate: entrar como admin de um tenant específico
    impersonate: platformAdminProcedure
      .input(z.object({ 
        tenantId: z.number(),
        confirmPassword: z.string()
      }))
      .mutation(async ({ input, ctx }) => {
        // Validar senha do platformAdmin
        const passwordMatch = await comparePassword(input.confirmPassword, ctx.platformAdmin.hashedPassword);
        if (!passwordMatch) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha incorreta' });
        }

        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        const tenantAdmin = await db.getTenantAdmin(input.tenantId);
        if (!tenantAdmin) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Admin do tenant não encontrado' });
        }

        // Criar sessão temporária (1 hora)
        const impersonationToken = await sdk.createSessionToken(tenantAdmin.id.toString(), {
          name: tenantAdmin.name || "",
          tenantSlug: tenant.slug,
          expiresInMs: 60 * 60 * 1000, // 1 hora
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, impersonationToken, { 
          ...cookieOptions, 
          maxAge: 60 * 60 * 1000, 
          path: "/",
          httpOnly: true,
          sameSite: "lax",
        });

        // Setar flag de impersonation para o frontend
        ctx.res.cookie('is_impersonating', 'true', {
          maxAge: 60 * 60 * 1000,
          path: "/",
          sameSite: "lax",
        });

        return {
          success: true,
          tenantSlug: tenant.slug,
        };
      }),

    // ===========================================
    // EMAIL CONFIGURATION (Super Admin)
    // ===========================================
    
    // Obter configurações de email de um tenant
    getEmailConfig: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        const settings = await db.getTenantSmtpSettings(input.tenantId);
        
        if (!settings) {
          return {
            emailMethod: "gateway" as const,
            smtpHost: "",
            smtpPort: 587,
            smtpUser: "",
            smtpFrom: "",
            postmanGpxBaseUrl: "",
            hasPostmanGpxApiKey: false,
            hasSmtpPassword: false,
            emailLogoUrl: null,
          };
        }
        
        return {
          emailMethod: settings.emailMethod || "gateway",
          smtpHost: settings.smtpHost || "",
          smtpPort: settings.smtpPort || 587,
          smtpUser: settings.smtpUser || "",
          smtpFrom: settings.smtpFrom || "",
          postmanGpxBaseUrl: (settings as any).postmanGpxBaseUrl || "",
          hasPostmanGpxApiKey: Boolean((settings as any).postmanGpxApiKey),
          hasSmtpPassword: Boolean(settings.smtpPassword),
          emailLogoUrl: (settings as any).emailLogoUrl || null,
        };
      }),

    // Atualizar configurações de email de um tenant
    updateEmailConfig: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        emailMethod: z.enum(["smtp", "gateway"]),
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        smtpUser: z.string().optional(),
        smtpPassword: z.string().optional(),
        smtpFrom: z.string(),
        postmanGpxBaseUrl: z.string().optional(),
        postmanGpxApiKey: z.string().optional(),
        emailLogoUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { tenantId, ...config } = input;
        
        // Validações
        if (config.emailMethod === "smtp") {
          if (!config.smtpHost || !config.smtpUser) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "SMTP requer host e usuário",
            });
          }
          
          // Se senha não foi fornecida, manter a existente
          const existing = await db.getTenantSmtpSettings(tenantId);
          const smtpPassword = config.smtpPassword !== undefined && config.smtpPassword !== ""
            ? config.smtpPassword
            : existing?.smtpPassword || "";
          
          if (!smtpPassword) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Informe a senha SMTP",
            });
          }
          
          await db.updateTenantSmtpSettings(tenantId, {
            emailMethod: "smtp",
            smtpHost: config.smtpHost,
            smtpPort: config.smtpPort || 587,
            smtpUser: config.smtpUser,
            smtpPassword,
            smtpFrom: config.smtpFrom,
          });
        } else if (config.emailMethod === "gateway") {
          if (!config.postmanGpxBaseUrl) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Gateway requer URL base",
            });
          }
          
          const existing = await db.getTenantSmtpSettings(tenantId);
          const postmanGpxApiKey = config.postmanGpxApiKey !== undefined && config.postmanGpxApiKey !== ""
            ? config.postmanGpxApiKey
            : (existing as any)?.postmanGpxApiKey || "";
          
          if (!postmanGpxApiKey) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Informe a API Key do gateway",
            });
          }
          
          await db.updateTenantSmtpSettings(tenantId, {
            emailMethod: "gateway",
            smtpFrom: config.smtpFrom,
            postmanGpxBaseUrl: config.postmanGpxBaseUrl,
            postmanGpxApiKey,
          });
        }
        
        return { success: true };
      }),

    // Testar configuração de email de um tenant
    testEmailConfig: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        testEmail: z.string().email(),
      }))
      .mutation(async ({ input, ctx }) => {
        const settings = await db.getTenantSmtpSettings(input.tenantId);
        
        if (!settings) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Configuração não encontrada' });
        }
        
        const tenant = await db.getTenantById(input.tenantId);
        
        // Enviar email de teste
        const result = await sendTestEmailWithSettings({
          host: settings.smtpHost || "",
          port: settings.smtpPort || 587,
          user: settings.smtpUser || "",
          pass: settings.smtpPassword || "",
          secure: settings.smtpPort === 465,
          from: settings.smtpFrom || "",
          toEmail: input.testEmail,
          subject: `[CAC 360] Teste de Configuração - ${tenant?.name || 'Tenant'}`,
          body: `<p>Este é um email de teste da configuração SMTP do tenant <strong>${tenant?.name || input.tenantId}</strong>.</p><p>Enviado por: ${ctx.platformAdmin.name || ctx.platformAdmin.email}</p>`,
          useGateway: settings.emailMethod === "gateway",
          postmanGpxBaseUrl: (settings as any).postmanGpxBaseUrl,
          postmanGpxApiKey: (settings as any).postmanGpxApiKey,
        });
        
        return result;
      }),

    // Obter templates de email de um tenant
    getEmailTemplates: platformAdminProcedure
      .input(z.object({ 
        tenantId: z.number(),
        module: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const tenant = await db.getTenantById(input.tenantId);
          if (!tenant) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
          }

          // Tentar getTenantDb; se falhar, usar getDb() direto (mesmo padrão do getTenantDbOrNull para Railway)
          let tenantDb: any = null;
          const tenantConfig = await getTenantConfig(tenant.slug);
          if (tenantConfig) {
            tenantDb = await getTenantDb(tenantConfig);
          }
          if (!tenantDb) {
            console.warn(`[tenants.getEmailTemplates] getTenantDb falhou, usando getDb() como fallback`);
            tenantDb = await db.getDb();
          }
          if (!tenantDb) {
            console.warn(`[tenants.getEmailTemplates] DB indisponível para tenant ${input.tenantId}`);
            return [];
          }

          return await db.getAllEmailTemplatesFromDb(tenantDb, input.module, input.tenantId);
        } catch (error: any) {
          console.error(`[tenants.getEmailTemplates] Error for tenant ${input.tenantId}:`, error?.message);
          if (error instanceof TRPCError) throw error;
          return [];
        }
      }),

    // Obter triggers de email de um tenant
    getEmailTriggers: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }) => {
        try {
          const tenant = await db.getTenantById(input.tenantId);
          if (!tenant) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
          }

          let tenantDb: any = null;
          const tenantConfig = await getTenantConfig(tenant.slug);
          if (tenantConfig) {
            tenantDb = await getTenantDb(tenantConfig);
          }
          if (!tenantDb) {
            console.warn(`[tenants.getEmailTriggers] getTenantDb falhou, usando getDb() como fallback`);
            tenantDb = await db.getDb();
          }
          if (!tenantDb) {
            console.warn(`[tenants.getEmailTriggers] DB indisponível para tenant ${input.tenantId}`);
            return [];
          }

          const triggers = await db.getEmailTriggersFromDb(tenantDb, input.tenantId);

          return await Promise.all(
            triggers.map(async (trigger) => {
              const templates = await db.getTemplatesByTriggerIdFromDb(tenantDb, trigger.id);
              return { ...trigger, templates };
            })
          );
        } catch (error: any) {
          console.error(`[tenants.getEmailTriggers] Error for tenant ${input.tenantId}:`, error?.message);
          if (error instanceof TRPCError) throw error;
          return [];
        }
      }),

    // Save/update a single email template for a tenant (Super Admin)
    saveEmailTemplate: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        templateKey: z.string(),
        module: z.string().optional(),
        templateTitle: z.string().optional(),
        subject: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) {
          tenantDb = await getTenantDb(tenantConfig);
        }
        if (!tenantDb) {
          tenantDb = await db.getDb();
        }
        if (!tenantDb) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        }

        const templateId = await db.saveEmailTemplateToDb(tenantDb, {
          templateKey: input.templateKey,
          module: input.module,
          templateTitle: input.templateTitle,
          subject: input.subject,
          content: input.content,
        }, input.tenantId);

        return { success: true, templateId };
      }),

    // Seed email templates for an existing tenant
    seedEmailTemplates: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) {
          tenantDb = await getTenantDb(tenantConfig);
        }
        if (!tenantDb) {
          console.warn(`[tenants.seedEmailTemplates] getTenantDb falhou, usando getDb() como fallback`);
          tenantDb = await db.getDb();
        }
        if (!tenantDb) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        }
        
        const result = await seedTenantEmailTemplates(tenantDb, input.tenantId);
        return result;
      }),

    // Create a new email trigger for a tenant (Super Admin)
    createEmailTrigger: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        name: z.string().min(1),
        triggerEvent: z.string().min(1),
        recipientType: z.string().default('client'),
        isActive: z.boolean().default(true),
        sendImmediate: z.boolean().default(true),
        sendBeforeHours: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        }

        const { tenantId: _tid, ...triggerData } = input;
        const trigger = await db.createEmailTriggerToDb(tenantDb, {
          ...triggerData,
          tenantId: input.tenantId,
        });
        return trigger;
      }),

    // Update an email trigger for a tenant (Super Admin)
    updateEmailTrigger: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        triggerId: z.number(),
        name: z.string().min(1).optional(),
        triggerEvent: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
        recipientType: z.string().optional(),
        sendImmediate: z.boolean().optional(),
        sendBeforeHours: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) {
          tenantDb = await getTenantDb(tenantConfig);
        }
        if (!tenantDb) {
          tenantDb = await db.getDb();
        }
        if (!tenantDb) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        }

        const { tenantId: _tid, triggerId, ...updateFields } = input;
        const updateData: any = {};
        if (updateFields.name !== undefined) updateData.name = updateFields.name;
        if (updateFields.triggerEvent !== undefined) updateData.triggerEvent = updateFields.triggerEvent;
        if (updateFields.isActive !== undefined) updateData.isActive = updateFields.isActive;
        if (updateFields.recipientType !== undefined) updateData.recipientType = updateFields.recipientType;
        if (updateFields.sendImmediate !== undefined) updateData.sendImmediate = updateFields.sendImmediate;
        if (updateFields.sendBeforeHours !== undefined) updateData.sendBeforeHours = updateFields.sendBeforeHours;

        await db.updateEmailTriggerToDb(tenantDb, triggerId, updateData);
        return { success: true };
      }),

    // Delete an email trigger for a tenant (Super Admin)
    deleteEmailTrigger: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        triggerId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        }

        await db.deleteEmailTriggerFromDb(tenantDb, input.triggerId);
        return { success: true };
      }),

    // Get templates linked to a specific trigger (Super Admin)
    getTriggerTemplates: platformAdminProcedure
      .input(z.object({ tenantId: z.number(), triggerId: z.number() }))
      .query(async ({ input }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) return [];

        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) return [];

        return await db.getTemplatesByTriggerIdFromDb(tenantDb, input.triggerId);
      }),

    // Update templates linked to a trigger (Super Admin)
    updateTriggerTemplates: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        triggerId: z.number(),
        templateIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }

        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        }

        // Remove all existing associations
        const { emailTriggerTemplates } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await tenantDb.delete(emailTriggerTemplates).where(eq(emailTriggerTemplates.triggerId, input.triggerId));

        // Insert new associations
        for (let i = 0; i < input.templateIds.length; i++) {
          await db.addTemplateToTriggerToDb(tenantDb, {
            triggerId: input.triggerId,
            templateId: input.templateIds[i],
            sendOrder: i + 1,
            isForReminder: false,
          });
        }

        return { success: true };
      }),
  }),

  // ===========================================
  // AUDIT LOGS ROUTER
  // ===========================================
  audit: router({
    getLogs: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.number().optional(),
        action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'DOWNLOAD', 'UPLOAD', 'EXPORT']).optional(),
        entity: z.enum(['CLIENT', 'DOCUMENT', 'USER', 'WORKFLOW', 'SETTINGS', 'AUTH']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }) => {
        try {
          const tenantDb = await getTenantDbOrNull(ctx);
          const tenantId = ctx.tenant?.id || ctx.user?.tenantId;
          if (!tenantId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant não identificado' });
          }

          const params: db.GetAuditLogsParams = {
            tenantId,
            limit: input.limit,
            offset: input.offset,
          };

          if (input.startDate) {
            params.startDate = new Date(input.startDate);
          }
          if (input.endDate) {
            params.endDate = new Date(input.endDate);
          }
          if (input.userId) {
            params.userId = input.userId;
          }
          if (input.action) {
            params.action = input.action;
          }
          if (input.entity) {
            params.entity = input.entity;
          }

          const result = tenantDb
            ? await db.getAuditLogsFromDb(tenantDb, params)
            : await db.getAuditLogs(params);

          // Enrich logs with user names
          const allUsers = tenantDb
            ? await db.getAllUsersFromDb(tenantDb, tenantId)
            : await db.getAllUsers();

          const userMap = new Map(allUsers.map((u: any) => [u.id, u.name || u.email]));

          const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || 'admin@acrdigital.com.br,admin@acedigital.com.br')
            .split(',')
            .map(e => e.trim().toLowerCase())
            .filter(Boolean);

          const getUserNameForLog = (log: any) => {
            if (log.userId) {
              const name = userMap.get(log.userId);
              if (name) return name;
            }

            const detailsRaw = log.details;
            if (typeof detailsRaw === 'string' && detailsRaw.trim()) {
              try {
                const parsed = JSON.parse(detailsRaw);
                const email = (parsed?.email || parsed?.userEmail || '').toString().trim().toLowerCase();
                if (email) {
                  if (superAdminEmails.includes(email)) return 'Super Admin';
                  return email;
                }
              } catch {
                // ignore
              }
            }

            return log.userId ? 'Admin da plataforma' : 'Sistema';
          };

          const enrichedLogs = result.logs.map(log => ({
            ...log,
            userName: getUserNameForLog(log),
          }));

          return {
            logs: enrichedLogs,
            total: result.total,
            limit: input.limit,
            offset: input.offset,
          };
        } catch (error: any) {
          console.error('[Audit] Error fetching logs:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Erro ao buscar logs de auditoria: ${error.message || String(error)}`,
            cause: error,
          });
        }
      }),

    exportCsv: adminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.number().optional(),
        action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'DOWNLOAD', 'UPLOAD', 'EXPORT']).optional(),
        entity: z.enum(['CLIENT', 'DOCUMENT', 'USER', 'WORKFLOW', 'SETTINGS', 'AUTH']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const tenantId = ctx.tenant?.id || ctx.user?.tenantId;
          if (!tenantId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tenant não identificado' });
        }

        const params: db.GetAuditLogsParams = {
          tenantId,
          limit: 10000,
          offset: 0,
        };

        if (input.startDate) params.startDate = new Date(input.startDate);
        if (input.endDate) params.endDate = new Date(input.endDate);
        if (input.userId) params.userId = input.userId;
        if (input.action) params.action = input.action;
        if (input.entity) params.entity = input.entity;

        const result = tenantDb
          ? await db.getAuditLogsFromDb(tenantDb, params)
          : await db.getAuditLogs(params);

        const userIds = [...new Set(result.logs.map(l => l.userId).filter(Boolean) as number[])];
        const usersFound = tenantDb
          ? await db.getUsersByIdsFromDb(tenantDb, userIds)
          : await db.getUsersByIds(userIds);

        const userMap = new Map(usersFound.map((u: any) => [u.id, u.name || u.email]));

        const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || 'admin@acrdigital.com.br,admin@acedigital.com.br')
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);

        const getUserNameForLog = (log: any) => {
          if (log.userId) {
            const name = userMap.get(log.userId);
            if (name) return name;
          }

          const detailsRaw = log.details;
          if (typeof detailsRaw === 'string' && detailsRaw.trim()) {
            try {
              const parsed = JSON.parse(detailsRaw);
              const email = (parsed?.email || parsed?.userEmail || '').toString().trim().toLowerCase();
              if (email) {
                if (superAdminEmails.includes(email)) return 'Super Admin';
                return email;
              }
            } catch {
              // ignore
            }
          }

          return log.userId ? 'Admin da plataforma' : 'Sistema';
        };

        const csvHeader = 'Data/Hora,Usuário,Ação,Entidade,ID Entidade,Detalhes,IP\n';
        const csvRows = result.logs.map(log => {
          const userName = getUserNameForLog(log);
          const date = new Date(log.createdAt).toLocaleString('pt-BR');
          const details = (log.details || '').replace(/"/g, '""');
          return `"${date}","${userName}","${log.action}","${log.entity}","${log.entityId || ''}","${details}","${log.ipAddress || ''}"`;
        }).join('\n');

        return {
          csv: csvHeader + csvRows,
          filename: `audit-log-${new Date().toISOString().split('T')[0]}.csv`,
        };
      }),
  }),

  // Email Triggers Router - Automação de emails
  emailTriggers: router({
    list: adminProcedure.query(async ({ ctx }) => {
      try {
        const tenantDb = await getTenantDbOrNull(ctx);
        const tenantId = ctx.tenant?.id;
        const triggers = tenantDb
          ? await db.getEmailTriggersFromDb(tenantDb, tenantId)
          : await db.getEmailTriggers(tenantId);
        
        // Load templates for each trigger
        const triggersWithTemplates = await Promise.all(
          triggers.map(async (trigger) => {
            const templates = tenantDb
              ? await db.getTemplatesByTriggerIdFromDb(tenantDb, trigger.id)
              : await db.getTemplatesByTriggerId(trigger.id);
            return { ...trigger, templates };
          })
        );
        
        return triggersWithTemplates;
      } catch (error: any) {
        console.error('[emailTriggers.list] Error:', error);
        if (error instanceof TRPCError) throw error;
        return [];
      }
    }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const trigger = tenantDb
          ? await db.getEmailTriggerByIdFromDb(tenantDb, input.id)
          : await db.getEmailTriggerById(input.id);
        
        if (!trigger) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Trigger não encontrado' });
        }
        
        const templates = tenantDb
          ? await db.getTemplatesByTriggerIdFromDb(tenantDb, input.id)
          : await db.getTemplatesByTriggerId(input.id);
        
        return { ...trigger, templates };
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        triggerEvent: z.string().min(1),
        recipientType: z.enum(['client', 'users', 'both', 'operator']).default('client'),
        recipientUserIds: z.array(z.number()).optional(),
        sendImmediate: z.boolean().default(true),
        sendBeforeHours: z.number().optional(),
        isActive: z.boolean().default(true),
        templateIds: z.array(z.object({
          templateId: z.number(),
          sendOrder: z.number().default(1),
          isForReminder: z.boolean().default(false),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const tenantId = ctx.tenant?.id;
        
        const triggerData = {
          tenantId,
          name: input.name,
          triggerEvent: input.triggerEvent,
          recipientType: input.recipientType,
          recipientUserIds: input.recipientUserIds ? JSON.stringify(input.recipientUserIds) : null,
          sendImmediate: input.sendImmediate,
          sendBeforeHours: input.sendBeforeHours,
          isActive: input.isActive,
        };
        
        const trigger = tenantDb
          ? await db.createEmailTriggerToDb(tenantDb, triggerData)
          : await db.createEmailTrigger(triggerData);
        
        // Add templates
        if (input.templateIds && input.templateIds.length > 0) {
          for (const t of input.templateIds) {
            const templateLink = {
              triggerId: trigger.id,
              templateId: t.templateId,
              sendOrder: t.sendOrder,
              isForReminder: t.isForReminder,
            };
            tenantDb
              ? await db.addTemplateToTriggerToDb(tenantDb, templateLink)
              : await db.addTemplateToTrigger(templateLink);
          }
        }
        
        return trigger;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        triggerEvent: z.string().min(1).optional(),
        recipientType: z.enum(['client', 'users', 'both', 'operator']).optional(),
        recipientUserIds: z.array(z.number()).optional(),
        sendImmediate: z.boolean().optional(),
        sendBeforeHours: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const { id, ...data } = input;
        
        const updateData: any = { ...data };
        if (data.recipientUserIds !== undefined) {
          updateData.recipientUserIds = data.recipientUserIds ? JSON.stringify(data.recipientUserIds) : null;
        }
        
        tenantDb
          ? await db.updateEmailTriggerToDb(tenantDb, id, updateData)
          : await db.updateEmailTrigger(id, updateData);
        
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        tenantDb
          ? await db.deleteEmailTriggerFromDb(tenantDb, input.id)
          : await db.deleteEmailTrigger(input.id);
        return { success: true };
      }),

    // Template management
    addTemplate: adminProcedure
      .input(z.object({
        triggerId: z.number(),
        templateId: z.number(),
        sendOrder: z.number().default(1),
        isForReminder: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const result = tenantDb
          ? await db.addTemplateToTriggerToDb(tenantDb, input)
          : await db.addTemplateToTrigger(input);
        return result;
      }),

    removeTemplate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        tenantDb
          ? await db.removeTemplateFromTriggerToDb(tenantDb, input.id)
          : await db.removeTemplateFromTrigger(input.id);
        return { success: true };
      }),

    // Get available trigger events
    getAvailableEvents: adminProcedure.query(() => {
      return [
        { value: 'CLIENT_CREATED', label: 'Cliente cadastrado', hasSchedule: false },
        { value: 'STEP_COMPLETED:1', label: 'Etapa 1 - Cadastro concluído', hasSchedule: false },
        { value: 'STEP_COMPLETED:2', label: 'Etapa 2 - Juntada de Documentos concluída', hasSchedule: false },
        { value: 'STEP_COMPLETED:3', label: 'Etapa 3 - Central de Mensagens concluída', hasSchedule: false },
        { value: 'STEP_COMPLETED:4', label: 'Etapa 4 - Avaliação Psicológica concluída', hasSchedule: false },
        { value: 'STEP_COMPLETED:5', label: 'Etapa 5 - Laudo Técnico concluído', hasSchedule: false },
        { value: 'STEP_COMPLETED:6', label: 'Etapa 6 - Acompanhamento Sinarm concluído', hasSchedule: false },
        { value: 'STEP_COMPLETED:7', label: 'Etapa 7 - Montagem Sinarm', hasSchedule: false },
        { value: 'STEP_COMPLETED:8', label: 'Etapa 8 - Protocolado', hasSchedule: false },
        { value: 'STEP_COMPLETED:9', label: 'Etapa 9 - Concluído', hasSchedule: false },
        { value: 'SCHEDULE_CREATED', label: 'Agendamento Criado (Geral)', hasSchedule: true },
        { value: 'SCHEDULE_PSYCH_CREATED', label: 'Agendamento de Avaliação Psicológica', hasSchedule: true },
        { value: 'SCHEDULE_TECH_CONFIRMATION', label: 'Confirmação de Agendamento de Laudo Técnico', hasSchedule: true },
        { value: 'SCHEDULE_TECH_REMINDER', label: 'Lembrete de Agendamento de Laudo Técnico', hasSchedule: true },
        { value: 'SINARM_STATUS:Iniciado', label: 'Sinarm - Iniciado', hasSchedule: false },
        { value: 'SINARM_STATUS:Solicitado', label: 'Sinarm - Solicitado', hasSchedule: false },
        { value: 'SINARM_STATUS:Aguardando Baixa GRU', label: 'Sinarm - Aguardando Baixa GRU', hasSchedule: false },
        { value: 'SINARM_STATUS:Em Análise', label: 'Sinarm - Em Análise', hasSchedule: false },
        { value: 'SINARM_STATUS:Correção Solicitada', label: 'Sinarm - Correção Solicitada', hasSchedule: false },
        { value: 'SINARM_STATUS:Deferido', label: 'Sinarm - Deferido', hasSchedule: false },
        { value: 'SINARM_STATUS:Indeferido', label: 'Sinarm - Indeferido', hasSchedule: false },
        { value: 'WORKFLOW_COMPLETE', label: 'Processo concluído (todas etapas)', hasSchedule: false },
      ];
    }),

    // Scheduled emails management
    getScheduledByClient: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        return tenantDb
          ? await db.getScheduledEmailsByClientFromDb(tenantDb, input.clientId)
          : await db.getScheduledEmailsByClient(input.clientId);
      }),

    cancelScheduledByClient: adminProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        tenantDb
          ? await db.cancelScheduledEmailsByClientToDb(tenantDb, input.clientId)
          : await db.cancelScheduledEmailsByClient(input.clientId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;



