export type GamificationLevel = "Exploradora" | "En Camino" | "Clara";

export type StreakRow = { completada: boolean; fecha: string };

const STREAK_TIME_ZONE = "America/Bogota";

export function localDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STREAK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function previousDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - 1);
  return localDate(value);
}

export function calculateStreak(rows: StreakRow[]) {
  const dates = new Set(rows.filter((row) => row.completada).map((row) => row.fecha));
  let cursor = localDate();
  if (!dates.has(cursor)) cursor = previousDate(cursor);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = previousDate(cursor);
  }
  return streak;
}

export function levelFor(points: number): GamificationLevel {
  if (points >= 900) return "Clara";
  if (points >= 300) return "En Camino";
  return "Exploradora";
}
