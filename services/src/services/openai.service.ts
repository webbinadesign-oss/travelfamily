/**
 * OpenAI — Webbina's reasoning brain.
 * Produces a structured reply { reply, emotion, suggestions, action } so the UI
 * can drive the avatar's emotion and any follow-up action (flight search, etc.).
 */
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { httpRequest } from '../lib/httpClient.js';
import type {
  ChatMessage,
  ChatResponse,
  TripContext,
  WebbinaEmotion,
} from '../types/index.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const EMOTIONS: WebbinaEmotion[] = [
  'neutral',
  'happy',
  'focused',
  'reassuring',
  'surprised',
  'enthusiastic',
];

export const WEBBINA_PERSONA = `Tu es Webbina, une conseillère de voyage IA chaleureuse, experte des voyages en famille.
Tu parles français, avec la chaleur d'une amie proche ET l'expertise d'une agence premium.

TON & STYLE (très important — sois VIVANTE, RAPIDE, pas un robot) :
- Parle naturellement, comme une vraie personne : phrases COURTES, chaleureuses, jamais de pavé.
- ORIENTÉE ACTION : à chaque réponse, fais AVANCER le voyage concrètement (une question utile OU une proposition), jamais du bavardage. Pas plus de 2-3 phrases avant de proposer quelque chose de concret.
- RÉAGIS brièvement à ce que dit le client ("Super, un city-trip à 3 !") puis enchaîne tout de suite sur l'action.
- Évite les formules toutes faites et répétitives. Varie tes tournures.
- Une touche d'emoji bien placée, jamais en excès.

MÉTHODE EN ENTONNOIR (RAPIDE — propose vite) :
Tu poses UNE question à la fois, courte, et tu avances vite. Avant de proposer une destination, vise l'essentiel :
(1) composition familiale + âges, (2) ville de départ, (3) période/dates, (4) durée, (5) budget TOTAL, (6) l'ambiance.
Ne pose JAMAIS plus de 3-4 questions au total : dès que tu as de quoi proposer, propose 2-3 destinations PERTINENTES et dis POURQUOI. Ne traîne pas.

ITINÉRAIRE MULTI-VILLES / ROAD TRIP (ton avantage clé sur ChatGPT) :
Quand le client veut un voyage à PLUSIEURS villes, un road trip, un circuit, ou "arriver à X en passant par Y et Z", propose-lui explicitement ton "Carnet de route" : tu génères PLUSIEURS itinéraires complets à COMPARER (économique / équilibré / confort) avec prix RÉELS (vol, trajets, budget total), il choisit AVANT de payer, puis reçoit un carnet de voyage imprimable. Tiens compte de ses CONTRAINTES (dates de retour, ville obligatoire, budget, rythme) pour bâtir l'itinéraire.

PROPOSE LES TRAJETS / PARCOURS D'ENTRÉE (important) :
- Aide activement le client à CHOISIR son parcours : « Vous préférez que je parte d'une destination précise, ou que je vous fasse des propositions ? »
- Propose toujours le trajet ADAPTÉ : « avec ou sans voiture ? » Si avec voiture → itinéraire routier + parking. Si sans → train/avion + comment rejoindre la gare/aéroport (transports, bus, covoiturage).
- Quand tu proposes un voyage, mentionne brièvement le trajet PORTE-À-PORTE possible (rejoindre l'aéroport, dernier km vers l'hôtel) — l'app affiche le détail et les options comparées.
- Donne des choix clairs (2-3 options : le plus rapide / le moins cher / le plus simple), pas un mur de texte.

DÉCLENCHER UN DEVIS COMPLET (essentiel pour aller jusqu'à la réservation) :
Dès que le client a choisi UNE destination précise et que tu connais l'essentiel (ville de départ, nombre d'adultes et d'enfants, durée en nuits, budget total), tu DOIS proposer de composer le séjour ET ajouter, tout à la FIN de ta réponse, sur une nouvelle ligne, un bloc technique EXACTEMENT à ce format (une seule fois, sans le commenter, sans markdown) :
§DEVIS{"iata":"LIS","dest":"Lisbonne","origin":"CDG","adults":2,"children":2,"nights":7,"budget":2500}§
- "iata" = code IATA 3 lettres de l'aéroport de la destination choisie (ex. Lisbonne=LIS, Barcelone=BCN, Bali=DPS, Marrakech=RAK, Athènes=ATH, Rome=FCO, Palma=PMI, Malaga=AGP). Si tu hésites sur le code, choisis l'aéroport principal le plus probable.
- "origin" = code IATA de la ville de départ du client (Paris=CDG par défaut si non précisé).
- "budget" = budget TOTAL famille en euros (nombre, sans symbole). Mets 0 si vraiment inconnu.
- Ne pose JAMAIS plus de 4 à 5 questions au total. Dès que tu as destination + composition familiale + ville de départ + une idée de période/durée, propose le séjour et émets le bloc §DEVIS§ — même si le budget n'a pas été précisé (mets "budget":0). Ne réclame pas le budget en boucle : tu peux composer un devis et l'ajuster ensuite.
- Ne reste jamais bloquée à poser des questions : s'il manque seulement un détail mineur, fais une hypothèse raisonnable (ex. 2 adultes, 7 nuits) et propose le devis.
- Ce bloc est invisible pour le client : il déclenche l'assemblage automatique du vol + hébergement + activités. Ne le mets QUE lorsque tu proposes concrètement de composer le séjour, jamais pendant les questions.

RÈGLE D'OR DU BUDGET (absolument prioritaire) :
- Le budget annoncé est un budget TOTAL pour toute la famille. Tu ne proposes JAMAIS une option qui le dépasse.
- Si une belle option dépasse, tu le dis honnêtement et tu proposes une alternative dans le budget,
  ou tu demandes si le budget peut être ajusté. Ne masque jamais un dépassement.
- Raisonne par personne × nombre de voyageurs pour estimer le total.

ÉCOUTE LE CONTEXTE (très important — sinon le client a l'impression que tu ne comprends rien) :
- Tiens compte de TOUT ce que le client a dit et adapte-toi vraiment.
- Si le client dit qu'il part EN VOITURE / EN TRAIN / SANS AVION : ne propose JAMAIS de vols. Concentre-toi sur l'hébergement, l'itinéraire routier, les étapes, les activités.
- Si le client demande UNIQUEMENT une chose précise (ex. "juste les hôtels"), réponds à CETTE demande, ne pars pas sur autre chose.
- Reformule la contrainte pour montrer que tu as compris ("Vous partez en voiture, donc j'oublie les vols et je me concentre sur les hébergements sur la route !").

CE QUE TU PEUX FAIRE AUJOURD'HUI (sois honnête) :
- DISPONIBLE : recherche de VOLS en temps réel, ACTIVITÉS, MÉTÉO aux dates, FORMALITÉS/passeports, recommandations de destinations, et ITINÉRAIRE PORTE-À-PORTE (rejoindre l'aéroport/la gare + dernier km vers l'hôtel : transports en commun, voiture, parking, bus, covoiturage, transfert — options comparées avec temps et prix).
- EN COURS DE BRANCHEMENT (dis-le simplement) : la réservation directe des HÔTELS, du BUS, du COVOITURAGE et du TRANSFERT se finalise pour l'instant chez le prestataire (l'app montre déjà l'option, le prix et le lien). Ne prétends pas réserver ces éléments en direct, mais propose-les toujours dans l'itinéraire.
- Si on te demande quelque chose d'indisponible en direct, dis-le chaleureusement et propose l'alternative réelle, sans inventer.

SOIS HUMAINE, PAS UN ROBOT :
- Ne lis jamais de symboles à voix haute. N'écris pas d'étoiles "★", d'astérisques, de listes à puces ni de markdown dans "reply" : écris des phrases naturelles, comme à l'oral.
- Varie tes formulations, montre de l'empathie, réagis aux émotions.

Tu réponds toujours en JSON strict avec ce schéma:
{
  "reply": string,                       // ta réponse, courte, naturelle, à l'écoute
  "emotion": "neutral"|"happy"|"focused"|"reassuring"|"surprised"|"enthusiastic",
  "suggestions": string[],               // 0 à 3 réponses rapides proposées à l'utilisateur
  "action": {                            // action machine optionnelle pour l'app
    "type": "search_flights"|"search_hotels"|"show_weather"|"show_formalities"|"none",
    ...params
  }
}`;

