import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import Activity from "@/components/Activity.jsx";
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronDown,
  Flame,
  HeartPulse,
  Lightbulb,
  Loader2,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Search,
  Save,
  Sparkles,
  Utensils,
} from "lucide-react";

type ActivityType = "Caminé" | "Troté" | "Corrí";
type Weather = "Soleado" | "Nublado" | "Lluvioso" | "Frío";
type Terrain = "Plano" | "Destapado" | "Subida";

type FoodRule = {
  name: string;
  aliases: string[];
  impact: number;
  kcal: number;
  alternative: string;
};

const FOOD_RULES: FoodRule[] = [
  { name: "Gaseosa", aliases: ["gaseosa", "refresco", "soda"], impact: 80, kcal: 140, alternative: "Agua con limón o soda sin azúcar" },
  { name: "Colombiana", aliases: ["colombiana"], impact: 75, kcal: 150, alternative: "Agua de panela sin azúcar o agua con gas" },
  { name: "Postobón", aliases: ["postobon", "postobón"], impact: 75, kcal: 150, alternative: "Agua aromática sin azúcar" },
  { name: "Pan de bono", aliases: ["pan de bono", "pandebono"], impact: 45, kcal: 180, alternative: "Arepa de maíz asada con queso fresco" },
  { name: "Buñuelo", aliases: ["buñuelo", "bunuelo"], impact: 55, kcal: 175, alternative: "Arepa asada pequeña" },
  { name: "Empanada", aliases: ["empanada", "empanadas"], impact: 50, kcal: 220, alternative: "Empanada al horno de pollo y verduras" },
  { name: "Arepa frita", aliases: ["arepa frita", "arepa con aceite"], impact: 48, kcal: 230, alternative: "Arepa asada de maíz" },
  { name: "Chicharrón", aliases: ["chicharron", "chicharrón"], impact: 30, kcal: 320, alternative: "Pollo a la plancha o chicharrón magro al horno" },
  { name: "Pan blanco", aliases: ["pan blanco", "pan tajado"], impact: 38, kcal: 135, alternative: "Pan integral 100%" },
  { name: "Arroz blanco en exceso", aliases: ["arroz blanco", "arroz blanco en exceso"], impact: 42, kcal: 260, alternative: "Media porción de arroz integral con ensalada" },
  { name: "Arroz con pollo", aliases: ["arroz con pollo"], impact: 35, kcal: 420, alternative: "Arroz con pollo y más verduras, en porción moderada" },
  { name: "Papa frita", aliases: ["papa frita", "papas fritas"], impact: 32, kcal: 310, alternative: "Papa cocida o al air fryer" },
  { name: "Maltas", aliases: ["malta", "maltas"], impact: 58, kcal: 210, alternative: "Yogur natural sin azúcar" },
  { name: "Jugo en caja", aliases: ["jugo en caja", "jugo de caja"], impact: 65, kcal: 130, alternative: "Fruta entera y agua" },
  { name: "Chocolate caliente", aliases: ["chocolate caliente"], impact: 40, kcal: 190, alternative: "Cacao sin azúcar con leche" },
  { name: "Helado", aliases: ["helado"], impact: 45, kcal: 210, alternative: "Yogur griego natural con fruta" },
  { name: "Postre", aliases: ["postre", "torta", "pastel"], impact: 60, kcal: 280, alternative: "Fruta con canela" },
  { name: "Cereal azucarado", aliases: ["cereal azucarado", "cereal"], impact: 50, kcal: 220, alternative: "Avena en hojuelas sin azúcar" },
  { name: "Pan de yuca", aliases: ["pan de yuca"], impact: 44, kcal: 170, alternative: "Arepa asada con queso" },
  { name: "Chocoramo", aliases: ["chocoramo"], impact: 62, kcal: 300, alternative: "Banano pequeño con maní sin azúcar" },
];

const ACTIVITY_MET: Record<ActivityType, number> = { "Caminé": 4.5, "Troté": 8, "Corrí": 11.5 };
const SPEED_KMH: Record<ActivityType, number> = { "Caminé": 4.5, "Troté": 8, "Corrí": 11.5 };
const normalize = (value: string) => value.toLocaleLowerCase("es-CO").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const today = () => new Date().toISOString().slice(0, 10);

