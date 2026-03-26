import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Layers,
  Users,
  Plus,
  Edit,
  Trash2,
  BarChart3,
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
  const [activeTab, setActiveTab] = useState<"invoices" | "plans" | "reports">("invoices");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data: tenants = [] } = trpc.tenants.list.useQuery();
  const { data: billingMetrics } = trpc.billing.metrics.useQuery();
  const { data: invoices = [], isLoading } = trpc.billing.allInvoices.useQuery(
    statusFilter ? { status: statusFilter } : {}
  );
  const { data: plans = [], isLoading: isLoadingPlans } = trpc.billing.listPlans.useQuery();

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
        <h2 className="text-xl font-bold text-gray-900">Gestão Financeira</h2>
        <p className="text-sm text-gray-500 mt-1">Faturas, planos e relatórios da plataforma</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "invoices"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("invoices")}
        >
          <Receipt className="h-4 w-4" />
          Faturas
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "plans"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("plans")}
        >
          <Layers className="h-4 w-4" />
          Planos
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "reports"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("reports")}
        >
          <BarChart3 className="h-4 w-4" />
          Relatórios
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "invoices" && (
        <>
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
        </>
      )}

      {activeTab === "plans" && <PlansManagement />}
      {activeTab === "reports" && <ClientsByPlanReport tenants={tenants} />}
    </div>
  );
}

// Plans Management Component
function PlansManagement() {
  const utils = trpc.useUtils();
  const { data: plans = [], isLoading } = trpc.billing.listPlans.useQuery();
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    slug: "",
    name: "",
    description: "",
    monthlyPriceBRL: 0,
    yearlyPriceBRL: 0,
    maxUsers: 10,
    maxClients: 100,
    maxStorageGB: 10,
    features: [],
    isActive: true,
    trialDays: 14,
  });

  const createMutation = trpc.billing.createPlan.useMutation({
    onSuccess: () => {
      toast.success("Plano criado com sucesso");
      utils.billing.listPlans.invalidate();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.billing.updatePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado com sucesso");
      utils.billing.listPlans.invalidate();
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.billing.deletePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano desativado");
      utils.billing.listPlans.invalidate();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const resetForm = () => {
    setFormData({
      slug: "",
      name: "",
      description: "",
      monthlyPriceBRL: 0,
      yearlyPriceBRL: 0,
      maxUsers: 10,
      maxClients: 100,
      maxStorageGB: 10,
      features: [],
      isActive: true,
      trialDays: 14,
    });
    setEditingPlan(null);
  };

  const handleEdit = (plan: any) => {
    setEditingPlan(plan);
    setFormData({
      slug: plan.slug,
      name: plan.name,
      description: plan.description || "",
      monthlyPriceBRL: plan.monthlyPriceBRL,
      yearlyPriceBRL: plan.yearlyPriceBRL,
      maxUsers: plan.maxUsers,
      maxClients: plan.maxClients,
      maxStorageGB: plan.maxStorageGB,
      features: plan.features || [],
      isActive: plan.isActive,
      trialDays: plan.trialDays || 14,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Planos de Assinatura</h3>
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan: any) => (
            <Card key={plan.id} className={`${!plan.isActive ? "opacity-60" : ""}">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.label && (
                      <Badge className="mt-1 bg-green-100 text-green-700">{plan.label}</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(plan)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => deleteMutation.mutate({ id: plan.id })}
                      disabled={!plan.isActive}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">{plan.description}</p>
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-900">
                    R$ {(plan.monthlyPriceBRL / 100).toFixed(2)}
                    <span className="text-sm font-normal text-gray-500">/mês</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    R$ {(plan.yearlyPriceBRL / 100).toFixed(2)}/ano
                  </p>
                </div>
                <div className="pt-2 border-t space-y-1 text-xs text-gray-600">
                  <p>👥 {plan.maxUsers} usuários</p>
                  <p>📋 {plan.maxClients} clientes</p>
                  <p>💾 {plan.maxStorageGB} GB armazenamento</p>
                  <p>🎁 {plan.trialDays} dias trial</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Plan Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            <DialogDescription>
              Configure os detalhes do plano de assinatura
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="starter"
                />
              </div>
              <div>
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Starter"
                />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Plano ideal para começar"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço Mensal (centavos)</Label>
                <Input
                  type="number"
                  value={formData.monthlyPriceBRL}
                  onChange={(e) => setFormData({ ...formData, monthlyPriceBRL: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Preço Anual (centavos)</Label>
                <Input
                  type="number"
                  value={formData.yearlyPriceBRL}
                  onChange={(e) => setFormData({ ...formData, yearlyPriceBRL: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Máx. Usuários</Label>
                <Input
                  type="number"
                  value={formData.maxUsers}
                  onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Máx. Clientes</Label>
                <Input
                  type="number"
                  value={formData.maxClients}
                  onChange={(e) => setFormData({ ...formData, maxClients: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Storage (GB)</Label>
                <Input
                  type="number"
                  value={formData.maxStorageGB}
                  onChange={(e) => setFormData({ ...formData, maxStorageGB: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dias de Trial</Label>
                <Input
                  type="number"
                  value={formData.trialDays}
                  onChange={(e) => setFormData({ ...formData, trialDays: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label>Plano Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPlan ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Clients by Plan Report Component
function ClientsByPlanReport({ tenants }: { tenants: any[] }) {
  const planStats = tenants.reduce((acc: any, tenant: any) => {
    const planSlug = tenant.planSlug || "sem-plano";
    if (!acc[planSlug]) {
      acc[planSlug] = {
        planName: tenant.planSlug || "Sem Plano",
        count: 0,
        tenants: [],
      };
    }
    acc[planSlug].count++;
    acc[planSlug].tenants.push(tenant);
    return acc;
  }, {});

  const sortedPlans = Object.values(planStats).sort((a: any, b: any) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Distribuição de Clientes por Plano</h3>
        <p className="text-sm text-gray-500 mt-1">Análise de tenants por plano de assinatura</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedPlans.map((stat: any, idx: number) => (
          <Card key={idx} className="border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{stat.planName}</span>
                <Badge className="bg-indigo-100 text-indigo-700">{stat.count}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total de Tenants</span>
                  <span className="font-bold text-gray-900">{stat.count}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">% do Total</span>
                  <span className="font-bold text-gray-900">
                    {((stat.count / tenants.length) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-500 font-medium mb-1">Tenants:</p>
                  <div className="space-y-0.5 max-h-32 overflow-y-auto">
                    {stat.tenants.map((t: any) => (
                      <p key={t.id} className="text-xs text-gray-600 truncate">
                        • {t.name}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader>
          <CardTitle className="text-base">Resumo Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-600">Total de Tenants</p>
              <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Planos Diferentes</p>
              <p className="text-2xl font-bold text-gray-900">{sortedPlans.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Plano Mais Popular</p>
              <p className="text-sm font-bold text-gray-900 mt-1">
                {sortedPlans[0]?.planName || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Concentração</p>
              <p className="text-sm font-bold text-gray-900 mt-1">
                {sortedPlans[0] ? `${((sortedPlans[0].count / tenants.length) * 100).toFixed(1)}%` : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
