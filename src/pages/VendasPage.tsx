
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  parseBRL,
  formatBRL,
  isValidCents,
} from "../domain/money";
import { todayInBrazil } from "../domain/dates";
import "../styles/vendas.css";

export function VendasPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [saleDate, setSaleDate] = useState(todayInBrazil());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleAmountChange(value: string) {
    const digits = value.replace(/\D/g, "");

    if (!digits) {
      setAmount("");
      return;
    }

    const cents = Number(digits);

    if (isValidCents(cents)) {
      setAmount(formatBRL(cents));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!supabase || !session?.user.id) {
      setError("Sua sessão expirou. Entre novamente.");
      return;
    }

    if (!saleDate) {
      setError("Informe a data da venda.");
      return;
    }

    const amountCents = parseBRL(amount);

    if (amountCents === null || amountCents <= 0) {
      setError("Informe um valor válido maior que zero.");
      return;
    }

    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("sales_entries")
        .insert({
          user_id: session.user.id,
          sale_date: saleDate,
          entry_type: "individual",
          amount: amountCents / 100,
          quantity: 1,
          description: note.trim() || null,
        });

      if (insertError) {
        throw insertError;
      }

      setSuccess(`Venda registrada: ${formatBRL(amountCents)}.`);
      setAmount("");
      setNote("");
    } catch (err) {
      console.error("Erro ao salvar venda:", err);
      setError(
        "Não foi possível salvar. Verifique os dados e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="sales-page">
      <header className="sales-header">
        <div>
          <h1>Registrar vendas</h1>
          <p>
            Adicione cada venda ao longo do dia. Os valores serão somados
            automaticamente.
          </p>
        </div>
      </header>

      <form className="sales-form" onSubmit={handleSubmit}>
        <div className="sales-field">
          <label htmlFor="sale-date">Data da venda</label>
          <input
            id="sale-date"
            type="date"
            value={saleDate}
            onChange={(event) => setSaleDate(event.target.value)}
            required
          />
        </div>

        <div className="sales-field">
          <label htmlFor="sale-amount">Valor da venda</label>
          <input
            id="sale-amount"
            type="text"
            inputMode="numeric"
            placeholder="R$ 0,00"
            value={amount}
            onChange={(event) => handleAmountChange(event.target.value)}
            required
          />
        </div>

        <div className="sales-field">
          <label htmlFor="sale-note">Observação (opcional)</label>
          <textarea
            id="sale-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ex.: venda do turno da manhã"
          />
        </div>

        {error && (
          <p className="sales-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="sales-success" role="status">
            {success}
          </p>
        )}

        <div className="sales-actions">
          <button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Registrar venda"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/historico")}
          >
            Ver histórico
          </button>
        </div>
      </form>
    </main>
  );
}
