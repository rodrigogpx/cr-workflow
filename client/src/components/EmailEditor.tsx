import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Send, CheckCircle2, Loader2 } from "lucide-react";

interface EmailEditorProps {
  clientId: number;
  clientEmail: string;
  templateKey: string;
  title: string;
  defaultSubject: string;
  defaultContent: string;
}

export function EmailEditor({
  clientId,
  clientEmail,
  templateKey,
  title,
  defaultSubject,
  defaultContent,
}: EmailEditorProps) {
  const [subject, setSubject] = useState(defaultSubject);
  const [content, setContent] = useState(defaultContent);
  const [isSending, setIsSending] = useState(false);

  // Check if email was already sent
  const { data: emailSent, refetch: refetchEmailSent } = trpc.emails.checkSent.useQuery({
    clientId,
    templateKey,
  });

  // Load saved template if exists
  const { data: savedTemplate } = trpc.emails.getTemplate.useQuery({
    templateKey,
  });

  // Update local state when template is loaded
  useEffect(() => {
    if (savedTemplate) {
      setSubject(savedTemplate.subject);
      setContent(savedTemplate.content);
    }
  }, [savedTemplate]);

  // Save template mutation
  const saveTemplateMutation = trpc.emails.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template salvo com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao salvar template: ${error.message}`);
    },
  });

  // Send email mutation
  const sendEmailMutation = trpc.emails.sendEmail.useMutation({
    onSuccess: () => {
      toast.success("Email enviado com sucesso!");
      refetchEmailSent();
      setIsSending(false);
    },
    onError: (error) => {
      toast.error(`Erro ao enviar email: ${error.message}`);
      setIsSending(false);
    },
  });

  const handleSaveTemplate = () => {
    saveTemplateMutation.mutate({
      templateKey,
      subject,
      content,
    });
  };

  const handleSendEmail = () => {
    if (!clientEmail) {
      toast.error("Cliente não possui email cadastrado!");
      return;
    }

    if (!subject.trim() || !content.trim()) {
      toast.error("Preencha o assunto e o conteúdo do email!");
      return;
    }

    setIsSending(true);

    // First save the template
    saveTemplateMutation.mutate(
      {
        templateKey,
        subject,
        content,
      },
      {
        onSuccess: () => {
          // Then send the email
          sendEmailMutation.mutate({
            clientId,
            templateKey,
            recipientEmail: clientEmail,
            subject,
            content,
          });
        },
        onError: () => {
          setIsSending(false);
        },
      }
    );
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {emailSent && (
            <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Enviado
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Para:
          </label>
          <Input
            value={clientEmail || "Email não cadastrado"}
            disabled
            className="bg-gray-50"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Assunto:
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Digite o assunto do email"
            disabled={emailSent}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Conteúdo:
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite o conteúdo do email"
            rows={10}
            className="font-mono text-sm"
            disabled={emailSent}
          />
        </div>

        {!emailSent && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSaveTemplate}
              disabled={saveTemplateMutation.isPending || isSending}
            >
              {saveTemplateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Template"
              )}
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isSending || !clientEmail}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Email
                </>
              )}
            </Button>
          </div>
        )}

        {emailSent && (
          <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-md border border-green-200">
            ✓ Este email já foi enviado para o cliente.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
