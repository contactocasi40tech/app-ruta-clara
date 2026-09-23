import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ConsultData, Measurement, ProgressState, RutaSessionRow, SessionPrivateSummary } from "@/types/ruta";
import { calculateStreak, levelFor, localDate } from "./pillarGamification";

const EMPTY_MEASUREMENT: Measurement = { value: "", unit: "mg/dL", timing: "", source: "", date: "", reviewed: "" };
const EMPTY_CONSULT: ConsultData = { reason: "", signs: "", duration: "", family: "", medicines: "", worry: "" };
const EMPTY_SUMMARY: SessionPrivateSummary = { situation: "", barrier: "", consult: EMPTY_CONSULT, habit: "", days: [], country: "mexico", progress: {} };
const PROGRESS_KEYS = ["route", "context", "questions", "summary", "resource", "habit"];
const TASK_POINTS = 50;
const PILLAR_BONUS = 100;
const BONUS_TASK_ID = "__bonus_pilar_completo__";

export type PillarProgressRow = {
  id: string;
  user_id: string;
  pilar_id: string;
  tarea_id: string;
  completada: boolean;
  fecha: string;
  puntos: number;
  created_at: string;
  updated_at: string;
};

export type PillarTaskMap = Record<string, string[]>;

function normalizeSession(row: RutaSessionRow) {
  const summary = { ...EMPTY_SUMMARY, ...(row.resumen_privado_json || {}) };
  return {
    situation: summary.situation || "",
    barrier: summary.barrier || "",
    measurement: { ...EMPTY_MEASUREMENT, ...(row.contexto_medicion_json || {}) },
    consult: { ...EMPTY_CONSULT, ...(summary.consult || {}), reason: summary.consult?.reason || row.motivo_consulta || "" },
    habit: summary.habit || row.plan_accion || "",
    days: Array.isArray(summary.days) ? summary.days : [],
    progress: summary.progress || {},
    country: summary.country || "mexico",
  };
}

