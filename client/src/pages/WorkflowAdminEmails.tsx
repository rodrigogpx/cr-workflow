import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Mail, Upload, X, FileText, Loader2, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { APP_LOGO } from "@/const";
import Footer from "@/components/Footer";
import { Switch } from "@/components/ui/switch";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapLink from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";

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

// Componente de Editor Visual Tiptap
function TiptapEmailEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  // Extrai apenas o conteúdo do body para edição
  const getBodyContent = (html: string) => {
    const lower = html.toLowerCase();
    const bodyStart = lower.indexOf("<body");
    if (bodyStart === -1) return html;
    const bodyOpenEnd = lower.indexOf(">", bodyStart);
    if (bodyOpenEnd === -1) return html;
    const bodyClose = lower.lastIndexOf("</body>");
    if (bodyClose === -1) return html.slice(bodyOpenEnd + 1);
    return html.slice(bodyOpenEnd + 1, bodyClose);
  };

  // Reconstrói o HTML completo preservando head e estrutura
  const rebuildHtml = (bodyContent: string, originalHtml: string) => {
    const lower = originalHtml.toLowerCase();
    const bodyStart = lower.indexOf("<body");
    if (bodyStart === -1) return bodyContent;
    const bodyOpenEnd = lower.indexOf(">", bodyStart);
    if (bodyOpenEnd === -1) return bodyContent;
    const bodyClose = lower.lastIndexOf("</body>");
    if (bodyClose === -1) return originalHtml.slice(0, bodyOpenEnd + 1) + bodyContent;
    return originalHtml.slice(0, bodyOpenEnd + 1) + bodyContent + originalHtml.slice(bodyClose);
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: getBodyContent(content),
    onUpdate: ({ editor }) => {
      const newBodyHtml = editor.getHTML();
      const fullHtml = rebuildHtml(newBodyHtml, content);
      onChange(fullHtml);
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-muted" : ""}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-muted" : ""}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "bg-muted" : ""}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "bg-muted" : ""}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={editor.isActive({ textAlign: "left" }) ? "bg-muted" : ""}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={editor.isActive({ textAlign: "center" }) ? "bg-muted" : ""}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={editor.isActive({ textAlign: "right" }) ? "bg-muted" : ""}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt("URL do link:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={editor.isActive("link") ? "bg-muted" : ""}
        >
          <Link2 className="h-4 w-4" />
        </Button>
      </div>
      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none [&_.ProseMirror]:min-h-[280px] [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}

export default function WorkflowAdminEmails() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [templates, setTemplates] = useState<Record<string, TemplateState>>({});
  const [activeTab, setActiveTab] = useState('welcome');
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
      // Set active tab to first template if exists
      if (!initialTemplates[activeTab]) {
        setActiveTab(Object.keys(initialTemplates)[0] || 'welcome');
      }
    }
  }, [fetchedTemplates]);

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

  const getDefaultTemplate = (key: string): { subject: string; content: string } => {
    const defaults: Record<string, { subject: string; content: string }> = {
      welcome: {
        subject: "Bem-vindo(a) ao CAC 360 - {{nome}}",
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
    .highlight { color: #4d9702; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CAC 360</h1>
      <p>Workflow CR - Certificado de Registro</p>
    </div>
    <div class="content">
      <p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563;">{{data}}</p>
      <h2>Olá, {{nome}}!</h2>
      <p>Seja muito bem-vindo(a) à família <span class="highlight">CAC 360</span>!</p>
      <p>Estamos muito felizes em tê-lo(a) conosco nessa jornada para a obtenção do seu Certificado de Registro (CR) e se tornar um <strong>Colecionador, Atirador Desportivo e Caçador (CAC)</strong>.</p>
      <p>Nossa equipe está preparada para auxiliá-lo(a) em cada etapa desse processo, garantindo que você tenha todo o suporte necessário.</p>
      <p>Em breve, você receberá mais informações sobre os próximos passos.</p>

      <div style="margin: 16px 0 20px 0; padding: 16px; border-radius: 8px; background: #f9fafb; border: 1px solid #e5e7eb;">
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280;">
          Seus dados de contato cadastrados:
        </p>
        <p style="margin: 0; font-size: 13px; color: #111827; line-height: 1.5;">
          <strong>Email:</strong> {{email}}<br />
          <strong>Telefone:</strong> {{telefone}}
        </p>
      </div>

      <p>Qualquer dúvida, estamos à disposição!</p>
      <p>Atenciosamente,<br><strong>Equipe CAC 360</strong></p>
    </div>
    <div class="footer">
      <p>Este é um email automático. Por favor, não responda diretamente.</p>
    </div>
  </div>
</body>
</html>`
      },
      workflow_cr: {
        subject: "Como funciona o processo de obtenção do CR - {{nome}}",
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .step { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4d9702; border-radius: 4px; }
    .step-number { background: #4d9702; color: white; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CAC 360</h1>
      <p>Processo de Obtenção do CR</p>
    </div>
    <div class="content">
      <h2>Olá, {{nome}}!</h2>
      <p>Vamos explicar como funciona o processo para você se tornar um <strong>CAC (Colecionador, Atirador Desportivo e Caçador)</strong>:</p>
      <p>Progresso atual do seu workflow: <strong>{{status}}</strong></p>
      
      <div class="step">
        <span class="step-number">1</span>
        <strong>Cadastro e Boas-Vindas</strong>
        <p>Coleta de dados pessoais e documentação inicial.</p>
      </div>
      
      <div class="step">
        <span class="step-number">2</span>
        <strong>Avaliação Psicológica</strong>
        <p>Agendamento e realização do exame psicotécnico com profissional credenciado.</p>
      </div>
      
      <div class="step">
        <span class="step-number">3</span>
        <strong>Laudo de Capacidade Técnica</strong>
        <p>Curso e avaliação de manuseio seguro de armas de fogo.</p>
      </div>
      
      <div class="step">
        <span class="step-number">4</span>
        <strong>Juntada de Documentos</strong>
        <p>Reunião de toda documentação necessária para o processo.</p>
      </div>
      
      <div class="step">
        <span class="step-number">5</span>
        <strong>Protocolo no SINARM/CAC</strong>
        <p>Envio e acompanhamento do processo junto ao Exército Brasileiro.</p>
      </div>
      
      <p>Acompanharemos você em cada etapa! Em breve, entraremos em contato para iniciar o processo.</p>
      <p>Atenciosamente,<br><strong>Equipe CAC 360</strong></p>
    </div>
    <div class="footer">
      <p>Este é um email automático. Por favor, não responda diretamente.</p>
    </div>
  </div>
</body>
</html>`
      },
      psicotecnico: {
        subject: "Encaminhamento para Avaliação Psicológica - {{nome}}",
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4d9702; }
    .warning { background: #fff3e0; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ff9800; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CAC 360</h1>
      <p>Avaliação Psicológica</p>
    </div>
    <div class="content">
      <h2>Olá, {{nome}}!</h2>
      <p>Chegou o momento de realizar a <strong>Avaliação Psicológica</strong>, etapa obrigatória para a obtenção do Certificado de Registro (CR).</p>
      
      <div class="info-box">
        <h3>📋 Informações do Agendamento</h3>
        <p><strong>Data:</strong> [INSERIR DATA]</p>
        <p><strong>Horário:</strong> [INSERIR HORÁRIO]</p>
        <p><strong>Local:</strong> [INSERIR ENDEREÇO COMPLETO]</p>
        <p><strong>Profissional:</strong> [NOME DO PSICÓLOGO]</p>
      </div>
      
      <div class="warning">
        <h4>⚠️ Documentos Necessários:</h4>
        <ul>
          <li>Documento de identidade com foto (RG ou CNH)</li>
          <li>CPF</li>
          <li>Comprovante de residência atualizado</li>
        </ul>
      </div>
      
      <p><strong>Dicas importantes:</strong></p>
      <ul>
        <li>Durma bem na noite anterior</li>
        <li>Evite bebidas alcoólicas 24h antes</li>
        <li>Chegue com 15 minutos de antecedência</li>
        <li>Leve óculos de grau, se usar</li>
      </ul>
      
      <p>Caso precise reagendar, entre em contato conosco com antecedência.</p>
      <p>Atenciosamente,<br><strong>Equipe CAC 360</strong></p>
    </div>
    <div class="footer">
      <p>Este é um email automático. Por favor, não responda diretamente.</p>
    </div>
  </div>
</body>
</html>`
      },
      laudo_tecnico: {
        subject: "Agendamento do Laudo de Capacidade Técnica - {{nome}}",
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
    .checklist { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CAC 360</h1>
      <p>Laudo de Capacidade Técnica</p>
    </div>
    <div class="content">
      <h2>Olá, {{nome}}!</h2>
      <p>Está chegando uma das etapas mais importantes: o <strong>Laudo de Capacidade Técnica</strong> para a obtenção do seu Certificado de Registro (CR).</p>
      
      <div class="info-box">
        <h3>🎯 Informações do Agendamento</h3>
        <p><strong>Data e horário:</strong> {{data_agendamento}}</p>
        <p><strong>Local:</strong> [INSERIR ENDEREÇO DO CLUBE/STAND]</p>
        <p><strong>Instrutor:</strong> {{examinador}}</p>
      </div>
      
      <div class="checklist">
        <h4>📋 O que será avaliado:</h4>
        <ul>
          <li>Conhecimento teórico sobre legislação e segurança</li>
          <li>Manuseio seguro de armas de fogo</li>
          <li>Técnicas de tiro</li>
          <li>Procedimentos de segurança</li>
        </ul>
      </div>
      
      <p><strong>O que levar:</strong></p>
      <ul>
        <li>Documento de identidade com foto</li>
        <li>Protetor auricular (se possuir)</li>
        <li>Óculos de proteção (se possuir)</li>
        <li>Roupa confortável</li>
      </ul>
      
      <p>Não se preocupe! Nosso instrutor irá guiá-lo em todo o processo.</p>
      <p>Atenciosamente,<br><strong>Equipe CAC 360</strong></p>
    </div>
    <div class="footer">
      <p>Este é um email automático. Por favor, não responda diretamente.</p>
    </div>
  </div>
</body>
</html>`
      },
      juntada_documentos: {
        subject: "Documentos Necessários para o Processo CR - {{nome}}",
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .doc-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .doc-item { padding: 10px 0; border-bottom: 1px dashed #ddd; }
    .doc-item:last-child { border-bottom: none; }
    .important { background: #ffebee; padding: 15px; border-radius: 8px; border-left: 4px solid #f44336; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CAC 360</h1>
      <p>Juntada de Documentos</p>
    </div>
    <div class="content">
      <h2>Olá, {{nome}}!</h2>
      <p>Para dar continuidade ao seu processo de obtenção do <strong>Certificado de Registro (CR)</strong>, precisamos que você providencie os seguintes documentos:</p>
      
      <div class="doc-list">
        <h3>📄 Documentos Necessários:</h3>
        
        <div class="doc-item">
          <strong>1. Documento de Identidade</strong>
          <p>RG ou CNH (cópia legível frente e verso)</p>
        </div>
        
        <div class="doc-item">
          <strong>2. CPF</strong>
          <p>Cadastro de Pessoa Física</p>
        </div>
        
        <div class="doc-item">
          <strong>3. Comprovante de Residência</strong>
          <p>Emitido nos últimos 90 dias (água, luz, telefone ou internet)</p>
        </div>
        
        <div class="doc-item">
          <strong>4. Certidão de Antecedentes Criminais</strong>
          <p>Federal e Estadual (emitidas nos últimos 90 dias)</p>
        </div>
        
        <div class="doc-item">
          <strong>5. Laudo Psicológico</strong>
          <p>Emitido por profissional credenciado pela Polícia Federal</p>
        </div>
        
        <div class="doc-item">
          <strong>6. Laudo de Capacidade Técnica</strong>
          <p>Emitido por instrutor de tiro credenciado</p>
        </div>
        
        <div class="doc-item">
          <strong>7. Foto 3x4</strong>
          <p>Recente, com fundo branco</p>
        </div>
        
        <div class="doc-item">
          <strong>8. Comprovante de Ocupação Lícita</strong>
          <p>Carteira de trabalho, holerite ou declaração de IR</p>
        </div>
      </div>
      
      <div class="important">
        <strong>⚠️ Importante:</strong>
        <p>Todos os documentos devem estar legíveis e dentro da validade. Documentos ilegíveis ou vencidos atrasarão o processo.</p>
      </div>
      
      <p>Você pode enviar os documentos digitalizados pelo nosso sistema ou entregar pessoalmente.</p>
      <p>Atenciosamente,<br><strong>Equipe CAC 360</strong></p>
    </div>
    <div class="footer">
      <p>Este é um email automático. Por favor, não responda diretamente.</p>
    </div>
  </div>
</body>
</html>`
      },
      acompanhamento_sinarm: {
        subject: "Acompanhamento do Processo SINARM/CAC - {{nome}}",
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .status-box { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #4d9702; }
    .timeline { margin: 20px 0; }
    .timeline-item { padding: 15px; margin-left: 20px; border-left: 3px solid #4d9702; position: relative; }
    .timeline-item::before { content: '✓'; position: absolute; left: -12px; background: #4d9702; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .timeline-item.pending::before { content: '○'; background: #ccc; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CAC 360</h1>
      <p>Acompanhamento SINARM/CAC</p>
    </div>
    <div class="content">
      <h2>Olá, {{nome}}!</h2>
      <p>Temos novidades sobre o seu processo de registro no <strong>SINARM/CAC</strong>!</p>
      
      <div class="status-box">
        <h3>📋 Status do Processo</h3>
        <p style="font-size: 24px; color: #4d9702; font-weight: bold;">{{status_sinarm}}</p>
        <p>Número do Protocolo: <strong>[NÚMERO DO PROTOCOLO]</strong></p>
        <p style="margin-top: 8px; font-size: 13px; color: #166534;">
          Progresso geral do seu workflow no CAC 360: <strong>{{status}}</strong>
        </p>
      </div>
      
      <div class="timeline">
        <h4>Histórico do Processo:</h4>
        
        <div class="timeline-item">
          <strong>Documentação Enviada</strong>
          <p>[DATA] - Processo protocolado junto ao Exército Brasileiro</p>
        </div>
        
        <div class="timeline-item">
          <strong>Em Análise</strong>
          <p>[DATA] - Documentação em análise pela autoridade competente</p>
        </div>
        
        <div class="timeline-item pending">
          <strong>Aguardando Aprovação</strong>
          <p>Previsão: [PRAZO ESTIMADO]</p>
        </div>
      </div>
      
      <p><strong>Próximos passos:</strong></p>
      <p>Após a aprovação, você receberá instruções para retirada do seu Certificado de Registro (CR).</p>
      
      <p>Fique tranquilo(a)! Continuamos acompanhando seu processo e informaremos sobre qualquer atualização.</p>
      
      <p>Atenciosamente,<br><strong>Equipe CAC 360</strong></p>
    </div>
    <div class="footer">
      <p>Este é um email automático. Por favor, não responda diretamente.</p>
    </div>
  </div>
</body>
</html>`
      }
    };
    return defaults[key] || { subject: "", content: "" };
  };

  const getBodySegments = (html: string) => {
    const lower = html.toLowerCase();
    const bodyStart = lower.indexOf("<body");
    if (bodyStart === -1) {
      return { prefix: "", body: html, suffix: "" };
    }
    const bodyOpenEnd = lower.indexOf(">", bodyStart);
    if (bodyOpenEnd === -1) {
      return { prefix: html, body: "", suffix: "" };
    }
    const bodyClose = lower.lastIndexOf("</body>");
    if (bodyClose === -1) {
      return {
        prefix: html.slice(0, bodyOpenEnd + 1),
        body: html.slice(bodyOpenEnd + 1),
        suffix: "",
      };
    }
    return {
      prefix: html.slice(0, bodyOpenEnd + 1),
      body: html.slice(bodyOpenEnd + 1, bodyClose),
      suffix: html.slice(bodyClose),
    };
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
    setLocation("/cr-workflow");
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
              onClick={() => setLocation("/cr-workflow")}
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
                        <TiptapEmailEditor
                          content={templates[key]?.content ?? tplValue.content}
                          onChange={(newContent: string) =>
                            setTemplates((prev: Record<string, TemplateState>) => ({
                              ...prev,
                              [key]: {
                                ...tplValue,
                                ...(prev[key] || {}),
                                content: newContent,
                              },
                            }))
                          }
                        />
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
