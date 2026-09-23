import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  ClipboardList,
  Clock3,
  Compass,
  Download,
  ExternalLink,
  FileText,
  History,
  Home as HomeIcon,
  Info,
  LockKeyhole,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useRutaCloudState } from "@/hooks/useRutaCloudState";
import type { ConsultData, Measurement } from "@/types/ruta";

const CLARA_IMAGE = "/manus-storage/clara-oficial-ruta-clara_9dc2a8ad.png";
const BRAND_MARK = "/manus-storage/ruta-clara-mark_a36fc144.png";

const navItems = [
  { id: "inicio", label: "Inicio", icon: HomeIcon },
  { id: "orientador", label: "Mi ruta", icon: Compass },
  { id: "consulta", label: "Consulta", icon: ClipboardList },
  { id: "plan", label: "Mi plan", icon: CalendarDays },
  { id: "ayuda", label: "Ayuda", icon: CircleHelp },
];

const progressItems = [
  { id: "route", label: "Encontré mi ruta" },
  { id: "context", label: "Organicé el contexto" },
  { id: "questions", label: "Preparé mis preguntas" },
  { id: "summary", label: "Generé mi resumen" },
  { id: "resource", label: "Identifiqué dónde pedir ayuda" },
  { id: "habit", label: "Elegí una acción pequeña" },
];

type PillarTask = {
  id: string;
  label: string;
  target: string;
  save?: boolean;
  copyScript?: boolean;
};

type Pillar = {
  icon: React.ComponentType<{ size?: string | number }>;
  title: string;
  copy: string;
  tasks: PillarTask[];
};

