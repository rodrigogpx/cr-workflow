import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Mail, Upload, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

const templateKeys = [
  { key: 'welcome', title: 'Boas Vindas' },
  { key: 'process_cr', title: 'Processo CR' },
  { key: 'status_update', title: 'Atualização' },
];

export default function EmailTemplates() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const [templates, setTemplates] = useState<Record<string, TemplateState>>({});
  const [activeTab, setActiveTab] = useState(templateKeys[0].key);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Fetch all templates
  const { data: fetchedTemplates, isLoading: isLoadingTemplates } = trpc.emails.getAllTemplates.useQuery();

  useEffect(() => {
    if (fetchedTemplates) {
      const initialTemplates: Record<string, TemplateState> = {};
      templateKeys.forEach((tk: any) => {
        const found = fetchedTemplates.find((t: any) => t.templateKey === tk.key);
        initialTemplates[tk.key] = {
          subject: found?.subject || '',
          content: found?.content || '',
          attachments: found?.attachments ? JSON.parse(found.attachments) : [],
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
    onError: (error) => {
      toast.error(`Erro ao salvar template: ${error.message}`);
    },
  });

  const uploadAttachmentMutation = trpc.documents.upload.useMutation({
    onSuccess: (data: any) => {
      // Store file info - documents.upload returns {id, url}
      const fileName = fileInputRef.current?.files?.[0]?.name || 'anexo.pdf';
      const newAttachment = { fileName, fileKey: `attachment-${Date.now()}`, fileUrl: data.url };
      const currentAttachments = templates[activeTab]?.attachments || [];
      handleTemplateChange('attachments', [...currentAttachments, newAttachment]);
      toast.success("Anexo enviado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar anexo: ${error.message}`);
    },
  });

  const handleTemplateChange = (field: keyof TemplateState, value: any) => {
    setTemplates(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value,
      }
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = e.target?.result as string;
        uploadAttachmentMutation.mutate({
          clientId: 0, // 0 for general attachments
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Apenas administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")}>Voltar ao Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Templates de Email</h1>
                <p className="text-sm text-gray-600">Edite os templates de email enviados aos clientes</p>
              </div>
            </div>
            <Button onClick={handleSaveTemplate} disabled={saveTemplateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveTemplateMutation.isPending ? 'Salvando...' : 'Salvar Template'}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gerenciar Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                {templateKeys.map(tk => (
                  <TabsTrigger key={tk.key} value={tk.key}>{tk.title}</TabsTrigger>
                ))}
              </TabsList>
              {templateKeys.map(tk => (
                <TabsContent key={tk.key} value={tk.key}>
                  {isLoadingTemplates ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor={`subject-${tk.key}`}>Assunto</Label>
                        <Input
                          id={`subject-${tk.key}`}
                          value={templates[tk.key]?.subject || ''}
                          onChange={(e) => handleTemplateChange('subject', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Conteúdo (HTML)</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Editor HTML</p>
                            <textarea
                              value={templates[tk.key]?.content || ''}
                              onChange={(e) => handleTemplateChange('content', e.target.value)}
                              className="w-full min-h-[500px] p-3 border rounded-md font-mono text-sm"
                              placeholder="Digite o conteúdo do email em HTML...\n\nExemplo:\n<p>Olá <strong>{{nome}}</strong>,</p>\n<p>Seja bem-vindo!</p>"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Preview</p>
                            <div 
                              className="w-full min-h-[500px] p-3 border rounded-md bg-white overflow-auto"
                              dangerouslySetInnerHTML={{ __html: templates[tk.key]?.content || '<p className="text-gray-400">O preview aparecerá aqui...</p>' }}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label>Anexos</Label>
                        <div className="border rounded-md p-4 space-y-2">
                          {templates[tk.key]?.attachments.map((att, index) => (
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
    </div>
  );
}
