export type UserSettings = {
  user_id: string;
  commission_rate: number;
  monthly_goal: number;
  company_name: string;
  professional_name: string;
  job_title: string;
  base_salary: number;
  transport_allowance: number;
  other_benefits: number;
  fixed_deductions: number;
  vacation_days_available: number;
  vacation_days_planned: number;
  vacation_start_date: string | null;
  vacation_end_date: string | null;
  notes: string;
  currency_code: string;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_SETTINGS = {
  commission_rate: 0,
  monthly_goal: 0,
  company_name: "",
  professional_name: "",
  job_title: "",
  base_salary: 0,
  transport_allowance: 0,
  other_benefits: 0,
  fixed_deductions: 0,
  vacation_days_available: 30,
  vacation_days_planned: 0,
  vacation_start_date: "",
  vacation_end_date: "",
  notes: "",
  currency_code: "BRL",
};

export function toMoney(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function estimateMonthlyCompensation(settings: Pick<
  UserSettings,
  "base_salary" | "transport_allowance" | "other_benefits" |
  "fixed_deductions" | "commission_rate"
>, salesTotal: number) {
  const commission = Math.max(0, salesTotal) * Math.max(0, settings.commission_rate) / 100;
  const gross = toMoney(settings.base_salary) + toMoney(settings.transport_allowance)
    + toMoney(settings.other_benefits) + commission;
  const estimatedNet = Math.max(0, gross - toMoney(settings.fixed_deductions));
  return { commission, gross, estimatedNet };
}

export function estimateVacation(settings: Pick<
  UserSettings,
  "base_salary" | "vacation_days_planned"
>) {
  const days = Math.max(0, Math.min(30, Number(settings.vacation_days_planned) || 0));
  const proportionalSalary = toMoney(settings.base_salary) * days / 30;
  const constitutionalBonusEstimate = proportionalSalary / 3;
  return {
    days,
    proportionalSalary,
    constitutionalBonusEstimate,
    totalEstimate: proportionalSalary + constitutionalBonusEstimate,
  };
}
