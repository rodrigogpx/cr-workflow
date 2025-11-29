import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock, Loader2, Plus, Search, Target, Users, Mail, Phone, User, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import { APP_LOGO } from "@/const";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'inProgress' | 'completed'>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
  });

  const { data: clients, isLoading, refetch } = trpc.clients.list.useQuery(undefined, {
    enabled: !!user,
  });

  const getClientProgress = (client: any) => {
    return client.progress || 0;
  };

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado com sucesso!");
      setIsDialogOpen(false);
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
      setLocation("/login");
    },
  });

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    createClientMutation.mutate(newClient);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const roleLabel = !user.role
    ? "Pendente"
    : user.role === "admin"
      ? "Administrador"
      : "Operador";

  const totalClients = clients?.length || 0;
  const completed = clients?.filter(c => getClientProgress(c) === 100).length || 0;
  const inProgress = totalClients - completed;

  const filteredClients = clients?.filter((client) => {
    // Filtro de busca por texto
    const matchesSearch = searchTerm === '' || 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.cpf.includes(searchTerm) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro por status
    const progress = getClientProgress(client);
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'completed' && progress === 100) ||
      (statusFilter === 'inProgress' && progress < 100);
    
    return matchesSearch && matchesStatus;
  }) || [];

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
                onClick={() => setLocation("/dashboard")}
                className="text-white hover:text-primary"
              >
                Voltar para módulos
              </Button>
              {user.role === 'admin' && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation("/workflow-admin/operators")}
                    style={{color: '#c2c1c1'}}
                    className="border-2 border-dashed border-white/40 hover:border-primary hover:bg-primary/10"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Operadores
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation("/workflow-admin/emails")}
                    style={{color: '#c2c1c1'}}
                    className="border-2 border-dashed border-white/40 hover:border-primary hover:bg-primary/10"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Emails
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation("/platform-admin/users")}
                    style={{color: '#c2c1c1'}}
                    className="border-2 border-dashed border-white/40 hover:border-primary hover:bg-primary/10"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </>
              )}
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
        {/* Cards de Estatísticas com bordas tracejadas - Clicáveis para filtrar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            className={`cursor-pointer border-2 border-dashed transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 ${
              statusFilter === 'all' 
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/20' 
                : 'border-white/20 bg-card hover:border-primary/50'
            }`}
            onClick={() => setStatusFilter('all')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Total de Clientes
              </CardTitle>
              <Users className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div style={{color: '#434242', textAlign: 'center'}} className="text-4xl font-bold">{totalClients}</div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer border-2 border-dashed transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20 ${
              statusFilter === 'inProgress' 
                ? 'border-yellow-500 bg-yellow-500/5 shadow-lg shadow-yellow-500/20' 
                : 'border-white/20 bg-card hover:border-yellow-500/50'
            }`}
            onClick={() => setStatusFilter('inProgress')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Em Andamento
              </CardTitle>
              <Clock className="w-5 h-5 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div style={{color: '#272626', textAlign: 'center'}} className="text-4xl font-bold">{inProgress}</div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer border-2 border-dashed transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 ${
              statusFilter === 'completed' 
                ? 'border-green-500 bg-green-500/5 shadow-lg shadow-green-500/20' 
                : 'border-white/20 bg-card hover:border-green-500/50'
            }`}
            onClick={() => setStatusFilter('completed')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Concluídos
              </CardTitle>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div style={{color: '#3e3d3d', textAlign: 'center'}} className="text-4xl font-bold">{completed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de Busca e Botão Novo Cliente */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-2 border-dashed border-white/20 bg-card focus:border-primary"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      className="border-2 border-dashed border-white/20 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="uppercase text-xs font-bold tracking-wide">CPF</Label>
                    <Input
                      id="cpf"
                      value={newClient.cpf}
                      onChange={(e) => setNewClient({ ...newClient, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="border-2 border-dashed border-white/20 bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="uppercase text-xs font-bold tracking-wide">Telefone</Label>
                    <Input
                      id="phone"
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
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
                    onClick={() => setIsDialogOpen(false)}
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
        </div>

        {/* Seção Lista de Clientes */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-white/20" />
            <h2 className="text-lg font-semibold text-white/80 uppercase tracking-wide">
              {statusFilter === 'all' ? 'Todos os Clientes' : statusFilter === 'inProgress' ? 'Clientes em Andamento' : 'Clientes Concluídos'}
              <span className="ml-2 text-primary">({filteredClients.length})</span>
            </h2>
            <div className="h-px flex-1 bg-white/20" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredClients.length === 0 ? (
            <Card className="border-2 border-dashed border-white/20 bg-card">
              <CardContent className="py-12 text-center">
                <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-semibold text-foreground mb-2 uppercase">
                  {searchTerm || statusFilter !== 'all' ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                </p>
                <p className="text-muted-foreground">
                  {searchTerm ? "Tente buscar com outros termos" : statusFilter !== 'all' ? "Nenhum cliente nesta categoria" : "Cadastre seu primeiro cliente para começar"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                role="button"
                tabIndex={0}
                onClick={() => setLocation(`/client/${client.id}`)}
                className="cursor-pointer border-2 border-dashed border-white/20 bg-white/95 hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <CardHeader>
                  <CardTitle className="text-xl font-bold uppercase tracking-tight text-black">{client.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-gray-700 flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span className="font-mono">{client.cpf}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{client.phone}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{client.email}</span>
                    </span>
                  </div>
                  {(() => {
                    const progress = getClientProgress(client);
                    const diasDesdeCadastro = client.createdAt 
                      ? Math.floor((new Date().getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    return (
                      <div className="pt-2 border-t border-dashed border-gray-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">{new Date(client.createdAt).toLocaleDateString("pt-BR")}</span>
                          <span className="text-xs font-bold" style={{ color: '#1c5c00' }}>{progress}% concluído</span>
                        </div>
                        <div className="relative w-full h-5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full transition-all duration-300"
                            style={{ width: `${progress}%`, backgroundColor: '#4d9702' }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white drop-shadow-sm">
                            {progress === 100 ? '✓ Concluído' : `${diasDesdeCadastro} ${diasDesdeCadastro === 1 ? 'dia' : 'dias'}`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="space-y-2 mt-4">
                    {user?.role === 'admin' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClient(client.id, client.name);
                        }}
                        variant="outline"
                        style={{backgroundColor: '#feecec', marginTop: '10px', marginBottom: '5px'}}
                        className="w-full border-2 border-dashed border-red-500/40 text-red-500 hover:bg-red-500/10 hover:border-red-500/60 font-bold uppercase tracking-wide"
                        disabled={deleteClientMutation.isPending}
                      >
                        {deleteClientMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Excluindo...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Cliente
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
