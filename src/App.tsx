
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";

import { supabase } from "./lib/supabase";
import { useAuth } from "./lib/auth";

import { ComingSoon } from "./pages/ComingSoon";
import { ConfigMissing } from "./pages/ConfigMissing";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { CadastroPage } from "./pages/CadastroPage";
import { RecuperarSenhaPage } from "./pages/RecuperarSenhaPage";
import { RedefinirSenhaPage } from "./pages/RedefinirSenhaPage";
import { DashboardPage } from "./pages/DashboardPage";
import { VendasPage } from "./pages/VendasPage";
import { HistoricoPage } from "./pages/HistoricoPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import { ComissoesPage } from "./pages/ComissoesPage.tsx";

function Home() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <main className="card" aria-live="polite">
        <p>Carregando sua sessão...</p>
      </main>
    );
  }

  if (session) {
    return <Navigate to="/painel" replace />;
  }

  return <LandingPage />;
}

export function App() {
  if (!supabase) {
    return <ConfigMissing />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<CadastroPage />} />

        <Route
          path="/recuperar-senha"
          element={<RecuperarSenhaPage />}
        />

        <Route
          path="/redefinir-senha"
          element={<RedefinirSenhaPage />}
        />

        <Route element={<RequireAuth />}>
          <Route path="/painel" element={<DashboardPage />} />
          <Route path="/vendas/nova" element={<VendasPage />} />
          <Route path="/historico" element={<HistoricoPage />} />
          <Route
            path="/configuracoes"
            element={<ConfiguracoesPage />}
          />
          <Route
            path="/comissoes"
            element={<ComissoesPage />}
          />
        </Route>

        <Route element={<RequireAuth admin />}>
          <Route
            path="/admin"
            element={
              <ComingSoon
                title="Administração"
                stage="Etapa 4"
              />
            }
          />
        </Route>

        <Route
          path="*"
          element={
            <section className="card">
              <h1>Página não encontrada</h1>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