function findFoods(text: string) {
  const normalized = normalize(text);
  return FOOD_RULES.filter((food) => food.aliases.some((alias) => normalized.includes(normalize(alias))));
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function getConsecutiveDays(dates: string[]) {
  const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  if (!uniqueDates.length) return 0;
  const current = new Date(`${today()}T12:00:00`);
  const latest = new Date(`${uniqueDates[0]}T12:00:00`);
  const gap = Math.round((current.getTime() - latest.getTime()) / 86_400_000);
  if (gap > 1) return 0;
  let streak = 1;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T12:00:00`);
    const next = new Date(`${uniqueDates[index]}T12:00:00`);
    if (Math.round((previous.getTime() - next.getTime()) / 86_400_000) !== 1) break;
    streak += 1;
  }
  return streak;
}

function Section({ icon, title, children, defaultOpen = false }: { icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-2xl border border-[#e6e0d5] bg-white shadow-[0_8px_24px_rgba(35,91,66,0.07)]" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 font-semibold text-[#173c2c] [&::-webkit-details-marker]:hidden sm:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e9f0ea] text-[#235b42]">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#eee9df] px-4 pb-5 pt-5 sm:px-6">{children}</div>
    </details>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#33483b]">
      {label}
      <input {...props} className="h-11 rounded-xl border border-[#ded8cc] bg-[#fffdfa] px-3 text-[#1e293b] outline-none transition focus:border-[#3f7659] focus:ring-2 focus:ring-[#3f7659]/20" />
    </label>
  );
}

export default function RachaDiaria() {
  const { user } = useSupabaseAuth();
  const [breakfast, setBreakfast] = useState("");
  const [lunch, setLunch] = useState("");
  const [dinner, setDinner] = useState("");
  const [activity, setActivity] = useState<ActivityType>("Caminé");
  const [minutes, setMinutes] = useState(30);
  const [weather, setWeather] = useState<Weather>("Soleado");
  const [terrain, setTerrain] = useState<Terrain>("Plano");
  const [inclination, setInclination] = useState(0);
  const [morning, setMorning] = useState("");
  const [afternoon, setAfternoon] = useState("");
  const [night, setNight] = useState("");
  const [foodSearch, setFoodSearch] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [weightKg, setWeightKg] = useState(70);
  const [manualBpm, setManualBpm] = useState("");
  const [cameraBpm, setCameraBpm] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const [streak, setStreak] = useState(0);
  const [registeredDays, setRegisteredDays] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!stopwatchRunning) return undefined;
    const interval = window.setInterval(() => setStopwatchSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [stopwatchRunning]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraActive) return undefined;
    const canvas = cameraCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return undefined;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;
    const interval = window.setInterval(() => {
      if (video.readyState < 2) return;
      canvas.width = 48;
      canvas.height = 36;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const previous = previousFrameRef.current;
      if (previous) {
        let difference = 0;
        for (let index = 0; index < frame.length; index += 4) difference += Math.abs(frame[index] - previous[index]);
        const motion = difference / (frame.length / 4);
        setCameraBpm(Math.round(65 + Math.min(45, motion * 2.2)));
      }
      previousFrameRef.current = new Uint8ClampedArray(frame);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cameraActive]);

  const foods = useMemo(() => findFoods([breakfast, lunch, dinner].join(" ")), [breakfast, lunch, dinner]);
  const allMeals = [breakfast, lunch, dinner].filter(Boolean).join(", ");
  const detectedNames = foods.map((food) => food.name).join(", ");
  const selectedFood = useMemo(() => {
    const query = normalize(foodSearch.trim());
    if (!query) return null;
    return FOOD_RULES.find((food) => normalize(food.name).includes(query) || food.aliases.some((alias) => normalize(alias).includes(query))) ?? null;
  }, [foodSearch]);

  const calculation = useMemo(() => {
    const safeMinutes = Math.max(0, Number(minutes) || 0);
    let multiplier = 1;
    if (terrain === "Subida") multiplier += 0.2;
    if (weather === "Soleado") multiplier += 0.1;
    const kcal = ACTIVITY_MET[activity] * Math.max(1, Number(weightKg) || 70) * (safeMinutes / 60) * multiplier;
    const bpm = Math.round(Math.min(190, 92 + ACTIVITY_MET[activity] * 4 + (terrain === "Subida" ? 8 : 0) + (weather === "Soleado" ? 3 : 0)));
    const km = SPEED_KMH[activity] * (safeMinutes / 60);
    return { kcal: Math.round(kcal), bpm, km: Number(km.toFixed(1)) };
  }, [activity, minutes, terrain, weather, weightKg]);

  const stopwatchLabel = `${String(Math.floor(stopwatchSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((stopwatchSeconds % 3600) / 60)).padStart(2, "0")}:${String(stopwatchSeconds % 60).padStart(2, "0")}`;
  const clockLabel = clock.toLocaleTimeString("es-CO", { hour12: false });

  const toggleCamera = async () => {
    if (cameraActive) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      previousFrameRef.current = null;
      setCameraActive(false);
      setCameraBpm(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setFeedback({ type: "error", text: "Tu navegador no permite acceder a la cámara. Puedes usar BPM manual." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setFeedback({ type: "error", text: "No se pudo activar la cámara. Revisa el permiso o usa BPM manual." });
    }
  };

  const saveActivity = async (metrics = { stopwatchSeconds, cameraBpm }) => {
    if (!user) return;
    setSavingActivity(true);
    setFeedback(null);
    const { error } = await supabase.from("activity_logs").insert({
      user_id: user.id,
      activity_type: activity,
      met: ACTIVITY_MET[activity],
      weight_kg: Number(weightKg) || 70,
      duration_seconds: metrics.stopwatchSeconds || (Number(minutes) || 0) * 60,
      weather,
      terrain,
      inclination_percent: Number(inclination) || 0,
      kcal_burned: calculation.kcal,
      bpm_manual: manualBpm ? Number(manualBpm) : null,
      bpm_camera: metrics.cameraBpm,
      recorded_at: new Date().toISOString(),
    });
    setSavingActivity(false);
    setFeedback(error ? { type: "error", text: `No pudimos guardar la actividad: ${error.message}` } : { type: "success", text: "Actividad guardada en Supabase." });
  };

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      if (!user) return;
      setLoadingHistory(true);
      const { data, error } = await supabase.from("daily_logs").select("date, cumplimiento_racha").eq("user_id", user.id).order("date", { ascending: false });
      if (active && !error && data) {
        const dates = data.map((row) => String(row.date));
        setRegisteredDays(dates.length);
        setStreak(getConsecutiveDays(dates));
      }
      if (active) setLoadingHistory(false);
    }
    void loadHistory();
    return () => { active = false; };
  }, [user]);

  const summary = useMemo(() => {
    if (!allMeals && !calculation.kcal && !night) return "Completa alimentación y actividad para ver tu resumen";
    const meal = foods[0]?.name ?? (allMeals ? "tus alimentos" : "tu alimentación");
    const action = calculation.kcal > 0 ? `${activity.toLowerCase()} y quemaste ${formatNumber(calculation.kcal)} kcal` : "tu actividad";
    const glucose = night ? `Tu glucómetro de la noche marcó ${night} mg/dL.` : "Aún no registras la glucosa de la noche.";
    return `${user?.user_metadata?.nombre || "Omar"}, hoy comiste ${meal}${foods.length ? " que subió tu glucosa" : ""}, pero compensaste con ${action}. ${glucose} Vas por buen camino.`;
  }, [allMeals, calculation.kcal, activity, foods, night, user]);

  const saveDay = async () => {
    if (!user) return;
    setSaving(true);
    setFeedback(null);
    const payload = {
      user_id: user.id,
      date: today(),
      desayuno: breakfast || null,
      almuerzo: lunch || null,
      cena: dinner || null,
      alimentos_detectados: detectedNames || null,
      glucosa_manana: morning ? Number(morning) : null,
      glucosa_tarde: afternoon ? Number(afternoon) : null,
      glucosa_noche: night ? Number(night) : null,
      actividad_tipo: activity,
      actividad_tiempo: Number(minutes) || 0,
      actividad_clima: weather,
      actividad_terreno: terrain,
      actividad_inclinacion: Number(inclination) || 0,
      kcal_calculadas: calculation.kcal,
      bpm_estimado: calculation.bpm,
      km_estimado: calculation.km,
      cumplimiento_racha: Math.round((Number(Boolean(allMeals)) + Number(calculation.kcal > 0) + Number(Boolean(morning || afternoon || night))) / 3 * 100),
    };
    const { error } = await supabase.from("daily_logs").upsert(payload, { onConflict: "user_id,date" });
    setSaving(false);
    if (error) {
      setFeedback({ type: "error", text: `No pudimos guardar tu día: ${error.message}` });
      return;
    }
    setFeedback({ type: "success", text: "Tu día quedó guardado. ¡Cada registro cuenta para tu racha!" });
    setRegisteredDays((value) => value + 1);
    setStreak((value) => Math.max(1, value + (value === 0 ? 0 : 1)));
  };

  const completion = Math.round((Number(Boolean(allMeals)) + Number(calculation.kcal > 0) + Number(Boolean(morning || afternoon || night))) / 3 * 100);

  return (
    <main className="min-h-screen bg-[#fdfaf5] px-4 py-6 text-[#1e293b] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-[#235b42] p-6 text-white shadow-[0_14px_32px_rgba(35,91,66,0.2)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-[#d9eadc]">Ruta Clara · seguimiento diario</p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Mi racha diaria</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#e9f0ea]">Registra tus decisiones de hoy y encuentra pequeñas acciones para cuidar tu bienestar.</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 text-center backdrop-blur">
              <Flame className="mx-auto size-6 text-[#f6c76b]" />
              <strong className="mt-1 block text-2xl">{loadingHistory ? "—" : streak}</strong>
              <span className="text-xs text-[#d9eadc]">días</span>
            </div>
          </div>
        </header>

        <div className="space-y-3">
          <Section icon={<Utensils className="size-5" />} title="Planes de Alimentación Inteligente" defaultOpen>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Desayuno" placeholder="Ej. arepa y huevo" value={breakfast} onChange={(event) => setBreakfast(event.target.value)} />
              <Field label="Almuerzo" placeholder="Ej. pollo y ensalada" value={lunch} onChange={(event) => setLunch(event.target.value)} />
              <Field label="Cena" placeholder="Ej. sopa de verduras" value={dinner} onChange={(event) => setDinner(event.target.value)} />
            </div>
            {foods.length > 0 && <div className="mt-4 space-y-2">{foods.map((food) => <div key={food.name} className="rounded-xl border border-[#e8a19a] bg-[#fff0ee] p-3 text-sm text-[#8d332c]"><strong>⚠️ Alerta: sube tu glucosa +{food.impact} a +{food.impact + 20} mg/dl.</strong> Recomendado: {food.alternative}.</div>)}</div>}
          </Section>

          <Section icon={<Activity className="size-5" />} title="Actividad Física Calculadora Real">
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-2">{(["Caminé", "Troté", "Corrí"] as ActivityType[]).map((value) => <button key={value} type="button" onClick={() => setActivity(value)} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${activity === value ? "bg-[#235b42] text-white" : "bg-[#eef3ed] text-[#235b42] hover:bg-[#dbe8dc]"}`}>{value}</button>)}</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tiempo (min)" type="number" min="0" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
                <label className="grid gap-1.5 text-sm font-medium text-[#33483b]">Clima<select value={weather} onChange={(event) => setWeather(event.target.value as Weather)} className="h-11 rounded-xl border border-[#ded8cc] bg-[#fffdfa] px-3 outline-none focus:border-[#3f7659]">{(["Soleado", "Nublado", "Lluvioso", "Frío"] as Weather[]).map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className="grid gap-1.5 text-sm font-medium text-[#33483b]">Terreno<select value={terrain} onChange={(event) => setTerrain(event.target.value as Terrain)} className="h-11 rounded-xl border border-[#ded8cc] bg-[#fffdfa] px-3 outline-none focus:border-[#3f7659]">{(["Plano", "Destapado", "Subida"] as Terrain[]).map((value) => <option key={value}>{value}</option>)}</select></label>
                <Field label={`Inclinación (${inclination}%)`} type="range" min="0" max="15" value={inclination} onChange={(event) => setInclination(Number(event.target.value))} className="h-11 accent-[#235b42]" />
              </div>
              <Activity activity={activity} met={ACTIVITY_MET[activity]} weightKg={weightKg} minutes={minutes} kcal={calculation.kcal} manualBpm={manualBpm} onWeightChange={setWeightKg} onManualBpmChange={setManualBpm} onSave={(metrics) => void saveActivity(metrics)} saving={savingActivity} userReady={Boolean(user)} feedback={feedback?.type === "error" ? feedback.text : undefined} />
            </div>
          </Section>

          <Section icon={<HeartPulse className="size-5" />} title="Monitoreo Glucómetro + ¿Qué voy a comer?">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Glucosa Mañana (mg/dL)" type="number" min="0" value={morning} onChange={(event) => setMorning(event.target.value)} />
              <Field label="Glucosa Tarde (mg/dL)" type="number" min="0" value={afternoon} onChange={(event) => setAfternoon(event.target.value)} />
              <Field label="Glucosa Noche (mg/dL)" type="number" min="0" value={night} onChange={(event) => setNight(event.target.value)} />
            </div>
            <label className="relative mt-4 block"><Search className="absolute left-3 top-3 size-5 text-[#697267]" /><input value={foodSearch} onChange={(event) => setFoodSearch(event.target.value)} placeholder="Busca un alimento colombiano…" className="h-11 w-full rounded-xl border border-[#ded8cc] bg-[#fffdfa] pl-10 pr-3 outline-none focus:border-[#3f7659]" /></label>
            {selectedFood && <div className="mt-3 grid gap-3 rounded-xl border border-[#e6e0d5] bg-[#fffdfa] p-4 text-sm sm:grid-cols-3"><p><strong>Daño:</strong><br />Puede subir aproximadamente +{selectedFood.impact} mg/dL.</p><p><strong>Kcal:</strong><br />{selectedFood.kcal} por porción.</p><p><strong>Alternativa:</strong><br />{selectedFood.alternative}.</p></div>}
          </Section>

          <Section icon={<Sparkles className="size-5" />} title="Interpretación de Resultados - Resumen Inteligente"><div className="rounded-2xl bg-[#fff8e8] p-4 leading-7 text-[#5b4b2d]"><Sparkles className="mb-2 size-5 text-[#c58a22]" />{summary}</div></Section>

          <Section icon={<AlertTriangle className="size-5" />} title="Prevención"><div className="flex gap-3 rounded-2xl border border-[#f0d38c] bg-[#fff3d9] p-4 text-sm leading-6 text-[#73591d]"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>{registeredDays === 0 || registeredDays < 2 ? "Llevas 2 días sin registrar, ¿todo bien? Retoma hoy para no perder tu racha" : "Vas al día con tus registros. Mantén este ritmo para cuidar tu racha."}</p></div></Section>

          <Section icon={<Flame className="size-5" />} title="Apoyo Emocional + Racha"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-3xl font-bold text-[#235b42]">{streak} días consecutivos</p><p className="mt-1 text-sm text-[#697267]">Cumplimiento de hoy: {completion}%</p></div><p className="max-w-sm text-sm leading-6 text-[#33483b]">{completion > 80 ? "¡Increíble, Omar!" : completion < 50 ? "No pasa nada, mañana es un nuevo día. Lo importante es volver" : "Vas avanzando. Cada elección saludable suma."}</p></div></Section>
        </div>

        {feedback && <div role="status" className={`rounded-xl p-4 text-sm ${feedback.type === "success" ? "bg-[#e9f0ea] text-[#235b42]" : "bg-[#fff0ee] text-[#8d332c]"}`}>{feedback.text}</div>}
        <button type="button" disabled={saving || !user} onClick={() => void saveDay()} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#235b42] px-5 py-3.5 text-base font-bold text-white shadow-[0_10px_20px_rgba(35,91,66,0.2)] transition hover:bg-[#173c2c] disabled:cursor-not-allowed disabled:opacity-60">{saving ? <Loader2 className="size-5 animate-spin" /> : <Lightbulb className="size-5" />} {saving ? "Guardando…" : "Guardar mi día"}</button>
        <p className="flex items-center justify-center gap-2 pb-4 text-center text-xs text-[#697267]"><MapPin className="size-3.5" />Tus datos se guardan de forma privada en tu cuenta.</p>
      </div>
    </main>
  );
}
