import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import "../styles/login.css";

export function LoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email.trim(), password);
      navigate("/painel", { replace: true });
    } catch {
      setError("Não foi possível entrar. Confira seu e-mail e sua senha.");
    } finally {
      setLoading(false);
    }
  }

  if (session) {
    return <Navigate to="/painel" replace />;
  }

  return (
    <section className="login-page">
      <div className="login-layout">
        <aside className="login-intro">
          <span className="login-brand">
            Calcula<span>Ê!</span>
          </span>

          <span className="login-badge">
            <span className="login-status-dot" />
            Sua rotina financeira, mais simples
          </span>

          <h1>
            Suas contas
            <br />
            em ordem.
            <br />
            <span>Seu tempo de volta.</span>
          </h1>

          <p>
            Entre na sua conta e continue organizando suas finanças com
            clareza, praticidade e controle.
          </p>

          <div className="login-decoration" aria-hidden="true">
            <div className="login-decoration-bar bar-one" />
            <div className="login-decoration-bar bar-two" />
            <div className="login-decoration-bar bar-three" />
            <div className="login-decoration-bar bar-four" />
            <div className="login-decoration-line" />
          </div>
        </aside>

        <div className="login-card">
          <div className="login-card-heading">
            <span className="login-mobile-brand">
              Calcula<span>Ê!</span>
            </span>

            <p className="login-eyebrow">BEM-VINDA(O) DE VOLTA</p>
            <h2>Entre na sua conta</h2>
            <p className="login-subtitle">
              Informe seus dados para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <div className="login-password-heading">
                <label htmlFor="login-password">Senha</label>
                <Link to="/recuperar-senha">Esqueceu a senha?</Link>
              </div>

              <div className="login-password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar na minha conta"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="login-register">
            Ainda não tem uma conta?{" "}
            <Link to="/cadastro">Criar conta</Link>
          </p>

          <div className="login-security">
            <span aria-hidden="true">↗</span>
            Acesse sua conta com segurança.
          </div>
        </div>
      </div>
    </section>
  );
}