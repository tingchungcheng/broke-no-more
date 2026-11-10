import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";

export function StatementsPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm uppercase tracking-[0.16em] text-moss">Statements</p>
      <h1 className="font-serif text-4xl">Import comes later</h1>
      <Card>
        <p className="leading-relaxed">
          This version does not read a mailbox and does not accept statement files. When import arrives, each file will
          stay private and every parsed transaction will keep a link back to the file and parser that produced it.
        </p>
        <p className="mt-3 text-sm text-muted">
          You can still <Link className="text-moss" to="/transactions">record a transaction</Link> by hand. Those rows are
          marked “Recorded by you”, which is different from a statement import.
        </p>
      </Card>
    </div>
  );
}
