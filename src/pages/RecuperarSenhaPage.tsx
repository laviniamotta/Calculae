
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../styles/login.css";

export function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError("Informe o e-mail cadastrado.");
      return;
    }

    if (!supabase) {
      setError("O serviço de autenticação não está configurado.");
      return;
    }

    setLoading(true);

    try {
      const { error: requestError } =
        await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });

      if (requestError) {
        console.error("Erro ao recuperar senha:", requestError);

        const message = requestError.message.toLowerCase();

        if (
          message.includes("rate limit") ||
          message.includes("too many requests")
        ) {
          setError(
            "Muitas tentativas de recuperação foram realizadas. Aguarde um pouco antes de tentar novamente.",
          );
        } else {
          setError(
            "Não foi possível enviar o link de recuperação. Tente novamente mais tarde.",
          );
        }

        return;
      }

      setSent(true);
    } catch (err: unknown) {
      console.error("Erro ao recuperar senha:", err);

      setError(
        "Ocorreu um erro inesperado ao solicitar a recuperação. Tente novamente mais tarde.",
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
            Sua tranquilidade financeira importa
          </span>

          <h1>
            Recuperar
            <br />
            o acesso.
            <br />
            <span>Sem complicação.</span>
          </h1>

          <p>
            Vamos ajudar você a recuperar o acesso à sua conta com segurança.
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

            <p className="login-eyebrow">RECUPERAÇÃO DE ACESSO</p>

            <h2>
              {sent ? "Confira seu e-mail" : "Esqueceu sua senha?"}
            </h2>

            <p className="login-subtitle">
              {sent
                ? "Se houver uma conta associada a esse endereço, você receberá as instruções para redefinir sua senha."
                : "Informe o e-mail usado no cadastro para receber o link de recuperação."}
            </p>
          </div>

          {!sent && (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="recovery-email">E-mail</label>

                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
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
                {loading ? "Enviando..." : "Enviar link de recuperação"}
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
