import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import JSZip from 'jszip';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Download, 
  FileText, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  Clock,
  User,
  Mail,
  Phone,
  Target,
  FolderOpen,
  Upload,
  CheckCircle,
  Circle
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { DocumentUpload } from "@/components/DocumentUpload";
import { EmailPreview } from "@/components/EmailPreview";
import { UploadModal } from "@/components/UploadModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ClientWorkflow() {
  const { id: clientId } = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [schedulingData, setSchedulingData] = useState<{[key: number]: {date: string, examiner: string}}>({});
  const [clientFormData, setClientFormData] = useState<Record<string, string>>({});
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedSubTask, setSelectedSubTask] = useState<{id: number, label: string, stepId: number} | null>(null);

  const { data: client } = trpc.clients.getById.useQuery(
    { id: Number(clientId) },
    { enabled: !!clientId && isAuthenticated }
  );

  const { data: workflow, refetch } = trpc.workflow.getByClient.useQuery(
    { clientId: Number(clientId) },
    { enabled: !!clientId && isAuthenticated }
  );

  const { data: emailTemplates, isLoading: templatesLoading, error: templatesError } = trpc.emails.getAllTemplates.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: documents } = trpc.documents.list.useQuery(
    { clientId: Number(clientId) },
    { enabled: !!clientId && isAuthenticated }
  );

  // Debug: Log de documentos
  useEffect(() => {
    console.log('Documentos carregados:', documents);
    console.log('Workflow:', workflow);
  }, [documents, workflow]);

  const updateStepMutation = trpc.workflow.updateStep.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Etapa atualizada com sucesso!");
    },
  });

  const updateSubTaskMutation = trpc.workflow.updateSubTask.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Documento atualizado!");
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
      toast.success("Agendamento atualizado!");
    },
  });

  const updateClientMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Dados do cliente atualizados com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadEnxovalMutation, setDownloadEnxovalMutation] = useState<{isPending: boolean}>({isPending: false});

  const handleDownloadEnxoval = async (stepId: number) => {
    if (isDownloading) return;
    
    try {
      setIsDownloading(true);
      setDownloadEnxovalMutation({isPending: true});
      toast.info("Buscando documentos...");

      const stepDocs = documents?.filter(doc => doc.workflowStepId === stepId) || [];
      
      if (!stepDocs || stepDocs.length === 0) {
        toast.error("Nenhum documento encontrado");
        setIsDownloading(false);
        setDownloadEnxovalMutation({isPending: false});
        return;
      }

      toast.info("Preparando download...");
      const zip = new JSZip();

      for (const doc of stepDocs) {
        try {
          const docResponse = await fetch(doc.fileUrl);
          const blob = await docResponse.blob();
          zip.file(doc.fileName, blob);
        } catch (error) {
          console.error(`Erro ao baixar ${doc.fileName}:`, error);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enxoval-${client?.name?.replace(/\s+/g, '-') || 'cliente'}.zip`;
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
      setDownloadEnxovalMutation({isPending: false});
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

  const handleClientDataUpdate = () => {
    if (!clientFormData.name || !clientFormData.cpf) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }
    updateClientMutation.mutate({
      id: Number(clientId),
      ...clientFormData,
    });
  };

  // Inicializar formulário com dados do cliente
  useEffect(() => {
    if (client) {
      setClientFormData({
        name: client.name || '',
        cpf: client.cpf || '',
        phone: client.phone || '',
        email: client.email || '',
        identityNumber: client.identityNumber || '',
        identityIssueDate: client.identityIssueDate || '',
        identityIssuer: client.identityIssuer || '',
        identityUf: client.identityUf || '',
        birthDate: client.birthDate || '',
        birthCountry: client.birthCountry || 'Brasil',
        birthUf: client.birthUf || '',
        birthPlace: client.birthPlace || '',
        gender: client.gender || '',
        profession: client.profession || '',
        otherProfession: client.otherProfession || '',
        registrationNumber: client.registrationNumber || '',
        currentActivities: client.currentActivities || '',
        phone2: client.phone2 || '',
        motherName: client.motherName || '',
        fatherName: client.fatherName || '',
        cep: client.cep || '',
        address: client.address || '',
        addressNumber: client.addressNumber || '',
        neighborhood: client.neighborhood || '',
        city: client.city || '',
        complement: client.complement || '',
      });
    }
  }, [client]);

  // Não expandir nenhuma etapa por padrão
  // useEffect removido - todas as atividades começam recolhidas

  if (!client || !workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando workflow...</p>
        </div>
      </div>
    );
  }

  // Calcular progresso por fase
  const fase1Steps = workflow.filter(s => s.stepTitle === "Cadastro" || s.stepTitle === "Boas Vindas");
  const fase2Steps = workflow.filter(s => 
    s.stepTitle === "Agendamento Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo" || 
    s.stepTitle === "Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)"
  );
  const fase3Steps = workflow.filter(s => 
    s.stepTitle === "Juntada de Documentos" || 
    s.stepTitle === "Acompanhamento Sinarm-CAC"
  );

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Moderno */}
      <header style={{backgroundColor: '#1c1c1c'}} className="border-b shadow-sm sticky top-0 z-10">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" style={{color: '#cfcece'}} className="hover:bg-gray-700">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 style={{color: '#faf9f9'}} className="text-3xl font-bold">{client.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm" style={{color: '#b8b7b7'}}>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {client.cpf}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {client.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {client.phone}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      <main className="container py-8 max-w-6xl">
        {/* Card de Progresso Geral */}
        <Card className="mb-8 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Target className="h-5 w-5 text-primary" />
              Progresso do Workflow
            </CardTitle>
            <CardDescription>Acompanhe o andamento de todas as etapas do processo</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Fases com Cards Individuais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Fase 1 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-blue-900">Cadastro/On-Boarding</h3>
                  <Badge variant={progressoFase1 === 100 ? "default" : "secondary"} className="bg-blue-600">
                    {progressoFase1}%
                  </Badge>
                </div>
                <Progress value={progressoFase1} className="h-2 bg-blue-200" />
                <p className="text-xs text-blue-700 mt-2">
                  {fase1Steps.filter(s => s.completed).length} de {fase1Steps.length} etapas
                </p>
              </div>

              {/* Fase 2 */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-amber-900">Documentação/Laudos</h3>
                  <Badge variant={progressoFase2 === 100 ? "default" : "secondary"} className="bg-amber-600">
                    {progressoFase2}%
                  </Badge>
                </div>
                <Progress value={progressoFase2} className="h-2 bg-amber-200" />
                <p className="text-xs text-amber-700 mt-2">
                  {fase2Steps.filter(s => s.completed).length} de {fase2Steps.length} etapas
                </p>
              </div>

              {/* Fase 3 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-green-900">Juntada-Sinarm-CAC</h3>
                  <Badge variant={progressoFase3 === 100 ? "default" : "secondary"} className="bg-green-600">
                    {progressoFase3}%
                  </Badge>
                </div>
                <Progress value={progressoFase3} className="h-2 bg-green-200" />
                <p className="text-xs text-green-700 mt-2">
                  {fase3Steps.filter(s => s.completed).length} de {fase3Steps.length} etapas
                </p>
              </div>
            </div>

            {/* Barra de Progresso Total */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progresso Geral</span>
                <span className="text-2xl font-bold text-primary">{progressoTotal}%</span>
              </div>
              <Progress value={progressoTotal} className="h-3" />
            </div>
          </CardContent>
        </Card>

        {/* Etapas do Workflow */}
        <div className="space-y-4">
          {workflow.map((step) => {
            const isExpanded = isStepExpanded(step.id);
            const completedSubTasks = step.subTasks?.filter(st => st.completed).length || 0;
            const totalSubTasks = step.subTasks?.length || 0;
            const subTaskProgress = totalSubTasks > 0 ? Math.round((completedSubTasks / totalSubTasks) * 100) : 0;

            return (
              <Card 
                key={step.id} 
                className={`shadow-md border-l-4 transition-all hover:shadow-lg ${
                  step.completed 
                    ? 'border-l-green-500 bg-green-50/50' 
                    : 'border-l-gray-300 bg-white'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={step.completed}
                        onCheckedChange={() => toggleStep(step.id, step.completed)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {step.completed && <CheckCircle className="h-5 w-5 text-green-600" />}
                          {!step.completed && <Circle className="h-5 w-5 text-gray-400" />}
                          {step.stepTitle || (
                            step.stepId === 'cadastro' ? 'Cadastro' :
                            step.stepId === 'boas-vindas' ? 'Boas Vindas' :
                            step.stepId === 'agendamento-psicotecnico' ? 'Agendamento Psicotécnico' :
                            step.stepId === 'juntada-documento' ? 'Juntada de Documento' :
                            step.stepId === 'agendamento-laudo' ? 'Agendamento de Laudo' :
                            step.stepId === 'despachante' ? 'Despachante' :
                            'Etapa'
                          )}
                        </CardTitle>
                        
                        {/* Sub-tarefas Progress */}
                        {totalSubTasks > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>{completedSubTasks} de {totalSubTasks} documentos</span>
                              <span className="font-semibold">{subTaskProgress}%</span>
                            </div>
                            <Progress value={subTaskProgress} className="h-1.5" />
                          </div>
                        )}
                        
                        {/* Indicador de Formulário para Cadastro */}
                        {step.stepTitle === "Cadastro" && (
                          <div className="mt-2">
                            <span className="text-xs text-teal-600 font-medium">
                              📋 Formulário de dados do cliente
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {step.completed && (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Concluído
                        </Badge>
                      )}
                      {(totalSubTasks > 0 || step.stepTitle === "Cadastro" || step.stepTitle === "Boas Vindas" || step.stepTitle === "Central de Mensagens" || step.stepId === "acompanhamento-sinarm" || step.stepTitle === "Exame de Capacidade Técnica" || step.stepTitle === "Avaliação Psicológica para Porte/Posse de Armas") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(step.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Conteúdo Expandido */}
                {isExpanded && (totalSubTasks > 0 || step.stepTitle === "Cadastro" || step.stepTitle === "Boas Vindas" || step.stepTitle === "Central de Mensagens" || step.stepId === "acompanhamento-sinarm" || step.stepTitle === "Juntada de Documentos" || step.stepTitle === "Exame de Capacidade Técnica" || step.stepTitle === "Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)" || step.stepTitle === "Avaliação Psicológica para Porte/Posse de Armas") && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    
                    {/* Sub-tarefas */}
                    {step.subTasks && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                        <FolderOpen className="h-4 w-4" />
                        Documentos Necessários
                      </div>
                      
                      {step.subTasks.map((subTask) => {
                        const subTaskDocs = documents?.filter(doc => doc.subTaskId === subTask.id) || [];
                        return (
                          <div key={subTask.id} className={`p-3 rounded-lg border ${subTask.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-start gap-3 justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <Checkbox checked={subTask.completed} onCheckedChange={() => toggleSubTask(subTask.id, subTask.completed)} className="mt-0.5" />
                                <div className="flex-1 min-w-0"><p className={`font-medium ${subTask.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>{subTask.label}</p></div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button variant="outline" size="sm" onClick={() => { setSelectedSubTask({ id: subTask.id, label: subTask.label, stepId: step.id }); setUploadModalOpen(true); }}><Upload className="h-3 w-3 mr-1" />Anexar</Button>
                                {subTask.completed && <CheckCircle className="h-5 w-5 text-green-600" />}
                              </div>
                            </div>
                            {subTaskDocs.length > 0 && (<div className="mt-3 ml-7 space-y-1 pt-3 border-t border-gray-200"><p className="text-xs font-semibold text-gray-600 mb-2">Documentos ({subTaskDocs.length}):</p>{subTaskDocs.map(doc => (<div key={doc.id} className="flex items-center gap-2 text-xs"><FileText className="h-3 w-3 text-blue-600 flex-shrink-0" /><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline truncate flex-1 min-w-0">{doc.fileName}</a><Button variant="ghost" size="sm" asChild className="h-5 w-5 p-0 flex-shrink-0"><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3" /></a></Button></div>))}</div>)}
                          </div>
                        );
                      })}
                      {step.subTasks && step.subTasks.length > 0 && (() => {
                        const allStepDocs = documents?.filter(doc => step.subTasks.some(st => st.id === doc.subTaskId)) || [];
                        if (allStepDocs.length > 0) {
                          return (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <Button onClick={() => handleDownloadEnxoval(step.id)} disabled={downloadEnxovalMutation.isPending} className="w-full">
                                {downloadEnxovalMutation.isPending ? <>Gerando...</> : <>Enxoval ({allStepDocs.length})</>
                                }
                              </Button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    )}



                    {/* Formulário de Cadastro */}
                    {step.stepTitle === "Cadastro" && (
                      <div className="mt-6 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-yellow-900 mb-4">
                          <User className="h-4 w-4" />
                          1. Confira os dados do Solicitante
                        </div>
                        
                        <div className="space-y-6">
                          {/* Nome Completo */}
                          <div>
                            <Label htmlFor="name" className="text-sm font-medium">Nome Completo</Label>
                            <Input
                              id="name"
                              value={clientFormData.name || ''}
                              onChange={(e) => setClientFormData(prev => ({ ...prev, name: e.target.value }))}
                              className="mt-1 font-semibold"
                            />
                          </div>

                          {/* Linha: Sexo */}
                          <div>
                            <Label className="text-sm font-medium">Sexo</Label>
                            <RadioGroup
                              value={clientFormData.gender || ''}
                              onValueChange={(value) => setClientFormData(prev => ({ ...prev, gender: value }))}
                              className="flex gap-4 mt-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="M" id="gender-m" />
                                <Label htmlFor="gender-m" className="cursor-pointer">M</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="F" id="gender-f" />
                                <Label htmlFor="gender-f" className="cursor-pointer">F</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Linha: CPF, Nº Identidade, Data de Expedição, Órgão Emissor, UF */}
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                              <Label htmlFor="cpf" className="text-sm font-medium text-teal-600">CPF</Label>
                              <Input
                                id="cpf"
                                value={clientFormData.cpf || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, cpf: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="identityNumber" className="text-sm font-medium text-teal-600">Nº Identidade</Label>
                              <Input
                                id="identityNumber"
                                value={clientFormData.identityNumber || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, identityNumber: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="identityIssueDate" className="text-sm font-medium text-teal-600">Data de Expedição</Label>
                              <Input
                                id="identityIssueDate"
                                type="date"
                                value={clientFormData.identityIssueDate || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, identityIssueDate: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="identityIssuer" className="text-sm font-medium text-teal-600">Órgão Emissor</Label>
                              <Input
                                id="identityIssuer"
                                placeholder="ssp"
                                value={clientFormData.identityIssuer || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, identityIssuer: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="identityUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="identityUf"
                                placeholder="DF"
                                maxLength={2}
                                value={clientFormData.identityUf || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, identityUf: e.target.value.toUpperCase() }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Data de Nascimento, País, UF, Local de Nascimento */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor="birthDate" className="text-sm font-medium text-teal-600">Data de Nascimento</Label>
                              <Input
                                id="birthDate"
                                type="date"
                                value={clientFormData.birthDate || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="birthCountry" className="text-sm font-medium text-teal-600">País</Label>
                              <Input
                                id="birthCountry"
                                value={clientFormData.birthCountry || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, birthCountry: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="birthUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="birthUf"
                                maxLength={2}
                                value={clientFormData.birthUf || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, birthUf: e.target.value.toUpperCase() }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="birthPlace" className="text-sm font-medium text-teal-600">Local de Nascimento</Label>
                              <Input
                                id="birthPlace"
                                value={clientFormData.birthPlace || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, birthPlace: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Profissão, Outra Profissão */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="profession" className="text-sm font-medium text-teal-600">Profissão</Label>
                              <Input
                                id="profession"
                                value={clientFormData.profession || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, profession: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="otherProfession" className="text-sm font-medium text-teal-600">Outra Profissão</Label>
                              <Input
                                id="otherProfession"
                                value={clientFormData.otherProfession || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, otherProfession: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Nr Registro, Atividade(s) Atual(is) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="registrationNumber" className="text-sm font-medium text-teal-600">Nr Registro</Label>
                              <Input
                                id="registrationNumber"
                                value={clientFormData.registrationNumber || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="currentActivities" className="text-sm font-medium text-teal-600">Atividade(s) Atual(is)</Label>
                              <Input
                                id="currentActivities"
                                value={clientFormData.currentActivities || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, currentActivities: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Telefone 1, Telefone 2, Email */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="phone" className="text-sm font-medium text-teal-600">Telefone 1</Label>
                              <Input
                                id="phone"
                                value={clientFormData.phone || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, phone: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="phone2" className="text-sm font-medium text-teal-600">Telefone 2</Label>
                              <Input
                                id="phone2"
                                value={clientFormData.phone2 || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, phone2: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="email" className="text-sm font-medium text-teal-600">Email</Label>
                              <Input
                                id="email"
                                type="email"
                                value={clientFormData.email || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, email: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Nome da Mãe */}
                          <div>
                            <Label htmlFor="motherName" className="text-sm font-medium text-teal-600">Nome da Mãe</Label>
                            <Input
                              id="motherName"
                              value={clientFormData.motherName || ''}
                              onChange={(e) => setClientFormData(prev => ({ ...prev, motherName: e.target.value }))}
                              className="mt-1"
                            />
                          </div>

                          {/* Linha: Nome do Pai */}
                          <div>
                            <Label htmlFor="fatherName" className="text-sm font-medium text-teal-600">Nome do Pai</Label>
                            <Input
                              id="fatherName"
                              value={clientFormData.fatherName || ''}
                              onChange={(e) => setClientFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                              className="mt-1"
                            />
                          </div>

                          {/* Linha: CEP, Endereço Residencial */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor="cep" className="text-sm font-medium text-teal-600">CEP</Label>
                              <Input
                                id="cep"
                                value={clientFormData.cep || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, cep: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div className="md:col-span-3">
                              <Label htmlFor="address" className="text-sm font-medium text-teal-600">Endereço Residencial</Label>
                              <Input
                                id="address"
                                value={clientFormData.address || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, address: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Bairro, Cidade */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="neighborhood" className="text-sm font-medium text-teal-600">Bairro</Label>
                              <Input
                                id="neighborhood"
                                value={clientFormData.neighborhood || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="city" className="text-sm font-medium text-teal-600">Cidade</Label>
                              <Input
                                id="city"
                                value={clientFormData.city || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, city: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Complemento */}
                          <div>
                            <Label htmlFor="complement" className="text-sm font-medium text-teal-600">Complemento</Label>
                            <Input
                              id="complement"
                              value={clientFormData.complement || ''}
                              onChange={(e) => setClientFormData(prev => ({ ...prev, complement: e.target.value }))}
                              className="mt-1"
                            />
                          </div>

                          {/* Botão Salvar */}
                          <Button
                            onClick={handleClientDataUpdate}
                            disabled={updateClientMutation.isPending}
                            className="w-full bg-primary hover:bg-primary/90"
                          >
                            {updateClientMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              'Salvar Dados do Cliente'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Agendamento */}
                    {(step.stepTitle === "Avaliação Psicológica para Porte/Posse de Armas" || step.stepTitle === "Exame de Capacidade Técnica" || step.stepTitle === "Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)") && (
                      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-3">
                          <Calendar className="h-4 w-4" />
                          Informações de Agendamento
                        </div>
                        
                        {step.scheduledDate ? (
                          <div className="space-y-3">
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-700" />
                                <span className="font-medium">Data e Hora:</span>
                                <span>{new Date(step.scheduledDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-amber-700" />
                                <span className="font-medium">Examinador:</span>
                                <span>{step.examinerName}</span>
                              </div>
                            </div>
                            
                            {/* Botão de envio de email - apenas para Exame de Capacidade Técnica */}
                            {(step.stepTitle === "Exame de Capacidade Técnica" || step.stepTitle === "Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)") && client && (
                              <EmailPreview
                                clientId={Number(clientId)}
                                clientEmail={client.email || ""}
                                clientName={client.name || "Cliente"}
                                templateKey="agendamento_laudo"
                                title="Confirmação de Agendamento de Laudo"
                                requiresScheduling={true}
                                scheduledDate={step.scheduledDate}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor={`date-${step.id}`} className="text-sm">Data e Hora do Agendamento</Label>
                              <Input
                                id={`date-${step.id}`}
                                type="datetime-local"
                                value={schedulingData[step.id]?.date || ''}
                                onChange={(e) => setSchedulingData(prev => ({
                                  ...prev,
                                  [step.id]: { ...prev[step.id], date: e.target.value }
                                }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`examiner-${step.id}`} className="text-sm">Nome do Examinador</Label>
                              <Input
                                id={`examiner-${step.id}`}
                                type="text"
                                placeholder="Digite o nome do examinador"
                                value={schedulingData[step.id]?.examiner || ''}
                                onChange={(e) => setSchedulingData(prev => ({
                                  ...prev,
                                  [step.id]: { ...prev[step.id], examiner: e.target.value }
                                }))}
                                className="mt-1"
                              />
                            </div>
                            <Button
                              onClick={() => handleSchedulingUpdate(step.id)}
                              disabled={updateSchedulingMutation.isPending}
                              className="w-full"
                            >
                              {updateSchedulingMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                'Salvar Agendamento'
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Acompanhamento Sinarm-CAC */}
                    {step.stepId === "acompanhamento-sinarm" && (
                      <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-purple-900 mb-4">
                          <Target className="h-4 w-4" />
                          Dados do Processo Sinarm-CAC
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="sinarmStatus" className="text-sm font-medium text-gray-700">Status do Processo</Label>
                            <Select
                              value={step.sinarmStatus || ""}
                              onValueChange={(value) => {
                                updateStepMutation.mutate({
                                  stepId: step.id,
                                  sinarmStatus: value,
                                });
                              }}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Solicitado">Solicitado</SelectItem>
                                <SelectItem value="Aguardando Baixa GRU">Aguardando Baixa GRU</SelectItem>
                                <SelectItem value="Em Análise">Em Análise</SelectItem>
                                <SelectItem value="Correção Solicitada">Correção Solicitada</SelectItem>
                                <SelectItem value="Deferido">Deferido</SelectItem>
                                <SelectItem value="Indeferido">Indeferido</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="protocolNumber" className="text-sm font-medium text-gray-700">Número de Protocolo</Label>
                            <Input
                              id="protocolNumber"
                              type="text"
                              placeholder="Ex: 2025/12345"
                              value={step.protocolNumber || ""}
                              onChange={(e) => {
                                updateStepMutation.mutate({
                                  stepId: step.id,
                                  protocolNumber: e.target.value,
                                });
                              }}
                              className="mt-1"
                            />
                          </div>
                          
                          {step.sinarmStatus && (
                            <div className="mt-4 p-3 bg-purple-100 rounded border border-purple-300">
                              <p className="text-sm text-purple-900">
                                <strong>Status Atual:</strong> {step.sinarmStatus}
                                {step.protocolNumber && (
                                  <span className="ml-2">| <strong>Protocolo:</strong> {step.protocolNumber}</span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Editores de Email - Central de Mensagens */}
                    {step.stepTitle === "Central de Mensagens" && (
                      <div className="mt-6 space-y-4">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Central de Mensagens</h3>
                          <p className="text-sm text-gray-600">Envie qualquer tipo de email para o cliente. Escolha o template apropriado abaixo.</p>
                        </div>

                        {templatesLoading && (
                          <div className="text-center py-8">
                            <Loader2 className="animate-spin h-8 w-8 mx-auto text-gray-400" />
                            <p className="text-sm text-gray-500 mt-2">Carregando templates...</p>
                          </div>
                        )}

                        {templatesError && (
                          <div className="text-center py-8 text-red-500">
                            <p>Erro ao carregar templates</p>
                            <p className="text-sm">{templatesError.message}</p>
                          </div>
                        )}

                        {!templatesLoading && !templatesError && emailTemplates?.map((template: any, index: number) => (
                          <EmailPreview
                            key={template.templateKey}
                            clientId={Number(clientId)}
                            clientEmail={client?.email || ""}
                            clientName={client?.name || "Cliente"}
                            templateKey={template.templateKey}
                            title={`${index + 1}. ${template.templateTitle || template.templateKey}`}
                          />
                        ))}

                        {!templatesLoading && !templatesError && (!emailTemplates || emailTemplates.length === 0) && (
                          <div className="text-center py-8 text-gray-500">
                            <p>Nenhum template de email configurado.</p>
                            <p className="text-sm">Acesse a página de Templates para criar novos templates.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </main>

      {/* Modal de Upload */}
      {selectedSubTask && (
        <UploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          clientId={Number(clientId)}
          stepId={selectedSubTask.stepId}
          subTaskId={selectedSubTask.id}
          subTaskLabel={selectedSubTask.label}
          onUploadSuccess={(subTaskId) => toggleSubTask(subTaskId, false)}
        />
      )}
    </div>
  );
}
