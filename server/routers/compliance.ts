import { router, strictTenantProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { complianceDocuments, complianceAlerts } from "../../drizzle/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export const complianceRouter = router({
  // Documentos
  getDocuments: strictTenantProcedure
    .input(
      z.object({
        clientId: z.number().optional(),
        documentType: z.string().optional(),
        status: z.string().optional(),
        expiringBefore: z.string().optional(),
        expiringAfter: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não encontrado",
        });
      }
      return db.getComplianceDocuments(ctx.tenantDb, tenantId, input);
    }),

  getDocumentById: strictTenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não encontrado",
        });
      }
      return db.getComplianceDocumentById(ctx.tenantDb, tenantId, input.id);
    }),

  createDocument: strictTenantProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não encontrado",
        });
      }
      return db.createComplianceDocument(ctx.tenantDb, { ...input, tenantId });
    }),

  updateDocument: strictTenantProcedure
    .input(
      z.object({
        id: z.number(),
        documentNumber: z.string().optional(),
        issueDate: z.string().optional(),
        expiryDate: z.string().optional(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
        notes: z.string().optional(),
        status: z.string().optional(),
        notificationDays: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não encontrado",
        });
      }
      const { id, ...data } = input;
      return db.updateComplianceDocument(ctx.tenantDb, id, data, tenantId);
    }),

  deleteDocument: strictTenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não encontrado",
        });
      }
      return db.deleteComplianceDocument(ctx.tenantDb, input.id, tenantId);
    }),

  markAsRenewed: strictTenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não encontrado",
        });
      }
      return db.markComplianceDocumentAsRenewed(
        ctx.tenantDb,
        input.id,
        tenantId
      );
    }),

  // Dashboard stats
  getDashboardStats: strictTenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenant?.id;
    if (!tenantId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Tenant não encontrado",
      });
    }
    return db.getComplianceDashboardStats(ctx.tenantDb, tenantId);
  }),

  // Expiring documents
  getExpiringSoon: strictTenantProcedure
    .input(z.object({ daysThreshold: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não encontrado",
        });
      }
      return db.getExpiringComplianceDocuments(
        ctx.tenantDb,
        tenantId,
        input.daysThreshold
      );
    }),

  // Alerts
  getAlerts: strictTenantProcedure
    .input(
      z.object({
        documentId: z.number().optional(),
        clientId: z.number().optional(),
        alertType: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não identificado",
        });
      return await db.getComplianceAlerts(ctx.tenantDb, tenantId, input);
    }),

  markAlertAsOpened: strictTenantProcedure
    .input(z.object({ alertId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.tenant?.id;
      if (!tenantId)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Tenant não identificado",
        });
      await db.markComplianceAlertAsOpened(
        ctx.tenantDb,
        input.alertId,
        tenantId
      );
      return { success: true };
    }),
});
