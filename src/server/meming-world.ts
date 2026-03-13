import * as cheerio from "cheerio";

function absoluteUrl(url: string): string {
  return new URL(url, "https://en.meming.world").toString();
}

function getSectionText($: cheerio.CheerioAPI, headingLabel: string): string | null {
  const heading = $("h2")
    .toArray()
    .find((element) => $(element).text().trim() === headingLabel);

  if (!heading) {
    return null;
  }

  let node = heading.nextSibling;
  const parts: string[] = [];

  while (node) {
    if (node.type === "tag" && node.tagName?.toLowerCase() === "h2") {
      break;
    }

    if (node.type === "tag") {
      const text = $(node).text().trim().replace(/\s+/g, " ");
      if (text) {
        parts.push(text);
      }
    }

    node = node.nextSibling;
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}

async function resolveOriginalImageUrl(filePageUrl: string): Promise<string | null> {
  const html = await fetch(filePageUrl).then((response) => response.text());
  const $ = cheerio.load(html);
  const href =
    $(".fullImageLink a.internal").attr("href") ??
    $(".fullImageLink a").first().attr("href") ??
    null;

  return href ? absoluteUrl(href) : null;
}

export async function fetchMemingWorldPage(input: { pageUrl: string }): Promise<{
  title: string;
  about: string | null;
  origin: string | null;
  meaning: string | null;
  baseTemplateFilePageUrls: string[];
  exampleFilePageUrls: string[];
}> {
  const html = await fetch(input.pageUrl).then((response) => response.text());
  const $ = cheerio.load(html);
  const title = $("h1.firstHeading").text().trim();
  const about = getSectionText($, "About");
  const origin = getSectionText($, "Origin");
  const meaning = getSectionText($, "Meaning");

  const baseTemplateFilePageUrls = $(".mw-parser-output > .thumb .thumbinner > a.image")
    .toArray()
    .map((element) => $(element).attr("href"))
    .filter((value): value is string => Boolean(value))
    .map((href) => absoluteUrl(href))
    .slice(0, 2);

  const examplesHeading = $("h2")
    .toArray()
    .find((element) => $(element).text().trim() === "Examples");

  const exampleFilePageUrls: string[] = [];
  let node = examplesHeading?.nextSibling ?? null;
  while (node) {
    if (node.type === "tag" && node.tagName?.toLowerCase() === "h2") {
      break;
    }

    if (node.type === "tag") {
      for (const anchor of $(node).find("a").toArray()) {
        const href = $(anchor).attr("href");
        if (href?.startsWith("/wiki/File:")) {
          exampleFilePageUrls.push(absoluteUrl(href));
        }
      }
    }

    node = node.nextSibling;
  }

  return {
    title,
    about,
    origin,
    meaning,
    baseTemplateFilePageUrls,
    exampleFilePageUrls: Array.from(new Set(exampleFilePageUrls)).slice(0, 4)
  };
}

export async function resolveMemingWorldAssets(input: {
  baseTemplateFilePageUrls: string[];
  exampleFilePageUrls: string[];
}): Promise<{
  baseTemplateImageUrls: string[];
  exampleImageUrls: string[];
}> {
  const baseTemplateImageUrls = (
    await Promise.all(input.baseTemplateFilePageUrls.map((url) => resolveOriginalImageUrl(url)))
  ).filter((value): value is string => Boolean(value));

  const exampleImageUrls = (
    await Promise.all(input.exampleFilePageUrls.map((url) => resolveOriginalImageUrl(url)))
  ).filter((value): value is string => Boolean(value));

  return {
    baseTemplateImageUrls: Array.from(new Set(baseTemplateImageUrls)),
    exampleImageUrls: Array.from(new Set(exampleImageUrls))
  };
}
