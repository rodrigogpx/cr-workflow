import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface InvoiceCreateDialogProps {
  tenantId: number;
  activeSubscriptionId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function InvoiceCreateDialog({
  tenantId,
  activeSubscriptionId,
  onClose,
  onSuccess,
}: InvoiceCreateDialogProps) {
  const today = todayStr();
  const [periodStart, setPeriodStart] = useState(today);
  const [periodEnd, setPeriodEnd] = useState(addMonths(today, 1));
  const [dueDate, setDueDate] = useState(addMonths(today, 0));
  const [subtotal, setSubtotal] = useState("");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");

  const subtotalCents = Math.round(parseFloat(subtotal || "0") * 100);
  const discountCents = Math.round(parseFloat(discount || "0") * 100);
  const totalCents = Math.max(0, subtotalCents - discountCents);

  const createMutation = trpc.billing.createInvoice.useMutation({
    onSuccess: () => {
      toast.success("Fatura criada com sucesso");
      onSuccess();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!subtotal || isNaN(parseFloat(subtotal))) {
      toast.error("Informe o valor da fatura");
      return;
    }

    createMutation.mutate({
      tenantId,
      subscriptionId: activeSubscriptionId,
      periodStart: new Date(periodStart).toISOString(),
      periodEnd: new Date(periodEnd).toISOString(),
      subtotalBRL: subtotalCents,
      discountBRL: discountCents,
      totalBRL: totalCents,
      dueDate: new Date(dueDate).toISOString(),
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-white font-semibold">Nova Fatura Manual</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início do Período</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPeriodStart(e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Fim do Período</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPeriodEnd(e.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDueDate(e.target.value)
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Subtotal (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={subtotal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSubtotal(e.target.value)
                }
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Desconto (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setDiscount(e.target.value)
                }
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Total */}
          <div className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm text-gray-600">Total a cobrar</span>
            <span className="font-bold text-gray-900">
              R${" "}
              {(totalCents / 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <textarea
              className="w-full h-20 p-3 text-sm border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Referência de pagamento, informações adicionais..."
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Gerar Fatura
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
