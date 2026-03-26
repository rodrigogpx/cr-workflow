import { z } from "zod";
import { router, adminProcedure, iatProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getTenantDb } from "../config/tenant.config";
import { getDb } from "../db";
import { iatInstructors, iatCourses, iatExams, iatSchedules, iatCourseClasses, iatClassEnrollments, clients } from "../../drizzle/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";

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
  list: iatProcedure.query(async ({ ctx }) => {
    const db = await getIatDb(ctx);
    const tenantId = getTenantId(ctx);
    return db
      .select()
      .from(iatInstructors)
      .where(eq(iatInstructors.tenantId, tenantId))
      .orderBy(iatInstructors.name);
  }),

  get: iatProcedure
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
  list: iatProcedure.query(async ({ ctx }) => {
    const db = await getIatDb(ctx);
    const tenantId = getTenantId(ctx);
    return db
      .select()
      .from(iatCourses)
      .where(eq(iatCourses.tenantId, tenantId))
      .orderBy(iatCourses.title);
  }),

  get: iatProcedure
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
        institutionName: z.string().optional(),
        completionDate: z.string().optional(),
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
          institutionName: input.institutionName ?? null,
          completionDate: input.completionDate ? new Date(input.completionDate) : null,
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
        institutionName: z.string().optional(),
        completionDate: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const { id, completionDate, ...rest } = input;
      const [updated] = await db
        .update(iatCourses)
        .set({
          ...rest,
          ...(completionDate !== undefined ? { completionDate: completionDate ? new Date(completionDate) : null } : {}),
          updatedAt: new Date(),
        })
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
  list: iatProcedure
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

  get: iatProcedure
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

// ─── Schedules ────────────────────────────────────────────────────────────────

