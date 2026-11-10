import type { ConfidenceStatus, Direction } from "@broke-no-more/shared";
import { SUGGESTED_STATEMENT_KEYWORDS, normalizeStatementKeyword } from "@broke-no-more/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { MoneyText } from "@/components/money-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError } from "@/lib/api";
import { cn } from "@/lib/utils";

type CalendarDay = {
  date: string;
  status: ConfidenceStatus | null;
  transactions: Array<{
    id: string;
    description: string;
    amountMinor: number;
    currency: string;
    direction: string;
    source: string;
  }>;
  statements: Array<{
    id: string;
    subject: string | null;
    sender: string | null;
    matchedKeywords: string[];
    status: string;
  }>;
};

const STATUS_LABEL: Record<ConfidenceStatus, string> = {
  high: "High confidence",
  needs_review: "Needs review",
  unverified: "Unverified",
  conflict: "Conflict",
};

const STATUS_CLASS: Record<ConfidenceStatus, string> = {
  high: "bg-moss text-paper",
  needs_review: "bg-amber text-ink",
  unverified: "bg-line text-ink",
  conflict: "bg-danger text-paper",
};

const STORAGE_KEY = "bnm.statement-keywords";

function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function shiftMonth(month: string, amount: number): string {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: string): string {
  const [yearText, monthText] = month.split("-");
  return new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1)),
  );
}

function monthCells(month: string): Array<string | null> {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const firstWeekday = new Date(`${month}-01T12:00:00+08:00`).getUTCDay();
  const leading = (firstWeekday + 6) % 7;
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function loadKeywords(): { selected: string[]; custom: string[] } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as { selected?: unknown; custom?: unknown };
    const selected = Array.isArray(parsed.selected) ? parsed.selected.filter((item): item is string => typeof item === "string") : [];
    const custom = Array.isArray(parsed.custom) ? parsed.custom.filter((item): item is string => typeof item === "string") : [];
    return { selected, custom };
  } catch {
    return { selected: [], custom: [] };
  }
}

function isDirection(value: string): value is Direction {
  return value === "IN" || value === "OUT";
}

