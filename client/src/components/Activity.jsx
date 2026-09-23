import { useEffect, useRef, useState } from "react";
import { Camera, Pause, Play, RotateCcw, Save } from "lucide-react";

function pad(value) {
  return String(value).padStart(2, "0");
}

export default function ActivityClock({ activity, met, weightKg, minutes, kcal, manualBpm, onWeightChange, onManualBpmChange, onSave, saving, userReady, feedback }) {
  const [clock, setClock] = useState(() => new Date());
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [cameraBpm, setCameraBpm] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const previousFrameRef = useRef(null);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const interval = window.setInterval(() => setStopwatchSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  useEffect(() => {
    if (!cameraActive) return undefined;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!video || !canvas || !context) return undefined;
    const interval = window.setInterval(() => {
      if (video.readyState < 2) return;
      canvas.width = 48;
      canvas.height = 36;
      context.drawImage(video, 0, 0, 48, 36);
      const frame = context.getImageData(0, 0, 48, 36).data;
      const previous = previousFrameRef.current;
      if (previous) {
        let difference = 0;
        for (let index = 0; index < frame.length; index += 4) difference += Math.abs(frame[index] - previous[index]);
        setCameraBpm(Math.round(65 + Math.min(45, (difference / (frame.length / 4)) * 2.2)));
      }
      previousFrameRef.current = new Uint8ClampedArray(frame);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cameraActive]);

  const toggleCamera = async () => {
    if (cameraActive) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      previousFrameRef.current = null;
      setCameraActive(false);
      setCameraBpm(null);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setCameraActive(false);
    }
  };

  const stopwatch = `${pad(Math.floor(stopwatchSeconds / 3600))}:${pad(Math.floor((stopwatchSeconds % 3600) / 60))}:${pad(stopwatchSeconds % 60)}`;
  const clockLabel = clock.toLocaleTimeString("es-CO", { hour12: false });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-2xl bg-[#173c2c] p-4 text-white sm:grid-cols-2">
        <div><p className="text-xs uppercase tracking-[0.18em] text-[#b9d6bf]">Reloj digital</p><p className="font-mono text-3xl font-bold tracking-wider">{clockLabel}</p></div>
        <div className="sm:text-right"><p className="text-xs uppercase tracking-[0.18em] text-[#b9d6bf]">Cronómetro</p><p className="font-mono text-3xl font-bold tracking-wider">{stopwatch}</p><div className="mt-2 flex gap-2 sm:justify-end"><button type="button" onClick={() => setRunning((value) => !value)} className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">{running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}{running ? "Pausar" : "Iniciar"}</button><button type="button" onClick={() => { setRunning(false); setStopwatchSeconds(0); }} className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25"><RotateCcw className="size-3.5" />Reiniciar</button></div></div>
      </div>
      <div className="grid gap-4 rounded-2xl border border-[#e6e0d5] bg-[#fffdfa] p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium text-[#33483b]">Peso (kg) para calcular kcal<input type="number" min="1" max="300" value={weightKg} onChange={(event) => onWeightChange(Number(event.target.value))} className="h-11 rounded-xl border border-[#ded8cc] bg-[#fffdfa] px-3 outline-none focus:border-[#3f7659]" /></label><label className="grid gap-1.5 text-sm font-medium text-[#33483b]">BPM manual<input type="number" min="30" max="220" placeholder="Ej. 82" value={manualBpm} onChange={(event) => onManualBpmChange(event.target.value)} className="h-11 rounded-xl border border-[#ded8cc] bg-[#fffdfa] px-3 outline-none focus:border-[#3f7659]" /></label><div className="flex items-center gap-3 text-sm font-medium text-[#33483b]"><button type="button" onClick={() => void toggleCamera()} className="flex h-10 items-center gap-1.5 rounded-xl bg-[#eef3ed] px-3 text-xs font-semibold text-[#235b42] hover:bg-[#dbe8dc]"><Camera className="size-4" />{cameraActive ? "Apagar cámara" : "Activar cámara"}</button><strong>{cameraBpm ? `${cameraBpm} BPM` : "BPM cámara —"}</strong></div></div>
        <div className="overflow-hidden rounded-xl bg-[#173c2c] sm:w-28">{cameraActive ? <video ref={videoRef} autoPlay muted playsInline className="h-20 w-full object-cover" /> : <div className="flex h-20 items-center justify-center text-[#b9d6bf]"><Camera className="size-7" /></div>}<canvas ref={canvasRef} className="hidden" /></div>
        <p className="text-xs leading-5 text-[#697267] sm:col-span-2">Estimación experimental por movimiento; no reemplaza un pulsómetro ni una medición médica.</p>
      </div>
      <div className="rounded-2xl bg-[#e9f0ea] p-4 text-center text-lg font-bold text-[#235b42]">Quemaste {Math.round(kcal)} kcal <span className="mx-1 text-[#8ba08e]">|</span> {manualBpm || cameraBpm || "—"} BPM</div>
      <p className="text-center text-xs text-[#697267]">Fórmula: {met} MET × {Number(weightKg) || 70} kg × {stopwatchSeconds ? `${stopwatchSeconds}s` : `${Number(minutes) || 0} min`}.</p>
      <button type="button" disabled={saving || !userReady} onClick={() => onSave({ stopwatchSeconds, cameraBpm, activity, met, weightKg, manualBpm, kcal })} className="flex items-center justify-center gap-2 rounded-xl bg-[#e4b45b] px-4 py-3 font-bold text-[#173c2c] transition hover:bg-[#dba848] disabled:cursor-not-allowed disabled:opacity-60"><Save className="size-4" />{saving ? "Guardando actividad…" : "Guardar actividad en Supabase"}</button>
      {feedback && <p className="text-center text-xs text-[#697267]">{feedback}</p>}
    </div>
  );
}
