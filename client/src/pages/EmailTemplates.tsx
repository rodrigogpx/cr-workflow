import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Mail } from "lucide-react";
import { toast } from "sonner";

export default function EmailTemplates() {
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();

  // Estados para os 3 templates
  const [welcomeSubject, setWelcomeSubject] = useState("Bem-vindo ao Firing Range!");
  const [welcomeContent, setWelcomeContent] = useState(
    `Olá {{nome}},\n\nSeja muito bem-vindo(a) ao Firing Range!\n\nEstamos muito felizes em tê-lo(a) conosco. O Firing Range é um clube de tiro e caça que oferece as melhores instalações, treinamentos profissionais e uma comunidade apaixonada por tiro esportivo.\n\n**Sobre o Firing Range:**\n- Instalações modernas e seguras\n- Instrutores certificados e experientes\n- Competições mensais para todos os níveis\n- Cursos de formação e aperfeiçoamento\n- Comunidade ativa e acolhedora\n\n**Competições:**\nParticipe de nossas competições mensais e teste suas habilidades! Temos categorias para iniciantes e atiradores experientes.\n\n**Cursos Disponíveis:**\n- Curso Básico de Tiro Esportivo\n- Curso de Manuseio Seguro de Armas\n- Curso de Tiro Defensivo\n- Curso de Tiro de Precisão\n\nEstamos à disposição para qualquer dúvida!\n\nAtenciosamente,\nEquipe Firing Range`
  );

  const [processCrSubject, setProcessCrSubject] = useState("Seu Processo de Obtenção do CR - Firing Range");
  const [processCrContent, setProcessCrContent] = useState(
    `Olá {{nome}},\n\nVamos explicar todo o processo de obtenção do Certificado de Registro (CR) para que você possa acompanhar cada etapa.\n\n**O que é o CR?**\nO Certificado de Registro (CR) é o documento que autoriza a posse de arma de fogo no Brasil. É emitido pela Polícia Federal após análise de documentação e cumprimento de requisitos legais.\n\n**Etapas do Processo:**\n\n1. **Cadastro e Documentação Inicial**\n   - Coleta de dados pessoais\n   - Verificação de documentos básicos\n\n2. **Avaliação Psicológica**\n   - Agendamento com clínica credenciada\n   - Realização do exame psicotécnico\n   - Obtenção do laudo aprovado\n\n3. **Juntada de Documentos**\n   - Certidões negativas (federal, estadual, militar)\n   - Comprovantes de residência e renda\n   - Declarações obrigatórias\n\n4. **Exame de Capacidade Técnica**\n   - Agendamento do exame prático\n   - Demonstração de conhecimento técnico\n   - Aprovação no teste de tiro\n\n5. **Protocolo na Polícia Federal**\n   - Envio de toda documentação\n   - Pagamento de taxas\n   - Acompanhamento do processo\n\n**Prazo Estimado:**\nO processo completo leva em média 3 a 6 meses, dependendo da agilidade na obtenção dos documentos e disponibilidade de agendamentos.\n\n**Importante:**\n- Mantenha seus documentos sempre atualizados\n- Responda prontamente às solicitações\n- Acompanhe o status do seu processo\n\nEstamos aqui para ajudar em cada etapa!\n\nAtenciosamente,\nEquipe Firing Range`
  );

  const [statusUpdateSubject, setStatusUpdateSubject] = useState("Atualização do seu Processo CR - Firing Range");
  const [statusUpdateContent, setStatusUpdateContent] = useState(
    `Olá {{nome}},\n\nSegue uma atualização sobre o andamento do seu processo de obtenção do CR.\n\n**Status Atual do Processo:**\n\nVocê já completou as seguintes etapas:\n✓ Cadastro realizado\n✓ Documentação inicial coletada\n\n**Próximos Passos:**\n\n1. Avaliação Psicológica\n   - Agende seu exame psicotécnico\n   - Compareça na data marcada\n   - Aguarde o laudo\n\n2. Juntada de Documentos\n   - Providencie as certidões necessárias\n   - Reúna comprovantes de residência e renda\n   - Preencha as declarações obrigatórias\n\n**Progresso Geral:** Aproximadamente 17% concluído\n\n**Documentos Pendentes:**\n- Certidão de Antecedentes Criminais (Federal)\n- Certidão de Antecedentes Criminais (Estadual)\n- Laudo Psicológico\n- Comprovante de Capacidade Técnica\n\n**Importante:**\nMantenha-se atento aos prazos e agende os exames com antecedência. Qualquer dúvida, entre em contato conosco!\n\n**Contato:**\nTelefone: (61) XXXX-XXXX\nEmail: contato@firingrange.com.br\nEndereço: DF-150, Km 08 - Sobradinho/DF\n\nEstamos acompanhando seu processo de perto!\n\nAtenciosamente,\nEquipe Firing Range`
  );

  const saveTemplateMutation = trpc.emails.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template salvo com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao salvar template: ${error.message}`);
    },
  });

  const handleSaveTemplate = (templateKey: string, subject: string, content: string) => {
    saveTemplateMutation.mutate({
      templateKey,
      subject,
      content,
    });
  };

  // Verificar se é admin
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Apenas administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/dashboard")}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Templates de Email</h1>
                <p className="text-sm text-gray-600">Edite os templates de email enviados aos clientes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Gerenciar Templates
            </CardTitle>
            <CardDescription>
              Use <code className="bg-gray-100 px-1 rounded">{"{{nome}}"}</code> para inserir o nome do cliente dinamicamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="welcome" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="welcome">Boas Vindas</TabsTrigger>
                <TabsTrigger value="process_cr">Processo CR</TabsTrigger>
                <TabsTrigger value="status_update">Atualização</TabsTrigger>
              </TabsList>

              {/* Template 1: Boas Vindas */}
              <TabsContent value="welcome" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="welcome-subject">Assunto do Email</Label>
                  <Input
                    id="welcome-subject"
                    value={welcomeSubject}
                    onChange={(e) => setWelcomeSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcome-content">Conteúdo do Email</Label>
                  <Textarea
                    id="welcome-content"
                    value={welcomeContent}
                    onChange={(e) => setWelcomeContent(e.target.value)}
                    placeholder="Conteúdo do email"
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={() => handleSaveTemplate("welcome", welcomeSubject, welcomeContent)}
                  disabled={saveTemplateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveTemplateMutation.isPending ? "Salvando..." : "Salvar Template"}
                </Button>
              </TabsContent>

              {/* Template 2: Processo CR */}
              <TabsContent value="process_cr" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="process-subject">Assunto do Email</Label>
                  <Input
                    id="process-subject"
                    value={processCrSubject}
                    onChange={(e) => setProcessCrSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="process-content">Conteúdo do Email</Label>
                  <Textarea
                    id="process-content"
                    value={processCrContent}
                    onChange={(e) => setProcessCrContent(e.target.value)}
                    placeholder="Conteúdo do email"
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={() => handleSaveTemplate("process_cr", processCrSubject, processCrContent)}
                  disabled={saveTemplateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveTemplateMutation.isPending ? "Salvando..." : "Salvar Template"}
                </Button>
              </TabsContent>

              {/* Template 3: Atualização de Status */}
              <TabsContent value="status_update" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="status-subject">Assunto do Email</Label>
                  <Input
                    id="status-subject"
                    value={statusUpdateSubject}
                    onChange={(e) => setStatusUpdateSubject(e.target.value)}
                    placeholder="Assunto do email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status-content">Conteúdo do Email</Label>
                  <Textarea
                    id="status-content"
                    value={statusUpdateContent}
                    onChange={(e) => setStatusUpdateContent(e.target.value)}
                    placeholder="Conteúdo do email"
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={() => handleSaveTemplate("status_update", statusUpdateSubject, statusUpdateContent)}
                  disabled={saveTemplateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveTemplateMutation.isPending ? "Salvando..." : "Salvar Template"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
