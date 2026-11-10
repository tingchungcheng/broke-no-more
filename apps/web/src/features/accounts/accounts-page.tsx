import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
  MAX_ACCOUNT_STATEMENT_KEYWORDS,
  maskedIdentifierSchema,
  normalizeAccountStatementKeywords,
  normalizeStatementKeyword,
  SUGGESTED_STATEMENT_KEYWORDS,
} from "@broke-no-more/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ApiClientError, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type AccountFormValues = {
  type: AccountType;
  displayName: string;
  institution: string;
  currency: string;
  maskedIdentifier: string;
};

function AccountFields({
  idPrefix,
  values,
  onChange,
}: {
  idPrefix: string;
  values: AccountFormValues;
  onChange: (patch: Partial<AccountFormValues>) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-displayName`}>Name</Label>
        <Input
          id={`${idPrefix}-displayName`}
          value={values.displayName}
          onChange={(event) => onChange({ displayName: event.target.value })}
          required
          maxLength={80}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <select
          id={`${idPrefix}-type`}
          className="h-11 w-full rounded-2xl border border-line bg-paper px-3 text-sm"
          value={values.type}
          onChange={(event) => onChange({ type: event.target.value as AccountType })}
        >
          {ACCOUNT_TYPES.map((accountType) => (
            <option key={accountType} value={accountType}>
              {ACCOUNT_TYPE_LABELS[accountType]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-institution`}>Institution</Label>
          <Input
            id={`${idPrefix}-institution`}
            value={values.institution}
            onChange={(event) => onChange({ institution: event.target.value })}
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-currency`}>Currency</Label>
          <Input
            id={`${idPrefix}-currency`}
            value={values.currency}
            onChange={(event) => onChange({ currency: event.target.value.toUpperCase() })}
            maxLength={3}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-mask`}>Masked identifier</Label>
        <Input
          id={`${idPrefix}-mask`}
          value={values.maskedIdentifier}
          onChange={(event) => onChange({ maskedIdentifier: event.target.value })}
          placeholder="1234 or ****1234"
          maxLength={8}
        />
        <p className="text-xs text-muted">
          Optional. Use exactly four digits (<span className="font-mono">1234</span>) or a mask plus four digits (
          <span className="font-mono">****1234</span>). Not a full card number.
        </p>
      </div>
    </>
  );
}

const emptyForm = (): AccountFormValues => ({
  type: "CASH",
  displayName: "",
  institution: "",
  currency: "MYR",
  maskedIdentifier: "",
});

function accountToForm(account: Account): AccountFormValues {
  return {
    type: account.type,
    displayName: account.displayName,
    institution: account.institution ?? "",
    currency: account.currency,
    maskedIdentifier: account.maskedIdentifier ?? "",
  };
}

function validateMask(maskedIdentifier: string): string | null {
  if (!maskedIdentifier.trim()) return null;
  const parsed = maskedIdentifierSchema.safeParse(maskedIdentifier.trim());
  return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Use the last 4 digits or ****1234.");
}

function formPayload(values: AccountFormValues) {
  return {
    type: values.type,
    displayName: values.displayName,
    institution: values.institution || undefined,
    currency: values.currency,
    maskedIdentifier: values.maskedIdentifier || undefined,
  };
}

