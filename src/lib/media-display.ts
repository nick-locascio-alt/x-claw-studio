export function buildLocalMediaUrl(filePath: string | null | undefined): string | null {
  if (!filePath) {
    return null;
  }

  const normalized = filePath.trim();
  if (!normalized) {
    return null;
  }

  return `/api/media/local?path=${encodeURIComponent(normalized)}`;
}

export function resolveMediaDisplayUrl(input: {
  localFilePath?: string | null;
  posterUrl?: string | null;
  previewUrl?: string | null;
  sourceUrl?: string | null;
}): string | null {
  return (
    buildLocalMediaUrl(input.localFilePath) ??
    input.posterUrl ??
    input.previewUrl ??
    input.sourceUrl ??
    null
  );
}
