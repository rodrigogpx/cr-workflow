import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Clock, Loader2, Plus, Search, Target, Users, Mail, Phone, User, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import Footer from "@/components/Footer";
import { APP_LOGO } from "@/const";

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredClients = clients?.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cpf.includes(searchTerm) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalClients = clients?.length || 0;
  const completed = clients?.filter(c => getClientProgress(c) === 100).length || 0;
  const inProgress = totalClients - completed;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header com estilo Firing Range */}
      <header className="border-b-2 border-dashed border-white/20 bg-black sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt="CAC 360 – Gestão de Ciclo Completo" className="h-12 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight uppercase">CAC 360 – Gestão de Ciclo Completo</h1>
                <p className="text-sm text-muted-foreground">
                  {user.role === 'admin' ? 'Administrador' : 'Operador'} - {user.name || user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.role === 'admin' && (
                <Button 
                  variant="outline" 
                  onClick={() => setLocation("/admin")}
                  style={{color: '#c2c1c1'}}
                  className="border-2 border-dashed border-white/40 hover:border-primary hover:bg-primary/10"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Administração
                </Button>
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
        {/* Cards de Estatísticas com bordas tracejadas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 border-dashed border-white/20 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
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

          <Card className="border-2 border-dashed border-white/20 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
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

          <Card className="border-2 border-dashed border-white/20 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
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

        {/* Lista de Clientes */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredClients.length === 0 ? (
          <Card className="border-2 border-dashed border-white/20 bg-card">
            <CardContent className="py-12 text-center">
              <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground mb-2 uppercase">
                {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </p>
              <p className="text-muted-foreground">
                {searchTerm ? "Tente buscar com outros termos" : "Cadastre seu primeiro cliente para começar"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="border-2 border-dashed border-white/20 bg-white/95 hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1"
              >
                <CardHeader>
                  <CardTitle className="text-xl font-bold uppercase tracking-tight text-black">{client.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User className="w-4 h-4" />
                    <span className="font-mono">{client.cpf}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Phone className="w-4 h-4" />
                    <span>{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="pt-2 border-t border-dashed border-gray-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{new Date(client.createdAt).toLocaleDateString("pt-BR")}</span>
                      <span className="text-xs font-bold" style={{ color: '#1c5c00' }}>{getClientProgress(client)}% concluído</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300"
                        style={{ width: `${getClientProgress(client)}%`, backgroundColor: '#4d9702' }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Link href={`/client/${client.id}`}>
                      <Button className="w-full border-2 border-dashed border-white/40 font-bold uppercase tracking-wide" style={{ backgroundColor: '#db7929' }}>
                        Ver Workflow →
                      </Button>
                    </Link>
                    {user?.role === 'admin' && (
                      <Button
                        onClick={() => handleDeleteClient(client.id, client.name)}
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
      </main>
      <Footer />
    </div>
  );
}
