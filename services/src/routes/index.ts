import { Router } from 'express';
import { env, integrationStatus } from '../config/env.js';
import { flightsRouter } from './flights.routes.js';
import { chatRouter } from './chat.routes.js';
import { voiceRouter } from './voice.routes.js';
import { placesRouter } from './places.routes.js';
import { weatherRouter } from './weather.routes.js';
import { memoryRouter } from './memory.routes.js';

export const apiRouter = Router();

/** Build marker — bump when you deploy so you can confirm the live version. */
export const BUILD_VERSION = 'phase3-duffel-1';

/** Liveness + which integrations are configured + build version. */
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: BUILD_VERSION, uptime: process.uptime(), integrations: integrationStatus() });
});

/** Public config for the browser client (anon key is safe to expose). */
apiRouter.get('/config', (_req, res) => {
  res.json({
    supabaseUrl: env.supabaseUrl.replace(/\/rest\/v1\/?$/, ''),
    supabaseAnonKey: env.supabaseAnonKey || '',
    authEnabled: Boolean(env.supabaseUrl && env.supabaseAnonKey),
    elevenAgentId: env.elevenLabsAgentId,
  });
});

apiRouter.use('/chat', chatRouter); // OpenAI — Webbina's brain
apiRouter.use('/voice', voiceRouter); // ElevenLabs — voice + agent
apiRouter.use('/flights', flightsRouter); // Amadeus — flights & hotels
apiRouter.use('/places', placesRouter); // Google Maps — places
apiRouter.use('/weather', weatherRouter); // OpenWeather — weather
apiRouter.use('/memory', memoryRouter); // Supabase — Webbina Memory
