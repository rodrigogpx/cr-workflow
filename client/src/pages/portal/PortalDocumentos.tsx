import React, { useState, useEffect, useRef, useCallback, DragEvent, ChangeEvent } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { usePortalAuth } from "./usePortalAuth";
import {
  CheckCircle2, Circle, FileText, Eye,
  Clock, AlertCircle, File, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

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
const MAX_BYTES = 10 * 1024 * 1024;

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    const file = e.dataTransfer.files[0];
    if (file) validateAndSet(file);
  }
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSet(file);
  }

  function validateAndSet(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande. Máximo permitido: 10 MB.");
      return;
    }
    setSelectedFile(file);
  }

  function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/portal/documentos/upload", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileData: reader.result as string,
            mimeType: selectedFile.type,
          }),
        });
        if (!res.ok) throw new Error();
        toast.success("Documento enviado com sucesso!");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchQueue();
      } catch {
        toast.error("Erro ao enviar documento. Tente novamente.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(selectedFile);
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
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={handleFileChange}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                <File className="h-5 w-5 text-[#123A63]" />
                <span className="font-medium truncate max-w-xs">{selectedFile.name}</span>
                <span className="text-gray-400 flex-shrink-0">({formatBytes(selectedFile.size)})</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Clique para selecionar ou arraste aqui</p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, Word — máximo 10 MB</p>
              </>
            )}
          </div>

          <Button
            className="w-full bg-[#F37321] hover:bg-orange-600 text-white"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
          >
            {uploading ? "Enviando…" : "Enviar Documento"}
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
                  <p className="text-sm font-medium text-gray-800 leading-tight">{group.label}</p>
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
