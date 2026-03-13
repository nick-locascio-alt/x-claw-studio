import {
  mediaPostDraftSchema,
  mediaPostPlanSchema,
  type MediaPostDraft,
  type MediaPostPlan,
  type MediaPostRequest,
  type MediaPostSubject
} from "@/src/lib/media-post-composer";
import type { ReplyMediaCandidate } from "@/src/lib/reply-composer";
import { parseGeminiJsonResponse, runGeminiPrompt } from "@/src/server/gemini-cli-json";
import { buildMediaPostPlanPrompt, buildMediaPostPrompt } from "@/src/server/media-post-composer-prompt";

export interface MediaPostComposerModel {
  providerId: string;
  planPost(input: {
    request: MediaPostRequest;
    subject: MediaPostSubject;
  }): Promise<MediaPostPlan>;
  composePost(input: {
    request: MediaPostRequest;
    subject: MediaPostSubject;
    plan: MediaPostPlan;
    candidates: ReplyMediaCandidate[];
  }): Promise<MediaPostDraft>;
}

export class GeminiCliMediaPostComposerModel implements MediaPostComposerModel {
  providerId = "gemini-cli";

  async planPost(input: {
    request: MediaPostRequest;
    subject: MediaPostSubject;
  }): Promise<MediaPostPlan> {
    const stdout = await runGeminiPrompt(buildMediaPostPlanPrompt(input));
    return parseGeminiJsonResponse(stdout, (value) => mediaPostPlanSchema.parse(value));
  }

  async composePost(input: {
    request: MediaPostRequest;
    subject: MediaPostSubject;
    plan: MediaPostPlan;
    candidates: ReplyMediaCandidate[];
  }): Promise<MediaPostDraft> {
    const stdout = await runGeminiPrompt(buildMediaPostPrompt(input));
    return parseGeminiJsonResponse(stdout, (value) => mediaPostDraftSchema.parse(value));
  }
}

export function createMediaPostComposerModel(): MediaPostComposerModel {
  return new GeminiCliMediaPostComposerModel();
}
