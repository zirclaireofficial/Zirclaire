-- =====================================================================
-- Zirclaire — 44_message_attachments.sql
-- Let a direct message carry a single file attachment (image or document).
-- The file is uploaded to a PRIVATE Cloudinary folder client-side; only the
-- reference is stored here, and it's served back via a participant-gated
-- signed URL (see /api/messages/attachment-url).
-- Run AFTER 18_messaging.sql.
-- =====================================================================

alter table messages add column if not exists attachment_url  text; -- Cloudinary public_id
alter table messages add column if not exists attachment_type text  -- 'image' | 'pdf' | 'file'
  check (attachment_type is null or attachment_type in ('image', 'pdf', 'file'));
alter table messages add column if not exists attachment_name text; -- original filename, for display

-- A message must have text OR an attachment (or both). Replace the old
-- body-only check so an attachment-only message is allowed.
alter table messages drop constraint if exists messages_body_check;
alter table messages drop constraint if exists messages_body_or_attachment;
alter table messages
  add constraint messages_body_or_attachment
  check (length(trim(body)) > 0 or attachment_url is not null);
