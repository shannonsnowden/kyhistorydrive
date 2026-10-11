# Optional user profiles for kyhistorydrive.com: plan for Shannon's OK

**Status:** Plan only. Nothing is built, and nothing in AWS, Google or Apple is changed by this PR.
**Author:** KY Website Editor, 2026-10-11
**Architecture owner:** Engineer Bot (Lingxi). Its decision is recorded in section 6.1 and is the recommendation below.
**Prices:** Taken from the official pricing pages on 2026-10-11 (links in section 1.4). They are USD estimates and can change.

## Shannon's rules (these do not change)

- You don't manage users. There's no admin queue, no password resets and no support inbox for logins.
- Sign-in is through Google or Apple only. No passwords and no email signup.
- Every page stays fully usable and crawlable without signing in. Nothing is gated.
- This PR is the plan only. Building starts only after your OK.

## What the site is today (checked in the repo at `9b18856`, main)

- A static Vite 5 + MapLibre GL 4 site. `amplify.yml` runs `npm ci`, then `npm run sync-app-data`, then `npm run build`, and publishes `dist/`. There is **no Amplify backend** today. It's hosting only, from `shannonsnowden/kyhistorydrive` main.
- `scripts/prerender-pages.mjs` writes 230 story pages (`/stories/<slug>/`), the layer pages, `/about/`, `/videos/`, `/routes/` (the six route maps) and `/privacy/`, and updates `sitemap.xml`.
- The data has 1,921 KHS markers in `public/data/markers.geojson`. Each has a unique `marker_number` and one of 120 counties. Each of the 230 stories has a `slug` and `lat`/`lon`. The routes are six slugs under `public/maps/routes/`.
- GA4 is `G-83G4SBQKT1`, from `scripts/gtag-snippet.mjs`. Consent Mode v2 is denied by default in the EEA, UK and CH, waits for the AdSense Privacy & messaging CMP, and is granted elsewhere. There's no separate consent banner.
- AdSense is `ca-pub-8587137224654033`. `src/ad-slot.js` reserves the slots, and they stay empty unless `VITE_ADS_ENABLED` is set or the page has `?adpreview=1`.
- localStorage today holds only `khd-theme`, `khd-home-preview-theme` and `khd-logo-n`.
- The iPhone app reads OTA JSON from `/data/app/*.json`, with short-cache headers in `customHttp.yml`. **Profiles never touch this feed.**
- DNS for kyhistorydrive.com is on Route 53 (`awsdns` name servers). That makes the custom sign-in domain and the email DNS records simple.

---

## 1. Recommended auth approach

### 1.1 Recommendation: Amazon Cognito through Amplify Gen 2, with Google and Apple only

This is Engineer Bot's decision, and I agree with it.

- **Auth:** Amplify Gen 2 `defineAuth`, which creates a Cognito user pool. The external providers are Google and Sign in with Apple. Facebook isn't included.
- **No passwords and no email signup:** Gen 2 needs `loginWith.email: true` in the config, but the site never shows a password form. The buttons call `signInWithRedirect({ provider: 'Google' | 'Apple' })`. A **pre sign-up Lambda** rejects every `PreSignUp_SignUp` (direct signup) and allows only `PreSignUp_ExternalProvider`. Self-service signup by password is closed at the API level, not just hidden in the UI.
- **Data:** One DynamoDB table keyed by the Cognito user id (`sub`), reached through Amplify Data (AppSync). Owner-only rules mean each user can read and write only their own rows (section 2).
- **Pricing tier:** Switch the user pool to **Cognito Lite**. New pools default to Essentials. Lite still supports social sign-in, and we don't need Essentials' passkeys or email codes.
- **Sign-in domain:** `auth.kyhistorydrive.com` (a Cognito custom domain on Route 53). Google's and Apple's consent screens then name our domain, not `amazoncognito.com`.

**Why this one**

