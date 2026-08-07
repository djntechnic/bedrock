/**
 * @file authFlowApi.test.ts
 * @description The four F1 calls and the error-message extractor.
 *
 * The route assertions look pedantic until you remember these paths are half
 * of a contract: the backend mails a link built from `AUTH_FLOW_PATHS`, and a
 * typo here produces a link that 404s in a message already in someone's inbox,
 * where no deploy can reach it.
 */
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("../../api/client", () => ({
  apiClient: { post: (...args: unknown[]) => post(...args) },
}));

const {
  AUTH_FLOW_PATHS,
  TOKEN_PARAM,
  completePasswordReset,
  confirmEmailVerification,
  messageFromError,
  requestEmailVerification,
  requestPasswordReset,
} = await import("./authFlowApi");

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: null });
});

describe("route paths", () => {
  it("matches the paths bedrock.mail.service builds links from", () => {
    // Changing either side alone breaks links that are already sent.
    expect(AUTH_FLOW_PATHS.acceptInvite).toBe("/accept-invite");
    expect(AUTH_FLOW_PATHS.resetPassword).toBe("/reset-password");
    expect(AUTH_FLOW_PATHS.verifyEmail).toBe("/verify-email");
  });

  it("reads the token from the query parameter the backend appends", () => {
    expect(TOKEN_PARAM).toBe("token");
  });
});

describe("requestPasswordReset", () => {
  it("posts the address to the request endpoint", async () => {
    await requestPasswordReset("someone@example.com");
    expect(post).toHaveBeenCalledWith("/api/v1/auth/password-reset/request", {
      email: "someone@example.com",
    });
  });

  it("resolves for an address the backend does not recognise", async () => {
    // The endpoint answers 202 for every input, so there is no rejection to
    // handle here — and adding one would be the enumeration oracle again.
    post.mockResolvedValue({ status: 202 });
    await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
  });
});

describe("completePasswordReset", () => {
  it("sends the token and the new password under the API's field names", async () => {
    await completePasswordReset("tok-123", "hunter2hunter2");
    expect(post).toHaveBeenCalledWith("/api/v1/auth/password-reset/complete", {
      token: "tok-123",
      new_password: "hunter2hunter2",
    });
  });

  it("propagates a rejected token to the caller", async () => {
    post.mockRejectedValue(new Error("400"));
    await expect(completePasswordReset("dead", "hunter2hunter2")).rejects.toThrow();
  });
});

describe("verification", () => {
  it("requests a link with no body — the address comes from the session", async () => {
    await requestEmailVerification();
    expect(post).toHaveBeenCalledWith("/api/v1/auth/verify-email/request");
  });

  it("confirms with the token alone", async () => {
    await confirmEmailVerification("tok-abc");
    expect(post).toHaveBeenCalledWith("/api/v1/auth/verify-email/confirm", {
      token: "tok-abc",
    });
  });
});

describe("messageFromError", () => {
  function axiosErrorWithDetail(detail: unknown): AxiosError {
    const err = new AxiosError("Request failed");
    // @ts-expect-error — a minimal response is all the extractor reads.
    err.response = { data: { detail }, status: 400 };
    return err;
  }

  it("surfaces the backend detail", () => {
    const message = messageFromError(
      axiosErrorWithDetail("This link is invalid or has expired. Request a new one."),
      "fallback",
    );
    expect(message).toBe("This link is invalid or has expired. Request a new one.");
  });

  it("falls back when the response carries no detail", () => {
    expect(messageFromError(axiosErrorWithDetail(undefined), "fallback")).toBe("fallback");
  });

  it("falls back when detail is not a string", () => {
    // FastAPI returns a list of objects for a validation error; rendering that
    // as a message shows the user `[object Object]`.
    expect(messageFromError(axiosErrorWithDetail([{ msg: "too short" }]), "fallback")).toBe(
      "fallback",
    );
  });

  it("falls back on an empty detail", () => {
    expect(messageFromError(axiosErrorWithDetail(""), "fallback")).toBe("fallback");
  });

  it("falls back for a non-axios failure", () => {
    // A network drop never reaches a response at all.
    expect(messageFromError(new TypeError("Failed to fetch"), "fallback")).toBe("fallback");
  });
});
