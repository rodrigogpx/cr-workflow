import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../_core/context";
import { getTenantDbOrNull } from "../config/tenant.config";

export const complianceRouter = router({
  // Documentos
  getDocuments: protectedProcedure
    .input(z.object({
      clientId: z.number().optional(),
      documentType: z.string().optional(),
      status: z.string().optional(),
      expiringBefore: z.string().optional(),
      expiringAfter: z.string().optional(),
    }))
    .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não identificado' });
      
      if (tenantDb) {
        return await db.getComplianceDocuments(tenantDb, tenantId, input);
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      return await db.getComplianceDocuments(mainDb, tenantId, input);
    }),

  getDocumentById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      
      if (tenantDb) {
        return await db.getComplianceDocumentById(tenantDb, input.id, tenantId);
      }
      const mainDb = await db.getDb();
      if (!mainDb) return null;
      return await db.getComplianceDocumentById(mainDb, input.id, tenantId);
    }),

  createDocument: protectedProcedure
    .input(z.object({
      clientId: z.number(),
      documentType: z.string(),
      documentNumber: z.string().optional(),
      issueDate: z.string().optional(),
      expiryDate: z.string(),
      sourceModule: z.string().optional(),
      sourceId: z.number().optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      notes: z.string().optional(),
      notificationDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não identificado' });
      
      if (tenantDb) {
        return await db.createComplianceDocument(tenantDb, { ...input, tenantId });
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      return await db.createComplianceDocument(mainDb, { ...input, tenantId });
    }),

  updateDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
      documentNumber: z.string().optional(),
      issueDate: z.string().optional(),
      expiryDate: z.string().optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      notes: z.string().optional(),
      status: z.string().optional(),
      notificationDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      const { id, ...data } = input;
      
      if (tenantDb) {
        await db.updateComplianceDocument(tenantDb, id, data, tenantId);
        return { success: true };
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      await db.updateComplianceDocument(mainDb, id, data, tenantId);
      return { success: true };
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      
      if (tenantDb) {
        await db.deleteComplianceDocument(tenantDb, input.id, tenantId);
        return { success: true };
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      await db.deleteComplianceDocument(mainDb, input.id, tenantId);
      return { success: true };
    }),

  markAsRenewed: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      
      if (tenantDb) {
        await db.markComplianceDocumentAsRenewed(tenantDb, input.id, tenantId);
        return { success: true };
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      await db.markComplianceDocumentAsRenewed(mainDb, input.id, tenantId);
      return { success: true };
    }),

  // Dashboard stats
  getDashboardStats: protectedProcedure
    .query(async ({ ctx }: { ctx: TrpcContext }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não identificado' });
      
      if (tenantDb) {
        return await db.getComplianceDashboardStats(tenantDb, tenantId);
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      return await db.getComplianceDashboardStats(mainDb, tenantId);
    }),

  // Expiring documents
  getExpiringSoon: protectedProcedure
    .input(z.object({ daysThreshold: z.number().default(30) }))
    .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não identificado' });
      
      if (tenantDb) {
        return await db.getExpiringComplianceDocuments(tenantDb, tenantId, input.daysThreshold);
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      return await db.getExpiringComplianceDocuments(mainDb, tenantId, input.daysThreshold);
    }),

  // Alerts
  getAlerts: protectedProcedure
    .input(z.object({
      documentId: z.number().optional(),
      clientId: z.number().optional(),
      alertType: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      if (!tenantId) throw new TRPCError({ code: 'FORBIDDEN', message: 'Tenant não identificado' });
      
      if (tenantDb) {
        return await db.getComplianceAlerts(tenantDb, tenantId, input);
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      return await db.getComplianceAlerts(mainDb, tenantId, input);
    }),

  markAlertAsOpened: protectedProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }: { ctx: TrpcContext; input: any }) => {
      const tenantDb = await getTenantDbOrNull(ctx);
      const tenantId = ctx.tenant?.id;
      
      if (tenantDb) {
        await db.markComplianceAlertAsOpened(tenantDb, input.alertId, tenantId);
        return { success: true };
      }
      const mainDb = await db.getDb();
      if (!mainDb) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Banco de dados não disponível' });
      await db.markComplianceAlertAsOpened(mainDb, input.alertId, tenantId);
      return { success: true };
    }),
});
