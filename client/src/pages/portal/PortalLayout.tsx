import React from "react";
import { Loader2, Home } from "lucide-react";
import { Link } from "wouter";

interface PortalLayoutProps {
  children?: React.ReactNode;
  title?: string;
  loading?: boolean;
}

export default function PortalLayout({ children, title, loading }: PortalLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: 'url("/background-01.webp")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Overlay escuro — mesma opacidade da tela do dashboard */}
      <div className="absolute inset-0 -z-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Header translúcido */}
      <header className="relative z-10 bg-white/10 backdrop-blur-md border-b border-white/20 py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-8 w-auto"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="flex-1">
            <h1 className="font-bold text-white text-lg leading-none">Portal do Associado</h1>
            <p className="text-xs text-purple-200">Área exclusiva do cliente</p>
          </div>
          <Link href="/portal">
            <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium transition-colors">
              <Home className="h-3.5 w-3.5" />
              Início
            </a>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-2xl">
          {title && (
            <h2 className="text-2xl font-bold text-white mb-6 drop-shadow">{title}</h2>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-300" />
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-xs text-white/40 border-t border-white/10">
        Powered by CAC 360 — Gestão de Workflow CR
      </footer>
    </div>
  );
}
