export type MilkAmountValues = {
  morningMilk: string;
  eveningMilk: string;
  morningAmount: string;
  eveningAmount: string;
};

export function parseNumericCell(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function calculateMilkAndAmountTotals(rows: MilkAmountValues[]) {
  const sum = (field: keyof MilkAmountValues) =>
    rows.reduce((total, row) => total + (parseNumericCell(row[field]) ?? 0), 0);

  const morningMilkTotal = sum("morningMilk");
  const eveningMilkTotal = sum("eveningMilk");
  const morningAmountTotal = sum("morningAmount");
  const eveningAmountTotal = sum("eveningAmount");

  return {
    morningMilkTotal,
    eveningMilkTotal,
    morningAmountTotal,
    eveningAmountTotal,
    totalAmount: morningAmountTotal + eveningAmountTotal,
  };
}