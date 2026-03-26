import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Users,
  FolderOpen,
  HardDrive,
  CheckCircle2,
  XCircle,
  Zap,
  Crown,
  Star,
} from "lucide-react";
import { toast } from "sonner";

interface PlanFormData {
  slug: string;
  name: string;
  description: string;
  maxUsers: number;
  maxClients: number;
  maxStorageGB: number;
  featureWorkflowCR: boolean;
  featureApostilamento: boolean;
  featureRenovacao: boolean;
  featureInsumos: boolean;
  featureIAT: boolean;
  priceMonthlyBRL: number;
  priceYearlyBRL: number;
  setupFeeBRL: number;
  trialDays: number;
  displayOrder: number;
  isPublic: boolean;
  highlightLabel: string;
}

const defaultFormData: PlanFormData = {
  slug: "",
  name: "",
  description: "",
  maxUsers: 10,
  maxClients: 500,
  maxStorageGB: 50,
  featureWorkflowCR: true,
  featureApostilamento: false,
  featureRenovacao: false,
  featureInsumos: false,
  featureIAT: false,
  priceMonthlyBRL: 0,
  priceYearlyBRL: 0,
  setupFeeBRL: 0,
  trialDays: 14,
  displayOrder: 0,
  isPublic: true,
  highlightLabel: "",
};

function formatBRL(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  starter: <Star className="h-5 w-5 text-gray-500" />,
  professional: <Zap className="h-5 w-5 text-blue-500" />,
  enterprise: <Crown className="h-5 w-5 text-purple-500" />,
};