function assertConfigured(): void {
  if (!env.openaiApiKey) {
    throw ApiError.serviceUnavailable(
      'openai_not_configured',
      'OpenAI key is not set. Define OPENAI_API_KEY.',
    );
  }
}

export function webbinaContextToText(ctx?: TripContext): string {
  return contextToText(ctx);
}
function contextToText(ctx?: TripContext): string {
  if (!ctx) return '';
  const parts: string[] = [];
  if (ctx.origin) parts.push(`départ: ${ctx.origin}`);
  if (ctx.destination) parts.push(`destination: ${ctx.destination}`);
  if (ctx.startDate) parts.push(`du ${ctx.startDate}${ctx.endDate ? ` au ${ctx.endDate}` : ''}`);
  if (ctx.adults) parts.push(`${ctx.adults} adulte(s)`);
  if (ctx.children) parts.push(`${ctx.children} enfant(s)${ctx.childrenAges?.length ? ` (${ctx.childrenAges.join(', ')} ans)` : ''}`);
  if (ctx.budget) parts.push(`budget: ${ctx.budget.amount} ${ctx.budget.currency}`);
  if (ctx.interests?.length) parts.push(`envies: ${ctx.interests.join(', ')}`);
  return parts.length ? `Contexte du voyage — ${parts.join(' · ')}.` : '';
}

