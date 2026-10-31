
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { formatBRL } from "../domain/money";
import { formatDateBR, todayInBrazil } from "../domain/dates";
import "../styles/historico.css";

interface SaleEntry {
  id: string;
  user_id: string;
  sale_date: string;
  amount: number;
  entry_type: "individual" | "daily_total";
  quantity: number;
  description: string | null;
  created_at: string;
}

function toCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export function HistoricoPage() {
  const { session } = useAuth();

  const [entries, setEntries] = useState<SaleEntry[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const today = todayInBrazil();
    return `${today.slice(0, 7)}-01`;
  });
  const [endDate, setEndDate] = useState(todayInBrazil());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (!supabase || !session?.user.id) {
      setEntries([]);
      setLoading(false);
      setError("Não foi possível identificar sua sessão.");
      return;
    }

    if (startDate > endDate) {
      setError("A data inicial não pode ser posterior à data final.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("sales_entries")
      .select(
        "id, user_id, sale_date, amount, entry_type, quantity, description, created_at"
      )
      .eq("user_id", session.user.id)
      .gte("sale_date", startDate)
      .lte("sale_date", endDate)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Erro ao carregar histórico:", queryError);
      setError("Não foi possível carregar o histórico de vendas.");
      setEntries([]);
    } else {
      setEntries((data ?? []) as SaleEntry[]);
    }

    setLoading(false);
  }, [session?.user.id, startDate, endDate]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const totalCents = useMemo(
    () => entries.reduce((sum, entry) => sum + toCents(entry.amount), 0),
    [entries]
  );

  const salesCount = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.quantity, 0),
    [entries]
  );

  async function saveDate(id: string) {
    if (!supabase || !session?.user.id || !editingDate) {
      setError("Informe uma data válida.");
      return;
    }

    setSavingId(id);
    setError("");

    const { error: updateError } = await supabase
      .from("sales_entries")
      .update({ sale_date: editingDate })
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (updateError) {
      console.error("Erro ao atualizar lançamento:", updateError);
      setError("Não foi possível atualizar a data do lançamento.");
    } else {
      setEditingId(null);
      setEditingDate("");
      await loadEntries();
    }

    setSavingId(null);
  }

  async function deleteEntry(entry: SaleEntry) {
    if (!supabase || !session?.user.id) {
      setError("Não foi possível identificar sua sessão.");
      return;
    }

    const confirmed = window.confirm(
      `Excluir o lançamento de ${formatBRL(toCents(entry.amount))} do dia ${formatDateBR(entry.sale_date)}?\n\nEssa ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    setDeletingId(entry.id);
    setError("");

    const { error: deleteError } = await supabase
      .from("sales_entries")
      .delete()
      .eq("id", entry.id)
      .eq("user_id", session.user.id);

    if (deleteError) {
      console.error("Erro ao excluir lançamento:", deleteError);
      setError("Não foi possível excluir o lançamento.");
    } else {
      if (editingId === entry.id) {
        setEditingId(null);
      }

      await loadEntries();
    }

    setDeletingId(null);
  }

  return (
    <main className="history-page">
      <header className="history-header">
        <div>
          <h1>Histórico de vendas</h1>
          <p>Consulte e gerencie os lançamentos do período.</p>
        </div>

        <button type="button" onClick={() => window.print()}>
          Exportar / imprimir
        </button>
      </header>

      <section className="history-filters">
        <div className="history-field">
          <label htmlFor="history-start">Data inicial</label>
          <input
            id="history-start"
            type="date"
            value={startDate}
            max={endDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>

        <div className="history-field">
          <label htmlFor="history-end">Data final</label>
          <input
            id="history-end"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={() => void loadEntries()}
          disabled={loading}
        >
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      </section>

      {error && (
        <p className="history-error" role="alert">
          {error}
        </p>
      )}

      <section className="history-summary">
        <article className="history-summary-card">
          <span>Total do período</span>
          <strong>{formatBRL(totalCents)}</strong>
        </article>

        <article className="history-summary-card">
          <span>Quantidade de vendas</span>
          <strong>{salesCount}</strong>
        </article>
      </section>

      <section className="history-list">
        {loading ? (
          <p aria-live="polite">Carregando lançamentos...</p>
        ) : entries.length === 0 ? (
          <div className="history-empty">
            <h2>Nenhum lançamento encontrado</h2>
            <p>Não há vendas registradas nesse período.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <article className="history-entry" key={entry.id}>
              <div className="history-entry-main">
                <div>
                  <strong>{formatBRL(toCents(entry.amount))}</strong>
                  <span className="history-entry-type">
                    Venda
                  </span>
                </div>

                {editingId === entry.id ? (
                  <div className="history-edit-date">
                    <label htmlFor={`date-${entry.id}`}>
                      Nova data
                    </label>

                    <input
                      id={`date-${entry.id}`}
                      type="date"
                      value={editingDate}
                      onChange={(event) =>
                        setEditingDate(event.target.value)
                      }
                    />

                    <button
                      type="button"
                      disabled={savingId === entry.id}
                      onClick={() => void saveDate(entry.id)}
                    >
                      {savingId === entry.id ? "Salvando..." : "Salvar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingDate("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <p className="history-entry-date">
                    {formatDateBR(entry.sale_date)}
                  </p>
                )}

                {entry.description && (
                  <p className="history-entry-note">
                    {entry.description}
                  </p>
                )}
              </div>

              <div className="history-entry-actions">
                {editingId !== entry.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(entry.id);
                      setEditingDate(entry.sale_date);
                      setError("");
                    }}
                  >
                    Editar data
                  </button>
                )}

                <button
                  type="button"
                  disabled={deletingId === entry.id}
                  onClick={() => void deleteEntry(entry)}
                >
                  {deletingId === entry.id ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
