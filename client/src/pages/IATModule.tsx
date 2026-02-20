import React, { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, BookOpen, Users, GraduationCap, ClipboardList, Shield, CheckCircle2, XCircle, Search } from "lucide-react";

type Instructor = { id: number; name: string; cpf?: string | null; crNumber?: string | null; phone?: string | null; email?: string | null; isPfAccredited: boolean; pfAccreditationNumber?: string | null; isActive: boolean; };
type Course = { id: number; title: string; description?: string | null; workloadHours: number; courseType: string; isActive: boolean; };
type Exam = { id: number; clientId: number; instructorId: number; courseId?: number | null; scheduledDate?: string | null; examType: string; status: string; weaponType?: string | null; score?: string | null; observations?: string | null; };

const COURSE_TYPES = ["Tiro Básico","Tiro Defensivo","Tiro Esportivo","Prova de Capacidade Técnica (PCT)","Laudo Técnico PF","Laudo Técnico Exército","Outro"];
const EXAM_TYPES = ["Prova de Capacidade Técnica (PCT)","Laudo Técnico PF","Laudo Técnico Exército","Curso de Tiro","Avaliação de Habitualidade"];
const EXAM_STATUSES = ["agendado","realizado","aprovado","reprovado","cancelado"] as const;
const STATUS_STYLE: Record<string, string> = { agendado:"bg-blue-500/10 text-blue-400 border-blue-500/40", realizado:"bg-amber-500/10 text-amber-400 border-amber-500/40", aprovado:"bg-emerald-500/10 text-emerald-400 border-emerald-500/40", reprovado:"bg-red-500/10 text-red-400 border-red-500/40", cancelado:"bg-slate-500/10 text-slate-400 border-slate-500/40" };

function StatusBadge({ status }: { status: string }) {
  return <span className={`text-[0.65rem] px-2 py-0.5 rounded-full border uppercase font-semibold tracking-wide ${STATUS_STYLE[status] ?? STATUS_STYLE.cancelado}`}>{status}</span>;
}

function InstructorForm({ initial, onSave, onCancel }: { initial?: Partial<Instructor>; onSave: (d: any) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: initial?.name ?? "", cpf: initial?.cpf ?? "", crNumber: initial?.crNumber ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", isPfAccredited: initial?.isPfAccredited ?? false, pfAccreditationNumber: initial?.pfAccreditationNumber ?? "" });
  const s = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label>Nome *</Label><Input value={f.name} onChange={e => s("name", e.target.value)} /></div>
        <div className="space-y-1"><Label>CPF</Label><Input value={f.cpf} onChange={e => s("cpf", e.target.value)} /></div>
        <div className="space-y-1"><Label>Nº CR</Label><Input value={f.crNumber} onChange={e => s("crNumber", e.target.value)} /></div>
        <div className="space-y-1"><Label>Telefone</Label><Input value={f.phone} onChange={e => s("phone", e.target.value)} /></div>
        <div className="space-y-1"><Label>E-mail</Label><Input value={f.email} onChange={e => s("email", e.target.value)} type="email" /></div>
      </div>
      <div className="rounded-lg border border-white/10 p-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" checked={f.isPfAccredited} onChange={e => s("isPfAccredited", e.target.checked)} className="h-4 w-4 accent-primary" />
          <Shield className="h-4 w-4 text-primary" /> Credenciado pela Polícia Federal (PF) para emissão de laudos
        </label>
        {f.isPfAccredited && <div className="pl-6 space-y-1"><Label>Nº Credenciamento PF</Label><Input value={f.pfAccreditationNumber} onChange={e => s("pfAccreditationNumber", e.target.value)} /></div>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(f)} disabled={!f.name.trim()}>Salvar</Button></DialogFooter>
    </div>
  );
}

