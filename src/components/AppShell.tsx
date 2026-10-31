
import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { UpdatePrompt } from "./UpdatePrompt";

type PageErrorBoundaryProps = {
  children: ReactNode;
};

type PageErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Protege o conteúdo da página contra erros inesperados de renderização.
 */
class PageErrorBoundary extends Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  override state: PageErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): PageErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro inesperado ao renderizar a página:", error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <section className="card" role="alert">
          <h1>Não foi possível exibir esta página</h1>

          <p>
            Ocorreu um erro inesperado ao carregar o conteúdo.
            Tente acessar novamente.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </section>
      );
    }

    return this.props.children;
  }
}

export function AppShell() {
  const { session, isAdmin, signOut } = useAuth();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <header className="header">
        <Logo />

        {session && (
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-toggle-line" />
            <span className="menu-toggle-line" />
            <span className="menu-toggle-line" />
          </button>
        )}

        {session && (
          <nav
            id="menu-principal"
            className={`nav${menuOpen ? " nav--open" : ""}`}
            aria-label="Principal"
            onClick={() => setMenuOpen(false)}
          >
            <NavLink to="/painel">Painel</NavLink>
            <NavLink to="/vendas/nova">Lançar vendas</NavLink>
            <NavLink to="/historico">Histórico</NavLink>
            <NavLink to="/configuracoes">Configurações</NavLink>

            {isAdmin === true && (
              <NavLink to="/admin">Administração</NavLink>
            )}
          </nav>
        )}

        <div className="header-actions">
          <ThemeToggle />

          {session && (
            <button
              type="button"
              className="logout-button"
              onClick={() => void signOut()}
              aria-label="Sair da conta"
              title="Sair"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
              </svg>
              <span>Sair</span>
            </button>
          )}
        </div>
      </header>

      <main id="conteudo" className="main">
        <PageErrorBoundary key={location.pathname}>
          <Outlet />
        </PageErrorBoundary>
      </main>

      <UpdatePrompt />
    </>
  );
}
