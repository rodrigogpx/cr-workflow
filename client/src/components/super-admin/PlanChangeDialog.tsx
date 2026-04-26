import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, XCircle, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";

interface PlanChangeDialogProps {
  tenantId: number;
  tenantName: string;
  currentSubscription?: any;
  onClose: () => void;
  onSuccess: () => void;
}

function formatBRL(centavos: number): string {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function PlanChangeDialog({
  tenantId,
  tenantName,
  currentSubscription,
  onClose,
  onSuccess,
}: PlanChangeDialogProps) {
  const { data: plans = [], isLoading } = trpc.plans.list.useQuery();

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(
    currentSubscription?.planId ?? null
  );
  const [billingCycle, setBillingCycle] = useState<
    "monthly" | "yearly" | "lifetime"
  >(currentSubscription?.billingCycle ?? "monthly");
  const [discount, setDiscount] = useState(0);
  const [overrideMaxUsers, setOverrideMaxUsers] = useState<string>("");
  const [overrideMaxClients, setOverrideMaxClients] = useState<string>("");
  const [overrideMaxStorageGB, setOverrideMaxStorageGB] = useState<string>("");
  const [status, setStatus] = useState<"active" | "trialing">(
    currentSubscription ? "active" : "trialing"
  );

  const createMutation = trpc.subscriptions.create.useMutation({
    onSuccess: () => {
      toast.success("Assinatura criada com sucesso");
      onSuccess();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const selectedPlan = plans.find((p: any) => p.id === selectedPlanId);
  const basePrice = selectedPlan
    ? billingCycle === "yearly"
      ? selectedPlan.priceYearlyBRL
      : selectedPlan.priceMonthlyBRL
    : 0;
  const finalPrice = Math.max(0, basePrice - discount * 100);

  const handleSubmit = () => {
    if (!selectedPlanId) {
      toast.error("Selecione um plano");
      return;
    }

    createMutation.mutate({
      tenantId,
      planId: selectedPlanId,
      billingCycle,
      priceBRL: basePrice,
      discountBRL: discount * 100,
      status,
      overrideMaxUsers: overrideMaxUsers
        ? parseInt(overrideMaxUsers)
        : undefined,
      overrideMaxClients: overrideMaxClients
        ? parseInt(overrideMaxClients)
        : undefined,
      overrideMaxStorageGB: overrideMaxStorageGB
        ? parseInt(overrideMaxStorageGB)
        : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h2 className="text-white font-semibold">Alterar Plano</h2>
            <p className="text-white/60 text-sm">{tenantName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Plan Selection */}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Plano</Label>
              <div className="space-y-2">
                {plans.map((plan: any) => (
                  <div
                    key={plan.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      selectedPlanId === plan.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-200"
                    }`}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedPlanId === plan.id ? (
                          <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
                        )}
                        <span className="font-medium text-gray-900">
                          {plan.name}
                        </span>
                        {plan.highlightLabel && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                            {plan.highlightLabel}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        {formatBRL(plan.priceMonthlyBRL)}/mês
                      </span>
                    </div>
                    {selectedPlanId === plan.id && (
                      <div className="mt-2 ml-6 grid grid-cols-3 gap-2 text-xs text-gray-500">
                        <span>{plan.maxUsers} usuários</span>
                        <span>{plan.maxClients} clientes</span>
                        <span>{plan.maxStorageGB} GB storage</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Billing Cycle */}
          <div className="space-y-2">
            <Label>Ciclo de Cobrança</Label>
            <div className="flex gap-2">
              {(["monthly", "yearly", "lifetime"] as const).map(cycle => (
                <button
                  key={cycle}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    billingCycle === cycle
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  onClick={() => setBillingCycle(cycle)}
                >
                  {cycle === "monthly"
                    ? "Mensal"
                    : cycle === "yearly"
                      ? "Anual"
                      : "Vitalício"}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status Inicial</Label>
            <div className="flex gap-2">
              {(["active", "trialing"] as const).map(s => (
                <button
                  key={s}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    status === s
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  onClick={() => setStatus(s)}
                >
                  {s === "active" ? "Ativo" : "Trial"}
                </button>
              ))}
            </div>
          </div>

          {/* Discount */}
          <div className="space-y-2">
            <Label>Desconto (R$)</Label>
            <Input
              type="number"
              min="0"
              value={discount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDiscount(Math.max(0, Number(e.target.value)))
              }
              placeholder="0"
            />
          </div>

          {/* Custom Overrides */}
          <div className="space-y-2">
            <Label className="text-xs text-gray-500 uppercase tracking-wide">
              Limites customizados (opcional — substitui limites do plano)
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Max Usuários</Label>
                <Input
                  type="number"
                  min="1"
                  value={overrideMaxUsers}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setOverrideMaxUsers(e.target.value)
                  }
                  placeholder={selectedPlan?.maxUsers ?? "—"}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Clientes</Label>
                <Input
                  type="number"
                  min="1"
                  value={overrideMaxClients}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setOverrideMaxClients(e.target.value)
                  }
                  placeholder={selectedPlan?.maxClients ?? "—"}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Storage (GB)</Label>
                <Input
                  type="number"
                  min="1"
                  value={overrideMaxStorageGB}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setOverrideMaxStorageGB(e.target.value)
                  }
                  placeholder={selectedPlan?.maxStorageGB ?? "—"}
                />
              </div>
            </div>
          </div>

          {/* Price Summary */}
          {selectedPlan && (
            <Card className="bg-indigo-50 border-indigo-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-900">
                    Valor a cobrar
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-bold text-indigo-900 text-lg">
                    {formatBRL(finalPrice)}
                  </p>
                  {discount > 0 && (
                    <p className="text-xs text-indigo-500 line-through">
                      {formatBRL(basePrice)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSubmit}
              disabled={!selectedPlanId || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              {currentSubscription ? "Alterar Plano" : "Criar Assinatura"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
