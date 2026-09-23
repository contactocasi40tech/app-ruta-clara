import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { processHotmartEvent, type NormalizedHotmartEvent } from "./hotmartWebhook";

const url = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeIfConfigured = url && serviceRoleKey ? describe : describe.skip;

describeIfConfigured("Hotmart webhook persistence", () => {
  const admin = createClient(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `hotmart-${stamp}@example.com`;
  const password = `Ruta-${stamp}-A9!`;
  const reference = `subscriber:test-${stamp}`;
  const eventIds = {
    approved: `hotmart-approved-${stamp}`,
    stale: `hotmart-stale-${stamp}`,
    refunded: `hotmart-refunded-${stamp}`,
  };
  let userId = "";

  const baseEvent: NormalizedHotmartEvent = {
    eventId: eventIds.approved,
    eventName: "PURCHASE_APPROVED",
    eventAt: "2026-09-11T20:00:00.000Z",
    reference,
    productId: process.env.HOTMART_PRODUCT_ID!,
    offerId: "offer-test",
    transactionId: `transaction-${stamp}`,
    buyerEmail: email,
    state: "activo",
    startsAt: "2026-09-11T20:00:00.000Z",
    validUntil: "2026-10-11T20:00:00.000Z",
    canceledAt: null,
    metadata: { version: "2.0.0" },
  };

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: "Prueba Hotmart" },
    });
    if (created.error) throw created.error;
    userId = created.data.user.id;
  });

  afterAll(async () => {
    await admin.from("hotmart_eventos").delete().in("event_id", Object.values(eventIds));
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("activates the matching Supabase user from a purchase", async () => {
    const result = await processHotmartEvent(baseEvent);
    expect(result).toMatchObject({ status: "processed", event_id: eventIds.approved, user_linked: true });

    const user = await admin.from("users").select("estado_suscripcion").eq("id", userId).single();
    expect(user.error).toBeNull();
    expect(user.data?.estado_suscripcion).toBe("activo");
  });

  it("acknowledges a Hotmart retry without duplicating records", async () => {
    const retry = await processHotmartEvent(baseEvent);
    expect(retry).toMatchObject({ status: "duplicate", event_id: eventIds.approved });

    const events = await admin.from("hotmart_eventos").select("id", { count: "exact" }).eq("event_id", eventIds.approved);
    const subscriptions = await admin.from("suscripciones").select("id", { count: "exact" }).eq("referencia_externa", reference);
    expect(events.count).toBe(1);
    expect(subscriptions.count).toBe(1);
  });

  it("ignores an older event and applies a newer refund", async () => {
    const stale = await processHotmartEvent({
      ...baseEvent,
      eventId: eventIds.stale,
      eventName: "PURCHASE_REFUNDED",
      eventAt: "2026-09-11T19:00:00.000Z",
      state: "reembolsado",
    });
    expect(stale).toMatchObject({ status: "stale", event_id: eventIds.stale });

    const stillActive = await admin.from("users").select("estado_suscripcion").eq("id", userId).single();
    expect(stillActive.data?.estado_suscripcion).toBe("activo");

    const refunded = await processHotmartEvent({
      ...baseEvent,
      eventId: eventIds.refunded,
      eventName: "PURCHASE_REFUNDED",
      eventAt: "2026-09-11T21:00:00.000Z",
      state: "reembolsado",
      validUntil: null,
    });
    expect(refunded).toMatchObject({ status: "processed", event_id: eventIds.refunded });

    const blocked = await admin.from("users").select("estado_suscripcion").eq("id", userId).single();
    expect(blocked.data?.estado_suscripcion).toBe("bloqueado");
  });
});
