/**
 * @file ForgotPasswordPage.test.tsx
 * @description The "email me a link" form.
 *
 * The load-bearing test here is the one asserting the confirmation does not
 * change with the address. That is a security property, not a copy preference,
 * and it is the kind that gets helpfully "fixed" by someone adding a friendly
 * "we don't have an account for that" branch.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("../../api/client", () => ({
  apiClient: { post: (...args: unknown[]) => post(...args) },
}));

const { default: ForgotPasswordPage } = await import("./ForgotPasswordPage");

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

async function submit(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email address/i), email);
  await user.click(screen.getByRole("button", { name: /send reset link/i }));
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ status: 202 });
});

it("posts the address to the request endpoint", async () => {
  renderPage();
  await submit("someone@example.com");

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("/api/v1/auth/password-reset/request", {
      email: "someone@example.com",
    }),
  );
});

it("confirms in the conditional — never that the account exists", async () => {
  renderPage();
  await submit("someone@example.com");

  expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
});

it("says exactly the same thing for an address with no account", async () => {
  // The backend cannot tell us which case this was, and the UI must not
  // develop an opinion: same 202, same screen.
  renderPage();
  await submit("nobody@example.com");

  const confirmation = await screen.findByText(/if an account exists/i);
  expect(confirmation).toBeInTheDocument();
  expect(screen.queryByText(/no account/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("surfaces a rate-limit message, which is the one thing worth telling them", async () => {
  const { AxiosError } = await import("axios");
  const err = new AxiosError("Too Many Requests");
  // @ts-expect-error — minimal response shape.
  err.response = { data: { detail: "Rate limit exceeded: 5 per 1 hour" }, status: 429 };
  post.mockRejectedValue(err);

  renderPage();
  await submit("someone@example.com");

  expect(await screen.findByRole("alert")).toHaveTextContent(/rate limit exceeded/i);
  expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
});

it("falls back to a generic message when the request never lands", async () => {
  post.mockRejectedValue(new TypeError("Network Error"));

  renderPage();
  await submit("someone@example.com");

  expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
});
