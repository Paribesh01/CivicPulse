import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
import {
  AFFECTED_SCOPES,
  HAZARD_SIGNALS,
  LANDMARK_TYPES,
  type Classification,
  type HazardSignal,
  type RouteWithDepartment,
} from "./types";

/// Groq serves open models behind an OpenAI-compatible API. `gpt-oss-120b`
/// supports strict JSON-schema output, which is what lets us hand it a closed
/// taxonomy and get back something we can route on without post-processing.
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/// Kept local rather than importing from the i18n barrel: this module must not
/// pull `next/headers` into the pipeline.
export type SupportedLocale = "en" | "hi";

let client: Groq | null = null;
function getClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  client ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

/// The taxonomy is a closed set drawn from the CategoryRoute table, so the
/// model can only return a category some department actually owns.
function buildSchema(routes: RouteWithDepartment[]) {
  const keys = routes.map((r) => r.key) as [string, ...string[]];

  return z.object({
    category_key: z
      .enum(keys)
      .describe("The single best-fitting category from the taxonomy."),
    sub_category: z
      .string()
      .describe("A short free-text refinement, e.g. 'pole out'. Max 6 words."),
    intent_summary: z
      .string()
      .describe(
        "One neutral sentence in ENGLISH restating what the citizen is asking for. This is read by officers.",
      ),
    citizen_summary: z
      .string()
      .describe(
        "The same understanding written back to the citizen in THEIR language, simply, as one short sentence. Start with what is broken and where.",
      ),
    clarifying_question: z
      .string()
      .nullable()
      .describe(
        "If something important is missing — usually the exact location or landmark — ask ONE short, simple question in the citizen's language. Null if nothing important is missing.",
      ),
    confidence: z
      .number()
      .describe("0-1. How certain you are of category_key specifically."),
    location_text: z
      .string()
      .nullable()
      .describe(
        "The location phrase exactly as the citizen wrote it, e.g. 'near XYZ school'. Null if none.",
      ),
    landmark_type: z
      .enum(LANDMARK_TYPES)
      .describe("What kind of place the complaint is near, if stated."),
    reported_duration_days: z
      .number()
      .nullable()
      .describe(
        "How long the citizen says the problem has persisted, in days. 'since morning' is 0. Null if not stated.",
      ),
    hazard_signals: z
      .array(z.enum(HAZARD_SIGNALS))
      .describe("Every danger cue the text actually supports. Empty if none."),
    affected_scope: z
      .enum(AFFECTED_SCOPES)
      .describe("How many people the described problem plausibly affects."),
    language: z
      .string()
      .describe("BCP-47 tag of the language the complaint was written in."),
  });
}

/// One source of truth: the same zod schema constrains the model's output and
/// validates what comes back, so the two can't drift apart.
function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  // Groq rejects the dialect marker inside a json_schema payload.
  delete json.$schema;
  return json;
}

function buildSystemPrompt(
  routes: RouteWithDepartment[],
  locale: SupportedLocale,
): string {
  const taxonomy = routes
    .map(
      (r) =>
        `- ${r.key} (${r.group} › ${r.label}) → ${r.department.name}` +
        (r.keywords.length ? ` [cues: ${r.keywords.join(", ")}]` : ""),
    )
    .join("\n");

  const citizenLanguage =
    locale === "hi"
      ? "Hindi (Devanagari script). Use simple everyday Hindi, not formal government vocabulary."
      : "English. Use simple everyday English, short words, no jargon.";

  return [
    "You are the intake triage step of a municipal complaint system in India.",
    "You read one citizen complaint and extract structured fields from it.",
    "",
    "Rules:",
    "- Pick exactly one category_key from the taxonomy below. Never invent one.",
    "- If the complaint genuinely fits nothing, use the closest general category and set confidence below 0.4.",
    "- Only report hazard_signals the text explicitly supports. Do not infer danger that is not described — a dark street is not automatically a fall risk unless the citizen says someone could fall.",
    "- Complaints arrive in English, Hindi and Hinglish. Read them all.",
    "- intent_summary is always ENGLISH (officers read it).",
    `- citizen_summary and clarifying_question are always written in ${citizenLanguage}`,
    "- Ask a clarifying_question ONLY when something important is genuinely missing, and above all when there is no usable location. Never ask for something the citizen already said.",
    "- Do not judge whether the complaint is worth acting on. Extraction only.",
    "",
    "Taxonomy:",
    taxonomy,
  ].join("\n");
}

