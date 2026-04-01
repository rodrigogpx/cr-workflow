import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { usePortalAuth } from "./usePortalAuth";
import {
  CheckCircle2, Circle, FileText, Eye,
  Clock, AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalDocumentos() {
  const [, navigate] = useLocation();
  const { client, lgpdAccepted, loading } = usePortalAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !client) navigate("/portal/login");
  }, [loading, client, navigate]);

  useEffect(() => {
    if (!loading && client && !lgpdAccepted) navigate("/portal/lgpd");
  }, [loading, client, lgpdAccepted, navigate]);

  useEffect(() => {
    if (!client) return;
    fetch("/api/portal/documentos", { credentials: "include" })
      .then(r => r.json())
      .then(data => setGroups(data.documents || []))
      .catch(() => setError("Erro ao carregar documentos."))
      .finally(() => setFetchLoading(false));
  }, [client]);

  const totalDocs = groups.length;
  const sent = groups.filter(g => g.documents.length > 0).length;
  const approved = groups.filter(g => g.completed).length;

  return (
    <PortalLayout title="Juntada de Documentos" loading={loading || fetchLoading}>
      {/* Resumo */}
      {groups.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-800">{totalDocs}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total</p>
          </div>
          <div className="bg-white border border-blue-100 rounded-xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{sent}</p>
            <p className="text-xs text-gray-500 mt-0.5">Enviados</p>
          </div>
          <div className="bg-white border border-green-100 rounded-xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{approved}</p>
            <p className="text-xs text-gray-500 mt-0.5">Aprovados</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Grid de documentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {groups.map((group) => {
          const hasDocs = group.documents.length > 0;
          const isApproved = group.completed;
          const firstDocUrl = hasDocs ? group.documents[0]?.fileUrl : null;

          return (
            <div
              key={group.id}
              className={`bg-white rounded-xl border shadow-sm px-3 py-2.5 flex items-center gap-3
                ${isApproved ? "border-green-200" : hasDocs ? "border-blue-200" : "border-gray-200"}`}
            >
              {/* Ícone de status */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                ${isApproved ? "bg-green-100" : hasDocs ? "bg-blue-100" : "bg-gray-100"}`}>
                {isApproved
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : hasDocs
                  ? <Clock className="h-4 w-4 text-blue-600" />
                  : <Circle className="h-4 w-4 text-gray-400" />
                }
              </div>

              {/* Nome + badge */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2">{group.label}</p>
                <div className="mt-0.5">
                  {isApproved && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Aprovado
                    </span>
                  )}
                  {!isApproved && hasDocs && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" /> Em análise
                    </span>
                  )}
                  {!isApproved && !hasDocs && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      <AlertCircle className="h-3 w-3" /> Pendente
                    </span>
                  )}
                </div>
              </div>

              {/* Contagem de arquivos + link de visualização */}
              {hasDocs && (
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">{group.documents.length} arq.</span>
                  {firstDocUrl && (
                    <a
                      href={firstDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-500 hover:text-purple-700"
                      title="Visualizar arquivo"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </a>
                  )}
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
