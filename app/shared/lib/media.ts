// shared — Cloudinary delivery URLs for PUBLIC assets (profile pictures, post
// media). Private assets (KYC documents, deliverables) are never built here;
// they need a server-signed URL.

export function usePublicMedia() {
  const config = useRuntimeConfig()
  const cloudName = (config.public as { cloudinary?: { cloudName?: string } }).cloudinary?.cloudName

  /** Full-size delivery URL. */
  function publicMediaUrl(publicId: string): string {
    return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`
  }

  /**
   * Delivery URL with on-the-fly transforms — feed images shouldn't ship the
   * original megapixels. `f_auto,q_auto` lets Cloudinary pick format/quality.
   */
  function thumbUrl(publicId: string, width = 800): string {
    return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_${width}/${publicId}`
  }

  return { publicMediaUrl, thumbUrl }
}
