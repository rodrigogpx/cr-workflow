import { z } from "zod";
import { router, tenantProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getTenantDb } from "../config/tenant.config";
import { getDb } from "../db";
import { iatInstructors, iatCourses, iatExams } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

async function getIatDb(ctx: any) {
  if (ctx?.tenantSlug && ctx?.tenant) {
    const tenantDb = await getTenantDb(ctx.tenant);
    if (!tenantDb) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Banco do tenant indisponível" });
    }
    return tenantDb;
  }
  return await getDb();
}

function getTenantId(ctx: any): number {
  return ctx?.tenant?.id ?? 0;
}

// ─── Instructors ─────────────────────────────────────────────────────────────

const instructorRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = await getIatDb(ctx);
    const tenantId = getTenantId(ctx);
    return db
      .select()
      .from(iatInstructors)
      .where(eq(iatInstructors.tenantId, tenantId))
      .orderBy(iatInstructors.name);
  }),

  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [row] = await db
        .select()
        .from(iatInstructors)
        .where(and(eq(iatInstructors.id, input.id), eq(iatInstructors.tenantId, tenantId)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Instrutor não encontrado" });
      return row;
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        cpf: z.string().optional(),
        crNumber: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        isPfAccredited: z.boolean().default(false),
        pfAccreditationNumber: z.string().optional(),
        signatureImage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [created] = await db
        .insert(iatInstructors)
        .values({
          tenantId,
          name: input.name,
          cpf: input.cpf ?? null,
          crNumber: input.crNumber ?? null,
          phone: input.phone ?? null,
          email: input.email || null,
          isPfAccredited: input.isPfAccredited,
          pfAccreditationNumber: input.pfAccreditationNumber ?? null,
          signatureImage: input.signatureImage ?? null,
          isActive: true,
        })
        .returning();
      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        cpf: z.string().optional(),
        crNumber: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        isPfAccredited: z.boolean().optional(),
        pfAccreditationNumber: z.string().optional(),
        signatureImage: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const { id, ...rest } = input;
      const [updated] = await db
        .update(iatInstructors)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(iatInstructors.id, id), eq(iatInstructors.tenantId, tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Instrutor não encontrado" });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      await db
        .delete(iatInstructors)
        .where(and(eq(iatInstructors.id, input.id), eq(iatInstructors.tenantId, tenantId)));
      return { success: true };
    }),
});

// ─── Courses ─────────────────────────────────────────────────────────────────

const courseRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const db = await getIatDb(ctx);
    const tenantId = getTenantId(ctx);
    return db
      .select()
      .from(iatCourses)
      .where(eq(iatCourses.tenantId, tenantId))
      .orderBy(iatCourses.title);
  }),

  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [row] = await db
        .select()
        .from(iatCourses)
        .where(and(eq(iatCourses.id, input.id), eq(iatCourses.tenantId, tenantId)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Curso não encontrado" });
      return row;
    }),

  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        workloadHours: z.number().int().min(0).default(0),
        courseType: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [created] = await db
        .insert(iatCourses)
        .values({
          tenantId,
          title: input.title,
          description: input.description ?? null,
          workloadHours: input.workloadHours,
          courseType: input.courseType,
          isActive: true,
        })
        .returning();
      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        workloadHours: z.number().int().min(0).optional(),
        courseType: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const { id, ...rest } = input;
      const [updated] = await db
        .update(iatCourses)
        .set({ ...rest, updatedAt: new Date() })
        .where(and(eq(iatCourses.id, id), eq(iatCourses.tenantId, tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Curso não encontrado" });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      await db
        .delete(iatCourses)
        .where(and(eq(iatCourses.id, input.id), eq(iatCourses.tenantId, tenantId)));
      return { success: true };
    }),
});

// ─── Exams ───────────────────────────────────────────────────────────────────

const examRouter = router({
  list: tenantProcedure
    .input(z.object({ clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const conditions = [eq(iatExams.tenantId, tenantId)];
      if (input?.clientId) conditions.push(eq(iatExams.clientId, input.clientId));
      return db
        .select()
        .from(iatExams)
        .where(and(...conditions))
        .orderBy(desc(iatExams.createdAt));
    }),

  get: tenantProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [row] = await db
        .select()
        .from(iatExams)
        .where(and(eq(iatExams.id, input.id), eq(iatExams.tenantId, tenantId)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Exame não encontrado" });
      return row;
    }),

  create: adminProcedure
    .input(
      z.object({
        clientId: z.number(),
        instructorId: z.number(),
        courseId: z.number().optional(),
        scheduledDate: z.string().optional(),
        examType: z.string().min(1),
        weaponType: z.string().optional(),
        observations: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [created] = await db
        .insert(iatExams)
        .values({
          tenantId,
          clientId: input.clientId,
          instructorId: input.instructorId,
          courseId: input.courseId ?? null,
          scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
          examType: input.examType,
          status: "agendado",
          weaponType: input.weaponType ?? null,
          observations: input.observations ?? null,
        })
        .returning();
      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        instructorId: z.number().optional(),
        courseId: z.number().optional(),
        scheduledDate: z.string().optional(),
        examType: z.string().optional(),
        status: z.enum(["agendado", "realizado", "aprovado", "reprovado", "cancelado"]).optional(),
        weaponType: z.string().optional(),
        score: z.string().optional(),
        observations: z.string().optional(),
        laudoPdfUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const { id, scheduledDate, ...rest } = input;
      const [updated] = await db
        .update(iatExams)
        .set({
          ...rest,
          ...(scheduledDate !== undefined ? { scheduledDate: new Date(scheduledDate) } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(iatExams.id, id), eq(iatExams.tenantId, tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Exame não encontrado" });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      await db
        .delete(iatExams)
        .where(and(eq(iatExams.id, input.id), eq(iatExams.tenantId, tenantId)));
      return { success: true };
    }),
});

// ─── IAT Root Router ─────────────────────────────────────────────────────────

export const iatRouter = router({
  instructors: instructorRouter,
  courses: courseRouter,
  exams: examRouter,
});
