import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock, Loader2, Plus, Search, Target, Users, Mail, Phone, User, Trash2, FileText, Download } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import { APP_LOGO } from "@/const";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";
import { createClientSchema, formatCPF, formatPhone } from "@shared/validations";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Tipos para exportação do jsPDF AutoTable
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type PhaseKey = 'all' | 'cadastro' | 'agendamento-psicotecnico' | 'agendamento-laudo' | 'juntada-documento' | 'concluido' | 'solicitado' | 'aguardando-gru' | 'em-analise' | 'correcao-solicitada' | 'deferido' | 'indeferido';

const PHASE_LABELS: Record<PhaseKey, { title: string, icon: React.ElementType, colorClass: string }> = {
  'all': { title: 'Todos os Clientes', icon: Users, colorClass: 'text-blue-500' },
  'cadastro': { title: 'Cadastro Pendente', icon: FileText, colorClass: 'text-orange-500' },
  'agendamento-psicotecnico': { title: 'Avaliação Psicológica Pendente', icon: Target, colorClass: 'text-purple-500' },
  'agendamento-laudo': { title: 'Laudo Técnico Pendente', icon: Clock, colorClass: 'text-indigo-500' },
  'juntada-documento': { title: 'Juntada de Documentos Pendente', icon: FileText, colorClass: 'text-pink-500' },
  'concluido': { title: 'Workflow Concluído', icon: CheckCircle2, colorClass: 'text-green-500' },
  'solicitado': { title: 'Solicitado', icon: FileText, colorClass: 'text-blue-500' },
  'aguardando-gru': { title: 'Aguardando Baixa GRU', icon: Clock, colorClass: 'text-yellow-600' },
  'em-analise': { title: 'Em Análise', icon: Search, colorClass: 'text-blue-400' },
  'correcao-solicitada': { title: 'Correção Solicitada', icon: Clock, colorClass: 'text-orange-400' },
  'deferido': { title: 'Deferido', icon: CheckCircle2, colorClass: 'text-emerald-500' },
  'indeferido': { title: 'Indeferido', icon: Target, colorClass: 'text-red-500' }
};

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();
  const [searchTerm, setSearchTerm] = useState("");
  const [operatorFilter, setOperatorFilter] = useState<'all' | 'unassigned' | string>('all');
  
  // Modal de Criação
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
  });

  // Modais de Visualização (Sheet para lista, Dialog para detalhes)
  const [selectedPhase, setSelectedPhase] = useState<PhaseKey | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetSearchTerm, setSheetSearchTerm] = useState("");
  
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const { data: clients, isLoading, refetch } = trpc.clients.list.useQuery(undefined, {
    enabled: !!user,
  });

  const getClientProgress = (client: any) => {
    return client.progress || 0;
  };

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      setIsCreateDialogOpen(false);
      setNewClient({ name: "", cpf: "", phone: "", email: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao cadastrar cliente: ${error.message}`);
    },
  });

  const deleteClientMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente excluído com sucesso!");
      setIsDetailsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir cliente: ${error.message}`);
    },
  });

  const handleDeleteClient = (clientId: number, clientName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o cliente ${clientName}? Esta ação não pode ser desfeita.`)) {
      deleteClientMutation.mutate({ id: clientId });
    }
  };

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      const target = buildTenantPath(tenantSlug, "/login");
      setLocation(target);
    },
  });

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createClientSchema.safeParse(newClient);
    if (!parsed.success) {
      toast.error(parsed.error.issues?.[0]?.message || "Dados inválidos");
      return;
    }
    createClientMutation.mutate(parsed.data);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Lógica de Filtros e Agrupamentos
  const operatorOptions = Array.from(
    new Map(
      (clients || [])
        .map((c: any) => c?.assignedOperator)
        .filter(Boolean)
        .map((op: any) => [String(op.id), op])
    ).values()
  ).sort((a: any, b: any) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || '')));

  const baseFilteredClients = clients?.filter((client) => {
    const matchesSearch = searchTerm === '' || 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cpf.includes(searchTerm) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.assignedOperator?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.assignedOperator?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOperator =
      operatorFilter === 'all' ||
      (operatorFilter === 'unassigned'
        ? !client.operatorId
        : String(client.operatorId) === operatorFilter);
    
    return matchesSearch && matchesOperator;
  }) || [];

  // Agrupamentos por fase
  const getClientsByPhase = (phase: PhaseKey) => {
    if (phase === 'all') return baseFilteredClients;
    
    if (['cadastro', 'agendamento-psicotecnico', 'agendamento-laudo', 'juntada-documento', 'concluido'].includes(phase)) {
      return baseFilteredClients.filter(c => c.currentPendingStep === phase);
    }
    
    // Status SINARM
    const sinarmClients = baseFilteredClients.filter(c => c.currentPendingStep === 'acompanhamento-sinarm');
    switch (phase) {
      case 'solicitado': return sinarmClients.filter(c => c.sinarmStatus === 'Solicitado' || !c.sinarmStatus);
      case 'aguardando-gru': return sinarmClients.filter(c => c.sinarmStatus === 'Aguardando Baixa GRU');
      case 'em-analise': return sinarmClients.filter(c => c.sinarmStatus === 'Em Análise');
      case 'correcao-solicitada': return sinarmClients.filter(c => c.sinarmStatus === 'Correção Solicitada');
      case 'deferido': return sinarmClients.filter(c => c.sinarmStatus === 'Deferido');
      case 'indeferido': return sinarmClients.filter(c => c.sinarmStatus === 'Indeferido');
      default: return [];
    }
  };

  const handleCardClick = (phase: PhaseKey) => {
    setSelectedPhase(phase);
    setSheetSearchTerm("");
    setIsSheetOpen(true);
  };

  const handleClientClick = (client: any) => {
    setSelectedClient(client);
    setIsDetailsDialogOpen(true);
  };

  const exportPDF = (phase: PhaseKey, e: React.MouseEvent) => {
    e.stopPropagation();
    const phaseClients = getClientsByPhase(phase);
    const doc = new jsPDF() as jsPDFWithPlugin;
    
    const title = `Relatório: ${PHASE_LABELS[phase].title}`;
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Total de clientes: ${phaseClients.length}`, 14, 28);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 34);

    const tableData = phaseClients.map(c => [
      c.name,
      c.cpf,
      c.phone,
      c.email,
      c.assignedOperator?.name || 'Sem operador'
    ]);

    doc.autoTable({
      startY: 40,
      head: [['Nome', 'CPF', 'Telefone', 'Email', 'Operador']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 }
    });

    doc.save(`relatorio_${phase}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("Relatório PDF gerado com sucesso!");
  };

  // Dados para o Sheet Modal
  const currentPhaseClients = selectedPhase ? getClientsByPhase(selectedPhase).filter(c => 
    sheetSearchTerm === '' || 
    c.name.toLowerCase().includes(sheetSearchTerm.toLowerCase()) || 
    c.cpf.includes(sheetSearchTerm)
  ) : [];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const target = buildTenantPath(tenantSlug, "/login");
    setLocation(target);
    return null;
  }

  const roleLabel = !user.role
    ? "Pendente"
    : user.role === "admin"
      ? "Administrador"
      : user.role === "despachante"
        ? "Despachante"
        : "Operador";

  return (
    <div className="min-h-screen">
      {/* Header com estilo Firing Range */}
      <header className="border-b-2 border-dashed border-white/20 bg-black sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="CAC 360 – Workflow CR" className="h-12 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight uppercase">CAC 360 – Workflow CR</h1>
                <p className="text-sm text-white/70">
                  Módulo Workflow CR · {roleLabel} · {user.name || user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setLocation(buildTenantPath(tenantSlug, "/dashboard"))}
                className="text-white hover:text-primary"
              >
                Home
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="text-white hover:text-primary"
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Barra de Busca Geral e Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-card p-4 rounded-lg border-2 border-dashed border-white/20">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Filtro global: buscar por nome, CPF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-dashed border-white/20 bg-background focus:border-primary"
            />
          </div>

          <div className="sm:w-64">
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value as any)}
              className="w-full h-10 rounded-md border-2 border-dashed border-white/20 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <option value="all">Todos os operadores</option>
              <option value="unassigned">Sem operador</option>
              {operatorOptions.map((op: any) => (
                <option key={String(op.id)} value={String(op.id)}>
                  {op.name || op.email}
                </option>
              ))}
            </select>
          </div>

          {(user?.role === 'admin' || user?.role === 'operator') && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase tracking-wide">
                  <Plus className="w-5 h-5 mr-2" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="border-2 border-dashed border-white/20 bg-card">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold uppercase">Cadastrar Novo Cliente</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do cliente para iniciar o processo de CR
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateClient}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="uppercase text-xs font-bold tracking-wide">Nome Completo</Label>
                      <Input
                        id="name"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value.replace(/\d/g, "") })}
                        className="border-2 border-dashed border-white/20 bg-background"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf" className="uppercase text-xs font-bold tracking-wide">CPF</Label>
                      <Input
                        id="cpf"
                        value={newClient.cpf}
                        onChange={(e) => setNewClient({ ...newClient, cpf: formatCPF(e.target.value) })}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        className="border-2 border-dashed border-white/20 bg-background"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="uppercase text-xs font-bold tracking-wide">Telefone</Label>
                      <Input
                        id="phone"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({ ...newClient, phone: formatPhone(e.target.value) })}
                        placeholder="(00) 00000-0000"
                        inputMode="tel"
                        className="border-2 border-dashed border-white/20 bg-background"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="uppercase text-xs font-bold tracking-wide">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                        className="border-2 border-dashed border-white/20 bg-background"
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="border-2 border-dashed border-white/40"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createClientMutation.isPending}
                      className="bg-primary hover:bg-primary/90 border-2 border-dashed border-white/40 font-bold uppercase"
                    >
                      {createClientMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cadastrando...
                        </>
                      ) : (
                        "Cadastrar"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-12">
            {/* Seção Geral */}
            <section>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {['all', 'concluido'].map((phaseKey) => {
                  const phase = phaseKey as PhaseKey;
                  const phaseInfo = PHASE_LABELS[phase];
                  const Icon = phaseInfo.icon;
                  const count = getClientsByPhase(phase).length;

                  return (
                    <Card 
                      key={phase}
                      onClick={() => handleCardClick(phase)}
                      className="cursor-pointer border-2 border-dashed border-white/20 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group"
                    >
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${phaseInfo.colorClass}`} />
                          {phaseInfo.title}
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => exportPDF(phase, e)}
                          title="Exportar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold" style={{color: '#434242'}}>{count}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Fases do Workflow */}
            <section>
              <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wide border-b-2 border-dashed border-white/20 pb-2">
                Fases do Workflow
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {['cadastro', 'agendamento-psicotecnico', 'agendamento-laudo', 'juntada-documento'].map((phaseKey) => {
                  const phase = phaseKey as PhaseKey;
                  const phaseInfo = PHASE_LABELS[phase];
                  const Icon = phaseInfo.icon;
                  const count = getClientsByPhase(phase).length;

                  return (
                    <Card 
                      key={phase}
                      onClick={() => handleCardClick(phase)}
                      className="cursor-pointer border-2 border-dashed border-white/20 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group"
                    >
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-start gap-2 h-10">
                          <Icon className={`w-5 h-5 shrink-0 ${phaseInfo.colorClass}`} />
                          <span className="leading-tight">{phaseInfo.title}</span>
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => exportPDF(phase, e)}
                          title="Exportar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold" style={{color: '#434242'}}>{count}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Status SINARM */}
            <section>
              <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wide border-b-2 border-dashed border-white/20 pb-2">
                Acompanhamento SINARM CAC
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {['solicitado', 'aguardando-gru', 'em-analise', 'correcao-solicitada', 'deferido', 'indeferido'].map((phaseKey) => {
                  const phase = phaseKey as PhaseKey;
                  const phaseInfo = PHASE_LABELS[phase];
                  const Icon = phaseInfo.icon;
                  const count = getClientsByPhase(phase).length;

                  return (
                    <Card 
                      key={phase}
                      onClick={() => handleCardClick(phase)}
                      className="cursor-pointer border-2 border-dashed border-white/20 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group"
                    >
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-start gap-2 h-10">
                          <Icon className={`w-5 h-5 shrink-0 ${phaseInfo.colorClass}`} />
                          <span className="leading-tight">{phaseInfo.title}</span>
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => exportPDF(phase, e)}
                          title="Exportar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold" style={{color: '#434242'}}>{count}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Modal Lateral (Sheet) de Lista de Clientes */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl overflow-y-auto bg-background border-l-2 border-dashed border-white/20">
          <SheetHeader className="mb-6 border-b-2 border-dashed border-white/20 pb-4">
            <SheetTitle className="text-2xl font-bold uppercase flex items-center gap-3">
              {selectedPhase && PHASE_LABELS[selectedPhase].icon && (
                <div className="p-2 bg-card rounded-md">
                  {React.createElement(PHASE_LABELS[selectedPhase].icon, { className: `w-6 h-6 ${PHASE_LABELS[selectedPhase].colorClass}` })}
                </div>
              )}
              {selectedPhase ? PHASE_LABELS[selectedPhase].title : ''}
            </SheetTitle>
            <SheetDescription>
              Selecione um cliente para ver os detalhes
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={sheetSearchTerm}
                onChange={(e) => setSheetSearchTerm(e.target.value)}
                className="pl-9 border-2 border-dashed border-white/20"
              />
            </div>

            {currentPhaseClients.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum cliente encontrado.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentPhaseClients.map((client) => (
                  <Card 
                    key={client.id}
                    onClick={() => handleClientClick(client)}
                    className="cursor-pointer border-2 border-dashed border-white/10 hover:border-primary/50 transition-colors bg-card/50 hover:bg-card"
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold uppercase text-foreground">{client.name}</h4>
                        <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                          <span className="flex items-center gap-1"><User className="w-3 h-3"/> {client.cpf}</span>
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3"/> {client.phone}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Progresso</div>
                        <div className="font-bold text-primary">{getClientProgress(client)}%</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal Sobreposto (Dialog) de Detalhes do Cliente */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-2xl border-2 border-dashed border-white/20 bg-card">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold uppercase border-b-2 border-dashed border-white/10 pb-4">
              Detalhes do Cliente
            </DialogTitle>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nome</Label>
                  <div className="font-semibold text-lg uppercase">{selectedClient.name}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">CPF</Label>
                  <div className="font-mono">{selectedClient.cpf}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email</Label>
                  <div>{selectedClient.email}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Telefone</Label>
                  <div>{selectedClient.phone}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Criado em</Label>
                  <div>{new Date(selectedClient.createdAt).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Operador Responsável</Label>
                  <div>{selectedClient.assignedOperator ? selectedClient.assignedOperator.name || selectedClient.assignedOperator.email : 'Não atribuído'}</div>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-white/10 pt-4 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Status do Workflow</Label>
                  <div className="relative w-full h-4 bg-background rounded-full overflow-hidden border border-white/10">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ width: `${getClientProgress(selectedClient)}%`, backgroundColor: '#4d9702' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-sm font-semibold text-primary">
                    <span>Progresso Atual</span>
                    <span>{getClientProgress(selectedClient)}% concluído</span>
                  </div>
                </div>
                
                {selectedClient.currentPendingStep && selectedClient.currentPendingStep !== 'concluido' && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
                    <span className="text-sm font-bold text-orange-400">Pendente na fase: </span>
                    <span className="text-sm text-foreground">
                      {PHASE_LABELS[selectedClient.currentPendingStep as PhaseKey]?.title || selectedClient.currentPendingStep}
                    </span>
                  </div>
                )}

                {selectedClient.sinarmStatus && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <span className="text-sm font-bold text-blue-400">Status SINARM: </span>
                    <span className="text-sm text-foreground">{selectedClient.sinarmStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between items-center border-t-2 border-dashed border-white/10 pt-4">
            {user?.role === 'admin' ? (
              <Button
                variant="destructive"
                onClick={() => handleDeleteClient(selectedClient?.id, selectedClient?.name)}
                disabled={deleteClientMutation.isPending}
                className="font-bold uppercase"
              >
                {deleteClientMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Excluir Cliente
              </Button>
            ) : <div></div>}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                Fechar
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 font-bold uppercase"
                onClick={() => {
                  setIsDetailsDialogOpen(false);
                  setIsSheetOpen(false);
                  setLocation(buildTenantPath(tenantSlug, `/client/${selectedClient?.id}`));
                }}
              >
                Abrir Workflow
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
}
