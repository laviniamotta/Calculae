
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import "../styles/configuracoes.css";

type SettingsForm = {
  company_name: string;
  professional_name: string;
  job_title: string;
  base_salary: string;
  transport_allowance: string;
  other_benefits: string;
  fixed_deductions: string;
  currency_code: string;
};

const initialForm: SettingsForm = {
  company_name: "",
  professional_name: "",
  job_title: "",
  base_salary: "0",
  transport_allowance: "0",
  other_benefits: "0",
  fixed_deductions: "0",
  currency_code: "BRL",
};

function parseDecimal(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericValue(value: string): number {
  return Math.max(0, parseDecimal(value));
}

function formatMoneyInput(value: string): string {
  const number = Number(value);

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

function parseMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (!digits) return "0.00";

  const cents = Number(digits);

  if (!Number.isFinite(cents)) return "0.00";

  return (cents / 100).toFixed(2);
}

function money(value: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number.isFinite(value) ? value : 0);
  }
}

type MoneyInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

function MoneyInput({
  label,
  value,
  onChange,
  required = false,
}: MoneyInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!editing) {
      setDraft(formatMoneyInput(value));
    }
  }, [value, editing]);

  function handleFocus() {
    setEditing(true);
    setDraft("");
  }

  function handleChange(input: string) {
    const digits = input.replace(/\D/g, "");

    setDraft(
      digits
        ? formatMoneyInput(parseMoneyInput(digits))
        : "",
    );

    onChange(digits ? parseMoneyInput(digits) : "0.00");
  }

  function handleBlur() {
    setEditing(false);
    setDraft(formatMoneyInput(value));
  }

  return (
    <label className="settings-field">
      <span>{label}</span>

      <div className="settings-money-input">
        <span>R$</span>

        <input
          type="text"
          inputMode="numeric"
          required={required}
          value={editing ? draft : formatMoneyInput(value)}
          onFocus={handleFocus}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={handleBlur}
          aria-label={label}
          placeholder="0,00"
        />
      </div>
    </label>
  );
}

