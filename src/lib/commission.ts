
export type CommissionRange = {
  id: number;
  min_sales: number;
  max_sales: number | null;
  commission_rate: number;
};

export function getCommissionRange(
  monthTotal: number,
  ranges: CommissionRange[],
): CommissionRange | null {
  const sortedRanges = [...ranges].sort(
    (a, b) => a.min_sales - b.min_sales,
  );

  return (
    sortedRanges.find(
      (range) =>
        monthTotal >= range.min_sales &&
        (range.max_sales === null || monthTotal <= range.max_sales),
    ) ?? null
  );
}

export function calculateEstimatedCommission(
  monthTotal: number,
  range: CommissionRange | null,
): number | null {
  if (!range) return null;

  return (monthTotal * range.commission_rate) / 100;
}
