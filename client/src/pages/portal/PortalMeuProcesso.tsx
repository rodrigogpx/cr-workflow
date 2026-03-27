import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PortalLayout from "./PortalLayout";
import { usePortalAuth } from "./usePortalAuth";
import {
  CheckCircle2, Circle, Clock, Calendar, FileText,
  ChevronDown, ChevronUp, Target, ScrollText, ClipboardList
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Mapeamento de stepId para ícone e cor
const STEP_META: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  "boas-vindas":               { icon: ScrollText,    color: "text-blue-600",   bgColor: "bg-blue-50 border-blue-200" },
  "cadastro":                  { icon: ClipboardList, color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200" },
  "agendamento-psicotecnico":  { icon: Target,        color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200" },
  "agendamento-laudo":         { icon: Calendar,      color: "text-indigo-600", bgColor: "bg-indigo-50 border-indigo-200" },
  "juntada-documento":         { icon: FileText,      color: "text-pink-600",   bgColor: "bg-pink-50 border-pink-200" },
  "acompanhamento-sinarm":     { icon: Clock,         color: "text-green-600",  bgColor: "bg-green-50 border-green-200" },
};

const SINARM_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "sem-protocolo":   { label: "Aguardando Abertura",  color: "bg-gray-100 text-gray-700" },
  "solicitado":      { label: "Solicitado",           color: "bg-blue-100 text-blue-700" },
  "aguardando-gru":  { label: "Aguardando GRU",       color: "bg-yellow-100 text-yellow-700" },
  "em-analise":      { label: "Em Análise",           color: "bg-indigo-100 text-indigo-700" },
  "restituido":      { label: "Restituído",           color: "bg-orange-100 text-orange-700" },
  "deferido":        { label: "Deferido ✓",           color: "bg-green-100 text-green-700" },
  "indeferido":      { label: "Indeferido",           color: "bg-red-100 text-red-700" },
};

export default function PortalMeuProcesso() {
  const [, navigate] = useLocation();
  const { client, lgpdAccepted, loading } = usePortalAuth();
  const [steps, setSteps] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number[]>([]);

  useEffect(() => {
    if (!loading && !client) navigate("/portal/login");
  }, [loading, client, navigate]);

  useEffect(() => {
    if (!loading && client && !lgpdAccepted) navigate("/portal/lgpd");
  }, [loading, client, lgpdAccepted, navigate]);

  useEffect(() => {
    if (!client) return;
    fetch("/api/portal/meu-processo", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setSteps(data.steps || []);
        // Expandir automaticamente a etapa atual (última não concluída)
        const current = data.steps?.findIndex((s: any) => !s.completed);
        if (current >= 0) setExpanded([data.steps[current].id]);
      })
      .catch(() => setError("Erro ao carregar processo."))
      .finally(() => setFetchLoading(false));
  }, [client]);

  function toggleExpand(id: number) {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.completed).length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <PortalLayout title="Meu Processo" loading={loading || fetchLoading}>
      {/* Barra de progresso geral */}
      {steps.length > 0 && (
        <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">Progresso geral</span>
            <span className="text-sm font-bold text-purple-700">{completedSteps}/{totalSteps} etapas</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-purple-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progressPct}% concluído</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 z-0" />

        <div className="space-y-4">
          {steps.map((step, idx) => {
            const meta = STEP_META[step.stepId] || { icon: Circle, color: "text-gray-500", bgColor: "bg-gray-50 border-gray-200" };
            const Icon = meta.icon;
            const isExpanded = expanded.includes(step.id);
            const isCurrent = !step.completed && (idx === 0 || steps[idx - 1]?.completed);
            const subTasks = typeof step.subTasks === "string" ? JSON.parse(step.subTasks) : (step.subTasks || []);

            return (
              <div key={step.id} className="relative flex gap-4 z-10">
                {/* Ícone na linha */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center z-10
                  ${step.completed
                    ? "bg-green-500 border-green-500 text-white"
                    : isCurrent
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                  }`}>
                  {step.completed
                    ? <CheckCircle2 className="h-5 w-5" />
                    : <Icon className="h-5 w-5" />
                  }
                </div>

                {/* Card da etapa */}
                <div className={`flex-1 rounded-xl border shadow-sm overflow-hidden mb-1
                  ${step.completed ? "border-green-200 bg-green-50" : isCurrent ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-white"}`}>
                  <button
                    className="w-full text-left px-4 py-3 flex items-center justify-between"
                    onClick={() => toggleExpand(step.id)}
                  >
                    <div>
                      <p className={`font-semibold text-sm ${step.completed ? "text-green-800" : isCurrent ? "text-purple-800" : "text-gray-700"}`}>
                        {step.stepTitle}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {step.completed && (
                          <span className="text-xs text-green-600">
                            Concluído em {new Date(step.completedAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {isCurrent && !step.completed && (
                          <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                            ● Etapa atual
                          </span>
                        )}
                        {!step.completed && !isCurrent && (
                          <span className="text-xs text-gray-400">Aguardando</span>
                        )}
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-dashed border-gray-200 pt-3 space-y-3">
                      {/* Agendamento */}
                      {step.scheduledDate && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          <span>Agendado para: <strong>{new Date(step.scheduledDate).toLocaleDateString("pt-BR")}</strong></span>
                          {step.examinerName && <span className="text-gray-500">— {step.examinerName}</span>}
                        </div>
                      )}

                      {/* Status Sinarm */}
                      {step.stepId === "acompanhamento-sinarm" && step.sinarmStatus && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Status SINARM:</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SINARM_STATUS_LABELS[step.sinarmStatus]?.color || "bg-gray-100 text-gray-700"}`}>
                            {SINARM_STATUS_LABELS[step.sinarmStatus]?.label || step.sinarmStatus}
                          </span>
                          {step.protocolNumber && (
                            <span className="text-xs text-gray-500">Protocolo: {step.protocolNumber}</span>
                          )}
                        </div>
                      )}

                      {/* Sub-tarefas / documentos */}
                      {subTasks.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2">Itens ({subTasks.filter((s: any) => s.completed).length}/{subTasks.length} concluídos):</p>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {subTasks.map((st: any) => (
                              <div key={st.id} className="flex items-center gap-2 text-xs text-gray-600">
                                {st.completed
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  : <Circle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                }
                                <span className={st.completed ? "line-through text-gray-400" : ""}>{st.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {subTasks.length === 0 && !step.scheduledDate && !step.sinarmStatus && (
                        <p className="text-xs text-gray-400 italic">Nenhum detalhe disponível para esta etapa.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {steps.length === 0 && !fetchLoading && (
        <div className="text-center py-10 text-gray-400">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma etapa encontrada para o seu processo.</p>
        </div>
      )}

      {/* Navegação */}
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
