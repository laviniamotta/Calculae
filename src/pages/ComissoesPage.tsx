import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  getCommissionEstimate,
  validateCommissionRangeDrafts,
  type CommissionRange,
} from "../lib/commission";
import { todayInBrazil } from "../domain/dates";
import "../styles/comissoes.css";

type RangeForm = {
  min_sales: string;
  max_sales: string;
  commission_rate: string;
};

const emptyForm: RangeForm = {
  min_sales: "",
  max_sales: "",
  commission_rate: "",
};

/**
 * Formata os números digitados como moeda brasileira.
 * Os últimos dois dígitos representam os centavos.
 */
function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  const cents = Number(digits);

  if (!Number.isSafeInteger(cents)) return "";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Converte o valor formatado em reais para número decimal.
 */
function parseMoney(value: string): number | null {
  const digits = value.replace(/\D/g, "");

  if (!digits) return null;

  const cents = Number(digits);

  if (!Number.isSafeInteger(cents)) return null;

  return cents / 100;
}

function formatMoney(value: number): string {
  const safeValue =
    Number.isFinite(value) && value >= 0 ? value : 0;

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safeValue);
}

function formatRangeBound(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "Valor inválido";
  }

  return formatMoney(value);
}

function formatCommissionRate(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return "Taxa inválida";
  }

  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