/// Term matching against CategoryRoute.keywords. Used when no API key is set
/// and when the API call fails, so intake never hard-fails on the model.
export function classifyByKeyword(
  text: string,
  routes: RouteWithDepartment[],
): Classification {
  const haystack = text.toLowerCase();

  let best: { route: RouteWithDepartment; hits: number } | null = null;
  for (const route of routes) {
    const terms = [...route.keywords, route.label].map((t) => t.toLowerCase());
    const hits = terms.filter((t) => t && haystack.includes(t)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { route, hits };
  }

  const duration = extractDurationDays(text);
  const hazardSignals: HazardSignal[] = [];
  if (/\b(school|college|anganwadi|children|kids)\b/i.test(text))
    hazardSignals.push("CHILDREN_AFFECTED");
  if (/\b(hospital|clinic|elderly|disabled)\b/i.test(text))
    hazardSignals.push("VULNERABLE_GROUP");
  if (/\b(wire|shock|electric|spark)\b/i.test(text))
    hazardSignals.push("EXPOSED_ELECTRICITY");

  return {
    categoryKey: best?.route.key ?? routes[routes.length - 1]?.key ?? "other",
    subCategory: "",
    intentSummary: text.slice(0, 180),
    // The citizen's own words are already in the citizen's language, so the
    // fallback echoes them rather than inventing a summary it cannot phrase.
    citizenSummary: text.slice(0, 180),
    // Without the model we cannot phrase a question in the right language, and
    // a generic English prompt is worse than none — the location step asks anyway.
    clarifyingQuestion: null,
    // Deliberately low: a keyword guess should land in the review queue
    // rather than silently route like a confident classification.
    confidence: best ? 0.35 : 0.1,
    locationText: null,
    landmarkType: /\bschool|college\b/i.test(text)
      ? "SCHOOL"
      : /\bhospital|clinic\b/i.test(text)
        ? "HOSPITAL"
        : "NONE",
    reportedDurationDays: duration,
    hazardSignals,
    affectedScope: "STREET",
    language: "en",
    source: "keyword",
  };
}

/// "not working for 5 days" -> 5. Used by the fallback and as a backstop when
/// the model omits the field.
export function extractDurationDays(text: string): number | null {
  const m = text.match(
    /(\d+)\s*(hour|hr|day|din|week|hafta|month|mahina|year|saal)/i,
  );
  if (!m) return null;

  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("hour") || unit === "hr") return Math.round(n / 24);
  if (unit.startsWith("week") || unit === "hafta") return n * 7;
  if (unit.startsWith("month") || unit === "mahina") return n * 30;
  if (unit.startsWith("year") || unit === "saal") return n * 365;
  return n;
}

export async function classifyComplaint(
  text: string,
  routes: RouteWithDepartment[],
  locale: SupportedLocale = "en",
): Promise<Classification> {
  const groq = getClient();
  if (!groq || routes.length === 0) {
    return classifyByKeyword(text, routes);
  }

  const schema = buildSchema(routes);

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      // Extraction against a fixed taxonomy does not need deep reasoning, and
      // intake sits in the citizen's request path.
      reasoning_effort: "low",
      reasoning_format: "hidden",
      temperature: 0,
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: buildSystemPrompt(routes, locale) },
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "complaint_triage",
          strict: true,
          schema: toJsonSchema(schema),
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return classifyByKeyword(text, routes);

    // Strict mode should guarantee the shape, but a malformed response must
    // degrade to the fallback rather than throw inside intake.
    const parsed = schema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.warn("[classify] response failed validation:", parsed.error.message);
      return classifyByKeyword(text, routes);
    }

    const data = parsed.data;
    return {
      categoryKey: data.category_key,
      subCategory: data.sub_category,
      intentSummary: data.intent_summary,
      citizenSummary: data.citizen_summary,
      clarifyingQuestion: data.clarifying_question?.trim() || null,
      confidence: data.confidence,
      locationText: data.location_text,
      landmarkType: data.landmark_type,
      reportedDurationDays:
        data.reported_duration_days ?? extractDurationDays(text),
      hazardSignals: data.hazard_signals,
      affectedScope: data.affected_scope,
      language: data.language,
      source: "llm",
    };
  } catch (error) {
    // Intake must not fail because the model is unreachable. Degrade to
    // keyword routing and let the review flag surface it to a human.
    if (error instanceof Groq.APIError) {
      console.error(`[classify] Groq API error ${error.status}:`, error.message);
    } else {
      console.error("[classify] unexpected error:", error);
    }
    return classifyByKeyword(text, routes);
  }
}
