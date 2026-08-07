/**
 * @file VerifyEmailPage.test.tsx
 * @description The page a verification link lands on. It redeems on mount,
 *              which is exactly what makes the single-call test worth having.
 */
import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("../../api/client", () => ({
  apiClient: { post: (...args: unknown[]) => post(...args) },
}));

const { default: VerifyEmailPage } = await import("./VerifyEmailPage");

const CONFIRM_URL = "/api/v1/auth/verify-email/confirm";

function renderPage(token?: string, { strict = false } = {}) {
  const search = token === undefined ? "" : `?token=${encodeURIComponent(token)}`;
  const tree = (
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <VerifyEmailPage />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ status: 204 });
});

it("redeems the token on mount and reports success", async () => {
  renderPage("tok-123");

  await waitFor(() => expect(post).toHaveBeenCalledWith(CONFIRM_URL, { token: "tok-123" }));
  expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
});

it("posts exactly once under StrictMode's double mount", async () => {
  // Without the guard the second call redeems a spent token, gets the 400 the
  // backend returns for one, and the page reports a successful verification as
  // a dead link — a bug visible only in development, which is worse.
  renderPage("tok-123", { strict: true });

  await waitFor(() => expect(screen.getByText(/email verified/i)).toBeInTheDocument());
  expect(post).toHaveBeenCalledTimes(1);
});

it("shows a pending state before the request settles", async () => {
  let release: () => void = () => {};
  post.mockReturnValue(new Promise<void>((resolve) => {
    release = () => resolve();
  }));

  renderPage("tok-123");
  expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();

  release();
  expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
});

describe("failures", () => {
  it("does not call the API when the link has no token", () => {
    renderPage();
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText(/didn't work/i)).toBeInTheDocument();
    expect(screen.getByText(/link is incomplete/i)).toBeInTheDocument();
  });

  it("shows the backend's message for an expired token", async () => {
    const { AxiosError } = await import("axios");
    const err = new AxiosError("Request failed");
    // @ts-expect-error — minimal response shape.
    err.response = { data: { detail: "This link is invalid or has expired. Request a new one." } };
    post.mockRejectedValue(err);

    renderPage("expired");

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByText(/email verified/i)).not.toBeInTheDocument();
  });

  it("falls back to a generic message when the network fails", async () => {
    post.mockRejectedValue(new TypeError("Network Error"));

    renderPage("tok-123");

    expect(await screen.findByText(/couldn't verify this address/i)).toBeInTheDocument();
  });
});
