// shared — signed Cloudinary upload. Asks our server for a signature (which
// fixes the folder + access mode by purpose), then uploads the file directly
// to Cloudinary. Returns the stored reference.
//
// Fails LOUDLY and CLEARLY: any problem throws an Error with a user-facing
// message, so callers abort (never create a record with a broken reference)
// and can show a clear "try again". A single retry covers transient network
// blips (common on mobile).
//
// This lives in `shared` rather than inside a feature because KYC, projects
// and social all upload media — features must not reach into each other.

import { authedFetch } from './authedFetch'

export type UploadPurpose =
  | 'kyc'
  | 'profile'
  | 'post'
  | 'deliverable'
  | 'project-attachment'
  | 'message-attachment'

export function useMediaUpload() {
  async function upload(file: File, purpose: UploadPurpose) {
    if (!file) throw new Error('No file selected.')

    // 1) Ask our server to sign the upload (fixes folder + access by purpose).
    let sign
    try {
      sign = await authedFetch<{
        cloudName: string
        apiKey: string
        timestamp: number
        signature: string
        folder: string
        accessMode: string
        uploadUrl: string
      }>('/api/media/sign', { method: 'POST', body: { purpose } })
    } catch {
      throw new Error('Could not start the upload. Please try again.')
    }

    const form = new FormData()
    form.append('file', file)
    form.append('api_key', sign.apiKey)
    form.append('timestamp', String(sign.timestamp))
    form.append('folder', sign.folder)
    form.append('signature', sign.signature)
    if (sign.accessMode === 'authenticated') form.append('access_mode', 'authenticated')

    // 2) Upload straight to Cloudinary, with one retry on a network failure.
    let res: Response | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(sign.uploadUrl, { method: 'POST', body: form })
        break
      } catch {
        if (attempt === 1) {
          throw new Error(`Couldn't upload ${file.name}. Check your connection and try again.`)
        }
      }
    }
    if (!res || !res.ok) {
      throw new Error(`Couldn't upload ${file.name}. Please try again.`)
    }

    // 3) Guard the result — never return a broken reference.
    const json = (await res.json().catch(() => null)) as { public_id?: string; secure_url?: string } | null
    if (!json?.public_id) {
      throw new Error(`Upload of ${file.name} didn't complete. Please try again.`)
    }

    return { publicId: json.public_id, url: json.secure_url ?? '' }
  }

  return { upload }
}
