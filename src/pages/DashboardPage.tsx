
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  getCommissionEstimate,
  type CommissionRange,
} from "../lib/commission";
import { todayInBrazil } from "../domain/dates";
import "../styles/dashboard.css";

type SalesEntry = {
  id: string;
  sale_date: string;
  entry_type: "individual" | "daily_total";
  amount: number;
  quantity: number;
  created_at: string;
};

type UserSettings = {
  monthly_goal: number;
  currency_code: string;
};

type DailySales = {
  date: string;
  total: number;
};

function formatCurrency(value: number, currency = "BRL"): string {
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(safeValue);
  } catch {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(safeValue);
  }
}

function calculateSalesTotal(entries: SalesEntry[]): number {
  return entries.reduce((total, entry) => {
    const amount = Number(entry.amount);

    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

/**
 * Formata uma data de calendário sem depender do fuso do dispositivo.
 */
function formatDate(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) return dateString;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.toISOString().slice(0, 10) !== dateString) {
    return dateString;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getNextCommissionRange(
  monthTotal: number,
  ranges: CommissionRange[],
): CommissionRange | null {
  return (
    [...ranges]
      .sort((a, b) => a.min_sales - b.min_sales)
      .find((range) => range.min_sales > monthTotal) ?? null
  );
}

function calculateDailySales(entries: SalesEntry[]): DailySales[] {
  const byDate = new Map<string, SalesEntry[]>();

  for (const entry of entries) {
    const dayEntries = byDate.get(entry.sale_date) ?? [];

    dayEntries.push(entry);
    byDate.set(entry.sale_date, dayEntries);
  }

  return Array.from(byDate.entries())
    .map(([date, dayEntries]) => ({
      date,
      total: calculateSalesTotal(dayEntries),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function DashboardPage() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [commissionRanges, setCommissionRanges] = useState<
    CommissionRange[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [todayString, setTodayString] = useState(() =>
    todayInBrazil(),
  );

  /**
   * Carrega vendas, configurações e faixas de comissão.
   * Todas as consultas pertencem exclusivamente ao usuário autenticado.
   */
  const loadSales = useCallback(async () => {
    if (!supabase || !userId) {
      setEntries([]);
      setSettings(null);
      setCommissionRanges([]);
      setLoading(false);
      setError("Não foi possível identificar sua sessão.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const brazilToday = todayInBrazil();

      const startDate = `${brazilToday.slice(0, 7)}-01`;
      const endDate = brazilToday;

      const [
        { data: salesData, error: salesError },
        { data: settingsData, error: settingsError },
        { data: rangesData, error: rangesError },
      ] = await Promise.all([
        supabase
          .from("sales_entries")
          .select(
            "id, sale_date, entry_type, amount, quantity, created_at",
          )
          .eq("user_id", userId)
          .gte("sale_date", startDate)
          .lte("sale_date", endDate)
          .order("created_at", { ascending: true }),

        supabase
          .from("user_settings")
          .select("monthly_goal, currency_code")
          .eq("user_id", userId)
          .maybeSingle(),

        supabase
          .from("commission_ranges")
          .select("id, min_sales, max_sales, commission_rate")
          .eq("user_id", userId)
          .order("min_sales", { ascending: true }),
      ]);

      if (salesError) throw salesError;
      if (settingsError) throw settingsError;
      if (rangesError) throw rangesError;

      const normalizedEntries: SalesEntry[] = (
        salesData ?? []
      ).map((entry) => {
        const amount = Number(entry.amount);
        const quantity = Number(entry.quantity);

        return {
          ...entry,
          amount: Number.isFinite(amount) ? amount : 0,
          quantity: Number.isFinite(quantity) ? quantity : 0,
        } as SalesEntry;
      });

      const normalizedSettings: UserSettings | null = settingsData
        ? {
            monthly_goal: Number.isFinite(
              Number(settingsData.monthly_goal),
            )
              ? Math.max(0, Number(settingsData.monthly_goal))
              : 0,

            currency_code: ["BRL", "USD", "EUR"].includes(
              settingsData.currency_code,
            )
              ? settingsData.currency_code
              : "BRL",
          }
        : null;

      const normalizedRanges: CommissionRange[] = (
        rangesData ?? []
      ).map((range) => ({
        id: Number(range.id),
        min_sales: Number(range.min_sales),
        max_sales:
          range.max_sales === null
            ? null
            : Number(range.max_sales),
        commission_rate: Number(range.commission_rate),
      }));

      setEntries(normalizedEntries);
      setSettings(normalizedSettings);
      setCommissionRanges(normalizedRanges);

    } catch (err: unknown) {
      console.error("Erro ao carregar dashboard:", err);

      setError(
        "Não foi possível carregar seus dados. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  /**
   * Atualiza o painel quando o dia muda em America/Sao_Paulo.
   * A verificação ocorre a cada minuto, sem depender do relógio local.
   */
  useEffect(() => {
    let lastBrazilDate = todayInBrazil();

    const intervalId = window.setInterval(() => {
      const currentBrazilDate = todayInBrazil();

      if (currentBrazilDate === lastBrazilDate) return;

      lastBrazilDate = currentBrazilDate;
      setTodayString(currentBrazilDate);

      void loadSales();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadSales]);

  /**
   * Atualiza os dados quando o usuário retorna à aba do aplicativo.
   */
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      const currentBrazilDate = todayInBrazil();

      setTodayString(currentBrazilDate);
      void loadSales();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [loadSales]);

  const currency = settings?.currency_code || "BRL";

  const todayEntries = entries.filter(
    (entry) => entry.sale_date === todayString,
  );

  const todayTotal = calculateSalesTotal(todayEntries);
  const monthTotal = calculateSalesTotal(entries);

  const todayEntryCount = todayEntries.length;
  const monthEntryCount = entries.length;

  /**
   * Utiliza a mesma camada segura de cálculo da página Comissões.
   * Configurações inválidas não podem interromper a renderização.
   */
  const commissionEstimate = getCommissionEstimate(
    monthTotal,
    commissionRanges,
  );

  const activeCommissionRange = commissionEstimate.ok
    ? commissionEstimate.range
    : null;

  const nextCommissionRange = commissionEstimate.ok
    ? getNextCommissionRange(monthTotal, commissionRanges)
    : null;

  const commissionRate = commissionEstimate.ok
    ? commissionEstimate.range?.commission_rate ?? null
    : null;

  const estimatedCommission = commissionEstimate.ok
    ? commissionEstimate.amount
    : null;

  const amountToNextRange = nextCommissionRange
    ? Math.max(0, nextCommissionRange.min_sales - monthTotal)
    : null;

  const monthlyGoal = settings?.monthly_goal ?? 0;

  const monthlyGoalProgress =
    monthlyGoal > 0 ? (monthTotal / monthlyGoal) * 100 : null;

  const amountToGoal =
    monthlyGoal > 0
      ? Math.max(0, monthlyGoal - monthTotal)
      : null;

  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(`${todayString}T12:00:00Z`),
  );

  const dailySales = useMemo(
    () => calculateDailySales(entries),
    [entries],
  );

  const chartMax = Math.max(
    1,
    ...dailySales.map((item) => item.total),
  );

  const indicators = [
    {
      label: "Vendas de hoje",
      value: formatCurrency(todayTotal, currency),
      description: `${todayEntryCount} lançamento(s) hoje`,
      icon: "↗",
      status: "Hoje",
    },
    {
      label: "Vendas do mês",
      value: formatCurrency(monthTotal, currency),
      description: `${monthEntryCount} lançamento(s) no mês`,
      icon: "R$",
      status: "Mês atual",
    },
    {
      label: "Comissão estimada",
      value: !commissionEstimate.ok
        ? "Indisponível"
        : estimatedCommission !== null
          ? formatCurrency(estimatedCommission, currency)
          : "—",

      description: !commissionEstimate.ok
        ? "Revise as faixas cadastradas"
        : commissionRate !== null
          ? `${commissionRate}% sobre o total vendido`
          : commissionRanges.length === 0
            ? "Configure suas faixas de comissão"
            : "Nenhuma faixa corresponde às vendas",

      icon: "%",

      status: !commissionEstimate.ok
        ? "Revisar"
        : commissionRate !== null
          ? "Calculada"
          : "Pendente",
    },
    {
      label: "Meta mensal",
      value:
        monthlyGoal > 0
          ? formatCurrency(monthlyGoal, currency)
          : "—",

      description:
        amountToGoal !== null
          ? amountToGoal === 0
            ? "Objetivo alcançado"
            : `Faltam ${formatCurrency(amountToGoal, currency)}`
          : "Defina sua meta mensal",

      icon: "◎",

      status:
        amountToGoal === 0 && monthlyGoal > 0
          ? "Concluída"
          : monthlyGoal > 0
            ? "Em andamento"
            : "Pendente",
    },
  ];

  return (
    <main className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">CALCULAÊ / PAINEL</p>
          <h1>Visão geral</h1>
          <p className="dashboard-date">{today}</p>
        </div>

        <Link to="/historico" className="dashboard-history-link">
          Histórico de vendas <span aria-hidden="true">→</span>
        </Link>
      </header>

      <section className="dashboard-welcome">
        <div className="dashboard-welcome-content">
          <span className="dashboard-welcome-label">
            SEU DESEMPENHO, EM UM SÓ LUGAR
          </span>

          <h2>Olá! Vamos acompanhar seus resultados?</h2>

          <p>
            Tenha uma visão clara das suas vendas, metas e comissões.
          </p>

          <Link
            to="/vendas/nova"
            className="dashboard-primary-link"
          >
            <span aria-hidden="true">＋</span> Registrar nova venda
          </Link>
        </div>

        <div
          className="dashboard-welcome-mark"
          aria-hidden="true"
        >
          <span>Ê</span>
        </div>
      </section>

      {error && (
        <div className="dashboard-error" role="alert">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => void loadSales()}
            disabled={loading}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-eyebrow">ACOMPANHAMENTO</p>
            <h2>Resumo do período</h2>
            <p>Os principais números do seu mês.</p>
          </div>

          <span className="dashboard-period">Mês atual</span>
        </div>

        <div
          className="dashboard-indicators"
          aria-busy={loading}
        >
          {indicators.map((item) => (
            <article
              className="dashboard-indicator"
              key={item.label}
            >
              <div className="dashboard-indicator-top">
                <span className="dashboard-indicator-icon">
                  {item.icon}
                </span>

                <span className="dashboard-indicator-status">
                  {loading ? "Carregando" : item.status}
                </span>
              </div>

              <p className="dashboard-indicator-label">
                {item.label}
              </p>

              <strong className="dashboard-indicator-value">
                {loading ? "…" : item.value}
              </strong>

              <p className="dashboard-indicator-description">
                {loading
                  ? "Buscando seus dados..."
                  : item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel dashboard-performance">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">EVOLUÇÃO</p>
              <h2>Desempenho de vendas</h2>
              <p>Faturamento por dia com lançamentos.</p>
            </div>

            <span className="dashboard-panel-icon">↗</span>
          </div>

          {loading ? (
            <div className="dashboard-empty-state">
              <strong>Carregando resultados</strong>
              <p>Estamos buscando seus lançamentos.</p>
            </div>
          ) : dailySales.length === 0 ? (
            <div className="dashboard-empty-state">
              <span className="dashboard-empty-icon">↗</span>

              <strong>Seu histórico começa aqui</strong>

              <p>
                Registre sua primeira venda para acompanhar sua evolução.
              </p>

              <Link
                to="/vendas/nova"
                className="dashboard-text-link"
              >
                Registrar primeira venda →
              </Link>
            </div>
          ) : (
            <>
              <div
                className="dashboard-sales-chart"
                role="img"
                aria-label="Gráfico de faturamento por dia no mês atual"
              >
                {dailySales.map((item) => {
                  const height = Math.max(
                    5,
                    (item.total / chartMax) * 145,
                  );

                  return (
                    <div
                      className="dashboard-chart-column"
                      key={item.date}
                    >
                      <span className="dashboard-chart-value">
                        {formatCurrency(item.total, currency)}
                      </span>

                      <div className="dashboard-chart-bar-area">
                        <div
                          className="dashboard-chart-bar"
                          style={{ height: `${height}px` }}
                          title={`${formatDate(item.date)}: ${formatCurrency(
                            item.total,
                            currency,
                          )}`}
                        />
                      </div>

                      <span className="dashboard-chart-day">
                        {Number(item.date.slice(8, 10))}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="dashboard-chart-footer">
                <div>
                  <span>Total vendido no mês</span>
                  <strong>
                    {formatCurrency(monthTotal, currency)}
                  </strong>
                </div>

                <Link
                  to="/historico"
                  className="dashboard-text-link"
                >
                  Ver lançamentos →
                </Link>
              </div>
            </>
          )}
        </article>

        <article className="dashboard-panel dashboard-quick-panel">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">ATALHOS</p>
              <h2>Acesso rápido</h2>
              <p>Encontre o que precisa.</p>
            </div>
          </div>

          <Link
            to="/vendas/nova"
            className="dashboard-action"
          >
            <span className="dashboard-action-icon">＋</span>

            <span>
              <strong>Lançar vendas</strong>
              <small>Registrar uma nova venda</small>
            </span>

            <span className="dashboard-action-arrow">→</span>
          </Link>

          <Link
            to="/historico"
            className="dashboard-action"
          >
            <span className="dashboard-action-icon">↗</span>

            <span>
              <strong>Histórico</strong>
              <small>Consultar seus registros</small>
            </span>

            <span className="dashboard-action-arrow">→</span>
          </Link>

          <Link
            to="/comissoes"
            className="dashboard-action"
          >
            <span className="dashboard-action-icon">%</span>

            <span>
              <strong>Faixas de comissão</strong>
              <small>Gerenciar percentuais e limites</small>
            </span>

            <span className="dashboard-action-arrow">→</span>
          </Link>

          <Link
            to="/configuracoes"
            className="dashboard-action"
          >
            <span className="dashboard-action-icon">⚙</span>

            <span>
              <strong>Configurações</strong>
              <small>Dados, meta e remuneração</small>
            </span>

            <span className="dashboard-action-arrow">→</span>
          </Link>
        </article>
      </section>

      <section className="dashboard-panel dashboard-goals-panel">
        <div className="dashboard-section-heading">
          <div>
            <p className="dashboard-eyebrow">SEUS OBJETIVOS</p>
            <h2>Metas e comissões</h2>
            <p>
              Acompanhe quanto já conquistou e o que falta alcançar.
            </p>
          </div>

          <Link
            to="/comissoes"
            className="dashboard-text-link"
          >
            Gerenciar comissões →
          </Link>
        </div>

        {loading ? (
          <div className="dashboard-empty-state">
            <strong>Carregando metas e comissões</strong>
            <p>Buscando suas faixas e seu faturamento.</p>
          </div>
        ) : (
          <div className="dashboard-goals-grid">
            <article className="dashboard-goal-card">
              <div className="dashboard-goal-card-heading">
                <span className="dashboard-goal-icon">%</span>

                <span className="dashboard-goal-caption">
                  FAIXA ATUAL
                </span>
              </div>

              {commissionEstimate.ok && activeCommissionRange ? (
                <>
                  <strong className="dashboard-goal-value">
                    {activeCommissionRange.commission_rate}%
                  </strong>

                  <p>
                    {formatCurrency(
                      activeCommissionRange.min_sales,
                      currency,
                    )}
                    {" — "}
                    {activeCommissionRange.max_sales === null
                      ? "sem limite"
                      : formatCurrency(
                          activeCommissionRange.max_sales,
                          currency,
                        )}
                  </p>

                  <small>
                    Percentual aplicado sobre as vendas do mês.
                  </small>
                </>
              ) : (
                <>
                  <strong className="dashboard-goal-value dashboard-goal-value-text">
                    {!commissionEstimate.ok
                      ? "Configuração inválida"
                      : commissionRanges.length === 0
                        ? "Não configurada"
                        : "Não identificada"}
                  </strong>

                  <p>
                    {!commissionEstimate.ok
                      ? "Não foi possível validar suas faixas."
                      : commissionRanges.length === 0
                        ? "Cadastre suas faixas de comissão."
                        : "Verifique os limites cadastrados."}
                  </p>

                  <small>
                    {!commissionEstimate.ok
                      ? commissionEstimate.error
                      : commissionRanges.length === 0
                        ? "Configure seus percentuais para acompanhar a estimativa."
                        : "O faturamento atual não corresponde a uma faixa."}
                  </small>
                </>
              )}
            </article>

            <article className="dashboard-goal-card">
              <div className="dashboard-goal-card-heading">
                <span className="dashboard-goal-icon">↗</span>

                <span className="dashboard-goal-caption">
                  PRÓXIMA FAIXA
                </span>
              </div>

              {!commissionEstimate.ok ? (
                <>
                  <strong className="dashboard-goal-value dashboard-goal-value-text">
                    Configuração inválida
                  </strong>

                  <p>
                    Não foi possível identificar a próxima faixa.
                  </p>

                  <small>{commissionEstimate.error}</small>
                </>
              ) : nextCommissionRange &&
                amountToNextRange !== null ? (
                <>
                  <strong className="dashboard-goal-value">
                    {formatCurrency(
                      nextCommissionRange.min_sales,
                      currency,
                    )}
                  </strong>

                  <p>
                    Falta{" "}
                    {formatCurrency(amountToNextRange, currency)} em vendas.
                  </p>

                  <small>
                    Próximo percentual:{" "}
                    {nextCommissionRange.commission_rate}%
                  </small>
                </>
              ) : (
                <>
                  <strong className="dashboard-goal-value dashboard-goal-value-text">
                    {commissionRanges.length === 0
                      ? "Aguardando"
                      : "Última faixa"}
                  </strong>

                  <p>
                    {commissionRanges.length === 0
                      ? "Configure suas faixas para ver o próximo objetivo."
                      : "Você está na faixa mais alta cadastrada."}
                  </p>

                  <small>
                    {commissionRanges.length === 0
                      ? "Os objetivos aparecerão aqui."
                      : "Continue acompanhando suas vendas."}
                  </small>
                </>
              )}
            </article>

            <article className="dashboard-goal-card dashboard-personal-goal">
              <div className="dashboard-goal-card-heading">
                <span className="dashboard-goal-icon">◎</span>

                <span className="dashboard-goal-caption">
                  META PESSOAL
                </span>
              </div>

              {monthlyGoal > 0 && amountToGoal !== null ? (
                <>
                  <strong className="dashboard-goal-value">
                    {amountToGoal === 0
                      ? "Concluída!"
                      : formatCurrency(amountToGoal, currency)}
                  </strong>

                  <p>
                    {amountToGoal === 0
                      ? "Você alcançou sua meta mensal."
                      : "Valor que falta para atingir sua meta."}
                  </p>

                  <div
                    className="dashboard-goal-progress"
                    role="progressbar"
                    aria-label="Progresso da meta mensal"
                    aria-valuenow={Math.min(
                      100,
                      Math.max(0, monthlyGoalProgress ?? 0),
                    )}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="dashboard-goal-progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, monthlyGoalProgress ?? 0),
                        )}%`,
                      }}
                    />
                  </div>

                  <small>
                    {formatCurrency(monthTotal, currency)} de{" "}
                    {formatCurrency(monthlyGoal, currency)} ·{" "}
                    {monthlyGoalProgress?.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </small>
                </>
              ) : (
                <>
                  <strong className="dashboard-goal-value dashboard-goal-value-text">
                    Não definida
                  </strong>

                  <p>Defina seu objetivo de vendas mensal.</p>

                  <small>
                    <Link
                      to="/configuracoes"
                      className="dashboard-text-link"
                    >
                      Configurar meta →
                    </Link>
                  </small>
                </>
              )}
            </article>
          </div>
        )}

        <div className="dashboard-goals-footer">
          <div>
            <span>Comissão estimada neste mês</span>

            <strong>
              {!commissionEstimate.ok
                ? "Revise suas faixas cadastradas"
                : estimatedCommission !== null
                  ? formatCurrency(estimatedCommission, currency)
                  : commissionRanges.length === 0
                    ? "Configure suas faixas"
                    : "Nenhuma faixa correspondente"}
            </strong>
          </div>

          <Link
            to="/comissoes"
            className="dashboard-secondary-link"
          >
            Abrir página de comissões →
          </Link>
        </div>
      </section>
    </main>
  );
}
