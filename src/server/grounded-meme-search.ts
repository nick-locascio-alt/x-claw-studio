import * as cheerio from "cheerio";
import { Type, GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, loadEnv } from "@/src/lib/env";
import type { MemeTemplateResearch } from "@/src/lib/meme-template";

loadEnv();

const groundedMemeModel = process.env.GROUNDED_MEME_MODEL || "gemini-2.5-flash";

function toAbsoluteUrl(input: string, baseUrl: string): string | null {
  try {
    return new URL(input, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  return Array.from(new Set(urls.filter((value): value is string => Boolean(value))));
}

export async function researchGroundedMemePage(label: string): Promise<MemeTemplateResearch> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const response = await ai.models.generateContent({
    model: groundedMemeModel,
    contents: [
      "You are finding a meme-template or reference-asset page for later local import.",
      "Use Google Search grounding.",
      "Prefer pages that contain the canonical template image, multiple examples, or a clear explainer of how the meme is used.",
      "If the meme is not on meming.world, choose the best alternate page on the public web.",
      "Return JSON only.",
      `Requested meme or asset label: ${label}`,
      "",
      "Return this shape:",
      JSON.stringify(
        {
          pageUrl: "https://example.com/page",
          title: "Canonical title",
          alternateNames: ["alias one", "alias two"],
          matchReason: "brief reason this page is the best fallback source"
        },
        null,
        2
      )
    ].join("\n"),
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pageUrl: { type: Type.STRING },
          title: { type: Type.STRING },
          alternateNames: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          matchReason: { type: Type.STRING }
        },
        required: ["pageUrl", "title", "alternateNames", "matchReason"]
      }
    }
  });

  const parsed = JSON.parse(response.text ?? "{}") as MemeTemplateResearch;
  return {
    pageUrl: parsed.pageUrl,
    title: parsed.title,
    alternateNames: parsed.alternateNames ?? [],
    matchReason: parsed.matchReason
  };
}

export async function fetchGenericMemePage(input: { pageUrl: string }): Promise<{
  title: string;
  about: string | null;
  origin: string | null;
  meaning: string | null;
  baseTemplateImageUrls: string[];
  exampleImageUrls: string[];
}> {
  const response = await fetch(input.pageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${input.pageUrl}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const title =
    normalizeText(
      $("meta[property='og:title']").attr("content") ??
        $("meta[name='twitter:title']").attr("content") ??
        $("title").first().text() ??
        $("h1").first().text() ??
        ""
    ) || input.pageUrl;

  const metaDescription = normalizeText(
    $("meta[name='description']").attr("content") ??
      $("meta[property='og:description']").attr("content") ??
      ""
  );

  const paragraphs = $("article p, main p, .content p, .post p, .entry-content p, p")
    .toArray()
    .map((element) => normalizeText($(element).text()))
    .filter(Boolean)
    .slice(0, 8);
  const about = [metaDescription, ...paragraphs].filter(Boolean).join("\n\n").trim() || null;

  const metaImages = uniqueUrls([
    $("meta[property='og:image']").attr("content"),
    $("meta[name='twitter:image']").attr("content"),
    $("link[rel='image_src']").attr("href")
  ].map((url) => (url ? toAbsoluteUrl(url, input.pageUrl) : null)));

  const inlineImages = uniqueUrls(
    $("img")
      .toArray()
      .map((element) =>
        toAbsoluteUrl(
          $(element).attr("src") ?? $(element).attr("data-src") ?? $(element).attr("srcset")?.split(",")[0]?.trim().split(" ")[0] ?? "",
          input.pageUrl
        )
      )
  ).filter((url) => !url.includes(".svg"));

  return {
    title,
    about,
    origin: null,
    meaning: null,
    baseTemplateImageUrls: metaImages.slice(0, 2),
    exampleImageUrls: inlineImages.filter((url) => !metaImages.includes(url)).slice(0, 4)
  };
}
