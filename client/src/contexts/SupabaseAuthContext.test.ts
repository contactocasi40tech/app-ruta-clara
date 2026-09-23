import { describe, expect, it } from "vitest";
import { buildSessionPolicy } from "@/lib/sessionPolicy";

const HOUR_MS = 60 * 60 * 1000;

describe("Ruta Clara session policy", () => {
  it("limits an unremembered session to 24 hours", () => {
    const policy = buildSessionPolicy(false, 1_000);
    expect(policy.remember).toBe(false);
    expect(policy.expiresAt - policy.startedAt).toBe(24 * HOUR_MS);
  });

  it("limits a remembered session to 30 days", () => {
    const policy = buildSessionPolicy(true, 1_000);
    expect(policy.remember).toBe(true);
    expect(policy.expiresAt - policy.startedAt).toBe(30 * 24 * HOUR_MS);
  });
});
