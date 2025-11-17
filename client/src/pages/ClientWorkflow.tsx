import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import JSZip from 'jszip';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Download, FileText, Calendar, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { DocumentUpload } from "@/components/DocumentUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ClientWorkflow() {
  const { id: clientId } = useParams();
  const [, setLocation] = useLocation();
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [schedulingData, setSchedulingData] = useState<{[key: number]: {date: string, examiner: string}}>({});

  const { data: client } = trpc.clients.getById.useQuery(
    { id: Number(clientId) },
    { enabled: !!clientId }
  );

  const { data: workflow, refetch } = trpc.workflow.getByClient.useQuery(
    { clientId: Number(clientId) },
    { enabled: !!clientId }
  );

  const updateStepMutation = trpc.workflow.updateStep.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Etapa atualizada");
    },
  });

  const updateSubTaskMutation = trpc.workflow.updateSubTask.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Documento atualizado");
    },
  });

  const generatePDFMutation = trpc.workflow.generateWelcomePDF.useMutation({
    onSuccess: (data) => {
      window.open(data.url, '_blank');
      toast.success("PDF gerado com sucesso!");
    },
  });

  const updateSchedulingMutation = trpc.workflow.updateScheduling.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Agendamento atualizado");
    },
  });

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadEnxoval = async () => {
    if (isDownloading) return;
    
    try {
      setIsDownloading(true);
      toast.info("Buscando documentos...");

      // Buscar documentos
      const response = await fetch(`/api/trpc/documents.downloadEnxoval?input=${encodeURIComponent(JSON.stringify({ clientId: Number(clientId) }))}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao buscar documentos');
      }

      const data = await response.json();
      const result = data.result.data;
      
      if (!result || result.documents.length === 0) {
        toast.error("Nenhum documento encontrado");
        setIsDownloading(false);
        return;
      }

      toast.info("Preparando download...");

      const zip = new JSZip();

      // Baixar e adicionar cada documento ao ZIP
      for (const doc of result.documents) {
        try {
          const docResponse = await fetch(doc.fileUrl);
          const blob = await docResponse.blob();
          zip.file(doc.fileName, blob);
        } catch (error) {
          console.error(`Erro ao baixar ${doc.fileName}:`, error);
        }
      }

      // Gerar o ZIP
      const content = await zip.generateAsync({ type: "blob" });

      // Criar link de download
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enxoval-${result.clientName.replace(/\s+/g, '-')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Download concluído!");
    } catch (error) {
      console.error('Erro ao baixar enxoval:', error);
      toast.error("Erro ao preparar download");
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleStep = (stepId: number, currentCompleted: boolean) => {
    updateStepMutation.mutate({
      clientId: Number(clientId),
      stepId,
      completed: !currentCompleted,
    });
  };

  const toggleSubTask = (subTaskId: number, currentCompleted: boolean) => {
    updateSubTaskMutation.mutate({
      clientId: Number(clientId),
      subTaskId,
      completed: !currentCompleted,
    });
  };

  const toggleExpanded = (stepId: number) => {
    setExpandedSteps(prev =>
      prev.includes(stepId)
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const isStepExpanded = (stepId: number) => expandedSteps.includes(stepId);

  const handleGeneratePDF = () => {
    generatePDFMutation.mutate({ clientId: Number(clientId) });
  };

  const handleSchedulingUpdate = (stepId: number) => {
    const data = schedulingData[stepId];
    if (!data?.date || !data?.examiner) {
      toast.error("Preencha data e nome do examinador");
      return;
    }
    updateSchedulingMutation.mutate({
      clientId: Number(clientId),
      stepId,
      scheduledDate: data.date,
      examinerName: data.examiner,
    });
  };

  if (!client || !workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Calcular progresso por fase
  const fase1Steps = workflow.filter(s => s.stepTitle === "Cadastro" || s.stepTitle === "Boas Vindas");
  const fase2Steps = workflow.filter(s => s.stepTitle === "Agendamento Psicotécnico" || s.stepTitle === "Juntada de Documento");
  const fase3Steps = workflow.filter(s => s.stepTitle === "Agendamento de Laudo" || s.stepTitle === "Despachante");

  const calcularProgressoFase = (steps: typeof workflow) => {
    if (steps.length === 0) return 0;
    const completed = steps.filter(s => s.completed).length;
    return Math.round((completed / steps.length) * 100);
  };

  const progressoFase1 = calcularProgressoFase(fase1Steps);
  const progressoFase2 = calcularProgressoFase(fase2Steps);
  const progressoFase3 = calcularProgressoFase(fase3Steps);
  const progressoTotal = calcularProgressoFase(workflow);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-dashed border-white/20 bg-black sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="text-white hover:text-primary">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white uppercase tracking-tight">{client.name}</h1>
                <p className="text-sm text-muted-foreground">{client.cpf} • {client.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Progresso Total</p>
                <p className="text-2xl font-bold text-primary">{progressoTotal}%</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-4xl">
        {/* Barra de Progresso Única Segmentada */}
        <Card className="border-2 border-dashed border-white/20 bg-card mb-8">
          <CardHeader>
            <CardTitle className="uppercase text-sm tracking-wide">Progresso do Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Labels das Fases */}
            <div className="flex justify-between mb-3">
              <div className="flex-1 text-center">
                <span className="text-xs font-bold uppercase text-muted-foreground">Cadastro</span>
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs font-bold uppercase text-muted-foreground">Documentação</span>
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs font-bold uppercase text-muted-foreground">Finalização</span>
              </div>
            </div>
            
            {/* Barra de Progresso Segmentada */}
            <div className="relative h-6 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-white/10">
              {/* Fase 1 */}
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out"
                style={{
                  width: `${(progressoFase1 / 3)}%`,
                  animation: 'pulse 2s ease-in-out infinite'
                }}
              />
              {/* Fase 2 */}
              <div 
                className="absolute left-[33.33%] top-0 h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out delay-150"
                style={{
                  width: `${(progressoFase2 / 3)}%`,
                  animation: 'pulse 2s ease-in-out infinite',
                  animationDelay: '0.3s'
                }}
              />
              {/* Fase 3 */}
              <div 
                className="absolute left-[66.66%] top-0 h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out delay-300"
                style={{
                  width: `${(progressoFase3 / 3)}%`,
                  animation: 'pulse 2s ease-in-out infinite',
                  animationDelay: '0.6s'
                }}
              />
              
              {/* Divisores entre fases */}
              <div className="absolute left-[33.33%] top-0 h-full w-0.5 bg-background z-10" />
              <div className="absolute left-[66.66%] top-0 h-full w-0.5 bg-background z-10" />
              
              {/* Porcentagens */}
              <div className="absolute inset-0 flex items-center justify-around z-20">
                <span className="text-xs font-bold text-white drop-shadow-lg">{progressoFase1}%</span>
                <span className="text-xs font-bold text-white drop-shadow-lg">{progressoFase2}%</span>
                <span className="text-xs font-bold text-white drop-shadow-lg">{progressoFase3}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow em Coluna Única */}
        <div className="space-y-4">
          {workflow.map((step) => {
            const isExpanded = isStepExpanded(step.id);
            const hasSubTasks = step.subTasks && step.subTasks.length > 0;
            const completedSubTasks = hasSubTasks ? step.subTasks.filter(st => st.completed).length : 0;
            const totalSubTasks = hasSubTasks ? step.subTasks.length : 0;

            return (
              <Card
                key={step.id}
                className="border-2 border-dashed border-white/20 bg-card hover:border-primary/50 transition-all duration-300"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={step.completed}
                        onCheckedChange={() => toggleStep(step.id, step.completed)}
                        className="border-2"
                      />
                      <div>
                        <CardTitle className={`text-lg uppercase tracking-tight ${step.completed ? 'line-through opacity-60' : ''}`}>
                          {step.stepTitle}
                        </CardTitle>
                        {hasSubTasks && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {completedSubTasks}/{totalSubTasks} documentos concluídos
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {step.completed && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {hasSubTasks && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(step.id)}
                          className="text-primary hover:text-primary/80"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && hasSubTasks && (
                  <CardContent className="space-y-3 border-t-2 border-dashed border-white/10 pt-4">
                    {step.subTasks.map((subTask) => (
                      <div key={subTask.id} className="border-2 border-dashed border-white/10 rounded-lg p-4 space-y-3 bg-background/50">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={subTask.completed}
                            onCheckedChange={() => toggleSubTask(subTask.id, subTask.completed)}
                            className="mt-1"
                          />
                          <span className={`text-sm font-medium ${subTask.completed ? "line-through opacity-60" : ""}`}>
                            {subTask.label}
                          </span>
                        </div>
                        <DocumentUpload
                          clientId={Number(clientId)}
                          stepId={step.id}
                          stepTitle={subTask.label}
                        />
                      </div>
                    ))}
                  </CardContent>
                )}

                {/* Botão PDF em Boas Vindas */}
                {step.stepTitle === "Boas Vindas" && !hasSubTasks && (
                  <CardContent className="border-t-2 border-dashed border-white/10 pt-4">
                    <Button
                      onClick={handleGeneratePDF}
                      disabled={generatePDFMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {generatePDFMutation.isPending ? "Gerando..." : "Gerar PDF de Boas-Vindas"}
                    </Button>
                  </CardContent>
                )}

                {/* Campos de Agendamento no Laudo */}
                {step.stepTitle === "Agendamento de Laudo" && !hasSubTasks && (
                  <CardContent className="border-t-2 border-dashed border-white/10 pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`date-${step.id}`} className="uppercase text-xs font-bold">Data do Agendamento</Label>
                        <Input
                          id={`date-${step.id}`}
                          type="date"
                          value={schedulingData[step.id]?.date || (step.scheduledDate ? new Date(step.scheduledDate).toISOString().split('T')[0] : "")}
                          onChange={(e) => setSchedulingData({...schedulingData, [step.id]: {...schedulingData[step.id], date: e.target.value}})}
                          className="border-2 border-dashed border-white/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`examiner-${step.id}`} className="uppercase text-xs font-bold">Nome do Examinador</Label>
                        <Input
                          id={`examiner-${step.id}`}
                          value={schedulingData[step.id]?.examiner || step.examinerName || ""}
                          onChange={(e) => setSchedulingData({...schedulingData, [step.id]: {...schedulingData[step.id], examiner: e.target.value}})}
                          className="border-2 border-dashed border-white/20"
                          placeholder="Nome completo"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSchedulingUpdate(step.id)}
                      disabled={updateSchedulingMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      {updateSchedulingMutation.isPending ? "Salvando..." : "Salvar Agendamento"}
                    </Button>
                  </CardContent>
                )}

                {/* Botão Download Enxoval no Despachante */}
                {step.stepTitle === "Despachante" && !hasSubTasks && (
                  <CardContent className="border-t-2 border-dashed border-white/10 pt-4">
                    <Button
                      onClick={handleDownloadEnxoval}
                      disabled={isDownloading}
                      className="w-full bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Preparando Download...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Enxoval Completo (ZIP)
                        </>
                      )}
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
