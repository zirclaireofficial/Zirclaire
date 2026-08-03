<script setup lang="ts">
// Reference page for staff. Admin sees the admin controls; master sees the
// master controls plus the admin ones. Plain descriptions of what each
// control does and where it is.

import { useMe } from '~/features/auth/application/useMe'

const { me } = useMe()
const isMaster = computed(() => me.value?.role === 'master')

interface Action { name: string; detail: string }
interface Section { icon: string; heading: string; where: string; description: string; actions: Action[] }

const adminSections: Section[] = [
  {
    icon: 'i-lucide-shield-check',
    heading: 'KYC review',
    where: 'Dashboard → Review KYC',
    description: 'Verify new accounts before they can use the platform.',
    actions: [
      { name: 'View ID document', detail: 'Opens the applicant’s uploaded ID image. It is private and never shown publicly.' },
      { name: 'Approve', detail: 'Verifies the account, issues its member ID, and unlocks posting, applying and transactions.' },
      { name: 'Reject', detail: 'Declines the application with a reason. No member ID is issued.' },
    ],
  },
  {
    icon: 'i-lucide-banknote',
    heading: 'Project funding',
    where: 'Dashboard → Fund projects',
    description: 'Confirm a requester’s payment and put the project live.',
    actions: [
      { name: 'Verify & launch', detail: 'Marks the payment verified, locks the funds in escrow, and publishes the project to the jobs feed with its countdown running.' },
    ],
  },
  {
    icon: 'i-lucide-flag',
    heading: 'Reports & moderation',
    where: 'Dashboard → Moderation',
    description: 'Review posts and comments that members have reported.',
    actions: [
      { name: 'Remove content', detail: 'Hides the reported post or comment and closes the report. Not deleted — it can be restored.' },
      { name: 'Dismiss', detail: 'Closes the report and leaves the content up.' },
    ],
  },
  {
    icon: 'i-lucide-shield-x',
    heading: 'Moderating the feed',
    where: 'Feed → the “⋯” menu on a post',
    description: 'Remove a post directly from the feed without waiting for a report.',
    actions: [
      { name: 'Remove post (moderate)', detail: 'Hides the post from the feed. Reversible, and recorded in the audit log.' },
    ],
  },
  {
    icon: 'i-lucide-briefcase',
    heading: 'Service approvals',
    where: 'Dashboard → Service approvals',
    description: 'Review provider service listings before they appear in the store.',
    actions: [
      { name: 'Approve', detail: 'Publishes the service to the store.' },
      { name: 'Reject', detail: 'Declines the listing with a reason for the provider.' },
    ],
  },
  {
    icon: 'i-lucide-book-open-text',
    heading: 'Royalty approvals',
    where: 'Dashboard → Royalty approvals',
    description: 'Review published works before they go on sale.',
    actions: [
      { name: 'Open file', detail: 'Opens the uploaded file to check it.' },
      { name: 'Approve / Reject', detail: 'Approve lists it in the royalty store. Reject returns it to the provider with a reason.' },
    ],
  },
  {
    icon: 'i-lucide-life-buoy',
    heading: 'Service desk',
    where: 'Inbox icon → the queue',
    description: 'Handle member support tickets. An AI assistant answers common questions first and escalates anything it can’t handle to this queue. Each ticket has a number and sits in a shared queue until claimed.',
    actions: [
      { name: 'Claim a ticket', detail: 'Assigns the ticket to you and removes it from the shared queue. The first admin to claim it keeps it.' },
      { name: 'Reply', detail: 'Message the member directly to resolve the issue.' },
      { name: 'Close', detail: 'Marks the ticket resolved. It moves from Open to Closed in your ticket log. You can only close tickets assigned to you.' },
    ],
  },
  {
    icon: 'i-lucide-ticket',
    heading: 'Support tickets',
    where: 'Dashboard → Support tickets',
    description: 'The ticket log, with Unclaimed / Open / Closed / All tabs. You see unclaimed tickets and the ones assigned to you.',
    actions: [
      { name: 'Unclaimed', detail: 'Tickets with no agent yet — the bot may still be chatting, or it has escalated and is waiting. Open one to read it, then Claim to take it.' },
      { name: 'Open', detail: 'Tickets you have claimed and are still handling. Reply, then Close when resolved.' },
      { name: 'Closed / All', detail: 'Closed shows resolved tickets; All shows every ticket you can see.' },
    ],
  },
  {
    icon: 'i-lucide-users',
    heading: 'Members',
    where: 'Members',
    description: 'Directory of every member, with search and role filters.',
    actions: [
      { name: 'Suspend', detail: 'Blocks the member from posting, commenting, applying and ordering, and hides their profile and content from others. Shows them the reason. Deletes nothing.' },
      { name: 'Lift suspension', detail: 'Restores the member’s access and visibility.' },
      { name: 'Scope', detail: 'Admins can suspend members only. Only a master can suspend an admin.' },
    ],
  },
  {
    icon: 'i-lucide-folder-kanban',
    heading: 'All projects',
    where: 'All projects',
    description: 'Read-only view of every project.',
    actions: [
      { name: 'Open a project', detail: 'Shows the requester, awarded provider, applicants, escrow ledger, deliverables and reviews. View only — money actions stay in their own queues.' },
    ],
  },
]

