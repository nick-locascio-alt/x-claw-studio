import { z } from "zod";

export const memeTemplateResearchSchema = z.object({
  pageUrl: z.string().url(),
  title: z.string().min(1).max(200),
  alternateNames: z.array(z.string().min(1).max(120)).max(8),
  matchReason: z.string().min(1).max(280)
});

export type MemeTemplateResearch = z.infer<typeof memeTemplateResearchSchema>;

export const memeTemplateSummarySchema = z.object({
  usageSummary: z.string().min(1).max(400),
  commonUseCases: z.array(z.string().min(1).max(180)).min(2).max(6),
  whyItWorks: z.string().min(1).max(400),
  toneTags: z.array(z.string().min(1).max(60)).min(2).max(8)
});

export type MemeTemplateSummary = z.infer<typeof memeTemplateSummarySchema>;

export interface MemeTemplateAssetRecord {
  kind: "base_template" | "example";
  sourceUrl: string;
  localFilePath: string;
  caption: string | null;
}

export interface MemeTemplateRecord {
  templateId: string;
  key: string;
  label: string;
  source: "meming_world" | "grounded_web";
  pageUrl: string;
  title: string;
  alternateNames: string[];
  matchReason: string;
  about: string | null;
  origin: string | null;
  meaning: string | null;
  usageSummary: string;
  commonUseCases: string[];
  whyItWorks: string;
  toneTags: string[];
  baseTemplate: MemeTemplateAssetRecord | null;
  examples: MemeTemplateAssetRecord[];
  importedAt: string;
  updatedAt: string;
}

export type MemeTemplateImportStage =
  | "starting"
  | "researching"
  | "fetching_page"
  | "resolving_assets"
  | "summarizing"
  | "downloading_assets"
  | "saving"
  | "completed";

export interface MemeTemplateImportProgressEvent {
  stage: MemeTemplateImportStage;
  message: string;
  detail?: string | null;
  key?: string | null;
}
