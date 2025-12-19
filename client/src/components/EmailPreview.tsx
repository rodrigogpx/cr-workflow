import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Send, CheckCircle2, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface EmailPreviewProps {
  clientId: number;
  clientEmail: string;
  clientName: string;
  templateKey: string;
  title: string;
  requiresScheduling?: boolean;
  scheduledDate?: string | Date | null;
  examinerName?: string | null;
}

export function EmailPreview({
  clientId,
  clientEmail,
  clientName,
  templateKey,
  title,
  requiresScheduling = false,
  scheduledDate = null,
  examinerName = null,
}: EmailPreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Buscar template salvo
  const { data: template } = trpc.emails.getTemplate.useQuery({ templateKey });

  // Buscar histórico de envio
  const { data: emailLog } = trpc.emails.getEmailLog.useQuery({
    clientId,
    templateKey,
  });

  const sendEmailMutation = trpc.emails.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email enviado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao enviar email: ${error.message}`);
    },
  });

  const handleSendEmail = () => {
    if (!template) {
      toast.error("Template não encontrado. Configure-o na área de administração.");
      return;
    }

    sendEmailMutation.mutate({
      clientId,
      recipientEmail: clientEmail,
      templateKey,
      subject: template.subject,
      content: template.content,
    });
  };

  // Preparar substituições para preview (nome, data de agendamento e examinador)
  const formatScheduledDate = (date?: string | Date | null) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  const schedulingDateFormatted = formatScheduledDate(scheduledDate);
  const schedulingExaminer = examinerName || "";

  let previewSubject = template?.subject || "";
  let previewContent = template?.content || "";

  if (previewSubject) {
    previewSubject = previewSubject
      .replace(/\{\{nome\}\}/g, clientName)
      .replace(/\{\{data_agendamento\}\}/g, schedulingDateFormatted)
      .replace(/\{\{examinador\}\}/g, schedulingExaminer);
  }

  if (previewContent) {
    previewContent = previewContent
      .replace(/\{\{nome\}\}/g, clientName)
      .replace(/\{\{data_agendamento\}\}/g, schedulingDateFormatted)
      .replace(/\{\{examinador\}\}/g, schedulingExaminer);
  }
  const attachments = template?.attachments ? JSON.parse(template.attachments) : [];

  const wasAlreadySent = !!emailLog;

  return (
    <Card className={wasAlreadySent ? "border-green-200 bg-green-50" : ""}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{title}</span>
          {wasAlreadySent && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Enviado
            </div>
          )}
        </CardTitle>
        {wasAlreadySent && emailLog && (
          <CardDescription className="text-green-700">
            Enviado em {new Date(emailLog.sentAt).toLocaleString("pt-BR")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {/* Botão de Preview */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-[95vw] sm:max-w-[80vw] h-[90vh] flex flex-col">
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                  Preview do email que será enviado para {clientEmail}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 px-6 pb-6">
                {/* Assunto */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Assunto:</p>
                  <div className="p-3 bg-gray-50 border rounded-md text-sm font-medium text-gray-900">
                    {previewSubject}
                  </div>
                </div>

                {/* Conteúdo */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Conteúdo:</p>
                  <div 
                    className="p-6 bg-white border rounded-lg shadow-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewContent }} 
                  />
                </div>

                {/* Anexos */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Anexos ({attachments.length}):</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {attachments.map((att: any, index: number) => (
                        <a 
                          href={att.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          key={index} 
                          className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 border rounded-md transition-colors group"
                        >
                          <div className="p-2 bg-white rounded border group-hover:border-primary/50 transition-colors">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">
                            {att.fileName}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Botão de Envio */}
          <Button
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending || !template || (requiresScheduling && !scheduledDate)}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendEmailMutation.isPending ? "Enviando..." : wasAlreadySent ? "Reenviar" : "Enviar"}
          </Button>
        </div>

        {!template && (
          <p className="text-xs text-red-600">
            ⚠️ Template não configurado. Solicite ao administrador para configurar em /platform-admin/email-templates
          </p>
        )}
        
        {requiresScheduling && !scheduledDate && (
          <p className="text-xs text-amber-600">
            ⚠️ É necessário agendar uma data antes de enviar este email.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
