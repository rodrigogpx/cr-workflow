import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

function formatBRL(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Clock className="h-3 w-3" /> },
  paid: { label: "Paga", color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  overdue: { label: "Vencida", color: "bg-red-100 text-red-700 border-red-200", icon: <AlertCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelada", color: "bg-gray-100 text-gray-600 border-gray-200", icon: <XCircle className="h-3 w-3" /> },
  refunded: { label: "Estornada", color: "bg-purple-100 text-purple-700 border-purple-200", icon: <XCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-gray-100 text-gray-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export function BillingOverviewPanel() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data: tenants = [] } = trpc.tenants.list.useQuery();
  const { data: billingMetrics } = trpc.billing.metrics.useQuery();
  const { data: invoices = [], isLoading } = trpc.billing.allInvoices.useQuery(
    statusFilter ? { status: statusFilter } : {}
  );

  const markPaidMutation = trpc.billing.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Fatura marcada como paga");
      utils.billing.allInvoices.invalidate();
      utils.billing.metrics.invalidate();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const tenantNameMap = new Map(tenants.map((t: any) => [t.id, t.name]));

  // Compute summary
  const pendingInvoices = invoices.filter((inv: any) => inv.status === "pending");
  const overdueInvoices = invoices.filter((inv: any) => inv.status === "overdue");
  const paidInvoices = invoices.filter((inv: any) => inv.status === "paid");
  const pendingTotal = pendingInvoices.reduce((sum: number, inv: any) => sum + inv.totalBRL, 0);
  const overdueTotal = overdueInvoices.reduce((sum: number, inv: any) => sum + inv.totalBRL, 0);
  const paidTotal = paidInvoices.reduce((sum: number, inv: any) => sum + inv.totalBRL, 0);

  const filters = [
    { value: undefined, label: "Todas", count: invoices.length },
    { value: "pending", label: "Pendentes", count: pendingInvoices.length },
    { value: "overdue", label: "Vencidas", count: overdueInvoices.length },
    { value: "paid", label: "Pagas", count: paidInvoices.length },
    { value: "cancelled", label: "Canceladas", count: invoices.filter((inv: any) => inv.status === "cancelled").length },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Visão Financeira</h2>
        <p className="text-sm text-gray-500 mt-1">Todas as faturas da plataforma</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">MRR</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{billingMetrics?.mrrFormatted ?? "R$ 0,00"}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Recebido</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatBRL(paidTotal)}</p>
                <p className="text-[0.65rem] text-gray-400 mt-0.5">{paidInvoices.length} faturas</p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Pendente</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatBRL(pendingTotal)}</p>
                <p className="text-[0.65rem] text-gray-400 mt-0.5">{pendingInvoices.length} faturas</p>
              </div>
              <Clock className="h-7 w-7 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Vencido</p>
                <p className="text-xl font-bold text-red-600 mt-1">{formatBRL(overdueTotal)}</p>
                <p className="text-[0.65rem] text-gray-400 mt-0.5">{overdueInvoices.length} faturas</p>
              </div>
              <AlertCircle className="h-7 w-7 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b">
        <Filter className="h-3.5 w-3.5 text-gray-400 mr-2" />
        {filters.map((f) => (
          <button
            key={f.value ?? "all"}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
              statusFilter === f.value
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
            {f.count > 0 && (
              <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma fatura encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv: any) => (
            <div
              key={inv.id}
              className="flex items-center justify-between p-4 rounded-xl border bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {tenantNameMap.get(inv.tenantId) || `Tenant #${inv.tenantId}`}
                    </p>
                    <span className="text-xs text-gray-400">#{inv.id}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                    <span className="mx-1.5 text-gray-300">|</span>
                    Venc. {formatDate(inv.dueDate)}
                  </p>
                  {inv.notes && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[300px]">{inv.notes}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 ml-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatBRL(inv.totalBRL)}</p>
                  {inv.discountBRL > 0 && (
                    <p className="text-[0.6rem] text-gray-400 line-through">{formatBRL(inv.subtotalBRL)}</p>
                  )}
                </div>
                <StatusBadge status={inv.status} />
                {(inv.status === "pending" || inv.status === "overdue") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-200 hover:bg-green-50 h-8 text-xs"
                    disabled={markPaidMutation.isPending}
                    onClick={() => markPaidMutation.mutate({
                      invoiceId: inv.id,
                      paymentMethod: "manual",
                    })}
                  >
                    {markPaidMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3 mr-1" />}
                    Pagar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
