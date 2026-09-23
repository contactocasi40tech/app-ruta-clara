import { describe, expect, it } from "vitest";

const projectRef = new URL(process.env.VITE_SUPABASE_URL!).hostname.split(".")[0];
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const googleClientId = process.env.SUPABASE_AUTH_GOOGLE_CLIENT_ID;
const googleSecret = process.env.SUPABASE_AUTH_GOOGLE_SECRET;
let authConfig: Record<string, unknown> = {};

describe("Supabase Management credentials", () => {
  it("reads the project's Auth configuration with the management token", async () => {
    expect(accessToken).toBeTruthy();
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await response.text();
    expect(response.ok, body).toBe(true);
    authConfig = JSON.parse(body) as Record<string, unknown>;
  });

  it("has plausible Google Web OAuth credentials", () => {
    expect(googleClientId).toMatch(/\.apps\.googleusercontent\.com$/);
    expect(googleSecret?.length).toBeGreaterThan(12);
  });

  it("exposes Google login and the production redirect allow list", async () => {
    expect(authConfig.external_google_enabled).toBe(true);
    expect(authConfig.site_url).toBe("https://ruta-clara.casi40tech.lat");
    expect(authConfig.uri_allow_list).toContain("https://ruta-clara.casi40tech.lat/**");
    expect(authConfig.uri_allow_list).toContain("https://rutaclara-pep7q72r.manus.space/**");
    const response = await fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY! },
    });
    const settings = await response.json() as { external?: { google?: boolean } };
    expect(response.ok).toBe(true);
    expect(settings.external?.google).toBe(true);
  });
});
