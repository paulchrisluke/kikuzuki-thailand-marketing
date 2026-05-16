/**
 * Standardized media resolution for the platform.
 * Follows the media_assets source of truth.
 */
export const useMedia = () => {
  const resolveMedia = (asset?: { 
    public_url?: string | null; 
    thumbnail_url?: string | null; 
    kind?: string | null;
  } | null) => {
    const url = asset?.public_url ?? null
    const kind = asset?.kind ?? 'image'
    const thumb = asset?.thumbnail_url ?? (kind === 'image' ? url : null)

    return {
      url,
      kind,
      thumb,
      isImage: kind === 'image',
      isVideo: kind === 'video'
    }
  }

  return {
    resolveMedia
  }
}
