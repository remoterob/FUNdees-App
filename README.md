# Spearfishing FUNdamentals — App Setup Guide

## Stack
- **Frontend**: HTML/CSS/JS → Netlify
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **Payments**: Stripe (Checkout + Webhooks)

---

## 1. Supabase Setup

1. Create project at https://supabase.com
2. Go to **SQL Editor** → paste `supabase-schema.sql` → Run
3. In **Authentication → Settings**:
   - Enable Email provider
   - Set Site URL to your Netlify domain
4. Copy from **Settings → API**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

---

## 2. Stripe Setup

1. Create account at https://stripe.com
2. Create two **Products**:
   - Annual Membership → $120 NZD recurring yearly
   - Student Membership → $60 NZD recurring yearly
3. For session payments: use Stripe Payment Intents (one-off)
4. Set up Webhook endpoint → your Netlify function URL:
   - `https://your-site.netlify.app/.netlify/functions/stripe-webhook`
   - Events to listen for:
     - `payment_intent.succeeded`
     - `customer.subscription.created`
     - `customer.subscription.deleted`
5. Copy:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_ANNUAL_PRICE_ID`
   - `STRIPE_STUDENT_PRICE_ID`

---

## 3. Netlify Setup

1. Connect your GitHub repo at https://netlify.com
2. Build settings:
   - Build command: (none for static)
   - Publish directory: `/`
3. Add environment variables (**Site settings → Environment variables**):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_ANNUAL_PRICE_ID=price_xxx
STRIPE_STUDENT_PRICE_ID=price_xxx
```

---

## 4. Netlify Functions (create these next)

```
netlify/functions/
  create-checkout-session.js   ← Stripe session for membership
  create-payment-intent.js     ← Stripe intent for pool session
  stripe-webhook.js            ← Handle Stripe events → update Supabase
  send-notification.js         ← Email via SendGrid/Resend (future)
```

### Example: `create-payment-intent.js`
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const { sessionId, memberId, amount } = JSON.parse(event.body);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100,  // cents
    currency: 'nzd',
    metadata: { sessionId, memberId }
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ clientSecret: paymentIntent.client_secret })
  };
};
```

---

## 5. Database Tables Summary

| Table | Purpose |
|---|---|
| `members` | Member profiles, tiers, qualifications, Stripe IDs |
| `pool_sessions` | Training session schedule, capacity, pricing |
| `session_bookings` | Who has booked which session + payment status |
| `membership_payments` | Annual/student membership payment records |
| `session_lead_roster` | Lead assignments + swap history (future) |
| `notifications` | Notification log for emails/push (future) |

---

## 6. Future Features (Phase 2)

### Session Leader System
- [ ] Admin assigns qualified members to lead sessions
- [ ] Automatic email notification when rostered
- [ ] Members can request swaps via the app
- [ ] Swap approval workflow (admin or self-approve between qualified members)
- [ ] `session_lead_roster` table is already in the schema ready for this

### Session Plans
- [ ] Rich text editor for admin to write session plans
- [ ] Plans published to members 48h before session
- [ ] Members can view plan on their booking confirmation page

### Member Portal
- [ ] Login with Supabase Auth
- [ ] View upcoming bookings
- [ ] Manage membership / auto-renew
- [ ] View personal attendance history

---

## 7. File Structure

```
spearfishing-fundamentals/
├── index.html                  ← Main app (all pages)
├── supabase-schema.sql         ← Database schema
├── README.md                   ← This file
├── netlify.toml                ← Netlify config
├── netlify/
│   └── functions/
│       ├── create-payment-intent.js
│       ├── create-checkout-session.js
│       └── stripe-webhook.js
└── assets/
    └── logo.jpg
```
