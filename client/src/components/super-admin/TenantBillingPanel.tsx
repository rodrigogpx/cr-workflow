import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CreditCard,
  Users,
  FolderOpen,
  HardDrive,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  Receipt,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { PlanChangeDialog } from "./PlanChangeDialog";
import { InvoiceCreateDialog } from "./InvoiceCreateDialog";

interface TenantBillingPanelProps {
  tenantId: number;
  tenantName: string;
}

function formatBRL(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  active: {
    label: "Ativa",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  trialing: {
    label: "Trial",
    color: "bg-blue-100 text-blue-700",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  past_due: {
    label: "Em Atraso",
    color: "bg-orange-100 text-orange-700",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: "Cancelada",
    color: "bg-red-100 text-red-700",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  expired: {
    label: "Expirada",
    color: "bg-gray-100 text-gray-600",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  pending: {
    label: "Pendente",
    color: "bg-yellow-100 text-yellow-700",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  paid: {
    label: "Paga",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  overdue: {
    label: "Vencida",
    color: "bg-red-100 text-red-700",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    color: "bg-gray-100 text-gray-600",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function UsageBar({
  label,
  current,
  max,
  unit = "",
}: {
  label: string;
  current: number;
  max: number;
  unit?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-orange-500" : "bg-indigo-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500 font-mono">
          {current}
          {unit} / {max}
          {unit}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 text-right">{pct}% usado</p>
    </div>
  );
}

function downloadInvoicePdf(inv: any, tenantName: string) {
  import("jspdf")
    .then(({ jsPDF }) => {
      const doc = new jsPDF();
      // Cabeçalho
      doc.setFontSize(22);
      doc.setTextColor(18, 58, 99); // #123A63
      doc.text("CAC 360", 20, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text("Comprovante de Fatura", 20, 30);
      // Linha divisória
      doc.setDrawColor(220);
      doc.line(20, 35, 190, 35);
      // Dados
      doc.setTextColor(40);
      doc.setFontSize(11);
      const rows = [
        ["Tenant / Clube", tenantName],
        [
          "Período",
          inv.periodRef ??
            `${inv.periodStart ?? "—"} – ${inv.periodEnd ?? "—"}`,
        ],
        [
          "Vencimento",
          inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("pt-BR") : "—",
        ],
        [
          "Valor",
          `R$ ${((inv.totalBRL ?? inv.amountCents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        ],
        [
          "Status",
          inv.status === "paid"
            ? "Pago"
            : inv.status === "pending"
              ? "Pendente"
              : inv.status,
        ],
        [
          "Pago em",
          inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("pt-BR") : "—",
        ],
      ];
      let y = 45;
      for (const [label, value] of rows) {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 22, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), 75, y);
        y += 10;
      }
      // Rodapé
      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text(
        `Gerado em ${new Date().toLocaleString("pt-BR")} · CAC 360`,
        20,
        280
      );
      doc.save(`fatura-${inv.id}-${inv.periodRef ?? "ref"}.pdf`);
    })
    .catch(() => {});
}

export function TenantBillingPanel({
  tenantId,
  tenantName,
}: TenantBillingPanelProps) {
  const utils = trpc.useUtils();
  const [showPlanChange, setShowPlanChange] = useState(false);
  const [showInvoiceCreate, setShowInvoiceCreate] = useState(false);

  const { data: activeSub, isLoading: subLoading } =
    trpc.subscriptions.getActive.useQuery({ tenantId });
  const { data: subs = [] } = trpc.subscriptions.listByTenant.useQuery({
    tenantId,
  });
  const { data: invoices = [], isLoading: invLoading } =
    trpc.billing.invoicesByTenant.useQuery({ tenantId });
  const { data: usageHistory = [] } = trpc.billing.usageHistory.useQuery({
    tenantId,
    limit: 90,
  });

  const cancelMutation = trpc.subscriptions.cancel.useMutation({
    onSuccess: () => {
      toast.success("Assinatura cancelada");
      utils.subscriptions.getActive.invalidate({ tenantId });
      utils.subscriptions.listByTenant.invalidate({ tenantId });
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const markPaidMutation = trpc.billing.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Fatura marcada como paga");
      utils.billing.invoicesByTenant.invalidate({ tenantId });
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const latestUsage = usageHistory[0];

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Assinatura Atual */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-indigo-600" />
              Assinatura Atual
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPlanChange(true)}
            >
              Alterar Plano
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeSub ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    Plan ID #{activeSub.planId}
                  </p>
                  <p className="text-sm text-gray-500">
                    {activeSub.billingCycle === "monthly"
                      ? "Mensal"
                      : activeSub.billingCycle === "yearly"
                        ? "Anual"
                        : "Vitalício"}
                    {" · "}
                    {formatBRL(activeSub.priceBRL - activeSub.discountBRL)}
                    /ciclo
                  </p>
                </div>
                <StatusBadge status={activeSub.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Início</p>
                  <p className="font-medium">
                    {formatDate(activeSub.startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Vencimento</p>
                  <p className="font-medium">{formatDate(activeSub.endDate)}</p>
                </div>
              </div>
              {activeSub.status !== "cancelled" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                  disabled={cancelMutation.isPending}
                  onClick={() => {
                    if (
                      confirm("Cancelar assinatura? O tenant será suspenso.")
                    ) {
                      cancelMutation.mutate({
                        id: activeSub.id,
                        tenantId,
                        reason: "Cancelada pelo admin",
                      });
                    }
                  }}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : null}
                  Cancelar Assinatura
                </Button>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p className="text-sm">Nenhuma assinatura ativa</p>
              <Button
                size="sm"
                className="mt-3 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setShowPlanChange(true)}
              >
                <Plus className="h-4 w-4 mr-1" /> Criar Assinatura
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uso Atual */}
      {latestUsage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Uso Atual
              <span className="text-xs text-gray-400 font-normal ml-1">
                (snapshot: {formatDate(latestUsage.snapshotDate)})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar
              label="Usuários"
              current={latestUsage.usersCount}
              max={activeSub?.overrideMaxUsers ?? 10}
            />
            <UsageBar
              label="Clientes"
              current={latestUsage.clientsCount}
              max={activeSub?.overrideMaxClients ?? 500}
            />
            <UsageBar
              label="Armazenamento"
              current={parseFloat(String(latestUsage.storageUsedGB))}
              max={activeSub?.overrideMaxStorageGB ?? 50}
              unit=" GB"
            />
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Uso Histórico (90 dias) */}
      {usageHistory.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Uso Histórico (90 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={[...usageHistory].reverse().map((s: any) => ({
                  data: new Date(s.snapshotDate).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                  }),
                  Usuários: s.usersCount ?? 0,
                  Clientes: s.clientsCount ?? 0,
                  "Storage (GB)": Number(
                    parseFloat(String(s.storageUsedGB ?? 0)).toFixed(2)
                  ),
                }))}
                margin={{ top: 5, right: 10, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="data"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="Usuários"
                  stroke="#123A63"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Clientes"
                  stroke="#F37321"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Storage (GB)"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Faturas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-indigo-600" />
              Faturas
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInvoiceCreate(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Nova Fatura
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Nenhuma fatura gerada
            </p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 10).map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {formatDate(inv.periodStart)} –{" "}
                      {formatDate(inv.periodEnd)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Venc. {formatDate(inv.dueDate)} ·{" "}
                      {formatBRL(inv.totalBRL)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <StatusBadge status={inv.status} />
                    {inv.status === "pending" || inv.status === "overdue" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-700 hover:bg-green-50 h-7 text-xs px-2"
                        disabled={markPaidMutation.isPending}
                        onClick={() =>
                          markPaidMutation.mutate({
                            invoiceId: inv.id,
                            paymentMethod: "manual",
                          })
                        }
                      >
                        Registrar Pgto
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs px-2 text-gray-500 hover:text-[#123A63]"
                      title="Baixar PDF"
                      onClick={() => downloadInvoicePdf(inv, tenantName)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {invoices.length > 10 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  + {invoices.length - 10} faturas anteriores
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Assinaturas */}
      {subs.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-gray-700">
              Histórico de Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subs.slice(0, 5).map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="text-sm">
                    <span className="font-medium">Plano #{sub.planId}</span>
                    <span className="text-gray-400 ml-2">
                      {formatDate(sub.startDate)}
                    </span>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {showPlanChange && (
        <PlanChangeDialog
          tenantId={tenantId}
          tenantName={tenantName}
          currentSubscription={activeSub}
          onClose={() => setShowPlanChange(false)}
          onSuccess={() => {
            setShowPlanChange(false);
            utils.subscriptions.getActive.invalidate({ tenantId });
            utils.subscriptions.listByTenant.invalidate({ tenantId });
          }}
        />
      )}

      {showInvoiceCreate && (
        <InvoiceCreateDialog
          tenantId={tenantId}
          activeSubscriptionId={activeSub?.id}
          onClose={() => setShowInvoiceCreate(false)}
          onSuccess={() => {
            setShowInvoiceCreate(false);
            utils.billing.invoicesByTenant.invalidate({ tenantId });
          }}
        />
      )}
    </div>
  );
}