export function useRutaCloudState(user: User, pillarTaskMap: PillarTaskMap = {}) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<RutaSessionRow[]>([]);
  const [pillarRows, setPillarRows] = useState<PillarProgressRow[]>([]);
  const [situation, setSituation] = useState("");
  const [barrier, setBarrier] = useState("");
  const [measurement, setMeasurement] = useState<Measurement>(EMPTY_MEASUREMENT);
  const [consult, setConsult] = useState<ConsultData>(EMPTY_CONSULT);
  const [habit, setHabit] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProgressState>({});
  const [country, setCountry] = useState<"mexico" | "colombia" | "argentina">("mexico");
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pillarLoading, setPillarLoading] = useState(true);
  const [pillarSaving, setPillarSaving] = useState(false);
  const [pillarError, setPillarError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const creating = useRef<Promise<string> | null>(null);

  const completionPercent = useMemo(() => Math.round((PROGRESS_KEYS.filter((key) => progress[key]).length / PROGRESS_KEYS.length) * 100), [progress]);
  const completedTasks = useMemo(
    () => pillarRows.filter((row) => row.tarea_id !== BONUS_TASK_ID).map((row) => row.tarea_id),
    [pillarRows],
  );
  const points = useMemo(() => pillarRows.reduce((total, row) => total + row.puntos, 0), [pillarRows]);
  const level = levelFor(points);
  const streak = useMemo(() => calculateStreak(pillarRows), [pillarRows]);

  const applySession = useCallback((row: RutaSessionRow) => {
    hydrated.current = false;
    const data = normalizeSession(row);
    setActiveSessionId(row.id);
    setSituation(data.situation);
    setBarrier(data.barrier);
    setMeasurement(data.measurement);
    setConsult(data.consult);
    setHabit(data.habit);
    setDays(data.days);
    setProgress(data.progress);
    setCountry(data.country);
    window.setTimeout(() => { hydrated.current = true; }, 0);
  }, []);

  const refreshHistory = useCallback(async () => {
    const { data, error } = await supabase.from("sesiones_ruta").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = (data || []) as RutaSessionRow[];
    setHistory(rows);
    return rows;
  }, []);

  const refreshPillarProgress = useCallback(async () => {
    setPillarError(null);
    const { data, error } = await supabase
      .from("ruta_pilares_progreso")
      .select("*")
      .eq("user_id", user.id)
      .eq("completada", true)
      .order("fecha", { ascending: false });
    if (error) throw error;
    setPillarRows((data || []) as PillarProgressRow[]);
  }, [user.id]);

  const createSession = useCallback(async () => {
    if (creating.current) return creating.current;
    creating.current = (async () => {
      const { data, error } = await supabase.from("sesiones_ruta").insert({ user_id: user.id }).select("*").single();
      if (error) throw error;
      const row = data as RutaSessionRow;
      applySession(row);
      setHistory((current) => [row, ...current]);
      return row.id;
    })();
    try {
      return await creating.current;
    } finally {
      creating.current = null;
    }
  }, [applySession, user.id]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [rows] = await Promise.all([refreshHistory(), refreshPillarProgress()]);
        if (!mounted) return;
        const resumable = rows.find((row) => !row.completada) || rows[0];
        if (resumable) applySession(resumable);
        else await createSession();
      } catch (error) {
        console.error("[Ruta Clara] No se pudo cargar el historial", error);
        setSyncState("error");
      } finally {
        if (mounted) {
          setLoading(false);
          setPillarLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [applySession, createSession, refreshHistory, refreshPillarProgress]);

  useEffect(() => {
    if (!activeSessionId || !hydrated.current || loading) return;
    setSyncState("saving");
    const timer = window.setTimeout(async () => {
      const summary: SessionPrivateSummary = { situation, barrier, consult, habit, days, progress, country };
      try {
        const { data, error } = await supabase
          .from("sesiones_ruta")
          .update({
            motivo_consulta: consult.reason,
            contexto_medicion_json: measurement,
            resumen_privado_json: summary,
            plan_accion: habit,
            progreso: completionPercent,
            completada: completionPercent === 100,
          })
          .eq("id", activeSessionId)
          .eq("user_id", user.id)
          .select("*")
          .single();
        if (error) throw error;

        if (measurement.value || measurement.source || measurement.date) {
          const numericValue = Number(measurement.value.replace(",", "."));
          const { error: measurementError } = await supabase.from("mediciones").upsert({
            user_id: user.id,
            sesion_id: activeSessionId,
            valor: Number.isFinite(numericValue) ? numericValue : null,
            unidad: measurement.unit,
            origen_dato: measurement.source,
            fecha: measurement.date || null,
            notas: [measurement.timing, measurement.reviewed ? `Revisada por profesional: ${measurement.reviewed}` : ""].filter(Boolean).join(". "),
          }, { onConflict: "sesion_id" });
          if (measurementError) throw measurementError;
        }

        if (habit) {
          const { error: planError } = await supabase.from("planes").upsert({
            user_id: user.id,
            sesion_id: activeSessionId,
            fecha_inicio: localDate(),
            accion_elegida: JSON.stringify({ habit, days }),
            estado: completionPercent === 100 ? "completado" : "activo",
          }, { onConflict: "sesion_id" });
          if (planError) throw planError;
        }

        const saved = data as RutaSessionRow;
        setHistory((current) => current.map((row) => row.id === saved.id ? saved : row).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)));
        setSyncState("saved");
      } catch (error) {
        console.error("[Ruta Clara] Error de guardado", error);
        setSyncState("error");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeSessionId, barrier, completionPercent, consult, country, days, habit, loading, measurement, progress, situation, user.id]);

  const togglePillarTask = useCallback(async (pilarId: string, tareaId: string) => {
    if (completedTasks.includes(tareaId)) return;
    setPillarSaving(true);
    setPillarError(null);
    try {
      const fecha = localDate();
      const { error: taskError } = await supabase.from("ruta_pilares_progreso").upsert(
        {
          user_id: user.id,
          pilar_id: pilarId,
          tarea_id: tareaId,
          completada: true,
          fecha,
          puntos: TASK_POINTS,
        },
        { onConflict: "user_id,pilar_id,tarea_id", ignoreDuplicates: true },
      );
      if (taskError) throw taskError;

      const taskIds = pillarTaskMap[pilarId] || [];
      const { data: completedPillarTasks, error: pillarError } = await supabase
        .from("ruta_pilares_progreso")
        .select("tarea_id")
        .eq("user_id", user.id)
        .eq("pilar_id", pilarId)
        .eq("completada", true)
        .in("tarea_id", taskIds);
      if (pillarError) throw pillarError;

      if (taskIds.length === 3 && (completedPillarTasks || []).length === 3) {
        const { error: bonusError } = await supabase.from("ruta_pilares_progreso").upsert(
          {
            user_id: user.id,
            pilar_id: pilarId,
            tarea_id: BONUS_TASK_ID,
            completada: true,
            fecha,
            puntos: PILLAR_BONUS,
          },
          { onConflict: "user_id,pilar_id,tarea_id", ignoreDuplicates: true },
        );
        if (bonusError) throw bonusError;
      }
      await refreshPillarProgress();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el progreso.";
      setPillarError(message);
      throw error;
    } finally {
      setPillarSaving(false);
    }
  }, [completedTasks, pillarTaskMap, refreshPillarProgress, user.id]);

  const resetPillarProgress = useCallback(async () => {
    setPillarSaving(true);
    setPillarError(null);
    try {
      const { error } = await supabase.from("ruta_pilares_progreso").delete().eq("user_id", user.id);
      if (error) throw error;
      setPillarRows([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo reiniciar el progreso.";
      setPillarError(message);
      throw error;
    } finally {
      setPillarSaving(false);
    }
  }, [user.id]);

  const newSession = useCallback(async () => {
    hydrated.current = false;
    setSituation("");
    setBarrier("");
    setMeasurement(EMPTY_MEASUREMENT);
    setConsult(EMPTY_CONSULT);
    setHabit("");
    setDays([]);
    setProgress({});
    setCountry("mexico");
    await createSession();
  }, [createSession]);

  const resumeSession = useCallback((id: string) => {
    const row = history.find((item) => item.id === id);
    if (row) applySession(row);
  }, [applySession, history]);

  return {
    activeSessionId,
    history,
    situation,
    setSituation,
    barrier,
    setBarrier,
    measurement,
    setMeasurement,
    consult,
    setConsult,
    habit,
    setHabit,
    days,
    setDays,
    progress,
    setProgress,
    country,
    setCountry,
    loading,
    syncState,
    completionPercent,
    completedTasks,
    points,
    level,
    streak,
    pillarLoading,
    pillarSaving,
    pillarError,
    refreshPillarProgress,
    togglePillarTask,
    resetPillarProgress,
    newSession,
    resumeSession,
    refreshHistory,
  };
}
