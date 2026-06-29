/**
 * Typed, validated environment configuration.
 * Secrets are read from process.env only — never hard-coded.
 */
import dotenv from 'dotenv';
dotenv.config();

function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}
function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function list(name: string, fallback: string[] = []): string[] {
  const v = process.env[name];
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;
}

export type AmadeusEnv = 'test' | 'production';

export interface Env {
  nodeEnv: string;
  isProd: boolean;
  port: number;
  corsOrigins: string[];

  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  geminiModel: string;

  elevenLabsApiKey: string;
  elevenLabsAgentId: string;
  elevenLabsVoiceId: string;

  amadeusEnv: AmadeusEnv;
  amadeusApiKey: string;
  amadeusApiSecret: string;

  duffelApiKey: string;
  duffelVersion: string;

  kiwiApiKey: string;

  googleApiKey: string;
  openWeatherApiKey: string;

  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseSchema: string;

  adminEmails: string[];      // e-mails autorisés à l'Espace Gérante (admin)
  claudeApiKey: string;       // Anthropic Claude — cerveau prioritaire de Webbina
  claudeModel: string;
  resendApiKey: string;       // Resend — envoi d'e-mails (confirmations)
  mailFrom: string;           // expéditeur des e-mails

  bookingApiUrl: string;
  bookingApiKey: string;

  exchangeRateApiKey: string;

  travelpayoutsToken: string;
  travelpayoutsMarker: string;

  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeCurrency: string;

  // Commission Webbina (transparente, paramétrable)
  flightFeePerPax: number;   // frais fixe €/voyageur (vols = comparés au centime)
  hotelMarkupPct: number;    // marge % sur hôtels
  activityMarkupPct: number; // marge % sur activités
  packageMarkupPct: number;  // marge % sur séjour assemblé
  carMarkupPct: number;      // marge % sur location de voiture
  transferMarkupPct: number; // marge % sur transferts
  trainFee: number;          // frais fixe € sur billets de train (prix transparent)
  minFee: number;            // plancher par réservation (€)
  maxMarkupPct: number;      // garde-fou : ne jamais dépasser ce % du total
}

export const env: Env = {
  nodeEnv: str('NODE_ENV', 'development'),
  get isProd() {
    return this.nodeEnv === 'production';
  },
  port: num('PORT', 8787),
  corsOrigins: list('CORS_ORIGINS', []),

  openaiApiKey: str('OPENAI_API_KEY'),
  openaiModel: str('OPENAI_MODEL', 'gpt-4o-mini'),
  geminiApiKey: str('GEMINI_API_KEY'),
  geminiModel: str('GEMINI_MODEL', 'gemini-2.5-flash'),

  elevenLabsApiKey: str('ELEVENLABS_API_KEY'),
  elevenLabsAgentId: str('ELEVENLABS_AGENT_ID', 'agent_0001kt43rqqte7ks86mzvavmacjs'),
  elevenLabsVoiceId: str('ELEVENLABS_VOICE_ID', '21m00Tcm4TlvDq8ikWAM'),

  amadeusEnv: (str('AMADEUS_ENV', 'test') as AmadeusEnv),
  amadeusApiKey: str('AMADEUS_API_KEY'),
  amadeusApiSecret: str('AMADEUS_API_SECRET'),

  duffelApiKey: str('DUFFEL_API_KEY'),
  duffelVersion: str('DUFFEL_VERSION', 'v2'),

  kiwiApiKey: str('KIWI_API_KEY') || str('TEQUILA_API_KEY'),

  googleApiKey: str('GOOGLE_CLOUD_API_KEY'),
  openWeatherApiKey: str('OPENWEATHER_API_KEY'),

  supabaseUrl: str('SUPABASE_URL'),
  supabaseAnonKey: str('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: str('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseSchema: str('SUPABASE_SCHEMA', 'public'),

  adminEmails: list('ADMIN_EMAILS', ['webbinadesign@gmail.com']),
  claudeApiKey: str('CLAUDE_API_KEY'),
  claudeModel: str('CLAUDE_MODEL', 'claude-sonnet-4-20250514'),
  resendApiKey: str('RESEND_API_KEY'),
  mailFrom: str('MAIL_FROM', 'TravelFamily.AI <onboarding@resend.dev>'),

  bookingApiUrl: str('BOOKING_API_URL', 'https://demandapi.booking.com/3.2'),
  bookingApiKey: str('BOOKING_API_KEY'),

  exchangeRateApiKey: str('EXCHANGERATE_API_KEY'),

  travelpayoutsToken: str('TRAVELPAYOUTS_TOKEN'),
  travelpayoutsMarker: str('TRAVELPAYOUTS_MARKER', '741019'),

  stripeSecretKey: str('STRIPE_SECRET_KEY'),
  stripePublishableKey: str('STRIPE_PUBLISHABLE_KEY'),
  stripeCurrency: str('STRIPE_CURRENCY', 'eur'),

  // Defaults: competitive + transparent. Override on Render to tune your margin.
  flightFeePerPax: num('FEE_FLIGHT_PER_PAX', 9),     // 9 € / voyageur
  hotelMarkupPct: num('FEE_HOTEL_PCT', 0.12),        // 12 %
  activityMarkupPct: num('FEE_ACTIVITY_PCT', 0.12),  // 12 %
  packageMarkupPct: num('FEE_PACKAGE_PCT', 0.07),    // 7 %
  carMarkupPct: num('FEE_CAR_PCT', 0.12),            // 12 %
  transferMarkupPct: num('FEE_TRANSFER_PCT', 0.18),  // 18 %
  trainFee: num('FEE_TRAIN', 4),                     // 4 € fixe (prix transparent)
  minFee: num('FEE_MIN', 5),                         // 5 € plancher
  maxMarkupPct: num('FEE_MAX_PCT', 0.20),            // 20 % garde-fou
} as Env;

/** Which integrations are configured (used by /health and graceful 503s). */
export function integrationStatus(): Record<string, boolean> {
  return {
    openai: Boolean(env.openaiApiKey),
    gemini: Boolean(env.geminiApiKey),
    claude: Boolean(env.claudeApiKey),
    elevenlabs: Boolean(env.elevenLabsApiKey),
    amadeus: Boolean(env.amadeusApiKey && env.amadeusApiSecret),
    duffel: Boolean(env.duffelApiKey),
    kiwi: Boolean(env.kiwiApiKey),
    google: Boolean(env.googleApiKey),
    weather: Boolean(env.openWeatherApiKey),
    supabase: Boolean(env.supabaseUrl && (env.supabaseServiceRoleKey || env.supabaseAnonKey)),
    booking: Boolean(env.bookingApiKey),
    exchangeRate: Boolean(env.exchangeRateApiKey),
    travelpayouts: Boolean(env.travelpayoutsToken),
    stripe: Boolean(env.stripeSecretKey),
  };
}

/** Warn (don't crash) about missing keys at startup. */
export function validateEnv(log: (msg: string) => void = console.warn): void {
  const status = integrationStatus();
  for (const [name, ok] of Object.entries(status)) {
    if (!ok) log(`[env] ${name} is not configured — its routes will return 503 until keys are set.`);
  }
}
