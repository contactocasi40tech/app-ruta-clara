export type SessionPolicy = {
  remember: boolean;
  startedAt: number;
  expiresAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildSessionPolicy(remember: boolean, now = Date.now()): SessionPolicy {
  return {
    remember,
    startedAt: now,
    expiresAt: now + (remember ? 30 : 1) * DAY_MS,
  };
}
