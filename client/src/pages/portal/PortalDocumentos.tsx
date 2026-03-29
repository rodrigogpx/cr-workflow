import React, { useState, useEffect, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { usePortalAuth } from "./usePortalAuth";
import {
  CheckCircle2, Circle, FileText, Eye,
  Clock, AlertCircle, File, Upload, Info, ExternalLink, XCircle, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx";
const MAX_BYTES = 3 * 1024 * 1024;

// ─── Informações sobre cada tipo de documento exigido na Juntada ─────────────
const DOCUMENT_INFO: Record<string, { description: string; issuer: string; obs?: string; link?: string; linkLabel?: string }> = {
  'Documento de Identificação Pessoal': { description: 'RG, CNH ou outro documento oficial com foto. Deve estar dentro do prazo de validade.', issuer: 'SSP (RG) · DETRAN (CNH) · Polícia Federal (Passaporte)' },
  'Certidão de Antecedente Criminal Justiça Federal': { description: 'Comprova ausência de antecedentes na Justiça Federal. Gratuita e emitida online.', issuer: 'Conselho da Justiça Federal (CJF)', obs: 'Validade: 90 dias.', link: 'https://certidao-unificada.cjf.jus.br/', linkLabel: 'Emitir Certidão (CJF)' },
  'Certidão de Antecedente Criminal Justiça Estadual': { description: 'Comprova ausência de antecedentes na Justiça Estadual. Deve conter distribuição e execução criminal.', issuer: 'Tribunal de Justiça do Estado (TJ)', obs: 'Validade: 90 dias. Consulte o TJ do seu estado.', link: 'https://www.cnj.jus.br/certidao-negativa/', linkLabel: 'Portal CNJ' },
  'Certidão de Antecedente Criminal Justiça Eleitoral': { description: 'Certidão de crimes eleitorais emitida pelo TSE.', issuer: 'Tribunal Superior Eleitoral (TSE)', obs: 'Validade: 90 dias. Gratuita.', link: 'https://www.tse.jus.br/eleitor/certidoes/certidao-de-crimes-eleitorais', linkLabel: 'Emitir Certidão (TSE)' },
  'Certidão de Antecedente Criminal Justiça Militar': { description: 'Comprova ausência de antecedentes na Justiça Militar Federal.', issuer: 'Superior Tribunal Militar (STM)', obs: 'Validade: 90 dias.', link: 'https://www.stm.jus.br/servicos-stm/certidao-negativa', linkLabel: 'Emitir Certidão (STM)' },
  'Declaração de não estar respondendo': { description: 'Declaração formal afirmando que não responde a inquérito policial ou processo criminal.', issuer: 'Gerada automaticamente pelo SisGCorp', link: 'https://sisgcorp.eb.mil.br/#/solicitar-servico', linkLabel: 'Acessar SisGCorp' },
  'Declaração de Segurança do Acervo': { description: 'Declaração sobre condições de segurança do local onde as armas serão guardadas.', issuer: 'Gerada automaticamente pelo SisGCorp', link: 'https://sisgcorp.eb.mil.br/#/solicitar-servico', linkLabel: 'Acessar SisGCorp' },
  'Declaração com compromisso de comprovar a habitualidade': { description: 'Compromisso de comprovar habitualidade de prática de tiro. Exigido de atiradores desportivos.', issuer: 'Declaração pessoal / Clube de tiro registrado', obs: 'Dispensado para colecionadores.' },
  'Comprovante de Residência Fixa': { description: 'Conta de luz, água, telefone ou contrato de aluguel, em nome do requerente, com no máximo 90 dias.', issuer: 'Concessionárias de serviços públicos / Cartório' },
  'Comprovante de Ocupação Lícita': { description: 'Comprova atividade profissional: CTPS, contracheque, declaração de autônomo ou pró-labore.', issuer: 'Empregador / Contador / Órgão competente' },
  'Comprovante de Capacidade Técnica': { description: 'Certificado de aprovação em teste de tiro emitido por instrutor credenciado pela PF.', issuer: 'Instrutor credenciado pela PF / Clube de tiro', obs: 'Custo estimado: R$ 170 a R$ 450.', link: 'https://www.gov.br/pf/pt-br/assuntos/armas', linkLabel: 'PF – Instrutores credenciados' },
  'Laudo de Aptidão Psicológica': { description: 'Avaliação psicológica atestando aptidão para manuseio de arma de fogo.', issuer: 'Psicólogo credenciado pela PF', obs: 'Custo estimado: R$ 300 a R$ 800.', link: 'https://www.gov.br/pf/pt-br/assuntos/armas/psicologos/psicologos-crediciados', linkLabel: 'PF – Psicólogos credenciados' },
  'Comprovante de filiação a entidade de tiro desportivo': { description: 'Documento do clube comprovando filiação ativa na modalidade.', issuer: 'Clube de tiro desportivo registrado no Exército / CBATIRO', obs: 'Dispensado para colecionamento.', link: 'https://www.cbatiro.org.br', linkLabel: 'CBATIRO' },
  'Comprovante de filiação a entidade de caça': { description: 'Documento comprovando filiação ativa na modalidade de caça regulamentada.', issuer: 'Associação de caça reconhecida', obs: 'Dispensado para colecionamento.' },
  'Comprovante da necessidade de abate de fauna invasora': { description: 'Autorização do IBAMA para controle de espécie invasora em propriedade rural.', issuer: 'IBAMA', link: 'https://www.gov.br/ibama/pt-br/assuntos/fauna/controle-e-erradicacao', linkLabel: 'IBAMA – Controle de Fauna Invasora' },
  'Comprovante de Segundo Endereço': { description: 'Comprovante de segundo endereço do requerente (imóvel de temporada, fazenda, sítio ou endereço comercial).', issuer: 'Concessionárias de serviços / Documentos do imóvel' },
};

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
          className="inline-flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0 rounded focus:outline-none"
          aria-label={`Informações sobre: ${label}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-80 p-0 shadow-xl border border-blue-100 rounded-xl overflow-hidden z-50"
      >
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5">
          <p className="text-xs font-semibold text-blue-800 leading-snug">{key}</p>
        </div>
        <div className="px-4 py-3 space-y-2.5 bg-white">
          <p className="text-xs text-gray-600 leading-relaxed">{info.description}</p>
          <div className="flex items-start gap-1.5">
            <span className="text-[0.65rem] font-semibold text-gray-400 uppercase tracking-wide mt-0.5 shrink-0">Emitido por</span>
            <span className="text-xs text-gray-700">{info.issuer}</span>
          </div>
          {info.obs && (
            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
              <span className="text-xs text-amber-800 leading-snug">{info.obs}</span>
            </div>
          )}
          {info.link && (
            <a href={info.link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium group">
              <ExternalLink className="h-3 w-3 shrink-0" />
              {info.linkLabel ?? info.link}
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

type UploadStatus = "pending" | "linked" | "approved" | "rejected";

interface UploadedDoc {
  id: number;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  status: UploadStatus;
  rejectionReason?: string;
}

const STATUS_CONFIG: Record<UploadStatus, { label: string; className: string }> = {
  pending:  { label: "Aguardando análise", className: "bg-gray-100 text-gray-700" },
  linked:   { label: "Em triagem",         className: "bg-blue-100 text-blue-700" },
  approved: { label: "Aprovado ✓",         className: "bg-green-100 text-green-700" },
  rejected: { label: "Rejeitado",          className: "bg-red-100 text-red-700" },
};

export default function PortalDocumentos() {
  const [, navigate] = useLocation();
  const { client, lgpdAccepted, loading } = usePortalAuth();

  // --- existing: juntada groups ---
  const [groups, setGroups] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");

  // --- new: upload section ---
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- new: uploaded docs queue ---
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);

  // --- auth guards ---
  useEffect(() => {
    if (!loading && !client) navigate("/portal/login");
  }, [loading, client, navigate]);

  useEffect(() => {
    if (!loading && client && !lgpdAccepted) navigate("/portal/lgpd");
  }, [loading, client, lgpdAccepted, navigate]);

  // --- fetch juntada groups ---
  useEffect(() => {
    if (!client) return;
    fetch("/api/portal/documentos", { credentials: "include" })
      .then(r => r.json())
      .then(data => setGroups(data.documents || []))
      .catch(() => setError("Erro ao carregar documentos."))
      .finally(() => setFetchLoading(false));
  }, [client]);

  // --- fetch upload queue ---
  const fetchQueue = useCallback(() => {
    if (!client) return;
    fetch("/api/portal/documentos/fila", { credentials: "include" })
      .then(r => r.json())
      .then(data => setUploadedDocs(data.documents || []))
      .catch(() => {/* silently ignore — non-critical */})
      .finally(() => setQueueLoading(false));
  }, [client]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // --- juntada stats ---
  const totalDocs = groups.length;
  const sent = groups.filter(g => g.documents.length > 0).length;
  const approved = groups.filter(g => g.completed).length;

  // --- upload queue stats ---
  const approvedCount = uploadedDocs.filter(d => d.status === "approved").length;
  const progressPct = totalDocs > 0 ? Math.round((approvedCount / totalDocs) * 100) : 0;

  // --- drag-and-drop handlers ---
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }
  function handleDragLeave() { setDragging(false); }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    validateAndAdd(files);
  }
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    validateAndAdd(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function validateAndAdd(files: File[]) {
    const valid: File[] = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        toast.error(`"${file.name}" excede o limite de 3 MB e foi ignorado.`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) {
      setSelectedFiles(prev => [...prev, ...valid]);
    }
  }

  function removeFile(idx: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    let successCount = 0;
    for (let i = 0; i < selectedFiles.length; i++) {
      setUploadingIdx(i);
      const file = selectedFiles[i];
      try {
        await new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const res = await fetch("/api/portal/documentos/upload", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileName: file.name,
                  fileData: reader.result as string,
                  mimeType: file.type,
                }),
              });
              if (!res.ok) throw new Error();
              successCount++;
              resolve();
            } catch {
              toast.error(`Erro ao enviar "${file.name}".`);
              resolve();
            }
          };
          reader.onerror = () => reject();
          reader.readAsDataURL(file);
        });
      } catch {
        toast.error(`Erro ao ler "${file.name}".`);
      }
    }
    setUploadingIdx(null);
    setSelectedFiles([]);
    if (successCount > 0) {
      toast.success(`${successCount} documento${successCount > 1 ? "s" : ""} enviado${successCount > 1 ? "s" : ""} com sucesso!`);
      fetchQueue();
    }
  }

  return (
    <PortalLayout title="Juntada de Documentos" loading={loading || fetchLoading}>

      {/* ── Upload Section ─────────────────────────────────────── */}
      <Card className="mb-6 border border-gray-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-[#123A63]">
            <Upload className="h-4 w-4" />
            Enviar Documento
          </CardTitle>
          <p className="text-xs text-gray-500">Selecione o arquivo que deseja enviar ao operador</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${dragging ? "border-[#F37321] bg-orange-50" : "border-gray-300 hover:border-[#123A63] hover:bg-gray-50"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => uploadingIdx === null && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Clique para selecionar ou arraste aqui</p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, Word — máximo 3 MB por arquivo</p>
          </div>

          {/* Lista de arquivos selecionados */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-sm ${
                    uploadingIdx === idx
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {uploadingIdx === idx
                      ? <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                      : <File className="h-4 w-4 text-gray-400 shrink-0" />
                    }
                    <span className="truncate text-xs text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{formatBytes(file.size)}</span>
                  </div>
                  {uploadingIdx === null && (
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-2 shrink-0"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}
                  {uploadingIdx === idx && (
                    <span className="text-xs text-blue-600 shrink-0 ml-2">Enviando...</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full bg-[#F37321] hover:bg-orange-600 text-white"
            disabled={selectedFiles.length === 0 || uploadingIdx !== null}
            onClick={handleUpload}
          >
            {uploadingIdx !== null
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</>
              : `Enviar ${selectedFiles.length > 0 ? selectedFiles.length + " documento" + (selectedFiles.length > 1 ? "s" : "") : "Documento"}`
            }
          </Button>
        </CardContent>
      </Card>

      {/* ── Uploaded Docs Queue ─────────────────────────────────── */}
      {!queueLoading && uploadedDocs.length > 0 && (
        <Card className="mb-6 border border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#123A63]">Meus Documentos Enviados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {uploadedDocs.map(doc => {
              const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pending;
              return (
                <div key={doc.id} className="flex flex-col gap-1 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <File className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 truncate font-medium text-gray-700">{doc.fileName}</span>
                    {doc.fileSize > 0 && (
                      <span className="text-gray-400 flex-shrink-0">{formatBytes(doc.fileSize)}</span>
                    )}
                    <span className="text-gray-400 flex-shrink-0">{formatDateTime(doc.uploadedAt)}</span>
                    <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                  {doc.status === "rejected" && doc.rejectionReason && (
                    <p className="text-red-500 italic pl-5">{doc.rejectionReason}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Progress Bar ────────────────────────────────────────── */}
      {totalDocs > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-700 mb-2">
            Documentos aprovados: <strong>{approvedCount}</strong> de <strong>{totalDocs}</strong> requisitos
          </p>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-[#123A63] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">{progressPct}%</p>
        </div>
      )}

      {/* ── Summary Cards — stats dos meus uploads ──────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-800">{uploadedDocs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Enviados por mim</p>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-amber-600">
            {uploadedDocs.filter(d => d.status === "pending" || d.status === "linked").length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Em análise</p>
        </div>
        <div className="bg-white border border-green-100 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-green-600">
            {uploadedDocs.filter(d => d.status === "approved").length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Aprovados</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* ── Juntada List ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {groups.map((group) => {
          const hasDocs = group.documents.length > 0;
          const isApproved = group.completed;

          return (
            <div
              key={group.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden
                ${isApproved ? "border-green-200" : hasDocs ? "border-blue-200" : "border-gray-200"}`}
            >
              <div className="px-4 py-3 flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5
                  ${isApproved ? "bg-green-100" : hasDocs ? "bg-blue-100" : "bg-gray-100"}`}>
                  {isApproved
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : hasDocs
                    ? <Clock className="h-4 w-4 text-blue-600" />
                    : <Circle className="h-4 w-4 text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-800 leading-tight">{group.label}</p>
                    <DocumentInfoTooltip label={group.label} />
                  </div>
                  <div className="mt-1">
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Aprovado
                      </span>
                    )}
                    {!isApproved && hasDocs && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" /> Em análise
                      </span>
                    )}
                    {!isApproved && !hasDocs && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <AlertCircle className="h-3 w-3" /> Pendente
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {hasDocs && (
                <div className="border-t border-dashed border-gray-100 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Arquivo(s) enviado(s):</p>
                  {group.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                      <File className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 truncate font-medium">{doc.fileName}</span>
                      {doc.fileSize && (
                        <span className="text-gray-400 flex-shrink-0">{formatBytes(doc.fileSize)}</span>
                      )}
                      <span className="text-gray-400 flex-shrink-0">
                        {new Date(doc.uploadedAt).toLocaleDateString("pt-BR")}
                      </span>
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-purple-600 hover:text-purple-800"
                          title="Visualizar"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!hasDocs && (
                <div className="border-t border-dashed border-gray-100 px-4 py-2">
                  <p className="text-xs text-gray-400 italic">
                    Nenhum documento enviado. Entregue ao clube para que possam fazer o upload.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {groups.length === 0 && !fetchLoading && (
        <div className="text-center py-10 text-gray-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum documento solicitado ainda.</p>
        </div>
      )}

      <div className="mt-6">
        <button
          className="text-sm text-purple-600 hover:underline flex items-center gap-1"
          onClick={() => navigate("/portal")}
        >
          ← Voltar ao Portal
        </button>
      </div>
    </PortalLayout>
  );
}
