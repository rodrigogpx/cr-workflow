import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, XCircle, AlertCircle, MinusCircle,
  Save, Loader2, Users, Calendar, Clock,
} from "lucide-react";

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

type AttendanceStatus = "pendente" | "presente" | "ausente" | "justificado";

type AttendanceRecord = {
  enrollmentId: number;
  status: AttendanceStatus;
  notes?: string | null;
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CYCLE: AttendanceStatus[] = ["pendente", "presente", "ausente", "justificado"];

const STATUS_CONFIG: Record<AttendanceStatus, {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  className: string;
  badgeVariant: "outline" | "default" | "destructive" | "secondary";
}> = {
  pendente: {
    label: "Pendente",
    shortLabel: "—",
    icon: <MinusCircle className="h-4 w-4" />,
    className: "text-muted-foreground hover:text-foreground border-dashed",
    badgeVariant: "outline",
  },
  presente: {
    label: "Presente",
    shortLabel: "P",
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    badgeVariant: "default",
  },
  ausente: {
    label: "Ausente",
    shortLabel: "A",
    icon: <XCircle className="h-4 w-4" />,
    className: "text-red-600 bg-red-50 border-red-200 hover:bg-red-100",
    badgeVariant: "destructive",
  },
  justificado: {
    label: "Justificado",
    shortLabel: "J",
    icon: <AlertCircle className="h-4 w-4" />,
    className: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100",
    badgeVariant: "secondary",
  },
};

// ── Attendance cell ───────────────────────────────────────────────────────────

function AttendanceCell({
  status,
  onClick,
  dirty,
}: {
  status: AttendanceStatus;
  onClick: () => void;
  dirty: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <button
      type="button"
      onClick={onClick}
      title={cfg.label}
      className={[
        "relative flex items-center justify-center gap-1 rounded-md border px-3 py-1.5",
        "text-sm font-semibold transition-all duration-150 cursor-pointer select-none",
        cfg.className,
        dirty ? "ring-2 ring-offset-1 ring-blue-400" : "",
      ].join(" ")}
    >
      {cfg.icon}
      <span>{cfg.shortLabel}</span>
    </button>
  );
}

// ── Student row ───────────────────────────────────────────────────────────────

function StudentRow({
  clientName,
  clientCpf,
  status,
  attendancePercent,
  onToggle,
  dirty,
}: {
  clientName: string;
  clientCpf: string | null;
  status: AttendanceStatus;
  attendancePercent: number | null;
  onToggle: () => void;
  dirty: boolean;
}) {
  const atRisk = attendancePercent !== null && attendancePercent < 75;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/30 transition-colors">
      {/* Name + CPF */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{clientName}</p>
        {clientCpf && (
          <p className="text-xs text-muted-foreground">{formatCpf(clientCpf)}</p>
        )}
      </div>

      {/* Attendance % */}
      {attendancePercent !== null && (
        <div className="flex items-center gap-1.5 shrink-0">
          {atRisk && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Em risco
            </Badge>
          )}
          <span
            className={[
              "text-xs font-mono tabular-nums",
              atRisk ? "text-red-600 font-semibold" : "text-muted-foreground",
            ].join(" ")}
          >
            {attendancePercent}%
          </span>
        </div>
      )}

      {/* Toggle cell */}
      <div className="shrink-0">
        <AttendanceCell status={status} onClick={onToggle} dirty={dirty} />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function calcPercent(records: AttendanceRecord[], enrollmentId: number): number | null {
  // We only have this session's data here; percent requires all sessions.
  // We'll receive it via prop if available, otherwise return null.
  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface IATAttendanceSheetProps {
  classId: number;
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function IATAttendanceSheet({
  classId,
  session,
  open,
  onOpenChange,
}: IATAttendanceSheetProps) {
  // ── Remote data ───────────────────────────────────────────────────────────────
  const enrollmentsQuery = trpc.iat.enrollments.list.useQuery(
    { classId },
    { enabled: open }
  );

  const attendanceQuery = trpc.iat.attendance.listBySession.useQuery(
    { sessionId: session.id },
    { enabled: open }
  );

  // Attendance for ALL sessions of the class — for computing per-student %
  const allAttendanceQuery = trpc.iat.attendance.listByClass.useQuery(
    { classId },
    { enabled: open }
  );

  const sessionsQuery = trpc.iat.sessions.list.useQuery(
    { classId },
    { enabled: open }
  );

  const recordMutation = trpc.iat.attendance.record.useMutation({
    onSuccess: () => {
      toast.success("Frequência salva com sucesso");
      attendanceQuery.refetch();
      allAttendanceQuery.refetch();
      setDirtyIds(new Set());
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  const utils = trpc.useUtils();

  // ── Local state ───────────────────────────────────────────────────────────────
  // Map: enrollmentId → current status (local/optimistic)
  const [localStatus, setLocalStatus] = useState<Map<number, AttendanceStatus>>(new Map());
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync remote data into local state when it loads or session changes
  useEffect(() => {
    if (!attendanceQuery.data || !enrollmentsQuery.data) return;

    const map = new Map<number, AttendanceStatus>();

    // Start every enrolled student as "pendente"
    for (const enr of enrollmentsQuery.data) {
      map.set(enr.id, "pendente");
    }

    // Override with actual recorded status
    for (const rec of attendanceQuery.data) {
      map.set(rec.enrollmentId, rec.status as AttendanceStatus);
    }

    setLocalStatus(map);
    setDirtyIds(new Set());
  }, [attendanceQuery.data, enrollmentsQuery.data, session.id]);

  // ── Derived data ──────────────────────────────────────────────────────────────
  const totalSessions = sessionsQuery.data?.length ?? 0;

  // Per enrollmentId: number of "presente" + "justificado" across all sessions
  const attendancePercentMap = (() => {
    const map = new Map<number, number>();
    if (!allAttendanceQuery.data || totalSessions === 0) return map;

    const countsByEnrollment = new Map<number, { counted: number; total: number }>();

    for (const rec of allAttendanceQuery.data) {
      const prev = countsByEnrollment.get(rec.enrollmentId) ?? { counted: 0, total: 0 };
      countsByEnrollment.set(rec.enrollmentId, {
        counted: prev.counted + (rec.status === "presente" || rec.status === "justificado" ? 1 : 0),
        total: prev.total + 1,
      });
    }

    for (const [enrollmentId, { counted, total }] of countsByEnrollment) {
      if (total > 0) {
        map.set(enrollmentId, Math.round((counted / total) * 100));
      }
    }

    return map;
  })();

  // Summary stats for this session
  const sessionStats = (() => {
    let present = 0, absent = 0, justified = 0, pending = 0;
    for (const [, status] of localStatus) {
      if (status === "presente") present++;
      else if (status === "ausente") absent++;
      else if (status === "justificado") justified++;
      else pending++;
    }
    return { present, absent, justified, pending, total: localStatus.size };
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleToggle = useCallback((enrollmentId: number) => {
    setLocalStatus((prev) => {
      const current = prev.get(enrollmentId) ?? "pendente";
      const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
      const next = STATUS_CYCLE[nextIdx];
      return new Map(prev).set(enrollmentId, next);
    });

    setDirtyIds((prev) => new Set(prev).add(enrollmentId));

    // Auto-save debounced (2s)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      flushSave();
    }, 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flushSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    setLocalStatus((currentMap) => {
      setDirtyIds((currentDirty) => {
        const records = Array.from(currentDirty).map((enrollmentId) => ({
          sessionId: session.id,
          enrollmentId,
          status: currentMap.get(enrollmentId) ?? "pendente",
        }));

        if (records.length > 0) {
          recordMutation.mutate({ records });
        }

        return currentDirty; // keep dirty until onSuccess
      });
      return currentMap;
    });
  }, [session.id, recordMutation]);

  const handleSaveAll = useCallback(() => {
    const records = Array.from(localStatus.entries()).map(([enrollmentId, status]) => ({
      sessionId: session.id,
      enrollmentId,
      status,
    }));

    if (records.length === 0) {
      toast.info("Nenhum aluno matriculado nesta turma");
      return;
    }

    recordMutation.mutate({ records });
  }, [localStatus, session.id, recordMutation]);

  const handleMarkAll = (status: AttendanceStatus) => {
    const newMap = new Map<number, AttendanceStatus>();
    for (const [id] of localStatus) {
      newMap.set(id, status);
    }
    setLocalStatus(newMap);
    const allIds = new Set(localStatus.keys());
    setDirtyIds(allIds);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const isLoading =
    enrollmentsQuery.isLoading || attendanceQuery.isLoading;

  const enrollments = enrollmentsQuery.data ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-1">
          <SheetTitle className="text-lg">
            Frequência — Sessão {session.sessionNumber}
            {session.title && <span className="text-muted-foreground font-normal"> · {session.title}</span>}
          </SheetTitle>

          {/* Session meta */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            {session.scheduledDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(session.scheduledDate)}
              </span>
            )}
            {session.scheduledTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {session.scheduledTime}
                {session.durationMinutes && ` (${session.durationMinutes}min)`}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {sessionStats.total} aluno{sessionStats.total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Stats bar */}
          {!isLoading && sessionStats.total > 0 && (
            <div className="flex gap-3 pt-2">
              <StatChip
                label="Presente"
                value={sessionStats.present}
                className="text-emerald-700 bg-emerald-50"
              />
              <StatChip
                label="Ausente"
                value={sessionStats.absent}
                className="text-red-600 bg-red-50"
              />
              <StatChip
                label="Justificado"
                value={sessionStats.justified}
                className="text-amber-600 bg-amber-50"
              />
              <StatChip
                label="Pendente"
                value={sessionStats.pending}
                className="text-muted-foreground bg-muted"
              />
            </div>
          )}
        </SheetHeader>

        {/* Quick-mark controls */}
        {!isLoading && sessionStats.total > 0 && (
          <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30">
            <span className="text-xs text-muted-foreground mr-1">Marcar todos:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              onClick={() => handleMarkAll("presente")}
            >
              Todos presentes
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleMarkAll("ausente")}
            >
              Todos ausentes
            </Button>
          </div>
        )}

        {/* List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum aluno matriculado</p>
            </div>
          ) : (
            <div className="divide-y">
              {enrollments.map((enr) => {
                const status = localStatus.get(enr.id) ?? "pendente";
                const percent = attendancePercentMap.get(enr.id) ?? null;
                const dirty = dirtyIds.has(enr.id);

                return (
                  <StudentRow
                    key={enr.id}
                    clientName={enr.clientName ?? "—"}
                    clientCpf={enr.clientCpf ?? null}
                    status={status}
                    attendancePercent={percent}
                    onToggle={() => handleToggle(enr.id)}
                    dirty={dirty}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-background">
          <p className="text-xs text-muted-foreground">
            {dirtyIds.size > 0
              ? `${dirtyIds.size} alteração${dirtyIds.size !== 1 ? "ões" : ""} não salva${dirtyIds.size !== 1 ? "s" : ""}`
              : session.attendanceRecorded
              ? "Frequência registrada"
              : "Frequência pendente"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAll}
              disabled={recordMutation.isPending || isLoading}
              className="gap-1.5"
            >
              {recordMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Salvar tudo
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${className}`}>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}