const masterSections: Section[] = [
  {
    icon: 'i-lucide-shield',
    heading: 'Master console',
    where: '/master',
    description: 'Platform-wide metrics that admins do not see.',
    actions: [
      { name: 'Finances', detail: 'Commission earned, money held in escrow, total paid to providers, total funded. Each figure has an (i) with its exact definition.' },
      { name: 'Members & projects', detail: 'Counts by role and status, pending KYC, and suspended accounts.' },
    ],
  },
  {
    icon: 'i-lucide-user-plus',
    heading: 'Create admin accounts',
    where: 'Master console → Create admin',
    description: 'The only place admin accounts are created. Admins cannot create admins.',
    actions: [
      { name: 'Create admin', detail: 'Enter a name, email and temporary password. Creates a confirmed, approved admin with an ADM member ID.' },
    ],
  },
  {
    icon: 'i-lucide-user-x',
    heading: 'Suspending admins',
    where: 'Members → an admin’s row',
    description: 'The master can suspend admins, which admins cannot.',
    actions: [
      { name: 'Suspend an admin', detail: 'Blocks an admin’s access with a reason. Reversible with Lift suspension.' },
      { name: 'Protected', detail: 'A master account cannot be suspended.' },
    ],
  },
  {
    icon: 'i-lucide-rotate-ccw',
    heading: 'Reversing decisions',
    where: 'Where the original action lives',
    description: 'Undo admin decisions where it is safe to do so.',
    actions: [
      { name: 'Safe to reverse', detail: 'Lift a suspension, restore a removed post or comment, re-open a rejected KYC, un-publish an approved listing. These are status changes; nothing is lost.' },
      { name: 'Money decisions', detail: 'Funding, awarding and payouts are not undone directly. They go through the cancel and refund path so the ledger stays balanced.' },
    ],
  },
  {
    icon: 'i-lucide-eye',
    heading: 'Conversation oversight',
    where: 'Inbox icon',
    description: 'Read every conversation on the platform.',
    actions: [
      { name: 'Read any thread', detail: 'Open any service-desk ticket or project thread. Read-only — you cannot post in another person’s thread.' },
    ],
  },
  {
    icon: 'i-lucide-ticket',
    heading: 'All support tickets',
    where: 'Master console → Support tickets',
    description: 'Every ticket from every agent, across Unclaimed / Open / Closed / All. Read-only.',
    actions: [
      { name: 'Tabs', detail: 'Unclaimed (no agent yet, incl. bot-handled), Open (being handled), Closed (resolved), or All.' },
      { name: 'Open a ticket', detail: 'Read the full exchange, including the bot’s messages, and see which agent is handling it. You observe only — you cannot reply or close.' },
    ],
  },
  {
    icon: 'i-lucide-scroll-text',
    heading: 'Audit log',
    where: 'Master console → Audit log',
    description: 'Record of every privileged action taken by any admin or master.',
    actions: [
      { name: 'Read the trail', detail: 'Shows who did what, to what, and when. Append-only — entries cannot be edited or deleted.' },
    ],
  },
]

const sections = computed(() => (isMaster.value ? [...masterSections, ...adminSections] : adminSections))
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <header>
      <div class="mb-1 flex items-center gap-2">
        <UBadge color="primary" variant="soft" size="sm">{{ isMaster ? 'Master' : 'Admin' }}</UBadge>
        <span class="zc-eyebrow">Guide</span>
      </div>
      <h1 class="font-serif text-2xl leading-tight">{{ isMaster ? 'Master controls' : 'Admin controls' }}</h1>
      <p class="mt-1 text-sm text-stone-600 dark:text-stone-300">What each control does and where to find it.</p>
    </header>

    <section v-for="s in sections" :key="s.heading" class="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
      <div class="flex items-start gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <UIcon :name="s.icon" class="size-5 text-primary" />
        </div>
        <div class="min-w-0">
          <h2 class="text-lg font-semibold leading-tight">{{ s.heading }}</h2>
          <p class="mt-0.5 text-xs font-medium uppercase tracking-wide text-stone-400">{{ s.where }}</p>
        </div>
      </div>

      <p class="mt-2.5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{{ s.description }}</p>

      <dl class="mt-3 space-y-2.5 border-t border-stone-100 pt-3 dark:border-stone-800">
        <div v-for="a in s.actions" :key="a.name" class="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
          <dt class="text-sm font-medium">{{ a.name }}</dt>
          <dd class="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{{ a.detail }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
