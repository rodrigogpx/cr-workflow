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
  Circle,
  Info,
  ExternalLink
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { toast } from "sonner";
import React, { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateClientSchema, type UpdateClientInput, formatCPF, formatPhone, formatCEP, isValidCPF } from "@shared/validations";
import { DocumentUpload } from "@/components/DocumentUpload";
import { EmailPreview } from "@/components/EmailPreview";
import { UploadModal } from "@/components/UploadModal";
import { Input } from "@/components/ui/input";
import Footer from "@/components/Footer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

function SinarmCommentsInline({ stepId }: { stepId: number }) {
  const { data: comments } = trpc.workflow.getSinarmCommentsHistory.useQuery(
    { stepId },
    { enabled: !!stepId }
  );

  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1">
        <FileText className="h-3.5 w-3.5" />
        Histórico de Comentários
      </p>
      {!comments || comments.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Nenhum comentário registrado.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {comments.map((c: any) => (
            <div key={c.id} className="p-2.5 bg-white rounded border border-purple-100 space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">{c.createdByName || 'Usuário'}</span>
                <span>{new Date(c.createdAt).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {c.oldStatus && (
                  <>
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{c.oldStatus}</span>
                    <span className="text-gray-400">→</span>
                  </>
                )}
                <span className="px-1.5 py-0.5 bg-purple-100 rounded text-purple-800 font-medium">{c.newStatus}</span>
              </div>
              {c.comment && (
                <p className="text-xs text-gray-600 mt-0.5">{c.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Informações sobre cada tipo de documento exigido na Juntada ─────────────
const DOCUMENT_INFO: Record<string, {
  description: string;
  issuer: string;
  link?: string;
  linkLabel?: string;
}> = {
  'Comprovante de Capacidade Técnica': {
    description: 'Certificado emitido por instrutor credenciado ou clube de tiro registrado no Exército Brasileiro, atestando aptidão técnica para manusear arma de fogo com segurança.',
    issuer: 'Instrutor credenciado / Clube de Tiro registrado no Exército',
  },
  'Certidão de Antecedente Criminal Justiça Federal': {
    description: 'Certidão que atesta a inexistência de antecedentes na Justiça Federal em todo território nacional. Emitida gratuitamente online pelo Conselho da Justiça Federal.',
    issuer: 'Conselho da Justiça Federal (CJF)',
    link: 'https://www.cjf.jus.br/cjf/certidoes',
    linkLabel: 'Emitir Certidão Federal (CJF)',
  },
  'Certidão de Antecedente Criminal Justiça Estadual': {
    description: 'Certidão de antecedentes criminais da Justiça Estadual. Cada estado possui seu próprio Tribunal de Justiça. Acesse o portal do CNJ para localizar o TJ do seu estado.',
    issuer: 'Tribunal de Justiça do Estado (TJ)',
    link: 'https://www.cnj.jus.br/certidao-negativa/',
    linkLabel: 'Portal CNJ – Certidões Estaduais',
  },
  'Certidão de Antecedente Criminal Justiça Militar': {
    description: 'Certidão negativa de crimes militares emitida pelo Superior Tribunal Militar (STM), cobrindo toda a Justiça Militar Federal do Brasil.',
    issuer: 'Superior Tribunal Militar (STM)',
    link: 'https://certidao.stm.jus.br/certidao/faces/index.xhtml',
    linkLabel: 'Emitir Certidão Militar (STM)',
  },
  'Certidão de Antecedente Criminal Justiça Eleitoral': {
    description: 'Certidão negativa de crimes eleitorais emitida pelo Tribunal Superior Eleitoral (TSE), atestando a inexistência de condenações na Justiça Eleitoral.',
    issuer: 'Tribunal Superior Eleitoral (TSE)',
    link: 'https://www.tse.jus.br/servicos-tse/certidao-de-crimes-eleitorais',
    linkLabel: 'Emitir Certidão Eleitoral (TSE)',
  },
  'Declaração de não estar respondendo': {
    description: 'Declaração pessoal assinada pelo requerente, sob as penas da lei, afirmando não responder a inquérito policial ou processo criminal em curso. Não é necessário reconhecimento de firma.',
    issuer: 'Declaração pessoal do requerente (assinada)',
  },
  'Documento de Identificação Pessoal': {
    description: 'Documento oficial com foto: RG (Carteira de Identidade Nacional), CNH (Carteira Nacional de Habilitação) ou Passaporte válido. Deve estar dentro da validade.',
    issuer: 'SSP (RG) / DETRAN (CNH) / Polícia Federal (Passaporte)',
  },
  'Laudo de Aptidão Psicológica': {
    description: 'Laudo emitido por psicólogo credenciado pelo CFP, atestando aptidão psicológica para posse ou porte de arma de fogo. Exigido pela Portaria SFPC nº 7/2023 e R-105.',
    issuer: 'Psicólogo credenciado pelo Conselho Federal de Psicologia (CFP)',
  },
  'Comprovante de Residência Fixa': {
    description: 'Documento comprovando residência fixa: conta de água, luz, gás, telefone ou extrato bancário em nome do requerente. Validade máxima de 3 meses.',
    issuer: 'Concessionárias de serviços públicos / Instituição bancária',
  },
  'Comprovante de Ocupação Lícita': {
    description: 'Comprova atividade profissional legal: CTPS com registro, contrato de trabalho, pró-labore, DECORE (profissionais liberais) ou declaração de autônomo com CNPJ ativo.',
    issuer: 'Empregador / Contador / Receita Federal',
  },
  'Comprovante de filiação a entidade de tiro desportivo': {
    description: 'Documento emitido pelo clube de tiro desportivo registrado no Exército Brasileiro, comprovando filiação ativa. O clube deve estar vinculado ao CBATIRO ou entidade equivalente.',
    issuer: 'Clube de tiro desportivo registrado no Exército / CBATIRO',
    link: 'https://www.cbatiro.org.br',
    linkLabel: 'CBATIRO – Confederação Brasileira de Tiro',
  },
  'Comprovante de filiação a entidade de caça': {
    description: 'Documento emitido por entidade de caça devidamente autorizada pelo IBAMA, comprovando que o requerente é membro ativo da modalidade de caça regulamentada.',
    issuer: 'Entidade de caça autorizada pelo IBAMA',
    link: 'https://www.gov.br/ibama/pt-br',
    linkLabel: 'Portal IBAMA',
  },
  'Comprovante da necessidade de abate de fauna invasora': {
    description: 'Documento expedido pelo IBAMA autorizando o controle de espécies invasoras em propriedade rural. Exigido para registro de armas destinadas ao manejo de fauna.',
    issuer: 'IBAMA – Instituto Brasileiro do Meio Ambiente',
    link: 'https://www.gov.br/ibama/pt-br/assuntos/fauna/controle-e-erradicacao',
    linkLabel: 'IBAMA – Controle de Fauna Invasora',
  },
  'Comprovante de Segundo Endereço': {
    description: 'Comprovante de um segundo endereço do requerente (imóvel de temporada, sítio, fazenda ou endereço comercial) para fins de cadastro no Exército Brasileiro.',
    issuer: 'Concessionárias / Documentos do imóvel',
  },
  'Declaração de Segurança do Acervo': {
    description: 'Declaração assinada pelo titular afirmando que as armas do acervo estão guardadas com segurança (cofre ou depósito adequado), conforme normas do Exército Brasileiro.',
    issuer: 'Declaração pessoal do requerente',
  },
  'Declaração com compromisso de comprovar a habitualidade': {
    description: 'Declaração exigida de atiradores desportivos, comprometendo-se a comprovar habitualidade de prática de tiro (mínimo de participações em competições), conforme R-105 e normas do Exército.',
    issuer: 'Declaração pessoal / Clube de tiro',
  },
};

/** Ícone ⓘ com balão de informação ao passar o mouse sobre o documento */
function DocumentInfoTooltip({ label }: { label: string }) {
  const key = Object.keys(DOCUMENT_INFO).find((k) => label.includes(k));
  const info = key ? DOCUMENT_INFO[key] : null;
  if (!info) return null;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
          aria-label={`Informações sobre: ${label}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-80 p-0 shadow-xl border border-blue-100 rounded-xl overflow-hidden"
      >
        {/* Cabeçalho */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
          <p className="text-xs font-semibold text-blue-800 leading-snug">{label}</p>
        </div>

        {/* Corpo */}
        <div className="px-4 py-3 space-y-2.5 bg-white">
          <p className="text-xs text-gray-600 leading-relaxed">{info.description}</p>

          <div className="flex items-start gap-1.5">
            <span className="text-[0.65rem] font-semibold text-gray-400 uppercase tracking-wide mt-0.5 shrink-0">Emitido por</span>
            <span className="text-xs text-gray-700">{info.issuer}</span>
          </div>

          {info.link && (
            <a
              href={info.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors w-full"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {info.linkLabel ?? 'Acessar portal de emissão'}
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function ClientWorkflow() {
  const { id: clientId } = useParams();
  const [, setLocation] = useLocation();
  const utils = trpc.useContext();
  const tenantSlug = useTenantSlug();
  const { user, isAuthenticated } = useAuth();
  const [expandedSteps, setExpandedSteps] = useState<number[]>([]);
  const [schedulingData, setSchedulingData] = useState<{[key: number]: {date: string, examiner: string}}>({});
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedSubTask, setSelectedSubTask] = useState<{id: number, label: string, stepId: number} | null>(null);

  const [isOutdatedDocDialogOpen, setIsOutdatedDocDialogOpen] = useState(false);
  const [outdatedDocInfo, setOutdatedDocInfo] = useState<{ outdated: any; latest: any } | null>(null);

  const [isSinarmStatusDialogOpen, setIsSinarmStatusDialogOpen] = useState(false);
  const [pendingSinarmStatusChange, setPendingSinarmStatusChange] = useState<{
    stepId: number;
    status: string;
    protocolNumber?: string;
    sinarmOpenDate?: string;
  } | null>(null);

  const [sinarmComment, setSinarmComment] = useState("");

  const { data: client } = trpc.clients.getById.useQuery(
    { id: Number(clientId) },
    { enabled: !!clientId && isAuthenticated }
  );

  const { data: documents } = trpc.documents.list.useQuery(
    { clientId: Number(clientId) },
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

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateClientInput>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: useMemo(() => {
      if (!client) return {};
      return {
        id: Number(clientId),
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
        maritalStatus: client.maritalStatus || '',
        requestType: client.requestType || '',
        cacNumber: client.cacNumber || '',
        cacCategory: client.cacCategory || '',
        previousCrNumber: client.previousCrNumber || '',
        psychReportValidity: client.psychReportValidity || '',
        techReportValidity: client.techReportValidity || '',
        residenceUf: client.residenceUf || '',
        cep: client.cep || '',
        address: client.address || '',
        addressNumber: client.addressNumber || '',
        neighborhood: client.neighborhood || '',
        city: client.city || '',
        complement: client.complement || '',
        latitude: client.latitude || '',
        longitude: client.longitude || '',
        acervoCep: client.acervoCep || '',
        acervoAddress: client.acervoAddress || '',
        acervoAddressNumber: client.acervoAddressNumber || '',
        acervoNeighborhood: client.acervoNeighborhood || '',
        acervoCity: client.acervoCity || '',
        acervoUf: client.acervoUf || '',
        acervoComplement: client.acervoComplement || '',
        acervoLatitude: client.acervoLatitude || '',
        acervoLongitude: client.acervoLongitude || '',
      };
    }, [client, clientId]),
  });

  useEffect(() => {
    if (client) {
      reset({
        id: Number(clientId),
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
        maritalStatus: client.maritalStatus || '',
        requestType: client.requestType || '',
        cacNumber: client.cacNumber || '',
        cacCategory: client.cacCategory || '',
        previousCrNumber: client.previousCrNumber || '',
        psychReportValidity: client.psychReportValidity || '',
        techReportValidity: client.techReportValidity || '',
        residenceUf: client.residenceUf || '',
        cep: client.cep || '',
        address: client.address || '',
        addressNumber: client.addressNumber || '',
        neighborhood: client.neighborhood || '',
        city: client.city || '',
        complement: client.complement || '',
        latitude: client.latitude || '',
        longitude: client.longitude || '',
        acervoCep: client.acervoCep || '',
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
  }, [client, clientId, reset]);

  const updateStepMutation = trpc.workflow.updateStep.useMutation({
    onSuccess: (data: any, variables: any) => {
      utils.workflow.getSinarmCommentsHistory.invalidate({ stepId: variables.stepId });
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

      const latestDocsByKey = new Map<string, any>();
      for (const doc of stepDocs) {
        const key = doc.subTaskId ? `subtask:${doc.subTaskId}` : `doc:${doc.id}`;
        const current = latestDocsByKey.get(key);
        if (!current || new Date(doc.createdAt).getTime() > new Date(current.createdAt).getTime()) {
          latestDocsByKey.set(key, doc);
        }
      }

      const latestStepDocs = Array.from(latestDocsByKey.values());
      
      if (!latestStepDocs || latestStepDocs.length === 0) {
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

      for (const doc of latestStepDocs) {
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

  const handleClientDataUpdate = (data: UpdateClientInput) => {
    updateClientMutation.mutate(data);
  };

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

  const calcularProgresso = (steps: any[]) => {
    if (steps.length === 0) return 0;
    const completed = steps.filter((s: any) => s.completed).length;
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
          {orderedWorkflow.map((step: any) => {
            const isExpanded = isStepExpanded(step.id);
            const completedSubTasks = step.subTasks?.filter((st: any) => st.completed).length || 0;
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
                        const subTaskDocsSorted = [...subTaskDocs].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                        const latestSubTaskDoc = subTaskDocsSorted[0] || null;
                        return (
                          <div key={subTask.id} className={`p-3 rounded-lg border ${subTask.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-start gap-3 justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                <Checkbox checked={subTask.completed} onCheckedChange={() => toggleSubTask(subTask.id, subTask.completed)} className="mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <p className={`font-medium ${subTask.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>{subTask.label}</p>
                                    <DocumentInfoTooltip label={subTask.label} />
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {user?.role !== 'despachante' && (
                                  <Button variant="outline" size="sm" onClick={() => { setSelectedSubTask({ id: subTask.id, label: subTask.label, stepId: step.id }); setUploadModalOpen(true); }}><Upload className="h-3 w-3 mr-1" />Anexar</Button>
                                )}
                                {subTask.completed && <CheckCircle className="h-5 w-5 text-green-600" />}
                              </div>
                            </div>
                            {subTaskDocsSorted.length > 0 && (
                              <div className="mt-3 ml-7 space-y-1 pt-3 border-t border-gray-200">
                                <p className="text-xs font-semibold text-gray-600 mb-2">Documentos ({subTaskDocsSorted.length}):</p>
                                {subTaskDocsSorted.map((doc: any) => {
                                  const isLatest = latestSubTaskDoc?.id === doc.id;
                                  const rowClass = isLatest
                                    ? ''
                                    : 'opacity-60 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.06),rgba(0,0,0,0.06)_6px,transparent_6px,transparent_12px)] rounded px-1';
                                  const nameClass = isLatest
                                    ? 'text-blue-600 font-medium hover:underline'
                                    : 'text-gray-700 font-medium line-through';

                                  return (
                                    <div key={doc.id} className={`flex items-center gap-2 text-xs ${rowClass}`}>
                                      <FileText className="h-3 w-3 text-blue-600 flex-shrink-0" />

                                      {isLatest ? (
                                        <a
                                          href={doc.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={`${nameClass} truncate flex-1 min-w-0`}
                                        >
                                          {doc.fileName}
                                        </a>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOutdatedDocInfo({ outdated: doc, latest: latestSubTaskDoc });
                                            setIsOutdatedDocDialogOpen(true);
                                          }}
                                          className={`${nameClass} truncate flex-1 min-w-0 text-left`}
                                        >
                                          {doc.fileName}
                                        </button>
                                      )}

                                      {isLatest && (
                                        <Button variant="ghost" size="sm" asChild className="h-5 w-5 p-0 flex-shrink-0">
                                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                            <Download className="h-3 w-3" />
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {step.subTasks && step.subTasks.length > 0 && (() => {
                        const allStepDocs = documents?.filter((doc: any) => step.subTasks.some((st: any) => st.id === doc.subTaskId)) || [];
                        const latestAllStepDocsMap = new Map<number, any>();
                        for (const doc of allStepDocs) {
                          if (!doc.subTaskId) continue;
                          const current = latestAllStepDocsMap.get(doc.subTaskId);
                          if (!current || new Date(doc.createdAt).getTime() > new Date(current.createdAt).getTime()) {
                            latestAllStepDocsMap.set(doc.subTaskId, doc);
                          }
                        }
                        const latestAllStepDocs = Array.from(latestAllStepDocsMap.values());
                        if (latestAllStepDocs.length > 0) {
                          return (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <Button onClick={() => handleDownloadEnxoval(step.id)} disabled={downloadEnxovalMutation.isPending} className="w-full">
                                {downloadEnxovalMutation.isPending
                                  ? 'Gerando...'
                                  : `Enxoval (${latestAllStepDocs.length})`
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
                      <form 
                        onSubmit={handleSubmit(handleClientDataUpdate)}
                        className="mt-6 p-6 bg-yellow-50 rounded-lg border border-yellow-200"
                      >
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
                                  {...register("name")}
                                  className={`mt-1 font-semibold ${errors.name ? 'border-red-500' : ''}`}
                                />
                                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Sexo</Label>
                                <Controller
                                  name="gender"
                                  control={control}
                                  render={({ field }: { field: any }) => (
                                    <RadioGroup
                                      value={field.value || ''}
                                      onValueChange={field.onChange}
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
                                  )}
                                />
                              </div>
                            </div>

                          {/* Linha: CPF, Nº Identidade, Data de Expedição, Órgão Emissor, UF */}
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                              <Label htmlFor="cpf" className="text-sm font-medium text-teal-600">Número de Inscrição (CPF)</Label>
                              <Input
                                id="cpf"
                                {...register("cpf")}
                                onChange={(e: any) => {
                                  const formatted = formatCPF(e.target.value);
                                  e.target.value = formatted;
                                  register("cpf").onChange(e);
                                }}
                                className={`mt-1 ${errors.cpf ? 'border-red-500' : ''}`}
                              />
                              {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="identityNumber" className="text-sm font-medium text-teal-600">Nº Identidade</Label>
                              <Input
                                id="identityNumber"
                                {...register("identityNumber")}
                                className={`mt-1 ${errors.identityNumber ? 'border-red-500' : ''}`}
                              />
                              {errors.identityNumber && <p className="text-xs text-red-500 mt-1">{errors.identityNumber.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="identityIssueDate" className="text-sm font-medium text-teal-600">Data de Expedição</Label>
                              <Input
                                id="identityIssueDate"
                                type="date"
                                {...register("identityIssueDate")}
                                className={`mt-1 ${errors.identityIssueDate ? 'border-red-500' : ''}`}
                              />
                              {errors.identityIssueDate && <p className="text-xs text-red-500 mt-1">{errors.identityIssueDate.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="identityIssuer" className="text-sm font-medium text-teal-600">Órgão Emissor</Label>
                              <Input
                                id="identityIssuer"
                                placeholder="ssp"
                                {...register("identityIssuer")}
                                className={`mt-1 ${errors.identityIssuer ? 'border-red-500' : ''}`}
                              />
                              {errors.identityIssuer && <p className="text-xs text-red-500 mt-1">{errors.identityIssuer.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="identityUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="identityUf"
                                placeholder="DF"
                                maxLength={2}
                                {...register("identityUf")}
                                onChange={(e: any) => {
                                  e.target.value = e.target.value.toUpperCase();
                                  register("identityUf").onChange(e);
                                }}
                                className={`mt-1 ${errors.identityUf ? 'border-red-500' : ''}`}
                              />
                              {errors.identityUf && <p className="text-xs text-red-500 mt-1">{errors.identityUf.message}</p>}
                            </div>
                          </div>

                          {/* Linha: Estado Civil */}
                          <div>
                            <Label htmlFor="maritalStatus" className="text-sm font-medium text-teal-600">Estado Civil</Label>
                            <Controller
                              name="maritalStatus"
                              control={control}
                              render={({ field }: { field: any }) => (
                                <Select
                                  value={field.value || ''}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger id="maritalStatus" className={`mt-1 ${errors.maritalStatus ? 'border-red-500' : ''}`}>
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
                              )}
                            />
                            {errors.maritalStatus && <p className="text-xs text-red-500 mt-1">{errors.maritalStatus.message}</p>}
                          </div>

                          {/* Linha: Data de Nascimento, País, UF, Local de Nascimento */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor="birthDate" className="text-sm font-medium text-teal-600">Data de Nascimento</Label>
                              <Input
                                id="birthDate"
                                type="date"
                                {...register("birthDate")}
                                className={`mt-1 ${errors.birthDate ? 'border-red-500' : ''}`}
                              />
                              {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="birthCountry" className="text-sm font-medium text-teal-600">País</Label>
                              <Input
                                id="birthCountry"
                                {...register("birthCountry")}
                                className={`mt-1 ${errors.birthCountry ? 'border-red-500' : ''}`}
                              />
                              {errors.birthCountry && <p className="text-xs text-red-500 mt-1">{errors.birthCountry.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="birthUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="birthUf"
                                maxLength={2}
                                {...register("birthUf")}
                                onChange={(e: any) => {
                                  e.target.value = e.target.value.toUpperCase();
                                  register("birthUf").onChange(e);
                                }}
                                className={`mt-1 ${errors.birthUf ? 'border-red-500' : ''}`}
                              />
                              {errors.birthUf && <p className="text-xs text-red-500 mt-1">{errors.birthUf.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="birthPlace" className="text-sm font-medium text-teal-600">Local de Nascimento</Label>
                              <Input
                                id="birthPlace"
                                {...register("birthPlace")}
                                className={`mt-1 ${errors.birthPlace ? 'border-red-500' : ''}`}
                              />
                              {errors.birthPlace && <p className="text-xs text-red-500 mt-1">{errors.birthPlace.message}</p>}
                            </div>
                          </div>

                          {/* Linha: Profissão, Outra Profissão */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="profession" className="text-sm font-medium text-teal-600">Profissão</Label>
                              <Input
                                id="profession"
                                {...register("profession")}
                                className={`mt-1 ${errors.profession ? 'border-red-500' : ''}`}
                              />
                              {errors.profession && <p className="text-xs text-red-500 mt-1">{errors.profession.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="otherProfession" className="text-sm font-medium text-teal-600">Outra Profissão</Label>
                              <Input
                                id="otherProfession"
                                {...register("otherProfession")}
                                className={`mt-1 ${errors.otherProfession ? 'border-red-500' : ''}`}
                              />
                              {errors.otherProfession && <p className="text-xs text-red-500 mt-1">{errors.otherProfession.message}</p>}
                            </div>
                          </div>

                          {/* Linha: Nº Registro, Atividade(s) Atual(is) */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="registrationNumber" className="text-sm font-medium text-teal-600">Nº Registro</Label>
                              <Input
                                id="registrationNumber"
                                {...register("registrationNumber")}
                                className={`mt-1 ${errors.registrationNumber ? 'border-red-500' : ''}`}
                              />
                              {errors.registrationNumber && <p className="text-xs text-red-500 mt-1">{errors.registrationNumber.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="currentActivities" className="text-sm font-medium text-teal-600">Atividade(s) Atual(is)</Label>
                              <Input
                                id="currentActivities"
                                {...register("currentActivities")}
                                className={`mt-1 ${errors.currentActivities ? 'border-red-500' : ''}`}
                              />
                              {errors.currentActivities && <p className="text-xs text-red-500 mt-1">{errors.currentActivities.message}</p>}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-yellow-200 space-y-4">
                            <div className="text-xs font-semibold text-yellow-900 uppercase tracking-wide">Dados do CR / CAC</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="requestType" className="text-sm font-medium text-teal-600">Tipo de Solicitação</Label>
                                <Controller
                                  name="requestType"
                                  control={control}
                                  render={({ field }: { field: any }) => (
                                    <Select
                                      value={field.value || ""}
                                      onValueChange={field.onChange}
                                    >
                                      <SelectTrigger className={`mt-1 ${errors.requestType ? 'border-red-500' : ''}`}>
                                        <SelectValue placeholder="Selecione" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Concessão">Concessão</SelectItem>
                                        <SelectItem value="Renovação">Renovação</SelectItem>
                                        <SelectItem value="2ª Via">2ª Via</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                {errors.requestType && <p className="text-xs text-red-500 mt-1">{errors.requestType.message}</p>}
                              </div>
                              <div>
                                <Label htmlFor="cacNumber" className="text-sm font-medium text-teal-600">Nº CAC</Label>
                                <Input
                                  id="cacNumber"
                                  {...register("cacNumber")}
                                  className={`mt-1 ${errors.cacNumber ? 'border-red-500' : ''}`}
                                />
                                {errors.cacNumber && <p className="text-xs text-red-500 mt-1">{errors.cacNumber.message}</p>}
                              </div>
                              <div>
                                <Label htmlFor="cacCategory" className="text-sm font-medium text-teal-600">Categoria CAC</Label>
                                <Input
                                  id="cacCategory"
                                  {...register("cacCategory")}
                                  className={`mt-1 ${errors.cacCategory ? 'border-red-500' : ''}`}
                                />
                                {errors.cacCategory && <p className="text-xs text-red-500 mt-1">{errors.cacCategory.message}</p>}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Label htmlFor="previousCrNumber" className="text-sm font-medium text-teal-600">Nº CR Anterior (se houver)</Label>
                                <Input
                                  id="previousCrNumber"
                                  {...register("previousCrNumber")}
                                  className={`mt-1 ${errors.previousCrNumber ? 'border-red-500' : ''}`}
                                />
                                {errors.previousCrNumber && <p className="text-xs text-red-500 mt-1">{errors.previousCrNumber.message}</p>}
                              </div>
                              <div>
                                <Label htmlFor="psychReportValidity" className="text-sm font-medium text-teal-600">Validade Laudo Psicológico</Label>
                                <Input
                                  id="psychReportValidity"
                                  type="date"
                                  {...register("psychReportValidity")}
                                  className={`mt-1 ${errors.psychReportValidity ? 'border-red-500' : ''}`}
                                />
                                {errors.psychReportValidity && <p className="text-xs text-red-500 mt-1">{errors.psychReportValidity.message}</p>}
                              </div>
                              <div>
                                <Label htmlFor="techReportValidity" className="text-sm font-medium text-teal-600">Validade Laudo Capacidade Técnica</Label>
                                <Input
                                  id="techReportValidity"
                                  type="date"
                                  {...register("techReportValidity")}
                                  className={`mt-1 ${errors.techReportValidity ? 'border-red-500' : ''}`}
                                />
                                {errors.techReportValidity && <p className="text-xs text-red-500 mt-1">{errors.techReportValidity.message}</p>}
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
                                {...register("phone")}
                                onChange={(e: any) => {
                                  const formatted = formatPhone(e.target.value);
                                  e.target.value = formatted;
                                  register("phone").onChange(e);
                                }}
                                className={`mt-1 ${errors.phone ? 'border-red-500' : ''}`}
                              />
                              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="phone2" className="text-sm font-medium text-teal-600">Telefone 2</Label>
                              <Input
                                id="phone2"
                                {...register("phone2")}
                                onChange={(e: any) => {
                                  const formatted = formatPhone(e.target.value);
                                  e.target.value = formatted;
                                  register("phone2").onChange(e);
                                }}
                                className={`mt-1 ${errors.phone2 ? 'border-red-500' : ''}`}
                              />
                              {errors.phone2 && <p className="text-xs text-red-500 mt-1">{errors.phone2.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="email" className="text-sm font-medium text-teal-600">Email</Label>
                              <Input
                                id="email"
                                type="email"
                                {...register("email")}
                                className={`mt-1 ${errors.email ? 'border-red-500' : ''}`}
                              />
                              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                            </div>
                          </div>

                          {/* Linha: Nome da Mãe */}
                          <div>
                            <Label htmlFor="motherName" className="text-sm font-medium text-teal-600">Nome da Mãe</Label>
                            <Input
                              id="motherName"
                              {...register("motherName")}
                              className="mt-1"
                            />
                          </div>

                          {/* Linha: Nome do Pai */}
                          <div>
                            <Label htmlFor="fatherName" className="text-sm font-medium text-teal-600">Nome do Pai</Label>
                            <Input
                              id="fatherName"
                              {...register("fatherName")}
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
                                {...register("cep")}
                                onChange={(e: any) => {
                                  const formatted = formatCEP(e.target.value);
                                  e.target.value = formatted;
                                  register("cep").onChange(e);
                                }}
                                className={`mt-1 ${errors.cep ? 'border-red-500' : ''}`}
                              />
                              {errors.cep && <p className="text-xs text-red-500 mt-1">{errors.cep.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="address" className="text-sm font-medium text-teal-600">Endereço Residencial</Label>
                              <Input
                                id="address"
                                {...register("address")}
                                className={`mt-1 ${errors.address ? 'border-red-500' : ''}`}
                              />
                              {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="addressNumber" className="text-sm font-medium text-teal-600">Nº</Label>
                              <Input
                                id="addressNumber"
                                {...register("addressNumber")}
                                className={`mt-1 ${errors.addressNumber ? 'border-red-500' : ''}`}
                              />
                              {errors.addressNumber && <p className="text-xs text-red-500 mt-1">{errors.addressNumber.message}</p>}
                            </div>
                          </div>

                          {/* Linha: Bairro, Cidade, UF */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="neighborhood" className="text-sm font-medium text-teal-600">Bairro</Label>
                              <Input
                                id="neighborhood"
                                {...register("neighborhood")}
                                className={`mt-1 ${errors.neighborhood ? 'border-red-500' : ''}`}
                              />
                              {errors.neighborhood && <p className="text-xs text-red-500 mt-1">{errors.neighborhood.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="city" className="text-sm font-medium text-teal-600">Cidade</Label>
                              <Input
                                id="city"
                                {...register("city")}
                                className={`mt-1 ${errors.city ? 'border-red-500' : ''}`}
                              />
                              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="residenceUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="residenceUf"
                                maxLength={2}
                                {...register("residenceUf")}
                                onChange={(e: any) => {
                                  e.target.value = e.target.value.toUpperCase();
                                  register("residenceUf").onChange(e);
                                }}
                                className={`mt-1 ${errors.residenceUf ? 'border-red-500' : ''}`}
                              />
                              {errors.residenceUf && <p className="text-xs text-red-500 mt-1">{errors.residenceUf.message}</p>}
                            </div>
                          </div>

                          {/* Linha: Complemento */}
                          <div>
                            <Label htmlFor="complement" className="text-sm font-medium text-teal-600">Complemento</Label>
                            <Input
                              id="complement"
                              {...register("complement")}
                              className={`mt-1 ${errors.complement ? 'border-red-500' : ''}`}
                            />
                            {errors.complement && <p className="text-xs text-red-500 mt-1">{errors.complement.message}</p>}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="latitude" className="text-sm font-medium text-teal-600">Latitude</Label>
                              <Input
                                id="latitude"
                                {...register("latitude")}
                                className={`mt-1 ${errors.latitude ? 'border-red-500' : ''}`}
                              />
                              {errors.latitude && <p className="text-xs text-red-500 mt-1">{errors.latitude.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="longitude" className="text-sm font-medium text-teal-600">Longitude</Label>
                              <Input
                                id="longitude"
                                {...register("longitude")}
                                className={`mt-1 ${errors.longitude ? 'border-red-500' : ''}`}
                              />
                              {errors.longitude && <p className="text-xs text-red-500 mt-1">{errors.longitude.message}</p>}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-yellow-200 text-xs font-semibold text-yellow-900 uppercase tracking-wide">Segundo Endereço do Acervo</div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor="acervoCep" className="text-sm font-medium text-teal-600">CEP</Label>
                              <Input
                                id="acervoCep"
                                {...register("acervoCep")}
                                onChange={(e: any) => {
                                  const formatted = formatCEP(e.target.value);
                                  e.target.value = formatted;
                                  register("acervoCep").onChange(e);
                                }}
                                className={`mt-1 ${errors.acervoCep ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoCep && <p className="text-xs text-red-500 mt-1">{errors.acervoCep.message}</p>}
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="acervoAddress" className="text-sm font-medium text-teal-600">Endereço</Label>
                              <Input
                                id="acervoAddress"
                                {...register("acervoAddress")}
                                className={`mt-1 ${errors.acervoAddress ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoAddress && <p className="text-xs text-red-500 mt-1">{errors.acervoAddress.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="acervoAddressNumber" className="text-sm font-medium text-teal-600">Nº</Label>
                              <Input
                                id="acervoAddressNumber"
                                {...register("acervoAddressNumber")}
                                className={`mt-1 ${errors.acervoAddressNumber ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoAddressNumber && <p className="text-xs text-red-500 mt-1">{errors.acervoAddressNumber.message}</p>}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="acervoNeighborhood" className="text-sm font-medium text-teal-600">Bairro</Label>
                              <Input
                                id="acervoNeighborhood"
                                {...register("acervoNeighborhood")}
                                className={`mt-1 ${errors.acervoNeighborhood ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoNeighborhood && <p className="text-xs text-red-500 mt-1">{errors.acervoNeighborhood.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="acervoCity" className="text-sm font-medium text-teal-600">Cidade</Label>
                              <Input
                                id="acervoCity"
                                {...register("acervoCity")}
                                className={`mt-1 ${errors.acervoCity ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoCity && <p className="text-xs text-red-500 mt-1">{errors.acervoCity.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="acervoUf" className="text-sm font-medium text-teal-600">UF</Label>
                              <Input
                                id="acervoUf"
                                maxLength={2}
                                {...register("acervoUf")}
                                onChange={(e: any) => {
                                  e.target.value = e.target.value.toUpperCase();
                                  register("acervoUf").onChange(e);
                                }}
                                className={`mt-1 ${errors.acervoUf ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoUf && <p className="text-xs text-red-500 mt-1">{errors.acervoUf.message}</p>}
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="acervoComplement" className="text-sm font-medium text-teal-600">Complemento</Label>
                            <Input
                              id="acervoComplement"
                              {...register("acervoComplement")}
                              className={`mt-1 ${errors.acervoComplement ? 'border-red-500' : ''}`}
                            />
                            {errors.acervoComplement && <p className="text-xs text-red-500 mt-1">{errors.acervoComplement.message}</p>}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="acervoLatitude" className="text-sm font-medium text-teal-600">Latitude</Label>
                              <Input
                                id="acervoLatitude"
                                {...register("acervoLatitude")}
                                className={`mt-1 ${errors.acervoLatitude ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoLatitude && <p className="text-xs text-red-500 mt-1">{errors.acervoLatitude.message}</p>}
                            </div>
                            <div>
                              <Label htmlFor="acervoLongitude" className="text-sm font-medium text-teal-600">Longitude</Label>
                              <Input
                                id="acervoLongitude"
                                {...register("acervoLongitude")}
                                className={`mt-1 ${errors.acervoLongitude ? 'border-red-500' : ''}`}
                              />
                              {errors.acervoLongitude && <p className="text-xs text-red-500 mt-1">{errors.acervoLongitude.message}</p>}
                            </div>
                          </div>

                          {/* Botão Salvar */}
                          <Button
                            type="submit"
                            disabled={updateClientMutation.isPending || !isDirty}
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
                      </form>
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
                            
                            {/* Botão de envio de email de confirmação */}
                            {client && (
                              <EmailPreview
                                clientId={Number(clientId)}
                                clientEmail={client.email || ""}
                                clientName={client.name || "Cliente"}
                                templateKey="agendamento_laudo"
                                title="Enviar Confirmação de Agendamento"
                                requiresScheduling={true}
                                scheduledDate={step.scheduledDate}
                                examinerName={step.examinerName}
                              />
                            )}
                            
                            {/* Botão para alterar agendamento */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updateSchedulingMutation.mutate({
                                  clientId: Number(clientId),
                                  stepId: step.id,
                                  scheduledDate: undefined,
                                  examinerName: undefined,
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
                          {/* Linha com 3 campos: Nº Protocolo | Data Abertura | Status */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label htmlFor="protocolNumber" className="text-sm font-medium text-gray-700">Número de Protocolo</Label>
                              <Input
                                id="protocolNumber"
                                type="text"
                                placeholder="Ex: 2025/12345"
                                defaultValue={step.protocolNumber || ""}
                                onBlur={(e: React.ChangeEvent<HTMLInputElement>) => {
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

                            <div>
                              <Label htmlFor="sinarmOpenDate" className="text-sm font-medium text-gray-700">Data de Abertura</Label>
                              <Input
                                id="sinarmOpenDate"
                                type="date"
                                defaultValue={step.sinarmOpenDate ? new Date(step.sinarmOpenDate).toISOString().split('T')[0] : ""}
                                onBlur={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const newVal = e.target.value;
                                  const currentVal = step.sinarmOpenDate ? new Date(step.sinarmOpenDate).toISOString().split('T')[0] : "";
                                  if (newVal !== currentVal) {
                                    updateStepMutation.mutate({
                                      stepId: step.id,
                                      sinarmOpenDate: newVal ? new Date(newVal).toISOString() : undefined,
                                    });
                                  }
                                }}
                                className="mt-1"
                              />
                            </div>

                            <div>
                              <Label htmlFor="sinarmStatus" className="text-sm font-medium text-gray-700">Status do Processo</Label>
                              <Select
                                value={step.sinarmStatus || ""}
                                onValueChange={(value: string) => {
                                  const protocolEl = document.getElementById("protocolNumber") as HTMLInputElement | null;
                                  const dateEl = document.getElementById("sinarmOpenDate") as HTMLInputElement | null;
                                  const hasProtocol = protocolEl?.value?.trim() || step.protocolNumber;
                                  const hasDate = dateEl?.value?.trim() || step.sinarmOpenDate;
                                  if (!hasProtocol || !hasDate) {
                                    toast.error("Para alterar o status, preencha o Número de Protocolo e a Data de Abertura.");
                                    return;
                                  }
                                  setPendingSinarmStatusChange({
                                    stepId: step.id,
                                    status: value,
                                    protocolNumber: protocolEl?.value?.trim() || step.protocolNumber || undefined,
                                    sinarmOpenDate: dateEl?.value?.trim()
                                      ? new Date(dateEl.value).toISOString()
                                      : step.sinarmOpenDate
                                        ? new Date(step.sinarmOpenDate).toISOString()
                                        : undefined,
                                  });
                                  setSinarmComment("");
                                  setIsSinarmStatusDialogOpen(true);
                                }}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Iniciado">Iniciado</SelectItem>
                                  <SelectItem value="Solicitado">Solicitado</SelectItem>
                                  <SelectItem value="Aguardando Baixa GRU">Aguardando Baixa GRU</SelectItem>
                                  <SelectItem value="Em Análise">Em Análise</SelectItem>
                                  <SelectItem value="Restituído">Restituído</SelectItem>
                                  <SelectItem value="Deferido">Deferido</SelectItem>
                                  <SelectItem value="Indeferido">Indeferido</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Modal de alteração de status */}
                          <Dialog open={isSinarmStatusDialogOpen} onOpenChange={setIsSinarmStatusDialogOpen}>
                            <DialogContent className="sm:max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Alterar status do SINARM</DialogTitle>
                                <DialogDescription>
                                  Você pode registrar um comentário sobre esta alteração (opcional).
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-2">
                                <Label htmlFor="sinarmComment" className="text-sm font-medium text-gray-700">
                                  Comentário (opcional)
                                </Label>
                                <Textarea
                                  id="sinarmComment"
                                  value={sinarmComment}
                                  onChange={(e) => setSinarmComment(e.target.value)}
                                  placeholder="Ex: enviado comprovante, aguardando retorno, etc."
                                />
                              </div>

                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setIsSinarmStatusDialogOpen(false);
                                    setPendingSinarmStatusChange(null);
                                    setSinarmComment("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (!pendingSinarmStatusChange) return;
                                    const trimmed = sinarmComment.trim();
                                    updateStepMutation.mutate({
                                      stepId: pendingSinarmStatusChange.stepId,
                                      sinarmStatus: pendingSinarmStatusChange.status,
                                      ...(pendingSinarmStatusChange.protocolNumber ? { protocolNumber: pendingSinarmStatusChange.protocolNumber } : {}),
                                      ...(pendingSinarmStatusChange.sinarmOpenDate ? { sinarmOpenDate: pendingSinarmStatusChange.sinarmOpenDate } : {}),
                                      ...(trimmed ? { sinarmComment: trimmed } : {}),
                                    });
                                    setIsSinarmStatusDialogOpen(false);
                                    setPendingSinarmStatusChange(null);
                                    setSinarmComment("");
                                  }}
                                  disabled={updateStepMutation.isPending || !pendingSinarmStatusChange}
                                >
                                  {updateStepMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Salvando...
                                    </>
                                  ) : (
                                    'Salvar'
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>

                          {/* Histórico de comentários inline (sempre visível) */}
                          <SinarmCommentsInline stepId={step.id} />
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

        <Dialog open={isOutdatedDocDialogOpen} onOpenChange={setIsOutdatedDocDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Documento desatualizado</DialogTitle>
              <DialogDescription>
                Existe um documento mais atual para este item. Este arquivo serve apenas para consulta.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Mais recente</span>
                <span className="font-medium text-right break-all">{outdatedDocInfo?.latest?.fileName || '-'}</span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Selecionado</span>
                <span className="font-medium text-right break-all">{outdatedDocInfo?.outdated?.fileName || '-'}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOutdatedDocDialogOpen(false)}>
                Fechar
              </Button>
              <Button
                onClick={() => {
                  if (outdatedDocInfo?.outdated?.fileUrl) {
                    window.open(outdatedDocInfo.outdated.fileUrl, '_blank');
                  }
                  setIsOutdatedDocDialogOpen(false);
                }}
              >
                Abrir para consulta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}
