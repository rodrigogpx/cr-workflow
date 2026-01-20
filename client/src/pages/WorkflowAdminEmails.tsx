import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Mail, Upload, X, FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO } from "@/const";
import Footer from "@/components/Footer";
import { Switch } from "@/components/ui/switch";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

const MODULE_ID = 'workflow-cr';

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

export default function WorkflowAdminEmails() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();
  const [templates, setTemplates] = useState<Record<string, TemplateState>>({});
  const [activeTab, setActiveTab] = useState('');
  const [useRichEditor, setUseRichEditor] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("cac360-email-editor-mode") === "rich";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Fetch templates for this module
  const { data: fetchedTemplates, isLoading: isLoadingTemplates } =
    trpc.emails.getAllTemplates.useQuery({ module: MODULE_ID });

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
      
      // Set active tab to first template if exists and no active tab selected
      // or if the current active tab is no longer in the list (was deleted)
      const keys = Object.keys(initialTemplates);
      if (keys.length > 0 && (!activeTab || !initialTemplates[activeTab])) {
        setActiveTab(keys[0]);
      } else if (keys.length === 0) {
        setActiveTab('');
      }
    }
  }, [fetchedTemplates, activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "cac360-email-editor-mode",
      useRichEditor ? "rich" : "plain"
    );
  }, [useRichEditor]);

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
      toast.success("Template excluído com sucesso!");
      utils.emails.getAllTemplates.invalidate();
      setActiveTab(''); // Clear active tab to trigger useEffect re-selection
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });

  const uploadAttachmentMutation = trpc.emails.uploadTemplateAttachment.useMutation({
    onSuccess: (data: any) => {
      const current = templates[activeTab] || { subject: "", content: "", attachments: [] };
      setTemplates((prev: Record<string, TemplateState>) => ({
        ...prev,
        [activeTab]: {
          ...current,
          attachments: [...current.attachments, data],
        },
      }));
      toast.success("Anexo adicionado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(`Erro ao fazer upload: ${error.message}`);
    },
  });

  const handleSaveTemplate = () => {
    const template = templates[activeTab];
    if (!template) return;
    saveTemplateMutation.mutate({
      templateKey: activeTab,
      module: MODULE_ID,
      templateTitle: getTemplateTitle(activeTab),
      subject: template.subject,
      content: template.content,
      attachments: JSON.stringify(template.attachments),
    });
  };

  const handleDeleteTemplate = () => {
    if (!activeTab) return;
    if (confirm("Tem certeza que deseja excluir este template?")) {
      deleteTemplateMutation.mutate({
        templateKey: activeTab,
        module: MODULE_ID,
      });
    }
  };

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAttachmentMutation.mutate({
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    const current = templates[activeTab];
    if (!current) return;
    setTemplates((prev: Record<string, TemplateState>) => ({
      ...prev,
      [activeTab]: {
        ...current,
        attachments: current.attachments.filter((_, i: number) => i !== index),
      },
    }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    setLocation(buildTenantPath(tenantSlug, "/cr-workflow"));
    return null;
  }

  const roleLabel = user.role === "admin" ? "Administrador" : "Operador";
  const defaultTemplateKeys = ["welcome", "workflow_cr", "psicotecnico", "laudo_tecnico", "juntada_documentos", "acompanhamento_sinarm"];
  const allTemplateKeys = [...new Set([...defaultTemplateKeys, ...Object.keys(templates)])];
  
  // Get current template - use saved template or default
  const getCurrentTemplateValue = (key: string) => {
    if (templates[key]) {
      return templates[key];
    }
    const defaultTpl = getDefaultTemplate(key);
    return { subject: defaultTpl.subject, content: defaultTpl.content, attachments: [] };
  };
  
  const currentTemplate = getCurrentTemplateValue(activeTab);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b-2 border-dashed border-white/20 bg-black sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="CAC 360" className="h-12 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight uppercase">CAC 360 – Templates de Email</h1>
                <p className="text-sm text-white/70">
                  Workflow CR · {roleLabel} · {user.name || user.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(buildTenantPath(tenantSlug, "/cr-workflow"))}
              className="gap-2 text-white border-white/50 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 flex-1">
        <Card className="bg-card/80 backdrop-blur-sm border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Templates de Email do Workflow CR
            </CardTitle>
            <CardDescription>
              Configure os templates de email específicos deste módulo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
              <div className="flex items-center justify-end gap-2 mb-4">
                <span className="text-xs text-muted-foreground">
                  Preview visual
                </span>
                <Switch
                  checked={useRichEditor}
                  onCheckedChange={setUseRichEditor}
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
                  {allTemplateKeys.map((key: string) => (
                    <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
                      {getTemplateTitle(key)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {allTemplateKeys.map((key) => {
                  const tplValue = getCurrentTemplateValue(key);
                  return (
                  <TabsContent key={key} value={key} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Assunto do Email</Label>
                      <Input
                        id="subject"
                        value={templates[key]?.subject ?? tplValue.subject}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setTemplates((prev: Record<string, TemplateState>) => ({
                            ...prev,
                            [key]: {
                              ...tplValue,
                              ...(prev[key] || {}),
                              subject: e.target.value,
                            },
                          }))
                        }
                        placeholder="Digite o assunto do email..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content">Conteúdo (HTML)</Label>
                      {useRichEditor ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Código HTML</Label>
                            <textarea
                              id="content"
                              className="w-full h-80 p-3 border rounded-md bg-background text-foreground font-mono text-xs"
                              value={templates[key]?.content ?? tplValue.content}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setTemplates((prev: Record<string, TemplateState>) => ({
                                  ...prev,
                                  [key]: {
                                    ...tplValue,
                                    ...(prev[key] || {}),
                                    content: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Digite o conteúdo HTML do email..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Preview Visual</Label>
                            <iframe
                              title="Preview do Email"
                              srcDoc={templates[key]?.content ?? tplValue.content}
                              className="w-full h-80 border rounded-md bg-white"
                              sandbox="allow-same-origin"
                            />
                          </div>
                        </div>
                      ) : (
                        <textarea
                          id="content"
                          className="w-full h-64 p-3 border rounded-md bg-background text-foreground font-mono text-sm"
                          value={templates[key]?.content ?? tplValue.content}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setTemplates((prev: Record<string, TemplateState>) => ({
                              ...prev,
                              [key]: {
                                ...tplValue,
                                ...(prev[key] || {}),
                                content: e.target.value,
                              },
                            }))
                          }
                          placeholder="Digite o conteúdo HTML do email..."
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        Variáveis disponíveis: {"{{nome}}"}, {"{{data}}"}, {"{{status}}"}, {"{{status_sinarm}}"}, {"{{email}}"}, {"{{cpf}}"}, {"{{telefone}}"}, {"{{data_agendamento}}"}, {"{{examinador}}"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Anexos</Label>
                      <div className="flex flex-wrap gap-2">
                        {(templates[key]?.attachments || []).map((att: Attachment, i: number) => (
                          <div key={i} className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-sm">
                            <FileText className="h-4 w-4" />
                            <span>{att.fileName}</span>
                            <button onClick={() => removeAttachment(i)} className="text-destructive hover:text-destructive/80">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadAttachmentMutation.isPending}
                      >
                        {uploadAttachmentMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Adicionar Anexo
                      </Button>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button onClick={handleSaveTemplate} disabled={saveTemplateMutation.isPending}>
                        {saveTemplateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salvar Template
                      </Button>
                    </div>
                  </TabsContent>
                  );
                })}
              </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
