
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  getCommissionRange,
  calculateEstimatedCommission,
  type CommissionRange,
} from "../lib/commission";
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

/**
 * Valida a continuidade das faixas cadastradas.
 * A última faixa pode ficar sem limite máximo.
 */
function validateRanges(ranges: CommissionRange[]): string {
  if (ranges.length === 0) return "";

  const sorted = [...ranges].sort(
    (a, b) => a.min_sales - b.min_sales,
  );

  const first = sorted[0];

  if (!first) return "";

  if (first.min_sales !== 0) {
    return "A primeira faixa precisa começar em R$ 0,00.";
  }

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];

    if (!current) continue;

    if (
      current.max_sales !== null &&
      current.max_sales < current.min_sales
    ) {
      return `A faixa ${i + 1} possui um limite máximo menor que o mínimo.`;
    }

    if (i < sorted.length - 1) {
      const next = sorted[i + 1];

      if (!next) continue;

      if (current.max_sales === null) {
        return "Somente a última faixa pode ficar sem limite máximo.";
      }

      const currentMaxCents = Math.round(current.max_sales * 100);
      const nextMinCents = Math.round(next.min_sales * 100);

      if (nextMinCents <= currentMaxCents) {
        return `As faixas ${i + 1} e ${i + 2} estão sobrepostas.`;
      }

      if (nextMinCents !== currentMaxCents + 1) {
        return `Existe uma lacuna entre as faixas ${i + 1} e ${i + 2}.`;
      }
    }
  }

  return "";
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
   * Carrega as faixas de comissão e as vendas do mês atual.
   */
  const loadRanges = useCallback(async () => {
    if (!supabase || !userId) {
      setError("Não foi possível identificar sua sessão.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const now = new Date();

      const startDate = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        "01",
      ].join("-");

      const endDate = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

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

      const normalizedRanges: CommissionRange[] = (rangesData ?? []).map(
        (item) => ({
          id: Number(item.id),
          min_sales: Number(item.min_sales),
          max_sales:
            item.max_sales === null ? null : Number(item.max_sales),
          commission_rate: Number(item.commission_rate),
        }),
      );

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

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  }

  function startEditing(range: CommissionRange) {
    setEditingId(range.id);

    setForm({
      min_sales: formatMoney(range.min_sales),
      max_sales:
        range.max_sales === null
          ? ""
          : formatMoney(range.max_sales),
      commission_rate: String(range.commission_rate),
    });

    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !userId) {
      setError("Não foi possível identificar sua sessão.");
      return;
    }

    const min = parseMoney(form.min_sales);

    const max = form.max_sales.trim()
      ? parseMoney(form.max_sales)
      : null;

    const rateValue = form.commission_rate.trim().replace(",", ".");
    const rate = Number(rateValue);

    if (min === null || (form.max_sales.trim() && max === null)) {
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

    if (max !== null && max < min) {
      setError("O valor máximo não pode ser menor que o mínimo.");
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

    const validationError = validateRanges(nextRanges);

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
          ? await supabase.from("commission_ranges").insert(payload)
          : await supabase
              .from("commission_ranges")
              .update(payload)
              .eq("id", editingId)
              .eq("user_id", userId);

      if (result.error) {
        setError(`Não foi possível salvar: ${result.error.message}`);
      } else {
        resetForm();
        setMessage("Faixa salva com sucesso.");
        await loadRanges();
      }
    } catch {
      setError("Ocorreu um erro inesperado ao salvar a faixa.");
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
        setError(`Não foi possível excluir: ${deleteError.message}`);
        return;
      }

      if (editingId === id) {
        resetForm();
      }

      setMessage(
        "Faixa excluída. Revise a continuidade das faixas restantes.",
      );

      await loadRanges();
    } catch {
      setError("Ocorreu um erro inesperado ao excluir a faixa.");
    }
  }

  const sortedRanges = [...ranges].sort(
    (a, b) => a.min_sales - b.min_sales,
  );

  const activeRange = getCommissionRange(monthlySales, ranges);

  const estimatedCommission = calculateEstimatedCommission(
    monthlySales,
    activeRange,
  );

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
                {loading ? "Carregando..." : formatMoney(monthlySales)}
              </strong>
            </div>
          </article>

          <article className="commission-range">
            <div>
              <span>Faixa aplicada</span>
              <strong>
                {loading
                  ? "Carregando..."
                  : activeRange
                    ? `${activeRange.commission_rate}%`
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
                  : estimatedCommission !== null
                    ? formatMoney(estimatedCommission)
                    : "—"}
              </strong>
            </div>
          </article>
        </div>

        {!loading && !activeRange && (
          <p>
            O faturamento atual não está dentro de nenhuma faixa cadastrada.
            Revise os limites para que todas as vendas sejam contempladas.
          </p>
        )}

        {!loading && activeRange && (
          <p>
            O percentual de {activeRange.commission_rate}% foi aplicado
            sobre o faturamento total do mês.
          </p>
        )}
      </section>

      <section className="commission-card">
        <div className="commission-card-heading">
          <div>
            <h2>
              {editingId === null ? "Adicionar faixa" : "Editar faixa"}
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
                setForm({
                  ...form,
                  min_sales: formatCurrencyInput(event.target.value),
                })
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
                setForm({
                  ...form,
                  max_sales: formatCurrencyInput(event.target.value),
                })
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
                setForm({
                  ...form,
                  commission_rate: event.target.value,
                })
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
              <button type="button" onClick={resetForm}>
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
                    {formatMoney(range.min_sales)} até{" "}
                    {range.max_sales === null
                      ? "em diante"
                      : formatMoney(range.max_sales)}
                  </strong>

                  <small>
                    {range.commission_rate}% de comissão sobre o total
                    vendido
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
