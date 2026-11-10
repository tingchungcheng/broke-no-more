import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ReadLoadingModal() {
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
        aria-labelledby="read-loading-title"
        aria-describedby="read-loading-desc"
      >
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-moss/10 text-moss">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="read-loading-title" className="font-serif text-2xl">
              Reading statements
            </h2>
            <p id="read-loading-desc" className="mt-1 text-sm leading-relaxed text-muted">
              Downloading PDF or CSV attachments from saved statement emails. Locked PDFs use the password from Accounts →
              Edit.
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-2 text-sm text-muted">
          <li>Up to 20 saved emails per run</li>
          <li>Files are sealed on the server, not shown in the browser</li>
          <li>Transactions import only from supported table layouts</li>
        </ul>

        <ReadProgressBar />

        <p className="mt-4 text-xs text-muted">This can take a minute if many attachments are large.</p>
      </Card>
    </div>
  );
}

function ReadProgressBar() {
  return (
    <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <div className="scan-progress-bar h-full w-2/5 rounded-full bg-moss" />
    </div>
  );
}
