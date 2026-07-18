// Convenience aliases over the generated Supabase types.
// The generated file (app/types/database.types.ts) is the source of truth;
// this just gives short, readable names to the row/insert/update shapes so
// feature code can write `Project` instead of the long lookup.

import type { Database } from '~/types/database.types'

export type { Database }

type Public = Database['public']
type Tables = Public['Tables']

// Row types (what you read)
export type Profile = Tables['profiles']['Row']
export type Country = Tables['countries']['Row']
export type Category = Tables['categories']['Row']
export type Subcategory = Tables['subcategories']['Row']
export type Project = Tables['projects']['Row']
export type ProjectAttachment = Tables['project_attachments']['Row']
export type Application = Tables['applications']['Row']
export type Deliverable = Tables['deliverables']['Row']
export type Review = Tables['reviews']['Row']
export type EscrowEntry = Tables['escrow_ledger']['Row']
export type Post = Tables['posts']['Row']
export type PostMedia = Tables['post_media']['Row']
export type Comment = Tables['comments']['Row']
export type CommentMedia = Tables['comment_media']['Row']
export type PostFavorite = Tables['post_favorites']['Row']
export type PostShare = Tables['post_shares']['Row']
export type Report = Tables['reports']['Row']

// Insert types (what you send when creating)
export type ProjectInsert = Tables['projects']['Insert']
export type ApplicationInsert = Tables['applications']['Insert']
export type PostInsert = Tables['posts']['Insert']
export type CommentInsert = Tables['comments']['Insert']
export type ReportInsert = Tables['reports']['Insert']

// Enums
export type UserRole = Public['Enums']['user_role']
export type KycStatus = Public['Enums']['kyc_status']
export type ProjectStatus = Public['Enums']['project_status']
export type ApplicationStatus = Public['Enums']['application_status']
export type LedgerEntryType = Public['Enums']['ledger_entry_type']
export type PostStatus = Public['Enums']['post_status']
export type ReportStatus = Public['Enums']['report_status']
export type PayoutProvider = Public['Enums']['payout_provider']
