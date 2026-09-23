import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import express, { type Express, type RequestHandler } from "express";
import { z } from "zod";

const payloadSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  creation_date: z.union([z.string(), z.number()]),
  event: z.string().min(1),
  version: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

const SUPPORTED_EVENTS = new Set([
  "PURCHASE_APPROVED",
  "PURCHASE_COMPLETE",
  "PURCHASE_BILLET_PRINTED",
  "PURCHASE_CANCELED",
  "PURCHASE_DELAYED",
  "PURCHASE_EXPIRED",
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_PROTEST",
  "SUBSCRIPTION_CANCELLATION",
]);

export type HotmartSubscriptionState =
  | "pendiente"
  | "activo"
  | "atrasado"
  | "cancelado"
  | "expirado"
  | "reembolsado"
  | "contracargo"
  | "bloqueado";

export type NormalizedHotmartEvent = {
  eventId: string;
  eventName: string;
  eventAt: string;
  reference: string;
  productId: string;
  offerId: string | null;
  transactionId: string | null;
  buyerEmail: string;
  state: HotmartSubscriptionState;
  startsAt: string | null;
  validUntil: string | null;
  canceledAt: string | null;
  metadata: Record<string, string | number | boolean | null>;
};

export type ProcessResult = {
  status: "processed" | "duplicate" | "stale";
  event_id?: string;
  subscription_id?: string;
  user_linked?: boolean;
};

