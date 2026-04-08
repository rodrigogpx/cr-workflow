import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronLeft, ChevronRight, CalendarDays, Clock,
  MapPin, User, BookOpen, ClipboardList, Layers, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Schedule = {
  id: number;
  scheduleType: string;
  title: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  location?: string | null;
  instructorId?: number | null;
  courseId?: number | null;
  notes?: string | null;
  status: string;
};

type CourseClass = {
  id: number;
  courseId: number;
  instructorId?: number | null;
  classNumber?: string | null;
  title?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  location?: string | null;
  maxStudents?: number | null;
  status: string;
  notes?: string | null;
  enrolledCount?: number;
};

type Exam = {
  id: number;
  clientId: number;
  instructorId: number;
  courseId?: number | null;
  scheduledDate?: string | null;
  examType: string;
  status: string;
  weaponType?: string | null;
  score?: string | null;
  observations?: string | null;
};

type Instructor = {
  id: number;
  name: string;
};

type Course = {
  id: number;
  title: string;
};

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "schedule" | "class" | "exam";
  title: string;
  subtitle?: string;
  time?: string | null;
  location?: string | null;
  status: string;
  instructor?: string;
  raw: Schedule | CourseClass | Exam;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PT_WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Build the 6-row (42-cell) grid for a given month (Mon-first) */
