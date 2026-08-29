-- =====================================================================
-- Zirclaire — 45_dispute_attachments.sql
-- Let a private dispute-channel message ("Zirclaire Review Team" chat) carry a
-- single file attachment, same model as direct-message attachments: a PRIVATE
-- Cloudinary reference, served via a participant-gated signed URL
-- (see /api/cancellations/attachment-url).
-- Run AFTER 35_cancellation_dispute.sql.
-- =====================================================================

alter table dispute_messages add column if not exists attachment_url  text;
alter table dispute_messages add column if not exists attachment_type text
  check (attachment_type is null or attachment_type in ('image', 'pdf', 'file'));
alter table dispute_messages add column if not exists attachment_name text;

-- Allow an attachment-only message (body previously had to be non-empty).
alter table dispute_messages drop constraint if exists dispute_messages_body_or_attachment;
alter table dispute_messages
  add constraint dispute_messages_body_or_attachment
  check (length(trim(body)) > 0 or attachment_url is not null);