type WebhookDependencies = {
  hottok?: string;
  productId?: string;
  processEvent?: (event: NormalizedHotmartEvent) => Promise<ProcessResult>;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function nested(source: JsonRecord, ...keys: string[]): unknown {
  let current: unknown = source;
  for (const key of keys) current = record(current)[key];
  return current;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function timestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  const date = Number.isFinite(numeric) && String(value).trim() !== ""
    ? new Date(numeric)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizedEmail(value: unknown): string | null {
  const email = text(value)?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function secretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const providedHash = createHash("sha256").update(provided, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return providedHash.equals(expectedHash);
}

function stateFor(eventName: string, data: JsonRecord): HotmartSubscriptionState | null {
  if (eventName === "SUBSCRIPTION_CANCELLATION") {
    return "cancelado";
  }

  const subscriptionStatus = text(nested(data, "subscription", "status"))?.toUpperCase();
  if (eventName === "PURCHASE_APPROVED" || eventName === "PURCHASE_COMPLETE") {
    if (subscriptionStatus === "DELAYED" || subscriptionStatus === "OVERDUE") return "atrasado";
    if (subscriptionStatus?.startsWith("CANCELLED") || subscriptionStatus === "INACTIVE") return "cancelado";
    return "activo";
  }

  const byEvent: Record<string, HotmartSubscriptionState> = {
    PURCHASE_BILLET_PRINTED: "pendiente",
    PURCHASE_CANCELED: "cancelado",
    PURCHASE_DELAYED: "atrasado",
    PURCHASE_EXPIRED: "expirado",
    PURCHASE_REFUNDED: "reembolsado",
    PURCHASE_CHARGEBACK: "contracargo",
    PURCHASE_PROTEST: "bloqueado",
  };
  return byEvent[eventName] ?? null;
}

export function normalizeHotmartPayload(input: unknown):
  | { kind: "event"; value: NormalizedHotmartEvent }
  | { kind: "ignored"; reason: "unsupported_event" }
  | { kind: "invalid"; reason: string } {
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { kind: "invalid", reason: "invalid_payload" };

  const eventName = parsed.data.event.toUpperCase();
  if (!SUPPORTED_EVENTS.has(eventName)) return { kind: "ignored", reason: "unsupported_event" };

  const data = parsed.data.data;
  const purchase = record(data.purchase);
  const eventAt = timestamp(parsed.data.creation_date);
  const productId = text(nested(data, "product", "id"));
  const buyerEmail = normalizedEmail(
    nested(data, "buyer", "email") ?? nested(data, "subscriber", "email"),
  );
  const subscriberCode = text(
    nested(data, "subscription", "subscriber", "code") ?? nested(data, "subscriber", "code"),
  );
  const subscriptionId = text(nested(data, "subscription", "id"));
  const transactionId = text(purchase.transaction);
  const reference = subscriberCode
    ? `subscriber:${subscriberCode}`
    : subscriptionId
      ? `subscription:${subscriptionId}`
      : transactionId
        ? `transaction:${transactionId}`
        : null;
  const validUntil = timestamp(purchase.date_next_charge ?? data.date_next_charge);
  const state = stateFor(eventName, data);

  if (!eventAt || !productId || !buyerEmail || !reference || !state) {
    return { kind: "invalid", reason: "missing_required_event_data" };
  }

  const canceledAt = eventName === "SUBSCRIPTION_CANCELLATION"
    ? timestamp(data.cancellation_date) ?? eventAt
    : eventName === "PURCHASE_CANCELED"
      ? eventAt
      : null;

  return {
    kind: "event",
    value: {
      eventId: parsed.data.id,
      eventName,
      eventAt,
      reference,
      productId,
      offerId: text(nested(purchase, "offer", "code") ?? nested(data, "subscription", "plan", "id")),
      transactionId,
      buyerEmail,
      state,
      startsAt: timestamp(purchase.approved_date ?? purchase.order_date),
      validUntil,
      canceledAt,
      metadata: {
        version: parsed.data.version ?? null,
        product_ucode: text(nested(data, "product", "ucode")),
        purchase_status: text(purchase.status),
        subscription_status: text(nested(data, "subscription", "status")),
      },
    },
  };
}

let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase backend credentials are not configured");
  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export async function processHotmartEvent(event: NormalizedHotmartEvent): Promise<ProcessResult> {
  const client = getAdminClient() as ReturnType<typeof createClient<any>>;
  const { data, error } = await client.rpc("process_hotmart_event", {
    p_event_id: event.eventId,
    p_event_name: event.eventName,
    p_event_at: event.eventAt,
    p_referencia_externa: event.reference,
    p_product_id: event.productId,
    p_offer_id: event.offerId,
    p_transaction_id: event.transactionId,
    p_buyer_email: event.buyerEmail,
    p_estado: event.state,
    p_fecha_inicio: event.startsAt,
    p_vigente_hasta: event.validUntil,
    p_cancelada_at: event.canceledAt,
    p_metadata_json: event.metadata,
  });
  if (error) throw error;
  return data as ProcessResult;
}

export function createHotmartWebhookHandler(dependencies: WebhookDependencies = {}): RequestHandler {
  const expectedHottok = dependencies.hottok ?? process.env.HOTMART_HOTTOK ?? "";
  const expectedProductId = dependencies.productId ?? process.env.HOTMART_PRODUCT_ID ?? "";
  const persist = dependencies.processEvent ?? processHotmartEvent;

  return async (req, res) => {
    if (!expectedHottok || !expectedProductId) {
      res.status(503).json({ received: false, error: "webhook_not_configured" });
      return;
    }

    const suppliedHottok = req.header("X-HOTMART-HOTTOK");
    if (!secretMatches(suppliedHottok, expectedHottok)) {
      res.status(401).json({ received: false, error: "invalid_signature" });
      return;
    }

    const normalized = normalizeHotmartPayload(req.body);
    if (normalized.kind === "invalid") {
      res.status(400).json({ received: false, error: normalized.reason });
      return;
    }
    if (normalized.kind === "ignored") {
      res.status(200).json({ received: true, status: "ignored", reason: normalized.reason });
      return;
    }
    if (normalized.value.productId !== expectedProductId) {
      res.status(200).json({ received: true, status: "ignored", reason: "product_not_allowed" });
      return;
    }

    try {
      const result = await persist(normalized.value);
      console.info("[Hotmart webhook]", {
        eventId: normalized.value.eventId,
        eventName: normalized.value.eventName,
        status: result.status,
      });
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      console.error("[Hotmart webhook] Processing failed", {
        eventId: normalized.value.eventId,
        eventName: normalized.value.eventName,
        error: error instanceof Error ? error.message : "unknown_error",
      });
      res.status(500).json({ received: false, error: "processing_failed" });
    }
  };
}

export function registerHotmartWebhook(app: Express, dependencies: WebhookDependencies = {}) {
  app.post(
    "/api/webhooks/hotmart",
    express.json({ limit: "256kb", strict: true, type: "application/json" }),
    createHotmartWebhookHandler(dependencies),
  );
}
