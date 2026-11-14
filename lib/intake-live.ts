import {
  cardPoolCheck,
  INTAKE_OUTPUT_SCHEMA,
  INTAKE_SYSTEM_PROMPT,
  poolSummary,
  sanitizeDraft,
  type CardPoolCheck,
  type NeedDraft,
} from "./intake";
import type { Talent } from "./types";

/**
 * Live voice intake (Gemini Live API). Shared by the token route (server) and the browser.
 *
 * The company talks to Gemini in real time. Gemini fills the need card by calling
 * `update_need_card`; the browser checks the card, applies it and answers with aggregate
 * pool counts only. Gemini never sees any individual's data, the same rule as the text chat.
 */

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";

/** Hard cap on one live session. The token stops working after this. */
export const LIVE_SESSION_MINUTES = 10;

export const UPDATE_CARD_TOOL = "update_need_card";

/** The tool takes the whole card, with the same enums as the text chat (cached ESCO ids only). */
export const LIVE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: UPDATE_CARD_TOOL,
        description:
          "Replace the company's need card with this complete, updated version. Call it every time anything on the card changes. The reply gives aggregate counts of how many people at the event fit the card.",
        parametersJsonSchema: INTAKE_OUTPUT_SCHEMA().properties.draft,
      },
    ],
  },
];

export function liveSystemPrompt(draft: NeedDraft, pool: Talent[]) {
  return `This is a LIVE VOICE conversation. The company representative speaks to you and hears your answers.

Voice rules (these override the chat rules below):
- Speak naturally and briefly: one or two short sentences, then one question. No lists, no markdown, no skill ids out loud; say skill labels.
- Ignore everything below about "reply", "quick_replies" and "ready": there are no suggested answers in voice.
- Instead of returning a JSON draft, call the ${UPDATE_CARD_TOOL} tool with the complete card whenever anything on it changes, before you speak about the change. Its reply has aggregate counts (people, relevant, people per must-have skill, language and way-of-working counts). You may mention those numbers ("four people at this event have all three must-haves"). They are counts only; never imply you know who anyone is.
- If the user interrupts, stop and listen.
- Never say tool names, function calls, JSON or field names out loud. Tool calls are silent.
- Don't call the tool during the greeting or before the user has said anything about the role.
- Start by greeting them in one sentence and asking who they would like to meet at the event.

${INTAKE_SYSTEM_PROMPT()}

<current_need_card>
${JSON.stringify(draft, null, 2)}
</current_need_card>

<pool_summary>
${JSON.stringify(poolSummary(pool))}
</pool_summary>`;
}

/** Validate a tool call's card. Same rules as the text chat: only cached skill ids survive. */
export function cardFromToolArgs(args: unknown): NeedDraft {
  return sanitizeDraft((args && typeof args === "object" ? args : {}) as Partial<NeedDraft>);
}

/** What the browser tells Gemini after applying a card: counts only. */
export function liveToolResult(
  draft: NeedDraft,
  pool: Talent[],
): { ok: true; card_pool: CardPoolCheck } & Record<string, unknown> {
  return { ok: true, card_pool: cardPoolCheck(draft, pool) };
}
