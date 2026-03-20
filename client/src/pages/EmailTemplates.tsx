import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Mail, Upload, X, FileText, Loader2, Trash2, Plus, Zap, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

interface Attachment {
  fileName: string;
  fileKey: string;
  fileUrl: string;
}

interface TemplateState {
  subject: string;
  content: string;
  attachments: Attachment[];
}

export default function EmailTemplates() {
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();
  const { data: user } = trpc.auth.me.useQuery();
  const [templates, setTemplates] = useState<Record<string, TemplateState>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [newTemplateKey, setNewTemplateKey] = useState('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: fetchedTemplates, isLoading: isLoadingTemplates } =
    trpc.emails.getAllTemplates.useQuery();

  const { data: smtpConfig } = trpc.emails.getSmtpConfig.useQuery();
  const emailLogoUrl = (smtpConfig as any)?.emailLogoUrl || '';

  const replaceLogoVariable = (html: string) => {
    if (!html) return html;
    if (emailLogoUrl) {
      return html.replace(/\{\{logo\}\}/g, `<img src="${emailLogoUrl}" alt="Logo" style="max-height: 80px; max-width: 200px;" />`);
    }
    return html.replace(/\{\{logo\}\}/g, '<span style="color: #999; font-style: italic;">[Logo não configurada]</span>');
  };

  const getTemplateTitle = (key: string) => {
    const titles: Record<string, string> = {
      'boasvindas-filiado': "Boas Vindas (Automático)",
      welcome: "Boas Vindas",
      process_cr: "Processo CR",
      process: "Processo CR",
      psicotecnico: "Encaminhamento Psicotécnico",
      laudo_tecnico: "Agendamento Laudo Técnico",
      'agendamento-laudo': "Agendamento de Laudo",
      juntada_documentos: "Juntada de Documentos",
      psicotecnico_concluido: "Avaliação Psicológica Concluída",
      laudo_tecnico_concluido: "Laudo Técnico Concluído",
      sinarm_montagem_iniciada: "Status Sinarm: Montagem Iniciada",
      sinarm_protocolado: "Status Sinarm: Processo Protocolado",
      sinarm_aguardando_gru: "Status Sinarm: Aguardando Baixa GRU",
      sinarm_em_analise: "Status Sinarm: Em Análise",
      sinarm_restituido: "Status Sinarm: Processo Restituído",
      status: "Atualização de Status",
    };
    return titles[key] || key;
  };

  const allTemplates: any[] = fetchedTemplates || [];

  useEffect(() => {
    if (fetchedTemplates) {
      const initialTemplates: Record<string, TemplateState> = {};
      fetchedTemplates.forEach((t: any) => {
        initialTemplates[t.templateKey] = {
          subject: t.subject || "",
          content: t.content || "",
          attachments: t.attachments ? JSON.parse(t.attachments) : [],
        };
      });
      setTemplates(initialTemplates);
    }
  }, [fetchedTemplates]);

  const saveTemplateMutation = trpc.emails.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template salvo com sucesso!");
      utils.emails.getAllTemplates.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar template: ${error.message}`);
    },
  });

  const deleteTemplateMutation = trpc.emails.deleteTemplate.useMutation({
    onSuccess: () => {
      utils.emails.getAllTemplates.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });

  const uploadAttachmentMutation = trpc.documents.uploadTemplateAttachment.useMutation({
    onSuccess: (data: any) => {
      const fileName = fileInputRef.current?.files?.[0]?.name || "anexo.pdf";
      const newAttachment = { fileName, fileKey: data.fileKey, fileUrl: data.url };
      const currentAttachments = templates[selectedKey || '']?.attachments || [];
      handleTemplateChange("attachments", [...currentAttachments, newAttachment]);
      toast.success("Anexo enviado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar anexo: ${error.message}`);
    },
  });

  const seedTemplatesMutation = trpc.emails.seedTemplates.useMutation({
    onSuccess: (data: any) => {
      toast.success("Templates e triggers atualizados com sucesso!", {
        description: `Processados ${data.templates} templates e ${data.triggers} triggers.`
      });
      utils.emails.getAllTemplates.invalidate();
    },
    onError: (error: any) => {
      toast.error(`Erro ao semear templates: ${error.message}`);
    },
  });

  const handleTemplateChange = (field: keyof TemplateState, value: any) => {
    if (!selectedKey) return;
    setTemplates((prev: any) => ({
      ...prev,
      [selectedKey]: {
        ...prev[selectedKey],
        [field]: value,
      },
    }));
  };

  const handleSaveTemplate = () => {
    if (!selectedKey) return;
    const currentTemplate = templates[selectedKey];
    if (currentTemplate) {
      saveTemplateMutation.mutate({
        templateKey: selectedKey,
        subject: currentTemplate.subject,
        content: currentTemplate.content,
        attachments: JSON.stringify(currentTemplate.attachments),
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (checkedKeys.size === 0) {
      toast.error("Selecione ao menos um template para excluir.");
      return;
    }
    const count = checkedKeys.size;
    if (!confirm(`Tem certeza que deseja excluir ${count} template(s)? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setIsDeleting(true);
    let deleted = 0;
    for (const key of Array.from(checkedKeys)) {
      try {
        await deleteTemplateMutation.mutateAsync({ templateKey: key });
        deleted++;
      } catch (_e: any) {
        // error toast already fired by onError
      }
    }
    setIsDeleting(false);
    setCheckedKeys(new Set());
    if (selectedKey && checkedKeys.has(selectedKey)) {
      setSelectedKey(null);
    }
    if (deleted > 0) {
      toast.success(`${deleted} template(s) excluído(s) com sucesso!`);
    }
    utils.emails.getAllTemplates.invalidate();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const fileData = e.target?.result as string;
        uploadAttachmentMutation.mutate({
          fileName: file.name,
          fileData: fileData.split(',')[1],
          mimeType: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    if (!selectedKey) return;
    const currentAttachments = templates[selectedKey]?.attachments || [];
    const updatedAttachments = currentAttachments.filter((_: any, i: number) => i !== index);
    handleTemplateChange('attachments', updatedAttachments);
  };

  const toggleCheck = (key: string) => {
    setCheckedKeys((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (checkedKeys.size === allTemplates.length) {
      setCheckedKeys(new Set());
    } else {
      setCheckedKeys(new Set(allTemplates.map((t: any) => t.templateKey)));
    }
  };

  if (user && user.role !== 'admin') {
    const dashboardPath = buildTenantPath(tenantSlug, "/dashboard");
    return (
      <div className="flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Apenas administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation(dashboardPath)}>Voltar ao Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Editor view (when a template is selected) ──
  if (selectedKey && templates[selectedKey]) {
    const tpl = templates[selectedKey];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedKey(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar à lista
          </Button>
          <h2 className="text-lg font-semibold truncate">
            {allTemplates.find((t: any) => t.templateKey === selectedKey)?.templateTitle || getTemplateTitle(selectedKey)}
          </h2>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="tpl-subject">Assunto</Label>
              <Input
                id="tpl-subject"
                value={tpl.subject}
                onChange={(e: any) => handleTemplateChange('subject', e.target.value)}
              />
            </div>

            <div>
              <Label>Conteúdo (HTML)</Label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-2">Editor HTML</p>
                  <textarea
                    value={tpl.content}
                    onChange={(e: any) => handleTemplateChange('content', e.target.value)}
                    className="w-full min-h-[400px] p-3 border rounded-md font-mono text-sm"
                    placeholder="Digite o conteúdo do email em HTML..."
                  />
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <p>
                      Variáveis: <code>{"{{nome}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{cpf}}"}</code>, <code>{"{{telefone}}"}</code>, <code>{"{{data}}"}</code>, <code>{"{{logo}}"}</code>
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">Preview</p>
                  <div
                    className="w-full min-h-[400px] p-3 border rounded-md bg-white overflow-auto"
                    dangerouslySetInnerHTML={{ __html: replaceLogoVariable(tpl.content) || '<p class="text-gray-400">O preview aparecerá aqui...</p>' }}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Anexos</Label>
              <div className="border rounded-md p-4 space-y-2">
                {(tpl.attachments || []).map((att: any, index: number) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <span className="text-sm">{att.fileName}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveAttachment(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Adicionar Anexo
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setSelectedKey(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTemplate} disabled={saveTemplateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {saveTemplateMutation.isPending ? 'Salvando...' : 'Salvar Template'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      {/* Action bar - always visible */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            if (confirm("Deseja carregar/atualizar os templates padrão? Isso irá restaurar os templates originais e corrigir textos.")) {
              seedTemplatesMutation.mutate();
            }
          }}
          disabled={seedTemplatesMutation.isPending}
          variant="default"
        >
          <Zap className="h-4 w-4 mr-2" />
          {seedTemplatesMutation.isPending ? 'Semeando...' : 'Semear Padrão'}
        </Button>

        <Button variant="outline" onClick={() => setShowNewTemplateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Criar Novo Template
        </Button>

        {checkedKeys.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Excluindo...' : `Excluir Selecionados (${checkedKeys.size})`}
          </Button>
        )}
      </div>

      {/* Template list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5" />
            Templates de Email
            {allTemplates.length > 0 && (
              <span className="text-sm font-normal text-gray-500">({allTemplates.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTemplates ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : allTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Nenhum template cadastrado</p>
              <p className="text-sm mt-1">Clique em "Semear Padrão" para carregar os templates padrão.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Select all header */}
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-md text-sm font-medium text-gray-600">
                <Checkbox
                  checked={checkedKeys.size === allTemplates.length && allTemplates.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="flex-1">Selecionar todos</span>
                <span className="text-xs text-gray-400">Chave</span>
              </div>

              {/* Template rows */}
              {allTemplates.map((t: any) => (
                <div
                  key={t.templateKey}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors group"
                >
                  <Checkbox
                    checked={checkedKeys.has(t.templateKey)}
                    onCheckedChange={() => toggleCheck(t.templateKey)}
                  />
                  <button
                    className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 hover:underline truncate"
                    onClick={() => setSelectedKey(t.templateKey)}
                  >
                    {t.templateTitle || getTemplateTitle(t.templateKey)}
                  </button>
                  <span className="text-xs text-gray-400 font-mono hidden sm:inline">{t.templateKey}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para criar novo template */}
      {showNewTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Criar Novo Template</CardTitle>
              <CardDescription>Adicione um novo template de email personalizado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="templateKey">Chave do Template</Label>
                <Input
                  id="templateKey"
                  placeholder="ex: welcome_premium"
                  value={newTemplateKey}
                  onChange={(e: any) => setNewTemplateKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                />
                <p className="text-xs text-gray-500 mt-1">Use apenas letras minúsculas, números e underscore</p>
              </div>
              <div>
                <Label htmlFor="templateTitle">Título do Template</Label>
                <Input
                  id="templateTitle"
                  placeholder="ex: Boas Vindas Premium"
                  value={newTemplateTitle}
                  onChange={(e: any) => setNewTemplateTitle(e.target.value)}
                />
              </div>
            </CardContent>
            <div className="flex gap-2 p-6 pt-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewTemplateDialog(false);
                  setNewTemplateKey('');
                  setNewTemplateTitle('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!newTemplateKey || !newTemplateTitle) {
                    toast.error('Preencha todos os campos');
                    return;
                  }
                  saveTemplateMutation.mutate({
                    templateKey: newTemplateKey,
                    templateTitle: newTemplateTitle,
                    subject: '',
                    content: '',
                    attachments: '[]',
                  });
                  setShowNewTemplateDialog(false);
                  setNewTemplateKey('');
                  setNewTemplateTitle('');
                  setSelectedKey(newTemplateKey);
                }}
              >
                Criar Template
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