export function ComissoesPage() {
  const { session } = useAuth();
  const userId = session?.user.id;

  const [ranges, setRanges] = useState<CommissionRange[]>([]);
  const [monthlySales, setMonthlySales] = useState(0);

  const [form, setForm] = useState<RangeForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /**
   * Carrega as faixas de comissão e as vendas do mês atual,
   * utilizando o calendário de America/Sao_Paulo.
   */
  const loadRanges = useCallback(async () => {
    if (!supabase || !userId) {
      setRanges([]);
      setMonthlySales(0);
      setError("Não foi possível identificar sua sessão.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const brazilToday = todayInBrazil();

      const startDate = `${brazilToday.slice(0, 7)}-01`;
      const endDate = brazilToday;

      const [
        { data: rangesData, error: rangesError },
        { data: salesData, error: salesError },
      ] = await Promise.all([
        supabase
          .from("commission_ranges")
          .select("id, min_sales, max_sales, commission_rate")
          .eq("user_id", userId)
          .order("min_sales", { ascending: true }),

        supabase
          .from("sales_entries")
          .select("amount")
          .eq("user_id", userId)
          .gte("sale_date", startDate)
          .lte("sale_date", endDate),
      ]);

      if (rangesError) throw rangesError;
      if (salesError) throw salesError;

      const normalizedRanges: CommissionRange[] = (
        rangesData ?? []
      ).map((item) => ({
        id: Number(item.id),
        min_sales: Number(item.min_sales),
        max_sales:
          item.max_sales === null
            ? null
            : Number(item.max_sales),
        commission_rate: Number(item.commission_rate),
      }));

      const salesTotal = (salesData ?? []).reduce(
        (total, item) => total + (Number(item.amount) || 0),
        0,
      );

      setRanges(normalizedRanges);
      setMonthlySales(salesTotal);
    } catch (err: unknown) {
      console.error("Erro ao carregar comissões:", err);

      setError(
        err instanceof Error
          ? `Não foi possível carregar os dados: ${err.message}`
          : "Não foi possível carregar as vendas e as faixas de comissão.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadRanges();
  }, [loadRanges]);

  /**
   * Recarrega os dados quando o dia muda no calendário brasileiro
   * ou quando o usuário retorna à página.
   */
  useEffect(() => {
    let lastBrazilDate = todayInBrazil();

    const intervalId = window.setInterval(() => {
      const currentBrazilDate = todayInBrazil();

      if (currentBrazilDate === lastBrazilDate) return;

      lastBrazilDate = currentBrazilDate;
      void loadRanges();
    }, 60_000);

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      lastBrazilDate = todayInBrazil();
      void loadRanges();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [loadRanges]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  }

  function startEditing(range: CommissionRange) {
    setEditingId(range.id);

    setForm({
      min_sales: formatRangeBound(range.min_sales),
      max_sales:
        range.max_sales === null
          ? ""
          : formatRangeBound(range.max_sales),
      commission_rate: String(range.commission_rate),
    });

    setError("");
    setMessage("");
  }

  /**
   * Salva uma faixa de cada vez.
   *
   * A validação progressiva permite configurar as faixas
   * sem exigir que todas estejam prontas no primeiro cadastro.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !userId) {
      setError("Não foi possível identificar sua sessão.");
      return;
    }

    if (saving) return;

    const min = parseMoney(form.min_sales);
    const hasMax = form.max_sales.trim().length > 0;

    const max = hasMax
      ? parseMoney(form.max_sales)
      : null;

    const rateValue = form.commission_rate
      .trim()
      .replace(",", ".");

    const rate = Number(rateValue);

    if (min === null || (hasMax && max === null)) {
      setError("Informe valores monetários válidos.");
      return;
    }

    if (
      !rateValue ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      setError("A comissão deve estar entre 0% e 100%.");
      return;
    }

    const candidate: CommissionRange = {
      id: editingId ?? -1,
      min_sales: min,
      max_sales: max,
      commission_rate: rate,
    };

    const nextRanges =
      editingId === null
        ? [...ranges, candidate]
        : ranges.map((range) =>
            range.id === editingId ? candidate : range,
          );

    // Permite faixas ainda incompletas durante a configuração,
    // mas impede valores inválidos e sobreposições.
    const validationError =
      validateCommissionRangeDrafts(nextRanges);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      user_id: userId,
      min_sales: min,
      max_sales: max,
      commission_rate: rate,
    };

    try {
      const result =
        editingId === null
          ? await supabase
              .from("commission_ranges")
              .insert(payload)
          : await supabase
              .from("commission_ranges")
              .update(payload)
              .eq("id", editingId)
              .eq("user_id", userId);

      if (result.error) {
        setError(
          `Não foi possível salvar: ${result.error.message}`,
        );
        return;
      }

      resetForm();
      setMessage("Faixa salva com sucesso.");

      await loadRanges();
    } catch (err: unknown) {
      console.error("Erro ao salvar faixa:", err);

      setError(
        err instanceof Error
          ? `Não foi possível salvar a faixa: ${err.message}`
          : "Ocorreu um erro inesperado ao salvar a faixa.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRange(id: number) {
    if (!supabase || !userId) {
      setError("Não foi possível identificar sua sessão.");
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza de que deseja excluir esta faixa?",
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("commission_ranges")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (deleteError) {
        setError(
          `Não foi possível excluir: ${deleteError.message}`,
        );
        return;
      }

      if (editingId === id) {
        setForm(emptyForm);
        setEditingId(null);
      }

      setMessage(
        "Faixa excluída. Revise a continuidade das faixas restantes.",
      );

      await loadRanges();
    } catch (err: unknown) {
      console.error("Erro ao excluir faixa:", err);

      setError(
        err instanceof Error
          ? `Não foi possível excluir: ${err.message}`
          : "Ocorreu um erro inesperado ao excluir a faixa.",
      );
    }
  }

  const sortedRanges = [...ranges].sort(
    (a, b) => a.min_sales - b.min_sales,
  );

  // O cálculo continua exigindo uma configuração completa e contínua.
  const commissionEstimate = getCommissionEstimate(
    monthlySales,
    ranges,
  );

  const activeRange = commissionEstimate.ok
    ? commissionEstimate.range
    : null;

  const estimatedCommission = commissionEstimate.ok
    ? commissionEstimate.amount
    : null;

  return (
    <section className="commission-page">
      <header className="commission-heading">
        <div>
          <p className="commission-eyebrow">SEU DESEMPENHO</p>
          <h1>Comissões</h1>
          <p>
            Configure suas faixas de faturamento e acompanhe seus
            percentuais.
          </p>
        </div>

        <Link to="/painel">Voltar ao painel</Link>
      </header>

      {error && (
        <div
          className="commission-feedback commission-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="commission-feedback commission-success"
          role="status"
        >
          {message}
        </div>
      )}

      <section className="commission-card">
        <div className="commission-card-heading">
          <div>
            <h2>Resultado estimado do mês</h2>
            <p>
              Estimativa calculada sobre o faturamento registrado neste mês.
            </p>
          </div>
        </div>

        <div className="commission-range-list">
          <article className="commission-range">
            <div>
              <span>Vendas do mês</span>
              <strong>
                {loading
                  ? "Carregando..."
                  : formatMoney(monthlySales)}
              </strong>
            </div>
          </article>

          <article className="commission-range">
            <div>
              <span>Faixa aplicada</span>
              <strong>
                {loading
                  ? "Carregando..."
                  : !commissionEstimate.ok
                    ? "Configuração incompleta"
                    : activeRange
                      ? formatCommissionRate(
                          activeRange.commission_rate,
                        )
                      : "Sem faixa correspondente"}
              </strong>
            </div>
          </article>

          <article className="commission-range">
            <div>
              <span>Comissão estimada</span>
              <strong>
                {loading
                  ? "Carregando..."
                  : !commissionEstimate.ok
                    ? "Indisponível"
                    : estimatedCommission !== null
                      ? formatMoney(estimatedCommission)
                      : "—"}
              </strong>
            </div>
          </article>
        </div>

        {!loading && !commissionEstimate.ok && (
          <div
            className="commission-feedback commission-error"
            role="status"
          >
            <strong>
              Sua configuração de comissão ainda não está completa.
            </strong>
            <p>
              {commissionEstimate.error} Você pode continuar cadastrando
              as faixas. A estimativa será liberada quando a cobertura
              estiver contínua e a última faixa estiver configurada
              como "em diante".
            </p>
          </div>
        )}

        {!loading &&
          commissionEstimate.ok &&
          !activeRange && (
            <p>
              O faturamento atual não está dentro de nenhuma faixa
              cadastrada. Revise os limites para que todas as vendas
              sejam contempladas.
            </p>
          )}

        {!loading &&
          commissionEstimate.ok &&
          activeRange && (
            <p>
              O percentual de{" "}
              {formatCommissionRate(activeRange.commission_rate)}{" "}
              foi aplicado sobre o faturamento total do mês.
            </p>
          )}
      </section>

      <section className="commission-card">
        <div className="commission-card-heading">
          <div>
            <h2>
              {editingId === null
                ? "Adicionar faixa"
                : "Editar faixa"}
            </h2>

            <p>
              O percentual será aplicado sobre todo o faturamento mensal
              quando a faixa for alcançada.
            </p>
          </div>
        </div>

        <form className="commission-form" onSubmit={handleSubmit}>
          <label>
            <span>Vendas a partir de (R$)</span>

            <input
              type="text"
              value={form.min_sales}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  min_sales: formatCurrencyInput(
                    event.target.value,
                  ),
                }))
              }
              placeholder="R$ 0,00"
              inputMode="numeric"
              required
            />
          </label>

          <label>
            <span>Vendas até (R$)</span>

            <input
              type="text"
              value={form.max_sales}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  max_sales: formatCurrencyInput(
                    event.target.value,
                  ),
                }))
              }
              placeholder="Em diante"
              inputMode="numeric"
            />
          </label>

          <label>
            <span>Comissão (%)</span>

            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.commission_rate}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  commission_rate: event.target.value,
                }))
              }
              placeholder="Ex.: 3"
              required
            />
          </label>

          <div className="commission-form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? "Salvando..."
                : editingId === null
                  ? "Adicionar faixa"
                  : "Salvar alterações"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="commission-card">
        <div className="commission-card-heading">
          <div>
            <h2>Suas faixas</h2>
            <p>{ranges.length} faixa(s) cadastrada(s).</p>
          </div>
        </div>

        {loading ? (
          <p>Carregando faixas...</p>
        ) : sortedRanges.length === 0 ? (
          <p>
            Nenhuma faixa cadastrada. Adicione sua primeira faixa acima.
          </p>
        ) : (
          <div className="commission-range-list">
            {sortedRanges.map((range, index) => (
              <article className="commission-range" key={range.id}>
                <div>
                  <span>Faixa {index + 1}</span>

                  <strong>
                    {formatRangeBound(range.min_sales)} até{" "}
                    {range.max_sales === null
                      ? "em diante"
                      : formatRangeBound(range.max_sales)}
                  </strong>

                  <small>
                    {formatCommissionRate(range.commission_rate)}{" "}
                    de comissão sobre o total vendido
                  </small>
                </div>

                <div className="commission-range-actions">
                  <button
                    type="button"
                    onClick={() => startEditing(range)}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => void deleteRange(range.id)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}