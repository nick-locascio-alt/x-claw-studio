import fs from "node:fs";
import path from "node:path";
import { slugify, writeJson } from "@/src/lib/fs";
import type {
  GeneratedDraftKind,
  GeneratedDraftOutputRecord,
  GeneratedDraftRecord,
  GeneratedDraftStatus
} from "@/src/lib/generated-drafts";
import type { MediaPostResult } from "@/src/lib/media-post-composer";
import type { ReplyCompositionBatchResult, ReplyCompositionResult } from "@/src/lib/reply-composer";
import type { TopicPostBatchResult, TopicPostResult } from "@/src/lib/topic-composer";

const projectRoot = process.cwd();
const generatedDraftsPath = path.join(projectRoot, "data", "analysis", "generated-drafts", "index.json");

function readDrafts(): GeneratedDraftRecord[] {
  if (!fs.existsSync(generatedDraftsPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(generatedDraftsPath, "utf8")) as GeneratedDraftRecord[];
}

function writeDrafts(records: GeneratedDraftRecord[]): void {
  writeJson(generatedDraftsPath, records);
}

function buildDraftId(kind: GeneratedDraftKind, seed: string): string {
  return `${kind}-${slugify(seed) || "draft"}-${Date.now()}`;
}

export function listGeneratedDrafts(filter?: {
  kind?: GeneratedDraftKind;
  usageId?: string | null;
  tweetId?: string | null;
  topicId?: string | null;
  limit?: number;
}): GeneratedDraftRecord[] {
  const records = readDrafts().filter((record) => {
    if (filter?.kind && record.kind !== filter.kind) {
      return false;
    }
    if (filter?.usageId && record.usageId !== filter.usageId) {
      return false;
    }
    if (filter?.tweetId && record.tweetId !== filter.tweetId) {
      return false;
    }
    if (filter?.topicId && record.topicId !== filter.topicId) {
      return false;
    }
    return true;
  });

  return records.slice(0, filter?.limit ?? 50);
}

export function createGeneratedDraft(input: {
  kind: GeneratedDraftKind;
  usageId?: string | null;
  tweetId?: string | null;
  topicId?: string | null;
  assetId?: string | null;
  requestGoal?: string | null;
  requestMode?: string | null;
  progressStage?: string | null;
  progressMessage?: string | null;
  progressDetail?: string | null;
}): GeneratedDraftRecord {
  const now = new Date().toISOString();
  const record: GeneratedDraftRecord = {
    draftId: buildDraftId(input.kind, input.usageId ?? input.topicId ?? input.tweetId ?? input.assetId ?? now),
    kind: input.kind,
    status: "running",
    createdAt: now,
    updatedAt: now,
    usageId: input.usageId ?? null,
    tweetId: input.tweetId ?? null,
    topicId: input.topicId ?? null,
    assetId: input.assetId ?? null,
    requestGoal: input.requestGoal ?? null,
    requestMode: input.requestMode ?? null,
    progressStage: input.progressStage ?? null,
    progressMessage: input.progressMessage ?? null,
    progressDetail: input.progressDetail ?? null,
    errorMessage: null,
    outputs: []
  };

  const current = readDrafts();
  writeDrafts([record, ...current]);
  return record;
}

export function updateGeneratedDraft(
  draftId: string,
  update: Partial<Pick<GeneratedDraftRecord, "status" | "progressStage" | "progressMessage" | "progressDetail" | "errorMessage" | "outputs">>
): GeneratedDraftRecord | null {
  const current = readDrafts();
  const index = current.findIndex((record) => record.draftId === draftId);
  if (index === -1) {
    return null;
  }

  current[index] = {
    ...current[index],
    ...update,
    status: (update.status ?? current[index].status) as GeneratedDraftStatus,
    updatedAt: new Date().toISOString()
  };
  writeDrafts(current);
  return current[index];
}

function buildReplyOutputs(result: ReplyCompositionResult | ReplyCompositionBatchResult): GeneratedDraftOutputRecord[] {
  const items = "results" in result ? result.results : [result];
  return items.map((item) => ({
    goal: item.request.goal,
    text: item.reply.text,
    whyThisWorks: item.reply.whyThisReplyWorks,
    mediaSelectionReason: item.reply.mediaSelectionReason,
    postingNotes: item.reply.postingNotes,
    selectedMediaLabel: item.selectedMedia?.sourceLabel ?? item.selectedMedia?.tweetText ?? null,
    selectedMediaSourceType: item.selectedMedia?.sourceType ?? null
  }));
}

function buildTopicOutputs(result: TopicPostResult | TopicPostBatchResult): GeneratedDraftOutputRecord[] {
  const items = "results" in result ? result.results : [result];
  return items.map((item) => ({
    goal: item.request.goal,
    text: item.tweet.text,
    whyThisWorks: item.tweet.whyThisTweetWorks,
    mediaSelectionReason: item.tweet.mediaSelectionReason,
    postingNotes: item.tweet.postingNotes,
    selectedMediaLabel: item.selectedMedia?.sourceLabel ?? item.selectedMedia?.tweetText ?? null,
    selectedMediaSourceType: item.selectedMedia?.sourceType ?? null
  }));
}

function buildMediaOutputs(result: MediaPostResult): GeneratedDraftOutputRecord[] {
  return [
    {
      goal: null,
      text: result.tweet.text,
      whyThisWorks: result.tweet.whyThisTweetWorks,
      mediaSelectionReason: result.tweet.mediaSelectionReason,
      postingNotes: result.tweet.postingNotes,
      selectedMediaLabel: result.selectedMedia?.sourceLabel ?? result.selectedMedia?.tweetText ?? null,
      selectedMediaSourceType: result.selectedMedia?.sourceType ?? null
    }
  ];
}

export function markGeneratedDraftComplete(input: {
  draftId: string;
  kind: GeneratedDraftKind;
  result: ReplyCompositionResult | ReplyCompositionBatchResult | TopicPostResult | TopicPostBatchResult | MediaPostResult;
}): GeneratedDraftRecord | null {
  const outputs =
    input.kind === "reply"
      ? buildReplyOutputs(input.result as ReplyCompositionResult | ReplyCompositionBatchResult)
      : input.kind === "topic_post"
        ? buildTopicOutputs(input.result as TopicPostResult | TopicPostBatchResult)
        : buildMediaOutputs(input.result as MediaPostResult);

  return updateGeneratedDraft(input.draftId, {
    status: "complete",
    outputs,
    errorMessage: null
  });
}
