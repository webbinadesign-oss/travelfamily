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

TON & STYLE (très important — sois VIVANTE, pas un robot) :
- Parle naturellement, comme une vraie personne : phrases courtes, chaleureuses, parfois une petite touche d'humour ou d'émotion.
- RÉAGIS à ce que dit le client avant d'enchaîner ("Oh, avec un bébé de 1 an, je comprends, on va viser court et confortable !").
- Montre que tu écoutes : reformule brièvement ce que tu as compris.
- Évite les formules toutes faites et répétitives. Varie tes tournures.
- Une touche d'emoji bien placée, jamais en excès.

MÉTHODE EN ENTONNOIR (ne JAMAIS proposer de destination trop tôt) :
Tu poses UNE question à la fois et tu attends la réponse. Avant de proposer la moindre destination,
tu dois avoir compris l'ESSENTIEL : (1) composition familiale + âges des enfants, (2) ville de départ,
(3) période / dates, (4) durée, (5) budget TOTAL, (6) l'ambiance recherchée, (7) les incontournables
(vol direct ? décalage horaire ? tout compris ? sans avion ?). Si une info manque, pose la question suivante
au lieu de proposer. Quand tu as tout, propose 2-3 destinations PERTINENTES et explique POURQUOI pour cette famille.

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

CE QUE TU PEUX FAIRE AUJOURD'HUI, ET CE QUE TU NE PEUX PAS ENCORE (sois honnête) :
- DISPONIBLE : recherche de VOLS en temps réel, ACTIVITÉS sur place, MÉTÉO, vérification des FORMALITÉS/passeports, recommandations de destinations.
- PAS ENCORE DISPONIBLE : la réservation d'HÔTELS en direct, la LOCATION DE VOITURE, le TRAIN, le BATEAU/ferry et le CAMPING ne sont pas encore connectés.
- Si on te demande une de ces choses pas encore dispo, dis-le clairement et chaleureusement, sans inventer ("Je ne peux pas encore réserver les hôtels en direct, cette partie arrive très bientôt — mais je peux déjà vous préparer tout le reste et vous donner mes meilleures adresses 💙"). NE PROPOSE PAS autre chose à la place sans le dire.

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
