declare const __GIT_COMMIT__: string;

export default function Footer() {
  const commitHash =
    typeof __GIT_COMMIT__ !== "undefined" ? __GIT_COMMIT__ : "dev";

  // Log para depuração no console do navegador
  if (typeof window !== "undefined") {
    (window as any)._APP_VERSION = commitHash;
  }

  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
      <div className="container py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>© 2025 ACR Digital</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">
              Todos os direitos reservados
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Desenvolvido por</span>
            <span className="font-semibold text-foreground">ACR Digital</span>
            <span>para CAC 360</span>
            <span>•</span>
            <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] font-mono font-bold text-primary border border-primary/20">
              🚀 v{commitHash}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
