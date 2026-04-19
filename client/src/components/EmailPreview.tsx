import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, CheckCircle2 } from "lucide-react";
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
  hideActions?: boolean;
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
  hideActions = false,
}: EmailPreviewProps) {

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
        {/* Botão de Reenvio */}
        <Button
          onClick={handleSendEmail}
          disabled={sendEmailMutation.isPending || !template || (requiresScheduling && !scheduledDate)}
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          {sendEmailMutation.isPending ? "Enviando..." : wasAlreadySent ? "Reenviar Confirmação de Agendamento" : "Enviar Confirmação de Agendamento"}
        </Button>
        {requiresScheduling && !scheduledDate && (
          <p className="text-xs text-amber-600">
            ⚠️ É necessário agendar uma data antes de enviar este email.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
