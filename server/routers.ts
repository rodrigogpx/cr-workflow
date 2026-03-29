/// <reference types="node" />
import { COOKIE_NAME, PLATFORM_COOKIE_NAME, ONE_YEAR_MS, SESSION_MAX_AGE_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure, tenantProcedure, tenantAdminProcedure, platformAdminProcedure, platformSuperAdminProcedure, platformAdminOrSuperProcedure } from "./_core/trpc";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { sendEmail, verifyConnection, verifyConnectionWithSettings, sendTestEmailWithSettings, triggerEmails, fetchImageAsBase64, buildInlineLogoAttachment } from "./emailService";
import * as db from "./db";
import { invalidateTenantCache, getTenantConfig, getTenantDb } from "./config/tenant.config";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
import { saveClientDocumentFile, getTenantStorageUsage, validateFileUpload } from "./fileStorage";
import { TRPCError } from "@trpc/server";
import { comparePassword, hashPassword } from "./_core/auth";
import { sdk } from "./_core/sdk";
import { createClientSchema, updateClientSchema, createUserSchema, updateUserSchema } from "@shared/validations";
import { seedTenantEmailTemplates } from "./defaults/seedTenant";
import { iatRouter } from "./routers/iat";
import type { TrpcContext } from "./_core/context";
import { Buffer } from "node:buffer";

