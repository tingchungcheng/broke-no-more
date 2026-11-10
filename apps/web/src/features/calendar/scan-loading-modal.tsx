import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ScanLoadingModal({
  keywords,
  fromDate,
  toDate,
}: {
  keywords: string[];
  fromDate: string;
  toDate: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      aria-busy="true"
    >
      <Card
        className="w-full max-w-md shadow-[0_24px_60px_rgba(28,25,21,0.2)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-loading-title"
        aria-describedby="scan-loading-desc"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-moss/10 text-moss">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="scan-loading-title" className="font-serif text-2xl">
              Scanning Gmail
            </h2>
            <p id="scan-loading-desc" className="mt-1 text-sm leading-relaxed text-muted">
              Searching for statement subjects only. Attachments and message bodies are not read.
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-muted">Date range</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {fromDate} → {toDate}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Keywords</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span key={keyword} className="rounded-full border border-line bg-paper px-3 py-1 text-sm">
                  {keyword}
                </span>
              ))}
            </dd>
          </div>
        </dl>

        <ScanProgressBar />

        <p className="mt-4 text-xs text-muted">Stay on this page until the scan finishes.</p>
      </Card>
    </div>
  );
}

function ScanProgressBar() {
  return (
    <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <div className="scan-progress-bar h-full w-2/5 rounded-full bg-moss" />
    </div>
  );
}
