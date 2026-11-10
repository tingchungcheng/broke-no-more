import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

type StatementRow = {
  id: string;
  source: string;
  status: string;
  subject: string | null;
  sender: string | null;
  receivedOn: string | null;
  matchedKeywords: string[];
  originalFilename: string | null;
  errorCode: string | null;
  parserVersion?: string | null;
};

type StatementSort = "receivedOn" | "createdAt" | "subject" | "status" | "sender";
type StatementOrder = "asc" | "desc";

type StatementsResponse = {
  statements: StatementRow[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasMore: boolean;
  sort: StatementSort;
  order: StatementOrder;
};

const SORT_FIELDS: { value: StatementSort; label: string }[] = [
  { value: "receivedOn", label: "Received date" },
  { value: "createdAt", label: "Date saved" },
  { value: "subject", label: "Subject" },
  { value: "status", label: "Status" },
  { value: "sender", label: "Sender" },
];

const READ_ERRORS: Record<string, string> = {
  password_required: "Locked. Save the PDF password on Accounts → Edit, then read again.",
  password_rejected: "The saved password did not open this file. Update it on Accounts → Edit.",
  subject_unmatched: "Locked. Add a phrase from this email subject on the account, then read again.",
  no_attachment: "No PDF or CSV was attached.",
  unrecognized_layout: "Opened. The layout was not recognized, and OpenAI did not return rows.",
  account_required: "Link the password to this account on Accounts → Edit, then read again.",
  currency_mismatch: "The amounts are not in the account currency.",
  read_failed: "This file could not be read.",
  unreadable: "This file could not be read.",
};

function statementLabel(statement: StatementRow): string {
  if (statement.errorCode && READ_ERRORS[statement.errorCode]) return READ_ERRORS[statement.errorCode];
  if (statement.status === "REVIEW_REQUIRED") return "Imported, needs review";
  if (statement.status === "STORED") return "File stored";
  return statement.status;
}

function orderLabels(sort: StatementSort): { asc: string; desc: string } {
  if (sort === "subject" || sort === "sender" || sort === "status") {
    return { asc: "A–Z", desc: "Z–A" };
  }
  return { asc: "Oldest first", desc: "Newest first" };
}

export function StatementsPage() {
  const { api } = useAuth();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<StatementSort>("receivedOn");
  const [order, setOrder] = useState<StatementOrder>("desc");
  const statements = useQuery({
    queryKey: ["statements", page, sort, order],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        sort,
        order,
      });
      return api<StatementsResponse>(`/statements?${params.toString()}`);
    },
  });
  const rows = statements.data?.statements ?? [];
  const total = statements.data?.total ?? 0;
  const pageCount = statements.data?.pageCount ?? 0;
  const currentPage = statements.data?.page ?? page;
  const orderText = orderLabels(sort);

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm uppercase tracking-[0.16em] text-moss">Statements</p>
      <h1 className="font-serif text-4xl">Found mail</h1>
      <Card>
        <p className="leading-relaxed">
          A scan stores the email. Save a PDF password on{" "}
          <Link className="text-moss" to="/accounts">
            Accounts
          </Link>
          , then use <span className="text-ink">Read statements</span> on the{" "}
          <Link className="text-moss" to="/calendar">
            calendar
          </Link>
          .
        </p>
        {total === 0 ? <p className="mt-3 text-sm text-muted">No statement emails saved yet.</p> : null}
        {total > 0 ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="statements-sort">Sort by</Label>
                <select
                  id="statements-sort"
                  className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as StatementSort);
                    setPage(1);
                  }}
                >
                  {SORT_FIELDS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="statements-order">Order</Label>
                <select
                  id="statements-order"
                  className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
                  value={order}
                  onChange={(event) => {
                    setOrder(event.target.value as StatementOrder);
                    setPage(1);
                  }}
                >
                  <option value="desc">{orderText.desc}</option>
                  <option value="asc">{orderText.asc}</option>
                </select>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">
              Showing {(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, total)} of {total}
            </p>
            <ul className="mt-4 space-y-4">
              {rows.map((statement) => (
                <li key={statement.id} className="border-t border-line pt-3 text-sm">
                  <p>{statement.subject ?? statement.originalFilename ?? "Statement"}</p>
                  <p className="text-muted">
                    {statement.receivedOn ?? "Date unknown"}
                    {statement.sender ? ` · ${statement.sender}` : ""}
                    {statement.matchedKeywords.length ? ` · ${statement.matchedKeywords.join(", ")}` : ""}
                    {` · ${statementLabel(statement)}`}
                  </p>
                </li>
              ))}
            </ul>
            {pageCount > 1 ? (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1 || statements.isFetching}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm tabular-nums text-muted">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= pageCount || statements.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  );
}
