
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  getCommissionRange,
  calculateEstimatedCommission,
  type CommissionRange,
} from "../lib/commission";
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

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number.isFinite(value) ? value : 0);
}

function calculateSalesTotal(entries: SalesEntry[]): number {
  return entries.reduce(
    (total, entry) => total + (Number(entry.amount) || 0),
    0,
  );
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
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
  const [commissionRanges, setCommissionRanges] = useState<CommissionRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [todayString, setTodayString] = useState(() =>
    getLocalDateString(new Date()),
  );

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
      const now = new Date();

      const startDate = getLocalDateString(
        new Date(now.getFullYear(), now.getMonth(), 1),
      );

      const endDate = getLocalDateString(now);

      const [
        { data: salesData, error: salesError },
        { data: settingsData, error: settingsError },
        { data: rangesData, error: rangesError },
      ] = await Promise.all([
        supabase
          .from("sales_entries")
          .select("id, sale_date, entry_type, amount, quantity, created_at")
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

      setEntries(
        (salesData ?? []).map((entry) => ({
          ...entry,
          amount: Number(entry.amount) || 0,
          quantity: Number(entry.quantity) || 0,
        })) as SalesEntry[],
      );

      setSettings(
        settingsData
          ? {
              monthly_goal: Number(settingsData.monthly_goal ?? 0),
              currency_code: settingsData.currency_code ?? "BRL",
            }
          : null,
      );

      setCommissionRanges(
        (rangesData ?? []).map((range) => ({
          id: Number(range.id),
          min_sales: Number(range.min_sales),
          max_sales:
            range.max_sales === null ? null : Number(range.max_sales),
          commission_rate: Number(range.commission_rate),
        })),
      );
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

  useEffect(() => {
    let timeoutId: number | undefined;

    function scheduleNextMidnight() {
      const now = new Date();

      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        50,
      );

      timeoutId = window.setTimeout(() => {
        setTodayString(getLocalDateString(new Date()));
        void loadSales();
        scheduleNextMidnight();
      }, Math.max(0, nextMidnight.getTime() - now.getTime()));
    }

    scheduleNextMidnight();

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadSales]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      setTodayString(getLocalDateString(new Date()));
      void loadSales();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

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

  // A mesma regra de identificação e cálculo utilizada na página Comissões.
  const activeCommissionRange = getCommissionRange(
    monthTotal,
    commissionRanges,
  );

  const nextCommissionRange = getNextCommissionRange(
    monthTotal,
    commissionRanges,
  );

  const commissionRate =
    activeCommissionRange?.commission_rate ?? null;

  const estimatedCommission = calculateEstimatedCommission(
    monthTotal,
    activeCommissionRange,
  );

  const amountToNextRange = nextCommissionRange
    ? Math.max(0, nextCommissionRange.min_sales - monthTotal)
    : null;

  const monthlyGoal = settings?.monthly_goal ?? 0;

  const monthlyGoalProgress =
    monthlyGoal > 0 ? (monthTotal / monthlyGoal) * 100 : null;

  const amountToGoal =
    monthlyGoal > 0 ? Math.max(0, monthlyGoal - monthTotal) : null;

  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${todayString}T12:00:00`));

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
      value:
        estimatedCommission !== null
          ? formatCurrency(estimatedCommission, currency)
          : "—",
      description:
        commissionRate !== null
          ? `${commissionRate}% sobre o total vendido`
          : commissionRanges.length === 0
            ? "Configure suas faixas de comissão"
            : "Nenhuma faixa corresponde às vendas",
      icon: "%",
      status:
        commissionRate !== null
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

          <Link to="/vendas/nova" className="dashboard-primary-link">
            <span aria-hidden="true">＋</span> Registrar nova venda
          </Link>
        </div>

        <div className="dashboard-welcome-mark" aria-hidden="true">
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

        <div className="dashboard-indicators" aria-busy={loading}>
          {indicators.map((item) => (
            <article className="dashboard-indicator" key={item.label}>
              <div className="dashboard-indicator-top">
                <span className="dashboard-indicator-icon">
                  {item.icon}
                </span>

                <span className="dashboard-indicator-status">
                  {loading ? "Carregando" : item.status}
                </span>
              </div>

              <p className="dashboard-indicator-label">{item.label}</p>

              <strong className="dashboard-indicator-value">
                {loading ? "…" : item.value}
              </strong>

              <p className="dashboard-indicator-description">
                {loading ? "Buscando seus dados..." : item.description}
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

              <Link to="/vendas/nova" className="dashboard-text-link">
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
                  <strong>{formatCurrency(monthTotal, currency)}</strong>
                </div>

                <Link to="/historico" className="dashboard-text-link">
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

          <Link to="/vendas/nova" className="dashboard-action">
            <span className="dashboard-action-icon">＋</span>

            <span>
              <strong>Lançar vendas</strong>
              <small>Registrar uma nova venda</small>
            </span>

            <span className="dashboard-action-arrow">→</span>
          </Link>

          <Link to="/historico" className="dashboard-action">
            <span className="dashboard-action-icon">↗</span>

            <span>
              <strong>Histórico</strong>
              <small>Consultar seus registros</small>
            </span>

            <span className="dashboard-action-arrow">→</span>
          </Link>

          <Link to="/comissoes" className="dashboard-action">
            <span className="dashboard-action-icon">%</span>

            <span>
              <strong>Faixas de comissão</strong>
              <small>Gerenciar percentuais e limites</small>
            </span>

            <span className="dashboard-action-arrow">→</span>
          </Link>

          <Link to="/configuracoes" className="dashboard-action">
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
            <p>Acompanhe quanto já conquistou e o que falta alcançar.</p>
          </div>

          <Link to="/comissoes" className="dashboard-text-link">
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

              {activeCommissionRange ? (
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
                    {commissionRanges.length === 0
                      ? "Não configurada"
                      : "Não identificada"}
                  </strong>

                  <p>
                    {commissionRanges.length === 0
                      ? "Cadastre suas faixas de comissão."
                      : "Verifique os limites cadastrados."}
                  </p>

                  <small>
                    {commissionRanges.length === 0
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

              {nextCommissionRange && amountToNextRange !== null ? (
                <>
                  <strong className="dashboard-goal-value">
                    {formatCurrency(
                      nextCommissionRange.min_sales,
                      currency,
                    )}
                  </strong>

                  <p>
                    Falta {formatCurrency(amountToNextRange, currency)} em
                    vendas.
                  </p>

                  <small>
                    Próximo percentual: {nextCommissionRange.commission_rate}%
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
              {estimatedCommission !== null
                ? formatCurrency(estimatedCommission, currency)
                : commissionRanges.length === 0
                  ? "Configure suas faixas"
                  : "Nenhuma faixa correspondente"}
            </strong>
          </div>

          <Link to="/comissoes" className="dashboard-secondary-link">
            Abrir página de comissões →
          </Link>
        </div>
      </section>
    </main>
  );
}
