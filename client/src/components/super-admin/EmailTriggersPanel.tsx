import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, X, Pencil } from "lucide-react";
import { toast } from "sonner";

interface EmailTriggersPanelProps {
  tenantId: number;
}

export function EmailTriggersPanel({ tenantId }: EmailTriggersPanelProps) {
  const utils = trpc.useUtils();
  const { data: triggers = [], isLoading } = trpc.tenants.getEmailTriggers.useQuery({ tenantId });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEvent, setEditEvent] = useState("");
  const [editActive, setEditActive] = useState(true);

  const updateMutation = trpc.tenants.updateEmailTrigger.useMutation({
    onSuccess: () => {
      toast.success("Trigger atualizado com sucesso");
      utils.tenants.getEmailTriggers.invalidate({ tenantId });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar trigger: ${error.message}`);
    },
  });

  const startEdit = (trigger: any) => {
    setEditingId(trigger.id);
    setEditName(trigger.name);
    setEditEvent(trigger.triggerEvent);
    setEditActive(trigger.isActive);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSave = () => {
    if (!editingId) return;
    updateMutation.mutate({
      tenantId,
      triggerId: editingId,
      name: editName,
      triggerEvent: editEvent,
      isActive: editActive,
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Automações de Email</h4>
        <Badge variant="outline">{triggers.length} triggers</Badge>
      </div>

      {triggers.length > 0 ? (
        <div className="space-y-2">
          {triggers.map((trigger) => (
            <Card key={trigger.id} className={editingId === trigger.id ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-4">
                {editingId === trigger.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nome do trigger"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Evento</Label>
                        <Input
                          value={editEvent}
                          onChange={(e) => setEditEvent(e.target.value)}
                          placeholder="Ex: SINARM_STATUS:Solicitado"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editActive}
                          onCheckedChange={setEditActive}
                        />
                        <Label className="text-sm">{editActive ? "Ativo" : "Inativo"}</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={updateMutation.isPending}>
                          <X className="h-4 w-4 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-between cursor-pointer group"
                    onClick={() => startEdit(trigger)}
                  >
                    <div>
                      <p className="font-medium">{trigger.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Evento: {trigger.triggerEvent}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      {trigger.isActive ? (
                        <Badge className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma automação configurada
        </div>
      )}
    </div>
  );
}
