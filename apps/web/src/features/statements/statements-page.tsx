import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
};

export function StatementsPage() {
  const { api } = useAuth();
  const statements = useQuery({
    queryKey: ["statements"],
    queryFn: () => api<{ statements: StatementRow[]; truncated: boolean }>("/statements"),
  });
  const rows = statements.data?.statements ?? [];

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm uppercase tracking-[0.16em] text-moss">Statements</p>
      <h1 className="font-serif text-4xl">Found mail</h1>
      <Card>
        <p className="leading-relaxed">
          A scan stores the subject, sender, and date of a statement email. It does not download the file or read the
          transactions inside it. Start a scan from the <Link className="text-moss" to="/calendar">calendar</Link>.
        </p>
        {rows.length === 0 ? <p className="mt-3 text-sm text-muted">No statement emails saved yet.</p> : null}
        {rows.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {rows.map((statement) => (
              <li key={statement.id} className="border-t border-line pt-3 text-sm">
                <p>{statement.subject ?? statement.originalFilename ?? "Statement"}</p>
                <p className="text-muted">
                  {statement.receivedOn ?? "Date unknown"}
                  {statement.sender ? ` · ${statement.sender}` : ""}
                  {statement.matchedKeywords.length ? ` · ${statement.matchedKeywords.join(", ")}` : ""}
                  {` · ${statement.status}`}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
