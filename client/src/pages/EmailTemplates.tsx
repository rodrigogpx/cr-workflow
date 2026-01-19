import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Mail, Upload, X, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";
import { PlatformAdminLayout } from "@/components/PlatformAdminLayout";
// Editor simples usando Textarea

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

// Editor HTML simples

export default function EmailTemplates() {
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();
  const { data: user } = trpc.auth.me.useQuery();
  const [templates, setTemplates] = useState<Record<string, TemplateState>>({});
  const [activeTab, setActiveTab] = useState('welcome');
  const [newTemplateKey, setNewTemplateKey] = useState('');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const utils = trpc.useUtils();

  // Fetch all templates
  const { data: fetchedTemplates, isLoading: isLoadingTemplates } =
    trpc.emails.getAllTemplates.useQuery();

  // Templates padrão do módulo Workflow CR
  const defaultTemplateKeys = ["welcome", "workflow_cr", "psicotecnico", "laudo_tecnico", "juntada_documentos", "acompanhamento_sinarm"];
  
  const getTemplateTitle = (key: string) => {
    const titles: Record<string, string> = {
      welcome: "Boas Vindas",
      workflow_cr: "Workflow CR",
      psicotecnico: "Encaminhamento Psicotécnico",
      laudo_tecnico: "Agendamento Laudo Técnico",
      juntada_documentos: "Juntada de Documentos",
      acompanhamento_sinarm: "Acompanhamento Sinarm CAC",
    };
    return titles[key] || key;
  };

  // Combinar templates salvos com templates padrão
  const allTemplates = (() => {
    const savedKeys = fetchedTemplates?.map((t: any) => t.templateKey) || [];
    const missingDefaults = defaultTemplateKeys.filter(k => !savedKeys.includes(k));
    const defaultsAsTemplates = missingDefaults.map(key => ({
      templateKey: key,
      templateTitle: getTemplateTitle(key),
      subject: "",
      content: "",
      attachments: null,
    }));
    return [...(fetchedTemplates || []), ...defaultsAsTemplates];
  })();

  useEffect(() => {
    if (fetchedTemplates && fetchedTemplates.length > 0) {
      const initialTemplates: Record<string, TemplateState> = {};
      fetchedTemplates.forEach((t: any) => {
        initialTemplates[t.templateKey] = {
          subject: t.subject || "",
          content: t.content || "",
          attachments: t.attachments ? JSON.parse(t.attachments) : [],
        };
      });
      setTemplates(initialTemplates);
      // Set first template as active if not set
      if (!activeTab && fetchedTemplates[0]) {
        setActiveTab(fetchedTemplates[0].templateKey);
      }
    }
  }, [fetchedTemplates, activeTab]);

  const saveTemplateMutation = trpc.emails.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template salvo com sucesso!");
      utils.emails.getAllTemplates.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar template: ${error.message}`);
    },
  });

  const deleteTemplateMutation = trpc.emails.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template excluído com sucesso!");
      utils.emails.getAllTemplates.invalidate();
      // Se o template atual foi excluído, mude para o primeiro disponível ou welcome
      if (!defaultTemplateKeys.includes(activeTab)) {
         setActiveTab('welcome');
      } else {
         // Se for padrão, ele "reseta", então mantemos a tab mas limpamos o estado local se necessário
         // O refetch cuidará de trazer o estado "vazio" (padrão)
      }
    },
    onError: (error) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });

  const uploadAttachmentMutation = trpc.documents.uploadTemplateAttachment.useMutation({
    onSuccess: (data: any) => {
      // Store file info - uploadTemplateAttachment returns {url, fileKey}
      const fileName = fileInputRef.current?.files?.[0]?.name || "anexo.pdf";
      const newAttachment = { fileName, fileKey: data.fileKey, fileUrl: data.url };
      const currentAttachments = templates[activeTab]?.attachments || [];
      handleTemplateChange("attachments", [...currentAttachments, newAttachment]);
      toast.success("Anexo enviado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar anexo: ${error.message}`);
    },
  });

  const handleTemplateChange = (field: keyof TemplateState, value: any) => {
    setTemplates((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value,
      },
    }));
  };

  const handleSaveTemplate = () => {
    const currentTemplate = templates[activeTab];
    if (currentTemplate) {
      saveTemplateMutation.mutate({
        templateKey: activeTab,
        subject: currentTemplate.subject,
        content: currentTemplate.content,
        attachments: JSON.stringify(currentTemplate.attachments),
      });
    }
  };

  const handleDeleteTemplate = () => {
    if (!confirm("Tem certeza que deseja excluir este template? Se for um template padrão, ele será resetado.")) {
      return;
    }
    deleteTemplateMutation.mutate({
      templateKey: activeTab,
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
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
    const currentAttachments = templates[activeTab]?.attachments || [];
    const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
    handleTemplateChange('attachments', updatedAttachments);
  };

  if (user && user.role !== 'admin') {
    const dashboardPath = buildTenantPath(tenantSlug, "/dashboard");
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full max-w-[95%] mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation(buildTenantPath(tenantSlug, "/admin"))}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Templates de Email</h1>
                <p className="text-sm text-gray-600">Edite os templates de email enviados aos clientes</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleDeleteTemplate} 
                disabled={deleteTemplateMutation.isPending}
                title="Excluir Template Atual"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
              <Button onClick={handleSaveTemplate} disabled={saveTemplateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {saveTemplateMutation.isPending ? 'Salvando...' : 'Salvar Template'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[95%] mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Gerenciar Templates
              </CardTitle>
              <Button onClick={() => setShowNewTemplateDialog(true)} variant="outline" size="sm">
                + Criar Novo Template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {allTemplates.map((t: any) => (
                  <TabsTrigger key={t.templateKey} value={t.templateKey} className="text-xs sm:text-sm">{t.templateTitle || getTemplateTitle(t.templateKey)}</TabsTrigger>
                ))}
              </TabsList>
              {allTemplates.map((t: any) => (
                <TabsContent key={t.templateKey} value={t.templateKey}>
                  {isLoadingTemplates ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor={`subject-${activeTab}`}>Assunto</Label>
                        <Input
                          id={`subject-${activeTab}`}
                          value={templates[activeTab]?.subject || ''}
                          onChange={(e) => handleTemplateChange('subject', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Conteúdo (HTML)</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Editor HTML</p>
                            <textarea
                              value={templates[activeTab]?.content || ''}
                              onChange={(e) => handleTemplateChange('content', e.target.value)}
                              className="w-full min-h-[500px] p-3 border rounded-md font-mono text-sm"
                              placeholder="Digite o conteúdo do email em HTML...\n\nExemplo:\n<p>Olá <strong>{{nome}}</strong>,</p>\n<p>Seja bem-vindo!</p>"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Preview</p>
                            <div 
                              className="w-full min-h-[500px] p-3 border rounded-md bg-white overflow-auto"
                              dangerouslySetInnerHTML={{ __html: templates[activeTab]?.content || '<p className="text-gray-400">O preview aparecerá aqui...</p>' }}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label>Anexos</Label>
                        <div className="border rounded-md p-4 space-y-2">
                          {(templates[activeTab]?.attachments || []).map((att, index) => (
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
                          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
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
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

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
                  onChange={(e) => setNewTemplateKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                />
                <p className="text-xs text-gray-500 mt-1">Use apenas letras minúsculas, números e underscore</p>
              </div>
              <div>
                <Label htmlFor="templateTitle">Título do Template</Label>
                <Input
                  id="templateTitle"
                  placeholder="ex: Boas Vindas Premium"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
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
                  setActiveTab(newTemplateKey);
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
