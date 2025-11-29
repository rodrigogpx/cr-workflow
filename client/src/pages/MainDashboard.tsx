import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { APP_LOGO } from "@/const";
import { Target, Shield, Activity, RefreshCcw, Inbox, MapPin, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

export default function MainDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const roleLabel = !user?.role
    ? "Pendente"
    : user.role === "admin"
      ? "Administrador"
      : "Operador";

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
            {user?.role === "admin" && (
              <Button
                variant="outline"
                onClick={() => setLocation("/platform-admin/users")}
                style={{ color: "#c2c1c1" }}
                className="mt-1 h-8 px-3 text-[0.65rem] sm:text-[0.7rem] font-semibold uppercase tracking-wide border-2 border-dashed border-white/40 hover:border-primary hover:bg-primary/10 flex items-center gap-1"
              >
                <Shield className="h-3 w-3" />
                Administração
              </Button>
            )}
          </div>
        </header>

        {/* Grid de módulos */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Módulo CR Workflow (MVP atual) */}
          <Card className="border-2 border-dashed border-white/20 bg-card/95 backdrop-blur-sm hover:border-primary/60 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Target className="h-4 w-4" />
                  </span>
                  Workflow CR
                </CardTitle>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 uppercase font-semibold tracking-wide">
                  Ativo
                </span>
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
                className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide border-2 border-dashed border-white/40"
                onClick={() => setLocation("/cr-workflow")}
              >
                Acessar Workflow CR
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Módulo Aquisição & CRAF */}
          <Card className="border-2 border-dashed border-white/10 bg-card/90 backdrop-blur-sm opacity-80 hover:opacity-100 hover:border-primary/40 transition-all duration-300">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Inbox className="h-4 w-4" />
                  </span>
                  Aquisição &amp; CRAF
                </CardTitle>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/40 uppercase font-semibold tracking-wide">
                  Fase 2
                </span>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Fluxo para autorização de compra, upload de NF e emissão do CRAF, com cofre digital para documentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                Módulo planejado. Em breve será possível acompanhar todas as aquisições do cliente a partir deste painel.
              </p>
              <Button disabled className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                Em breve
              </Button>
            </CardContent>
          </Card>

          {/* Módulo Habitualidade Tracker */}
          <Card className="border-2 border-dashed border-white/10 bg-card/90 backdrop-blur-sm opacity-80 hover:opacity-100 hover:border-primary/40 transition-all duration-300">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Activity className="h-4 w-4" />
                  </span>
                  Habitualidade &amp; Treinos
                </CardTitle>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/40 uppercase font-semibold tracking-wide">
                  Fase 2
                </span>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Registro de treinos, barra de nível e geração automática da declaração de habitualidade.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                Coração da retenção do cliente. Este módulo será liberado após a consolidação do fluxo de aquisição.
              </p>
              <Button disabled className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                Em breve
              </Button>
            </CardContent>
          </Card>

          {/* Módulo Munições & Insumos */}
          <Card className="border-2 border-dashed border-white/10 bg-card/90 backdrop-blur-sm opacity-80 hover:opacity-100 hover:border-primary/40 transition-all duration-300">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Inbox className="h-4 w-4" />
                  </span>
                  Munições &amp; Insumos
                </CardTitle>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/40 uppercase font-semibold tracking-wide">
                  Roadmap
                </span>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Controle de estoque pessoal, recarga e acompanhamento de cotas legais anuais.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                Ideal para atiradores de IPSC e alto volume. Planejado para fases futuras da plataforma.
              </p>
              <Button disabled className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                Em breve
              </Button>
            </CardContent>
          </Card>

          {/* Módulo Compliance & Validade */}
          <Card className="border-2 border-dashed border-white/10 bg-card/90 backdrop-blur-sm opacity-80 hover:opacity-100 hover:border-primary/40 transition-all duration-300">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <RefreshCcw className="h-4 w-4" />
                  </span>
                  Compliance &amp; Vencimentos
                </CardTitle>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/40 uppercase font-semibold tracking-wide">
                  Fase 3
                </span>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Linha do tempo de vencimentos de CR, CRAF, laudos e alertas automáticos para o cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                Guardião da regularidade do CAC. Focado em manter o cliente sempre dentro da legislação.
              </p>
              <Button disabled className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                Em breve
              </Button>
            </CardContent>
          </Card>

          {/* Módulo GT & Transporte */}
          <Card className="border-2 border-dashed border-white/10 bg-card/90 backdrop-blur-sm opacity-80 hover:opacity-100 hover:border-primary/40 transition-all duration-300">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold uppercase tracking-tight flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" />
                  </span>
                  GT &amp; Transporte
                </CardTitle>
                <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-300 border border-slate-500/40 uppercase font-semibold tracking-wide">
                  Roadmap
                </span>
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Carteira digital com CR, CRAF, GT, identidade e gestão de segundo endereço de acervo.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <p className="text-[0.7rem] sm:text-xs text-muted-foreground">
                Pensado para facilitar fiscalizações e deslocamentos do atirador com toda documentação em um só lugar.
              </p>
              <Button disabled className="w-full h-9 text-xs sm:text-sm font-semibold uppercase tracking-wide" variant="outline">
                Em breve
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
