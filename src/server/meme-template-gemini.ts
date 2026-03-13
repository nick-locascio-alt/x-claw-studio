import type { MemeTemplateResearch, MemeTemplateSummary } from "@/src/lib/meme-template";
import {
  memeTemplateResearchSchema,
  memeTemplateSummarySchema
} from "@/src/lib/meme-template";
import { parseGeminiJsonResponse, runGeminiPrompt } from "@/src/server/gemini-cli-json";

const STOP_SLOP_SKILL_PATH = "@.agents/skills/stop-slop/SKILL.md";

export async function researchMemingWorldMeme(label: string): Promise<MemeTemplateResearch> {
  const prompt = [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    "Find the best matching meme page on https://en.meming.world for the requested meme label.",
    "Use Meming Wiki / meming.world as the target source.",
    "Return raw JSON only.",
    "Do not invent URLs.",
    "",
    `Requested meme label: ${label}`,
    "",
    "Return JSON with this shape:",
    JSON.stringify(
      {
        pageUrl: "https://en.meming.world/wiki/Example",
        title: "Canonical meme title",
        alternateNames: ["alias one", "alias two"],
        matchReason: "brief reason this page is the best match"
      },
      null,
      2
    )
  ].join("\n");

  const stdout = await runGeminiPrompt(prompt);
  return parseGeminiJsonResponse(stdout, (value) => memeTemplateResearchSchema.parse(value));
}

export async function summarizeMemingWorldMeme(input: {
  label: string;
  title: string;
  about: string | null;
  origin: string | null;
  meaning: string | null;
}): Promise<MemeTemplateSummary> {
  const prompt = [
    `Before answering, load and follow ${STOP_SLOP_SKILL_PATH}.`,
    "Summarize how this meme is generally used.",
    "Use the provided Meming Wiki text as source context.",
    "Return raw JSON only.",
    "",
    `Requested label: ${input.label}`,
    `Canonical title: ${input.title}`,
    `About: ${input.about ?? "unknown"}`,
    `Origin: ${input.origin ?? "unknown"}`,
    `Meaning: ${input.meaning ?? "unknown"}`,
    "",
    "Return JSON with this shape:",
    JSON.stringify(
      {
        usageSummary: "short summary of general use",
        commonUseCases: ["use case one", "use case two"],
        whyItWorks: "short explanation of why the format works",
        toneTags: ["tag one", "tag two"]
      },
      null,
      2
    )
  ].join("\n");

  const stdout = await runGeminiPrompt(prompt);
  return parseGeminiJsonResponse(stdout, (value) => memeTemplateSummarySchema.parse(value));
}
