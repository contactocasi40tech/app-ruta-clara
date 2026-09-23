import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const googleClientId = process.env.SUPABASE_AUTH_GOOGLE_CLIENT_ID;
const googleSecret = process.env.SUPABASE_AUTH_GOOGLE_SECRET;

if (!supabaseUrl || !accessToken || !googleClientId || !googleSecret) {
  throw new Error("Faltan credenciales para configurar Supabase Auth");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const siteUrl = "https://ruta-clara.casi40tech.lat";
const redirectUrls = [
  "https://ruta-clara.casi40tech.lat/**",
  "https://rutaclara-pep7q72r.manus.space/**",
  "https://3000-iyqhnvfnwgabwhp9iybgt-71f9f4ea.us4.manus.computer/**",
  "http://localhost:3000/**",
];

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    site_url: siteUrl,
    uri_allow_list: redirectUrls.join(","),
    external_google_enabled: true,
    external_google_client_id: googleClientId,
    external_google_secret: googleSecret,
    refresh_token_rotation_enabled: true,
    security_refresh_token_reuse_interval: 10,
    password_min_length: 8,
  }),
});

const body = await response.text();
if (!response.ok) throw new Error(`No se pudo configurar Auth (${response.status}): ${body}`);
console.log(JSON.stringify({ projectRef, siteUrl, redirectUrls, googleEnabled: true }, null, 2));