export function CalendarPage() {
  const { api, me } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [stored, setStored] = useState(loadKeywords);
  const [draft, setDraft] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calendar = useQuery({
    queryKey: ["calendar", month],
    queryFn: () => api<{ month: string; days: CalendarDay[] }>(`/calendar?month=${month}`),
  });

  const days = new Map((calendar.data?.days ?? []).map((day) => [day.date, day]));
  const selected = selectedDate ? days.get(selectedDate) : undefined;
  const chips = [...SUGGESTED_STATEMENT_KEYWORDS, ...stored.custom.filter((keyword) => !SUGGESTED_STATEMENT_KEYWORDS.some((item) => item.toLowerCase() === keyword.toLowerCase()))];

  function saveKeywords(next: { selected: string[]; custom: string[] }) {
    setStored(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleKeyword(keyword: string) {
    const selectedKeywords = stored.selected.some((item) => item.toLowerCase() === keyword.toLowerCase())
      ? stored.selected.filter((item) => item.toLowerCase() !== keyword.toLowerCase())
      : [...stored.selected, keyword];
    saveKeywords({ ...stored, selected: selectedKeywords });
  }

  function addKeyword() {
    const keyword = normalizeStatementKeyword(draft);
    if (!keyword) {
      setError("Use a short name, without search operators.");
      return;
    }
    const custom = stored.custom.some((item) => item.toLowerCase() === keyword.toLowerCase()) ? stored.custom : [...stored.custom, keyword];
    const selectedKeywords = stored.selected.some((item) => item.toLowerCase() === keyword.toLowerCase())
      ? stored.selected
      : [...stored.selected, keyword];
    saveKeywords({ selected: selectedKeywords, custom });
    setDraft("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-moss">Calendar</p>
        <h1 className="mt-2 font-serif text-4xl">Confidence</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Green is a matched record scoring 85 or more. Yellow is a statement email that still needs review. Grey is a
          record you entered that no statement has confirmed. Red is a conflict, and it overrides the score. Statement
          files are not parsed yet, so a scan cannot turn a day green by itself.
        </p>
      </div>

      <Card>
        <h2 className="font-serif text-2xl">Scan statements</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Press a word to include it. The scan keeps a message only when the subject says it is a statement and contains
          one of the selected words. Promotions and one-time codes stay out.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Statement keywords">
          {chips.map((keyword) => {
            const active = stored.selected.some((item) => item.toLowerCase() === keyword.toLowerCase());
            return (
              <button
                key={keyword}
                type="button"
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm",
                  active ? "border-moss bg-moss text-paper" : "border-line bg-card text-ink",
                )}
                onClick={() => toggleKeyword(keyword)}
              >
                {keyword}
              </button>
            );
          })}
        </div>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addKeyword();
          }}
        >
          <label className="sr-only" htmlFor="keyword">
            Add a keyword
          </label>
          <input
            id="keyword"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a keyword"
            className="h-11 min-w-48 flex-1 rounded-full border border-line bg-paper px-4 text-sm"
          />
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {me?.gmailConnected ? (
            <Button
              type="button"
              disabled={pending || stored.selected.length === 0}
              onClick={() => {
                setPending(true);
                setError(null);
                setNotice(null);
                void api<{ inspected: number; saved: number; alreadyKnown: number }>("/gmail/sync", {
                  method: "POST",
                  body: JSON.stringify({ keywords: stored.selected }),
                })
                  .then(async (result) => {
                    setNotice(
                      `Checked ${result.inspected} messages. Saved ${result.saved} new statements. ${result.alreadyKnown} were already saved.`,
                    );
                    await queryClient.invalidateQueries({ queryKey: ["calendar"] });
                    await queryClient.invalidateQueries({ queryKey: ["statements"] });
                  })
                  .catch((caught: unknown) => {
                    setError(caught instanceof ApiClientError ? caught.message : "The scan did not finish.");
                  })
                  .finally(() => setPending(false));
              }}
            >
              {pending ? "Scanning…" : "Scan statements"}
            </Button>
          ) : (
            <Link to="/settings/connections" className="text-sm text-moss">
              Connect Gmail before scanning
            </Link>
          )}
          {stored.selected.length === 0 ? <p className="text-sm text-muted">Select at least one keyword.</p> : null}
        </div>
        {notice ? <p className="mt-3 text-sm">{notice}</p> : null}
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => setMonth((value) => shiftMonth(value, -1))}>
            Previous
          </Button>
          <h2 className="font-serif text-2xl">{monthTitle(month)}</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setMonth((value) => shiftMonth(value, 1))}>
            Next
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {(Object.keys(STATUS_LABEL) as ConfidenceStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-2">
              <span className={cn("h-3 w-3 rounded-full", STATUS_CLASS[status])} />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wide text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {monthCells(month).map((date, index) => {
            if (!date) return <div key={`empty-${index}`} />;
            const day = days.get(date);
            const status = day?.status ?? null;
            return (
              <button
                key={date}
                type="button"
                aria-pressed={selectedDate === date}
                aria-label={`${date}${status ? `, ${STATUS_LABEL[status]}` : ""}`}
                className={cn(
                  "h-12 rounded-xl text-sm tabular-nums",
                  status ? STATUS_CLASS[status] : "bg-card text-ink",
                  selectedDate === date ? "ring-2 ring-ink" : "",
                )}
                onClick={() => setSelectedDate(date)}
              >
                {Number(date.slice(-2))}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-2xl">{selectedDate ?? "Select a day"}</h2>
        {!selectedDate ? <p className="mt-2 text-sm text-muted">Choose a date to see the records behind its colour.</p> : null}
        {selectedDate && !selected ? <p className="mt-2 text-sm text-muted">Nothing recorded on this day.</p> : null}
        {selected?.transactions.length ? (
          <ul className="mt-4 space-y-3">
            {selected.transactions.map((transaction) => (
              <li key={transaction.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  {transaction.description}
                  <span className="ml-2 text-muted">{transaction.source === "MANUAL" ? "Recorded by you" : "From a statement"}</span>
                </span>
                {isDirection(transaction.direction) ? (
                  <MoneyText amountMinor={transaction.amountMinor} currency={transaction.currency} direction={transaction.direction} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {selected?.statements.length ? (
          <ul className="mt-4 space-y-3">
            {selected.statements.map((statement) => (
              <li key={statement.id} className="text-sm">
                <p>{statement.subject ?? "Statement email"}</p>
                <p className="text-muted">
                  {statement.sender ?? "Unknown sender"}
                  {statement.matchedKeywords.length ? ` · ${statement.matchedKeywords.join(", ")}` : ""}
                  {" · Needs review"}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