const scheduleRouter = router({
  list: iatProcedure.query(async ({ ctx }) => {
    const db = await getIatDb(ctx);
    const tenantId = getTenantId(ctx);
    return db
      .select()
      .from(iatSchedules)
      .where(eq(iatSchedules.tenantId, tenantId))
      .orderBy(desc(iatSchedules.scheduledDate));
  }),

  create: adminProcedure
    .input(
      z.object({
        scheduleType: z.enum(["curso", "exame"]),
        title: z.string().min(1),
        scheduledDate: z.string().min(1),
        scheduledTime: z.string().optional(),
        location: z.string().optional(),
        instructorId: z.number().optional(),
        courseId: z.number().optional(),
        examId: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [created] = await db
        .insert(iatSchedules)
        .values({
          tenantId,
          scheduleType: input.scheduleType,
          title: input.title,
          scheduledDate: new Date(input.scheduledDate),
          scheduledTime: input.scheduledTime ?? null,
          location: input.location ?? null,
          instructorId: input.instructorId ?? null,
          courseId: input.courseId ?? null,
          examId: input.examId ?? null,
          notes: input.notes ?? null,
          status: "agendado",
        })
        .returning();
      return created;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        scheduledDate: z.string().optional(),
        scheduledTime: z.string().optional(),
        location: z.string().optional(),
        instructorId: z.number().optional(),
        courseId: z.number().optional(),
        notes: z.string().optional(),
        status: z.enum(["agendado", "realizado", "cancelado"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const { id, scheduledDate, ...rest } = input;
      const [updated] = await db
        .update(iatSchedules)
        .set({
          ...rest,
          ...(scheduledDate ? { scheduledDate: new Date(scheduledDate) } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(iatSchedules.id, id), eq(iatSchedules.tenantId, tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado" });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      await db
        .delete(iatSchedules)
        .where(and(eq(iatSchedules.id, input.id), eq(iatSchedules.tenantId, tenantId)));
      return { success: true };
    }),
});

// ─── Classes (Turmas) ────────────────────────────────────────────────────────

const classRouter = router({
  list: iatProcedure
    .input(z.object({ courseId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const conditions = [eq(iatCourseClasses.tenantId, tenantId)];
      if (input?.courseId) conditions.push(eq(iatCourseClasses.courseId, input.courseId));

      const classes = await db
        .select()
        .from(iatCourseClasses)
        .where(and(...conditions))
        .orderBy(desc(iatCourseClasses.scheduledDate));

      // Add enrollment count for each class
      const result = [];
      for (const cls of classes) {
        const [enrollmentCount] = await db
          .select({ count: count() })
          .from(iatClassEnrollments)
          .where(and(
            eq(iatClassEnrollments.classId, cls.id),
            eq(iatClassEnrollments.tenantId, tenantId)
          ));
        result.push({ ...cls, enrolledCount: enrollmentCount?.count ?? 0 });
      }
      return result;
    }),

  get: iatProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [row] = await db
        .select()
        .from(iatCourseClasses)
        .where(and(eq(iatCourseClasses.id, input.id), eq(iatCourseClasses.tenantId, tenantId)));
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return row;
    }),

  create: adminProcedure
    .input(z.object({
      courseId: z.number(),
      instructorId: z.number().optional(),
      classNumber: z.string().optional(),
      title: z.string().optional(),
      scheduledDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      location: z.string().optional(),
      maxStudents: z.number().int().min(1).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const [created] = await db
        .insert(iatCourseClasses)
        .values({
          tenantId,
          courseId: input.courseId,
          instructorId: input.instructorId ?? null,
          classNumber: input.classNumber ?? null,
          title: input.title ?? null,
          scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
          scheduledTime: input.scheduledTime ?? null,
          location: input.location ?? null,
          maxStudents: input.maxStudents ?? null,
          notes: input.notes ?? null,
          status: "agendada",
        })
        .returning();
      return created;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      instructorId: z.number().optional(),
      classNumber: z.string().optional(),
      title: z.string().optional(),
      scheduledDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      location: z.string().optional(),
      maxStudents: z.number().int().min(1).optional(),
      notes: z.string().optional(),
      status: z.enum(["agendada", "em_andamento", "concluida", "cancelada"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const { id, scheduledDate, ...rest } = input;
      const [updated] = await db
        .update(iatCourseClasses)
        .set({
          ...rest,
          ...(scheduledDate !== undefined ? { scheduledDate: scheduledDate ? new Date(scheduledDate) : null } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(iatCourseClasses.id, id), eq(iatCourseClasses.tenantId, tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      // Delete enrollments first
      await db.delete(iatClassEnrollments)
        .where(and(eq(iatClassEnrollments.classId, input.id), eq(iatClassEnrollments.tenantId, tenantId)));
      await db.delete(iatCourseClasses)
        .where(and(eq(iatCourseClasses.id, input.id), eq(iatCourseClasses.tenantId, tenantId)));
      return { success: true };
    }),
});

// ─── Enrollments (Matrículas) ────────────────────────────────────────────────

const enrollmentRouter = router({
  list: iatProcedure
    .input(z.object({ classId: z.number().optional(), clientId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const conditions = [eq(iatClassEnrollments.tenantId, tenantId)];
      if (input?.classId) conditions.push(eq(iatClassEnrollments.classId, input.classId));
      if (input?.clientId) conditions.push(eq(iatClassEnrollments.clientId, input.clientId));

      const enrollments = await db
        .select({
          enrollment: iatClassEnrollments,
          clientName: clients.name,
          clientCpf: clients.cpf,
          clientEmail: clients.email,
          clientPhone: clients.phone,
        })
        .from(iatClassEnrollments)
        .leftJoin(clients, eq(iatClassEnrollments.clientId, clients.id))
        .where(and(...conditions))
        .orderBy(desc(iatClassEnrollments.enrolledAt));

      return enrollments.map(e => ({
        ...e.enrollment,
        clientName: e.clientName,
        clientCpf: e.clientCpf,
        clientEmail: e.clientEmail,
        clientPhone: e.clientPhone,
      }));
    }),

  enroll: adminProcedure
    .input(z.object({
      classId: z.number(),
      clientIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);

      // Check class exists
      const [cls] = await db.select().from(iatCourseClasses)
        .where(and(eq(iatCourseClasses.id, input.classId), eq(iatCourseClasses.tenantId, tenantId)));
      if (!cls) throw new TRPCError({ code: "NOT_FOUND", message: "Turma não encontrada" });

      // Check maxStudents
      if (cls.maxStudents) {
        const [current] = await db.select({ count: count() }).from(iatClassEnrollments)
          .where(and(eq(iatClassEnrollments.classId, input.classId), eq(iatClassEnrollments.tenantId, tenantId)));
        const currentCount = current?.count ?? 0;
        if (currentCount + input.clientIds.length > cls.maxStudents) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Limite de vagas excedido. Vagas disponíveis: ${cls.maxStudents - currentCount}`,
          });
        }
      }

      // Insert enrollments (skip duplicates)
      const inserted = [];
      for (const clientId of input.clientIds) {
        // Check if already enrolled
        const [existing] = await db.select({ id: iatClassEnrollments.id }).from(iatClassEnrollments)
          .where(and(
            eq(iatClassEnrollments.classId, input.classId),
            eq(iatClassEnrollments.clientId, clientId),
            eq(iatClassEnrollments.tenantId, tenantId),
          ));
        if (existing) continue;

        const [row] = await db.insert(iatClassEnrollments).values({
          tenantId,
          classId: input.classId,
          clientId,
          status: "inscrito",
        }).returning();
        inserted.push(row);
      }
      return { inserted: inserted.length, skipped: input.clientIds.length - inserted.length };
    }),

  updateStatus: adminProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["inscrito", "confirmado", "concluido", "cancelado"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      const setData: any = { status: input.status, updatedAt: new Date() };
      if (input.status === "concluido") setData.completedAt = new Date();
      const [updated] = await db.update(iatClassEnrollments)
        .set(setData)
        .where(and(eq(iatClassEnrollments.id, input.id), eq(iatClassEnrollments.tenantId, tenantId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Matrícula não encontrada" });
      return updated;
    }),

  remove: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getIatDb(ctx);
      const tenantId = getTenantId(ctx);
      await db.delete(iatClassEnrollments)
        .where(and(eq(iatClassEnrollments.id, input.id), eq(iatClassEnrollments.tenantId, tenantId)));
      return { success: true };
    }),
});

// ─── IAT Root Router ─────────────────────────────────────────────────────────

export const iatRouter = router({
  instructors: instructorRouter,
  courses: courseRouter,
  exams: examRouter,
  schedules: scheduleRouter,
  classes: classRouter,
  enrollments: enrollmentRouter,
});
