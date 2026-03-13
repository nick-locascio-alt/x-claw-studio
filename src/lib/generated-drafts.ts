export type GeneratedDraftKind = "reply" | "topic_post" | "media_post";
export type GeneratedDraftStatus = "running" | "complete" | "failed";

export interface GeneratedDraftOutputRecord {
  goal: string | null;
  text: string;
  whyThisWorks: string;
  mediaSelectionReason: string | null;
  postingNotes: string | null;
  selectedMediaLabel: string | null;
  selectedMediaSourceType: "usage_facet" | "meme_template" | null;
}

export interface GeneratedDraftRecord {
  draftId: string;
  kind: GeneratedDraftKind;
  status: GeneratedDraftStatus;
  createdAt: string;
  updatedAt: string;
  usageId: string | null;
  tweetId: string | null;
  topicId: string | null;
  assetId: string | null;
  requestGoal: string | null;
  requestMode: string | null;
  progressStage: string | null;
  progressMessage: string | null;
  progressDetail: string | null;
  errorMessage: string | null;
  outputs: GeneratedDraftOutputRecord[];
}
