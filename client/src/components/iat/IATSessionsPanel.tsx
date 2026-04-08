import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Clock, MapPin, Plus, Pencil, Trash2, Users,
  CheckCircle2, Circle, XCircle, ClipboardList,
} from "lucide-react";
import IATAttendanceSheet from "./IATAttendanceSheet";

// ── Types ─────────────────────────────────────────────────────────────────────

type Session = {
  id: number;
  classId: number;
  sessionNumber: number;
  title: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  durationMinutes: number | null;
  location: string | null;
  status: string;
  notes: string | null;
  attendanceRecorded: boolean;
};

type SessionFormData = {
  sessionNumber: number;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  location: string;
  notes: string;
  status: "agendada" | "realizada" | "cancelada";
};

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; variant: string }> = {
  agendada:  { label: "Agendada",  icon: <Circle className="h-3 w-3" />,        variant: "outline" },
  realizada: { label: "Realizada", icon: <CheckCircle2 className="h-3 w-3" />,  variant: "default" },
  cancelada: { label: "Cancelada", icon: <XCircle className="h-3 w-3" />,       variant: "destructive" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.agendada;
  return (
    <Badge variant={cfg.variant as any} className="gap-1 text-xs">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

// ── Session Form Dialog ────────────────────────────────────────────────────────

function SessionFormDialog({
  classId,
  session,
  open,
  onClose,
}: {
  classId: number;
  session: Session | null;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const isEdit = Boolean(session);

  const emptyForm: SessionFormData = {
    sessionNumber: 1,
    title: "",
    scheduledDate: "",
    scheduledTime: "",
    durationMinutes: 60,
    location: "",
    notes: "",
    status: "agendada",
  };

  const [form, setForm] = useState<SessionFormData>(() =>
    session
      ? {
          sessionNumber: session.sessionNumber,
          title: session.title ?? "",
          scheduledDate: session.scheduledDate ?? "",
          scheduledTime: session.scheduledTime ?? "",
          durationMinutes: session.durationMinutes ?? 60,
          location: session.location ?? "",
          notes: session.notes ?? "",
          status: session.status as any,
        }
      : emptyForm
  );

  const createMutation = trpc.iat.sessions.create.useMutation({
    onSuccess: () => {
      utils.iat.sessions.list.invalidate({ classId });
      toast.success("Sessão criada com sucesso");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.iat.sessions.update.useMutation({
    onSuccess: () => {
      utils.iat.sessions.list.invalidate({ classId });
      toast.success("Sessão atualizada");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    if (isEdit && session) {
      updateMutation.mutate({
        id: session.id,
        ...form,
        scheduledDate: form.scheduledDate || null,
        scheduledTime: form.scheduledTime || null,
        location: form.location || null,
        notes: form.notes || null,
        title: form.title || null,
      } as any);
    } else {
      createMutation.mutate({
        classId,
        ...form,
        scheduledDate: form.scheduledDate || undefined,
        scheduledTime: form.scheduledTime || undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
        title: form.title || undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const set = (field: keyof SessionFormData) => (val: string | number) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Sessão" : "Nova Sessão"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nº da Sessão</Label>
              <Input
                type="number"
                min={1}
                value={form.sessionNumber}
                onChange={(e) => set("sessionNumber")(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status")(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Título (opcional)</Label>
            <Input
              placeholder="Ex: Teoria e Segurança"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => set("scheduledDate")(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Horário</Label>
              <Input
                type="time"
                value={form.scheduledTime}
                onChange={(e) => set("scheduledTime")(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Duração (min)</Label>
              <Input
                type="number"
                min={30}
                step={30}
                value={form.durationMinutes}
                onChange={(e) => set("durationMinutes")(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Local</Label>
              <Input
                placeholder="Ex: Estande A"
                value={form.location}
                onChange={(e) => set("location")(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              placeholder="Notas sobre a sessão..."
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar Sessão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Session Card ───────────────────────────────────────────────────────────────

function SessionCard({
  session,
  index,
  total,
  classId,
  onEdit,
  onShowAttendance,
}: {
  session: Session;
  index: number;
  total: number;
  classId: number;
  onEdit: (s: Session) => void;
  onShowAttendance: (s: Session) => void;
}) {
  const utils = trpc.useUtils();

  const deleteMutation = trpc.iat.sessions.delete.useMutation({
    onSuccess: () => {
      utils.iat.sessions.list.invalidate({ classId });
      toast.success("Sessão removida");
    },
    onError: (e) => toast.error(e.message),
  });

  const isDone = session.status === "realizada";
  const isCancelled = session.status === "cancelada";

  return (
    <div className="relative pl-8">
      {/* Timeline connector */}
      {index < total - 1 && (
        <div className="absolute left-[14px] top-8 bottom-0 w-0.5 bg-border" />
      )}

      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1.5 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-background z-10 ${
          isDone
            ? "bg-emerald-600 text-white"
            : isCancelled
            ? "bg-slate-500 text-white"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {session.sessionNumber}
      </div>

      <div
        className={`mb-4 rounded-xl border p-4 ${
          isDone ? "border-emerald-500/30 bg-emerald-50/5" : isCancelled ? "opacity-60" : "border-border"
        }`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">
              Sessão {session.sessionNumber}
              {session.title ? ` — ${session.title}` : ""}
            </span>
            <StatusBadge status={session.status} />
            {session.attendanceRecorded && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <ClipboardList className="h-3 w-3" />
                Freq. registrada
              </Badge>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Registrar frequência"
              onClick={() => onShowAttendance(session)}
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onEdit(session)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm("Remover esta sessão e todos os registros de frequência?")) {
                  deleteMutation.mutate({ id: session.id });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {session.scheduledDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(session.scheduledDate + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
          {session.scheduledTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {session.scheduledTime}
              {session.durationMinutes ? ` · ${session.durationMinutes}min` : ""}
            </span>
          )}
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {session.location}
            </span>
          )}
        </div>

        {session.notes && (
          <p className="mt-2 text-xs text-muted-foreground italic">{session.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function IATSessionsPanel({
  classId,
  className: classTitle,
  open,
  onOpenChange,
}: {
  classId: number;
  className?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<Session | null>(null);

  const sessionsQuery = trpc.iat.sessions.list.useQuery(
    { classId },
    { enabled: open && classId > 0 }
  );

  const sessions = sessionsQuery.data ?? [];

  const handleEdit = (s: Session) => {
    setEditSession(s);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditSession(null);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditSession(null);
  };

  // Derived stats
  const doneCount = sessions.filter((s) => s.status === "realizada").length;
  const attendanceRecordedCount = sessions.filter((s) => s.attendanceRecorded).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Sessões da Turma
              {classTitle && (
                <span className="text-muted-foreground font-normal text-sm">— {classTitle}</span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Stats row */}
          {sessions.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xl font-black text-primary">{sessions.length}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xl font-black text-emerald-500">{doneCount}</div>
                <div className="text-xs text-muted-foreground">Realizadas</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-xl font-black text-blue-500">{attendanceRecordedCount}</div>
                <div className="text-xs text-muted-foreground">Freq. reg.</div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {sessions.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progresso</span>
                <span>{doneCount} / {sessions.length} sessões</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                  className="bg-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${sessions.length ? (doneCount / sessions.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Add session button */}
          <Button
            className="w-full mb-4 gap-2"
            variant="outline"
            onClick={handleNew}
          >
            <Plus className="h-4 w-4" />
            Nova Sessão
          </Button>

          {/* Sessions list */}
          {sessionsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma sessão cadastrada.</p>
              <p className="text-xs mt-1">Clique em "Nova Sessão" para começar.</p>
            </div>
          ) : (
            <div>
              {sessions.map((session, idx) => (
                <SessionCard
                  key={session.id}
                  session={session as Session}
                  index={idx}
                  total={sessions.length}
                  classId={classId}
                  onEdit={handleEdit}
                  onShowAttendance={(s) => setAttendanceSession(s)}
                />
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Session form dialog */}
      {formOpen && (
        <SessionFormDialog
          classId={classId}
          session={editSession}
          open={formOpen}
          onClose={handleCloseForm}
        />
      )}

      {/* Attendance sheet */}
      {attendanceSession && (
        <IATAttendanceSheet
          classId={classId}
          session={attendanceSession}
          open={Boolean(attendanceSession)}
          onOpenChange={(o) => { if (!o) setAttendanceSession(null); }}
        />
      )}
    </>
  );
}