function CourseForm({ initial, onSave, onCancel }: { initial?: Partial<Course>; onSave: (d: any) => void; onCancel: () => void }) {
  const [f, setF] = useState({ title: initial?.title ?? "", description: initial?.description ?? "", workloadHours: initial?.workloadHours ?? 0, courseType: initial?.courseType ?? "" });
  const s = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="space-y-1"><Label>Título *</Label><Input value={f.title} onChange={e => s("title", e.target.value)} /></div>
      <div className="space-y-1"><Label>Tipo *</Label>
        <Select value={f.courseType} onValueChange={v => s("courseType", v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{COURSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="space-y-1"><Label>Carga Horária (h)</Label><Input type="number" min={0} value={f.workloadHours} onChange={e => s("workloadHours", Number(e.target.value))} /></div>
      <div className="space-y-1"><Label>Descrição</Label><textarea className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={f.description} onChange={e => s("description", e.target.value)} /></div>
      <DialogFooter><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave(f)} disabled={!f.title.trim() || !f.courseType}>Salvar</Button></DialogFooter>
    </div>
  );
}

function ExamForm({ initial, instructors, courses, onSave, onCancel }: { initial?: Partial<Exam>; instructors: Instructor[]; courses: Course[]; onSave: (d: any) => void; onCancel: () => void }) {
  const [f, setF] = useState({ clientId: initial?.clientId ?? 0, instructorId: initial?.instructorId ? String(initial.instructorId) : "", courseId: initial?.courseId ? String(initial.courseId) : "", scheduledDate: initial?.scheduledDate ? initial.scheduledDate.slice(0,10) : "", examType: initial?.examType ?? "", status: initial?.status ?? "agendado", weaponType: initial?.weaponType ?? "", score: initial?.score ?? "", observations: initial?.observations ?? "" });
  const s = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>ID do Cliente *</Label><Input type="number" value={f.clientId || ""} onChange={e => s("clientId", Number(e.target.value))} /></div>
        <div className="space-y-1"><Label>Instrutor *</Label><Select value={f.instructorId} onValueChange={v => s("instructorId", v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{instructors.filter(i => i.isActive).map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name}{i.isPfAccredited ? " 🛡️" : ""}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Tipo de Exame *</Label><Select value={f.examType} onValueChange={v => s("examType", v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{EXAM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Curso</Label><Select value={f.courseId} onValueChange={v => s("courseId", v)}><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value="">Nenhum</SelectItem>{courses.filter(c => c.isActive).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Data Agendada</Label><Input type="date" value={f.scheduledDate} onChange={e => s("scheduledDate", e.target.value)} /></div>
        <div className="space-y-1"><Label>Status</Label><Select value={f.status} onValueChange={v => s("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXAM_STATUSES.map(st => <SelectItem key={st} value={st}>{st.charAt(0).toUpperCase()+st.slice(1)}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Espécie de Arma</Label><Input value={f.weaponType} onChange={e => s("weaponType", e.target.value)} placeholder="Ex: Pistola" /></div>
        <div className="space-y-1"><Label>Pontuação</Label><Input value={f.score} onChange={e => s("score", e.target.value)} placeholder="Ex: 85/100" /></div>
        <div className="col-span-2 space-y-1"><Label>Observações</Label><textarea className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={f.observations} onChange={e => s("observations", e.target.value)} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button onClick={() => onSave({ ...f, clientId: Number(f.clientId), instructorId: Number(f.instructorId), courseId: f.courseId ? Number(f.courseId) : undefined, scheduledDate: f.scheduledDate || undefined })} disabled={!f.clientId || !f.instructorId || !f.examType}>Salvar</Button></DialogFooter>
    </div>
  );
}

export default function IATModule() {
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState("instructors");
  const [search, setSearch] = useState("");
  const [instrDlg, setInstrDlg] = useState<{ open: boolean; editing?: Instructor }>({ open: false });
  const [courseDlg, setCourseDlg] = useState<{ open: boolean; editing?: Course }>({ open: false });
  const [examDlg, setExamDlg] = useState<{ open: boolean; editing?: Exam }>({ open: false });

  const utils = trpc.useUtils();
  const instructorsQ = trpc.iat.instructors.list.useQuery();
  const coursesQ = trpc.iat.courses.list.useQuery();
  const examsQ = trpc.iat.exams.list.useQuery();

  const createInstr = trpc.iat.instructors.create.useMutation({ onSuccess: () => { utils.iat.instructors.list.invalidate(); setInstrDlg({ open: false }); toast.success("Instrutor cadastrado!"); }, onError: e => toast.error(e.message) });
  const updateInstr = trpc.iat.instructors.update.useMutation({ onSuccess: () => { utils.iat.instructors.list.invalidate(); setInstrDlg({ open: false }); toast.success("Atualizado!"); }, onError: e => toast.error(e.message) });
  const deleteInstr = trpc.iat.instructors.delete.useMutation({ onSuccess: () => { utils.iat.instructors.list.invalidate(); toast.success("Removido!"); }, onError: e => toast.error(e.message) });
  const createCourse = trpc.iat.courses.create.useMutation({ onSuccess: () => { utils.iat.courses.list.invalidate(); setCourseDlg({ open: false }); toast.success("Curso cadastrado!"); }, onError: e => toast.error(e.message) });
  const updateCourse = trpc.iat.courses.update.useMutation({ onSuccess: () => { utils.iat.courses.list.invalidate(); setCourseDlg({ open: false }); toast.success("Atualizado!"); }, onError: e => toast.error(e.message) });
  const deleteCourse = trpc.iat.courses.delete.useMutation({ onSuccess: () => { utils.iat.courses.list.invalidate(); toast.success("Removido!"); }, onError: e => toast.error(e.message) });
  const createExam = trpc.iat.exams.create.useMutation({ onSuccess: () => { utils.iat.exams.list.invalidate(); setExamDlg({ open: false }); toast.success("Exame agendado!"); }, onError: e => toast.error(e.message) });
  const updateExam = trpc.iat.exams.update.useMutation({ onSuccess: () => { utils.iat.exams.list.invalidate(); setExamDlg({ open: false }); toast.success("Atualizado!"); }, onError: e => toast.error(e.message) });
  const deleteExam = trpc.iat.exams.delete.useMutation({ onSuccess: () => { utils.iat.exams.list.invalidate(); toast.success("Removido!"); }, onError: e => toast.error(e.message) });

  const instructors: Instructor[] = instructorsQ.data ?? [];
  const courses: Course[] = coursesQ.data ?? [];
  const exams: Exam[] = examsQ.data ?? [];
  const q = search.toLowerCase();
  const fInstr = instructors.filter(i => i.name.toLowerCase().includes(q) || (i.cpf ?? "").includes(q) || (i.crNumber ?? "").toLowerCase().includes(q));
  const fCourse = courses.filter(c => c.title.toLowerCase().includes(q) || c.courseType.toLowerCase().includes(q));
  const fExam = exams.filter(e => e.examType.toLowerCase().includes(q) || String(e.clientId).includes(q) || e.status.toLowerCase().includes(q));

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/20 bg-card/95 backdrop-blur-sm px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation(buildTenantPath(tenantSlug, "/dashboard"))}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Módulo</p>
              <h1 className="text-xl font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />IAT – Instrutor de Armamento e Tiro</h1>
            </div>
          </div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8 h-9 w-full sm:w-60 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        </header>

        <div className="grid grid-cols-3 gap-4">
          {([["Instrutores", instructors.length, Users], ["Cursos", courses.length, GraduationCap], ["Exames", exams.length, ClipboardList]] as const).map(([label, count, Icon]) => (
            <Card key={label} className="bg-card/95 backdrop-blur-sm border border-white/20"><CardContent className="pt-4 pb-4 flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{count}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-card/80 border border-white/10">
            <TabsTrigger value="instructors" className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Instrutores</TabsTrigger>
            <TabsTrigger value="courses" className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" />Cursos</TabsTrigger>
            <TabsTrigger value="exams" className="flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Exames &amp; Provas</TabsTrigger>
          </TabsList>

          <TabsContent value="instructors" className="space-y-4 mt-4">
            <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">{fInstr.length} instrutor(es)</p>{isAdmin && <Button size="sm" onClick={() => setInstrDlg({ open: true })}><Plus className="h-4 w-4 mr-1" />Novo Instrutor</Button>}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fInstr.map(inst => (
                <Card key={inst.id} className="bg-card/95 backdrop-blur-sm border border-white/20"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div className="space-y-1 min-w-0"><CardTitle className="text-base flex flex-wrap items-center gap-2">{inst.name}{inst.isPfAccredited && <span className="inline-flex items-center gap-1 text-[0.65rem] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/40 font-semibold uppercase"><Shield className="h-3 w-3" />PF</span>}</CardTitle><div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">{inst.crNumber && <span>CR: {inst.crNumber}</span>}{inst.cpf && <span>CPF: {inst.cpf}</span>}{inst.phone && <span>{inst.phone}</span>}</div>{inst.isPfAccredited && inst.pfAccreditationNumber && <p className="text-xs text-blue-400">Credenciamento: {inst.pfAccreditationNumber}</p>}</div><div className="flex items-center gap-1 shrink-0">{inst.isActive ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}{isAdmin && <><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setInstrDlg({ open: true, editing: inst })}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteInstr.mutate({ id: inst.id })}><Trash2 className="h-3.5 w-3.5" /></Button></>}</div></div></CardHeader></Card>
              ))}
              {fInstr.length === 0 && <p className="col-span-2 text-center py-10 text-muted-foreground text-sm">Nenhum instrutor cadastrado.</p>}
            </div>
          </TabsContent>

          <TabsContent value="courses" className="space-y-4 mt-4">
            <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">{fCourse.length} curso(s)</p>{isAdmin && <Button size="sm" onClick={() => setCourseDlg({ open: true })}><Plus className="h-4 w-4 mr-1" />Novo Curso</Button>}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fCourse.map(course => (
                <Card key={course.id} className="bg-card/95 backdrop-blur-sm border border-white/20"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div className="space-y-1 min-w-0"><CardTitle className="text-base">{course.title}</CardTitle><div className="flex flex-wrap gap-2 text-xs"><span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{course.courseType}</span>{course.workloadHours > 0 && <span className="text-muted-foreground">{course.workloadHours}h</span>}</div>{course.description && <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>}</div><div className="flex items-center gap-1 shrink-0">{course.isActive ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}{isAdmin && <><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCourseDlg({ open: true, editing: course })}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteCourse.mutate({ id: course.id })}><Trash2 className="h-3.5 w-3.5" /></Button></>}</div></div></CardHeader></Card>
              ))}
              {fCourse.length === 0 && <p className="col-span-2 text-center py-10 text-muted-foreground text-sm">Nenhum curso cadastrado.</p>}
            </div>
          </TabsContent>

          <TabsContent value="exams" className="space-y-4 mt-4">
            <div className="flex justify-between items-center"><p className="text-sm text-muted-foreground">{fExam.length} exame(s)</p>{isAdmin && <Button size="sm" onClick={() => setExamDlg({ open: true })}><Plus className="h-4 w-4 mr-1" />Novo Exame</Button>}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fExam.map(exam => { const inst = instructors.find(i => i.id === exam.instructorId); const course = courses.find(c => c.id === exam.courseId); return (
                <Card key={exam.id} className="bg-card/95 backdrop-blur-sm border border-white/20"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div className="space-y-1 min-w-0"><CardTitle className="text-base flex flex-wrap items-center gap-2">{exam.examType}<StatusBadge status={exam.status} /></CardTitle><div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground"><span>Cliente #{exam.clientId}</span>{inst && <span>Instrutor: {inst.name}{inst.isPfAccredited ? " 🛡️" : ""}</span>}{course && <span>Curso: {course.title}</span>}{exam.scheduledDate && <span>{new Date(exam.scheduledDate).toLocaleDateString("pt-BR")}</span>}{exam.weaponType && <span>Arma: {exam.weaponType}</span>}{exam.score && <span>Pontuação: {exam.score}</span>}</div>{exam.observations && <p className="text-xs text-muted-foreground line-clamp-2">{exam.observations}</p>}</div><div className="flex items-center gap-1 shrink-0">{isAdmin && <><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExamDlg({ open: true, editing: exam })}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteExam.mutate({ id: exam.id })}><Trash2 className="h-3.5 w-3.5" /></Button></>}</div></div></CardHeader></Card>
              ); })}
              {fExam.length === 0 && <p className="col-span-2 text-center py-10 text-muted-foreground text-sm">Nenhum exame cadastrado.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Dialog open={instrDlg.open} onOpenChange={open => setInstrDlg(d => ({ ...d, open }))}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{instrDlg.editing ? "Editar Instrutor" : "Novo Instrutor"}</DialogTitle></DialogHeader>
          <InstructorForm initial={instrDlg.editing} onSave={data => instrDlg.editing ? updateInstr.mutate({ id: instrDlg.editing.id, ...data }) : createInstr.mutate(data)} onCancel={() => setInstrDlg({ open: false })} />
        </DialogContent>
      </Dialog>

      <Dialog open={courseDlg.open} onOpenChange={open => setCourseDlg(d => ({ ...d, open }))}>
        <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{courseDlg.editing ? "Editar Curso" : "Novo Curso"}</DialogTitle></DialogHeader>
          <CourseForm initial={courseDlg.editing} onSave={data => courseDlg.editing ? updateCourse.mutate({ id: courseDlg.editing.id, ...data }) : createCourse.mutate(data)} onCancel={() => setCourseDlg({ open: false })} />
        </DialogContent>
      </Dialog>

      <Dialog open={examDlg.open} onOpenChange={open => setExamDlg(d => ({ ...d, open }))}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{examDlg.editing ? "Editar Exame" : "Novo Exame / Prova"}</DialogTitle></DialogHeader>
          <ExamForm initial={examDlg.editing} instructors={instructors} courses={courses} onSave={data => examDlg.editing ? updateExam.mutate({ id: examDlg.editing.id, ...data }) : createExam.mutate(data)} onCancel={() => setExamDlg({ open: false })} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
