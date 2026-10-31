
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/login.css";

export function RedefinirSenhaPage() {
  const navigate = useNavigate();

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
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (!supabase) {
      setError("O serviço está indisponível. Tente novamente mais tarde.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setError(
          "Seu link pode ter expirado ou já ter sido utilizado. Solicite uma nova recuperação de senha.",
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setSuccess(true);
    } catch {
      setError(
        "Não foi possível alterar a senha. Solicite um novo link e tente novamente.",
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
            Sua conta, protegida
          </span>

          <h1>
            Uma nova
            <br />
            senha.
            <br />
            <span>Um novo começo.</span>
          </h1>

          <p>
            Escolha uma nova senha para recuperar o acesso à sua vida
            financeira organizada.
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
            <Link to="/" className="login-mobile-brand">
              Calcula<span>Ê</span>.
            </Link>

            <p className="login-eyebrow">SEGURANÇA DA CONTA</p>
            <h2>
              {success ? "Senha atualizada!" : "Defina sua nova senha"}
            </h2>
            <p className="login-subtitle">
              {success
                ? "Sua senha foi alterada. Agora você já pode entrar com a nova senha."
                : "Escolha uma senha com pelo menos 6 caracteres."}
            </p>
          </div>

          {success ? (
            <button
              className="login-submit"
              type="button"
              onClick={() => navigate("/login", { replace: true })}
            >
              Ir para o login <span aria-hidden="true">→</span>
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="new-password">Nova senha</label>
                <div className="login-password-wrapper">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Mínimo de 6 caracteres"
                    minLength={6}
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

              <div className="login-field">
                <label htmlFor="confirm-new-password">Confirmar nova senha</label>
                <input
                  id="confirm-new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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
                {loading ? "Salvando..." : "Salvar nova senha"}
                {!loading && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}

          <p className="login-register">
            Lembrou sua senha? <Link to="/login">Voltar ao login</Link>
          </p>

          <div className="login-security">
            <span aria-hidden="true">↗</span>
            Sua segurança vem primeiro.
          </div>
        </div>
      </div>
    </section>
  );
}
