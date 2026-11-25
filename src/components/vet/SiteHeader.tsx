import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Mascot } from "./Mascot";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Mascot className="h-9 w-9" />
          <span className="font-display text-xl font-semibold">VetStudy</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>
            Disciplinas
          </Link>
          {user ? (
            <>
              <Link to="/historico" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground" }}>
                Histórico
              </Link>
              <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
                Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
          )}
        </nav>
      </div>
    </header>
  );
}