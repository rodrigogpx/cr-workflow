import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  FileText, CheckCircle2, XCircle, Eye,
  ChevronDown, ChevronUp, Loader2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
    onSuccess: () => { utils.invalidate(); setApproveDialog(null); resetApproveState(); },
  });
  const rejectMut = (trpc as any).pendingDocuments.reject.useMutation({
    onSuccess: () => { utils.invalidate(); setRejectDialog(null); setRejectReason(""); },
  });

  const [expanded, setExpanded] = useState(true);

  // ── Rejeitar ───────────────────────────────────────────────────────────────
  const [rejectDialog, setRejectDialog] = useState<{ docId: number; fileName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ── Aprovar (com vínculo opcional) ────────────────────────────────────────
  const [approveDialog, setApproveDialog] = useState<{ docId: number; fileName: string } | null>(null);
  const [linkSubTask, setLinkSubTask] = useState("");
  const [renameFile, setRenameFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  function resetApproveState() {
    setLinkSubTask("");
    setRenameFile(false);
    setNewFileName("");
  }

  function handleSubTaskChange(value: string) {
    setLinkSubTask(value);
    const st = subTasks.find(s => String(s.id) === value);
    if (st && renameFile) {
      const ext = approveDialog?.fileName.includes(".")
        ? "." + approveDialog!.fileName.split(".").pop()
        : "";
      setNewFileName(st.label + ext);
    }
  }

  function handleRenameToggle(checked: boolean) {
    setRenameFile(checked);
    if (checked && linkSubTask) {
      const st = subTasks.find(s => String(s.id) === linkSubTask);
      if (st) {
        const ext = approveDialog?.fileName.includes(".")
          ? "." + approveDialog!.fileName.split(".").pop()
          : "";
        setNewFileName(st.label + ext);
      }
    } else {
      setNewFileName("");
    }
  }

  function handleApprove() {
    if (!approveDialog) return;
    approveMut.mutate({
      docId: approveDialog.docId,
      ...(linkSubTask
        ? {
            subTaskId: Number(linkSubTask),
            fileName: approveDialog.fileName,
            newFileName: renameFile && newFileName.trim() ? newFileName.trim() : undefined,
          }
        : {}),
    });
  }

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
                  {/* Visualizar */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-gray-600 border-gray-300 hover:bg-gray-50 h-7 text-xs"
                    asChild
                  >
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Eye className="w-3 h-3 mr-1" />
                      Visualizar
                    </a>
                  </Button>

                  {/* Aprovar */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700 border-green-300 hover:bg-green-50 h-7 text-xs"
                    onClick={() => {
                      resetApproveState();
                      setApproveDialog({ docId: doc.id, fileName: doc.fileName });
                    }}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Aprovar
                  </Button>

                  {/* Rejeitar */}
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

      {/* Dialog — Aprovar (com vínculo opcional) */}
      <Dialog open={!!approveDialog} onOpenChange={open => {
        if (!open) { setApproveDialog(null); resetApproveState(); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Aprovar documento
            </DialogTitle>
          </DialogHeader>

          {/* Nome do arquivo */}
          <div className="text-sm bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 truncate">
            <span className="font-medium text-gray-700">{approveDialog?.fileName}</span>
          </div>

          {/* Vínculo opcional à juntada */}
          {subTasks.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-600">
                  Vincular a um tipo de documento <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Select value={linkSubTask} onValueChange={handleSubTaskChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar tipo de documento na juntada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Não vincular —</SelectItem>
                    {subTasks.map(st => (
                      <SelectItem key={st.id} value={String(st.id)}>
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Opção de renomear, só se tiver subtask selecionada */}
              {linkSubTask && (
                <div className="border border-green-100 rounded-xl bg-green-50/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rename-check-approve"
                      checked={renameFile}
                      onCheckedChange={(v) => handleRenameToggle(!!v)}
                    />
                    <label
                      htmlFor="rename-check-approve"
                      className="text-sm text-gray-700 cursor-pointer flex items-center gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5 text-green-600" />
                      Renomear arquivo para o tipo do documento
                    </label>
                  </div>
                  {renameFile && (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Nome final do arquivo</Label>
                      <Input
                        value={newFileName}
                        onChange={e => setNewFileName(e.target.value)}
                        placeholder="Ex: Certidão de Antecedentes.pdf"
                        className="text-sm h-8"
                      />
                      <p className="text-[0.65rem] text-gray-400">A extensão original será preservada se não alterada.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveDialog(null); resetApproveState(); }}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApprove}
              disabled={approveMut.isPending}
            >
              {approveMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><CheckCircle2 className="w-4 h-4 mr-1.5" />Aprovar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