function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  // Mon = 0 ... Sun = 6 (shift getDay: 0=Sun → 6, 1=Mon → 0, ...)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG = {
  schedule: {
    label: "Agendamento",
    icon: CalendarDays,
    bg: "bg-blue-500/20",
    text: "text-blue-300",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
    badgeBg: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  class: {
    label: "Turma",
    icon: Layers,
    bg: "bg-amber-500/20",
    text: "text-amber-300",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  exam: {
    label: "Exame",
    icon: ClipboardList,
    bg: "bg-purple-500/20",
    text: "text-purple-300",
    border: "border-purple-500/30",
    dot: "bg-purple-400",
    badgeBg: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
};

const STATUS_DOT: Record<string, string> = {
  agendado: "bg-blue-400",
  realizado: "bg-emerald-400",
  aprovado: "bg-emerald-400",
  reprovado: "bg-red-400",
  cancelado: "bg-slate-500",
  cancelada: "bg-slate-500",
  em_andamento: "bg-amber-400",
  concluida: "bg-emerald-400",
  agendada: "bg-blue-400",
};

// ── Event detail card ─────────────────────────────────────────────────────────

function EventDetailCard({ event }: { event: CalendarEvent }) {
  const cfg = EVENT_TYPE_CONFIG[event.type];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.text}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold leading-tight ${cfg.text}`}>{event.title}</p>
          {event.subtitle && (
            <p className="text-xs text-muted-foreground">{event.subtitle}</p>
          )}
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase shrink-0 ${cfg.badgeBg}`}>
          {cfg.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground pl-5">
        {event.time && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{event.time}
          </span>
        )}
        {event.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />{event.location}
          </span>
        )}
        {event.instructor && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />{event.instructor}
          </span>
        )}
        <span className={`flex items-center gap-1`}>
          <span className={`h-2 w-2 rounded-full inline-block ${STATUS_DOT[event.status] ?? "bg-slate-400"}`} />
          {event.status}
        </span>
      </div>
    </div>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({
  date,
  isToday,
  isOtherMonth,
  events,
}: {
  date: Date | null;
  isToday: boolean;
  isOtherMonth: boolean;
  events: CalendarEvent[];
}) {
  const [open, setOpen] = useState(false);

  if (!date) {
    return <div className="h-24 sm:h-28 border-r border-b border-white/5 last:border-r-0" />;
  }

  const MAX_VISIBLE = 2;
  const visible = events.slice(0, MAX_VISIBLE);
  const overflow = events.length - MAX_VISIBLE;

  const cell = (
    <div
      className={[
        "h-24 sm:h-28 border-r border-b border-white/5 last:border-r-0 p-1 flex flex-col gap-0.5 transition-colors",
        isToday
          ? "bg-primary/10 ring-1 ring-inset ring-primary/40"
          : "hover:bg-white/3",
        events.length > 0 ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={() => events.length > 0 && setOpen(true)}
    >
      {/* Day number */}
      <div className="flex justify-end pr-0.5">
        <span
          className={[
            "h-6 w-6 flex items-center justify-center rounded-full text-xs font-medium",
            isToday
              ? "bg-primary text-primary-foreground font-bold"
              : isOtherMonth
              ? "text-muted-foreground/40"
              : "text-foreground",
          ].join(" ")}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Event pills */}
      <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
        {visible.map((ev) => {
          const cfg = EVENT_TYPE_CONFIG[ev.type];
          return (
            <div
              key={ev.id}
              className={[
                "text-[10px] leading-tight px-1.5 py-0.5 rounded truncate font-medium",
                cfg.bg, cfg.text, "border", cfg.border,
              ].join(" ")}
              title={ev.title}
            >
              {ev.time && <span className="opacity-70 mr-1">{ev.time}</span>}
              {ev.title}
            </div>
          );
        })}
        {overflow > 0 && (
          <div className="text-[10px] text-muted-foreground px-1.5 font-medium">
            +{overflow} mais
          </div>
        )}
      </div>
    </div>
  );

  if (events.length === 0) return cell;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{cell}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-3 space-y-2 bg-card/95 backdrop-blur-md border border-white/20 shadow-2xl z-50"
        side="right"
        align="start"
        sideOffset={4}
      >
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <p className="text-sm font-semibold">
            {date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {events.map((ev) => (
            <EventDetailCard key={ev.id} event={ev} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-3">
      {(Object.entries(EVENT_TYPE_CONFIG) as [keyof typeof EVENT_TYPE_CONFIG, typeof EVENT_TYPE_CONFIG[keyof typeof EVENT_TYPE_CONFIG]][]).map(([, cfg]) => (
        <span key={cfg.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`h-2.5 w-2.5 rounded-sm ${cfg.bg} border ${cfg.border}`} />
          {cfg.label}
        </span>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface IATCalendarViewProps {
  schedules: Schedule[];
  classes: CourseClass[];
  exams: Exam[];
  instructors: Instructor[];
  courses: Course[];
}

export default function IATCalendarView({
  schedules,
  classes,
  exams,
  instructors,
  courses,
}: IATCalendarViewProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // ── Build events ───────────────────────────────────────────────────────────
  const allEvents = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];

    // Schedules
    for (const s of schedules) {
      if (!s.scheduledDate) continue;
      const dateStr = s.scheduledDate.slice(0, 10);
      const inst = instructors.find((i) => i.id === s.instructorId);
      const course = courses.find((c) => c.id === s.courseId);
      result.push({
        id: `sched-${s.id}`,
        date: dateStr,
        type: "schedule",
        title: s.title,
        subtitle: course?.title ?? s.scheduleType,
        time: s.scheduledTime ?? null,
        location: s.location ?? null,
        status: s.status,
        instructor: inst?.name,
        raw: s,
      });
    }

    // Classes
    for (const c of classes) {
      if (!c.scheduledDate) continue;
      const dateStr = c.scheduledDate.slice(0, 10);
      const course = courses.find((co) => co.id === c.courseId);
      const inst = instructors.find((i) => i.id === c.instructorId);
      result.push({
        id: `class-${c.id}`,
        date: dateStr,
        type: "class",
        title: c.classNumber ? `Turma ${c.classNumber}` : c.title ?? `Turma #${c.id}`,
        subtitle: course?.title,
        time: c.scheduledTime ?? null,
        location: c.location ?? null,
        status: c.status,
        instructor: inst?.name,
        raw: c,
      });
    }

    // Exams
    for (const e of exams) {
      if (!e.scheduledDate) continue;
      const dateStr = e.scheduledDate.slice(0, 10);
      const inst = instructors.find((i) => i.id === e.instructorId);
      const course = courses.find((c) => c.id === e.courseId);
      result.push({
        id: `exam-${e.id}`,
        date: dateStr,
        type: "exam",
        title: e.examType,
        subtitle: course?.title ?? (e.weaponType ? `Arma: ${e.weaponType}` : undefined),
        time: null,
        location: null,
        status: e.status,
        instructor: inst?.name,
        raw: e,
      });
    }

    // Sort by time within each date
    result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
    });

    return result;
  }, [schedules, classes, exams, instructors, courses]);

  // Index events by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date)!.push(ev);
    }
    return map;
  }, [allEvents]);

  // Events in current month for the list view
  const monthPrefix = `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
  const monthEvents = allEvents.filter((ev) => ev.date.startsWith(monthPrefix));

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  const todayYMD = toYMD(today);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">
            {PT_MONTHS[month]} {year}
          </h2>
          <span className="text-xs text-muted-foreground">
            ({monthEvents.length} evento{monthEvents.length !== 1 ? "s" : ""})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs px-3"
              onClick={goToday}
            >
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Calendar grid ─────────────────────────────────────────────────── */}
      <Card className="bg-card/95 backdrop-blur-sm border border-white/20 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-white/10">
          {PT_WEEKDAYS_SHORT.map((wd) => (
            <div
              key={wd}
              className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {grid.map((date, idx) => {
            const ymd = date ? toYMD(date) : null;
            const events = ymd ? (eventsByDate.get(ymd) ?? []) : [];
            const isToday = ymd === todayYMD;
            const isOtherMonth = date ? date.getMonth() !== month : false;

            return (
              <DayCell
                key={idx}
                date={date}
                isToday={isToday}
                isOtherMonth={isOtherMonth}
                events={events}
              />
            );
          })}
        </div>
      </Card>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <Legend />

      {/* ── Event list for the month ──────────────────────────────────────── */}
      {monthEvents.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Eventos do mês
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {monthEvents.map((ev) => {
              const cfg = EVENT_TYPE_CONFIG[ev.type];
              const Icon = cfg.icon;
              const parsedDate = parseYMD(ev.date);
              return (
                <div
                  key={ev.id}
                  className={`rounded-lg border p-3 flex items-start gap-3 ${cfg.bg} ${cfg.border}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-card/50 border ${cfg.border}`}>
                    <Icon className={`h-4 w-4 ${cfg.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-tight ${cfg.text} truncate`}>
                        {ev.title}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase shrink-0 ${cfg.badgeBg}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {ev.subtitle && (
                      <p className="text-xs text-muted-foreground truncate">{ev.subtitle}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {parsedDate.toLocaleDateString("pt-BR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                        {ev.time && ` às ${ev.time}`}
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{ev.location}
                        </span>
                      )}
                      {ev.instructor && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{ev.instructor}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {monthEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <CalendarDays className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhum evento em {PT_MONTHS[month]}</p>
          <p className="text-xs opacity-60">
            Crie agendamentos, turmas ou exames para ver no calendário
          </p>
        </div>
      )}
    </div>
  );
}
