export type Measurement = {
  value: string;
  unit: string;
  timing: string;
  source: string;
  date: string;
  reviewed: string;
};

export type ConsultData = {
  reason: string;
  signs: string;
  duration: string;
  family: string;
  medicines: string;
  worry: string;
};

export type ProgressState = Record<string, boolean>;

export type SessionPrivateSummary = {
  situation: string;
  barrier: string;
  consult: ConsultData;
  habit: string;
  days: string[];
  country: "mexico" | "colombia" | "argentina";
  progress: ProgressState;
};

export type RutaSessionRow = {
  id: string;
  user_id: string;
  fecha: string;
  motivo_consulta: string;
  contexto_medicion_json: Measurement;
  resumen_privado_json: SessionPrivateSummary;
  plan_accion: string;
  progreso: number;
  completada: boolean;
  updated_at: string;
};