async function getTenantDbOrNull(ctx: TrpcContext) {
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
    me: publicProcedure.query(({ ctx }: { ctx: TrpcContext }) => {
      if (!ctx.user) return null;
      // Remover a senha (hashedPassword) do retorno do tRPC
      const { hashedPassword, ...safeUser } = ctx.user;
      
      // Injetar também as features do tenant no payload de usuário, se existir, para o front-end
      const tenantFeatures = ctx.tenant ? {
        featureWorkflowCR: ctx.tenant.featureWorkflowCR,
        featureApostilamento: ctx.tenant.featureApostilamento,
        featureRenovacao: ctx.tenant.featureRenovacao,
        featureInsumos: ctx.tenant.featureInsumos,
        featureIAT: ctx.tenant.featureIAT,
      } : null;

      return {
        ...safeUser,
        tenantFeatures,
        tenantSlug: ctx.tenantSlug ?? null,
      };
    }),
    platformMe: publicProcedure.query(({ ctx }: { ctx: TrpcContext }) => {
      if (!ctx.platformAdmin) return null;
      // Remover a senha do platformAdmin também, por segurança
      const { hashedPassword, ...safeAdmin } = ctx.platformAdmin;
      return safeAdmin;
    }),
    // Cria o primeiro superadmin quando a tabela platformAdmins está vazia.
    // Retorna 403 se já existir qualquer admin (proteção contra bootstrap repetido).
    bootstrapSuperAdmin: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(2),
      }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const existing = await db.getAllPlatformAdmins();
        if (existing.length > 0) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Bootstrap não permitido: já existem administradores cadastrados.' });
        }
        const admin = await db.createPlatformAdmin({ ...input, role: 'superadmin' });
        // Fazer login automático após bootstrap
        const sessionToken = await sdk.createSessionToken(admin.id.toString(), {
          name: admin.name || "",
          expiresInMs: SESSION_MAX_AGE_MS,
          isPlatformAdmin: true,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(PLATFORM_COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_MAX_AGE_MS,
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
        });
        return { success: true, admin };
      }),

    platformLogin: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
          expiresInMs: SESSION_MAX_AGE_MS,
          isPlatformAdmin: true,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(PLATFORM_COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_MAX_AGE_MS,
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
          // SECURITY: Do NOT auto-associate users without tenant to the first tenant.
          // Legacy users without tenantId must be manually assigned by an admin.
          console.warn(`[Auth] User ${user.id} (${user.email}) has no tenantId — login blocked until admin assigns a tenant`);
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuário sem tenant associado. Contate o administrador.' });
        }

        const sessionToken = await sdk.createSessionToken(user.id.toString(), {
          name: user.name || "",
          expiresInMs: SESSION_MAX_AGE_MS,
          tenantSlug,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: SESSION_MAX_AGE_MS,
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
    logout: publicProcedure.mutation(({ ctx }: { ctx: TrpcContext }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const clearOpts = { ...cookieOptions, maxAge: -1, path: "/", httpOnly: true, sameSite: "lax" as const };
      // SECURITY: Clear BOTH session cookies to fully invalidate tenant and platform admin sessions
      ctx.res.clearCookie(COOKIE_NAME, clearOpts);
      ctx.res.clearCookie(PLATFORM_COOKIE_NAME, clearOpts);
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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

        // Verificar limite de usuários do tenant
        if (tenantSlug && ctx.tenant) {
          const tenantDb = await getTenantDb(ctx.tenant);
          if (tenantDb) {
            const { checkUserLimit, getEffectiveLimits } = await import("./config/tenant.limits");
            const limits = getEffectiveLimits(ctx.tenant);
            const check = await checkUserLimit(tenantDb, ctx.tenant.id, limits.maxUsers);
            if (!check.allowed) {
              throw new TRPCError({
                code: 'FORBIDDEN',
                message: `Limite de usuários atingido (${check.current}/${check.max}). Entre em contato com o administrador para upgrade do plano.`,
              });
            }
          }
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
    list: protectedProcedure.query(async ({ ctx }: { ctx: TrpcContext }) => {
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
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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

        // Verificar limite de clientes do tenant
        if (ctx.tenant?.id && tenantDb) {
          const { checkClientLimit, getEffectiveLimits } = await import("./config/tenant.limits");
          const limits = getEffectiveLimits(ctx.tenant);
          const check = await checkClientLimit(tenantDb, ctx.tenant.id, limits.maxClients);
          if (!check.allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Limite de clientes atingido (${check.current}/${check.max}). Entre em contato com o administrador para upgrade do plano.`,
            });
          }
        }

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

        // Gerar token de convite para o Portal do Cliente
        try {
          const activePortalDb = tenantDb || await db.getDb();
          if (activePortalDb) {
            await db.createClientInviteToken(activePortalDb, clientId, ctx.tenant?.id);
          }
        } catch (tokenErr) {
          console.warn('[Clients.create] Falha ao gerar token de convite do portal:', tokenErr);
          // Não falha o cadastro
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

            // Variável {{link_portal}} — link de ativação do portal do cliente
            // DOMAIN pode vir como "hml.cac360.com.br" ou "https://hml.cac360.com.br" — normalizar
            const _rawDomain1 = (process.env.DOMAIN ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
            const portalBaseUrl = ctx.tenant?.domain
              ? `https://${ctx.tenant.slug}.${ctx.tenant.domain.replace(/^https?:\/\//, '')}`
              : (_rawDomain1 ? `https://${_rawDomain1}` : process.env.APP_URL || '');

            let portalLink = '';
            try {
              const activePortalDb = tenantDb || await db.getDb();
              if (activePortalDb) {
                const rawRows = await activePortalDb.execute(
                  sql`SELECT "token" FROM "clientInviteTokens" WHERE "clientId" = ${clientId} ORDER BY "createdAt" DESC LIMIT 1`
                );
                const tokenRows: any[] = Array.isArray(rawRows) ? rawRows : ((rawRows as any).rows ?? []);
                if (tokenRows[0]?.token) {
                  portalLink = `${portalBaseUrl}/portal/acesso?t=${tokenRows[0].token}`;
                }
              }
            } catch {}

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
              // Variável {{link_portal}} — botão de acesso ao portal
              result = result.replace(/{{link_portal}}/g, portalLink
                ? `<a href="${portalLink}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold;">Completar Meu Cadastro →</a>`
                : '');
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
          .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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

    reenviarConvitePortal: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        if (!['admin', 'operator'].includes(ctx.user.role ?? '')) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão.' });
        }

        const tenantDb = await getTenantDbOrNull(ctx);
        const activeDb = tenantDb || await (await import('./db')).getDb();
        if (!activeDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco indisponível.' });

        // Buscar o cliente
        const clientRows = await activeDb.execute(
          (await import('drizzle-orm')).sql`SELECT * FROM "clients" WHERE "id" = ${input.clientId} LIMIT 1`
        );
        const clientArr = Array.isArray(clientRows) ? clientRows : (clientRows as any).rows || [];
        if (clientArr.length === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cliente não encontrado.' });
        const client = clientArr[0];

        // Regenerar token
        const newToken = await db.regenerateClientInviteToken(activeDb, input.clientId, ctx.tenant?.id);

        // Montar link do portal
        // DOMAIN pode vir com ou sem protocolo — normalizar e não adicionar slug do tenant
        // (o portal vive na raiz do domínio, não em subdomínio por tenant)
        const _rawDomain2 = (process.env.DOMAIN ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');
        const portalBaseUrl = ctx.tenant?.domain
          ? `https://${ctx.tenant.slug}.${ctx.tenant.domain.replace(/^https?:\/\//, '')}`
          : (_rawDomain2 ? `https://${_rawDomain2}` : process.env.APP_URL || '');
        const portalLink = `${portalBaseUrl}/portal/acesso?t=${newToken}`;

        // Enviar email com o link
        if (client.email) {
          try {
            const tenantSettings = ctx.tenant?.id ? await db.getTenantSmtpSettings(ctx.tenant.id) : null;
            const emailLogoUrl = tenantSettings?.emailLogoUrl || '';
            const inlineLogo = buildInlineLogoAttachment(emailLogoUrl);

            const subject = `Seu link de acesso ao Portal — ${ctx.tenant?.name || 'CAC 360'}`;
            const html = `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                ${emailLogoUrl ? `<img src="cid:email-logo" alt="Logo" style="max-height:60px;margin-bottom:16px;display:block;" />` : ''}
                <h2 style="color:#7c3aed">Portal do Associado</h2>
                <p>Olá, <strong>${client.name}</strong>!</p>
                <p>Seu link de acesso ao Portal foi renovado. Clique no botão abaixo para acessar:</p>
                <p style="margin:24px 0">
                  <a href="${portalLink}"
                     style="background:#7c3aed;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
                    Acessar o Portal →
                  </a>
                </p>
                <p style="font-size:12px;color:#888">
                  Este link é pessoal e expira em 30 dias.<br>
                  Você precisará confirmar seu email (<strong>${client.email}</strong>) e CPF para acessar.
                </p>
              </div>
            `;

            await sendEmail({
              to: client.email,
              subject,
              html,
              attachments: inlineLogo ? [inlineLogo] : undefined,
              tenantDb,
              tenantId: ctx.tenant?.id,
            });
          } catch (emailErr) {
            console.warn('[portal.reenviarConvite] Email falhou:', emailErr);
            // Não falha o processo — token já foi gerado
          }
        }

        return { success: true, message: 'Convite reenviado com sucesso.' };
      }),
  }),

  // Portal router
  portal: router({
    getStatus: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const activeDb = tenantDb || await (await import('./db')).getDb();
        if (!activeDb) return { hasToken: false, activated: false, activatedAt: null };

        const rows = await activeDb.execute(
          (await import('drizzle-orm')).sql`
            SELECT "activatedAt", "expiresAt", "createdAt"
            FROM "clientInviteTokens"
            WHERE "clientId" = ${input.clientId}
            ORDER BY "createdAt" DESC LIMIT 1
          `
        );
        const arr = Array.isArray(rows) ? rows : (rows as any).rows || [];
        if (arr.length === 0) return { hasToken: false, activated: false, activatedAt: null };

        return {
          hasToken: true,
          activated: !!arr[0].activatedAt,
          activatedAt: arr[0].activatedAt ?? null,
          expiresAt: arr[0].expiresAt,
        };
      }),
  }),

  // Workflow router
  workflow: router({
    getByClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
                ? await db.getSubTasksByWorkflowStepFromDb(tenantDb, step.id, ctx.tenant?.id ?? undefined)
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
              ? await db.getSubTasksByWorkflowStepFromDb(tenantDb, currentStep.id, ctx.tenant?.id ?? undefined)
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
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
          ? await db.getSinarmCommentsByWorkflowStepIdFromDb(tenantDb, input.stepId, ctx.tenant?.id ?? undefined)
          : await db.getSinarmCommentsByWorkflowStepId(input.stepId);
      }),

    updateSubTask: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        subTaskId: z.number(),
        completed: z.boolean(),
      }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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

        // Verificar limite de armazenamento do tenant
        if (ctx.tenant?.id) {
          const { checkStorageLimit, getEffectiveLimits } = await import("./config/tenant.limits");
          const limits = getEffectiveLimits(ctx.tenant);
          const check = await checkStorageLimit(ctx.tenant.id, limits.maxStorageGB);
          if (!check.allowed) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Limite de armazenamento atingido (${check.currentGB.toFixed(1)} GB / ${check.maxGB} GB). Entre em contato com o administrador para upgrade do plano.`,
            });
          }
        }

        // SECURITY: Validar MIME type e extensão antes de salvar
        validateFileUpload(input.fileName, input.mimeType);

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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .query(async ({ ctx }: { ctx: TrpcContext }) => {
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
      .mutation(async ({ ctx }: { ctx: TrpcContext }) => {
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
    saveTemplate: adminProcedure
      .input(z.object({
        templateKey: z.string(),
        module: z.string().optional(),
        templateTitle: z.string().optional(),
        subject: z.string(),
        content: z.string(),
        attachments: z.string().optional(), // JSON string of attachments
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        if (tenantDb) {
          await db.deleteEmailTemplateFromDb(tenantDb, input.templateKey, input.module, ctx.tenant?.id);
        } else {
          await db.deleteEmailTemplate(input.templateKey, input.module);
        }
        return { success: true };
      }),

    seedTemplates: adminProcedure
      .mutation(async ({ ctx }: { ctx: TrpcContext }) => {
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
        // Despachante não pode enviar emails manualmente
        if (ctx.user?.role === 'despachante') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Despachante não pode enviar emails manualmente' });
        }

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

  // Users router (tenant admin only — tenant obrigatório para isolamento)
  users: router({
    list: tenantAdminProcedure.query(async ({ ctx }: { ctx: TrpcContext }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      return tenantDb ? await db.getAllUsersFromDb(tenantDb, tenantId) : await db.getAllUsers();
    }),

    create: tenantAdminProcedure
      .input(createUserSchema)
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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

    update: tenantAdminProcedure
      .input(updateUserSchema)
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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

    updateRole: tenantAdminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin', 'despachante']),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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

    assignRole: tenantAdminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(['operator', 'admin', 'despachante']),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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

    deleteUser: tenantAdminProcedure
      .input(z.object({
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
    listOperatorsWithStats: tenantAdminProcedure.query(async ({ ctx }: { ctx: TrpcContext }) => {
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
    listClientsForAssignment: tenantAdminProcedure.query(async ({ ctx }: { ctx: TrpcContext }) => {
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
    assignClientToOperator: tenantAdminProcedure
      .input(z.object({
        clientId: z.number(),
        operatorId: z.number(),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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

  // Platform Admin / Tenants Management
  tenants: router({
    // Rodar seed de mocks (limpa e recria tenants/users/clients @example.com)
    seedMocks: platformSuperAdminProcedure.mutation(async ({ ctx }: { ctx: TrpcContext }) => {
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
    list: platformAdminProcedure.query(async ({ ctx }: { ctx: TrpcContext }) => {
      const tenantsList = await db.getAllTenants();
      return tenantsList;
    }),

    // Buscar tenant por ID
    getById: platformAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        return tenant;
      }),

    // Buscar tenant por slug
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantBySlug(input.slug);
        return tenant;
      }),

    // Criar novo tenant
    create: platformAdminOrSuperProcedure
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
        const isSingleDbMode = process.env.TENANT_DB_MODE === 'single' || process.env.NODE_ENV === 'production';
        let dbConfig = {
          dbHost: input.dbHost || 'localhost',
          dbPort: input.dbPort,
          dbName: input.dbName || `cac360_${input.slug}`,
          dbUser: input.dbUser || '',
          dbPassword: input.dbPassword || '',
        };

        if (isSingleDbMode) {
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
          invalidateTenantCache(input.slug);
          const tenantConfig = await getTenantConfig(input.slug);
          if (tenantConfig) {
            const tenantDb = await getTenantDb(tenantConfig);
            if (tenantDb) {
              await seedTenantEmailTemplates(tenantDb, tenantId);
            }
          }
        } catch (seedError) {
          console.error(`[Tenant] Error seeding email templates for ${input.slug}:`, seedError);
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
    update: platformAdminOrSuperProcedure
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
        const { id, ...updates } = input;
        const tenant = await db.getTenantById(id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        await db.updateTenant(id, updates);
        invalidateTenantCache(tenant.slug);
        return { success: true };
      }),

    // Suspender/Ativar tenant
    setStatus: platformAdminOrSuperProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'suspended', 'trial', 'cancelled']),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
    delete: platformSuperAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
    hardDelete: platformSuperAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        await db.hardDeleteTenant(input.id);
        invalidateTenantCache(tenant.slug);
        return { success: true };
      }),

    // Estatísticas do tenant
    getStats: platformAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        try {
          const platformDb = await db.getDb();
          if (!platformDb) {
            return { usersCount: 0, clientsCount: 0, storageUsedGB: 0, lastActivity: null, error: 'DB não disponível' };
          }
          const usersRes = await platformDb.execute(sql`SELECT count(*) as count FROM "users" WHERE "tenantId" = ${input.id}`);
          const usersCount = Number(usersRes[0]?.count || 0);
          const clientsRes = await platformDb.execute(sql`SELECT count(*) as count FROM "clients" WHERE "tenantId" = ${input.id}`);
          const clientsCount = Number(clientsRes[0]?.count || 0);
          const activityRes = await platformDb.execute(sql`SELECT "createdAt" FROM "auditLogs" WHERE "tenantId" = ${input.id} ORDER BY "createdAt" DESC LIMIT 1`);
          const lastActivity = activityRes[0]?.createdAt || null;
          const storageBytes = await getTenantStorageUsage(input.id);
          const storageUsedGB = Number((storageBytes / (1024 * 1024 * 1024)).toFixed(3));
          let dbSizeMB = 0;
          try {
            const tenantDb = await getTenantDb(tenant);
            if (tenantDb) {
              const sizeBytes = await db.getDatabaseSize(tenantDb);
              dbSizeMB = Number((sizeBytes / (1024 * 1024)).toFixed(2));
            }
          } catch (dbErr: any) {
            console.error(`[Stats] Error getting DB size for tenant ${tenant.id}:`, dbErr?.message);
          }
          return { usersCount, clientsCount, storageUsedGB, dbSizeMB, lastActivity };
        } catch (error: any) {
          console.error(`Error fetching stats for tenant ${tenant.id}:`, error);
          return { usersCount: 0, clientsCount: 0, storageUsedGB: 0, dbSizeMB: 0, lastActivity: null, error: error.message || 'Erro desconhecido' };
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
          const [tenantsRes] = await platformDb.execute(sql`SELECT count(*) as count FROM "tenants"`);
          const [usersRes] = await platformDb.execute(sql`SELECT count(*) as count FROM "users"`);
          const [clientsRes] = await platformDb.execute(sql`SELECT count(*) as count FROM "clients"`);
          const platformDbSizeBytes = await db.getDatabaseSize(platformDb as any);
          const platformDbSizeMB = Number((platformDbSizeBytes / (1024 * 1024)).toFixed(2));
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
    healthCheck: platformAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: { input: any }) => {
        const startTime = Date.now();
        const tenant = await db.getTenantById(input.id);
        if (!tenant) {
          return { status: 'error' as const, message: 'Tenant não encontrado', latencyMs: Date.now() - startTime };
        }
        try {
          const tenantDb = await getTenantDb(tenant);
          if (!tenantDb) {
            return { status: 'error' as const, message: 'Não foi possível conectar ao banco do tenant', latencyMs: Date.now() - startTime };
          }
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
          return { status: 'error' as const, message: error?.message || 'Erro desconhecido', latencyMs: Date.now() - startTime };
        }
      }),

    // Impersonate: entrar como admin de um tenant específico
    impersonate: platformAdminOrSuperProcedure
      .input(z.object({ 
        tenantId: z.number(),
        confirmPassword: z.string()
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
        const impersonationToken = await sdk.createSessionToken(tenantAdmin.id.toString(), {
          name: tenantAdmin.name || "",
          tenantSlug: tenant.slug,
          expiresInMs: 60 * 60 * 1000,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, impersonationToken, { 
          ...cookieOptions, 
          maxAge: 60 * 60 * 1000, 
          path: "/",
          httpOnly: true,
          sameSite: "lax",
        });
        ctx.res.cookie('is_impersonating', 'true', {
          maxAge: 60 * 60 * 1000,
          path: "/",
          sameSite: "lax",
        });
        return { success: true, tenantSlug: tenant.slug };
      }),

    // ===========================================
    // EMAIL CONFIGURATION (Super Admin)
    // ===========================================
    
    getEmailConfig: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }: { input: any }) => {
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

    updateEmailConfig: platformAdminOrSuperProcedure
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
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
        const { tenantId, ...config } = input;
        if (config.emailMethod === "smtp") {
          if (!config.smtpHost || !config.smtpUser) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "SMTP requer host e usuário" });
          }
          const existing = await db.getTenantSmtpSettings(tenantId);
          const smtpPassword = config.smtpPassword !== undefined && config.smtpPassword !== ""
            ? config.smtpPassword
            : existing?.smtpPassword || "";
          if (!smtpPassword) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a senha SMTP" });
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
            throw new TRPCError({ code: "BAD_REQUEST", message: "Gateway requer URL base" });
          }
          const existing = await db.getTenantSmtpSettings(tenantId);
          const postmanGpxApiKey = config.postmanGpxApiKey !== undefined && config.postmanGpxApiKey !== ""
            ? config.postmanGpxApiKey
            : (existing as any)?.postmanGpxApiKey || "";
          if (!postmanGpxApiKey) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a API Key do gateway" });
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

    testEmailConfig: platformAdminOrSuperProcedure
      .input(z.object({
        tenantId: z.number(),
        testEmail: z.string().email(),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
        const settings = await db.getTenantSmtpSettings(input.tenantId);
        if (!settings) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Configuração não encontrada' });
        }
        const tenant = await db.getTenantById(input.tenantId);
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

    getEmailTemplates: platformAdminProcedure
      .input(z.object({ 
        tenantId: z.number(),
        module: z.string().optional(),
      }))
      .query(async ({ input }: { input: any }) => {
        try {
          const tenant = await db.getTenantById(input.tenantId);
          if (!tenant) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
          }
          let tenantDb: any = null;
          const tenantConfig = await getTenantConfig(tenant.slug);
          if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
          if (!tenantDb) tenantDb = await db.getDb();
          if (!tenantDb) return [];
          return await db.getAllEmailTemplatesFromDb(tenantDb, input.module, input.tenantId);
        } catch (error: any) {
          console.error(`[tenants.getEmailTemplates] Error:`, error?.message);
          return [];
        }
      }),

    getEmailTriggers: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }: { input: any }) => {
        try {
          const tenant = await db.getTenantById(input.tenantId);
          if (!tenant) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
          }
          let tenantDb: any = null;
          const tenantConfig = await getTenantConfig(tenant.slug);
          if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
          if (!tenantDb) tenantDb = await db.getDb();
          if (!tenantDb) return [];
          const triggers = await db.getEmailTriggersFromDb(tenantDb, input.tenantId);
          return await Promise.all(
            triggers.map(async (trigger: any) => {
              const templates = await db.getTemplatesByTriggerIdFromDb(tenantDb, trigger.id);
              return { ...trigger, templates };
            })
          );
        } catch (error: any) {
          console.error(`[tenants.getEmailTriggers] Error:`, error?.message);
          return [];
        }
      }),

    saveEmailTemplate: platformAdminOrSuperProcedure
      .input(z.object({
        tenantId: z.number(),
        templateKey: z.string(),
        module: z.string().optional(),
        templateTitle: z.string().optional(),
        subject: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        const templateId = await db.saveEmailTemplateToDb(tenantDb, {
          templateKey: input.templateKey,
          module: input.module,
          templateTitle: input.templateTitle,
          subject: input.subject,
          content: input.content,
        }, input.tenantId);
        return { success: true, templateId };
      }),

    seedEmailTemplates: platformAdminOrSuperProcedure
      .input(z.object({ tenantId: z.number() }))
      .mutation(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        return await seedTenantEmailTemplates(tenantDb, input.tenantId);
      }),

    createEmailTrigger: platformAdminOrSuperProcedure
      .input(z.object({
        tenantId: z.number(),
        name: z.string().min(1),
        triggerEvent: z.string().min(1),
        recipientType: z.string().default('client'),
        isActive: z.boolean().default(true),
        sendImmediate: z.boolean().default(true),
        sendBeforeHours: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        const { tenantId: _tid, ...triggerData } = input;
        const trigger = await db.createEmailTriggerToDb(tenantDb, {
          ...triggerData,
          tenantId: input.tenantId,
        });
        return trigger;
      }),

    updateEmailTrigger: platformAdminOrSuperProcedure
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
      .mutation(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
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

    deleteEmailTrigger: platformAdminOrSuperProcedure
      .input(z.object({
        tenantId: z.number(),
        triggerId: z.number(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        await db.deleteEmailTriggerFromDb(tenantDb, input.triggerId);
        return { success: true };
      }),

    getTriggerTemplates: platformAdminProcedure
      .input(z.object({ tenantId: z.number(), triggerId: z.number() }))
      .query(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) return [];
        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) return [];
        return await db.getTemplatesByTriggerIdFromDb(tenantDb, input.triggerId);
      }),

    updateTriggerTemplates: platformAdminOrSuperProcedure
      .input(z.object({
        tenantId: z.number(),
        triggerId: z.number(),
        templateIds: z.array(z.number()),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const tenant = await db.getTenantById(input.tenantId);
        if (!tenant) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant não encontrado' });
        }
        let tenantDb: any = null;
        const tenantConfig = await getTenantConfig(tenant.slug);
        if (tenantConfig) tenantDb = await getTenantDb(tenantConfig);
        if (!tenantDb) tenantDb = await db.getDb();
        if (!tenantDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB do tenant indisponível' });
        const { emailTriggerTemplates } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await tenantDb.delete(emailTriggerTemplates).where(eq(emailTriggerTemplates.triggerId, input.triggerId));
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
    getLogs: tenantAdminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.number().optional(),
        action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'DOWNLOAD', 'UPLOAD', 'EXPORT']).optional(),
        entity: z.enum(['CLIENT', 'DOCUMENT', 'USER', 'WORKFLOW', 'SETTINGS', 'AUTH']).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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

    exportCsv: tenantAdminProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.number().optional(),
        action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'DOWNLOAD', 'UPLOAD', 'EXPORT']).optional(),
        entity: z.enum(['CLIENT', 'DOCUMENT', 'USER', 'WORKFLOW', 'SETTINGS', 'AUTH']).optional(),
      }))
      .mutation(async ({ input, ctx }: { input: any; ctx: TrpcContext }) => {
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
    list: tenantAdminProcedure.query(async ({ ctx }: { ctx: TrpcContext }) => {
      try {
        const tenantDb = await getTenantDbOrNull(ctx);
        const tenantId = ctx.tenant?.id;
        const triggers = tenantDb
          ? await db.getEmailTriggersFromDb(tenantDb, tenantId)
          : await db.getEmailTriggers(tenantId);
        
        // Load templates for each trigger
        const triggersWithTemplates = await Promise.all(
          triggers.map(async (trigger: any) => {
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

    getById: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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

    create: tenantAdminProcedure
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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

    update: tenantAdminProcedure
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
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
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

    delete: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        tenantDb
          ? await db.deleteEmailTriggerFromDb(tenantDb, input.id)
          : await db.deleteEmailTrigger(input.id);
        return { success: true };
      }),

    // Template management
    addTemplate: tenantAdminProcedure
      .input(z.object({
        triggerId: z.number(),
        templateId: z.number(),
        sendOrder: z.number().default(1),
        isForReminder: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const result = tenantDb
          ? await db.addTemplateToTriggerToDb(tenantDb, input)
          : await db.addTemplateToTrigger(input);
        return result;
      }),

    removeTemplate: tenantAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        tenantDb
          ? await db.removeTemplateFromTriggerToDb(tenantDb, input.id)
          : await db.removeTemplateFromTrigger(input.id);
        return { success: true };
      }),

    // Get available trigger events
    getAvailableEvents: tenantAdminProcedure.query(() => {
      return [
        { value: 'CLIENT_CREATED', label: 'Cliente cadastrado', hasSchedule: false },
        { value: 'STEP_COMPLETED:1', label: 'Etapa 1 - Cadastro concluído', hasSchedule: false },
        { value: 'STEP_COMPLETED:2', label: 'Etapa 2 - Juntada de Documentos concluída', hasSchedule: false },
        { value: 'STEP_COMPLETED:3', label: 'Etapa 3 - Central de Mensagens concluída', hasSchedule: false },
        { value: 'STEP_COMPLETED:4', label: 'Etapa 4 - Avaliação Psicológica concluída', hasSchedule: false },
        { value: 'STEP_COMPLETED:5', label: 'Etapa 5 - Laudo Técnico concluído', hasSchedule: false },
        { value: 'STEP_COMPLETED:6', label: 'Etapa 6 - Acompanhamento Sinarm concluído', hasSchedule: false },
        { value: 'SCHEDULE_PSYCH_CREATED', label: 'Agendamento de Avaliação Psicológica', hasSchedule: true },
        { value: 'SCHEDULE_TECH_CONFIRMATION', label: 'Confirmação de Agendamento de Laudo Técnico', hasSchedule: true },
        // SCHEDULE_TECH_REMINDER e WORKFLOW_COMPLETE removidos: eventos não disparados no backend
        { value: 'SINARM_STATUS:Iniciado', label: 'Sinarm - Iniciado', hasSchedule: false },
        { value: 'SINARM_STATUS:Solicitado', label: 'Sinarm - Solicitado', hasSchedule: false },
        { value: 'SINARM_STATUS:Aguardando Baixa GRU', label: 'Sinarm - Aguardando Baixa GRU', hasSchedule: false },
        { value: 'SINARM_STATUS:Em Análise', label: 'Sinarm - Em Análise', hasSchedule: false },
        { value: 'SINARM_STATUS:Correção Solicitada', label: 'Sinarm - Correção Solicitada', hasSchedule: false },
        { value: 'SINARM_STATUS:Deferido', label: 'Sinarm - Deferido', hasSchedule: false },
        { value: 'SINARM_STATUS:Indeferido', label: 'Sinarm - Indeferido', hasSchedule: false },
      ];
    }),

    // Scheduled emails management
    getScheduledByClient: tenantAdminProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        return tenantDb
          ? await db.getScheduledEmailsByClientFromDb(tenantDb, input.clientId)
          : await db.getScheduledEmailsByClient(input.clientId);
      }),

    cancelScheduledByClient: tenantAdminProcedure
      .input(z.object({ clientId: z.number() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        tenantDb
          ? await db.cancelScheduledEmailsByClientToDb(tenantDb, input.clientId)
          : await db.cancelScheduledEmailsByClient(input.clientId);
        return { success: true };
      }),
  }),

  // ===========================================
  // PLATFORM ADMINS ROUTER (RBAC)
  // ===========================================
  platformAdmins: router({
    // Lista todos os platform admins — apenas superadmin
    list: platformSuperAdminProcedure.query(async () => {
      return db.getAllPlatformAdmins();
    }),

    // Cria novo platform admin — apenas superadmin
    create: platformSuperAdminProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(2),
        role: z.enum(['superadmin', 'admin', 'support']).default('admin'),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const existing = await db.getPlatformAdminByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um administrador com esse e-mail.' });
        }
        return db.createPlatformAdmin(input);
      }),

    // Edita perfil — superadmin edita qualquer um; outros só editam o próprio
    update: platformAdminProcedure
      .input(z.object({
        id: z.number(),
        email: z.string().email().optional(),
        name: z.string().min(2).optional(),
      }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const isSelf = ctx.platformAdmin!.id === input.id;
        if (!isSelf && ctx.platformAdmin!.role !== 'superadmin') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para editar outro administrador.' });
        }
        if (input.email) {
          const existing = await db.getPlatformAdminByEmail(input.email);
          if (existing && existing.id !== input.id) {
            throw new TRPCError({ code: 'CONFLICT', message: 'E-mail já em uso por outro administrador.' });
          }
        }
        const { id, ...data } = input;
        return db.updatePlatformAdmin(id, data);
      }),

    // Troca senha — superadmin troca de qualquer um sem senha atual; outros só a própria (com senha atual)
    changePassword: platformAdminProcedure
      .input(z.object({
        id: z.number(),
        currentPassword: z.string().optional(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const isSelf = ctx.platformAdmin!.id === input.id;
        const isSuperAdmin = ctx.platformAdmin!.role === 'superadmin';

        if (!isSelf && !isSuperAdmin) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Sem permissão para alterar a senha de outro administrador.' });
        }
        if (isSelf) {
          if (!input.currentPassword) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe a senha atual.' });
          }
          const admin = await db.getPlatformAdminById(input.id);
          if (!admin) throw new TRPCError({ code: 'NOT_FOUND', message: 'Administrador não encontrado.' });
          const match = await comparePassword(input.currentPassword, admin.hashedPassword);
          if (!match) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta.' });
        }
        await db.updatePlatformAdminPassword(input.id, input.newPassword);
        return { success: true };
      }),

    // Ativa/desativa — apenas superadmin; bloqueia se for o último superadmin ativo
    setStatus: platformSuperAdminProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        if (!input.isActive) {
          const target = await db.getPlatformAdminById(input.id);
          if (target?.role === 'superadmin') {
            const count = await db.countActivePlatformAdmins();
            if (count <= 1) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é possível desativar o único superadmin ativo.' });
            }
          }
        }
        await db.setPlatformAdminStatus(input.id, input.isActive);
        return { success: true };
      }),

    // Altera role — apenas superadmin; bloqueia rebaixamento do último superadmin
    setRole: platformSuperAdminProcedure
      .input(z.object({ id: z.number(), role: z.enum(['superadmin', 'admin', 'support']) }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        if (ctx.platformAdmin!.id === input.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não pode alterar o próprio role.' });
        }
        if (input.role !== 'superadmin') {
          const target = await db.getPlatformAdminById(input.id);
          if (target?.role === 'superadmin') {
            const count = await db.countActivePlatformAdmins();
            if (count <= 1) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é possível rebaixar o único superadmin ativo.' });
            }
          }
        }
        await db.setPlatformAdminRole(input.id, input.role);
        return { success: true };
      }),

    // Deleta — apenas superadmin; bloqueia deleção do último superadmin
    delete: platformSuperAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        if (ctx.platformAdmin!.id === input.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não pode deletar a própria conta.' });
        }
        const target = await db.getPlatformAdminById(input.id);
        if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Administrador não encontrado.' });
        if (target.role === 'superadmin') {
          const count = await db.countActivePlatformAdmins();
          if (count <= 1) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é possível deletar o único superadmin ativo.' });
          }
        }
        await db.deletePlatformAdmin(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // Plans & Billing Router (Platform Admin)
  // ============================================
  plans: router({
    list: platformAdminProcedure.query(async () => {
      return await db.getAllPlanDefinitions();
    }),
    listPublic: publicProcedure.query(async () => {
      return await db.getActivePlanDefinitions();
    }),
    getById: platformAdminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }: { input: any }) => {
        const plan = await db.getPlanDefinitionById(input.id);
        if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plano não encontrado' });
        return plan;
      }),
    create: platformAdminProcedure
      .input(z.object({
        slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
        name: z.string().min(2).max(100),
        description: z.string().optional(),
        maxUsers: z.number().int().min(1).default(5),
        maxClients: z.number().int().min(1).default(100),
        maxStorageGB: z.number().int().min(1).default(10),
        featureWorkflowCR: z.boolean().default(true),
        featureApostilamento: z.boolean().default(false),
        featureRenovacao: z.boolean().default(false),
        featureInsumos: z.boolean().default(false),
        featureIAT: z.boolean().default(false),
        priceMonthlyBRL: z.number().int().min(0).default(0),
        priceYearlyBRL: z.number().int().min(0).default(0),
        setupFeeBRL: z.number().int().min(0).default(0),
        trialDays: z.number().int().min(0).default(14),
        displayOrder: z.number().int().default(0),
        isPublic: z.boolean().default(true),
        highlightLabel: z.string().max(50).optional(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const existing = await db.getPlanDefinitionBySlug(input.slug);
        if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um plano com este slug' });
        return await db.createPlanDefinition(input);
      }),
    update: platformAdminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).max(100).optional(),
        description: z.string().optional(),
        maxUsers: z.number().int().min(1).optional(),
        maxClients: z.number().int().min(1).optional(),
        maxStorageGB: z.number().int().min(1).optional(),
        featureWorkflowCR: z.boolean().optional(),
        featureApostilamento: z.boolean().optional(),
        featureRenovacao: z.boolean().optional(),
        featureInsumos: z.boolean().optional(),
        featureIAT: z.boolean().optional(),
        priceMonthlyBRL: z.number().int().min(0).optional(),
        priceYearlyBRL: z.number().int().min(0).optional(),
        setupFeeBRL: z.number().int().min(0).optional(),
        trialDays: z.number().int().min(0).optional(),
        displayOrder: z.number().int().optional(),
        isPublic: z.boolean().optional(),
        highlightLabel: z.string().max(50).nullable().optional(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const { id, ...updates } = input;
        await db.updatePlanDefinition(id, updates);
        return { success: true };
      }),
    delete: platformAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }: { input: any }) => {
        await db.deletePlanDefinition(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // Subscriptions Router (Platform Admin)
  // ============================================
  subscriptions: router({
    listByTenant: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }: { input: any }) => {
        return await db.getSubscriptionsByTenant(input.tenantId);
      }),
    getActive: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }: { input: any }) => {
        return await db.getActiveSubscription(input.tenantId);
      }),
    create: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        planId: z.number(),
        billingCycle: z.enum(["monthly", "yearly", "lifetime"]).default("monthly"),
        priceBRL: z.number().int().min(0),
        discountBRL: z.number().int().min(0).default(0),
        status: z.enum(["active", "trialing"]).default("active"),
        overrideMaxUsers: z.number().int().min(1).optional(),
        overrideMaxClients: z.number().int().min(1).optional(),
        overrideMaxStorageGB: z.number().int().min(1).optional(),
        paymentGateway: z.string().max(30).optional(),
        endDate: z.string().datetime().optional(),
      }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const plan = await db.getPlanDefinitionById(input.planId);
        if (!plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plano não encontrado' });
        const activeSub = await db.getActiveSubscription(input.tenantId);
        if (activeSub) {
          await db.updateSubscription(activeSub.id, { status: "cancelled", cancelledAt: new Date(), cancelReason: "Substituída por nova assinatura" });
        }
        const sub = await db.createSubscription({
          tenantId: input.tenantId, planId: input.planId, startDate: new Date(),
          endDate: input.endDate ? new Date(input.endDate) : null,
          billingCycle: input.billingCycle, priceBRL: input.priceBRL, discountBRL: input.discountBRL,
          status: input.status,
          overrideMaxUsers: input.overrideMaxUsers ?? null,
          overrideMaxClients: input.overrideMaxClients ?? null,
          overrideMaxStorageGB: input.overrideMaxStorageGB ?? null,
          paymentGateway: input.paymentGateway ?? null,
          createdBy: ctx.platformAdmin?.id ?? null,
        });
        await db.syncTenantFromSubscription(input.tenantId);
        return sub;
      }),
    cancel: platformAdminProcedure
      .input(z.object({ id: z.number(), tenantId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input }: { input: any }) => {
        await db.updateSubscription(input.id, { status: "cancelled", cancelledAt: new Date(), cancelReason: input.reason ?? "Cancelada pelo administrador" });
        await db.syncTenantFromSubscription(input.tenantId);
        return { success: true };
      }),
  }),

  // ============================================
  // Billing Router (Platform Admin)
  // ============================================
  billing: router({
    invoicesByTenant: platformAdminProcedure
      .input(z.object({ tenantId: z.number() }))
      .query(async ({ input }: { input: any }) => {
        return await db.getInvoicesByTenant(input.tenantId);
      }),
    allInvoices: platformAdminProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }: { input: any }) => {
        return await db.getAllInvoices(input?.status);
      }),
    createInvoice: platformAdminProcedure
      .input(z.object({
        tenantId: z.number(),
        subscriptionId: z.number().optional(),
        periodStart: z.string().datetime(),
        periodEnd: z.string().datetime(),
        subtotalBRL: z.number().int().min(0),
        discountBRL: z.number().int().min(0).default(0),
        totalBRL: z.number().int().min(0),
        dueDate: z.string().datetime(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        return await db.createInvoice({
          tenantId: input.tenantId, subscriptionId: input.subscriptionId ?? null,
          periodStart: new Date(input.periodStart), periodEnd: new Date(input.periodEnd),
          subtotalBRL: input.subtotalBRL, discountBRL: input.discountBRL, totalBRL: input.totalBRL,
          dueDate: new Date(input.dueDate), notes: input.notes ?? null,
        });
      }),
    markPaid: platformAdminProcedure
      .input(z.object({ invoiceId: z.number(), paymentMethod: z.string().max(30), paymentReference: z.string().max(255).optional() }))
      .mutation(async ({ input }: { input: any }) => {
        await db.markInvoicePaid(input.invoiceId, input.paymentMethod, input.paymentReference);
        return { success: true };
      }),
    metrics: platformAdminProcedure.query(async () => {
      const [mrr, tenantsByPlan] = await Promise.all([db.calculateMRR(), db.getTenantCountByPlan()]);
      return { mrrBRL: mrr, mrrFormatted: `R$ ${(mrr / 100).toFixed(2).replace('.', ',')}`, tenantsByPlan };
    }),
    usageHistory: platformAdminProcedure
      .input(z.object({ tenantId: z.number(), limit: z.number().int().min(1).max(365).default(30) }))
      .query(async ({ input }: { input: any }) => {
        return await db.getUsageSnapshotsByTenant(input.tenantId, input.limit);
      }),

    /** Detalhamento financeiro completo de um tenant */
    tenantDetail: platformAdminProcedure
      .input(z.object({ tenantId: z.number().int() }))
      .query(async ({ input }: { input: any }) => {
        const [tenant, subs, invs, allPlans] = await Promise.all([
          db.getTenantById(input.tenantId),
          db.getSubscriptionsByTenant(input.tenantId),
          db.getInvoicesByTenant(input.tenantId),
          db.getAllPlanDefinitions(),
        ]);
        const planMap = new Map(allPlans.map((p: any) => [p.id, p]));
        const now = Date.now();
        const enrichedSubs = subs.map((sub: any) => {
          const plan = planMap.get(sub.planId) as any;
          const start = new Date(sub.startDate).getTime();
          const end = sub.endDate ? new Date(sub.endDate).getTime() : now;
          const days = Math.max(0, Math.round((end - start) / 86_400_000));
          return {
            ...sub,
            planName: plan?.name ?? `Plano #${sub.planId}`,
            planSlug: plan?.slug ?? null,
            durationDays: days,
          };
        });
        const totalPaidBRL = invs
          .filter((i: any) => i.status === 'paid')
          .reduce((s: number, i: any) => s + (i.totalBRL ?? 0), 0);
        const hasOverdue = invs.some((i: any) => i.status === 'overdue');
        const clientSinceDays = tenant?.createdAt
          ? Math.round((now - new Date(tenant.createdAt).getTime()) / 86_400_000)
          : null;
        return {
          tenant: tenant ?? null,
          subscriptions: enrichedSubs,
          invoices: invs,
          totalPaidBRL,
          hasOverdue,
          isAdimplente: !hasOverdue,
          clientSinceDays,
        };
      }),

    // ── Planos de assinatura ──────────────────────────────────────────────────
    listPlans: platformAdminProcedure.query(async () => {
      return await db.getAllPlanDefinitions();
    }),

    createPlan: platformAdminProcedure
      .input(z.object({
        slug: z.string().min(1).max(50),
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        priceMonthlyBRL: z.number().int().min(0).default(0),
        priceYearlyBRL: z.number().int().min(0).default(0),
        maxUsers: z.number().int().min(1).default(5),
        maxClients: z.number().int().min(1).default(100),
        maxStorageGB: z.number().int().min(1).default(10),
        trialDays: z.number().int().min(0).default(14),
        isPublic: z.boolean().default(true),
        displayOrder: z.number().int().default(0),
      }))
      .mutation(async ({ input }: { input: any }) => {
        return await db.createPlanDefinition({
          slug: input.slug,
          name: input.name,
          description: input.description ?? null,
          priceMonthlyBRL: input.priceMonthlyBRL,
          priceYearlyBRL: input.priceYearlyBRL,
          maxUsers: input.maxUsers,
          maxClients: input.maxClients,
          maxStorageGB: input.maxStorageGB,
          trialDays: input.trialDays,
          isActive: true,
          isPublic: input.isPublic,
          displayOrder: input.displayOrder,
        });
      }),

    updatePlan: platformAdminProcedure
      .input(z.object({
        id: z.number().int(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        priceMonthlyBRL: z.number().int().min(0).optional(),
        priceYearlyBRL: z.number().int().min(0).optional(),
        maxUsers: z.number().int().min(1).optional(),
        maxClients: z.number().int().min(1).optional(),
        maxStorageGB: z.number().int().min(1).optional(),
        trialDays: z.number().int().min(0).optional(),
        isPublic: z.boolean().optional(),
        displayOrder: z.number().int().optional(),
      }))
      .mutation(async ({ input }: { input: any }) => {
        const { id, ...updates } = input;
        await db.updatePlanDefinition(id, updates);
        return { success: true };
      }),

    deletePlan: platformAdminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }: { input: any }) => {
        await db.deletePlanDefinition(input.id);
        return { success: true };
      }),
  }),

  // ── Triagem de documentos enviados pelo portal do cliente ──────────────────
  pendingDocuments: router({
    /** Lista documentos pendentes de triagem (filtrável por clientId) */
    list: protectedProcedure
      .input(z.object({ clientId: z.number().int().optional() }))
      .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        // ctx.db não existe no TrpcContext — usar getTenantDbOrNull com fallback à platform DB
        const tenantDb = await getTenantDbOrNull(ctx);
        const activeDb = tenantDb || await db.getDb();
        if (!activeDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        return await db.getPendingDocumentsForTriage(
          activeDb,
          input.clientId ?? null,
          ctx.tenant?.id ?? null
        );
      }),

    /** Aprova documento — notifica cliente por email */
    approve: protectedProcedure
      .input(z.object({ docId: z.number().int() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const activeDb = tenantDb || await db.getDb();
        if (!activeDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        await db.updatePendingDocumentStatus(activeDb, input.docId, "approved");
        notifyClientOfDocumentDecision(ctx, input.docId, "approved").catch(() => {});
        return { success: true };
      }),

    /** Rejeita documento com motivo opcional — notifica cliente */
    reject: protectedProcedure
      .input(z.object({ docId: z.number().int(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const activeDb = tenantDb || await db.getDb();
        if (!activeDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
        await db.updatePendingDocumentStatus(activeDb, input.docId, "rejected", {
          rejectionReason: input.reason,
        });
        notifyClientOfDocumentDecision(ctx, input.docId, "rejected", input.reason).catch(() => {});
        return { success: true };
      }),

    /** Vincula documento a uma subTarefa existente (insere na juntada oficial) */
    linkToSubTask: protectedProcedure
      .input(z.object({
        docId: z.number().int(),
        subTaskId: z.number().int(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
        const tenantDb = await getTenantDbOrNull(ctx);
        const activeDb = tenantDb || await db.getDb();
        if (!activeDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

        // Buscar dados do documento pendente
        const docRows = await db.getPendingDocumentsForTriage(activeDb, undefined, undefined);
        const doc = docRows.find((d: any) => d.id === input.docId);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });

        // Inserir na juntada oficial
        await activeDb.execute(sql`
          INSERT INTO "documents" ("subTaskId", "clientId", "fileName", "fileUrl", "mimeType", "fileSize", "uploadedAt")
          VALUES (${input.subTaskId}, ${doc.clientId}, ${input.fileName}, ${doc.fileUrl},
                  ${doc.mimeType ?? null}, ${doc.fileSize ?? null}, now())
        `);

        // Marcar como vinculado
        await db.updatePendingDocumentStatus(activeDb, input.docId, "linked", {
          linkedSubTaskId: input.subTaskId,
        });

        return { success: true };
      }),
  }),
});

/** Notifica cliente sobre decisão de triagem do documento */
async function notifyClientOfDocumentDecision(
  ctx: TrpcContext,
  docId: number,
  decision: "approved" | "rejected",
  reason?: string
): Promise<void> {
  try {
    const tenantDb = await getTenantDbOrNull(ctx);
    const activeDb = tenantDb || await db.getDb();
    if (!activeDb) return;
    const docRows = await activeDb.execute(sql`
      SELECT pd.*, c.name AS "clientName", c.email AS "clientEmail", pd."fileName"
      FROM "clientPendingDocuments" pd
      INNER JOIN "clients" c ON c.id = pd."clientId"
      WHERE pd.id = ${docId} LIMIT 1
    `);
    const arr = Array.isArray(docRows) ? docRows : (docRows as any).rows ?? [];
    if (!arr[0]?.clientEmail) return;
    const { clientName, clientEmail, fileName } = arr[0];
    const isApproved = decision === "approved";
    await sendEmail({
      to: clientEmail,
      subject: isApproved ? `[CAC 360] Documento aprovado!` : `[CAC 360] Documento não aprovado`,
      html: isApproved
        ? `<div style="font-family:sans-serif;max-width:600px">
            <h3 style="color:#16a34a">Documento aprovado! ✓</h3>
            <p>Olá <strong>${clientName}</strong>,</p>
            <p>Seu documento <strong>${fileName ?? ""}</strong> foi aprovado pela equipe do clube.</p>
            <p style="color:#888;font-size:12px">CAC 360 — notificação automática</p>
          </div>`
        : `<div style="font-family:sans-serif;max-width:600px">
            <h3 style="color:#dc2626">Documento não aprovado</h3>
            <p>Olá <strong>${clientName}</strong>,</p>
            <p>Seu documento <strong>${fileName ?? ""}</strong> não foi aprovado.</p>
            ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ""}
            <p>Acesse o portal e envie o documento corrigido.</p>
            <p style="color:#888;font-size:12px">CAC 360 — notificação automática</p>
          </div>`,
    } as any).catch((e: any) => console.error("[PendingDocs] Email cliente:", e));
  } catch (e) {
    console.error("[PendingDocs] notifyClientOfDocumentDecision:", e);
  }
}

export type AppRouter = typeof appRouter;