export function PlansManagementPanel() {
  const utils = trpc.useUtils();
  const { data: plans = [], isLoading } = trpc.plans.list.useQuery();
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>(defaultFormData);

  const createMutation = trpc.plans.create.useMutation({
    onSuccess: () => {
      toast.success("Plano criado com sucesso");
      utils.plans.list.invalidate();
      setShowCreate(false);
      setFormData(defaultFormData);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.plans.update.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado");
      utils.plans.list.invalidate();
      setEditingPlan(null);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.plans.delete.useMutation({
    onSuccess: () => {
      toast.success("Plano desativado");
      utils.plans.list.invalidate();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setFormData({
      slug: plan.slug,
      name: plan.name,
      description: plan.description || "",
      maxUsers: plan.maxUsers,
      maxClients: plan.maxClients,
      maxStorageGB: plan.maxStorageGB,
      featureWorkflowCR: plan.featureWorkflowCR,
      featureApostilamento: plan.featureApostilamento,
      featureRenovacao: plan.featureRenovacao,
      featureInsumos: plan.featureInsumos,
      featureIAT: plan.featureIAT,
      priceMonthlyBRL: plan.priceMonthlyBRL,
      priceYearlyBRL: plan.priceYearlyBRL,
      setupFeeBRL: plan.setupFeeBRL,
      trialDays: plan.trialDays,
      displayOrder: plan.displayOrder,
      isPublic: plan.isPublic,
      highlightLabel: plan.highlightLabel || "",
    });
  };

  const handleSubmit = () => {
    if (editingPlan) {
      updateMutation.mutate({
        id: editingPlan.id,
        name: formData.name,
        description: formData.description || undefined,
        maxUsers: formData.maxUsers,
        maxClients: formData.maxClients,
        maxStorageGB: formData.maxStorageGB,
        featureWorkflowCR: formData.featureWorkflowCR,
        featureApostilamento: formData.featureApostilamento,
        featureRenovacao: formData.featureRenovacao,
        featureInsumos: formData.featureInsumos,
        featureIAT: formData.featureIAT,
        priceMonthlyBRL: formData.priceMonthlyBRL,
        priceYearlyBRL: formData.priceYearlyBRL,
        setupFeeBRL: formData.setupFeeBRL,
        trialDays: formData.trialDays,
        displayOrder: formData.displayOrder,
        isPublic: formData.isPublic,
        highlightLabel: formData.highlightLabel || null,
      });
    } else {
      if (!formData.slug || !formData.name) {
        toast.error("Slug e Nome são obrigatórios");
        return;
      }
      createMutation.mutate({
        slug: formData.slug,
        name: formData.name,
        description: formData.description || undefined,
        maxUsers: formData.maxUsers,
        maxClients: formData.maxClients,
        maxStorageGB: formData.maxStorageGB,
        featureWorkflowCR: formData.featureWorkflowCR,
        featureApostilamento: formData.featureApostilamento,
        featureRenovacao: formData.featureRenovacao,
        featureInsumos: formData.featureInsumos,
        featureIAT: formData.featureIAT,
        priceMonthlyBRL: formData.priceMonthlyBRL,
        priceYearlyBRL: formData.priceYearlyBRL,
        setupFeeBRL: formData.setupFeeBRL,
        trialDays: formData.trialDays,
        displayOrder: formData.displayOrder,
        isPublic: formData.isPublic,
        highlightLabel: formData.highlightLabel || undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const isFormOpen = showCreate || editingPlan;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Planos de Assinatura</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie os planos disponíveis para os tenants</p>
        </div>
        <Button
          className="bg-indigo-600 hover:bg-indigo-700"
          onClick={() => { setShowCreate(true); setEditingPlan(null); setFormData(defaultFormData); }}
        >
          <Plus className="h-4 w-4 mr-1" /> Novo Plano
        </Button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan: any) => (
          <Card key={plan.id} className={`relative ${!plan.isActive ? 'opacity-50' : ''}`}>
            {plan.highlightLabel && (
              <div className="absolute -top-2 right-4">
                <Badge className="bg-indigo-600 text-white text-[0.65rem]">{plan.highlightLabel}</Badge>
              </div>
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {PLAN_ICONS[plan.slug] || <Star className="h-5 w-5 text-gray-400" />}
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(plan)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {plan.isActive && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                      onClick={() => {
                        if (confirm(`Desativar plano "${plan.name}"?`)) {
                          deleteMutation.mutate({ id: plan.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatBRL(plan.priceMonthlyBRL)}<span className="text-sm font-normal text-gray-500">/mês</span></p>
                {plan.priceYearlyBRL > 0 && (
                  <p className="text-xs text-gray-400">{formatBRL(plan.priceYearlyBRL)}/ano</p>
                )}
              </div>

              {plan.description && (
                <p className="text-xs text-gray-500 leading-relaxed">{plan.description}</p>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <Users className="h-3.5 w-3.5 mx-auto text-gray-400 mb-1" />
                  <p className="text-xs font-semibold">{plan.maxUsers}</p>
                  <p className="text-[0.6rem] text-gray-400">Usuários</p>
                </div>
                <div className="text-center">
                  <FolderOpen className="h-3.5 w-3.5 mx-auto text-gray-400 mb-1" />
                  <p className="text-xs font-semibold">{plan.maxClients}</p>
                  <p className="text-[0.6rem] text-gray-400">Clientes</p>
                </div>
                <div className="text-center">
                  <HardDrive className="h-3.5 w-3.5 mx-auto text-gray-400 mb-1" />
                  <p className="text-xs font-semibold">{plan.maxStorageGB} GB</p>
                  <p className="text-[0.6rem] text-gray-400">Storage</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-2">
                {plan.featureWorkflowCR && <Badge variant="outline" className="text-[0.6rem]">Workflow CR</Badge>}
                {plan.featureIAT && <Badge variant="outline" className="text-[0.6rem]">IAT</Badge>}
                {plan.featureApostilamento && <Badge variant="outline" className="text-[0.6rem]">Aquisição</Badge>}
                {plan.featureRenovacao && <Badge variant="outline" className="text-[0.6rem]">Compliance</Badge>}
                {plan.featureInsumos && <Badge variant="outline" className="text-[0.6rem]">Insumos</Badge>}
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-gray-400">
                {plan.isActive ? (
                  <><CheckCircle2 className="h-3 w-3 text-green-500" /> Ativo</>
                ) : (
                  <><XCircle className="h-3 w-3 text-red-500" /> Desativado</>
                )}
                {plan.isPublic && <span className="ml-2">· Público</span>}
                <span className="ml-2">· {plan.trialDays}d trial</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowCreate(false); setEditingPlan(null); }} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-white font-semibold">{editingPlan ? "Editar Plano" : "Novo Plano"}</h2>
              <button onClick={() => { setShowCreate(false); setEditingPlan(null); }} className="text-white/60 hover:text-white p-1 rounded">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Slug & Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="ex: starter"
                    disabled={!!editingPlan}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="ex: Starter"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Descrição</Label>
                <textarea
                  className="w-full h-16 p-3 text-sm border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do plano..."
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Mensal (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(formData.priceMonthlyBRL / 100).toFixed(2)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, priceMonthlyBRL: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Anual (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(formData.priceYearlyBRL / 100).toFixed(2)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, priceYearlyBRL: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Setup (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(formData.setupFeeBRL / 100).toFixed(2)}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, setupFeeBRL: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  />
                </div>
              </div>

              {/* Limits */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Max Usuários</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maxUsers}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Clientes</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maxClients}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, maxClients: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Storage (GB)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maxStorageGB}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, maxStorageGB: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Módulos Incluídos</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "featureWorkflowCR", label: "Workflow CR" },
                    { key: "featureIAT", label: "IAT" },
                    { key: "featureApostilamento", label: "Aquisição & CRAF" },
                    { key: "featureRenovacao", label: "Compliance" },
                    { key: "featureInsumos", label: "Munições & Insumos" },
                  ].map((feat) => (
                    <div key={feat.key} className="flex items-center justify-between p-2 rounded border">
                      <Label className="text-xs">{feat.label}</Label>
                      <Switch
                        checked={(formData as any)[feat.key]}
                        onCheckedChange={(checked: boolean) => setFormData({ ...formData, [feat.key]: checked })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Trial (dias)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.trialDays}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, trialDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.displayOrder}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Destaque</Label>
                  <Input
                    value={formData.highlightLabel}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, highlightLabel: e.target.value })}
                    placeholder="ex: Mais Popular"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isPublic}
                    onCheckedChange={(checked: boolean) => setFormData({ ...formData, isPublic: checked })}
                  />
                  <Label className="text-sm">Público</Label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t">
                <Button variant="outline" className="flex-1" onClick={() => { setShowCreate(false); setEditingPlan(null); }}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {editingPlan ? "Salvar Alterações" : "Criar Plano"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
