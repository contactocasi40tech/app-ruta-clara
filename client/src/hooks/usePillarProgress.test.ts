import { describe, expect, it } from "vitest";
import { calculateStreak, levelFor, localDate } from "./pillarGamification";

describe("pillar gamification", () => {
  it("assigns the requested levels", () => {
    expect(levelFor(0)).toBe("Exploradora");
    expect(levelFor(300)).toBe("En Camino");
    expect(levelFor(900)).toBe("Clara");
  });

  it("counts consecutive daily activity from today or yesterday", () => {
    const today = new Date();
    const date = (offset: number) => {
      const value = new Date(today);
      value.setDate(value.getDate() + offset);
      return value.toISOString().slice(0, 10);
    };
    const rows = [
      { completada: true, fecha: date(0) },
      { completada: true, fecha: date(-1) },
      { completada: true, fecha: date(-2) },
    ] as never[];
    expect(calculateStreak(rows)).toBe(3);
  });

  it("formats an activity date from the user's local calendar date", () => {
    const colombiaEvening = new Date("2026-09-23T03:59:30.000Z");
    expect(localDate(colombiaEvening)).toBe("2026-09-22");
  });
});
