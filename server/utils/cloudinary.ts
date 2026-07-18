// Cloudinary signed-upload helpers (server only).
// Signature algorithm (Cloudinary spec): sort the params to sign by key,
// join as `k=v&k=v`, append the API secret, SHA-1 hex. api_key and the file
// itself are NOT part of the signature.

import { createHash } from 'node:crypto'

export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return createHash('sha1').update(toSign + apiSecret).digest('hex')
}

// Where each kind of upload goes, and whether it's private.
// private = true  -> access_mode 'authenticated' (viewable only via signed URL)
// private = false -> normal public delivery
export const MEDIA_PURPOSES = {
  kyc:                  { folder: 'zirclaire/kyc',                  private: true  },
  profile:              { folder: 'zirclaire/profiles',             private: false },
  post:                 { folder: 'zirclaire/posts',                private: false },
  deliverable:          { folder: 'zirclaire/deliverables',         private: true  },
  'project-attachment': { folder: 'zirclaire/project-attachments',  private: true  },
} as const

export type MediaPurpose = keyof typeof MEDIA_PURPOSES

// Build a signed delivery URL for an access-controlled upload (uploaded with
// access_mode=authenticated), so an admin can view a KYC document that isn't
// publicly reachable. Such assets keep delivery type `upload` and require the
// signature. Signature = SHA-1 of (public_id + api_secret), base64url, first 8.
export function signedDeliveryUrl(
  publicId: string,
  cloudName: string,
  apiSecret: string,
  resourceType = 'image',
): string {
  const sig = createHash('sha1')
    .update(publicId + apiSecret)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, 8)
  return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/s--${sig}--/v1/${publicId}`
}