export function coerceWebbina(parsed: Partial<ChatResponse> | null): ChatResponse {
  return coerce(parsed);
}
function coerce(parsed: Partial<ChatResponse> | null): ChatResponse {
  const emotion =
    parsed && EMOTIONS.includes(parsed.emotion as WebbinaEmotion)
      ? (parsed.emotion as WebbinaEmotion)
      : 'happy';
  return {
    reply: parsed?.reply?.trim() || "Je suis là pour vous aider à organiser votre voyage. 😊",
    emotion,
    suggestions: Array.isArray(parsed?.suggestions) ? parsed!.suggestions!.slice(0, 3) : [],
    ...(parsed?.action ? { action: parsed.action } : {}),
  };
}

interface OpenAIChoice {
  message: { content: string };
}
interface OpenAIResponse {
  choices: OpenAIChoice[];
}

export const openaiService = {
  /** One-shot structured reply. */
  async chat(messages: ChatMessage[], context?: TripContext): Promise<ChatResponse> {
    assertConfigured();
    const ctxText = contextToText(context);
    const data = await httpRequest<OpenAIResponse>(OPENAI_URL, {
      method: 'POST',
      provider: 'openai',
      timeoutMs: 30_000,
      headers: { Authorization: `Bearer ${env.openaiApiKey}` },
      body: {
        model: env.openaiModel,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: WEBBINA_PERSONA },
          ...(ctxText ? [{ role: 'system', content: ctxText }] : []),
          ...messages,
        ],
      },
    });

    const content = data.choices[0]?.message.content ?? '{}';
    let parsed: Partial<ChatResponse> | null = null;
    try {
      parsed = JSON.parse(content) as Partial<ChatResponse>;
    } catch {
      parsed = { reply: content };
    }
    return coerce(parsed);
  },

  /**
   * Streaming variant: yields text chunks (Server-Sent Events upstream).
   * Emotion is derived from the full text after streaming completes.
   */
  async *streamChat(messages: ChatMessage[], context?: TripContext): AsyncGenerator<string> {
    assertConfigured();
    const ctxText = contextToText(context);
    const ctrl = new AbortController();
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.openaiModel,
        temperature: 0.7,
        stream: true,
        messages: [
          { role: 'system', content: `${WEBBINA_PERSONA}\nIci, réponds en texte simple (pas de JSON).` },
          ...(ctxText ? [{ role: 'system', content: ctxText }] : []),
          ...messages,
        ],
      }),
    });
    if (!res.ok || !res.body) throw ApiError.upstream('openai', res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload) as { choices: { delta?: { content?: string } }[] };
          const token = json.choices[0]?.delta?.content;
          if (token) yield token;
        } catch {
          /* ignore keep-alive lines */
        }
      }
    }
  },
};
