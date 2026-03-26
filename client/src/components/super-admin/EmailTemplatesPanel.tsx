import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, XCircle, Save, Eye, Code, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface EmailTemplatesPanelProps {
  tenantId: number;
}

export function EmailTemplatesPanel({ tenantId }: EmailTemplatesPanelProps) {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.tenants.getEmailTemplates.useQuery({ tenantId });

  const seedMutation = trpc.tenants.seedEmailTemplates.useMutation({
    onSuccess: (result: any) => {
      if (result.skipped) {
        toast.info('Templates já existem para este tenant');
      } else {
        toast.success(`Seed concluído: ${result.templates} templates e ${result.triggers} triggers criados`);
      }
      utils.tenants.getEmailTemplates.invalidate({ tenantId });
      utils.tenants.getEmailTriggers.invalidate({ tenantId });
    },
    onError: (error: any) => {
      toast.error(`Erro ao executar seed: ${error.message}`);
    },
  });

  const saveMutation = trpc.tenants.saveEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template salvo com sucesso');
      utils.tenants.getEmailTemplates.invalidate({ tenantId });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar template: ${error.message}`);
    },
  });

  // Template detail slide state
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [detailMounted, setDetailMounted] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  useEffect(() => {
    if (selectedTemplate) {
      const timer = setTimeout(() => setDetailMounted(true), 10);
      return () => clearTimeout(timer);
    } else {
      setDetailMounted(false);
    }
  }, [selectedTemplate]);

  const openTemplate = (template: any) => {
    setSelectedTemplate(template);
    setEditSubject(template.subject || "");
    setEditContent(template.content || "");
    setEditTitle(template.templateTitle || template.templateKey || "");
    setViewMode("preview");
  };

  const closeDetail = () => {
    setDetailMounted(false);
    setTimeout(() => setSelectedTemplate(null), 300);
  };

  const handleSave = () => {
    if (!selectedTemplate) return;
    saveMutation.mutate({
      tenantId,
      templateKey: selectedTemplate.templateKey,
      module: selectedTemplate.module,
      templateTitle: editTitle,
      subject: editSubject,
      content: editContent,
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
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Templates de Email</h4>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{templates.length} templates</Badge>
            {templates.length === 0 && (
              <Button
                size="sm"
                variant="default"
                onClick={() => seedMutation.mutate({ tenantId })}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Carregar Templates Padrão
              </Button>
            )}
          </div>
        </div>

        {templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((template: any) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group"
                onClick={() => openTemplate(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{template.templateTitle || template.templateKey}</p>
                      <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge variant="secondary">{template.module}</Badge>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum template configurado</p>
            <p className="text-xs mt-2">Clique em "Carregar Templates Padrão" para inicializar os templates do workflow</p>
          </div>
        )}
      </div>

      {/* Template Detail Sliding Panel (60vw, nested over the 75vw tenant panel) */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${detailMounted ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDetail}
          />

          {/* Detail Panel */}
          <div
            className={`absolute top-0 right-0 h-full w-[60vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
              detailMounted ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* Header */}
            <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-white font-semibold text-lg truncate">{editTitle}</h2>
                <p className="text-white/60 text-sm truncate">{selectedTemplate.templateKey} &middot; {selectedTemplate.module}</p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="bg-white/20 text-white hover:bg-white/30 border-0"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar
                </Button>
                <button
                  onClick={closeDetail}
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-[#f5f5f5]">
              <div className="p-6 space-y-5">
                {/* Editable fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={editTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input
                      value={editSubject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSubject(e.target.value)}
                    />
                  </div>
                </div>

                {/* View mode toggle */}
                <div className="flex items-center gap-2 border-b pb-2">
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === "preview" ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setViewMode("preview")}
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                  <button
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === "code" ? "bg-indigo-100 text-indigo-700" : "text-gray-500 hover:text-gray-700"
                    }`}
                    onClick={() => setViewMode("code")}
                  >
                    <Code className="h-4 w-4" />
                    HTML
                  </button>
                </div>

                {/* Preview / Code editor */}
                {viewMode === "preview" ? (
                  <div className="border rounded-lg overflow-hidden bg-gray-50">
                    <div className="bg-gray-100 px-4 py-2 border-b text-xs text-gray-500 font-medium">
                      Visualização do Email
                    </div>
                    <div className="p-1 bg-white">
                      <iframe
                        srcDoc={editContent.includes('<meta charset') ? editContent : `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${editContent}</body></html>`}
                        className="w-full border-0"
                        style={{ minHeight: '500px' }}
                        title="Email Preview"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Conteúdo HTML</Label>
                    <textarea
                      className="w-full h-[500px] p-4 font-mono text-sm border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
