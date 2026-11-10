import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./login-page";

describe("LoginPage", () => {
  it("explains that Google sign-in is identity only", () => {
    render(
      <LoginPage
        googleAuthEnabled
        devAuthEnabled={false}
        error={null}
        onDevLogin={vi.fn()}
        devLoginPending={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/v1/auth/google");
    expect(screen.getByText(/this version does not ask for it/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /gmail/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue as Alex Tan" })).not.toBeInTheDocument();
  });

  it("offers the local personas only when dev sign-in is enabled", () => {
    render(
      <LoginPage googleAuthEnabled={false} devAuthEnabled error={null} onDevLogin={vi.fn()} devLoginPending={false} />,
    );
    expect(screen.getByRole("button", { name: "Continue as Alex Tan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Blair Lim" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("points Continue with Google at Cognito when the user pool is configured", () => {
    render(
      <LoginPage
        googleAuthEnabled={false}
        cognitoAuthEnabled
        devAuthEnabled={false}
        error={null}
        onDevLogin={vi.fn()}
        devLoginPending={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/v1/auth/cognito");
  });
});
