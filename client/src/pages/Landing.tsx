import { useState, useRef, FormEvent } from "react";
import { Link } from "wouter";

// ─── tipos ──────────────────────────────────────────────────────────────────
interface Feature { icon: string; title: string; desc: string }
interface Step    { num: string; title: string; desc: string }
interface Plan    { name: string; price: string; features: string[]; highlight?: boolean }

// ─── dados ──────────────────────────────────────────────────────────────────
const FEATURES: Feature[] = [
  { icon: "📋", title: "Workflow Automatizado",    desc: "Etapas predefinidas do processo CAC com acompanhamento em tempo real por toda a equipe." },
  { icon: "🗂️", title: "Juntada Digital",          desc: "Upload e organização de documentos por nicho com validação automática e histórico completo." },
  { icon: "👤", title: "Portal do Cliente",         desc: "Acesso self-service para o associado acompanhar seu processo e enviar documentos diretamente." },
  { icon: "📧", title: "Comunicação Integrada",    desc: "Templates de email personalizáveis e notificações automáticas em cada etapa do processo." },
  { icon: "📊", title: "Relatórios e Métricas",    desc: "Dashboards com KPIs, prazo médio, taxa de conclusão e histórico de todos os processos." },
  { icon: "🔒", title: "Segurança LGPD",           desc: "Consentimento registrado, dados criptografados e controle de acesso granular por perfil." },
];

const STEPS: Step[] = [
  { num: "01", title: "Cadastre o associado",    desc: "Formulário com dados básicos, CPF e email. O sistema envia o convite automaticamente." },
  { num: "02", title: "Acompanhe cada etapa",    desc: "Workflow visual com subtarefas, checklist de documentos e status em tempo real." },
  { num: "03", title: "Conclua no SINARM-CAC",   desc: "Protocolo registrado, documentação digitalizada e histórico completo para auditoria." },
];

const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "R$ 197",
    features: ["Até 50 processos/mês", "1 operador", "Workflow completo", "Suporte por email"],
  },
  {
    name: "Pro",
    price: "R$ 397",
    features: ["Até 200 processos/mês", "3 operadores", "Portal do Cliente", "Relatórios avançados", "Suporte prioritário"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    features: ["Processos ilimitados", "Operadores ilimitados", "Multi-clube", "SLA dedicado", "Implantação assistida"],
  },
];

