import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHotmartWebhookHandler,
  normalizeHotmartPayload,
  type NormalizedHotmartEvent,
} from "./hotmartWebhook";

const HOTTOK = "hotmart-test-hottok-very-secret";
const PRODUCT_ID = "3526906";
const servers: Server[] = [];

function purchasePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-approved-1",
    creation_date: 1789160000000,
    event: "PURCHASE_APPROVED",
    version: "2.0.0",
    data: {
      product: { id: Number(PRODUCT_ID), ucode: "product-ucode" },
      buyer: { email: "Buyer@Example.com" },
      purchase: {
        approved_date: 1789160000000,
        date_next_charge: 1791752000000,
        status: "APPROVED",
        transaction: "HP123",
        offer: { code: "offer-1" },
      },
      subscription: {
        status: "ACTIVE",
        subscriber: { code: "SUB123" },
      },
      ...overrides,
    },
  };
}

async function startWebhook(processEvent = vi.fn(async () => ({ status: "processed" as const }))) {
  const app = express();
  app.post(
    "/api/webhooks/hotmart",
    express.json({ limit: "256kb", strict: true }),
    createHotmartWebhookHandler({
      hottok: HOTTOK,
      productId: PRODUCT_ID,
      processEvent,
    }),
  );
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return {
    url: `http://127.0.0.1:${address.port}/api/webhooks/hotmart`,
    processEvent,
  };
}

async function post(url: string, body: unknown, hottok?: string) {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(hottok ? { "x-hotmart-hottok": hottok } : {}),
    },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe("POST /api/webhooks/hotmart", () => {
  it("rejects a missing or invalid Hottok before processing", async () => {
    const { url, processEvent } = await startWebhook();
    const missing = await post(url, purchasePayload());
    const invalid = await post(url, purchasePayload(), "wrong-token");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toMatchObject({ error: "invalid_signature" });
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("accepts a valid signed purchase and normalizes identifiers", async () => {
    const processEvent = vi.fn(async (event: NormalizedHotmartEvent) => ({
      status: "processed" as const,
      event_id: event.eventId,
      user_linked: true,
    }));
    const { url } = await startWebhook(processEvent);
    const response = await post(url, purchasePayload(), HOTTOK);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, status: "processed" });
    expect(processEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "evt-approved-1",
      eventName: "PURCHASE_APPROVED",
      reference: "subscriber:SUB123",
      productId: PRODUCT_ID,
      buyerEmail: "buyer@example.com",
      transactionId: "HP123",
      offerId: "offer-1",
      state: "activo",
    }));
  });

  it("ignores a valid event for a different product", async () => {
    const { url, processEvent } = await startWebhook();
    const payload = purchasePayload();
    payload.data.product.id = 999;
    const response = await post(url, payload, HOTTOK);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ignored", reason: "product_not_allowed" });
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed supported events", async () => {
    const { url, processEvent } = await startWebhook();
    const response = await post(url, { id: "evt", creation_date: Date.now(), event: "PURCHASE_APPROVED", data: {} }, HOTTOK);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "missing_required_event_data" });
    expect(processEvent).not.toHaveBeenCalled();
  });

  it("acknowledges unsupported events without storing them", async () => {
    const { url, processEvent } = await startWebhook();
    const response = await post(url, { id: "evt", creation_date: Date.now(), event: "CART_ABANDONMENT", data: {} }, HOTTOK);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ignored", reason: "unsupported_event" });
    expect(processEvent).not.toHaveBeenCalled();
  });
});

describe("Hotmart payload normalization", () => {
  it("fails closed after subscription cancellation while preserving the next-charge date", () => {
    const future = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const result = normalizeHotmartPayload({
      id: "evt-cancel-1",
      creation_date: Date.now(),
      event: "SUBSCRIPTION_CANCELLATION",
      version: "2.0.0",
      data: {
        date_next_charge: future,
        cancellation_date: Date.now(),
        product: { id: Number(PRODUCT_ID) },
        subscriber: { code: "SUB123", email: "buyer@example.com" },
        subscription: { id: 471681, plan: { id: 460805 } },
      },
    });

    expect(result.kind).toBe("event");
    if (result.kind === "event") {
      expect(result.value.state).toBe("cancelado");
      expect(result.value.validUntil).toBe(new Date(future).toISOString());
    }
  });
});

describe("Hotmart production secrets", () => {
  it("authenticates a request using the configured production secrets", async () => {
    expect(process.env.HOTMART_HOTTOK?.length).toBeGreaterThanOrEqual(8);
    expect(process.env.HOTMART_HOTTOK?.toLowerCase()).not.toContain("replace");
    expect(process.env.HOTMART_PRODUCT_ID).toMatch(/^\d+$/);

    const processEvent = vi.fn(async () => ({ status: "processed" as const }));
    const app = express();
    app.post(
      "/api/webhooks/hotmart",
      express.json({ limit: "256kb", strict: true }),
      createHotmartWebhookHandler({ processEvent }),
    );
    const server = createServer(app);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");

    const payload = purchasePayload();
    payload.data.product.id = Number(process.env.HOTMART_PRODUCT_ID);
    const response = await post(
      `http://127.0.0.1:${address.port}/api/webhooks/hotmart`,
      payload,
      process.env.HOTMART_HOTTOK,
    );

    expect(response.status).toBe(200);
    expect(processEvent).toHaveBeenCalledOnce();
  });
});
