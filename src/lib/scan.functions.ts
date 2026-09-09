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
  morning: ScanCell;
  evening: ScanCell;
};

export type ScanResult =
  | {
      ok: true;
      rows: ScanRow[];
      columnCount: number;
      morningColumnIndex: number;
      eveningColumnIndex: number;
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
  morning_column_index: z.number().nullable().optional(),
  evening_column_index: z.number().nullable().optional(),
  image_quality: z.enum(["good", "poor"]).nullable().optional(),
  rows: z
    .array(
      z.object({
        day: z.number().nullable().optional(),
        morning: CellSchema.nullable().optional(),
        evening: CellSchema.nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
});

const PROMPT = `You are a precise table-structure reader for a handwritten/printed monthly MILK RECORD sheet photo.

STEP 1 — Detect the table: find its outer boundary, its data rows (one per day) and its columns (left to right). Report how many columns the table body has (count every column, including the day/date column).

STEP 2 — Identify columns by PHYSICAL POSITION ONLY, never by reading order:
- MORNING column = the 3rd column of the table, counting columns left to right starting at 1 (the day column is column 1).
- EVENING column = the LAST (rightmost) column of the table body. If the rightmost column is a printed row-total column, still use the rightmost column, unless it is clearly a signature/remarks column, in which case use the rightmost column that holds milk quantities.

STEP 3 — For every day row, read ONLY the cell that sits inside the morning column and ONLY the cell inside the evening column. Never take a value from a neighbouring column. Never use the day number as a value. Ignore headers, serial/member numbers, printed totals, subtotals and anything outside the table.

STEP 4 — Output strict JSON only, no markdown:
{
  "table_detected": boolean,
  "image_quality": "good" | "poor",
  "column_count": number,
  "morning_column_index": number,
  "evening_column_index": number,
  "rows": [
    { "day": number,
      "morning": { "text": string, "value": number|null, "confidence": number },
      "evening": { "text": string, "value": number|null, "confidence": number } }
  ]
}

Rules:
- Include one entry per visible day row only (e.g. days 1-15, or 16-30/31). Never invent rows.
- "text" is exactly what is written in that cell ("" if blank). "value" is the numeric amount with correct decimals, or null if blank/unreadable.
- confidence is 0..1 and must be honest: use below 0.75 whenever the digit shape is ambiguous (0/8, 1/7, 5/6), the decimal point is unclear, digits are cut off, or the cell is blurry/blank.
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
    const morningIdx = m.morning_column_index ?? 0;
    const eveningIdx = m.evening_column_index ?? 0;
    if (columnCount < 3 || morningIdx !== 3) {
      return {
        ok: false,
        code: "no_morning_column",
        error: "Could not identify the Morning column. Please retake the photo clearly.",
      };
    }
    if (eveningIdx < 3 || eveningIdx > columnCount) {
      return {
        ok: false,
        code: "no_evening_column",
        error: "Could not identify the Evening column. Please retake the photo clearly.",
      };
    }

    const warnings: string[] = [];
    const seenDays = new Set<number>();
    const rows: ScanRow[] = [];

    const toCell = (cell: z.infer<typeof CellSchema> | null | undefined): ScanCell => {
      const raw = (cell?.text ?? "").trim();
      const confidence = cell?.confidence ?? 0;
      let value = typeof cell?.value === "number" && Number.isFinite(cell.value) ? cell.value : null;
      if (value !== null && (value < 0 || value > 200)) value = null;
      const needsVerification = value === null || confidence < 0.75;
      return { value, confidence, needsVerification, raw };
    };

    for (const row of m.rows) {
      const day = row.day;
      if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 31) continue;
      if (seenDays.has(day)) continue;
      seenDays.add(day);
      rows.push({ day, morning: toCell(row.morning), evening: toCell(row.evening) });
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
    const firstDay = rows[0]!.day;
    const lastDay = rows[rows.length - 1]!.day;
    for (let d = firstDay; d <= lastDay; d++) {
      if (!seenDays.has(d)) missingDays.push(d);
    }
    if (missingDays.length > 0) {
      warnings.push(`Day ${missingDays.join(", ")} could not be found on this page. Please check the photo.`);
    }
    if (rows.some((r) => r.morning.needsVerification || r.evening.needsVerification)) {
      warnings.push("Some values could not be read confidently. Please verify the highlighted values.");
    }

    return {
      ok: true,
      rows,
      columnCount,
      morningColumnIndex: morningIdx,
      eveningColumnIndex: eveningIdx,
      warnings,
    };
  });
