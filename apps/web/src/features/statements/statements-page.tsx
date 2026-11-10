import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

type StatementsResponse = {
  statements: StatementRow[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasMore: boolean;
};

const READ_ERRORS: Record<string, string> = {
  password_required: "Locked. Save that keyword's password, then read again.",
  password_rejected: "The saved password did not open this file.",
  no_attachment: "No PDF or CSV was attached.",
  unrecognized_layout: "Opened, but this layout is not supported yet.",
  account_required: "Choose an account for that keyword, then read again.",
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

export function StatementsPage() {
  const { api } = useAuth();
  const [page, setPage] = useState(1);
  const statements = useQuery({
    queryKey: ["statements", page],
    queryFn: () => api<StatementsResponse>(`/statements?page=${page}`),
  });
  const rows = statements.data?.statements ?? [];
  const total = statements.data?.total ?? 0;
  const pageCount = statements.data?.pageCount ?? 0;
  const currentPage = statements.data?.page ?? page;

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm uppercase tracking-[0.16em] text-moss">Statements</p>
      <h1 className="font-serif text-4xl">Found mail</h1>
      <Card>
        <p className="leading-relaxed">
          A scan stores the email. Read statements, on the{" "}
          <Link className="text-moss" to="/calendar">
            calendar
          </Link>
          , downloads the PDF or CSV and adds transactions only when the layout is supported.
        </p>
        {total === 0 ? <p className="mt-3 text-sm text-muted">No statement emails saved yet.</p> : null}
        {total > 0 ? (
          <>
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
