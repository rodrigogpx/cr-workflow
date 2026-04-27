/**
 * Cron Jobs de Billing — CAC 360
 *
 * Jobs agendados para gestão financeira da plataforma:
 *  - Geração automática de faturas (diário 9h)
 *  - Alertas de vencimento próximo (7 dias) (diário 9h)
 *  - Suspensão de tenants inadimplentes (diário 10h)
 *
 * Todos os timers usam .unref() para não impedir o shutdown gracioso.
 */

import {
  getActiveSubscriptionsDueSoon,
  getExpiredSubscriptions,
  createInvoiceIfNotExists,
  suspendTenantSubscription,
  getTenantAdmin,
  getTenantById,
} from "./db";
import { sendEmail } from "./emailService";

/** Retorna quantos ms faltam até o próximo HH:MM do dia (amanhã se já passou) */
function nextRunMs(hour: number, minute = 0): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────
// Job diário 9h — gerar faturas + alertas de vencimento
// ─────────────────────────────────────────────────────────
async function runDailyJob(): Promise<void> {
  console.log("[Cron] Iniciando job diário de billing...");
  const now = new Date();
  const periodRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  try {
    // Buscar subscriptions que vencem em 7, 15 e 30 dias (em paralelo)
    const [due7, due15, due30] = await Promise.all([
      getActiveSubscriptionsDueSoon(7),
      getActiveSubscriptionsDueSoon(15),
      getActiveSubscriptionsDueSoon(30),
    ]);

    // Gerar faturas para todas as subscriptions que vencem em até 30 dias
    for (const sub of due30) {
      const tenantId: number = sub.tenantId ?? sub.tenantIdVal;
      const created = await createInvoiceIfNotExists(
        tenantId,
        sub.id,
        periodRef,
        sub.amountCents ?? 0
      );
      if (created) {
        console.log(`[Cron] Fatura criada — tenant=${tenantId} sub=${sub.id}`);
      }
    }

    // Alertas de 7 dias (email para o admin do tenant)
    for (const sub of due7) {
      const tenantId: number = sub.tenantId ?? sub.tenantIdVal;
      const [tenant, admin] = await Promise.all([
        getTenantById(tenantId),
        getTenantAdmin(tenantId),
      ]);
      if (!admin?.email) continue;

      await sendEmail({
        to: admin.email,
        subject: `[CAC 360] Assinatura vence em 7 dias`,
        html: `<div style="font-family:sans-serif;max-width:600px">
          <h3 style="color:#123A63">Renovação da assinatura</h3>
          <p>Olá <strong>${admin.name ?? ""}</strong>,</p>
          <p>A assinatura do clube <strong>${tenant?.name ?? ""}</strong>
             vence em <strong>7 dias</strong>.</p>
          <p>Acesse o painel financeiro para regularizar o pagamento e evitar interrupção do serviço.</p>
          <p style="color:#888;font-size:12px">CAC 360 — notificação automática</p>
        </div>`,
      } as any).catch((e: any) =>
        console.error("[Cron] Falha email alerta 7d:", e)
      );
    }

    // Log do resumo
    console.log(
      `[Cron] Job diário concluído — faturas geradas para ${due30.length} subscription(s), ${due7.length} alerta(s) de 7d enviado(s).`
    );
  } catch (err) {
    console.error("[Cron] Erro no job diário:", err);
  }
}

// ─────────────────────────────────────────────────────────
// Job diário 10h — suspender tenants inadimplentes
// ─────────────────────────────────────────────────────────
async function runSuspensionJob(): Promise<void> {
  console.log("[Cron] Verificando subscriptions expiradas...");
  try {
    const expired = await getExpiredSubscriptions();

    for (const sub of expired) {
      const tenantId: number = sub.tenantId ?? sub.tenantIdVal;
      await suspendTenantSubscription(tenantId, sub.id);

      const admin = await getTenantAdmin(tenantId);
      if (admin?.email) {
        await sendEmail({
          to: admin.email,
          subject: `[CAC 360] Acesso suspenso — pagamento pendente`,
          html: `<div style="font-family:sans-serif;max-width:600px">
            <h3 style="color:#dc2626">Acesso suspenso</h3>
            <p>Olá <strong>${admin.name ?? ""}</strong>,</p>
            <p>O acesso do clube foi suspenso por inadimplência.</p>
            <p>Entre em contato com nosso suporte para regularizar e reativar o acesso.</p>
            <p style="color:#888;font-size:12px">CAC 360 — notificação automática</p>
          </div>`,
        } as any).catch((e: any) =>
          console.error("[Cron] Falha email suspensão:", e)
        );
      }

      console.log(`[Cron] Tenant suspenso — id=${tenantId} sub=${sub.id}`);
    }

    console.log(
      `[Cron] Job de suspensão concluído — ${expired.length} tenant(s) processado(s).`
    );
  } catch (err) {
    console.error("[Cron] Erro no job de suspensão:", err);
  }
}

// ─────────────────────────────────────────────────────────
// Exportação principal
// ─────────────────────────────────────────────────────────
export function startCronJobs(): void {
  // Job diário às 9h — geração de faturas e alertas
  setTimeout(function scheduleDaily() {
    runDailyJob().catch(console.error);
    setTimeout(scheduleDaily, DAY_MS).unref();
  }, nextRunMs(9)).unref();

  // Job diário às 10h — suspensão de inadimplentes
  setTimeout(function scheduleSuspension() {
    runSuspensionJob().catch(console.error);
    setTimeout(scheduleSuspension, DAY_MS).unref();
  }, nextRunMs(10)).unref();

  console.log("[Cron] Jobs de billing agendados (9h faturas, 10h suspensão).");
}

/** Permite execução manual via admin panel */
export async function runDailyJobNow(): Promise<void> {
  return runDailyJob();
}
export async function runSuspensionJobNow(): Promise<void> {
  return runSuspensionJob();
}