export function AccountsPage() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: () => api<{ accounts: Account[] }>("/accounts") });
  const statementPasswords = useQuery({
    queryKey: ["statement-passwords"],
    queryFn: () => api<{ passwords: Array<{ id: string; label: string; accountId: string | null }> }>("/statement-passwords"),
  });
  const [createForm, setCreateForm] = useState<AccountFormValues>(emptyForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [editForm, setEditForm] = useState<AccountFormValues>(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const [statementKeywordChips, setStatementKeywordChips] = useState<string[]>([]);
  const [statementKeywordDraft, setStatementKeywordDraft] = useState("");
  const [statementPasswordDraft, setStatementPasswordDraft] = useState("");
  const [hasSavedStatementPassword, setHasSavedStatementPassword] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditing(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing]);

  const create = useMutation({
    mutationFn: () =>
      api("/accounts", {
        method: "POST",
        body: JSON.stringify(formPayload(createForm)),
      }),
    onSuccess: async () => {
      setCreateForm(emptyForm());
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (caught) => setCreateError(caught instanceof ApiClientError ? caught.message : "Could not save the account."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/accounts/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  function onCreateSubmit(event: FormEvent) {
    event.preventDefault();
    const maskError = validateMask(createForm.maskedIdentifier);
    if (maskError) {
      setCreateError(maskError);
      return;
    }
    create.mutate();
  }

  async function onEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const maskError = validateMask(editForm.maskedIdentifier);
    if (maskError) {
      setEditError(maskError);
      return;
    }
    const passwordDraft = statementPasswordDraft.trim();
    const labels = normalizeAccountStatementKeywords(statementKeywordChips);
    if (statementKeywordChips.length > 0 && labels.length !== statementKeywordChips.length) {
      setEditError("Use a short phrase from the email subject, up to 40 characters, without : or \\.");
      return;
    }
    const shouldSyncPasswords =
      passwordDraft.length > 0 || labels.length > 0 || (hasSavedStatementPassword && labels.length === 0);
    if (labels.length > 0 && !hasSavedStatementPassword && !passwordDraft) {
      setEditError("Enter the PDF password when adding subject phrases.");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await api(`/accounts/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(formPayload(editForm)),
      });
      if (shouldSyncPasswords) {
        await api("/statement-passwords", {
          method: "PUT",
          body: JSON.stringify({
            accountId: editing.id,
            labels,
            ...(passwordDraft ? { password: passwordDraft } : {}),
          }),
        });
      }
      setEditing(null);
      setStatementKeywordChips([]);
      setStatementKeywordDraft("");
      setStatementPasswordDraft("");
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["statement-passwords"] });
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        if (caught.code === "account_not_found") {
          setEditError("This account is no longer in your workspace. Refresh the page and try again.");
        } else if (caught.code === "not_found") {
          setEditError("Edit is not available on the API yet. Restart pnpm dev and try again.");
        } else {
          setEditError(apiErrorMessage(caught));
        }
      } else {
        setEditError("Could not update the account.");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  function openEdit(account: Account) {
    setEditForm(accountToForm(account));
    setEditError(null);
    const linked = statementPasswords.data?.passwords.filter((row) => row.accountId === account.id) ?? [];
    const fallback =
      linked.length > 0
        ? []
        : statementPasswords.data?.passwords.filter(
            (row) => row.label.toLowerCase() === (account.institution ?? "").toLowerCase(),
          ) ?? [];
    const labels = (linked.length > 0 ? linked : fallback).map((row) => row.label);
    const institution = account.institution?.trim();
    const suggested =
      institution && SUGGESTED_STATEMENT_KEYWORDS.some((item) => item.toLowerCase() === institution.toLowerCase())
        ? SUGGESTED_STATEMENT_KEYWORDS.find((item) => item.toLowerCase() === institution.toLowerCase())!
        : null;
    const initialRaw =
      labels.length > 0 ? labels : suggested ? [suggested] : institution ? [institution] : [];
    const initialChips = normalizeAccountStatementKeywords(initialRaw);
    setStatementKeywordChips(initialChips);
    setStatementKeywordDraft("");
    setStatementPasswordDraft("");
    setHasSavedStatementPassword(linked.length > 0 || fallback.length > 0);
    setEditing(account);
  }

  function addStatementKeywordChip() {
    const keyword = normalizeStatementKeyword(statementKeywordDraft);
    if (!keyword) {
      setEditError("Use a short name that matches a calendar scan chip, such as Hong Leong.");
      return;
    }
    if (statementKeywordChips.length >= MAX_ACCOUNT_STATEMENT_KEYWORDS) {
      setEditError(`You can save at most ${MAX_ACCOUNT_STATEMENT_KEYWORDS} subject phrases per account.`);
      return;
    }
    if (statementKeywordChips.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
      setStatementKeywordDraft("");
      setEditError(null);
      return;
    }
    setStatementKeywordChips((current) => [...current, keyword]);
    setStatementKeywordDraft("");
    setEditError(null);
  }

  function removeStatementKeywordChip(keyword: string) {
    setStatementKeywordChips((current) => current.filter((item) => item.toLowerCase() !== keyword.toLowerCase()));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h1 className="font-serif text-3xl">Add an account</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This is a label for money you track. It does not connect to a bank, and it does not store a full card number.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onCreateSubmit}>
          <AccountFields
            idPrefix="create"
            values={createForm}
            onChange={(patch) => setCreateForm((current) => ({ ...current, ...patch }))}
          />
          {createError ? (
            <p className="text-sm text-danger" role="alert">
              {createError}
            </p>
          ) : null}
          <Button type="submit" disabled={create.isPending}>
            Save account
          </Button>
        </form>
      </Card>
      <section>
        <h2 className="font-serif text-3xl">Your accounts</h2>
        {accounts.data?.accounts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No accounts yet. Recording a transaction needs one.{" "}
            <Link className="text-moss" to="/transactions">
              Transactions
            </Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {accounts.data?.accounts.map((account) => (
              <li key={account.id} className="flex items-start justify-between gap-4 rounded-3xl border border-line bg-card px-4 py-3">
                <div>
                  <p className="font-medium">{account.displayName}</p>
                  <p className="text-sm text-muted">
                    {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                    {account.institution ? ` · ${account.institution}` : ""}
                    {account.maskedIdentifier ? ` · ${account.maskedIdentifier}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${account.displayName}`}
                    onClick={() => openEdit(account)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Remove ${account.displayName}? Transactions on it will be removed too.`)) {
                        remove.mutate(account.id);
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
          role="presentation"
          onClick={() => setEditing(null)}
        >
          <Card
            className="w-full max-w-lg shadow-[0_24px_60px_rgba(28,25,21,0.18)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-account-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="edit-account-title" className="font-serif text-2xl">
              Edit account
            </h2>
            <p className="mt-1 text-sm text-muted">Changes apply to this label only. Existing transactions keep their links.</p>
            <form className="mt-6 space-y-4" onSubmit={onEditSubmit}>
              <AccountFields
                idPrefix="edit"
                values={editForm}
                onChange={(patch) => setEditForm((current) => ({ ...current, ...patch }))}
              />
              <div className="space-y-4 border-t border-line pt-4">
                <div>
                  <p className="text-sm font-medium">Statement PDF</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    For locked e-statements from Gmail. Add up to {MAX_ACCOUNT_STATEMENT_KEYWORDS} phrases that appear in
                    the email subject. A calendar chip such as Hong Leong finds the mail. A phrase such as Credit Card
                    is what selects this account's password. Press Enter to add each phrase.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-statement-keyword">Subject phrases</Label>
                  <div className="flex flex-wrap gap-2" aria-live="polite">
                    {statementKeywordChips.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1 rounded-full border border-moss bg-moss/10 px-3 py-1 text-sm text-ink"
                      >
                        {keyword}
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-muted hover:text-ink"
                          aria-label={`Remove ${keyword}`}
                          onClick={() => removeStatementKeywordChip(keyword)}
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    ))}
                    {statementKeywordChips.length === 0 ? (
                      <span className="text-sm text-muted">No phrases yet.</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="edit-statement-keyword"
                      value={statementKeywordDraft}
                      onChange={(event) => setStatementKeywordDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        addStatementKeywordChip();
                      }}
                      placeholder="credit card"
                      maxLength={40}
                      className="min-w-48 flex-1"
                      disabled={statementKeywordChips.length >= MAX_ACCOUNT_STATEMENT_KEYWORDS}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={statementKeywordChips.length >= MAX_ACCOUNT_STATEMENT_KEYWORDS}
                      onClick={addStatementKeywordChip}
                    >
                      Add
                    </Button>
                  </div>
                  <p className={cn("text-xs text-muted", statementKeywordChips.length >= MAX_ACCOUNT_STATEMENT_KEYWORDS ? "text-amber" : "")}>
                    {statementKeywordChips.length}/{MAX_ACCOUNT_STATEMENT_KEYWORDS} phrases
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-statement-password">PDF password</Label>
                  <Input
                    id="edit-statement-password"
                    type="password"
                    autoComplete="new-password"
                    value={statementPasswordDraft}
                    onChange={(event) => setStatementPasswordDraft(event.target.value)}
                    placeholder={hasSavedStatementPassword ? "Saved. Enter a new one to replace." : "Optional"}
                    maxLength={80}
                  />
                </div>
              </div>
              {editError ? (
                <p className="text-sm text-danger" role="alert">
                  {editError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={savingEdit}>
                  Save changes
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
