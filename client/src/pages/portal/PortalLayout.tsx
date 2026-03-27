import React from "react";
import { Loader2 } from "lucide-react";

interface PortalLayoutProps {
  children?: React.ReactNode;
  title?: string;
  loading?: boolean;
}

export default function PortalLayout({ children, title, loading }: PortalLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-purple-100 shadow-sm py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-8 w-auto"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div>
            <h1 className="font-bold text-purple-800 text-lg leading-none">Portal do Associado</h1>
            <p className="text-xs text-gray-500">Área exclusiva do cliente</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-2xl">
          {title && <h2 className="text-2xl font-bold text-gray-800 mb-6">{title}</h2>}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-100">
        Powered by CAC 360 — Gestão de Workflow CR
      </footer>
    </div>
  );
}
