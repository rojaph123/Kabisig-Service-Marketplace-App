# Kabisig Admin Hosting Checklist

Use this before publishing the admin dashboard.

## Recommended hosting

Use a Next.js host such as Vercel. The admin web app is a Next.js app and should be deployed from the `admin-web` workspace.

Free hosting recommendation:

- Vercel `Hobby` is the safest free option for this repo because `admin-web` is already a Next.js app.
- In a monorepo import, set the Vercel project `Root Directory` to `admin-web`.
- This repo now includes [vercel.json](/c:/Users/Danielle%20Blanca/Videos/kabisig/admin-web/vercel.json:1) inside `admin-web` and a root helper script `npm run deploy:admin:vercel`.

Build command:

```bash
npm run build --workspace admin-web
```

Install command:

```bash
npm install
```

Quick deploy from this repo:

```bash
npm run deploy:admin:vercel
```

If Vercel asks for project settings in the dashboard or CLI, use:

```text
Framework Preset: Next.js
Root Directory: admin-web
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

Output:

Next.js managed output. Do not manually upload `.next`.

## Required environment variables

Set these on the hosting provider:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

Use the production Firebase project values.

## Firebase setup after hosting

1. Add the hosted admin domain to Firebase Authentication authorized domains.
2. Confirm the admin user exists in Firestore `users` with `role: "admin"`.
3. Deploy Firestore rules, Storage rules, and Cloud Functions before relying on review/payment actions.
4. Test admin login from the hosted URL, not only localhost.

Example:

- If Vercel gives you `https://kabisig-admin.vercel.app`, add `kabisig-admin.vercel.app` to Firebase Authentication authorized domains.

## Public URLs for store submission

After hosting, use these public links:

```text
https://YOUR_ADMIN_WEB_DOMAIN/terms
https://YOUR_ADMIN_WEB_DOMAIN/privacy
https://YOUR_ADMIN_WEB_DOMAIN/data-deletion
https://YOUR_ADMIN_WEB_DOMAIN/support
```

Update the matching files inside `App Deployment Requirements/04_Legal` with the final domain.

## Smoke test

- Login page loads.
- Admin account can sign in.
- Dashboard loads users, bookings, payments, provider approvals, reports, and revenue.
- Provider approval actions work.
- Registration payment review works.
- Monthly commission proof review works.
- Category and coverage area updates save.
- Public legal/support pages open without login.
