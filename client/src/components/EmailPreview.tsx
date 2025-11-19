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
}

export function EmailPreview({
  clientId,
  clientEmail,
  clientName,
  templateKey,
  title,
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

  // Substituir {{nome}} pelo nome do cliente
  const previewSubject = template?.subject.replace(/\{\{nome\}\}/g, clientName) || "";
  const previewContent = template?.content.replace(/\{\{nome\}\}/g, clientName) || "";
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
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                  {attachments.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Anexos:</p>
                      <div className="space-y-2">
                        {attachments.map((att: any, index: number) => (
                          <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" key={index} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                            <FileText className="h-4 w-4" />
                            <span>{att.fileName}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                <DialogDescription>
                  Preview do email que será enviado para {clientEmail}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Assunto:</p>
                  <p className="text-sm bg-gray-50 p-3 rounded border">{previewSubject}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Conteúdo:</p>
                  <div className="text-sm bg-gray-50 p-4 rounded border" dangerouslySetInnerHTML={{ __html: previewContent.replace(/\n/g, '<br />') }} />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Botão de Envio */}
          <Button
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending || !template}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendEmailMutation.isPending ? "Enviando..." : wasAlreadySent ? "Reenviar" : "Enviar"}
          </Button>
        </div>

        {!template && (
          <p className="text-xs text-red-600">
            ⚠️ Template não configurado. Solicite ao administrador para configurar em /admin/email-templates
          </p>
        )}
      </CardContent>
    </Card>
  );
}
