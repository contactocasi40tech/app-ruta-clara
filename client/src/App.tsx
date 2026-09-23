import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SupabaseAuthProvider, useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import AuthPage from "@/pages/AuthPage";
import RachaDiaria from "@/pages/RachaDiaria";

const BRAND_MARK = "/manus-storage/ruta-clara-mark_a36fc144.png";

function AuthGate() {
  const { user, loading, recoveryMode } = useSupabaseAuth();

  if (loading) {
    return (
      <main className="auth-loading" aria-live="polite">
        <img src={BRAND_MARK} alt="" />
        <strong>Ruta Clara</strong>
        <span>Protegiendo tu espacio privado…</span>
      </main>
    );
  }

  if (!user || recoveryMode) return <AuthPage recoveryMode={recoveryMode} />;
  return <RachaDiaria />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <SupabaseAuthProvider>
            <Toaster />
            <AuthGate />
          </SupabaseAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
