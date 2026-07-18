# Zirclaire — Things to Confirm

Decisions we had to make while building. Each needs a yes/no so we know whether
to keep it or change it. Not a full requirements list — just what's already
built.

---

**1. Posts go live immediately.**
The wireframe says a post waits for admin approval. We built it so posts appear
straight away, and members can report anything bad for an admin to remove.
*Keep as built, or add pre-approval?*

**2. "Reject" on an applicant doesn't reject them.**
The sketch shows Approve/Reject beside each applicant. Approving one person
automatically rejects everyone else, so Reject currently just hides that person
from the requester's shortlist.
*Is that fine, or should rejecting one applicant be a real, permanent action?*

**3. No "edit profile" button.**
It's in the sketch, but almost everything on a profile is KYC-verified — the
name has to match the national ID.
*What should a member be allowed to change? Profile picture only, or also
phone, address, payout account?*

**4. Posts can't be edited, only deleted.**
Deliberate, so nobody can change a post after people have engaged with it.
*Confirm that's wanted.*

**5. Payment happens in the app, not through admin chat.**
The flow sheet has the requester getting an account number from the admin via
bot chat, paying outside, then submitting. We built: create project → pay in
app (Touch 'n Go or Binance) → admin verifies → goes live.
*Which is the real process?*

**6. The countdown is the application window.**
The form asks for hours and minutes, and projects show a countdown. We treated
it as how long providers have to apply, starting when the project goes live.
*Is it that, or the deadline for the awarded provider to deliver?*

**7. Profiles are public but show almost nothing.**
Name, member ID, role, picture, join date, plus their posts and replies. No
projects, no budgets, no history — for either role.
*Enough for now, or should a provider's completed work be listed?*

**8. Providers can't see who else applied, or how many.**
Blind bidding, as specified.
*Confirm hiding the applicant count is right — some marketplaces show "12
applicants" so providers can judge their chances.*

**9. Brand spelling.**
Wireframes say *Zirclaive.com*. We've built everything as **Zirclaire**.
*Confirm which is correct.*

---

## Not built yet — flagging so it isn't a surprise

- **The "assign" tab** (hand a project directly to one named provider) is in
  sheets 2 and 3 but not in the written description. We've left it out pending
  a decision on how it should work.
- **What happens if the requester never clicks "Finished"** — the money stays
  in escrow indefinitely. Needs a rule before real money is involved.
