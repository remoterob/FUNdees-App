# Deployment Guide — Spearfishing FUNdamentals
## Live Stripe · New Netlify Site · No Email

---

## Before You Start — Keys You Already Have

You need these 5 values on hand before touching anything:

| Key | Where you got it |
|-----|-----------------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (keep secret) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key (`sk_live_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe → Developers → API keys → Publishable key (`pk_live_...`) |

You still need to get 3 more from Stripe — steps 1–2 below cover that.

---

## STEP 1 — Get Your Stripe Price IDs

You said you've created the products. Now get the Price IDs.

1. Go to **https://dashboard.stripe.com/products**
2. Click your **Annual Membership** product
3. Under "Pricing", copy the **Price ID** — it looks like `price_1ABCdef...`
   → This is your `STRIPE_ANNUAL_PRICE_ID`
4. Go back, click your **Student Membership** product
5. Copy that Price ID too
   → This is your `STRIPE_STUDENT_PRICE_ID`

⚠️ Make sure both products are set to **Recurring / Yearly** billing in NZD.

---

## STEP 2 — Put Your Publishable Key in the Frontend

Open `index.html` and find line near the bottom of the `<script>` block:

```
const STRIPE_PUBLISHABLE_KEY = 'pk_test_REPLACE_WITH_YOUR_PUBLISHABLE_KEY';
```

Replace the value with your **live** publishable key (`pk_live_...`).
Save the file.

---

## STEP 3 — Push to GitHub

Netlify deploys from GitHub. If you haven't got a repo yet:

1. Go to **https://github.com/new**
2. Create a new **private** repository called `spearfishing-fundamentals`
3. In Terminal, inside your project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spearfishing-fundamentals.git
git push -u origin main
```

---

## STEP 4 — Create the Netlify Site

1. Go to **https://app.netlify.com** → click **"Add new site"** → **"Import an existing project"**
2. Click **GitHub** → authorise if asked → select your `spearfishing-fundamentals` repo
3. On the build settings screen:
   - **Branch to deploy:** `main`
   - **Build command:** leave **blank** (it's a static site with serverless functions)
   - **Publish directory:** `.` (just a dot — the root folder)
4. Click **"Deploy site"**

Netlify will assign you a random URL like `https://graceful-dolphin-abc123.netlify.app`.
You can rename it: **Site configuration → Site details → Change site name**.

---

## STEP 5 — Add Environment Variables in Netlify

This is the most important step. Do this **before** the site goes live.

1. In Netlify, go to your site → **Site configuration → Environment variables**
2. Click **"Add a variable"** for each of the following — one at a time:

```
SUPABASE_URL                = https://YOURPROJECT.supabase.co
SUPABASE_ANON_KEY           = eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY   = eyJ...your-service-role-key
STRIPE_SECRET_KEY           = sk_live_...
STRIPE_ANNUAL_PRICE_ID      = price_...
STRIPE_STUDENT_PRICE_ID     = price_...
STRIPE_WEBHOOK_SECRET       = whsec_... (you'll get this in Step 6 below)
URL                         = https://YOUR-SITE-NAME.netlify.app
```

⚠️ `STRIPE_WEBHOOK_SECRET` — leave this as a placeholder for now, fill it in after Step 6.

3. After adding all variables, go to **Deploys → Trigger deploy → Deploy site** to restart with the new variables.

---

## STEP 6 — Register the Stripe Webhook

Stripe needs to know where to send payment events (membership activations etc).

1. Go to **https://dashboard.stripe.com/webhooks**
2. Click **"Add endpoint"**
3. **Endpoint URL:**
   ```
   https://YOUR-SITE-NAME.netlify.app/.netlify/functions/stripe-webhook
   ```
   (Replace `YOUR-SITE-NAME` with your actual Netlify subdomain)

4. Under **"Select events to listen to"**, add these 4 events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`

5. Click **"Add endpoint"**
6. On the next screen, click **"Reveal"** next to **Signing secret**
   → Copy the `whsec_...` value

7. Go back to Netlify → Environment variables → find `STRIPE_WEBHOOK_SECRET` → paste the value
8. Trigger another deploy in Netlify to pick up the new variable

---

## STEP 7 — Run the Database Schema

If you haven't already run the SQL schema in Supabase:

1. Go to **https://supabase.com/dashboard** → your project → **SQL Editor**
2. Click **"New query"**
3. Open `supabase-schema.sql` from this project folder
4. Paste the entire contents → click **"Run"**

You should see "Success. No rows returned."

---

## STEP 8 — Verify Everything Works

### Test membership checkout:
1. Visit your Netlify URL
2. Click **"Join Now"** → fill in name + email → click **"Join — $120/year"**
3. You should be redirected to a **Stripe-hosted checkout page** (your real products)
4. Use a real card or Stripe test card: `4242 4242 4242 4242`, expiry any future date, CVC any 3 digits
   ⚠️ You're in **live mode** — use a real card for final testing or switch to test mode first
5. After payment → you should land on `/success.html`
6. Check Supabase → `members` table → the member should have `status = active`
7. Check Supabase → `membership_payments` → a row should appear

### Test session booking:
1. First add a session via Supabase → **Table Editor → pool_sessions → Insert row**
2. Navigate to "Pool Sessions" on the site
3. Click a session card → fill in details → card details
4. Booking should appear in Supabase → `session_bookings`

### Check webhook is firing:
1. Go to **Stripe → Webhooks → your endpoint**
2. You should see recent events listed with green ✓ status

---

## STEP 9 — Add Your First Admin + Sessions

### Make yourself admin:
1. Supabase → Table Editor → `members` → find your row
2. Set `is_admin = true` and `is_qualified_lead = true`

### Add pool sessions:
1. Supabase → Table Editor → `pool_sessions` → Insert row
2. Fill in: `title`, `description`, `session_date` (format: `2025-04-09`), `start_time` (`18:30:00`), `end_time` (`20:30:00`), `capacity` (`12`), `member_price` (`10`), `casual_price` (`15`), `status` (`upcoming`)

These will immediately appear on the Sessions page.

---

## STEP 10 — Send Auth Emails via Resend (Password Reset)

The "Forgot password?" flow (`auth.html` → `reset-password.html`) is already coded.
It calls Supabase's `resetPasswordForEmail()`, which sends the email through
**Supabase's own email service** — but that is throttled to a handful of messages
per hour and is intended only for testing. To deliver reliably (and from your own
verified domain), point Supabase Auth at **Resend's SMTP server**.

This covers *all* auth emails — password reset, signup confirmation, magic links.
No code changes are needed.

### 10a — Get a Resend API key (skip if you already did this for daily backups)

1. Go to **https://resend.com** → **API Keys** → **Create API Key**
   (a "Sending access" key is enough). Copy the `re_...` value.
2. Make sure your domain `spearfishingfundamentals.com` is **verified** in Resend
   (**Domains** → the domain shows a green *Verified*). The same domain already
   used by the daily backup will work.

### 10b — Configure SMTP in Supabase

1. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**
   (newer dashboards: **Authentication → Emails → SMTP**).
2. Toggle **"Enable Custom SMTP"** on and enter:

   | Field | Value |
   |-------|-------|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key (`re_...`) |
   | Sender email | `noreply@spearfishingfundamentals.com` |
   | Sender name | `Spearfishing FUNdamentals` |

   ⚠️ The **sender email's domain must be the verified Resend domain**, or Resend
   rejects the send. `noreply@` does not need to be a real mailbox.
3. **Save.** Once custom SMTP is enabled you can also raise the email **rate limit**
   under the same Authentication settings (the default is conservative).

### 10c — Allow-list the reset redirect URL (the common gotcha)

The reset link redirects back to `/reset-password.html`. Supabase will refuse a
redirect to any URL that isn't on its allow-list.

1. Supabase Dashboard → **Authentication → URL Configuration**.
2. Set **Site URL** to your live site (e.g. `https://spearfishingfundamentals.com`).
3. Under **Redirect URLs**, add every origin the app runs on:
   ```
   https://spearfishingfundamentals.com/reset-password.html
   https://www.spearfishingfundamentals.com/reset-password.html
   https://fundees.netlify.app/reset-password.html
   ```
   (Add `http://localhost:8888/reset-password.html` too if you test with `netlify dev`.)

### 10d — Test it

1. On `/auth.html` click **"Forgot password?"**, enter a real member's email, **Send Reset Link**.
2. Check the inbox — the email should arrive within seconds, **from**
   `noreply@spearfishingfundamentals.com`.
3. Confirm delivery in **Resend → Emails** (the send is logged there).
4. Click the link → you land on `/reset-password.html` → set a new password → it
   redirects to sign in. Log in with the new password to confirm.

If the email never arrives, check **Resend → Emails** for a failed/blocked send
(usually an unverified sender domain), and Supabase → **Logs → Auth** for SMTP errors.

> Optional — branding: the default reset email is plain text from Supabase.
> To style it, edit **Authentication → Emails → Templates → "Reset Password"** in
> the Supabase dashboard (HTML + the `{{ .ConfirmationURL }}` variable).

---

## File Structure Reference

```
spearfishing-fundamentals/
├── index.html                          ← Main app (all pages, wired to real APIs)
├── success.html                        ← Post-payment confirmation page
├── supabase-schema.sql                 ← Run once in Supabase SQL Editor
├── netlify.toml                        ← Netlify build + function config
├── .gitignore                          ← Keeps secrets out of git
├── .env.example                        ← Template showing all needed env vars
└── netlify/
    └── functions/
        ├── package.json                ← stripe + supabase-js dependencies
        ├── _supabase.js                ← Shared DB client (uses service role key)
        ├── get-sessions.js             ← GET  → upcoming sessions with availability
        ├── get-admin-stats.js          ← GET  → dashboard metrics
        ├── create-membership-checkout.js  ← POST → Stripe Checkout Session for membership
        ├── create-session-payment.js   ← POST → Stripe Payment Intent for session
        ├── confirm-booking.js          ← POST → write booking to Supabase after payment
        └── stripe-webhook.js           ← POST → handle Stripe events (membership activate etc)
```

---

## Common Problems

**"Function not found" errors on Netlify**
→ Check that `netlify/functions/package.json` is committed to git. Netlify auto-installs dependencies from it.

**Webhook returns 400 "No signatures found"**
→ The `STRIPE_WEBHOOK_SECRET` env var is wrong or missing. Retrieve it again from Stripe → Webhooks → your endpoint → Signing secret.

**Sessions page shows "Could not load sessions"**
→ Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly in Netlify env vars. Trigger a new deploy after changing env vars.

**Membership doesn't activate after payment**
→ Check Stripe → Webhooks → your endpoint → look for failed events. The most common cause is the webhook secret being wrong.

**Stripe Checkout redirects to wrong URL**
→ Make sure `URL` env var in Netlify is set to your exact Netlify URL with no trailing slash.
