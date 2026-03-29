import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  FileText, CheckCircle2, XCircle, Link2,
  ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  clientId: number;
  subTasks?: Array<{ id: number; label: string }>;
}

function formatBytes(b: number) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function PendingDocumentsQueue({ clientId, subTasks = [] }: Props) {
  const utils = trpc.useUtils();

  const { data: docs = [], isLoading, isError, error } = (trpc as any).pendingDocuments.list.useQuery(
    { clientId },
    { refetchInterval: 30_000 }
  );

  if (isError) {
    console.error("[PendingDocumentsQueue] Erro ao carregar documentos:", error);
  }

  const approveMut = (trpc as any).pendingDocuments.approve.useMutation({
    onSuccess: () => utils.invalidate(),
  });
  const rejectMut = (trpc as any).pendingDocuments.reject.useMutation({
    onSuccess: () => { utils.invalidate(); setRejectDialog(null); setRejectReason(""); },
  });
  const linkMut = (trpc as any).pendingDocuments.linkToSubTask.useMutation({
    onSuccess: () => { utils.invalidate(); setLinkDialog(null); setLinkSubTask(""); },
  });

  const [expanded, setExpanded] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{ docId: number; fileName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [linkDialog, setLinkDialog] = useState<{ docId: number; fileName: string } | null>(null);
  const [linkSubTask, setLinkSubTask] = useState("");

  if (isLoading) return null;
  if (isError) return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700 flex items-center gap-2">
      <span className="font-medium">Erro ao carregar fila de documentos.</span>
      <span className="text-red-500 text-xs">{(error as any)?.message ?? "Tente recarregar a página."}</span>
    </div>
  );
  if (!docs.length) return null;

  return (
    <>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden mb-6">
        {/* Cabeçalho colapsável */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-semibold text-amber-900">
              Documentos aguardando triagem ({docs.length})
            </span>
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-amber-600" />
            : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </button>

        {/* Lista de documentos */}
        {expanded && (
          <div className="divide-y divide-amber-100">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-4 bg-white gap-3">
                {/* Info do arquivo */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {formatBytes(doc.fileSize)}
                      {doc.fileSize ? " · " : ""}
                      Enviado por <strong>{doc.clientName ?? "cliente"}</strong>
                    </p>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver
                  </a>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50 h-7 text-xs"
                    onClick={() => approveMut.mutate({ docId: doc.id })}
                    disabled={approveMut.isPending}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Aprovar
                  </Button>

                  {subTasks.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-700 border-blue-300 hover:bg-blue-50 h-7 text-xs"
                      onClick={() => setLinkDialog({ docId: doc.id, fileName: doc.fileName })}
                    >
                      <Link2 className="w-3 h-3 mr-1" />
                      Vincular
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-700 border-red-300 hover:bg-red-50 h-7 text-xs"
                    onClick={() => {
                      setRejectReason("");
                      setRejectDialog({ docId: doc.id, fileName: doc.fileName });
                    }}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog — Rejeitar */}
      <Dialog open={!!rejectDialog} onOpenChange={open => !open && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar documento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 truncate">{rejectDialog?.fileName}</p>
          <Textarea
            placeholder="Motivo da rejeição (opcional — será enviado ao cliente)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectMut.mutate({ docId: rejectDialog!.docId, reason: rejectReason || undefined })
              }
              disabled={rejectMut.isPending}
            >
              {rejectMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : "Confirmar rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Vincular à juntada */}
      <Dialog open={!!linkDialog} onOpenChange={open => !open && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular à juntada</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 truncate">{linkDialog?.fileName}</p>
          <Select value={linkSubTask} onValueChange={setLinkSubTask}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar nicho / subetapa de destino" />
            </SelectTrigger>
            <SelectContent>
              {subTasks.map(st => (
                <SelectItem key={st.id} value={String(st.id)}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Cancelar</Button>
            <Button
              onClick={() =>
                linkMut.mutate({
                  docId: linkDialog!.docId,
                  subTaskId: Number(linkSubTask),
                  fileName: linkDialog!.fileName,
                })
              }
              disabled={!linkSubTask || linkMut.isPending}
            >
              {linkMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : "Vincular documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
