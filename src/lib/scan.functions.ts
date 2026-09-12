import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageDataUrl: z
    .string()
    .refine((v) => v.startsWith("data:image/"), "Expected an image data URL")
    .refine((v) => v.length < 12_000_000, "Image too large"),
});

export type ScanCell = {
  value: number | null;
  confidence: number;
  needsVerification: boolean;
  raw: string;
};

export type ScanRow = {
  day: number;
  morningMilk: ScanCell;
  morningAmount: ScanCell;
  eveningMilk: ScanCell;
  eveningAmount: ScanCell;
};

export type ScanResult =
  | {
      ok: true;
      rows: ScanRow[];
      columnCount: number;
      morningMilkColumnIndex: number;
      morningAmountColumnIndex: number;
      eveningMilkColumnIndex: number;
      eveningAmountColumnIndex: number;
      warnings: string[];
    }
  | { ok: false; error: string; code: string };

const CellSchema = z.object({
  text: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const ModelSchema = z.object({
  table_detected: z.boolean(),
  column_count: z.number().nullable().optional(),
  image_quality: z.enum(["good", "poor"]).nullable().optional(),
  rows: z
    .array(
      z.object({
        day: z.number().nullable().optional(),
        morning_milk: CellSchema.nullable().optional(),
        morning_amount: CellSchema.nullable().optional(),
        evening_milk: CellSchema.nullable().optional(),
        evening_amount: CellSchema.nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});

const PROMPT = `You are a precise table-structure reader for a handwritten/printed monthly MILK RECORD sheet photo.

STEP 1 — Detect the table: find its outer boundary and data rows (one per day). The table body MUST have exactly 7 physical columns, counted left to right:
1 = Day
2 = Morning Milk
3 = Morning Fat
4 = Morning Amount
5 = Evening Milk
6 = Evening Fat
7 = Evening Amount

STEP 2 — Identify values by PHYSICAL POSITION ONLY, never by reading order or semantic guessing:
- Morning Milk is ONLY column 2.
- Morning Amount is ONLY column 4.
- Evening Milk is ONLY column 5.
- Evening Amount is ONLY column 7.
- Columns 3 and 6 are fat values. Never return them as milk or amount.

STEP 3 — For every day row, read ONLY columns 2, 4, 5, and 7 into their matching fields. Never take a value from a neighbouring column. Never use day numbers, fat values, headers, printed totals, subtotals, or anything outside the table.

STEP 4 — Output strict JSON only, no markdown:
{
  "table_detected": boolean,
  "image_quality": "good" | "poor",
  "column_count": number,
  "rows": [
    { "day": number,
      "morning_milk": { "text": string, "value": number|null, "confidence": number },
      "morning_amount": { "text": string, "value": number|null, "confidence": number },
      "evening_milk": { "text": string, "value": number|null, "confidence": number },
      "evening_amount": { "text": string, "value": number|null, "confidence": number } }
  ]
}

Rules:
- Include one entry per visible day row only (e.g. days 1-15, or 16-30/31). Never invent rows.
- "text" is exactly what is written in that cell ("" if blank). "value" is the numeric value with correct decimals, or null if blank/unreadable.
- confidence is 0..1 and must be honest: use below 0.75 whenever the digit shape is ambiguous (0/8, 1/7, 5/6), the decimal point is unclear, digits are cut off, or the cell is blurry/blank.
- Never guess an uncertain value. If confidence is below 0.75, return value null even if text contains a possible reading.
- If the whole table cannot be located, or the photo is too blurry/incomplete to place columns, set table_detected false and rows [].`;

export const scanMilkPage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ScanResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false, code: "config", error: "Scanning is not configured yet." };
    }

    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: [
            { role: "system", content: PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Read this milk record page." },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      return { ok: false, code: "network", error: "Could not reach the reader. Check your connection and try again." };
    }

    if (!res.ok) {
      const body = await res.text();
      let message = body.slice(0, 400);
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
        message = parsed.error?.message ?? parsed.message ?? message;
      } catch {
        /* keep raw text */
      }
      if (res.status === 429) {
        return { ok: false, code: "rate_limit", error: "Too many scans right now. Please wait a moment and try again." };
      }
      if (res.status === 402 || res.status === 403) {
        return { ok: false, code: "blocked", error: message || "Scanning is unavailable for this workspace." };
      }
      return { ok: false, code: `http_${res.status}`, error: message || "The page could not be read." };
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content.replace(/^```json\s*|```$/g, "").trim());
    } catch {
      return {
        ok: false,
        code: "unreadable",
        error: "The page could not be read clearly. Please retake the photo with the complete table visible and good lighting.",
      };
    }

    const parsed = ModelSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return {
        ok: false,
        code: "unreadable",
        error: "The page could not be read clearly. Please retake the photo with the complete table visible and good lighting.",
      };
    }

    const m = parsed.data;
    if (!m.table_detected || !m.rows || m.rows.length === 0) {
      return {
        ok: false,
        code: "no_table",
        error: "Could not identify the table. Please retake the photo with the complete page visible.",
      };
    }
    if (m.image_quality === "poor") {
      return {
        ok: false,
        code: "poor_quality",
        error: "The page could not be read clearly. Please retake the photo with the complete table visible and good lighting.",
      };
    }
    const columnCount = m.column_count ?? 0;
    if (columnCount !== 7) {
      return {
        ok: false,
        code: "wrong_column_count",
        error: "Could not identify all 7 columns. Please retake the photo with the complete table visible.",
      };
    }

    const warnings: string[] = [];
    const seenDays = new Set<number>();
    const rows: ScanRow[] = [];

    const toCell = (cell: z.infer<typeof CellSchema> | null | undefined): ScanCell => {
      const raw = (cell?.text ?? "").trim();
      const confidence = cell?.confidence ?? 0;
      let value = typeof cell?.value === "number" && Number.isFinite(cell.value) ? cell.value : null;
      if (value !== null && value < 0) value = null;
      const needsVerification = value === null || confidence < 0.75;
      if (needsVerification) value = null;
      return { value, confidence, needsVerification, raw };
    };

    for (const row of m.rows) {
      const day = row.day;
      if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 31) continue;
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      rows.push({
        day,
        morningMilk: toCell(row.morning_milk),
        morningAmount: toCell(row.morning_amount),
        eveningMilk: toCell(row.evening_milk),
        eveningAmount: toCell(row.evening_amount),
      });
    }

    rows.sort((a, b) => a.day - b.day);
    if (rows.length === 0) {
      return {
        ok: false,
        code: "no_rows",
        error: "Could not identify the table. Please retake the photo with the complete page visible.",
      };
    }

    const missingDays: number[] = [];
    const firstRow = rows[0];
    const lastRow = rows.at(-1);
    if (!firstRow || !lastRow) {
      return { ok: false, code: "no_rows", error: "Could not identify any day rows." };
    }
    const firstDay = firstRow.day;
    const lastDay = lastRow.day;
    for (let d = firstDay; d <= lastDay; d++) {
      if (!seenDays.has(d)) missingDays.push(d);
    }
    if (missingDays.length > 0) {
      warnings.push(`Day ${missingDays.join(", ")} could not be found on this page. Please check the photo.`);
    }
    if (
      rows.some(
        (r) =>
          r.morningMilk.needsVerification ||
          r.eveningMilk.needsVerification ||
          r.morningAmount.needsVerification ||
          r.eveningAmount.needsVerification,
      )
    ) {
      warnings.push("Some values could not be read confidently. Please verify the highlighted values.");
    }

    return {
      ok: true,
      rows,
      columnCount,
      morningMilkColumnIndex: 2,
      morningAmountColumnIndex: 4,
      eveningMilkColumnIndex: 5,
      eveningAmountColumnIndex: 7,
      warnings,
    };
  });
