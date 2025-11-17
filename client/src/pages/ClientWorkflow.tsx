import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, CheckCircle2, Download, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { DocumentUpload } from "@/components/DocumentUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ClientWorkflow() {
  const { id: clientId } = useParams();
  const [, setLocation] = useLocation();
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);

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

  const handleDownloadEnxoval = () => {
    // TODO: Implementar geração de ZIP no backend
    toast.info("Funcionalidade de download do enxoval em desenvolvimento");
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

  const handleSchedulingUpdate = (stepId: number, scheduledDate: string, examinerName: string) => {
    updateSchedulingMutation.mutate({
      clientId: Number(clientId),
      stepId,
      scheduledDate,
      examinerName,
    });
  };



  if (!client || !workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Calcular progresso
  const totalSteps = workflow.length;
  const completedSteps = workflow.filter(s => s.completed).length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Organizar etapas em 3 fases
  const phases = [
    {
      title: "Fase 1: Cadastro e Boas-Vindas",
      steps: workflow.filter(s => ['cadastro', 'boas-vindas'].includes(s.stepId)),
    },
    {
      title: "Fase 2: Documentação",
      steps: workflow.filter(s => ['agendamento-psicotecnico', 'juntada-documento', 'agendamento-laudo'].includes(s.stepId)),
    },
    {
      title: "Fase 3: Finalização",
      steps: workflow.filter(s => ['despachante'].includes(s.stepId)),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              CPF: {client.cpf} | Telefone: {client.phone}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Progresso</p>
            <p className="text-2xl font-bold text-primary">{progress}%</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-8">
        <div className="space-y-8">
          {phases.map((phase, phaseIndex) => (
            <div key={phaseIndex} className="space-y-4">
              <h2 className="text-xl font-bold text-primary border-b pb-2">
                {phase.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {phase.steps.map((step) => {
                  const isExpanded = isStepExpanded(step.id);
                  const isBoasVindas = step.stepId === 'boas-vindas';
                  const isAgendamentoLaudo = step.stepId === 'agendamento-laudo';
                  const isDespachante = step.stepId === 'despachante';
                  const hasSubTasks = step.subTasks && step.subTasks.length > 0;

                  return (
                    <Card
                      key={step.id}
                      className={"transition-all " + (step.completed ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "")}
                    >
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={step.completed}
                            onCheckedChange={() => toggleStep(step.id, step.completed)}
                            className="h-5 w-5 mt-1"
                          />
                          <div className="flex-1">
                            <CardTitle className={"text-base " + (step.completed ? "line-through text-muted-foreground" : "")}>
                              {step.stepTitle}
                            </CardTitle>
                            {step.completed && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 inline-block ml-2" />
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {/* Boas Vindas - Botão de PDF */}
                        {isBoasVindas && (
                          <Button
                            onClick={handleGeneratePDF}
                            disabled={generatePDFMutation.isPending}
                            className="w-full"
                            variant="outline"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            {generatePDFMutation.isPending ? "Gerando..." : "Gerar PDF de Boas-Vindas"}
                          </Button>
                        )}

                        {/* Agendamento de Laudo - Campos de data e examinador */}
                        {isAgendamentoLaudo && (
                          <div className="space-y-3 border-t pt-3">
                            <div className="space-y-2">
                              <Label htmlFor="scheduledDate">Data do Agendamento</Label>
                              <Input
                                id="scheduledDate"
                                type="datetime-local"
                                defaultValue={step.scheduledDate ? new Date(step.scheduledDate).toISOString().slice(0, 16) : ''}
                                onBlur={(e) => {
                                  if (e.target.value) {
                                    handleSchedulingUpdate(step.id, e.target.value, step.examinerName || '');
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="examinerName">Nome do Examinador</Label>
                              <Input
                                id="examinerName"
                                type="text"
                                placeholder="Digite o nome do examinador"
                                defaultValue={step.examinerName || ''}
                                onBlur={(e) => {
                                  handleSchedulingUpdate(step.id, step.scheduledDate ? new Date(step.scheduledDate).toISOString() : '', e.target.value);
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Despachante - Botão de Download do Enxoval */}
                        {isDespachante && (
                          <Button
                            onClick={handleDownloadEnxoval}
                            disabled={false}
                            className="w-full"
                            variant="default"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Baixar Enxoval Completo
                          </Button>
                        )}

                        {/* Subtarefas (Documentos) */}
                        {hasSubTasks && (
                          <div className="space-y-2 border-t pt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpanded(step.id)}
                              className="w-full"
                            >
                              {isExpanded ? "Ocultar" : "Ver"} Documentos ({step.subTasks.filter(st => st.completed).length}/{step.subTasks.length})
                            </Button>
                            {isExpanded && (
                              <div className="space-y-3 max-h-96 overflow-y-auto">
                                {step.subTasks.map((subTask) => (
                                  <div key={subTask.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                                    <div className="flex items-start gap-2">
                                      <Checkbox
                                        checked={subTask.completed}
                                        onCheckedChange={() => toggleSubTask(subTask.id, subTask.completed)}
                                        className="mt-1"
                                      />
                                      <span className={"text-sm " + (subTask.completed ? "line-through text-muted-foreground" : "")}>
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
                              </div>
                            )}
                          </div>
                        )}

                        {/* Upload para etapas sem subtarefas (exceto Boas Vindas) */}
                        {!hasSubTasks && !isBoasVindas && (
                          <div className="border-t pt-3">
                            <DocumentUpload
                              clientId={Number(clientId)}
                              stepId={step.id}
                              stepTitle={step.stepTitle}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {progress === 100 && (
          <div className="mt-8 p-6 bg-green-50 dark:bg-green-950/20 border border-green-500 rounded-lg text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">
              Processo Concluído!
            </h3>
            <p className="text-green-600 dark:text-green-300">
              Todas as etapas do processo de CR foram finalizadas.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
