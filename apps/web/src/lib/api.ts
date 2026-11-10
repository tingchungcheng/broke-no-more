type ApiErrorDetail = { path?: string; message?: string };

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function apiErrorMessage(error: ApiClientError): string {
  const detail = error.details?.find((item) => item.message);
  if (detail?.message && (error.message === "Request is invalid." || detail.path === "password")) {
    if (detail.path === "password") {
      return "Enter the PDF password when adding subject phrases for the first time.";
    }
    return detail.message;
  }
  return error.message;
}

export async function api<T>(path: string, options: RequestInit = {}, csrfToken?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("x-broke-no-more", "1");
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrfToken) headers.set("x-csrf-token", csrfToken);

  const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: "same-origin" });
  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: string; details?: ApiErrorDetail[] };
  } | null;
  if (!response.ok) {
    throw new ApiClientError(
      payload?.error?.message ?? "Request failed.",
      response.status,
      payload?.error?.code ?? "request_failed",
      payload?.error?.details,
    );
  }
  return payload as T;
}