// ─── componente principal ────────────────────────────────────────────────────
export default function Landing() {
  const [menuOpen, setMenuOpen]     = useState(false);
  const [formState, setFormState]   = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [formError, setFormError]   = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setFormState("sending");
    setFormError("");

    const data = Object.fromEntries(new FormData(formRef.current));
    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Erro ao enviar formulário.");
      }
      setFormState("sent");
      formRef.current.reset();
    } catch (err: any) {
      setFormError(err.message ?? "Erro ao enviar. Tente novamente.");
      setFormState("error");
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* ──────────────── NAVBAR ──────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#inicio" className="flex items-center gap-2">
            <span className="text-xl font-black text-[#123A63]">CAC 360</span>
            <span className="px-1.5 py-0.5 bg-[#F37321]/10 text-[#F37321] text-xs font-semibold rounded">beta</span>
          </a>

          {/* Links desktop */}
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#funcionalidades" className="hover:text-[#123A63] transition-colors">Funcionalidades</a>
            <a href="#como-funciona"   className="hover:text-[#123A63] transition-colors">Como funciona</a>
            <a href="#planos"          className="hover:text-[#123A63] transition-colors">Planos</a>
            <a href="#demo"            className="hover:text-[#123A63] transition-colors">Contato</a>
          </div>

          {/* CTA + hambúrguer */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden md:inline-flex items-center px-4 py-2 rounded-lg bg-[#123A63] text-white text-sm font-medium hover:bg-[#0e2d4e] transition-colors">
              Acessar sistema
            </Link>
            <button
              className="md:hidden p-2 rounded text-gray-600 hover:bg-gray-100"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Menu mobile */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-2 text-sm">
            {["#funcionalidades", "#como-funciona", "#planos", "#demo"].map((href, i) => (
              <a
                key={href}
                href={href}
                className="block py-2 text-gray-600 hover:text-[#123A63]"
                onClick={() => setMenuOpen(false)}
              >
                {["Funcionalidades", "Como funciona", "Planos", "Contato"][i]}
              </a>
            ))}
            <Link href="/login" className="block w-full text-center py-2 rounded bg-[#123A63] text-white font-medium" onClick={() => setMenuOpen(false)}>
              Acessar sistema
            </Link>
          </div>
        )}
      </nav>

      {/* ──────────────── HERO ──────────────── */}
      <section id="inicio" className="bg-gradient-to-br from-[#123A63] to-[#1a4f85] text-white py-20 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-[#F37321] rounded-full animate-pulse" />
            Gestão completa de processos CAC para clubes de tiro
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight">
            Gerencie todo o processo CAC<br className="hidden md:block" />
            <span className="text-[#F37321]"> do seu clube em um só lugar</span>
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Do cadastro do sócio à submissão no SINARM-CAC, automatize etapas,
            documente tudo e mantenha sua equipe sincronizada — sem planilhas, sem papel.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <a
              href="#demo"
              className="px-8 py-3.5 rounded-xl bg-[#F37321] hover:bg-[#d96315] text-white font-semibold text-base transition-colors shadow-lg"
            >
              Solicitar demonstração
            </a>
            <a
              href="#como-funciona"
              className="px-8 py-3.5 rounded-xl border border-white/30 hover:bg-white/10 text-white font-semibold text-base transition-colors"
            >
              Ver como funciona
            </a>
          </div>

          {/* Mock visual */}
          <div className="mt-12 bg-white/10 rounded-2xl p-6 max-w-3xl mx-auto border border-white/20">
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {["Cadastro", "Psicológico", "Laudo Técnico", "Juntada", "SINARM-CAC"].map((s, i) => (
                <div key={s} className={`rounded-xl p-3 text-center text-xs font-medium ${i === 0 ? "bg-green-400/20 text-green-200 border border-green-400/30" : i <= 2 ? "bg-white/15 text-white/80" : "bg-white/5 text-white/40"}`}>
                  <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-green-400 text-green-900" : "bg-white/20"}`}>{i + 1}</div>
                  {s}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full w-1/5 bg-[#F37321] rounded-full" />
              </div>
              <span className="text-xs text-white/60">20% concluído</span>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── FUNCIONALIDADES ──────────────── */}
      <section id="funcionalidades" className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#123A63]">Tudo que seu clube precisa</h2>
            <p className="text-gray-500 mt-2">Uma plataforma completa para modernizar a gestão de processos CAC</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-[#123A63] mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── COMO FUNCIONA ──────────────── */}
      <section id="como-funciona" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#123A63]">Como funciona</h2>
            <p className="text-gray-500 mt-2">Três passos simples para digitalizar seus processos CAC</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.num} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#123A63] text-white flex items-center justify-center text-xl font-black mx-auto mb-4">
                  {step.num}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-full w-full h-0.5 bg-gray-200 -translate-y-1/2" />
                )}
                <h3 className="font-bold text-[#123A63] mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── PLANOS ──────────────── */}
      <section id="planos" className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#123A63]">Planos e Preços</h2>
            <p className="text-gray-500 mt-2">Escolha o plano ideal para o tamanho do seu clube</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 border flex flex-col relative ${
                  plan.highlight
                    ? "bg-[#123A63] text-white border-[#123A63] shadow-xl"
                    : "bg-white text-gray-900 border-gray-200"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F37321] text-white text-xs font-bold px-3 py-1 rounded-full">
                    ⭐ Mais popular
                  </div>
                )}
                <h3 className={`text-xl font-black mb-1 ${plan.highlight ? "text-white" : "text-[#123A63]"}`}>
                  {plan.name}
                </h3>
                <p className="text-3xl font-black mb-6">
                  {plan.price}
                  {plan.price !== "Sob consulta" && <span className="text-base font-normal opacity-70">/mês</span>}
                </p>
                <ul className="space-y-2 flex-1 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className={`text-sm flex items-center gap-2 ${plan.highlight ? "text-white/90" : "text-gray-600"}`}>
                      <span className="text-[#F37321] font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#demo"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? "bg-[#F37321] hover:bg-[#d96315] text-white"
                      : "border border-[#123A63] text-[#123A63] hover:bg-[#123A63] hover:text-white"
                  }`}
                >
                  {plan.price === "Sob consulta" ? "Falar com consultor" : "Começar agora"}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── FORMULÁRIO DE DEMO ──────────────── */}
      <section id="demo" className="py-20 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-[#123A63]">Solicite uma demonstração</h2>
            <p className="text-gray-500 mt-2">Preencha o formulário e entraremos em contato em até 24 horas</p>
          </div>

          {formState === "sent" ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="font-bold text-green-800 text-lg">Solicitação recebida!</h3>
              <p className="text-green-700 text-sm mt-1">Nossa equipe entrará em contato em breve.</p>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl border p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    name="name"
                    required
                    placeholder="Seu nome completo"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#123A63]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do clube</label>
                  <input
                    name="clubName"
                    placeholder="Ex: CAC Brasília"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#123A63]/30"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="seu@email.com.br"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#123A63]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input
                    name="whatsapp"
                    type="tel"
                    placeholder="(61) 9 9999-9999"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#123A63]/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem (opcional)</label>
                <textarea
                  name="message"
                  rows={3}
                  placeholder="Quantos associados seu clube tem? Qual é sua principal dificuldade hoje?"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#123A63]/30 resize-none"
                />
              </div>
              {formState === "error" && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
              <button
                type="submit"
                disabled={formState === "sending"}
                className="w-full py-3.5 rounded-xl bg-[#F37321] hover:bg-[#d96315] text-white font-semibold text-sm transition-colors disabled:opacity-60"
              >
                {formState === "sending" ? "Enviando…" : "Solicitar demonstração gratuita"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Seus dados são tratados com segurança conforme a LGPD.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ──────────────── FOOTER ──────────────── */}
      <footer className="bg-[#123A63] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">CAC 360</span>
            <span className="text-white/50">·</span>
            <span className="text-white/60">© {new Date().getFullYear()} Todos os direitos reservados</span>
          </div>
          <div className="flex items-center gap-6 text-white/70">
            <a href="#" className="hover:text-white transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            <a href="mailto:contato@cac360.com.br" className="hover:text-white transition-colors">
              contato@cac360.com.br
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
