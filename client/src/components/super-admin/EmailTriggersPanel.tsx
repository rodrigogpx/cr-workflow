import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Loader2, Save, Pencil, Mail } from "lucide-react";
import { toast } from "sonner";

interface EmailTriggersPanelProps {
  tenantId: number;
}

export function EmailTriggersPanel({ tenantId }: EmailTriggersPanelProps) {
  const utils = trpc.useUtils();
  const { data: triggers = [], isLoading } = trpc.tenants.getEmailTriggers.useQuery({ tenantId });
  const { data: allTemplates = [] } = trpc.tenants.getEmailTemplates.useQuery({ tenantId });

  const [selectedTrigger, setSelectedTrigger] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editEvent, setEditEvent] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editRecipientType, setEditRecipientType] = useState("client");
  const [editSendImmediate, setEditSendImmediate] = useState(true);
  const [editSendBeforeHours, setEditSendBeforeHours] = useState<number | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [loadingTriggerTemplates, setLoadingTriggerTemplates] = useState(false);

  const updateMutation = trpc.tenants.updateEmailTrigger.useMutation({
    onError: (error: any) => {
      toast.error(`Erro ao atualizar trigger: ${error.message}`);
    },
  });

  const updateTemplatesMutation = trpc.tenants.updateTriggerTemplates.useMutation({
    onError: (error: any) => {
      toast.error(`Erro ao atualizar templates: ${error.message}`);
    },
  });

  const openSheet = async (trigger: any) => {
    setSelectedTrigger(trigger);
    setEditName(trigger.name);
    setEditEvent(trigger.triggerEvent);
    setEditActive(trigger.isActive);
    setEditRecipientType(trigger.recipientType || "client");
    setEditSendImmediate(trigger.sendImmediate ?? true);
    setEditSendBeforeHours(trigger.sendBeforeHours ?? null);
    setSelectedTemplateIds([]);
    setLoadingTriggerTemplates(true);

    try {
      const linked = await utils.tenants.getTriggerTemplates.fetch({ tenantId, triggerId: trigger.id });
      setSelectedTemplateIds(linked.map((tt: any) => tt.templateId));
    } catch {
      setSelectedTemplateIds([]);
    } finally {
      setLoadingTriggerTemplates(false);
    }
  };

  const toggleTemplate = (templateId: number) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleSave = async () => {
    if (!selectedTrigger) return;

    try {
      await updateMutation.mutateAsync({
        tenantId,
        triggerId: selectedTrigger.id,
        name: editName,
        triggerEvent: editEvent,
        isActive: editActive,
        recipientType: editRecipientType,
        sendImmediate: editSendImmediate,
        sendBeforeHours: editSendImmediate ? null : editSendBeforeHours,
      });

      await updateTemplatesMutation.mutateAsync({
        tenantId,
        triggerId: selectedTrigger.id,
        templateIds: selectedTemplateIds,
      });

      toast.success("Trigger atualizado com sucesso");
      utils.tenants.getEmailTriggers.invalidate({ tenantId });
      utils.tenants.getTriggerTemplates.invalidate({ tenantId, triggerId: selectedTrigger.id });
      setSelectedTrigger(null);
    } catch {
      // errors handled by individual mutation onError
    }
  };

  const isSaving = updateMutation.isPending || updateTemplatesMutation.isPending;

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
            <Card
              key={trigger.id}
              className="cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => openSheet(trigger)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{trigger.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Evento: {trigger.triggerEvent}
                    </p>
                    {trigger.templates?.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {trigger.templates.map((triggerTemplate: any) => (
                          <Badge key={triggerTemplate.id} variant="secondary" className="max-w-full">
                            <span className="truncate">
                              {triggerTemplate.template?.templateTitle || triggerTemplate.template?.templateKey || `Template ${triggerTemplate.templateId}`}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Nenhum template configurado
                      </p>
                    )}
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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma automação configurada
        </div>
      )}

      {/* Sheet de edição */}
      <Sheet open={!!selectedTrigger} onOpenChange={(open) => !open && setSelectedTrigger(null)}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar Trigger</SheetTitle>
            <SheetDescription>
              Altere os dados da automação de email abaixo.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do trigger"
              />
            </div>

            <div className="space-y-2">
              <Label>Evento</Label>
              <Input
                value={editEvent}
                onChange={(e) => setEditEvent(e.target.value)}
                placeholder="Ex: SINARM_STATUS:Solicitado"
              />
              <p className="text-xs text-muted-foreground">
                Formato: TIPO_EVENTO ou TIPO_EVENTO:valor
              </p>
            </div>

            <div className="space-y-2">
              <Label>Destinatário</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editRecipientType}
                onChange={(e) => setEditRecipientType(e.target.value)}
              >
                <option value="client">Cliente</option>
                <option value="operator">Operador</option>
                <option value="users">Usuários específicos</option>
                <option value="both">Cliente + Operador</option>
              </select>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Ativo</Label>
                <p className="text-xs text-muted-foreground">Ativar ou desativar este trigger</p>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Envio imediato</Label>
                <p className="text-xs text-muted-foreground">Enviar assim que o evento ocorrer</p>
              </div>
              <Switch checked={editSendImmediate} onCheckedChange={setEditSendImmediate} />
            </div>

            {!editSendImmediate && (
              <div className="space-y-2">
                <Label>Horas antes do evento</Label>
                <Input
                  type="number"
                  min={1}
                  value={editSendBeforeHours ?? ""}
                  onChange={(e) => setEditSendBeforeHours(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Ex: 24"
                />
                <p className="text-xs text-muted-foreground">
                  Quantas horas antes do evento o email será enviado
                </p>
              </div>
            )}

            {/* Templates associados */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Templates de Email
              </Label>
              <p className="text-xs text-muted-foreground">
                Selecione os templates que serão enviados quando este trigger for disparado.
              </p>

              {loadingTriggerTemplates ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : allTemplates.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
                  {allTemplates.map((template: any) => (
                    <label
                      key={template.id}
                      className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTemplateIds.includes(template.id)}
                        onCheckedChange={() => toggleTemplate(template.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {template.templateTitle || template.templateKey}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {template.subject}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic py-2">
                  Nenhum template disponível. Carregue os templates padrão na aba Templates.
                </p>
              )}

              {selectedTemplateIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedTemplateIds.length} template(s) selecionado(s)
                </p>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button className="w-full" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar alterações
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
