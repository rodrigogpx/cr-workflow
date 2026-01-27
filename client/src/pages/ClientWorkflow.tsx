import { useParams, useLocation } from "wouter";
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
import Footer from "@/components/Footer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

const isValidCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const formatCEP = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export default function ClientWorkflow() {
  const { id: clientId } = useParams();
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();
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

      // Buscar PDF com dados do cadastro
      try {
        const enxovalData = await trpc.documents.downloadEnxoval.query({ clientId: Number(clientId) });
        if (enxovalData.clientDataPdf) {
          const pdfBytes = Uint8Array.from(atob(enxovalData.clientDataPdf), c => c.charCodeAt(0));
          zip.file('00-Dados-do-Cadastro.pdf', pdfBytes);
        }
      } catch (pdfError) {
        console.error('Erro ao gerar PDF do cadastro:', pdfError);
      }

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
    const step = workflow?.find((s: any) => s.id === stepId);
    const isJuntadaStep =
      step?.stepId === 'juntada-documento' ||
      step?.stepId === 'juntada-documentos' ||
      step?.stepTitle?.toLowerCase?.().includes('juntada') === true;

    if (!currentCompleted && isJuntadaStep) {
      const subTasks = step?.subTasks || [];
      const missing = subTasks.filter((st: any) =>
        !(documents || []).some((d: any) => d.subTaskId === st.id)
      );

      if (subTasks.length > 0 && missing.length > 0) {
        toast.error('Para concluir a Juntada de Documentos, anexe todos os documentos obrigatórios.');
        return;
      }
    }

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
    const name = clientFormData.name?.trim();
    const cpfDigits = (clientFormData.cpf || "").replace(/\D/g, "");
    const email = clientFormData.email?.trim();
    const phoneDigits = (clientFormData.phone || "").replace(/\D/g, "");
    const phone2Digits = (clientFormData.phone2 || "").replace(/\D/g, "");
    const cepDigits = (clientFormData.cep || "").replace(/\D/g, "");
    const acervoCepDigits = (clientFormData.acervoCep || "").replace(/\D/g, "");

    // Validações obrigatórias
    if (!name || name.length < 2) {
      toast.error("Nome completo é obrigatório (mínimo 2 caracteres)");
      return;
    }

    if (!cpfDigits || cpfDigits.length !== 11) {
      toast.error("CPF é obrigatório e deve ter 11 dígitos");
      return;
    }

    if (!isValidCPF(cpfDigits)) {
      toast.error("CPF inválido. Verifique os dígitos.");
      return;
    }

    if (!email) {
      toast.error("Email é obrigatório");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Email inválido");
      return;
    }

    if (!phoneDigits) {
      toast.error("Telefone 1 é obrigatório");
      return;
    }

    if (!isValidPhone(phoneDigits)) {
      toast.error("Telefone 1 inválido (deve ter 10 ou 11 dígitos)");
      return;
    }

    // Validações opcionais (só valida se preenchido)
    if (phone2Digits && !isValidPhone(phone2Digits)) {
      toast.error("Telefone 2 inválido (deve ter 10 ou 11 dígitos)");
      return;
    }

    if (cepDigits && cepDigits.length !== 8) {
      toast.error("CEP deve ter 8 dígitos");
      return;
    }

    if (acervoCepDigits && acervoCepDigits.length !== 8) {
      toast.error("CEP do acervo deve ter 8 dígitos");
      return;
    }

    updateClientMutation.mutate({
      id: Number(clientId),
      ...clientFormData,
      name,
      cpf: cpfDigits,
      phone: phoneDigits,
      phone2: phone2Digits || undefined,
      cep: cepDigits || undefined,
      acervoCep: acervoCepDigits || undefined,
      email,
    });
  };

  // Inicializar formulário com dados do cliente
  useEffect(() => {
    if (client) {
      setClientFormData({
        name: client.name || '',
        cpf: client.cpf ? formatCPF(client.cpf) : '',
        phone: client.phone ? formatPhone(client.phone) : '',
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
        phone2: client.phone2 ? formatPhone(client.phone2) : '',
        motherName: client.motherName || '',
        fatherName: client.fatherName || '',
        maritalStatus: client.maritalStatus || '',
        requestType: client.requestType || '',
        cacNumber: client.cacNumber || '',
        cacCategory: client.cacCategory || '',
        previousCrNumber: client.previousCrNumber || '',
        psychReportValidity: client.psychReportValidity || '',
        techReportValidity: client.techReportValidity || '',
        residenceUf: client.residenceUf || '',
        cep: client.cep ? formatCEP(client.cep) : '',
        address: client.address || '',
        addressNumber: client.addressNumber || '',
        neighborhood: client.neighborhood || '',
        city: client.city || '',
        complement: client.complement || '',

        latitude: client.latitude || '',
        longitude: client.longitude || '',

        acervoCep: client.acervoCep ? formatCEP(client.acervoCep) : '',
        acervoAddress: client.acervoAddress || '',
        acervoAddressNumber: client.acervoAddressNumber || '',
        acervoNeighborhood: client.acervoNeighborhood || '',
        acervoCity: client.acervoCity || '',
        acervoUf: client.acervoUf || '',
        acervoComplement: client.acervoComplement || '',
        acervoLatitude: client.acervoLatitude || '',
        acervoLongitude: client.acervoLongitude || '',
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

  // Ordem das fases (UI e progress bar devem seguir exatamente esta ordem)
  // Obs: removida a fase "Central de Mensagens" (stepId: 'boas-vindas').
  const PHASES: Array<{ number: number; stepId: string; label: string }> = [
    { number: 1, stepId: 'cadastro', label: 'Cadastro' },
    { number: 2, stepId: 'agendamento-psicotecnico', label: 'Avaliação Psicológica' },
    { number: 3, stepId: 'agendamento-laudo', label: 'Laudo de Capacidade Técnica' },
    { number: 4, stepId: 'juntada-documento', label: 'Juntada de Documentos' },
    { number: 5, stepId: 'acompanhamento-sinarm', label: 'Submissão ao SINARM-CAC' },
  ];

  const calcularProgresso = (steps: typeof workflow) => {
    if (steps.length === 0) return 0;
    const completed = steps.filter(s => s.completed).length;
    return Math.round((completed / steps.length) * 100);
  };

  const orderedWorkflow = PHASES.map((p) => workflow.find((s: any) => s.stepId === p.stepId)).filter(Boolean) as any[];
  const progressoTotal = calcularProgresso(orderedWorkflow);
  const phaseStates = PHASES.map((def) => {
    const found = orderedWorkflow.find((s: any) => s.stepId === def.stepId);
    return {
      ...def,
      completed: Boolean(found?.completed),
      exists: Boolean(found),
    };
  });
  const nextPhaseNumber = (phaseStates.find(s => s.exists && !s.completed) || phaseStates.find(s => !s.completed) || null)?.number ?? null;

  return (
    <div className="min-h-screen">
      {/* Header Moderno */}
      <header style={{backgroundColor: '#1c1c1c'}} className="border-b shadow-sm sticky top-0 z-10">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                style={{color: '#cfcece'}}
                className="hover:bg-gray-700"
                onClick={() => setLocation(buildTenantPath(tenantSlug, "/cr-workflow"))}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 style={{color: '#faf9f9'}} className="text-3xl font-bold">{client.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm" style={{color: '#b8b7b7'}}>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {client.cpf && formatCPF(client.cpf)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {client.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {client.phone && formatPhone(client.phone)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      <main className="container py-8 max-w-6xl">
        <div className="space-y-8 rounded-2xl border border-white/10 bg-background/95 px-4 py-6 sm:px-6 sm:py-7 shadow-xl backdrop-blur-sm">
          {/* Card de Progresso Geral */}
          <Card className="mb-6 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Target className="h-5 w-5 text-primary" />
              Progresso do Workflow
            </CardTitle>
            <CardDescription>Acompanhe o andamento de todas as etapas do processo</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Progress Step Line */}
            <div className="relative">
              {/* Linha de conexão de fundo - do centro do primeiro ao centro do último círculo */}
              <div className="absolute top-5 h-1 bg-gray-200" style={{ left: '10%', right: '10%' }} />
              <div 
                className="absolute top-5 h-1 bg-primary transition-all duration-500"
                style={{ 
                  left: '10%',
                  width: `${Math.max(0, Math.min(100, progressoTotal)) * 0.8}%`
                }}
              />
              
              {/* Steps */}
              <div className="relative flex justify-between items-start gap-2">
                {phaseStates.map((s) => (
                  <div key={String(s.number)} className="flex flex-col items-center flex-1 min-w-0">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300
                      ${s.completed
                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                        : s.number === nextPhaseNumber
                          ? 'bg-white text-primary border-2 border-primary shadow-md'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                      }
                    `}>
                      {s.completed ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-bold">{s.number}</span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <h4 className={`font-semibold text-[0.7rem] leading-tight ${s.completed ? 'text-primary' : 'text-gray-700'}`}>
                        {s.label}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progresso Geral Compacto */}
            {(() => {
              const diasDesdeCadastro = client.createdAt 
                ? Math.floor((new Date().getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              return (
                <div className="mt-8 flex items-center justify-center gap-4 py-3 px-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-600">Progresso Geral</span>
                  <div className="relative w-48 h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ width: `${progressoTotal}%`, backgroundColor: '#4d9702' }}
                    />
                    <span 
                      className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                      style={{ color: progressoTotal >= 50 ? '#ffffff' : '#1c5c00', textShadow: progressoTotal >= 50 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}
                    >
                      {progressoTotal === 100 ? '✓ Concluído' : `${diasDesdeCadastro} ${diasDesdeCadastro === 1 ? 'dia' : 'dias'}`}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-primary">{progressoTotal}%</span>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Etapas do Workflow */}
        <div className="space-y-4">
          {orderedWorkflow.map((step) => {
            const isExpanded = isStepExpanded(step.id);
            const completedSubTasks = step.subTasks?.filter(st => st.completed).length || 0;
            const totalSubTasks = step.subTasks?.length || 0;
            const subTaskProgress = totalSubTasks > 0 ? Math.round((completedSubTasks / totalSubTasks) * 100) : 0;
            const isPsychEvaluationForwardStep =
              step.stepTitle?.includes("Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo") ?? false;
            const canExpand =
              isPsychEvaluationForwardStep ||
              totalSubTasks > 0 ||
              step.stepId === "cadastro" ||
              step.stepId === "agendamento-psicotecnico" ||
              step.stepId === "agendamento-laudo" ||
              step.stepId === "juntada-documento" ||
              step.stepId === "acompanhamento-sinarm";

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
                        className="mt-1 h-6 w-6"
                      />
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {step.stepTitle || (
                            step.stepId === 'cadastro' ? 'Cadastro' :
                            step.stepId === 'agendamento-psicotecnico' ? 'Avaliação Psicológica' :
                            step.stepId === 'juntada-documento' ? 'Juntada de Documentos' :
                            step.stepId === 'agendamento-laudo' ? 'Agendamento de Laudo' :
                            step.stepId === 'despachante' ? 'Despachante' :
                            step.stepId === 'acompanhamento-sinarm' ? 'Submissão ao SINARM-CAC' :
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
                      {canExpand && (
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
                {isExpanded && canExpand && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    
                    {/* Sub-tarefas */}
                    {step.subTasks && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                        <FolderOpen className="h-4 w-4" />
                        Documentos Necessários
                      </div>
                      
                      {[...step.subTasks].sort((a, b) => a.id - b.id).map((subTask) => {
                        const subTaskDocs = documents?.filter(doc => doc.subTaskId === subTask.id) || [];
                        return (
                          <div key={subTask.id} className={`p-3 rounded-lg border ${subTask.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-start gap-3 justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <Checkbox checked={subTask.completed} onCheckedChange={() => toggleSubTask(subTask.id, subTask.completed)} className="mt-0.5" />
                                <div className="flex-1 min-w-0"><p className={`font-medium ${subTask.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>{subTask.label}</p></div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {user?.role !== 'despachante' && (
                                  <Button variant="outline" size="sm" onClick={() => { setSelectedSubTask({ id: subTask.id, label: subTask.label, stepId: step.id }); setUploadModalOpen(true); }}><Upload className="h-3 w-3 mr-1" />Anexar</Button>
                                )}
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

                    {/* Upload de Documentos - Encaminhamento Avaliação Psicológica */}
                    {isPsychEvaluationForwardStep && (
                      <DocumentUpload 
                        clientId={Number(clientId)} 
                        stepId={step.id} 
                        stepTitle={step.stepTitle || "Encaminhamento de Avaliação Psicológica"} 
                      />
                    )}

                    {/* Formulário de Cadastro */}
                    {step.stepTitle === "Cadastro" && (
                      <div className="mt-6 p-6 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-yellow-900 mb-4">
                          <User className="h-4 w-4" />
                          1. Confira os dados do Solicitante
                        </div>
                        
                        <div className="space-y-6">
                            <div className="text-xs font-semibold text-yellow-900 uppercase tracking-wide">Dados pessoais</div>

                            {/* Nome Completo + Sexo */}
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
                              <div>
                                <Label htmlFor="name" className="text-sm font-medium">Nome Completo</Label>
                                <Input
                                  id="name"
                                  value={clientFormData.name || ''}
                                  onChange={(e) => setClientFormData(prev => ({ ...prev, name: e.target.value }))}
                                  className="mt-1 font-semibold"
                                />
                              </div>
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
                            </div>

                          {/* Linha: CPF, Nº Identidade, Data de Expedição, Órgão Emissor, UF */}
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                              <Label htmlFor="cpf" className="text-sm font-medium text-teal-600">Número de Inscrição (CPF)</Label>
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

                          {/* Linha: Estado Civil */}
                          <div>
                            <Label htmlFor="maritalStatus" className="text-sm font-medium text-teal-600">Estado Civil</Label>
                            <Select
                              value={clientFormData.maritalStatus || ''}
                              onValueChange={(value) => setClientFormData(prev => ({ ...prev, maritalStatus: value }))}
                            >
                              <SelectTrigger id="maritalStatus" className="mt-1">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                                <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                                <SelectItem value="União estável">União estável</SelectItem>
                                <SelectItem value="Separado(a)">Separado(a)</SelectItem>
                                <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                                <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                              </SelectContent>
                            </Select>
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

                          {/* Linha: Nº Registro, Atividade(s) Atual(is) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="registrationNumber" className="text-sm font-medium text-teal-600">Nº Registro</Label>
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

                          <div className="pt-4 border-t border-yellow-200 space-y-4">
                            <div className="text-xs font-semibold text-yellow-900 uppercase tracking-wide">Dados do CR / CAC</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="requestType" className="text-sm font-medium text-teal-600">Tipo de Solicitação</Label>
                                <Select
                                  value={clientFormData.requestType || ""}
                                  onValueChange={(value) => setClientFormData(prev => ({ ...prev, requestType: value }))}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Concessão">Concessão</SelectItem>
                                    <SelectItem value="Renovação">Renovação</SelectItem>
                                    <SelectItem value="2ª Via">2ª Via</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="cacNumber" className="text-sm font-medium text-teal-600">Nº CAC</Label>
                                <Input
                                  id="cacNumber"
                                  value={clientFormData.cacNumber || ''}
                                  onChange={(e) => setClientFormData(prev => ({ ...prev, cacNumber: e.target.value }))}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="cacCategory" className="text-sm font-medium text-teal-600">Categoria CAC</Label>
                                <Input
                                  id="cacCategory"
                                  value={clientFormData.cacCategory || ''}
                                  onChange={(e) => setClientFormData(prev => ({ ...prev, cacCategory: e.target.value }))}
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="previousCrNumber" className="text-sm font-medium text-teal-600">Nº CR Anterior (se houver)</Label>
                                <Input
                                  id="previousCrNumber"
                                  value={clientFormData.previousCrNumber || ''}
                                  onChange={(e) => setClientFormData(prev => ({ ...prev, previousCrNumber: e.target.value }))}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="psychReportValidity" className="text-sm font-medium text-teal-600">Validade Laudo Psicológico</Label>
                                <Input
                                  id="psychReportValidity"
                                  type="date"
                                  value={clientFormData.psychReportValidity || ''}
                                  onChange={(e) => setClientFormData(prev => ({ ...prev, psychReportValidity: e.target.value }))}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="techReportValidity" className="text-sm font-medium text-teal-600">Validade Laudo Capacidade Técnica</Label>
                                <Input
                                  id="techReportValidity"
                                  type="date"
                                  value={clientFormData.techReportValidity || ''}
                                  onChange={(e) => setClientFormData(prev => ({ ...prev, techReportValidity: e.target.value }))}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-yellow-200 text-xs font-semibold text-yellow-900 uppercase tracking-wide">Contato</div>
                          {/* Linha: Telefone 1, Telefone 2, Email */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="phone" className="text-sm font-medium text-teal-600">Telefone 1</Label>
                              <Input
                                id="phone"
                                value={clientFormData.phone || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="phone2" className="text-sm font-medium text-teal-600">Telefone 2</Label>
                              <Input
                                id="phone2"
                                value={clientFormData.phone2 || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, phone2: formatPhone(e.target.value) }))}
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

                          <div className="pt-4 border-t border-yellow-200 text-xs font-semibold text-yellow-900 uppercase tracking-wide">Endereço</div>
                          {/* Linha: CEP, Endereço Residencial, Nº */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor="cep" className="text-sm font-medium text-teal-600">CEP</Label>
                              <Input
                                id="cep"
                                value={clientFormData.cep || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, cep: formatCEP(e.target.value) }))}
                                className="mt-1"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="address" className="text-sm font-medium text-teal-600">Endereço Residencial</Label>
                              <Input
                                id="address"
                                value={clientFormData.address || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, address: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="addressNumber" className="text-sm font-medium text-teal-600">Nº</Label>
                              <Input
                                id="addressNumber"
                                value={clientFormData.addressNumber || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, addressNumber: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          {/* Linha: Bairro, Cidade, UF */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <div>
                              <Label htmlFor="residenceUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="residenceUf"
                                maxLength={2}
                                value={clientFormData.residenceUf || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, residenceUf: e.target.value.toUpperCase() }))}
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

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="latitude" className="text-sm font-medium text-teal-600">Latitude</Label>
                              <Input
                                id="latitude"
                                value={clientFormData.latitude || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, latitude: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="longitude" className="text-sm font-medium text-teal-600">Longitude</Label>
                              <Input
                                id="longitude"
                                value={clientFormData.longitude || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, longitude: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div className="pt-4 border-t border-yellow-200 text-xs font-semibold text-yellow-900 uppercase tracking-wide">Segundo Endereço do Acervo</div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor="acervoCep" className="text-sm font-medium text-teal-600">CEP</Label>
                              <Input
                                id="acervoCep"
                                value={clientFormData.acervoCep || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoCep: formatCEP(e.target.value) }))}
                                className="mt-1"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="acervoAddress" className="text-sm font-medium text-teal-600">Endereço</Label>
                              <Input
                                id="acervoAddress"
                                value={clientFormData.acervoAddress || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoAddress: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="acervoAddressNumber" className="text-sm font-medium text-teal-600">Nº</Label>
                              <Input
                                id="acervoAddressNumber"
                                value={clientFormData.acervoAddressNumber || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoAddressNumber: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="acervoNeighborhood" className="text-sm font-medium text-teal-600">Bairro</Label>
                              <Input
                                id="acervoNeighborhood"
                                value={clientFormData.acervoNeighborhood || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoNeighborhood: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="acervoCity" className="text-sm font-medium text-teal-600">Cidade</Label>
                              <Input
                                id="acervoCity"
                                value={clientFormData.acervoCity || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoCity: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="acervoUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="acervoUf"
                                maxLength={2}
                                value={clientFormData.acervoUf || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoUf: e.target.value.toUpperCase() }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="acervoComplement" className="text-sm font-medium text-teal-600">Complemento</Label>
                            <Input
                              id="acervoComplement"
                              value={clientFormData.acervoComplement || ''}
                              onChange={(e) => setClientFormData(prev => ({ ...prev, acervoComplement: e.target.value }))}
                              className="mt-1"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="acervoLatitude" className="text-sm font-medium text-teal-600">Latitude</Label>
                              <Input
                                id="acervoLatitude"
                                value={clientFormData.acervoLatitude || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoLatitude: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="acervoLongitude" className="text-sm font-medium text-teal-600">Longitude</Label>
                              <Input
                                id="acervoLongitude"
                                value={clientFormData.acervoLongitude || ''}
                                onChange={(e) => setClientFormData(prev => ({ ...prev, acervoLongitude: e.target.value }))}
                                className="mt-1"
                              />
                            </div>
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

                    {/* Agendamento de Laudo de Capacidade Técnica */}
                    {(step.stepTitle === "Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)" || step.stepTitle === "Exame de Capacidade Técnica") && (
                      <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-3">
                          <Calendar className="h-4 w-4" />
                          Agendamento de Laudo
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
                                <span>{step.examinerName || 'Não informado'}</span>
                              </div>
                            </div>
                            
                            {/* Botões de envio de email */}
                            {client && (
                              <div className="flex flex-col gap-2">
                                <EmailPreview
                                  clientId={Number(clientId)}
                                  clientEmail={client.email || ""}
                                  clientName={client.name || "Cliente"}
                                  templateKey="confirmacao_agendamento"
                                  title="Enviar Confirmação de Agendamento"
                                  requiresScheduling={true}
                                  scheduledDate={step.scheduledDate}
                                  examinerName={step.examinerName}
                                />
                                <EmailPreview
                                  clientId={Number(clientId)}
                                  clientEmail={client.email || ""}
                                  clientName={client.name || "Cliente"}
                                  templateKey="lembrete_agendamento"
                                  title="Enviar Lembrete de Agendamento"
                                  requiresScheduling={true}
                                  scheduledDate={step.scheduledDate}
                                  examinerName={step.examinerName}
                                />
                              </div>
                            )}
                            
                            {/* Botão para alterar agendamento */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updateStepMutation.mutate({
                                  stepId: step.id,
                                  scheduledDate: null,
                                  examinerName: null,
                                });
                              }}
                              className="mt-2"
                            >
                              Alterar Agendamento
                            </Button>
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
                              disabled={updateSchedulingMutation.isPending || !schedulingData[step.id]?.date}
                              className="w-full"
                            >
                              {updateSchedulingMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                'Confirmar Agendamento'
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Dados do Processo Sinarm-CAC */}
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
                              defaultValue={step.protocolNumber || ""}
                              onBlur={(e) => {
                                if (e.target.value !== (step.protocolNumber || "")) {
                                  updateStepMutation.mutate({
                                    stepId: step.id,
                                    protocolNumber: e.target.value,
                                  });
                                }
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

                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        </div>

        {uploadModalOpen && selectedSubTask && (
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
      </main>
      <Footer />
    </div>
  );
}
