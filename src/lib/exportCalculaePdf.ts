import type { UserSettings } from "./calculaeSettings";
import { estimateMonthlyCompensation, estimateVacation, formatBRL } from "./calculaeSettings";

/**
 * Exporta por meio da janela de impressão do navegador.
 * Na caixa de impressão, selecione "Salvar como PDF".
 * Não exige dependência adicional no projeto.
 */
export function exportCalculaeReport(settings: UserSettings, salesTotal: number, periodLabel: string) {
  const comp = estimateMonthlyCompensation(settings, salesTotal);
  const vacation = estimateVacation(settings);
  const escapeHtml = (value: unknown) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char] as string));

  const report = `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Relatório CalculaÊ</title>
      <style>
        @page { size: A4; margin: 18mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #20252b; margin: 0; }
        .top { border-bottom: 3px solid #66766b; padding-bottom: 18px; margin-bottom: 24px; }
        .brand { font-size: 12px; letter-spacing: 3px; color: #66766b; font-weight: 700; text-transform: uppercase; }
        h1 { font-size: 26px; margin: 8px 0; }
        .muted { color: #6b7280; font-size: 12px; }
        h2 { font-size: 15px; margin: 24px 0 8px; }
        table { border-collapse: collapse; width: 100%; }
        td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
        td:last-child { text-align: right; font-weight: 600; }
        .total td { background: #f5f6f7; font-weight: 700; }
        .note { font-size: 11px; line-height: 1.5; color: #6b7280; margin-top: 26px; }
        .footer { margin-top: 36px; font-size: 10px; color: #9ca3af; }
      </style>
    </head>
    <body>
      <div class="top">
        <div class="brand">CalculaÊ</div>
        <h1>Relatório financeiro</h1>
        <div class="muted">Período: ${escapeHtml(periodLabel)}</div>
        <div class="muted">Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <h2>Identificação</h2>
      <table>
        <tr><td>Empresa</td><td>${escapeHtml(settings.company_name || "Não informado")}</td></tr>
        <tr><td>Profissional</td><td>${escapeHtml(settings.professional_name || "Não informado")}</td></tr>
        <tr><td>Cargo/função</td><td>${escapeHtml(settings.job_title || "Não informado")}</td></tr>
      </table>
      <h2>Vendas e remuneração estimada</h2>
      <table>
        <tr><td>Vendas no período</td><td>${formatBRL(salesTotal)}</td></tr>
        <tr><td>Comissão (${settings.commission_rate}%)</td><td>${formatBRL(comp.commission)}</td></tr>
        <tr><td>Salário-base</td><td>${formatBRL(settings.base_salary)}</td></tr>
        <tr><td>Auxílio-transporte informado</td><td>${formatBRL(settings.transport_allowance)}</td></tr>
        <tr><td>Outros benefícios informados</td><td>${formatBRL(settings.other_benefits)}</td></tr>
        <tr><td>Descontos fixos informados</td><td>− ${formatBRL(settings.fixed_deductions)}</td></tr>
        <tr class="total"><td>Remuneração bruta estimada</td><td>${formatBRL(comp.gross)}</td></tr>
        <tr class="total"><td>Valor líquido estimado</td><td>${formatBRL(comp.estimatedNet)}</td></tr>
      </table>
      <h2>Planejamento de férias (estimativa)</h2>
      <table>
        <tr><td>Dias planejados</td><td>${vacation.days}</td></tr>
        <tr><td>Remuneração proporcional estimada</td><td>${formatBRL(vacation.proportionalSalary)}</td></tr>
        <tr><td>Adicional de 1/3 estimado</td><td>${formatBRL(vacation.constitutionalBonusEstimate)}</td></tr>
        <tr class="total"><td>Total estimado para planejamento</td><td>${formatBRL(vacation.totalEstimate)}</td></tr>
      </table>
      ${settings.notes ? `<h2>Observações</h2><p>${escapeHtml(settings.notes).replace(/\n/g, "<br>")}</p>` : ""}
      <p class="note">Este documento é uma estimativa de planejamento baseada nos valores informados pelo usuário. Não substitui holerite, cálculo oficial de folha, orientação contábil ou validação das regras aplicáveis ao vínculo empregatício. Transporte, benefícios e descontos podem ter tratamento legal específico.</p>
      <div class="footer">CalculaÊ · Sua organização financeira em um só lugar.</div>
      <script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
    </body>
    </html>`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    throw new Error("O navegador bloqueou a janela do relatório. Permita pop-ups para exportar o PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(report);
  printWindow.document.close();
}
