import { useState } from "react";
import { TenantAdminLayout } from "@/components/TenantAdminLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Zap, Mail, Clock, Users, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminEmailTriggers() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    triggerEvent: "",
    recipientType: "client" as "client" | "users" | "both" | "operator",
    recipientUserIds: [] as number[],
    sendImmediate: true,
    sendBeforeHours: undefined as number | undefined,
    isActive: true,
    templateIds: [] as { templateId: number; sendOrder: number; isForReminder: boolean }[],
  });

  const { data: triggers, refetch } = trpc.emailTriggers.list.useQuery();
  const { data: availableEvents } = trpc.emailTriggers.getAvailableEvents.useQuery();
  const { data: templates } = trpc.emails.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const createMutation = trpc.emailTriggers.create.useMutation({
    onSuccess: () => {
      toast({ title: "Trigger criado com sucesso" });
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast({ title: "Erro ao criar trigger", description: err.message, variant: "destructive" }),
  });

  const updateMutation = trpc.emailTriggers.update.useMutation({
    onSuccess: () => {
      toast({ title: "Trigger atualizado com sucesso" });
      setEditingTrigger(null);
      resetForm();
      refetch();
    },
    onError: (err) => toast({ title: "Erro ao atualizar trigger", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = trpc.emailTriggers.delete.useMutation({
    onSuccess: () => {
      toast({ title: "Trigger excluído com sucesso" });
      refetch();
    },
    onError: (err) => toast({ title: "Erro ao excluir trigger", description: err.message, variant: "destructive" }),
  });

  const addTemplateMutation = trpc.emailTriggers.addTemplate.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const removeTemplateMutation = trpc.emailTriggers.removeTemplate.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      triggerEvent: "",
      recipientType: "client",
      recipientUserIds: [],
      sendImmediate: true,
      sendBeforeHours: undefined,
      isActive: true,
      templateIds: [],
    });
  };

  const handleEdit = (trigger: any) => {
    setEditingTrigger(trigger);
    setFormData({
      name: trigger.name,
      triggerEvent: trigger.triggerEvent,
      recipientType: trigger.recipientType,
      recipientUserIds: trigger.recipientUserIds ? JSON.parse(trigger.recipientUserIds) : [],
      sendImmediate: trigger.sendImmediate,
      sendBeforeHours: trigger.sendBeforeHours || undefined,
      isActive: trigger.isActive,
      templateIds: [],
    });
  };

  const handleSubmit = () => {
    if (editingTrigger) {
      updateMutation.mutate({
        id: editingTrigger.id,
        ...formData,
        sendBeforeHours: formData.sendBeforeHours || null,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getRecipientLabel = (type: string) => {
    switch (type) {
      case "client": return "Cliente";
      case "users": return "Usuários específicos";
      case "both": return "Cliente + Usuários";
      case "operator": return "Operador do cliente";
      default: return type;
    }
  };

  const getEventLabel = (event: string) => {
    return availableEvents?.find(e => e.value === event)?.label || event;
  };

  const selectedEvent = availableEvents?.find(e => e.value === formData.triggerEvent);

  return (
    <TenantAdminLayout active="email-triggers">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              Automação de Emails
            </h1>
            <p className="text-muted-foreground text-sm">
              Configure triggers para envio automático de emails baseado em ações do sistema
            </p>
          </div>
          <Dialog open={isCreateOpen || !!editingTrigger} onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingTrigger(null);
              resetForm();
            } else {
              setIsCreateOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Trigger
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTrigger ? "Editar Trigger" : "Novo Trigger de Email"}</DialogTitle>
                <DialogDescription>
                  Configure quando e para quem os emails serão enviados automaticamente
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Trigger</Label>
                    <Input
                      placeholder="Ex: Boas-vindas ao cliente"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Evento Disparador</Label>
                    <Select
                      value={formData.triggerEvent}
                      onValueChange={(v) => setFormData({ ...formData, triggerEvent: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o evento" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEvents?.map((event) => (
                          <SelectItem key={event.value} value={event.value}>
                            {event.label}
                            {event.hasSchedule && <Badge variant="outline" className="ml-2 text-xs">Agendável</Badge>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Destinatários</Label>
                  <Select
                    value={formData.recipientType}
                    onValueChange={(v: any) => setFormData({ ...formData, recipientType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Cliente (email do cliente)
                        </div>
                      </SelectItem>
                      <SelectItem value="operator">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Operador do cliente
                        </div>
                      </SelectItem>
                      <SelectItem value="users">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Usuários específicos
                        </div>
                      </SelectItem>
                      <SelectItem value="both">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Cliente + Usuários
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.recipientType === "users" || formData.recipientType === "both") && (
                  <div className="space-y-2">
                    <Label>Selecionar Usuários</Label>
                    <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
                      {users?.map((user: any) => (
                        <label key={user.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.recipientUserIds.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, recipientUserIds: [...formData.recipientUserIds, user.id] });
                              } else {
                                setFormData({ ...formData, recipientUserIds: formData.recipientUserIds.filter(id => id !== user.id) });
                              }
                            }}
                            className="rounded"
                          />
                          {user.name || user.email} ({user.role})
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-6 py-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.sendImmediate}
                      onCheckedChange={(v) => setFormData({ ...formData, sendImmediate: v })}
                    />
                    <Label className="cursor-pointer">Enviar imediatamente</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                    />
                    <Label className="cursor-pointer">Trigger ativo</Label>
                  </div>
                </div>

                {selectedEvent?.hasSchedule && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Lembrete antes do evento
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="24"
                        className="w-24"
                        value={formData.sendBeforeHours || ""}
                        onChange={(e) => setFormData({ ...formData, sendBeforeHours: e.target.value ? Number(e.target.value) : undefined })}
                      />
                      <span className="text-sm text-muted-foreground">horas antes</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Um email de lembrete será enviado X horas antes do evento agendado
                    </p>
                  </div>
                )}

                {!editingTrigger && (
                  <div className="space-y-2">
                    <Label>Templates de Email</Label>
                    <p className="text-xs text-muted-foreground">
                      Selecione os templates que serão enviados quando este trigger for acionado
                    </p>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                      {templates?.map((template: any) => (
                        <label key={template.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.templateIds.some(t => t.templateId === template.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  templateIds: [...formData.templateIds, { templateId: template.id, sendOrder: formData.templateIds.length + 1, isForReminder: false }]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  templateIds: formData.templateIds.filter(t => t.templateId !== template.id)
                                });
                              }
                            }}
                            className="rounded"
                          />
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {template.templateTitle || template.templateKey}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreateOpen(false);
                  setEditingTrigger(null);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={!formData.name || !formData.triggerEvent}>
                  {editingTrigger ? "Salvar Alterações" : "Criar Trigger"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Triggers List */}
        <div className="grid gap-4">
          {triggers?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Nenhum trigger configurado</p>
                <p className="text-sm">Crie seu primeiro trigger para automatizar o envio de emails</p>
              </CardContent>
            </Card>
          )}

          {triggers?.map((trigger: any) => (
            <Card key={trigger.id} className={!trigger.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className={`h-5 w-5 ${trigger.isActive ? "text-yellow-500" : "text-muted-foreground"}`} />
                      {trigger.name}
                      {!trigger.isActive && <Badge variant="secondary">Inativo</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {getEventLabel(trigger.triggerEvent)}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(trigger)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Deseja excluir este trigger?")) {
                          deleteMutation.mutate({ id: trigger.id });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{getRecipientLabel(trigger.recipientType)}</span>
                  </div>
                  {trigger.sendImmediate && (
                    <Badge variant="outline" className="gap-1">
                      <Mail className="h-3 w-3" />
                      Envio imediato
                    </Badge>
                  )}
                  {trigger.sendBeforeHours && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Lembrete {trigger.sendBeforeHours}h antes
                    </Badge>
                  )}
                </div>

                {trigger.templates && trigger.templates.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Templates vinculados:</p>
                    <div className="flex flex-wrap gap-2">
                      {trigger.templates.map((t: any) => (
                        <Badge key={t.id} variant="secondary" className="gap-1">
                          <Mail className="h-3 w-3" />
                          {t.template?.templateTitle || t.template?.templateKey || `Template #${t.templateId}`}
                          {t.isForReminder && <Clock className="h-3 w-3 ml-1" />}
                          <button
                            className="ml-1 hover:text-destructive"
                            onClick={() => removeTemplateMutation.mutate({ id: t.id })}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add template to existing trigger */}
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Select
                      onValueChange={(templateId) => {
                        addTemplateMutation.mutate({
                          triggerId: trigger.id,
                          templateId: Number(templateId),
                          sendOrder: (trigger.templates?.length || 0) + 1,
                          isForReminder: false,
                        });
                      }}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="Adicionar template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates?.filter((t: any) => !trigger.templates?.some((tt: any) => tt.templateId === t.id)).map((template: any) => (
                          <SelectItem key={template.id} value={String(template.id)}>
                            {template.templateTitle || template.templateKey}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TenantAdminLayout>
  );
}
