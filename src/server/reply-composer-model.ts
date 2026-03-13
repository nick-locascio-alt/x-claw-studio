import {
  replyCompositionDraftSchema,
  replyCompositionPlanSchema,
  type ReplyCompositionDraft,
  type ReplyCompositionPlan,
  type ReplyCompositionRequest,
  type ReplyComposerSubject,
  type ReplyMediaCandidate
} from "@/src/lib/reply-composer";
import { parseGeminiJsonResponse, runGeminiPrompt } from "@/src/server/gemini-cli-json";
import {
  buildReplyCompositionPlanPrompt,
  buildReplyCompositionPrompt
} from "@/src/server/reply-composer-prompt";

export interface ReplyComposerModel {
  providerId: string;
  planReply(input: {
    request: ReplyCompositionRequest;
    subject: ReplyComposerSubject;
  }): Promise<ReplyCompositionPlan>;
  composeReply(input: {
    request: ReplyCompositionRequest;
    subject: ReplyComposerSubject;
    plan: ReplyCompositionPlan;
    candidates: ReplyMediaCandidate[];
  }): Promise<ReplyCompositionDraft>;
}

export class GeminiCliReplyComposerModel implements ReplyComposerModel {
  providerId = "gemini-cli";

  async planReply(input: {
    request: ReplyCompositionRequest;
    subject: ReplyComposerSubject;
  }): Promise<ReplyCompositionPlan> {
    const stdout = await runGeminiPrompt(buildReplyCompositionPlanPrompt(input));
    return parseGeminiJsonResponse(stdout, (value) => replyCompositionPlanSchema.parse(value));
  }

  async composeReply(input: {
    request: ReplyCompositionRequest;
    subject: ReplyComposerSubject;
    plan: ReplyCompositionPlan;
    candidates: ReplyMediaCandidate[];
  }): Promise<ReplyCompositionDraft> {
    const stdout = await runGeminiPrompt(buildReplyCompositionPrompt(input));
    return parseGeminiJsonResponse(stdout, (value) => replyCompositionDraftSchema.parse(value));
  }
}

export function createReplyComposerModel(): ReplyComposerModel {
  return new GeminiCliReplyComposerModel();
}
