import { describe, expect, it } from "vitest";
import { normalizeBranchName } from "./branchName.js";

describe("normalizeBranchName", () => {
  it("normalizes a typical feature branch", () => {
    expect(normalizeBranchName("feat/payments-idempotency")).toBe(
      "feat_payments_idempotency",
    );
  });

  it("is idempotent — normalize(normalize(x)) === normalize(x)", () => {
    const inputs = [
      "feat/payments-idempotency",
      "Feat/Foo",
      "feat/v1.2.3",
      "/feat/foo/",
      "feat//foo--bar",
      "release/2026-Q2",
    ];
    for (const input of inputs) {
      const once = normalizeBranchName(input);
      const twice = normalizeBranchName(once);
      expect(twice).toBe(once);
    }
  });

  it("lowercases uppercase segments", () => {
    expect(normalizeBranchName("Feat/Foo")).toBe("feat_foo");
    expect(normalizeBranchName("RELEASE/PAYMENTS-V2")).toBe("release_payments_v2");
  });

  it("replaces dots with underscores", () => {
    expect(normalizeBranchName("feat/v1.2.3")).toBe("feat_v1_2_3");
  });

  it("strips leading and trailing slashes", () => {
    expect(normalizeBranchName("/feat/foo/")).toBe("feat_foo");
    expect(normalizeBranchName("//feat/foo")).toBe("feat_foo");
  });

  it("collapses repeated separators", () => {
    expect(normalizeBranchName("feat//foo--bar")).toBe("feat_foo_bar");
    expect(normalizeBranchName("feat///foo")).toBe("feat_foo");
  });

  it("handles whitespace by replacing with underscore", () => {
    expect(normalizeBranchName("feat/my feature")).toBe("feat_my_feature");
  });

  it("throws on empty string", () => {
    expect(() => normalizeBranchName("")).toThrow();
    expect(() => normalizeBranchName("   ")).toThrow();
  });

  it("throws on non-string input", () => {
    // @ts-expect-error intentional misuse
    expect(() => normalizeBranchName(null)).toThrow();
    // @ts-expect-error intentional misuse
    expect(() => normalizeBranchName(42)).toThrow();
  });

  it("throws when input normalizes to empty (only separators)", () => {
    expect(() => normalizeBranchName("///")).toThrow();
    expect(() => normalizeBranchName("---")).toThrow();
  });
});