const pillars: Pillar[] = [
  {
    icon: ClipboardList,
    title: "Planes de alimentación",
    copy: "Registra patrones, comidas y dudas para aprender de tu contexto y llevar preguntas claras a un profesional. No prescribe dietas.",
    tasks: [
      { id: "food-log", label: "Registrar lo que comí hoy", target: "contexto" },
      { id: "food-questions", label: "Dudas para preguntar en consulta", target: "consulta" },
      { id: "food-meals", label: "No saltarme comidas", target: "plan" },
    ],
  },
  {
    icon: Activity,
    title: "Actividad física",
    copy: "Anota el movimiento que realizas y cómo te sientes para elegir acciones generales, progresivas y seguras para ti.",
    tasks: [
      { id: "movement-break", label: "Interrumpir tiempo sentado", target: "plan" },
      { id: "progressive-walk", label: "Caminar progresivo", target: "plan" },
      { id: "movement-feeling", label: "Cómo me sentí al moverme", target: "contexto" },
    ],
  },
  {
    icon: History,
    title: "Monitoreo constante con glucómetro",
    copy: "Guarda lecturas, unidad, fecha, hora y contexto del glucómetro sin convertir un número aislado en un diagnóstico.",
    tasks: [
      { id: "meter-value", label: "Registrar valor, unidad y hora", target: "contexto" },
      { id: "meter-moment", label: "En qué momento fue", target: "contexto" },
      { id: "meter-save", label: "Guardar en mi cuenta", target: "contexto", save: true },
    ],
  },
  {
    icon: Info,
    title: "Interpretación de resultados",
    copy: "Organiza qué significa cada dato para tu conversación. La interpretación clínica corresponde a un profesional de salud.",
    tasks: [
      { id: "number-context", label: "Un número necesita contexto", target: "contexto" },
      { id: "action-barrier", label: "Qué hace difícil actuar", target: "orientador" },
      { id: "professional-questions", label: "Qué preguntar al profesional", target: "consulta" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Prevención de complicaciones",
    copy: "Aprende a registrar señales, dudas y factores de seguimiento para actuar a tiempo y buscar orientación cuando corresponda.",
    tasks: [
      { id: "warning-signs", label: "Señales de alerta", target: "comparador" },
      { id: "follow-up", label: "Factores de seguimiento", target: "contexto" },
      { id: "when-to-ask", label: "Cuándo buscar orientación", target: "consulta" },
    ],
  },
  {
    icon: MessageCircle,
    title: "Apoyo emocional",
    copy: "Identifica miedos y barreras, prepara un guion y encuentra una forma más acompañada de pedir ayuda sin juicios.",
    tasks: [
      { id: "hard-conversation", label: "Guion conversación difícil", target: "consulta" },
      { id: "choose-barrier", label: "Elige una barrera", target: "orientador" },
      { id: "copy-script", label: "Copiar guion", target: "consulta", copyScript: true },
    ],
  },
];

const pillarTaskMap = Object.fromEntries(
  pillars.map((pillar) => [pillar.title, pillar.tasks.map((task) => task.id)]),
);

const habits = [
  {
    id: "bebida",
    title: "Cambiar una bebida azucarada",
    minimum: "Elegir agua en una ocasión del día",
    note: "Una decisión pequeña, sin convertirla en una dieta rígida.",
  },
  {
    id: "movimiento",
    title: "Interrumpir tiempo prolongado sentado",
    minimum: "Levantarme y moverme durante dos minutos",
    note: "Solo si es seguro para ti y sin buscar una meta clínica.",
  },
  {
    id: "caminar",
    title: "Caminar de forma progresiva",
    minimum: "Caminar cinco minutos a un ritmo cómodo",
    note: "No es una prescripción. Detente si te sientes mal.",
  },
  {
    id: "sueno",
    title: "Cuidar una parte de mi rutina de sueño",
    minimum: "Prepararme para dormir diez minutos antes",
    note: "El objetivo es crear una señal simple y repetible.",
  },
  {
    id: "consulta",
    title: "Preparar una pregunta para mi consulta",
    minimum: "Escribir una sola pregunta",
    note: "La claridad también es una acción de salud.",
  },
];

const barriers: Record<string, { label: string; script: string; questions: string[] }> = {
  miedo: {
    label: "Me da miedo confirmar algo grave",
    script:
      "Quiero conversar sobre un posible riesgo de diabetes. He postergado esta conversación porque me da miedo lo que pueda significar. ¿Podría explicarme qué evaluación considera adecuada y qué información necesita de mí?",
    questions: [
      "¿Qué evaluación considera adecuada en mi caso?",
      "¿Qué datos necesito traer la próxima vez?",
      "¿Cuándo debería volver o buscar atención prioritaria?",
    ],
  },
  verguenza: {
    label: "Me da vergüenza hablar de mi peso o hábitos",
    script:
      "Quiero hablar de mi riesgo sin sentirme juzgado por mi peso o mis hábitos. Me ayudaría recibir una explicación clara y acordar un primer paso realista.",
    questions: [
      "¿Podemos enfocarnos en un cambio pequeño y seguro?",
      "¿Qué información es más importante para evaluar mi situación?",
      "¿Qué opciones de apoyo existen en mi contexto?",
    ],
  },
  experiencia: {
    label: "Tuve una mala experiencia médica",
    script:
      "Tuve una experiencia anterior que me hizo sentir intimidado. Quiero recibir ayuda, pero necesito que me expliquen cada paso y que podamos conversar sin juicios.",
    questions: [
      "¿Puede explicarme por qué recomienda cada evaluación?",
      "¿Qué alternativas tengo si algo me resulta difícil?",
      "¿Cómo puedo preparar mejor el seguimiento?",
    ],
  },
  prueba: {
    label: "No sé cómo pedir una evaluación",
    script:
      "Tengo antecedentes o información que me preocupa y quiero saber si corresponde una evaluación. No busco autodiagnosticarme. ¿Qué información necesita para decidir el siguiente paso?",
    questions: [
      "¿Qué evaluación considera adecuada?",
      "¿Necesito alguna preparación antes de una prueba?",
      "¿Cómo y cuándo revisaremos los resultados?",
    ],
  },
  tiempo: {
    label: "Tengo poco tiempo para explicarlo",
    script:
      "Preparé este resumen para usar bien el tiempo de la consulta. Mi preocupación principal es la siguiente y estas son las preguntas que necesito resolver hoy.",
    questions: [
      "¿Cuál es la decisión más importante que debemos tomar hoy?",
      "¿Qué debo registrar antes de la siguiente consulta?",
      "¿Dónde puedo obtener información confiable?",
    ],
  },
  acceso: {
    label: "No sé dónde empezar",
    script:
      "Quiero solicitar orientación sobre un posible riesgo de diabetes. ¿Esta es la puerta de entrada correcta o puede indicarme qué servicio debo buscar?",
    questions: [
      "¿Qué tipo de profesional o servicio debo buscar primero?",
      "¿Qué información debo llevar?",
      "¿Qué hago si no consigo una cita pronto?",
    ],
  },
};

const countryResources = {
  mexico: {
    label: "México",
    items: [
      {
        name: "Secretaría de Salud",
        description: "Información y rutas públicas de salud.",
        url: "https://www.gob.mx/salud",
      },
      {
        name: "Federación Mexicana de Diabetes",
        description: "Educación y orientación sobre diabetes.",
        url: "https://fmdiabetes.org/",
      },
      {
        name: "COFEPRIS",
        description: "Alertas sobre productos y publicidad engañosa.",
        url: "https://www.gob.mx/cofepris/",
      },
    ],
  },
  colombia: {
    label: "Colombia",
    items: [
      {
        name: "Ministerio de Salud",
        description: "Información oficial y acceso al sistema de salud.",
        url: "https://www.minsalud.gov.co/",
      },
      {
        name: "INVIMA",
        description: "Alertas sanitarias y consulta de productos.",
        url: "https://www.invima.gov.co/",
      },
      {
        name: "Línea nacional de emergencias",
        description: "Ante una urgencia, llama al 123 en Colombia.",
        url: "https://www.policia.gov.co/linea-123-emergencia",
      },
    ],
  },
  argentina: {
    label: "Argentina",
    items: [
      {
        name: "Ministerio de Salud",
        description: "Información oficial y programas de salud.",
        url: "https://www.argentina.gob.ar/salud",
      },
      {
        name: "Sociedad Argentina de Diabetes",
        description: "Educación y recursos especializados.",
        url: "https://diabetes.org.ar/",
      },
      {
        name: "Emergencias",
        description: "Ante una urgencia, usa la línea local 107 o 911.",
        url: "https://www.argentina.gob.ar/tema/emergencias",
      },
    ],
  },
};

const troubleItems = [
  {
    title: "Me da miedo que la consulta confirme algo grave",
    body: "El miedo puede hacer que postergues la conversación. Empieza con un resumen breve y di en voz alta que tienes miedo. La app puede ayudarte a ordenar la información, pero solo un profesional puede evaluar tu situación.",
    action: "Generar mi guion de consulta",
    target: "consulta",
  },
  {
    title: "No tengo síntomas y pienso que no necesito preguntar",
    body: "La prediabetes puede no presentar síntomas claros. No uses la ausencia de síntomas como garantía. Si tienes factores de riesgo o una duda, organiza la información y conversa con un profesional.",
    action: "Revisar mi ruta",
    target: "orientador",
  },
  {
    title: "Solo tengo una medición y no sé si fue en ayunas",
    body: "Un número aislado necesita contexto. Registra la fuente, la hora, la unidad y lo que sí sabes. No intentes completar lo que no recuerdas. Llévalo como pregunta, no como diagnóstico.",
    action: "Contextualizar medición",
    target: "contexto",
  },
  {
    title: "Un video dice que puedo revertirlo sin medicamentos",
    body: "Desconfía de promesas de cura, reversión garantizada o abandono de medicamentos. No ajustes ni suspendas un tratamiento por contenido en redes. Verifica la fuente y consulta a un profesional.",
    action: "Comparar caminos seguros",
    target: "comparador",
  },
  {
    title: "Compré un suplemento que promete bajar la glucosa",
    body: "Los suplementos pueden interactuar con medicamentos y no sustituyen una evaluación. Registra el nombre y la dosis declarada para hablar con un profesional. No aumentes ni suspendas nada por tu cuenta.",
    action: "Añadirlo a mi resumen",
    target: "consulta",
  },
  {
    title: "Empecé un plan extremo y me siento peor",
    body: "Detén el recorrido de la app y busca orientación profesional. Si hay deterioro rápido, vómitos persistentes, confusión, desmayo, respiración anormal, deshidratación importante o dolor torácico, busca atención urgente local.",
    action: "Ver salida urgente",
    target: "urgente",
  },
];

type RouteType = "organize" | "consult" | "priority" | "urgent";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function launchPillarConfetti() {
  const canvas = document.createElement("canvas");
  canvas.className = "pillar-confetti";
  document.body.appendChild(canvas);
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * ratio;
  canvas.height = window.innerHeight * ratio;
  context.scale(ratio, ratio);
  const colors = ["#2e8b57", "#25d366", "#dda640", "#f4b183", "#7ab68c"];
  const pieces = Array.from({ length: 120 }, (_, index) => ({
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.2,
    vx: (Math.random() - 0.5) * 12,
    vy: Math.random() * -10 - 3,
    size: Math.random() * 7 + 4,
    color: colors[index % colors.length],
    rotation: Math.random() * Math.PI,
  }));
  let frame = 0;
  const animate = () => {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    pieces.forEach((piece) => {
      piece.x += piece.vx;
      piece.vy += 0.25;
      piece.y += piece.vy;
      piece.rotation += 0.08;
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.65);
      context.restore();
    });
    frame += 1;
    if (frame < 150) requestAnimationFrame(animate);
    else canvas.remove();
  };
  requestAnimationFrame(animate);
}
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.45, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="section-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  copy,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  copy?: string;
  icon?: React.ComponentType<{ className?: string; size?: string | number }>;
}) {
  return (
    <button className={`choice-card ${active ? "active" : ""}`} onClick={onClick} type="button">
      <span className="choice-indicator">{active ? <Check size={15} /> : Icon ? <Icon size={17} /> : null}</span>
      <span>
        <strong>{title}</strong>
        {copy ? <small>{copy}</small> : null}
      </span>
    </button>
  );
}

