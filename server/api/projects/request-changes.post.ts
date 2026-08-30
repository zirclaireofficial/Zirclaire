// POST /api/projects/request-changes  { projectId, note }  (requester)
// The requester asks for changes on a submitted deliverable. Sends it back to
// the provider (revision_requested) and posts the note into the project chat so
// the conversation stays the single timeline. Unlimited rounds — not a dispute.
import { serviceClient } from '../../utils/auth'
import { requireProjectOwner } from '../../utils/projects'
import { notify } from '../../utils/notify'

export default defineEventHandler(async (event) => {
  const { projectId, note } = await readBody(event)
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })
  const reason = (note ? String(note) : '').trim()
  if (!reason) throw createError({ statusCode: 400, statusMessage: 'Describe the change you need' })

  const { profile, project } = await requireProjectOwner(event, projectId)
  const db = serviceClient(event)

  const { error } = await db.rpc('request_revision', { p_project: projectId, p_reviewer: profile.id, p_reason: reason })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  // Mirror the note into the project chat as a message from the requester.
  try {
    const { data: convo } = await db.rpc('open_project_conversation', { p_project: projectId, p_actor: profile.id })
    if (convo?.id) {
      await db.from('messages').insert({ conversation_id: convo.id, sender_id: profile.id, body: `Requested changes: ${reason}` })
    }
  } catch { /* chat mirror is best-effort */ }

  if (project.awarded_provider_id) {
    await notify(db, project.awarded_provider_id, {
      type: 'revision_requested',
      title: 'Changes requested',
      body: `The requester asked for changes on "${project.title}". Review the note and resubmit when ready.`,
      link: '/projects',
    })
  }
  return { ok: true }
})
