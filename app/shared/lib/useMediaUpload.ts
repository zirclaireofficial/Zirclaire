// shared — signed Cloudinary upload. Asks our server for a signature (which
// fixes the folder + access mode by purpose), then uploads the file directly
// to Cloudinary. Returns the stored reference.
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

export function useMediaUpload() {
  async function upload(file: File, purpose: UploadPurpose) {
    const sign = await authedFetch<{
      cloudName: string
      apiKey: string
      timestamp: number
      signature: string
      folder: string
      accessMode: string
      uploadUrl: string
    }>('/api/media/sign', { method: 'POST', body: { purpose } })

    const form = new FormData()
    form.append('file', file)
    form.append('api_key', sign.apiKey)
    form.append('timestamp', String(sign.timestamp))
    form.append('folder', sign.folder)
    form.append('signature', sign.signature)
    if (sign.accessMode === 'authenticated') form.append('access_mode', 'authenticated')

    const res = await fetch(sign.uploadUrl, { method: 'POST', body: form })
    if (!res.ok) throw new Error('Upload failed')
    const json = (await res.json()) as { public_id: string; secure_url: string }
    return { publicId: json.public_id, url: json.secure_url }
  }

  return { upload }
}
