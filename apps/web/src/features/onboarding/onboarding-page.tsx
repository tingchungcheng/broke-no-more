import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";

const steps = [
  { title: "Add an account", body: "Name the wallet, card, or cash you want to record against.", href: "/accounts", ready: true },
  { title: "Record a transaction", body: "Amount, date, and account are enough. The type keeps transfers out of spending.", href: "/transactions", ready: true },
  { title: "Import a statement", body: "Gmail discovery and file upload are not in this version.", href: "/statements", ready: false },
];

export function OnboardingPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-sm uppercase tracking-[0.16em] text-moss">Getting started</p>
      <h1 className="mt-2 font-serif text-4xl">Three steps, two of them ready</h1>
      <ol className="mt-6 space-y-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card>
              <p className="text-sm text-muted">Step {index + 1}</p>
              <h2 className="mt-1 font-serif text-2xl">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              <Link to={step.href} className="mt-3 inline-block text-sm text-moss">
                {step.ready ? "Open" : "See what's planned"}
              </Link>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
