// A tiny app-wide media viewer: images open in an in-app lightbox (no new tab),
// everything else downloads to the device. Shared state drives <MediaViewer/>,
// mounted once in app.vue.

export function useMediaViewer() {
  const state = useState('media-viewer', () => ({ open: false, url: '', title: '' }))

  function showImage(url: string, title = '') {
    state.value = { open: true, url, title }
  }
  function close() {
    state.value = { ...state.value, open: false }
  }

  /** Fetch the file and save it to the device (avoids opening a new tab). */
  async function download(url: string, filename = 'download') {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = filename || 'download'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(obj), 5000)
    } catch {
      // Last resort if the blob download is blocked.
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'download'
      a.rel = 'noopener'
      a.click()
    }
  }

  /** Open an attachment by kind: images in the lightbox, else download. */
  function open(url: string, opts: { type?: string | null; name?: string | null }) {
    if (opts.type === 'image') showImage(url, opts.name ?? '')
    else download(url, opts.name ?? 'attachment')
  }

  return { state, showImage, close, download, open }
}
