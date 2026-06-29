import { Router } from 'express';
import { env, integrationStatus } from '../config/env.js';
import { flightsRouter } from './flights.routes.js';
import { chatRouter } from './chat.routes.js';
import { voiceRouter } from './voice.routes.js';
import { placesRouter } from './places.routes.js';
import { weatherRouter } from './weather.routes.js';
import { memoryRouter } from './memory.routes.js';
import { coherenceRouter } from './coherence.routes.js';
import { bookingRouter } from './booking.routes.js';
import { dealsRouter } from './deals.routes.js';
import { packageRouter } from './package.routes.js';
import { travelpayoutsRouter } from './travelpayouts.routes.js';
import { loyaltyRouter } from './loyalty.routes.js';
import { adminRouter } from './admin.routes.js';
import { supportRouter } from './support.routes.js';
import { watchRouter } from './watch.routes.js';
import { formalitiesRouter } from './formalities.routes.js';
import { itineraryRouter } from './itinerary.routes.js';

export const apiRouter = Router();

/** Build marker — bump when you deploy so you can confirm the live version. */
export const BUILD_VERSION = 'phase3-itinerary-2';

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
    stripePublishableKey: env.stripePublishableKey || '',
    paymentEnabled: Boolean(env.stripeSecretKey && env.stripePublishableKey),
    travelpayoutsMarker: env.travelpayoutsMarker || '',
    travelpayoutsData: Boolean(env.travelpayoutsToken),
  });
});

apiRouter.use('/chat', chatRouter); // OpenAI — Webbina's brain
apiRouter.use('/voice', voiceRouter); // ElevenLabs — voice + agent
apiRouter.use('/flights', flightsRouter); // Amadeus — flights & hotels
apiRouter.use('/places', placesRouter); // Google Maps — places
apiRouter.use('/weather', weatherRouter); // OpenWeather — weather
apiRouter.use('/memory', memoryRouter); // Supabase — Webbina Memory
apiRouter.use('/coherence', coherenceRouter); // Itinerary timing engine (J+1, connections, hotel nights)
apiRouter.use('/booking', bookingRouter); // Pricing/commission + Stripe payment
apiRouter.use('/deals', dealsRouter); // Bon plan du jour — deal discovery
apiRouter.use('/package', packageRouter); // Package intelligent — vol+hôtel+activités assemblés
apiRouter.use('/tp', travelpayoutsRouter); // Travelpayouts Data API — vrais prix + meilleures dates
apiRouter.use('/loyalty', loyaltyRouter); // Récompenses Webbina — cagnotte + paliers (auto depuis saved_trips)
apiRouter.use('/admin', adminRouter); // Espace Gérante — gestion clients, SAV, gestes (allowlist)
apiRouter.use('/support', supportRouter); // SAV — création de ticket depuis l'app
apiRouter.use('/watch', watchRouter); // Alerte baisse de prix (Premium)
apiRouter.use('/formalities', formalitiesRouter); // Formalités réelles (Gemini, dynamique)
apiRouter.use('/itinerary', itineraryRouter); // Itinéraire porte-à-porte multimodal (Google Routes)