function Home() {
  const { user, signOut, deleteAccount } = useSupabaseAuth();
  if (!user) throw new Error("Se requiere una sesión autenticada");
  const cloud = useRutaCloudState(user, pillarTaskMap);
  const [activeSection, setActiveSection] = useState("inicio");
  const [accountOpen, setAccountOpen] = useState(false);
  const {
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
    loading: cloudLoading,
    syncState,
    completedTasks,
    points,
    level,
    streak,
    pillarLoading,
    pillarSaving,
    togglePillarTask: toggleTask,
    resetPillarProgress: resetProgress,
    newSession,
    resumeSession,
  } = cloud;
  const [openTrouble, setOpenTrouble] = useState<number | null>(0);
  const [openPillar, setOpenPillar] = useState<number | null>(null);
  const previousCompletedCount = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (completedTasks.length === 18 && previousCompletedCount.current < 18) launchPillarConfetti();
    previousCompletedCount.current = completedTasks.length;
  }, [completedTasks.length]);

  const handlePillarTask = async (pillar: Pillar, task: PillarTask) => {
    scrollToId(task.target);
    try {
      await toggleTask(pillar.title, task.id);
      if (task.save) toast.success("Tu avance del pilar quedó guardado en Supabase.");
      if (task.copyScript) {
        const script = "Quiero conversar sobre lo que he notado y saber cuál es el siguiente paso adecuado para mí.";
        void navigator.clipboard?.writeText(script);
        toast.success("Guion copiado. Puedes llevarlo a tu consulta.");
      }
    } catch {
      toast.error("No pudimos guardar esta tarea. Inténtalo nuevamente.");
    }
  };

  const completedPillars = pillars.filter((pillar) =>
    pillar.tasks.every((task) => completedTasks.includes(task.id)),
  ).length;
  const pillarTaskCount = pillars.length * 3;
  const pillarProgressPercent = Math.round((completedTasks.length / pillarTaskCount) * 100);
  const resetPillarProgress = async () => {
    if (!window.confirm("¿Deseas reiniciar las 18 tareas de tu ruta?")) return;
    try {
      await resetProgress();
      toast.success("Tu ruta de pilares fue reiniciada en Supabase.");
    } catch {
      toast.error("No pudimos reiniciar tu ruta.");
    }
  };

  const route: RouteType | null = useMemo(() => {
    if (!situation) return null;
    if (situation === "urgent") return "urgent";
    if (situation === "changes") return "priority";
    if (situation === "measurement" || situation === "delay") return "consult";
    return "organize";
  }, [situation]);

  const routeReady = Boolean(route && barrier);

  const routeContent = useMemo(() => {
    const content = {
      organize: {
        label: "Ruta 1",
        title: "Organiza y observa con contexto",
        copy: "No necesitas esperar a sentirte mal para preguntar. Reúne antecedentes, registra lo que sabes y prepara una conversación sin convertirlo en diagnóstico.",
        action: "Organizar mi contexto",
        target: "contexto",
        icon: BookOpen,
      },
      consult: {
        label: "Ruta 2",
        title: "Prepara una conversación profesional",
        copy: "Tienes una duda concreta. Tu siguiente paso es organizar el dato, identificar qué falta y llevar preguntas claras a un profesional.",
        action: "Preparar mi consulta",
        target: "consulta",
        icon: MessageCircle,
      },
      priority: {
        label: "Ruta 3",
        title: "Busca una evaluación prioritaria",
        copy: "Has notado cambios que merecen atención. La app no puede explicar la causa. Organiza la información y contacta un servicio de salud sin seguir postergándolo.",
        action: "Crear resumen ahora",
        target: "consulta",
        icon: Stethoscope,
      },
      urgent: {
        label: "Salida de seguridad",
        title: "Busca atención urgente local",
        copy: "Si hay deterioro rápido, vómitos persistentes, confusión, desmayo, respiración anormal, deshidratación importante o dolor torácico, no continúes el cuestionario. Busca atención urgente local.",
        action: "Ver recursos por país",
        target: "recursos",
        icon: AlertTriangle,
      },
    };
    return route ? content[route] : null;
  }, [route]);

  const contextFields = [measurement.timing, measurement.source, measurement.date, measurement.reviewed];
  const contextComplete = contextFields.filter(Boolean).length;
  const contextPercent = Math.round((contextComplete / contextFields.length) * 100);
  const missingContext = [
    !measurement.timing && "momento de la medición",
    !measurement.source && "origen del resultado",
    !measurement.date && "fecha",
    !measurement.reviewed && "si un profesional ya lo revisó",
  ].filter(Boolean) as string[];

  const selectedBarrier = barrier ? barriers[barrier] : null;
  const selectedHabit = habits.find((item) => item.id === habit);
  const completedCount = progressItems.filter((item) => progress[item.id]).length;
  const completionPercent = Math.round((completedCount / progressItems.length) * 100);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: [0.1, 0.3, 0.6] },
    );

    navItems.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (routeReady) {
      setProgress((current) => ({ ...current, route: true }));
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
    }
  }, [routeReady, setProgress]);

  useEffect(() => {
    if (contextComplete >= 2) setProgress((current) => ({ ...current, context: true }));
  }, [contextComplete, setProgress]);

  useEffect(() => {
    if (barrier) setProgress((current) => ({ ...current, questions: true }));
  }, [barrier, setProgress]);

  useEffect(() => {
    if (habit && days.length) setProgress((current) => ({ ...current, habit: true }));
  }, [habit, days.length, setProgress]);

  function toggleDay(day: string) {
    setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  function buildSummaryText() {
    const measurementLine = measurement.value
      ? `Medición registrada: ${measurement.value} ${measurement.unit}. Momento: ${measurement.timing || "no indicado"}. Origen: ${measurement.source || "no indicado"}. Fecha: ${measurement.date || "no indicada"}. Revisada por profesional: ${measurement.reviewed || "no indicado"}.`
      : "No registré una medición.";
    return `RUTA CLARA DE CASI40TECH\nResumen para mi consulta\n\nMotivo principal: ${consult.reason || "No indicado"}\nQué he notado: ${consult.signs || "No indicado"}\nDesde cuándo: ${consult.duration || "No indicado"}\nAntecedentes familiares: ${consult.family || "No indicado"}\nMedicamentos y suplementos declarados: ${consult.medicines || "No indicado"}\nQué me preocupa: ${consult.worry || selectedBarrier?.label || "No indicado"}\n\n${measurementLine}\n\nPreguntas sugeridas:\n${(selectedBarrier?.questions || barriers.prueba.questions).map((question, index) => `${index + 1}. ${question}`).join("\n")}\n\nEste resumen organiza información aportada por el usuario. No es un diagnóstico ni una interpretación clínica.`;
  }

  function downloadSummary() {
    const blob = new Blob([buildSummaryText()], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mi-resumen-ruta-clara.txt";
    link.click();
    URL.revokeObjectURL(link.href);
    setProgress((current) => ({ ...current, summary: true }));
    toast.success("Resumen descargado en tu dispositivo");
  }

  function printSummary() {
    setProgress((current) => ({ ...current, summary: true }));
    window.print();
  }

  async function copyScript() {
    if (!selectedBarrier) return;
    await navigator.clipboard.writeText(selectedBarrier.script);
    toast.success("Guion copiado");
  }

  async function clearData() {
    const accepted = window.confirm("Esta acción eliminará de forma permanente tu cuenta, sesiones, mediciones y planes en Supabase. No se puede deshacer. ¿Deseas continuar?");
    if (!accepted) return;
    try {
      await deleteAccount();
      toast.success("Tu cuenta y todos tus datos fueron eliminados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos borrar tus datos.");
    }
  }

  if (cloudLoading || pillarLoading) {
    return <main className="auth-loading"><img src={BRAND_MARK} alt="" /><strong>Ruta Clara</strong><span>Cargando tu avance desde Supabase…</span></main>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => scrollToId("inicio")} type="button" aria-label="Ir al inicio">
            <img src={BRAND_MARK} alt="" />
            <span>
              <strong>Ruta Clara</strong>
              <small>de Casi40Tech</small>
            </span>
          </button>
          <nav className="desktop-nav" aria-label="Navegación principal">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={activeSection === item.id ? "active" : ""}
                onClick={() => scrollToId(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="account-menu-wrap">
            <button className={`sync-chip ${syncState}`} type="button" onClick={() => toast.info(syncState === "saved" ? "Tu avance está guardado en Supabase." : syncState === "saving" ? "Guardando cambios…" : "Tus datos están protegidos por tu cuenta.")}>
              {syncState === "saving" ? <RefreshCw className="spin" size={14} /> : <LockKeyhole size={14} />}
              <span>{syncState === "saving" ? "Guardando" : syncState === "error" ? "Reintentar" : "Guardado"}</span>
            </button>
            <button className="account-trigger" type="button" onClick={() => setAccountOpen((current) => !current)} aria-expanded={accountOpen}>
              <UserRound size={16} />
              <span>{user.user_metadata?.nombre || user.user_metadata?.full_name || user.email?.split("@")[0] || "Mi cuenta"}</span>
              <ChevronDown size={14} />
            </button>
            {accountOpen ? (
              <div className="account-popover">
                <strong>{user.user_metadata?.nombre || user.user_metadata?.full_name || "Mi cuenta"}</strong>
                <small>{user.email}</small>
                <button type="button" onClick={() => void signOut()}><LogOut size={15} /> Cerrar sesión</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section" id="inicio">
          <div className="hero-copy">
            <FadeIn>
              <span className="trust-badge"><ShieldCheck size={15} /> Educación, no diagnóstico</span>
              <h1>Convierte la preocupación en un <em>siguiente paso claro.</em></h1>
              <p className="hero-lead">
                Organiza lo que sabes, prepara una conversación profesional y elige una acción segura. Sin culpa. Sin promesas milagrosas.
              </p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => scrollToId("orientador")} type="button">
                  Encontrar mi ruta <ArrowRight size={18} />
                </button>
                <span><Clock3 size={16} /> 12 a 18 minutos</span>
              </div>
              <div className="hero-proof">
                <span><CheckCircle2 size={16} /> No interpreta resultados</span>
                <span><CheckCircle2 size={16} /> No recomienda medicamentos</span>
                <span><CheckCircle2 size={16} /> Guarda tu avance en tu cuenta</span>
              </div>
            </FadeIn>
          </div>
          <FadeIn delay={0.1}>
            <div className="hero-visual">
              <img src={CLARA_IMAGE} alt="Clara, guía cercana de Ruta Clara de Casi40Tech" />
              <div className="floating-card">
                <span className="floating-icon"><MessageCircle size={20} /></span>
                <span><strong>Hola, soy Clara</strong><small>Te acompaño a ordenar lo que sientes y dar un siguiente paso</small></span>
              </div>
            </div>
          </FadeIn>
        </section>

        <section className="progress-panel" aria-label="Tu progreso">
          <div className="progress-topline">
            <div>
              <span className="eyebrow">Tu avance</span>
              <strong>{completedCount} de {progressItems.length} pasos preparados</strong>
            </div>
            <span className="progress-percent">{completionPercent}%</span>
          </div>
          <div className="progress-track"><span style={{ width: `${completionPercent}%` }} /></div>
          <div className="progress-pills">
            {progressItems.map((item, index) => (
              <button
                key={item.id}
                className={progress[item.id] ? "done" : ""}
                type="button"
                onClick={() => {
                  const targets = ["orientador", "contexto", "consulta", "consulta", "recursos", "plan"];
                  scrollToId(targets[index]);
                }}
              >
                {progress[item.id] ? <Check size={13} /> : <span>{index + 1}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="content-section pillars-section" id="pilares">
          <FadeIn>
            <SectionHeading
              eyebrow="Herramientas de Ruta Clara"
              title="Seis pilares para registrar y aprender."
              copy="Usa cada pilar para organizar información, reconocer preguntas y preparar una conversación profesional. Ruta Clara educa y registra; no diagnostica ni prescribe."
            />
          </FadeIn>
          <div className="pillar-global-progress" aria-label={`Tu avance: ${completedTasks.length} de 18 tareas`}>
            <div className="pillar-global-progress-topline">
              <strong>Tu avance: {completedTasks.length}/18 tareas</strong>
              <span>{pillarProgressPercent}%</span>
            </div>
            <div className="pillar-global-track"><span style={{ width: `${pillarProgressPercent}%` }} /></div>
          </div>
          <div className="pillar-gamification" aria-label="Tu progreso de gamificación">
            <div><span className="eyebrow">Puntos Ruta Clara</span><strong>{points} pts</strong><small>50 por tarea · 100 por pilar completo</small></div>
            <div><span className="eyebrow">Nivel</span><strong>{level}</strong><small>Explora, avanza y gana claridad</small></div>
            <div><span className="eyebrow">Racha diaria</span><strong>{streak} {streak === 1 ? "día" : "días"}</strong><small>Registra al menos una tarea al día</small></div>
          </div>
          {completedPillars === pillars.length ? (
            <div className="pillar-complete-banner" role="status">🎉 ¡Ruta completada! Ya exploraste tus 6 pilares y 18 tareas.</div>
          ) : null}
          <div className="pillars-grid">
            {pillars.map((pillar, pillarIndex) => {
              const Icon = pillar.icon;
              const completed = pillar.tasks.filter((task) => completedTasks.includes(task.id)).length;
              const isOpen = openPillar === pillarIndex;
              return (
                <article className={`pillar-card ${isOpen ? "is-open" : ""}`} key={pillar.title}>
                  <button
                    className="pillar-card-trigger"
                    type="button"
                    onClick={() => setOpenPillar(isOpen ? null : pillarIndex)}
                    aria-expanded={isOpen}
                  >
                    <span className="pillar-icon"><Icon size={20} /></span>
                    <span className="pillar-card-copy">
                      <span className="pillar-card-heading">
                        <h3>{pillar.title}</h3>
                        {completed === 3 ? <b className="pillar-done">✓ Completado</b> : null}
                      </span>
                      <p>{pillar.copy}</p>
                    </span>
                    <ChevronDown className={`pillar-chevron ${isOpen ? "rotated" : ""}`} size={18} />
                  </button>
                  <div className="pillar-progress" aria-label={`${completed} de 3 tareas completadas`}>
                    <span>{completed}/3 tareas</span><i><b style={{ width: `${(completed / 3) * 100}%` }} /></i>
                  </div>
                  {isOpen ? (
                    <div className="pillar-tasks">
                      {pillar.tasks.map((task, taskIndex) => {
                        const done = completedTasks.includes(task.id);
                        const taskIcons = ["📝", "💬", "✓"];
                        const taskHelp = ["Te toma 30 seg", "Anótalo para tu consulta", "Hazlo a tu ritmo"];
                        return (
                          <button
                            key={task.id}
                            type="button"
                            className={`pillar-task ${done ? "completed" : ""}`}
                            onClick={() => void handlePillarTask(pillar, task)}
                            disabled={pillarSaving}
                          >
                            <span className="pillar-checkbox">{done ? "✓" : taskIcons[taskIndex]}</span>
                            <span className="pillar-task-copy"><b>{task.label}</b><small>{taskHelp[taskIndex]}</small></span>
                            <ArrowRight size={14} />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <button className="pillar-reset-button" type="button" onClick={resetPillarProgress}>Reiniciar mi ruta</button>
        </section>

        <section className="content-section" id="orientador">
          <FadeIn>
            <SectionHeading
              eyebrow="01 · Mapa de siguiente paso"
              title="¿Qué te trae hoy a Ruta Clara?"
              copy="Elige la opción más cercana a tu situación. No hay una respuesta perfecta. Esta herramienta organiza el siguiente paso, no decide un diagnóstico."
            />
          </FadeIn>

          <div className="history-panel">
            <div className="history-heading">
              <div>
                <span className="eyebrow">Historial del cliente</span>
                <h3>Tus rutas guardadas</h3>
                <p>Retoma cualquier sesión desde su avance real en Supabase.</p>
              </div>
              <button className="secondary-button small" type="button" onClick={() => void newSession()}><Plus size={16} /> Nueva ruta</button>
            </div>
            <div className="history-list">
              {history.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={activeSessionId === item.id ? "active" : ""}
                  onClick={() => resumeSession(item.id)}
                >
                  <span className="history-icon">{item.completada ? <CheckCircle2 size={18} /> : <History size={18} />}</span>
                  <span>
                    <strong>{item.motivo_consulta || "Ruta en preparación"}</strong>
                    <small>{new Date(item.updated_at || item.fecha).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</small>
                  </span>
                  <span className="history-progress"><strong>{item.progreso}%</strong><i><b style={{ width: `${item.progreso}%` }} /></i></span>
                </button>
              ))}
            </div>
          </div>

          <div className="tool-card">
            <div className="step-label"><span>1</span> Elige tu situación</div>
            <div className="choice-grid">
              <ChoiceCard
                active={situation === "risk"}
                onClick={() => setSituation("risk")}
                title="Quiero entender mis factores de riesgo"
                copy="No tengo una medición concreta"
                icon={BookOpen}
              />
              <ChoiceCard
                active={situation === "measurement"}
                onClick={() => setSituation("measurement")}
                title="Tengo una medición que me preocupa"
                copy="Necesito organizar su contexto"
                icon={Activity}
              />
              <ChoiceCard
                active={situation === "changes"}
                onClick={() => setSituation("changes")}
                title="He notado cambios en mi cuerpo"
                copy="Quiero explicar qué ocurre y desde cuándo"
                icon={Stethoscope}
              />
              <ChoiceCard
                active={situation === "delay"}
                onClick={() => setSituation("delay")}
                title="Estoy postergando una consulta"
                copy="Sé que debería preguntar, pero algo me frena"
                icon={Clock3}
              />
              <ChoiceCard
                active={situation === "urgent"}
                onClick={() => setSituation("urgent")}
                title="Me siento rápidamente peor o hay una señal grave"
                copy="Necesito saber dónde buscar atención"
                icon={AlertTriangle}
              />
            </div>

            <div className="tool-divider" />

            <div className="step-label"><span>2</span> ¿Qué hace más difícil actuar?</div>
            <div className="barrier-grid">
              {Object.entries(barriers).map(([id, item]) => (
                <button
                  type="button"
                  className={barrier === id ? "selected" : ""}
                  key={id}
                  onClick={() => setBarrier(id)}
                >
                  {barrier === id ? <CheckCircle2 size={17} /> : <span className="empty-dot" />}
                  {item.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {routeReady && routeContent ? (
                <motion.div
                  ref={resultRef}
                  className={`route-result ${route}`}
                  key={route}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="result-icon"><routeContent.icon size={26} /></div>
                  <div>
                    <span>{routeContent.label}</span>
                    <h3>{routeContent.title}</h3>
                    <p>{routeContent.copy}</p>
                    <button type="button" onClick={() => scrollToId(routeContent.target)}>
                      {routeContent.action} <ChevronRight size={17} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="waiting-result">
                  <Compass size={21} /> Completa los dos pasos para recibir una ruta.
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="content-section" id="contexto">
          <FadeIn>
            <SectionHeading
              eyebrow="02 · Contexto de una medición"
              title="Un número necesita contexto, no pánico."
              copy="Registra únicamente lo que sabes. Ruta Clara no clasifica el valor ni decide qué significa para ti."
            />
          </FadeIn>

          <div className="split-tool">
            <div className="tool-card compact">
              <div className="form-grid two">
                <label>
                  <span>Valor observado</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej. 107"
                    value={measurement.value}
                    onChange={(event) => setMeasurement({ ...measurement, value: event.target.value })}
                  />
                </label>
                <label>
                  <span>Unidad escrita</span>
                  <select value={measurement.unit} onChange={(event) => setMeasurement({ ...measurement, unit: event.target.value })}>
                    <option value="mg/dL">mg/dL</option>
                    <option value="mmol/L">mmol/L</option>
                    <option value="no sé">No lo sé</option>
                  </select>
                </label>
                <label>
                  <span>Momento</span>
                  <select value={measurement.timing} onChange={(event) => setMeasurement({ ...measurement, timing: event.target.value })}>
                    <option value="">Selecciona</option>
                    <option value="En ayunas, según me indicaron">En ayunas, según me indicaron</option>
                    <option value="Después de comer">Después de comer</option>
                    <option value="No lo sé">No lo sé</option>
                  </select>
                </label>
                <label>
                  <span>Origen del dato</span>
                  <select value={measurement.source} onChange={(event) => setMeasurement({ ...measurement, source: event.target.value })}>
                    <option value="">Selecciona</option>
                    <option value="Laboratorio">Laboratorio</option>
                    <option value="Glucómetro doméstico">Glucómetro doméstico</option>
                    <option value="Farmacia o campaña">Farmacia o campaña</option>
                    <option value="Otro o no lo sé">Otro o no lo sé</option>
                  </select>
                </label>
                <label>
                  <span>Fecha</span>
                  <input type="date" value={measurement.date} onChange={(event) => setMeasurement({ ...measurement, date: event.target.value })} />
                </label>
                <label>
                  <span>¿Un profesional lo revisó?</span>
                  <select value={measurement.reviewed} onChange={(event) => setMeasurement({ ...measurement, reviewed: event.target.value })}>
                    <option value="">Selecciona</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                    <option value="No lo sé">No lo sé</option>
                  </select>
                </label>
              </div>
              <div className="privacy-note"><LockKeyhole size={15} /> Este registro se guarda en tu cuenta privada y está aislado por usuario.</div>
            </div>

            <div className="context-output" aria-live="polite">
              <div className="output-top">
                <span>Contexto preparado</span>
                <strong>{contextPercent}%</strong>
              </div>
              <div className="context-ring" style={{ "--progress": `${contextPercent * 3.6}deg` } as React.CSSProperties}>
                <span>{contextComplete}<small>de 4</small></span>
              </div>
              {measurement.value ? (
                <div className="measurement-card">
                  <small>Dato aportado por ti</small>
                  <strong>{measurement.value} <span>{measurement.unit}</span></strong>
                  <p>Ruta Clara no interpreta este valor.</p>
                </div>
              ) : (
                <div className="measurement-empty"><Activity size={22} /> El resultado aparecerá aquí sin clasificación clínica.</div>
              )}
              {missingContext.length ? (
                <div className="missing-list">
                  <strong>Puede ayudarte anotar:</strong>
                  {missingContext.map((item) => <span key={item}><CircleAlert size={14} /> {item}</span>)}
                </div>
              ) : (
                <div className="safe-complete"><CheckCircle2 size={17} /> Tienes contexto suficiente para formular una pregunta más clara.</div>
              )}
            </div>
          </div>
        </section>

        <section className="content-section" id="consulta">
          <FadeIn>
            <SectionHeading
              eyebrow="03 · Resumen privado"
              title="Llega con lo importante organizado."
              copy="Completa solo lo que quieras compartir. Al final podrás descargar, imprimir o borrar el resumen."
            />
          </FadeIn>

          <div className="consult-layout">
            <div className="tool-card compact form-stack">
              <label>
                <span>Motivo principal de la conversación</span>
                <input
                  value={consult.reason}
                  onChange={(event) => setConsult({ ...consult, reason: event.target.value })}
                  placeholder="Ej. Tengo antecedentes familiares y quiero saber qué evaluación corresponde"
                />
              </label>
              <label>
                <span>¿Qué has notado?</span>
                <textarea
                  value={consult.signs}
                  onChange={(event) => setConsult({ ...consult, signs: event.target.value })}
                  placeholder="Escribe los cambios con tus propias palabras"
                  rows={3}
                />
              </label>
              <div className="form-grid two">
                <label>
                  <span>¿Desde cuándo?</span>
                  <input value={consult.duration} onChange={(event) => setConsult({ ...consult, duration: event.target.value })} placeholder="Ej. Hace dos semanas" />
                </label>
                <label>
                  <span>Antecedentes familiares</span>
                  <input value={consult.family} onChange={(event) => setConsult({ ...consult, family: event.target.value })} placeholder="Ej. Madre con diabetes tipo 2" />
                </label>
              </div>
              <label>
                <span>Medicamentos y suplementos declarados</span>
                <textarea
                  value={consult.medicines}
                  onChange={(event) => setConsult({ ...consult, medicines: event.target.value })}
                  placeholder="No cambies ni suspendas nada por tu cuenta"
                  rows={2}
                />
              </label>
              <label>
                <span>¿Qué te preocupa o te cuesta preguntar?</span>
                <textarea value={consult.worry} onChange={(event) => setConsult({ ...consult, worry: event.target.value })} placeholder="Puedes decir que sientes miedo o vergüenza" rows={2} />
              </label>
            </div>

            <div className="summary-preview print-area">
              <div className="summary-brand">
                <img src={BRAND_MARK} alt="" />
                <span><strong>Ruta Clara</strong><small>Resumen para mi consulta</small></span>
              </div>
              <div className="summary-block">
                <small>Motivo principal</small>
                <p>{consult.reason || "Completa el motivo de tu conversación."}</p>
              </div>
              <div className="summary-grid">
                <div><small>Qué he notado</small><p>{consult.signs || "Sin completar"}</p></div>
                <div><small>Desde cuándo</small><p>{consult.duration || "Sin completar"}</p></div>
                <div><small>Antecedentes</small><p>{consult.family || "Sin completar"}</p></div>
                <div><small>Medición</small><p>{measurement.value ? `${measurement.value} ${measurement.unit}, ${measurement.timing || "contexto pendiente"}` : "No registrada"}</p></div>
              </div>
              <div className="summary-block questions">
                <small>Mis tres preguntas</small>
                {(selectedBarrier?.questions || barriers.prueba.questions).map((question, index) => (
                  <p key={question}><span>{index + 1}</span>{question}</p>
                ))}
              </div>
              <div className="summary-disclaimer">Este resumen no es un diagnóstico ni una interpretación clínica.</div>
              <div className="summary-actions no-print">
                <button className="primary-button small" type="button" onClick={downloadSummary}><Download size={17} /> Descargar</button>
                <button className="secondary-button small" type="button" onClick={printSummary}><FileText size={17} /> Imprimir o PDF</button>
              </div>
            </div>
          </div>

          <div className="script-tool">
            <div>
              <span className="eyebrow">Guion para una conversación difícil</span>
              <h3>{selectedBarrier?.label || "Elige una barrera en el orientador"}</h3>
              <p>{selectedBarrier?.script || "Cuando elijas qué te frena, Ruta Clara preparará una frase que podrás editar y llevar contigo."}</p>
            </div>
            <button className="secondary-button" type="button" onClick={copyScript} disabled={!selectedBarrier}>
              <ClipboardList size={17} /> Copiar guion
            </button>
          </div>
        </section>

        <section className="content-section" id="plan">
          <FadeIn>
            <SectionHeading
              eyebrow="04 · Una acción durante siete días"
              title="Hazlo pequeño para poder hacerlo real."
              copy="Elige una acción general. No busca cambiar una cifra clínica. Busca ayudarte a empezar sin castigos ni planes extremos."
            />
          </FadeIn>

          <div className="plan-layout">
            <div className="habit-list">
              {habits.map((item) => (
                <button className={habit === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setHabit(item.id)}>
                  <span className="habit-check">{habit === item.id ? <Check size={15} /> : null}</span>
                  <span><strong>{item.title}</strong><small>{item.note}</small></span>
                </button>
              ))}
            </div>
            <div className="week-builder">
              <span className="eyebrow">Tu semana</span>
              <h3>{selectedHabit?.title || "Elige una acción"}</h3>
              <p>{selectedHabit ? `Versión mínima: ${selectedHabit.minimum}` : "Después selecciona los días en que quieres intentarlo."}</p>
              <div className="day-grid">
                {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
                  <button key={day} className={days.includes(day) ? "active" : ""} type="button" onClick={() => toggleDay(day)} disabled={!habit}>
                    {days.includes(day) ? <Check size={14} /> : day}
                  </button>
                ))}
              </div>
              <div className="plan-output">
                {habit && days.length ? (
                  <><Sparkles size={19} /><span><strong>Plan listo</strong>Intentarás esta acción {days.length} {days.length === 1 ? "día" : "días"}. Si un día se complica, usa la versión mínima.</span></>
                ) : (
                  <><Info size={19} /><span><strong>Sin presión</strong>Tu plan aparecerá cuando elijas una acción y al menos un día.</span></>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="content-section" id="recursos">
          <FadeIn>
            <SectionHeading
              eyebrow="05 · Navegador de atención"
              title="“Consulta a un profesional” necesita una puerta de entrada."
              copy="Selecciona tu país para ver fuentes oficiales. La disponibilidad, el costo y los tiempos pueden cambiar."
            />
          </FadeIn>
          <div className="country-tabs">
            {(Object.keys(countryResources) as Array<keyof typeof countryResources>).map((key) => (
              <button
                key={key}
                type="button"
                className={country === key ? "active" : ""}
                onClick={() => {
                  setCountry(key);
                  setProgress((current) => ({ ...current, resource: true }));
                }}
              >
                <MapPin size={16} /> {countryResources[key].label}
              </button>
            ))}
          </div>
          <div className="resource-grid">
            {countryResources[country].items.map((item) => (
              <a key={item.name} href={item.url} target="_blank" rel="noreferrer">
                <span className="resource-icon"><MapPin size={20} /></span>
                <span><strong>{item.name}</strong><small>{item.description}</small></span>
                <ExternalLink size={17} />
              </a>
            ))}
          </div>
          <p className="resource-note"><Info size={15} /> En una emergencia, usa los servicios urgentes de tu localidad. Ruta Clara no garantiza disponibilidad ni reemplaza atención.</p>
        </section>

        <section className="content-section" id="ayuda">
          <FadeIn>
            <SectionHeading
              eyebrow="06 · Solucionador de obstáculos"
              title="Encuentra la situación que se parece a la tuya."
              copy="Cada respuesta te ayuda a evitar un error y te lleva a una acción concreta."
            />
          </FadeIn>
          <div className="trouble-list">
            {troubleItems.map((item, index) => {
              const open = openTrouble === index;
              return (
                <div className={`trouble-item ${open ? "open" : ""}`} key={item.title}>
                  <button type="button" onClick={() => setOpenTrouble(open ? null : index)} aria-expanded={open}>
                    <span className="trouble-number">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.title}</strong>
                    <ChevronDown size={19} />
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        className="trouble-body"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p>{item.body}</p>
                        <button type="button" onClick={() => scrollToId(item.target)}>{item.action} <ArrowRight size={16} /></button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        <section className="content-section" id="comparador">
          <FadeIn>
            <SectionHeading
              eyebrow="07 · Comparador de caminos"
              title="No todas las respuestas rápidas son caminos seguros."
              copy="Compara qué aporta cada opción y qué riesgo puede crear."
            />
          </FadeIn>
          <div className="comparison-table">
            <div className="comparison-head"><span>Camino</span><span>Qué aporta</span><span>Recomendación</span></div>
            {[
              ["Ignorar la preocupación", "Evita una conversación incómoda hoy, pero puede prolongar la incertidumbre.", "No recomendado", "bad"],
              ["Buscar solo en redes", "Permite conocer experiencias, pero mezcla testimonios, publicidad y desinformación.", "No usar como única fuente", "warn"],
              ["Usar Ruta Clara", "Organiza información, preguntas y un siguiente paso sin emitir un diagnóstico.", "Recomendado como preparación", "good"],
              ["Consultar a un profesional", "Permite evaluación individual, pruebas e interpretación clínica.", "Recomendado cuando corresponda", "good"],
              ["Comprar una cura o suplemento", "Puede parecer rápido, pero puede generar interacciones y retrasar atención.", "No recomendado", "bad"],
            ].map(([name, copy, label, status]) => (
              <div className="comparison-row" key={name}>
                <strong>{name}</strong>
                <p>{copy}</p>
                <span className={`status ${status}`}>{status === "good" ? <CheckCircle2 size={15} /> : status === "bad" ? <XCircle size={15} /> : <AlertTriangle size={15} />}{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="safety-section" id="urgente">
          <div className="safety-icon"><ShieldCheck size={28} /></div>
          <div>
            <span className="eyebrow">Límites de Ruta Clara</span>
            <h2>Esta app prepara. Un profesional evalúa.</h2>
            <p>
              Ruta Clara es una herramienta educativa. No diagnostica, no trata, no cura, no interpreta resultados individuales y no recomienda iniciar, cambiar o suspender medicamentos. Si te sientes rápidamente peor o tienes señales graves, busca atención urgente local.
            </p>
            <div className="safety-grid">
              <span><CheckCircle2 size={16} /> Organiza información</span>
              <span><CheckCircle2 size={16} /> Genera preguntas</span>
              <span><CheckCircle2 size={16} /> Explica límites</span>
              <span><XCircle size={16} /> No diagnostica</span>
              <span><XCircle size={16} /> No prescribe</span>
              <span><XCircle size={16} /> No promete curas</span>
            </div>
          </div>
        </section>

        <footer>
          <div className="footer-brand"><img src={BRAND_MARK} alt="" /><span><strong>Ruta Clara</strong><small>de Casi40Tech</small></span></div>
          <div className="footer-links">
            <a href="https://www.paho.org/es/temas/diabetes" target="_blank" rel="noreferrer">OPS</a>
            <a href="https://medlineplus.gov/spanish/prediabetes.html" target="_blank" rel="noreferrer">MedlinePlus</a>
            <a href="https://www.who.int/es/news-room/fact-sheets/detail/diabetes" target="_blank" rel="noreferrer">OMS</a>
          </div>
          <button className="clear-button" type="button" onClick={clearData}><Trash2 size={15} /> Borrar mis datos</button>
          <p>© 2026 Casi40Tech. Producto educativo. La información se guarda en tu cuenta privada con políticas de acceso por usuario. Herramienta informativa, no sustituye consejo profesional de salud</p>
        </footer>
      </main>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {navItems.map((item) => (
          <button key={item.id} type="button" className={activeSection === item.id ? "active" : ""} onClick={() => scrollToId(item.id)}>
            <item.icon size={19} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Home;