export default function ConfiguracoesPage() {
  const { session } = useAuth();

  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      const client = supabase;

      if (!client) {
        setError("Não foi possível conectar ao Supabase.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const { data, error: queryError } = await client
          .from("user_settings")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!active) return;

        if (queryError) {
          setError(
            `Não foi possível carregar suas configurações: ${queryError.message}`,
          );
          return;
        }

        if (data) {
          setForm({
            company_name: data.company_name ?? "",
            professional_name: data.professional_name ?? "",
            job_title: data.job_title ?? "",
            base_salary: String(data.base_salary ?? 0),
            transport_allowance: String(data.transport_allowance ?? 0),
            other_benefits: String(data.other_benefits ?? 0),
            fixed_deductions: String(data.fixed_deductions ?? 0),
            currency_code: data.currency_code ?? "BRL",
          });
        }
      } catch {
        if (active) {
          setError(
            "Ocorreu um erro inesperado ao carregar as configurações.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  function updateField<K extends keyof SettingsForm>(
    field: K,
    value: SettingsForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.user?.id) {
      setError("Sua sessão expirou. Entre novamente para salvar.");
      return;
    }

    const client = supabase;

    if (!client) {
      setError("Não foi possível conectar ao Supabase.");
      return;
    }

    const monetaryFields = [
      { label: "Salário-base", value: form.base_salary },
      { label: "Auxílio-transporte", value: form.transport_allowance },
      { label: "Outros benefícios", value: form.other_benefits },
      { label: "Descontos fixos", value: form.fixed_deductions },
    ];

    for (const field of monetaryFields) {
      const parsed = Number(field.value.trim().replace(",", "."));

      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(
          `${field.label}: informe um valor válido, igual ou maior que zero.`,
        );
        return;
      }
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      user_id: session.user.id,
      company_name: form.company_name.trim() || null,
      professional_name: form.professional_name.trim() || null,
      job_title: form.job_title.trim(),
      base_salary: numericValue(form.base_salary),
      transport_allowance: numericValue(form.transport_allowance),
      other_benefits: numericValue(form.other_benefits),
      fixed_deductions: numericValue(form.fixed_deductions),
      currency_code: form.currency_code,
    };

    try {
      const { error: saveError } = await client
        .from("user_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (saveError) {
        setError(`Não foi possível salvar: ${saveError.message}`);
        return;
      }

      setMessage("Configurações salvas com sucesso.");
    } catch {
      setError("Ocorreu um erro inesperado ao salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  const salary = numericValue(form.base_salary);
  const transport = numericValue(form.transport_allowance);
  const benefits = numericValue(form.other_benefits);
  const deductions = numericValue(form.fixed_deductions);

  const estimatedFixedTotal =
    salary + transport + benefits - deductions;

  function exportReport() {
    setError("");
    window.print();
  }

  if (loading) {
    return (
      <main className="settings-page">
        <p>Carregando configurações...</p>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <header className="settings-heading">
        <div>
          <p className="settings-eyebrow">PREFERÊNCIAS</p>
          <h1>Configurações</h1>
          <p className="settings-subtitle">
            Personalize seus dados profissionais e informações de remuneração.
          </p>
        </div>

        <Link to="/painel" className="settings-back-link">
          Voltar ao painel
        </Link>
      </header>

      <section className="settings-intro">
        <h2>Resumo financeiro configurado</h2>

        <p>
          Valores estimados com base nos dados informados. Não representam
          cálculo oficial de folha de pagamento.
        </p>

        <div className="settings-summary-grid">
          <article className="settings-summary-item">
            <span>Salário-base</span>
            <strong>{money(salary, form.currency_code)}</strong>
          </article>

          <article className="settings-summary-item">
            <span>Total fixo estimado</span>
            <strong>
              {money(estimatedFixedTotal, form.currency_code)}
            </strong>
          </article>
        </div>
      </section>

      {error && (
        <div
          className="settings-feedback settings-feedback-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="settings-feedback settings-feedback-success"
          role="status"
        >
          {message}
        </div>
      )}

      <form className="settings-form" onSubmit={handleSubmit}>
        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <h2>Dados profissionais</h2>
              <p>Informações usadas para identificar seus relatórios.</p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <label className="settings-field">
              <span>Nome da empresa</span>
              <input
                value={form.company_name}
                onChange={(e) =>
                  updateField("company_name", e.target.value)
                }
                placeholder="Ex.: Minha Empresa"
                maxLength={120}
              />
            </label>

            <label className="settings-field">
              <span>Seu nome</span>
              <input
                value={form.professional_name}
                onChange={(e) =>
                  updateField("professional_name", e.target.value)
                }
                placeholder="Nome profissional"
                maxLength={120}
              />
            </label>

            <label className="settings-field">
              <span>Cargo ou função</span>
              <input
                value={form.job_title}
                onChange={(e) =>
                  updateField("job_title", e.target.value)
                }
                placeholder="Ex.: Vendedora"
                maxLength={120}
              />
            </label>

            <label className="settings-field">
              <span>Moeda</span>
              <select
                value={form.currency_code}
                onChange={(e) =>
                  updateField("currency_code", e.target.value)
                }
              >
                <option value="BRL">Real brasileiro (BRL)</option>
                <option value="USD">Dólar americano (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <div>
              <h2>Remuneração e benefícios</h2>
              <p>Configure valores mensais para suas estimativas.</p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <MoneyInput
              label="Salário-base mensal"
              value={form.base_salary}
              onChange={(value) =>
                updateField("base_salary", value)
              }
            />

            <MoneyInput
              label="Auxílio-transporte mensal"
              value={form.transport_allowance}
              onChange={(value) =>
                updateField("transport_allowance", value)
              }
            />

            <MoneyInput
              label="Outros benefícios mensais"
              value={form.other_benefits}
              onChange={(value) =>
                updateField("other_benefits", value)
              }
            />

            <MoneyInput
              label="Descontos fixos mensais"
              value={form.fixed_deductions}
              onChange={(value) =>
                updateField("fixed_deductions", value)
              }
            />
          </div>

          <p className="settings-help">
            O total fixo estimado considera salário + transporte + benefícios
            − descontos. Comissão e eventuais adicionais não estão incluídos
            nesse total.
          </p>
        </section>

        <div className="settings-form-actions">
          <button
            type="button"
            className="settings-cancel-button"
            onClick={exportReport}
          >
            Exportar relatório PDF
          </button>

          <button
            type="submit"
            className="settings-save-button"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
    </main>
  );
}
