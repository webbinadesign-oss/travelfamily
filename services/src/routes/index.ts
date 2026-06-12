import { Router } from 'express';
import { integrationStatus } from '../config/env.js';
import { flightsRouter } from './flights.routes.js';
import { chatRouter } from './chat.routes.js';
import { voiceRouter } from './voice.routes.js';
import { placesRouter } from './places.routes.js';
import { weatherRouter } from './weather.routes.js';
import { memoryRouter } from './memory.routes.js';

export const apiRouter = Router();

/** Liveness + which integrations are configured. */
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), integrations: integrationStatus() });
});

apiRouter.use('/chat', chatRouter); // OpenAI — Webbina's brain
apiRouter.use('/voice', voiceRouter); // ElevenLabs — voice + agent
apiRouter.use('/flights', flightsRouter); // Amadeus — flights & hotels
apiRouter.use('/places', placesRouter); // Google Maps — places
apiRouter.use('/weather', weatherRouter); // OpenWeather — weather
apiRouter.use('/memory', memoryRouter); // Supabase — Webbina Memory
