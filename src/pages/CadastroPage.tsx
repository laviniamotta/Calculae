
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import "../styles/login.css";

export function CadastroPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Sua senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      await signUp(name.trim(), email.trim(), password);
      setSuccess(true);
        } catch (caughtError: unknown) {
      const authError = caughtError as {
        code?: string;
        message?: string;
      };

      const errorCode = authError.code?.toLowerCase();
      const errorMessage = authError.message?.toLowerCase() ?? "";

      const signupsDisabled =
        errorCode === "signup_disabled" ||
        errorMessage.includes("signups not allowed") ||
        errorMessage.includes("signups are disabled") ||
        errorMessage.includes("signup is disabled");

      setError(
        signupsDisabled
          ? "Cadastros temporariamente encerrados. O CalculaÊ! não está aceitando novas contas no momento. Se você já possui uma conta, poderá acessar normalmente."
          : "Não foi possível criar sua conta. Confira os dados ou tente outro e-mail.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-page">
      <div className="login-layout">
        <aside className="login-intro">
          <Link to="/" className="login-brand">
            Calcula<span>Ê</span>.
          </Link>

          <span className="login-badge">
            <span className="login-status-dot" />
            Organização financeira começa aqui
          </span>

          <h1>
            Um novo jeito
            <br />
            de cuidar
            <br />
            <span>do seu dinheiro.</span>
          </h1>

          <p>
            Crie sua conta e comece a organizar suas finanças com mais
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
          {success ? (
            <div className="login-card-heading">
              <p className="login-eyebrow">QUASE LÁ!</p>
              <h2>Confira seu e-mail</h2>
              <p className="login-subtitle">
                Se a confirmação de e-mail estiver habilitada, acesse sua
                caixa de entrada para confirmar o cadastro antes de entrar.
                Se ela estiver desabilitada, sua conta poderá estar pronta
                para acesso.
              </p>

              <button
                className="login-submit"
                type="button"
                onClick={() => navigate("/login")}
              >
                Ir para o login <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : (
            <>
              <div className="login-card-heading">
                <Link to="/" className="login-mobile-brand">
                  Calcula<span>Ê</span>.
                </Link>

                <p className="login-eyebrow">COMECE AGORA</p>
                <h2>Crie sua conta</h2>
                <p className="login-subtitle">
                  Preencha seus dados para começar.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-field">
                  <label htmlFor="register-name">Nome completo</label>
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Como podemos te chamar?"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="register-email">E-mail</label>
                  <input
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="login-field">
                  <label htmlFor="register-password">Senha</label>
                  <div className="login-password-wrapper">
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Mínimo de 6 caracteres"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      className="login-password-toggle"
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                    >
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="register-confirm-password">
                    Confirmar senha
                  </label>
                  <input
                    id="register-confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    required
                  />
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
                  {loading ? "Criando conta..." : "Criar minha conta"}
                  {!loading && <span aria-hidden="true">→</span>}
                </button>
              </form>

              <p className="login-register">
                Já tem uma conta? <Link to="/login">Entrar</Link>
              </p>

              <div className="login-security">
                <span aria-hidden="true">↗</span>
                Seus dados são tratados com segurança.
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
