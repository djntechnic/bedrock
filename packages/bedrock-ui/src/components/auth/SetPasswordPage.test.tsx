/**
 * @file SetPasswordPage.test.tsx
 * @description The page an invitation or reset link lands on.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("../../api/client", () => ({
  apiClient: { post: (...args: unknown[]) => post(...args) },
}));

const { default: SetPasswordPage } = await import("./SetPasswordPage");

const COMPLETE_URL = "/api/v1/auth/password-reset/complete";

function renderPage(
  { token, mode }: { token?: string; mode?: "invite" | "reset" } = {},
) {
  const search = token === undefined ? "" : `?token=${encodeURIComponent(token)}`;
  return render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
      <SetPasswordPage mode={mode} />
    </MemoryRouter>,
  );
}

function fillAndSubmit(password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: /create account|update password/i }));
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ status: 204 });
});

describe("the token", () => {
  it("is read from the query string and sent with the password", async () => {
    renderPage({ token: "tok-123" });
    await fillAndSubmit("correct horse battery");

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(COMPLETE_URL, {
        token: "tok-123",
        new_password: "correct horse battery",
      }),
    );
  });

  it("survives a token containing URL-significant characters", async () => {
    // The backend percent-encodes the token into the link; the router must
    // hand back the decoded original or the redemption silently fails.
    renderPage({ token: "a+b/c=d" });
    await fillAndSubmit("correct horse battery");

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        COMPLETE_URL,
        expect.objectContaining({ token: "a+b/c=d" }),
      ),
    );
  });

  it("refuses to show the form at all when the link carries no token", () => {
    renderPage();
    expect(screen.getByText(/link is incomplete/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("treats an empty token the same as a missing one", () => {
    renderPage({ token: "" });
    expect(screen.getByText(/link is incomplete/i)).toBeInTheDocument();
  });
});

describe("validation happens before the request", () => {
  it("rejects mismatched passwords without spending the token", async () => {
    renderPage({ token: "tok-123" });
    await fillAndSubmit("correct horse battery", "correct horse batteries");

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/i);
    expect(post).not.toHaveBeenCalled();
  });

  it("rejects a password below the backend's eight-character minimum", async () => {
    renderPage({ token: "tok-123" });
    await fillAndSubmit("short");

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 8 characters/i);
    expect(post).not.toHaveBeenCalled();
  });

  it("accepts a password of exactly the minimum length", async () => {
    renderPage({ token: "tok-123" });
    await fillAndSubmit("12345678");
    await waitFor(() => expect(post).toHaveBeenCalled());
  });
});

describe("outcomes", () => {
  it("confirms success and offers the way onward", async () => {
    renderPage({ token: "tok-123" });
    await fillAndSubmit("correct horse battery");

    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to sign in/i })).toBeInTheDocument();
  });

  it("shows the backend's message for a dead token", async () => {
    const { AxiosError } = await import("axios");
    const err = new AxiosError("Request failed");
    // @ts-expect-error — minimal response shape.
    err.response = { data: { detail: "This link is invalid or has expired. Request a new one." } };
    post.mockRejectedValue(err);

    renderPage({ token: "spent" });
    await fillAndSubmit("correct horse battery");

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    // Still on the form: the whole point of the message is that they can retry
    // with a fresh link, and a success screen would say the opposite.
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });

  it("falls back to a generic message when the network fails outright", async () => {
    post.mockRejectedValue(new TypeError("Network Error"));

    renderPage({ token: "tok-123" });
    await fillAndSubmit("correct horse battery");

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});

describe("invite mode", () => {
  it("says 'choose' rather than 'reset', and posts the identical body", async () => {
    renderPage({ token: "invite-tok", mode: "invite" });
    expect(screen.getByText(/choose your password/i)).toBeInTheDocument();

    await fillAndSubmit("correct horse battery");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(COMPLETE_URL, {
        token: "invite-tok",
        new_password: "correct horse battery",
      }),
    );
    expect(await screen.findByText(/you're all set/i)).toBeInTheDocument();
  });
});
