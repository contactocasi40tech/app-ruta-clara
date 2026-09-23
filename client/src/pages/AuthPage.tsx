import { useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";

const BRAND_MARK = "/manus-storage/ruta-clara-mark_a36fc144.png";
const CLARA_IMAGE = "/manus-storage/clara-oficial-ruta-clara_9dc2a8ad.png";

type Mode = "login" | "register" | "recover" | "reset";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path fill="#4285F4" d="M21.35 12.2c0-.64-.06-1.25-.17-1.84H12v3.48h5.25a4.49 4.49 0 0 1-1.95 2.94v2.26h3.16c1.85-1.7 2.89-4.21 2.89-6.84Z" />
      <path fill="#34A853" d="M12 21.72c2.64 0 4.86-.88 6.48-2.38l-3.16-2.26c-.88.59-2 .94-3.32.94-2.55 0-4.71-1.72-5.48-4.04H3.25v2.33A9.79 9.79 0 0 0 12 21.72Z" />
      <path fill="#FBBC05" d="M6.52 13.98A5.88 5.88 0 0 1 6.21 12c0-.69.12-1.36.31-1.98V7.69H3.25A9.8 9.8 0 0 0 2.21 12c0 1.56.37 3.04 1.04 4.31l3.27-2.33Z" />
      <path fill="#EA4335" d="M12 5.98c1.44 0 2.72.49 3.73 1.46l2.82-2.82A9.44 9.44 0 0 0 12 2.28a9.79 9.79 0 0 0-8.75 5.41l3.27 2.33C7.29 7.7 9.45 5.98 12 5.98Z" />
    </svg>
  );
}

export default function AuthPage({ recoveryMode = false }: { recoveryMode?: boolean }) {
  const auth = useSupabaseAuth();
  const [mode, setMode] = useState<Mode>(recoveryMode ? "reset" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "register") {
        if (password.length < 8) throw new Error("Usa al menos 8 caracteres para tu contraseña.");
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
        const result = await auth.signUp(name.trim(), email.trim(), password);
        if (result.needsConfirmation) {
          toast.success("Cuenta creada. Revisa tu correo para confirmar el acceso.");
          setMode("login");
        } else {
          toast.success("Tu cuenta está lista.");
        }
      } else if (mode === "recover") {
        await auth.sendPasswordReset(email.trim());
        toast.success("Enviamos el enlace de recuperación a tu correo.");
        setMode("login");
      } else if (mode === "reset") {
        if (password.length < 8) throw new Error("Usa al menos 8 caracteres para tu contraseña.");
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");
        await auth.updatePassword(password);
        toast.success("Contraseña actualizada.");
      } else {
        await auth.signIn(email.trim(), password, remember);
        toast.success("Bienvenido de nuevo.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos completar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "register" ? "Crea tu espacio privado" : mode === "recover" ? "Recupera tu acceso" : mode === "reset" ? "Define una nueva contraseña" : "Continúa tu Ruta Clara";
  const copy = mode === "register" ? "Tu progreso quedará asociado a tu cuenta y protegido por usuario." : mode === "recover" ? "Te enviaremos un enlace seguro para volver a entrar." : mode === "reset" ? "La nueva contraseña debe tener al menos ocho caracteres." : "Retoma tus sesiones, mediciones y planes desde cualquier dispositivo.";

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand"><img src={BRAND_MARK} alt="" /><span><strong>Ruta Clara</strong><small>de Casi40Tech</small></span></div>
        <div className="auth-story-copy">
          <span className="trust-badge"><ShieldCheck size={15} /> Plataforma privada</span>
          <h1>Tu información de salud, organizada con <em>claridad.</em></h1>
          <p>Una cuenta te permite guardar el avance real de tus seis pasos, retomar sesiones anteriores y llevar un resumen mejor preparado.</p>
          <div className="auth-benefits">
            <span><CheckCircle2 size={17} /> Datos aislados por usuario</span>
            <span><CheckCircle2 size={17} /> Guardado automático en Supabase</span>
            <span><CheckCircle2 size={17} /> Control para borrar todos tus datos</span>
          </div>
        </div>
        <div className="auth-clara-portrait">
          <img className="auth-story-image" src={CLARA_IMAGE} alt="Clara, guía cercana de Ruta Clara de Casi40Tech" />
          <span><strong>Clara</strong><small>Tu guía en Ruta Clara</small></span>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <img src={BRAND_MARK} alt="" />
            <strong>Ruta Clara</strong>
            <span className="auth-mobile-clara">
              <img src={CLARA_IMAGE} alt="Clara" />
              <span><strong>Clara</strong><small>Tu guía</small></span>
            </span>
          </div>
          <span className="eyebrow">Acceso seguro</span>
          <h2>{title}</h2>
          <p>{copy}</p>

          {mode === "login" || mode === "register" ? (
            <button className="google-button" type="button" disabled={submitting} onClick={() => auth.signInWithGoogle(remember).catch((error) => toast.error(error.message))}>
              <GoogleIcon /> Continuar con Google
            </button>
          ) : null}

          {mode === "login" || mode === "register" ? <div className="auth-divider"><span>o con tu correo</span></div> : null}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "register" ? (
              <label><span>Nombre</span><div className="auth-input"><UserRound size={17} /><input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Cómo quieres que te llamemos" /></div></label>
            ) : null}
            {mode !== "reset" ? (
              <label><span>Correo electrónico</span><div className="auth-input"><Mail size={17} /><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" /></div></label>
            ) : null}
            {mode !== "recover" ? (
              <label><span>{mode === "reset" ? "Nueva contraseña" : "Contraseña"}</span><div className="auth-input"><LockKeyhole size={17} /><input required type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            ) : null}
            {mode === "register" || mode === "reset" ? (
              <label><span>Confirmar contraseña</span><div className="auth-input"><KeyRound size={17} /><input required type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite tu contraseña" /></div></label>
            ) : null}

            {mode === "login" ? (
              <div className="auth-options">
                <label className="remember-control"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span><strong>Recuérdame</strong><small>{remember ? "Sesión de hasta 30 días" : "Sesión de hasta 24 horas"}</small></span></label>
                <button type="button" onClick={() => setMode("recover")}>Olvidé mi contraseña</button>
              </div>
            ) : null}

            <button className="primary-button auth-submit" type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="spin" size={18} /> : null}
              {mode === "register" ? "Crear cuenta" : mode === "recover" ? "Enviar enlace" : mode === "reset" ? "Guardar contraseña" : "Iniciar sesión"}
              {!submitting ? <ArrowRight size={18} /> : null}
            </button>
          </form>

          <div className="auth-switch">
            {mode === "login" ? <><span>¿Aún no tienes cuenta?</span><button type="button" onClick={() => setMode("register")}>Crear cuenta</button></> : null}
            {mode === "register" ? <><span>¿Ya tienes una cuenta?</span><button type="button" onClick={() => setMode("login")}>Iniciar sesión</button></> : null}
            {mode === "recover" ? <button type="button" onClick={() => setMode("login")}>Volver al inicio de sesión</button> : null}
          </div>
          <p className="auth-legal">Al continuar aceptas que Ruta Clara es una herramienta educativa. Esta app prepara. Un profesional evalúa.</p>
        </div>
      </section>
    </main>
  );
}
