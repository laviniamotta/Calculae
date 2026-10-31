
import { Link } from "react-router-dom";

const benefits = [
  {
    number: "01",
    icon: "chart",
    title: "Saiba quanto você ganha",
    description:
      "Calcule suas comissões e acompanhe o valor que suas vendas representam.",
  },
  {
    number: "02",
    icon: "target",
    title: "Acompanhe seu desempenho",
    description:
      "Visualize seus resultados, acompanhe seu progresso e tenha mais clareza sobre suas metas.",
  },
  {
    number: "03",
    icon: "wallet",
    title: "Planeje seus ganhos",
    description:
      "Estime seus rendimentos e organize melhor seus próximos passos financeiros.",
  },
];

function FinanceIcon({ type }: { type: string }) {
  if (type === "chart") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 19V5M4 19H21"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <rect x="7" y="11" width="3.5" height="6" rx="1" fill="currentColor" opacity=".45" />
        <rect x="12.5" y="7" width="3.5" height="10" rx="1" fill="currentColor" opacity=".7" />
        <rect x="18" y="3" width="2.5" height="14" rx="1" fill="currentColor" />
      </svg>
    );
  }

  if (type === "target") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <path
          d="M14 10 20 4m-4 0h4v4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="6"
        width="18"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3 10h18M7 15h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}

function FinanceIllustration() {
  return (
    <div className="finance-visual" aria-hidden="true">
      <div className="finance-orbit finance-orbit-one" />
      <div className="finance-orbit finance-orbit-two" />

      <div className="finance-float finance-float-money">
        <span className="finance-money-symbol">R$</span>
        <span>
          <i />
          <i />
          <i />
        </span>
      </div>

      <div className="finance-chart-card">
        <div className="finance-chart-heading">
          <span className="finance-chart-label">
            <span className="finance-status-dot" />
            Seus resultados
          </span>
          <span className="finance-chart-menu">•••</span>
        </div>

        <div className="finance-chart-decoration">
          <div className="finance-chart-y">
            <span />
            <span />
            <span />
          </div>

          <svg
            className="finance-chart-line"
            viewBox="0 0 300 115"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="financeArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#27A35A" stopOpacity=".24" />
                <stop offset="100%" stopColor="#27A35A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 96 C25 87 34 91 53 74 S85 83 106 58 S139 68 161 43 S195 53 218 30 S260 38 300 8 L300 115 L0 115 Z"
              fill="url(#financeArea)"
            />
            <path
              d="M0 96 C25 87 34 91 53 74 S85 83 106 58 S139 68 161 43 S195 53 218 30 S260 38 300 8"
              fill="none"
              stroke="#27A35A"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="218" cy="30" r="5" fill="#FFFFFF" stroke="#27A35A" strokeWidth="3" />
            <circle cx="300" cy="8" r="5" fill="#27A35A" stroke="#FFFFFF" strokeWidth="2" />
          </svg>
        </div>

        <div className="finance-chart-x">
          <span>Início</span>
          <span>Progresso</span>
          <span>Meta</span>
        </div>
      </div>

      <div className="finance-float finance-float-bars">
        <span className="finance-bars-title">Evolução</span>
        <div className="finance-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="finance-bars-caption">Acompanhe suas metas</span>
      </div>

      <div className="finance-coin finance-coin-one">+</div>
      <div className="finance-coin finance-coin-two">R$</div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="landing">
      <section className="landing-brand-block" aria-label="Marca CalculaÊ">
        <div className="landing-brand-decoration" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <Link
          className="landing-brand-name"
          to="/"
          aria-label="CalculaÊ — página inicial"
        >
          Calcula<span>Ê!</span>
        </Link>

        <p className="landing-brand-tagline">
          Comissão sem complicação.
        </p>

        <Link className="landing-client-link" to="/login">
          <span className="landing-client-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Área do vendedor
          <span className="landing-client-arrow" aria-hidden="true">↗</span>
        </Link>
      </section>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow">
            <span className="landing-eyebrow-dot" />
            Feito para quem vive de vendas
          </span>

          <h1>
            Suas vendas.
            <br />
            Seus ganhos.
            <br />
            <span>Tudo no seu controle.</span>
          </h1>

          <p className="landing-description">
            O CalculaÊ! ajuda você a acompanhar suas vendas, calcular
            comissões e estimar seus ganhos em um só lugar. Menos dúvidas
            sobre seus números, mais clareza para planejar o futuro.
          </p>

          <div className="landing-actions">
            <Link className="landing-cta" to="/cadastro">
              Crie sua conta grátis
              <span aria-hidden="true">→</span>
            </Link>

            <p>
              Já tem uma conta?{" "}
              <Link to="/login">Entre na sua conta</Link>
            </p>
          </div>

          <div className="landing-note">
            <span className="landing-note-check" aria-hidden="true">✓</span>
            Seus resultados organizados em um só lugar.
          </div>
        </div>

        <FinanceIllustration />
      </section>

      <section className="landing-benefits" aria-labelledby="benefits-title">
        <div className="landing-section-heading">
          <span className="landing-eyebrow">
            Mais clareza no dia a dia
          </span>

          <h2 id="benefits-title">
            Você vende.
            <br className="landing-mobile-break" /> O CalculaÊ! organiza os números.
          </h2>

          <p>
            Mais visibilidade sobre seus ganhos para acompanhar seu
            desempenho e planejar seus próximos objetivos.
          </p>
        </div>

        <div className="landing-benefit-grid">
          {benefits.map((benefit) => (
            <article className="landing-benefit-card" key={benefit.number}>
              <div className="landing-benefit-top">
                <span className="landing-benefit-icon">
                  <FinanceIcon type={benefit.icon} />
                </span>
                <span className="landing-benefit-number">
                  {benefit.number}
                </span>
              </div>

              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>

              <span className="landing-benefit-arrow" aria-hidden="true">
                ↗
              </span>
            </article>
          ))}
        </div>
      </section>


<footer className="landing-footer">
  <span className="landing-footer-brand">
    CalculaÊ! <span>· Comissão sem complicação.</span>
  </span>

  <span className="landing-creator">
    Desenvolvido por <strong>Lavinia Mota</strong>
    <span className="landing-creator-role">Desenvolvedora de Software</span>
  </span>

  <Link className="landing-footer-link" to="/login">
    Área do vendedor <span aria-hidden="true">→</span>
  </Link>
</footer>

    </div>
  );
}
