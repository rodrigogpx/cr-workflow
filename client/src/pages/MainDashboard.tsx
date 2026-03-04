import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO } from "@/const";
import { Target, Shield, BookOpen, RefreshCcw, Inbox, MapPin, ChevronRight, LogOut, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { useTenantSlug, buildTenantPath } from "@/_core/hooks/useTenantSlug";

export default function MainDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const tenantSlug = useTenantSlug();

  const handleLogout = async () => {
    await logout();
    setLocation(buildTenantPath(tenantSlug, "/login"));
  };

  const roleLabel = !user?.role
    ? "Pendente"
    : user.role === "admin"
      ? "Administrador"
      : "Operador";

  // Obter as features disponíveis do tenant através do payload do usuário
  // Se não houver, assume comportamento padrão seguro (tudo inativo, exceto quem for CR que pode ter fallback antigo se preciso)
  const features = (user as any)?.tenantFeatures || {
    featureWorkflowCR: true, // Mantendo fallback por segurança
    featureApostilamento: false,
    featureRenovacao: false,
    featureInsumos: false,
    featureIAT: false,
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header principal */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-white/20 bg-card/95 backdrop-blur-sm px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={APP_LOGO}
                alt=""
                className="h-12 w-auto"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Painel Principal
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                CAC 360 – Plataforma do Atirador
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Selecione o módulo para continuar o atendimento do cliente.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs sm:text-sm">
            <span className="px-2 py-0.5 rounded-full border border-white/30 bg-background/60 font-semibold uppercase tracking-wide text-[0.7rem] sm:text-[0.75rem]">
              {roleLabel}
            </span>
            <span className="text-muted-foreground truncate max-w-[180px] sm:max-w-xs text-right">
              {user?.name || user?.email}
            </span>
            <div className="flex items-center gap-2 mt-1">
              {user?.role === "admin" && (
                <Button
                  variant="outline"
                  onClick={() => setLocation(buildTenantPath(tenantSlug, "/admin"))}
                  className="h-8 px-4 text-[0.65rem] sm:text-[0.7rem] font-bold uppercase tracking-wide bg-primary text-white border-2 border-primary hover:bg-primary/90 hover:border-primary/90 shadow-lg shadow-primary/30 flex items-center gap-1.5"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Administração
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="h-8 px-3 text-[0.65rem] sm:text-[0.7rem] font-semibold uppercase tracking-wide text-red-300 hover:text-red-100 hover:bg-red-500/10 flex items-center gap-1"
              >
                <LogOut className="h-3 w-3" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        {/* Grid de módulos */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Módulo CR Workflow */}
          <Card className={`border-2 border-dashed ${features.featureWorkflowCR ? 'border-white/20 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20' : 'border-white/5 opacity-50'} bg-card/95 backdrop-blur-sm transition-all duration-300`}>
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-base font-bold uppercase tracking-tight flex items-center gap-2 ${!features.featureWorkflowCR && 'text-muted-foreground'}`}>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${features.featureWorkflowCR ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                    {features.featureWorkflowCR ? <Target className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </span>
                  Workflow CR
                </CardTitle>
                {features.featureWorkflowCR ? (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 uppercase font-semibold tracking-wide">
                    Ativo
                  </span>
                ) : (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/40 uppercase font-semibold tracking-wide">
                    Desabilitado
                  </span>
                )}
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Cadastro de clientes, juntada de documentos e acompanhamento completo do processo de CR.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                Use este módulo para inserir novos clientes no CAC 360 e acompanhar o fluxo de aprovação do Certificado de Registro.
              </p>
              <Button
                disabled={!features.featureWorkflowCR}
                className={`w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide border-2 border-dashed ${features.featureWorkflowCR ? 'border-white/40' : 'border-transparent'}`}
                onClick={() => setLocation(buildTenantPath(tenantSlug, "/cr-workflow"))}
              >
                {features.featureWorkflowCR ? (
                  <>
                    Acessar Workflow CR
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  "Módulo Indisponível"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Módulo Aquisição & CRAF */}
          <Card className={`border-2 border-dashed ${features.featureApostilamento ? 'border-white/20 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20' : 'border-white/10 opacity-80 hover:opacity-100'} bg-card/90 backdrop-blur-sm transition-all duration-300`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-base font-bold uppercase tracking-tight flex items-center gap-2 ${!features.featureApostilamento && 'text-muted-foreground'}`}>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${features.featureApostilamento ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                    {features.featureApostilamento ? <Inbox className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </span>
                  Aquisição & CRAF
                </CardTitle>
                {features.featureApostilamento ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold tracking-wider">ATIVO</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] font-bold tracking-wider">FASE 2</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className={`text-sm ${features.featureApostilamento ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                  Fluxo para autorização de compra, upload de NF e emissão do CRAF, com cofre digital.
                </p>
                <div className={`text-xs ${features.featureApostilamento ? 'text-muted-foreground' : 'text-muted-foreground/60'} pt-2 border-t border-border/50`}>
                  Módulo planejado. Em breve será possível acompanhar todas as aquisições do cliente a partir deste painel.
                </div>
              </div>
            </CardContent>
            <div className="p-4 pt-0 mt-auto">
              <Button disabled={!features.featureApostilamento} className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                {features.featureApostilamento ? "Acessar Módulo" : "Em breve"}
              </Button>
            </div>
          </Card>

          {/* Módulo IAT */}
          <Card className={`border-2 border-dashed ${features.featureIAT ? 'border-white/20 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20' : 'border-white/20 bg-card/95 backdrop-blur-sm hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20'} bg-card/95 backdrop-blur-sm transition-all duration-300`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-base font-bold uppercase tracking-tight flex items-center gap-2 ${!features.featureIAT && 'text-muted-foreground'}`}>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${features.featureIAT ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                    {features.featureIAT ? <BookOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </span>
                  IAT – Instrução de Armamento e Tiro
                </CardTitle>
                {features.featureIAT ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold tracking-wider">ATIVO</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-slate-500/10 text-slate-400 border-slate-500/40 text-[10px] font-bold tracking-wider uppercase">DESABILITADO</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className={`text-sm ${features.featureIAT ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                  Gestão de instrutores autorizados a ministrar cursos, exames de capacidade técnica para emissão de laudos.
                </p>
                <div className={`text-xs ${features.featureIAT ? 'text-muted-foreground' : 'text-muted-foreground/60'} pt-2 border-t border-border/50`}>
                  Módulo para instrutores de armamento e tiro (IAT) conforme legislação vigente. Controle de credenciamento PF para emissão de laudos.
                </div>
              </div>
            </CardContent>
            <div className="p-4 pt-0 mt-auto">
              <Button 
                variant="default" 
                onClick={() => setLocation(`/${tenantSlug}/iat`)}
                disabled={!features.featureIAT}
                className={`w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide border-2 border-dashed ${features.featureIAT ? 'border-white/40' : 'border-transparent'}`}
              >
                {features.featureIAT ? (
                  <>Acessar Módulo IAT <ChevronRight className="ml-2 h-4 w-4" /></>
                ) : "Em breve"}
              </Button>
            </div>
          </Card>

          {/* Módulo Munições & Insumos */}
          <Card className={`border-2 border-dashed ${features.featureInsumos ? 'border-white/20 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20' : 'border-white/10 opacity-80 hover:opacity-100'} bg-card/90 backdrop-blur-sm transition-all duration-300`}>
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-base font-bold uppercase tracking-tight flex items-center gap-2 ${!features.featureInsumos && 'text-muted-foreground'}`}>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${features.featureInsumos ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                    {features.featureInsumos ? <Inbox className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </span>
                  Munições &amp; Insumos
                </CardTitle>
                {features.featureInsumos ? (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 uppercase font-semibold tracking-wide">
                    Ativo
                  </span>
                ) : (
                  <span className="text-[0.65rem] px-2.5 py-1 rounded-full bg-slate-700 text-white border border-slate-200/30 shadow-sm uppercase font-bold tracking-wide">
                    Desabilitado
                  </span>
                )}
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Controle de estoque pessoal, recarga e acompanhamento de cotas legais anuais.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                {features.featureInsumos
                  ? "Acesse para gerenciar cotas e insumos do atirador."
                  : "Ideal para atiradores de IPSC e alto volume. Planejado para fases futuras da plataforma."}
              </p>
              <Button disabled={!features.featureInsumos} className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                {features.featureInsumos ? "Acessar Módulo" : "Em breve"}
              </Button>
            </CardContent>
          </Card>

          {/* Módulo Compliance & Validade (Renovação) */}
          <Card className={`border-2 border-dashed ${features.featureRenovacao ? 'border-white/20 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20' : 'border-white/10 opacity-80 hover:opacity-100'} bg-card/90 backdrop-blur-sm transition-all duration-300`}>
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className={`text-base font-bold uppercase tracking-tight flex items-center gap-2 ${!features.featureRenovacao && 'text-muted-foreground'}`}>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${features.featureRenovacao ? 'bg-primary/10 text-primary' : 'bg-muted'}`}>
                    {features.featureRenovacao ? <RefreshCcw className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </span>
                  Compliance &amp; Vencimentos
                </CardTitle>
                {features.featureRenovacao ? (
                  <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 uppercase font-semibold tracking-wide">
                    Ativo
                  </span>
                ) : (
                  <span className="text-[0.65rem] px-2.5 py-1 rounded-full bg-slate-700 text-white border border-slate-200/30 shadow-sm uppercase font-bold tracking-wide">
                    Roadmap
                  </span>
                )}
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Dashboard consolidado de vencimentos (CR, Laudos, CRAFs) com disparos de cobrança automática.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                {features.featureRenovacao
                  ? "Controle as renovações pendentes da sua base de atiradores e despachos em lote."
                  : "Módulo avançado de retenção e renovação. Previsto para integração com Whatsapp no futuro."}
              </p>
              <Button disabled={!features.featureRenovacao} className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                {features.featureRenovacao ? "Acessar Módulo" : "Em breve"}
              </Button>
            </CardContent>
          </Card>

        </section>
      </div>
    </div>
  );
}
