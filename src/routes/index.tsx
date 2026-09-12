import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scanMilkPage, type ScanRow } from "@/lib/scan.functions";
import { calculateMilkAndAmountTotals, parseNumericCell } from "@/lib/scan-calculations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Milk Amount Scanner - Morning & Evening Totals" },
      {
        name: "description",
        content:
          "Scan one page of your monthly milk record sheet and get the Morning and Evening totals calculated separately, with a verify step before the result.",
      },
      { property: "og:title", content: "Milk Amount Scanner" },
      {
        property: "og:description",
        content: "Scan a milk record page and calculate Morning and Evening totals separately.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

type Stage = "home" | "processing" | "verify" | "result";

type EditableRow = {
  day: number;
  morningMilk: string;
  eveningMilk: string;
  morningAmount: string;
  eveningAmount: string;
  morningMilkFlag: boolean;
  eveningMilkFlag: boolean;
  morningAmountFlag: boolean;
  eveningAmountFlag: boolean;
};

type EditableField = "morningMilk" | "eveningMilk" | "morningAmount" | "eveningAmount";

const STEPS = [
  "Detecting table…",
  "Detecting rows…",
  "Detecting columns…",
  "Reading Morning values…",
  "Reading Evening values…",
  "Validating values…",
];

function toEditable(rows: ScanRow[]): EditableRow[] {
  return rows.map((r) => ({
    day: r.day,
    morningMilk: r.morningMilk.value === null ? "" : String(r.morningMilk.value),
    eveningMilk: r.eveningMilk.value === null ? "" : String(r.eveningMilk.value),
    morningAmount: r.morningAmount.value === null ? "" : String(r.morningAmount.value),
    eveningAmount: r.eveningAmount.value === null ? "" : String(r.eveningAmount.value),
    morningMilkFlag: r.morningMilk.needsVerification,
    eveningMilkFlag: r.eveningMilk.needsVerification,
    morningAmountFlag: r.morningAmount.needsVerification,
    eveningAmountFlag: r.eveningAmount.needsVerification,
  }));
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function fileToDataUrl(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode failed"));
    el.src = rawUrl;
  });

  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawUrl;
  ctx.filter = "grayscale(1) contrast(1.25) brightness(1.05)";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function Home() {
  const scan = useServerFn(scanMilkPage);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("home");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  function clearAll() {
    setStage("home");
    setStep(0);
    setError(null);
    setWarnings([]);
    setRows([]);
    setPreview(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    clearAll();
    setStage("processing");
    setError(null);

    const timer = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 1400);

    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      const result = await scan({ data: { imageDataUrl: dataUrl } });
      if (!result.ok) {
        setError(result.error);
        setStage("home");
        setPreview(null);
        return;
      }
      setRows(toEditable(result.rows));
      setWarnings(result.warnings);
      setStage("verify");
    } catch {
      setError("The page could not be read clearly. Please retake the photo with the complete table visible and good lighting.");
      setStage("home");
      setPreview(null);
    } finally {
      window.clearInterval(timer);
      setStep(0);
    }
  }

  const totals = calculateMilkAndAmountTotals(rows);
  const fields: EditableField[] = ["morningMilk", "eveningMilk", "morningAmount", "eveningAmount"];
  const pending = rows.filter((row) => fields.some((field) => row[`${field}Flag`] || parseNumericCell(row[field]) === null));

  function updateCell(index: number, field: EditableField, value: string) {
    setRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, [field]: value, [`${field}Flag`]: parseNumericCell(value) === null }
          : row,
      ),
    );
  }

  function VerificationTable({
    title,
    morningField,
    eveningField,
  }: {
    title: string;
    morningField: EditableField;
    eveningField: EditableField;
  }) {
    return (
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <h3 className="border-b border-border bg-secondary px-3 py-3 text-center font-bold text-secondary-foreground">
          {title}
        </h3>
        <div className="grid grid-cols-[minmax(0,3rem)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-border bg-muted/70 px-3 py-3 text-sm font-bold uppercase text-muted-foreground">
          <span>Day</span><span>Morning</span><span>Evening</span>
        </div>
        {rows.map((row, index) => (
          <div key={row.day} className="grid grid-cols-[minmax(0,3rem)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2 border-b border-border/60 px-3 py-2 last:border-0">
            <span className="pt-3 text-lg font-bold text-foreground">{row.day}</span>
            {[morningField, eveningField].map((field) => {
              const flagged = row[`${field}Flag`];
              return (
                <div key={field} className="min-w-0">
                  <input
                    inputMode="decimal"
                    value={row[field]}
                    placeholder=""
                    aria-label={`Day ${row.day} ${field}`}
                    aria-invalid={flagged}
                    onChange={(event) => updateCell(index, field, event.target.value)}
                    className={`w-full rounded-xl border-2 px-3 py-3 text-lg font-semibold text-foreground outline-none focus:border-primary ${flagged ? "border-warning bg-warning/10" : "border-border bg-background"}`}
                  />
                  {flagged && <span className="mt-1 block text-xs font-medium text-warning-foreground">Please check this value</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-16">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <header className="px-5 pt-10 pb-6 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          🥛 Milk Amount Scanner
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-base text-muted-foreground">
          Scan your milk record page to calculate Morning and Evening totals.
        </p>
      </header>

      <div className="mx-auto w-full max-w-xl px-4">
        {error && (
          <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-base font-medium text-destructive">
            {error}
          </div>
        )}

        {stage === "home" && (
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-3xl bg-primary px-6 py-7 text-xl font-bold text-primary-foreground shadow-lg shadow-primary/20 transition active:scale-[0.98]"
            >
              📷 Scan Milk Page
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-3xl border-2 border-border bg-card px-6 py-6 text-lg font-semibold text-foreground transition active:scale-[0.98]"
            >
              🖼️ Choose Image
            </button>

            <div className="rounded-3xl bg-muted/60 p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">How it reads your sheet</p>
              <ul className="mt-2 space-y-1">
                <li>• Scan one page only — days 1–15 or days 16–30/31.</li>
                 <li>• Milk is read from columns 2 and 5.</li>
                 <li>• Amount is read from columns 4 and 7.</li>
                <li>• You check every value before the total is calculated.</li>
                <li>• Nothing is saved — the scan is cleared when you finish.</li>
              </ul>
            </div>
          </section>
        )}

        {stage === "processing" && (
          <section className="rounded-3xl border border-border bg-card p-6">
            <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <ul className="space-y-3">
              {STEPS.map((label, i) => (
                <li
                  key={label}
                  className={`flex items-center gap-3 text-base ${
                    i <= step ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="w-6 text-center">{i < step ? "✓" : i === step ? "…" : "·"}</span>
                  {label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {stage === "verify" && (
          <section className="space-y-4">
            {warnings.map((w) => (
              <div
                key={w}
                className="rounded-2xl border border-warning/40 bg-warning/15 p-4 text-sm font-medium text-warning-foreground"
              >
                ⚠️ {w}
              </div>
            ))}

            {preview && (
              <img
                src={preview}
                alt="Scanned milk record page being verified"
                className="max-h-52 w-full rounded-2xl border border-border object-cover"
              />
            )}

            <VerificationTable title="Milk values" morningField="morningMilk" eveningField="eveningMilk" />
            <VerificationTable title="Amount values" morningField="morningAmount" eveningField="eveningAmount" />

            <p className="text-center text-sm text-muted-foreground">
              Rows detected: <span className="font-bold text-foreground">{rows.length}</span>
              {pending.length > 0 && ` · ${pending.length} row${pending.length === 1 ? "" : "s"} need checking`}
            </p>

            <button
              type="button"
              onClick={() => pending.length === 0 && setStage("result")}
              disabled={pending.length > 0}
              className="w-full rounded-3xl bg-primary px-6 py-6 text-xl font-bold text-primary-foreground shadow-lg shadow-primary/20 transition enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              ✓ Confirm &amp; Calculate
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="w-full rounded-3xl border-2 border-border bg-card px-6 py-4 text-base font-semibold text-foreground"
            >
              🗑️ Clear Scan
            </button>
          </section>
        )}

        {stage === "result" && (
          <section className="space-y-4">
            <h2 className="text-center font-display text-2xl font-bold text-foreground">
              Milk Calculation Result
            </h2>
            <div className="space-y-3">
              <ResultCard label="Morning Milk Total" value={fmt(totals.morningMilkTotal)} />
              <ResultCard label="Evening Milk Total" value={fmt(totals.eveningMilkTotal)} />
              <div className="my-2 border-t border-border" />
              <ResultCard label="Morning Amount Total" value={fmt(totals.morningAmountTotal)} />
              <ResultCard label="Evening Amount Total" value={fmt(totals.eveningAmountTotal)} />
              <ResultCard label="Total Amount" value={fmt(totals.totalAmount)} highlight />
            </div>
            <p className="text-center text-base text-muted-foreground">
              Rows detected: <span className="font-bold text-foreground">{rows.length}</span>
            </p>
            <button
              type="button"
              onClick={() => setStage("verify")}
              className="w-full rounded-3xl border-2 border-border bg-card px-6 py-4 text-base font-semibold text-foreground"
            >
              ← Back to values
            </button>
            <button
              type="button"
              onClick={() => {
                clearAll();
                setTimeout(() => cameraRef.current?.click(), 60);
              }}
              className="w-full rounded-3xl bg-primary px-6 py-6 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20"
            >
              📷 Scan Another Page
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="w-full rounded-3xl border-2 border-destructive/40 bg-destructive/10 px-6 py-4 text-base font-semibold text-destructive"
            >
              🗑️ Clear Scan
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function ResultCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 text-center ${
        highlight ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
    >
      <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-5xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
