export default function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 mt-auto">
      <div className="container py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>© 2025 ACR Digital</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Todos os direitos reservados</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Desenvolvido por</span>
            <span className="font-semibold text-foreground">ACR Digital</span>
            <span>para Firing Range</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
