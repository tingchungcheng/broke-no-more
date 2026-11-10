import { TRANSACTION_TYPES, type Direction, type TransactionType } from "./constants";
import { assertDirectionMatchesType, DirectionError } from "./transactions";

const CARD_PAYMENT = /payment\s+(?:thank\s+you|received)/i;

export type StatementTypeSuggestion = {
  direction?: string;
  transactionType?: string;
};

function isTransactionType(value: string | undefined): value is TransactionType {
  return TRANSACTION_TYPES.some((type) => type === value);
}

export function reconcileStatementRow(input: {
  description: string;
  direction: Direction;
  transactionType: TransactionType;
  accountType?: string;
  suggestion?: StatementTypeSuggestion | null;
}): { direction: Direction; transactionType: TransactionType } {
  if (CARD_PAYMENT.test(input.description)) {
    return { direction: "IN", transactionType: "REPAYMENT" };
  }
  if (input.accountType === "CREDIT_CARD" && input.transactionType === "REPAYMENT") {
    return { direction: "OUT", transactionType: "EXPENSE" };
  }
  const suggestedType = isTransactionType(input.suggestion?.transactionType) ? input.suggestion.transactionType : null;
  const suggestedDirection =
    input.suggestion?.direction === "IN" || input.suggestion?.direction === "OUT" ? input.suggestion.direction : null;
  const direction = suggestedDirection ?? input.direction;
  const transactionType =
    suggestedType === "REPAYMENT" ? input.transactionType : (suggestedType ?? input.transactionType);
  try {
    assertDirectionMatchesType(transactionType, direction);
    return { direction, transactionType };
  } catch (error) {
    if (error instanceof DirectionError) {
      return { direction: input.direction, transactionType: input.transactionType };
    }
    throw error;
  }
}