- It's one cloud and one bill. Hosting, DNS, auth, data and email all stay in the AWS account that already serves the site.
- Nobody manages users. Google and Apple handle identity, and Cognito handles sessions and tokens. A self-service "Delete my account" button handles removals.
- No third-party SDK is loaded on our pages. Sign-in is a redirect to our own auth domain.
- The same pool can serve the iPhone app later through Amplify Swift, if you ever want sync there.

**Why not the others** (Engineer Bot's call, details below)

- **Firebase Auth:** rejected because it adds a second cloud (Google Cloud project, Firestore, billing and IAM) next to AWS.
- **Clerk:** rejected because it's paid beyond the free tier (Pro is $25/mo for production branding and session control), and its user store and SDK create lock-in.

### 1.2 Comparison

| | Amazon Cognito (Amplify Gen 2) | Firebase Auth | Clerk |
|---|---|---|---|
| Google / Apple / Facebook | All three, as social providers. Other OIDC providers are billed at a higher federation rate (see the costs) | All three, plus others | Hobby: up to 3 social connections. Pro: unlimited |
| No-password setup | Pre sign-up Lambda blocks direct signup. Password UI never shown | Enable only the social providers | Turn off password and email in the dashboard |
| Where users live | Your AWS account | A Google Cloud project | Clerk's servers |
| Profile data store | DynamoDB through Amplify Data, same account | Firestore (second cloud) | None suitable built in (metadata is small). Still needs DynamoDB or another database |
| Script on our pages | Amplify JS, loaded only on click | Firebase JS SDK. Redirect sign-in on Safari needs an `/__/auth` proxy rewrite | `clerk-js` from Clerk's Frontend API, plus a `clerk.` DNS CNAME |
| Admin console | Clunky, but rarely needed | Good | Best |
| iPhone app later | Amplify Swift, same pool | Firebase iOS SDK | Clerk iOS SDK |
| Lock-in / exit | Standard OIDC. Data is plain DynamoDB items. Moving means users sign in again | Second cloud. Firestore export | Highest. Clerk user ids are in every row |

### 1.3 Monthly cost estimates

"MAU" here means **signed-in** monthly users, not site visitors. Most readers never sign in.

**Auth alone**

| | 1k MAU | 10k MAU | 50k MAU |
|---|---|---|---|
| **Cognito Lite** (recommended): 10k MAU free indefinitely, then $0.0055/MAU | **$0** | **$0** | **$220** (40,000 × $0.0055) |
| Cognito Essentials (the default for new pools): 10k free, then $0.015/MAU | $0 | $0 | $600 |
| Firebase Auth (social sign-in, no Identity Platform) | $0 | $0 | $0 (Identity Platform also free to 50k MAU) |
| Clerk Hobby (50k MRU cap, "Secured by Clerk" badge, fixed 7-day session) | $0 | $0 | $0 (at the cap) |
| Clerk Pro | $25 ($20/mo annual) | $25 | $25 |

**Profile data and API (same for Cognito and Clerk, which both need DynamoDB)**

These assume about 30 writes and 60 reads per signed-in user per month. Prices: AppSync $4.00 per million operations; DynamoDB on-demand $0.625 per million writes and $0.125 per million reads; 25 GB of storage is free.

| | 1k | 10k | 50k |
|---|---|---|---|
| AppSync | $0.36 | $3.60 | $18.00 |
| DynamoDB requests | $0.03 | $0.26 | $1.31 |
| DynamoDB storage (~5 KB/user) plus PITR backups | ~$0 | ~$0.01 | ~$0.05 |
| Pre sign-up, delete and export Lambdas | $0 (free tier) | $0 | $0 |
| **Data subtotal** | **≈ $0.40** | **≈ $4** | **≈ $19** |
| Firestore for comparison (free tier is 50k reads and 20k writes a day) | $0 | $0 | ≈ $1.30 |

**"On this day" email (optional, Phase 3; any auth choice)**

This assumes 20% of signed-in users opt in to a daily email. SES Essentials is $0.16 per 1,000 emails.

| | 1k | 10k | 50k |
|---|---|---|---|
| Daily | ≈ $1 | ≈ $9.60 | ≈ $48 |
| Weekly digest instead | ≈ $0.15 | ≈ $1.40 | ≈ $7 |

**Totals for the recommended stack (Cognito Lite + Amplify Data, with the daily email)**

| | 1k | 10k | 50k |
|---|---|---|---|
| Per month | **≈ $1.50** | **≈ $14** | **≈ $287** (≈ $239 without email) |

There's also the Apple Developer Program at $99/yr, which you likely already pay for the iOS app. Google OAuth is free.

**Cost guardrails**

- Below 10k signed-in users, auth costs nothing. Set an AWS Budget alert at $10/mo (one of your steps).
- If signed-in MAU passes about 8k, we review. At 50k, Firebase would be about $240/mo cheaper. Moving later is possible but means every user signs in again.
- Don't add "other OIDC" providers such as Microsoft. Cognito bills those at $0.015/MAU after only 50 free.
- **Cognito billing trap:** `AdminGetUser` counts as an identity operation, so calling it makes that user an MAU for the month. The daily email job must **never** read addresses from Cognito. It reads the email copy saved in the user's own row when they opt in (section 2).

### 1.4 Pricing sources (fetched 2026-10-11)

- Cognito: https://aws.amazon.com/cognito/pricing/
- DynamoDB on-demand: https://aws.amazon.com/dynamodb/pricing/on-demand/
- AppSync: https://aws.amazon.com/appsync/pricing/
- SES: https://aws.amazon.com/ses/pricing/
- Firebase: https://firebase.google.com/pricing and https://cloud.google.com/firestore/pricing
- Clerk: https://clerk.com/pricing

---

## 2. What each profile stores, and where

**Rules from Engineer Bot**

- One DynamoDB table, keyed by the Cognito `sub`.
- No names, no photos, no tracking.
- The only personal detail is the email address the provider returns.

**Scopes**

- Google is asked for `openid email` only (not `profile`).
- Apple is asked for `email` only (not `name`).
- Only `email` is mapped into Cognito attributes. Apple may return a private-relay address (`…@privaterelay.appleid.com`), and that's fine.

**Location:** AWS us-east-1 (same account as Amplify Hosting), DynamoDB on-demand with point-in-time recovery (35 days).

### 2.1 Table `ProfileItem`, created by Amplify Data (Gen 2) as a single model

```ts
// amplify/data/resource.ts (sketch, not built)
const schema = a.schema({
  ProfileItem: a
    .model({
      userId: a.string().required(),   // Cognito sub. Partition key. Owner field.
      itemKey: a.string().required(),  // sort key, see the patterns below
      kind: a.enum(['profile', 'visited', 'saved', 'tour', 'subscription']),
      ref: a.string(),                 // marker_number, story slug, route slug or tour slug
      refType: a.enum(['marker', 'story', 'route', 'tour', 'hub']),
      county: a.string(),              // one of the 120 KY counties (visited markers, home area)
      at: a.datetime(),                // when saved, visited or opted in
      stops: a.string().array(),       // tour: marker_numbers done, in order
      completedAt: a.datetime(),       // tour finished
      homeCounty: a.string(),          // profile: home area as a county only, no coordinates
      email: a.email(),                // subscription only: copied from the token at opt-in
      cadence: a.enum(['daily', 'weekly']),
      consentVersion: a.string(),      // which opt-in wording the user agreed to
      schemaVersion: a.integer(),
    })
    .identifier(['userId', 'itemKey'])
    .authorization((allow) => [allow.ownerDefinedIn('userId').identityClaim('sub')]),
})
```

### 2.2 Item key patterns

| What | `itemKey` | Fields used | Phase |
|---|---|---|---|
| Profile settings | `PROFILE` | `homeCounty`, `schemaVersion` | 3 |
| Visited marker | `VISIT#<marker_number>` (e.g. `VISIT#128`) | `ref`, `county`, `at` | 2 (sync) |
| Saved story | `SAVE#story#<slug>` | `ref`, `refType`, `at` | 2 (sync) |
| Saved route | `SAVE#route#<route-slug>` (one of the six in `public/maps/routes/`) | same | 2 |
| Saved hub | `SAVE#hub#<hub-slug>` | same | 3 |
| Tour progress | `TOUR#<tour-slug>` | `stops[]`, `at` (started), `completedAt` | 3 |
| "On this day" opt-in | `SUB#onthisday` | `email`, `cadence`, `at`, `consentVersion` | 3 |

**How the keys work**

- Deterministic keys make every save an idempotent upsert, so saving twice still leaves one row.
- The whole profile is a single `Query(userId)`. That's how export and delete work.

**Access rules**

- Owner rules mean the AppSync resolvers only return rows where `userId` equals the caller's `sub`.
- The owner field must be protected so a user can't reassign `userId`. Engineer Bot confirms the exact field-level rule at build time.

**The email job**

- It needs a sparse GSI on `kind = subscription` (or a scheduled scan of `SUB#` keys, which is fine at this size).
- It runs from a Lambda with its own IAM role, never from the browser.

### 2.3 What is never stored

- Names, profile photos, birthdays and contacts.
- Precise location. Nearby uses the browser's location on the device only, and it's never sent to us.
- Reading history or analytics ids. The GA client id and AdSense identifiers are never written to this table.

---

## 3. Privacy

### 3.1 Updates to `/privacy/`

These ship in the same PR that turns sign-in on.

1. **Intro:** change "Story and map pages do not ask you to create an account" to say that signing in is optional and never needed to read anything.
2. **New section, "Optional sign-in (Google or Apple)":**
   - What we receive: a provider user id and your email address. Apple may give a private relay address. We never see your Google or Apple password.
   - What we store: saved stories, routes and hubs, visited markers, tour progress, your home county, and the "On this day" email choice.
   - Where it's stored: Amazon Web Services in the US.
   - Why: only to show these features back to you.
   - What we don't do: no selling, no sharing, and no use for ads or analytics.
   - Processors: AWS (hosting, sign-in and storage), and Google or Apple as the sign-in provider you pick. The provider learns that you signed in to kyhistorydrive.com.
3. **New section, "Delete or download your data":**
   - The account page has Download my data (JSON) and Delete my account.
   - Deletion is immediate. Backups age out within 35 days.
   - If you signed in with Apple, you can also revoke access in your Apple ID settings, and we revoke the Apple token on delete.
4. **New section, "On this day email"** (Phase 3): opt-in only, daily or weekly, a one-click unsubscribe in every email, and our mailing address (CAN-SPAM).
5. **"Other requests" section:** list the new browser storage. That's `khd-saved-v1` (device-only saves) and the Amplify/Cognito session tokens, which are stored only after you sign in and are strictly necessary.
6. **Children:** the site isn't directed to children under 13, and accounts are for 13 and older (COPPA).
7. **Retention:** accounts with no sign-in for 24 months are deleted automatically. Engineer Bot can do this with a TTL on rows plus a scheduled cleanup.
8. **Meta description:** add "optional Google or Apple sign-in".

### 3.2 Account deletion and data export

- **Delete my account** (on `/account/`) calls an Amplify Data custom mutation backed by a Lambda. The Lambda:
  1. Queries all rows for the caller's `sub` and batch-deletes them.
  2. Calls Apple's token-revocation endpoint for Apple users.
  3. Calls `AdminDeleteUser`.
  4. Signs the browser out and clears `khd-saved-v1` only if the user asks.

  Rows are removed immediately. No one has to review anything. If a row delete fails, the job retries and alerts in CloudWatch, and the user is not left half-deleted.
- **Download my data:** this is done in the browser with one `list` query and saved as `kyhistorydrive-profile-YYYY-MM-DD.json`. No server-side export job is needed.
- **Shannon's role:** none. If someone emails asking to be deleted, reply with the link to `/account/`. A support-only fallback (a delete script) is in the runbook.

### 3.3 Sign-in, AdSense and GA consent

- **The profile id is kept separate from ads and analytics** (Engineer Bot's rule):
  - No `user_id`, no email and no hashed email go to GA4.
  - Nothing from the profile is passed to AdSense. The home county isn't used for targeting.
- **Optional GA events:** we may send GA's standard `login` and `sign_up` events with only `method: 'google' | 'apple'`. They follow the same Consent Mode settings as page views.
- **Consent:** sign-in tokens and the profile are strictly necessary for a feature the user asked for, so they aren't gated behind the consent message. The other way round, signing in never grants or changes ad or analytics consent. The AdSense Privacy & messaging CMP and the Consent Mode defaults in `gtag-snippet.mjs` stay exactly as they are.
- **Ads:** no ad slots on `/account/` or on the auth domain, which also keeps AdSense's rules about pages without content.
- **Third-party scripts:** sign-in is a redirect to `auth.kyhistorydrive.com`. No Google Identity Services or Apple JS SDK is loaded on our pages.

### 3.4 Still fully usable without sign-in (localStorage fallback)

- Every page is prerendered and readable, maps work, and nothing is gated or blurred. There are no "sign in to continue" interstitials.
- **Device-only saves:** Save, Visited and tour checkboxes work for everyone and are stored in `localStorage` key `khd-saved-v1`, using the same shape as the table rows: `{ visited: { "128": "2026-10-11" }, saved: [...], tours: {...}, homeCounty }`. A "Saved on this device" view lists them.
- **On first sign-in,** device data is merged into the account. Lists are unioned, the earliest visit date is kept, and tour stops are unioned. The user then chooses whether to keep or clear the device copy.
- **If sign-in is down or blocked** (Safari ITP, private mode, a blocked provider), the site still works on device storage. The sign-in button just shows a short notice.

---

## 4. How the 10 approved benchmark ideas use profiles

| # | Idea | Without sign-in | With a profile |
|---|---|---|---|
| 1 | Cite this story | Full feature, static | None needed |
| 2 | Nearby markers | Distances from the story's own location, plus optional "near me" from the browser's location on the device | Default center is the home county when location is off. Nearby markers you've visited show a ✓ ("3 of 8 visited") |
| 3 | On this day | Homepage module and dated pages, static | Opt-in daily or weekly email (SES) |
| 4 | County / A–Z browse | Static, crawlable county pages | "Your county" shortcut, and a visited count per county ("12 of 40 markers") |
| 5 | Marker tours | Static tour pages with stop lists | Tour progress (check off stops, resume, "completed"), saved tours |
| 6 | Topic hubs | Static hub pages | Save a hub, and "read 4 of 9" (from saved and visited items only, no reading tracker) |
| 7 | Photo credit line | Full feature | None |
| 8 | GPX/KML downloads | Full feature per route or tour | Optional "my saved stops" GPX, built in the browser |
| 9 | Report a correction | Full feature (mailto or form, story URL prefilled) | None. Reports stay anonymous by design |
| 10 | Know before you go | Full feature, static | A "Mark visited" button sits next to the box |

Profiles add something to 2, 3, 4, 5, 6 and 8. Ideas 1, 7, 9 and 10 need no profile.

## Phased build order

**Phase 1: no-profile quick wins (static, no backend)**

- **1a, already in progress:** Cite this story, Nearby markers (static plus on-device "near me"), Photo credit line, GPX/KML downloads and Report a correction, all in one PR. Tracked on Engineering Board card `3f6d17c0-2dcd-8175-845c-ccc150ef4c91`.
- **1b:** Know before you go, County/A–Z pages, Topic hubs, Marker tours (static pages from the six routes), and the On this day module and dated pages (no email).
- **1c:** Device-only Save, Visited and tour checkboxes (`khd-saved-v1`). This proves the UX before any backend exists.

**Phase 2: auth (Engineer Bot's estimate: a medium build)**

- Your steps (section 5).
- Amplify Gen 2 backend added to the existing Amplify app, with `defineAuth` (Google and Apple), the pre sign-up guard, the Lite tier, `auth.kyhistorydrive.com` and the `ProfileItem` table.
- A lazy-loaded Sign in button and a `noindex` `/account/` page.
- Favorites (saved stories and routes) and visited markers synced, with the device-to-account merge.
- Delete my account and Download my data.
- The privacy page update.
- Shipped behind `VITE_PROFILES_ENABLED`, tested on a preview branch first.

**Phase 3: profile features (a small build each, in this order)**

1. Tour progress
2. Home county, used by Nearby and County
3. Visited counts on county and hub pages
4. "My saved stops" GPX
5. The On this day email: SES, the opt-in row, one-click unsubscribe, Apple relay registration, and daily or weekly cadence. This one is last because it carries the most operations and privacy work.

**Phase 4: optional, later**

- iPhone app sign-in with the same pool, for sync across devices. If Google sign-in is offered in the app, App Store rule 4.8 also requires Sign in with Apple, and we already have it.

---

## 5. What Shannon does himself (about 1–2 hours in total, done once)

Steps 1–4 are needed for Phase 2. Step 5 is only for the Phase 3 email. You enter every secret yourself, so the bots never see the Apple key or the Google secret.

**1. Apple Developer** (https://developer.apple.com/account; you likely already have the $99/yr membership for the iOS app)

- Certificates, Identifiers & Profiles → Identifiers → **+** → **Services IDs**. Use a name like "Kentucky History Drive Web" and an identifier like `com.kyhistorydrive.web` (Engineer Bot confirms the final id).
- Turn on **Sign in with Apple** → Configure:
  - Primary App ID: the KY Markers Drive app, so web and app share the same Apple user.
  - Domains: `auth.kyhistorydrive.com`
  - Return URL: `https://auth.kyhistorydrive.com/oauth2/idpresponse`
- Keys → **+** → turn on Sign in with Apple, linked to the same App ID. **Download the .p8 file** (Apple only lets you download it once). Note the **Key ID** and your **Team ID** (top right of the account page).

**2. Google OAuth** (https://console.cloud.google.com → Google Auth Platform)

- Create the project "kyhistorydrive".
- **Branding:**
  - App name: Kentucky History Drive
  - Support email: yours
  - Logo: optional
  - Home page: `https://kyhistorydrive.com/`
  - Privacy policy: `https://kyhistorydrive.com/privacy/`
  - Authorized domain: `kyhistorydrive.com`
- **Audience:** External. Then **Publish app**, so it moves to "In production". Otherwise only listed test users can sign in.
- **Data access:** `openid` and `.../auth/userinfo.email` only. Both are non-sensitive, so no Google security review is needed.
- **Clients → Create client → Web application:**
  - Authorized redirect URI: `https://auth.kyhistorydrive.com/oauth2/idpresponse`
  - Copy the **Client ID** and **Client secret**.

**3. AWS console (Amplify)**

- Amplify → kyhistorydrive app → App settings → **IAM roles**: make sure the app has a service role that can deploy a Gen 2 backend. If not, use "Create and use a new service role". Engineer Bot will name the exact policy.
- Amplify → **Secrets** (for the `main` branch), add:
  - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  - `SIWA_CLIENT_ID` (the Services ID)
  - `SIWA_TEAM_ID` and `SIWA_KEY_ID`
  - `SIWA_PRIVATE_KEY` (paste the contents of the .p8)

**4. AWS console (one-time approvals)**

- **ACM in us-east-1:** approve the certificate for `auth.kyhistorydrive.com` that the deploy requests. Because DNS is on Route 53, it's one "Create records in Route 53" click.
- **Billing → Budgets:** a monthly cost budget of $10, with email alerts at 50% and 100%.
- After the first deploy, check that Cognito → User pools → the new pool → Feature plan shows **Lite**. If it shows Essentials, switch it with one click.

**5. Phase 3 only: email**

- **SES:** verify the domain `kyhistorydrive.com`. With Route 53 the DKIM records can be added automatically. Add a DMARC TXT record and **request production access** with a short description of the daily history email, which is opt-in and has one-click unsubscribe.
- **Apple:** Certificates, Identifiers & Profiles → Services → **Sign in with Apple for Email Communication**. Register `kyhistorydrive.com` and the sender address, so email reaches Hide-My-Email relay addresses.
- Give a mailing address (a PO box is fine) for the email footer (CAN-SPAM).

You don't need to set up Facebook. It's deliberately left out.

---

## 6. Reviews

### 6.1 Engineer Bot (Lingxi), architecture: decided 2026-10-11

- **Auth:** Amazon Cognito through Amplify Gen 2 auth, with **Google and Apple only**. No passwords and no email signup.
- **Data:** **One DynamoDB table keyed by the Cognito user id**, holding favorites and visited places (and the later profile features as more item kinds). No names or photos. Only the email the provider returns. No tracking.
- **Access:** through **Amplify Data (AppSync)**, with owner-only rules so each user sees only their own data.
- **Delete my account:** removes the user and their rows immediately.
- **Separation:** ads and analytics stay separate from the profile id.
- **Performance and SEO:** the profile add-on **loads only when someone clicks Sign in**, so SEO, prerender and performance are unaffected.
- **Rejected:** Firebase, because it adds a second cloud. Clerk, because it's paid beyond the free tier and creates lock-in.
- **Shannon's steps:** an Apple Developer account ($99/yr, which he may already have for the iOS app) plus a key, and a Google OAuth client.
- **Effort:** a medium build for sign-in, favorites and delete, then a small one per profile feature.
- **Phase 1:** the no-login quick wins (Cite this story, Nearby, Photo credits, GPX/KML, Report a correction) are already being built in one PR, tracked on card `3f6d17c0-2dcd-8175-845c-ccc150ef4c91`.
- **Engineer Bot confirms at build time:**
  - The owner-field protection rule.
  - The Lite tier setting in code.
  - The `amplify.yml` backend phase (`npx ampx pipeline-deploy`) alongside the existing `sync-app-data` step, which must not change.
  - The Apple token revocation on delete.

### 6.2 SEO & AEO Desk: crawlability, no SEO hit (Pending input)

Proposed for review:

- No content is gated. Prerendered HTML doesn't change, and canonicals and `sitemap.xml` stay the same.
- `/account/` is `noindex` (not robots-disallowed, so the noindex is seen) and is left out of the sitemap.
- No personalized content in the prerendered HTML, and no personalization query parameters on story URLs.
- Signed-in UI has reserved space so there's no layout shift (CLS).
- Phase 1b's county and hub pages need the Desk's structure and internal-link review.

### 6.3 Critiquito: sign-in and profile UX (Pending input)

Proposed for review:

- Where the Sign in button sits in the header and mobile nav.
- Save and Visited controls on story pages and map popups.
- The "Saved on this device" and account page layout.
- The merge prompt on first sign-in.
- The delete confirmation.
- Empty states.
- The failure notice when sign-in is blocked.

### 6.4 AI Search Visibility (Pending input)

Proposed for review:

- Confirm that AI crawlers see the same static pages.
- Confirm that the Phase 1 citation, `dateModified` and county/hub pages are the AEO gains.
- Confirm that nothing profile-related appears in `llms.txt` or structured data.
