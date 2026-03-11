export type MediaKind = "image" | "video" | "video_hls" | "video_blob";
export type InterceptedMediaClass = "image" | "video" | "video_poster";

export interface TweetMetrics {
  replies: string | null;
  reposts: string | null;
  likes: string | null;
  bookmarks: string | null;
  views: string | null;
}

export interface TweetMedia {
  mediaKind: MediaKind;
  sourceUrl: string | null;
  previewUrl: string | null;
  posterUrl: string | null;
}

export interface MediaFingerprint {
  algorithm: "dhash_8x8";
  hex: string | null;
  bitLength: number;
  width: number | null;
  height: number | null;
}

export interface MediaSimilarityEmbedding {
  model: string;
  outputDimensionality: number;
  taskType: "SEMANTIC_SIMILARITY";
  modality: "image";
  normalized: boolean;
  values: number[];
}

export interface ExtractedTweet {
  sourceName: string;
  tweetId: string | null;
  tweetUrl: string | null;
  authorHandle: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  authorProfileImageUrl: string | null;
  createdAt: string | null;
  text: string | null;
  metrics: TweetMetrics;
  media: TweetMedia[];
  extraction: {
    articleIndex: number;
    extractedAt: string;
  };
}

export interface InterceptedMediaRecord {
  url: string;
  mediaClass: InterceptedMediaClass;
  persisted: boolean;
  contentType: string | null;
  filePath?: string;
}

export interface CrawlManifest {
  runId: string;
  startedAt: string;
  completedAt?: string;
  baseUrl: string;
  maxScrolls: number;
  downloadImages: boolean;
  downloadVideoPosters: boolean;
  downloadVideos: boolean;
  capturedTweets: ExtractedTweet[];
  interceptedMedia: InterceptedMediaRecord[];
}

export interface UsageAnalysis {
  usageId: string;
  tweetId: string | null;
  mediaIndex: number;
  mediaKind: MediaKind;
  status: "pending" | "complete";
  has_celebrity: boolean | null;
  has_human_face: boolean | null;
  features_female: boolean | null;
  features_male: boolean | null;
  has_screenshot_ui: boolean | null;
  has_text_overlay: boolean | null;
  has_chart_or_graph: boolean | null;
  has_logo_or_watermark: boolean | null;
  caption_brief: string | null;
  scene_description: string | null;
  ocr_text: string | null;
  primary_subjects: string[];
  secondary_subjects: string[];
  visible_objects: string[];
  setting_context: string | null;
  action_or_event: string | null;
  video_music: string | null;
  video_sound: string | null;
  video_action: string | null;
  primary_emotion: string | null;
  emotional_tone: string | null;
  conveys: string | null;
  user_intent: string | null;
  rhetorical_role: string | null;
  text_media_relationship: string | null;
  metaphor: string | null;
  humor_mechanism: string | null;
  cultural_reference: string | null;
  reference_entity: string | null;
  reference_source: string | null;
  reference_plot_context: string | null;
  analogy_target: string | null;
  analogy_scope: string | null;
  meme_format: string | null;
  persuasion_strategy: string | null;
  brand_signals: string[];
  trend_signal: string | null;
  reuse_pattern: string | null;
  why_it_works: string | null;
  audience_takeaway: string | null;
  search_keywords: string[];
  confidence_notes: string | null;
  usage_notes: string | null;
}

export interface MediaAssetRecord {
  assetId: string;
  canonicalMediaUrl: string | null;
  canonicalFilePath: string | null;
  promotedVideoSourceUrl: string | null;
  promotedVideoFilePath: string | null;
  mediaKind: MediaKind | InterceptedMediaClass;
  fingerprint: MediaFingerprint | null;
  similarityEmbedding: MediaSimilarityEmbedding | null;
  starred: boolean;
  usageIds: string[];
  sourceUrls: string[];
  previewUrls: string[];
  posterUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetSummary {
  assetId: string;
  status: "fallback_first_analysis" | "aggregated";
  sourceUsageId: string | null;
  usageCount: number;
  completeAnalysisCount: number;
  summary: UsageAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

export interface TweetUsageRecord {
  usageId: string;
  tweet: ExtractedTweet;
  mediaIndex: number;
  analysis: UsageAnalysis;
  mediaAssetId: string | null;
  mediaLocalFilePath: string | null;
  mediaPlayableFilePath: string | null;
  mediaAssetStarred: boolean;
  mediaAssetUsageCount: number;
  phashMatchCount: number;
  duplicateGroupId: string | null;
  duplicateGroupUsageCount: number;
  hotnessScore: number;
}

export interface MediaAssetPhashMatch {
  asset: MediaAssetRecord;
  distance: number | null;
  similarityScore: number;
  usages: TweetUsageRecord[];
}

export interface MediaAssetView {
  asset: MediaAssetRecord;
  summary: MediaAssetSummary | null;
  duplicateUsages: TweetUsageRecord[];
  phashMatches: MediaAssetPhashMatch[];
  nearestNeighbors: MediaAssetPhashMatch[];
}

export type RunTask =
  | "crawl_timeline"
  | "crawl_openclaw"
  | "capture_openclaw_current"
  | "analyze_missing"
  | "rebuild_media_assets"
  | "backfill_media_native_types";
export type RunTrigger = "manual" | "scheduled";
export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface SchedulerConfig {
  enabled: boolean;
  frequency: "daily";
  hour: number;
  minute: number;
  times: string[];
  timezone: string;
  updatedAt: string;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  lastProcessedSlotAt: string | null;
  lastSkippedAt: string | null;
  lastSkipReason: string | null;
}

export interface RunHistoryEntry {
  runControlId: string;
  task: RunTask;
  trigger: RunTrigger;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  exitCode: number | null;
  errorMessage: string | null;
  logPath: string;
  manifestRunId: string | null;
}
