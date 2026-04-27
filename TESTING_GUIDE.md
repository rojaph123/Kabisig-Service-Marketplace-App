# Complete Testing Guide - Real Firebase Integration

## Before You Start

✅ **You have:**
- Firebase project with real credentials
- `.env` file with all Firebase values
- Firestore database enabled
- Authentication enabled
- Admin account created in Firebase Auth

✅ **What to verify:**
1. Go to Firebase Console
2. Check that you can see your Firebase project
3. Confirm Authentication section shows your admin email
4. Confirm Firestore Database is created and visible

---

## Step 1: Create Service Categories (One-Time Setup)

This is required for customers to see services when browsing.

**In Firebase Console:**

1. Go to **Firestore Database**
2. Click **Data** tab
3. Click **+ Start collection**
4. Collection ID: `serviceCategories`
5. Click **Next**

**Create 5 documents:**

### Document 1: electrician
- Document ID: `electrician`
- Fields:
  - `id`: string → `electrician`
  - `name`: string → `Electrician`
  - `icon`: string → `Zap`
  - `description`: string → `Wiring, repairs, and installations`
  - `startingPrice`: number → `500`

### Document 2: plumber
- Document ID: `plumber`
- Fields:
  - `id`: string → `plumber`
  - `name`: string → `Plumber`
  - `icon`: string → `Droplets`
  - `description`: string → `Leaks, pipes, and sanitary fixes`
  - `startingPrice`: number → `450`

### Document 3: welder
- Document ID: `welder`
- Fields:
  - `id`: string → `welder`
  - `name`: string → `Welder`
  - `icon`: string → `Flame`
  - `description`: string → `Metal works and gate fabrication`
  - `startingPrice`: number → `700`

### Document 4: construction-worker
- Document ID: `construction-worker`
- Fields:
  - `id`: string → `construction-worker`
  - `name`: string → `Construction Worker`
  - `icon`: string → `Hammer`
  - `description`: string → `General construction support`
  - `startingPrice`: number → `900`

### Document 5: roofer
- Document ID: `roofer`
- Fields:
  - `id`: string → `roofer`
  - `name`: string → `Roofer`
  - `icon`: string → `Home`
  - `description`: string → `Roof repair and installation`
  - `startingPrice`: number → `1200`

---

## Step 2: Test Admin Login

**Start the admin panel:**
```bash
npm run admin
```

Expected: Admin panel starts on http://localhost:3000/login

**Try to login:**
- Email: `admin@kabisig.com` (or your Firebase admin email)
- Password: (your Firebase admin password)

**Expected results:**
- ✅ Login succeeds → Redirected to dashboard
- ❌ Login fails → Check Firebase Console for admin user
- ❌ Admin role error → Check Firestore `users` collection for admin document with `role: "admin"`

**If logged in, check:**
1. Dashboard shows stats (from mock data for now)
2. Provider Approvals page loads empty (no providers yet)
3. All menu items are clickable

---

## Step 3: Test Customer Registration (Mobile)

**Start the mobile app:**
```bash
npm run mobile
```

Expected: Expo opens with Kabisig welcome screen

**Create a customer account:**
1. Tap **"Continue as Customer"**
2. Tap **"Login"**
3. Tap **"Create account"** link
4. Fill in:
   - Full Name: `John Doe`
   - Email: `john@test.com`
   - Password: `Test@1234`
5. Tap **"Create account"**

**Expected results:**
- ✅ Account created → Redirected to home dashboard
- ❌ Error message → Check .env Firebase values
- ❌ Endless loading → Check internet connection

**After successful registration:**
1. Go to Firebase Console > Firestore > Users collection
2. You should see a new document with:
   - `email`: john@test.com
   - `role`: customer
   - `fullName`: John Doe
3. Go to customerProfiles collection
4. You should see a new document with userId matching

---

## Step 4: Test Provider Registration & Onboarding

**In mobile app:**
1. Tap back to go to welcome screen
2. Tap **"Continue as Service Provider"**
3. Tap **"Login"**
4. Tap **"Create account"**
5. Fill in:
   - Full Name: `Jane Smith`
   - Email: `jane@test.com`
   - Password: `Test@1234`
6. Tap **"Create account"**

**Expected:** Redirected to provider onboarding form

**Fill the onboarding form:**
- Business Name: `Smith Electrical Services`
- Mobile: `09123456789`
- Address: `123 Main Street`
- City: `Manila`
- Service Categories: Select "Electrician" and "Plumber"
- Years of Experience: `5`
- Bio: `Professional with 5 years experience`
- Profile Photo Drive Link: `https://drive.google.com/...` (paste any Google Drive link)
- Valid ID Drive Link: `https://drive.google.com/...`
- Certificate Drive Link: `https://drive.google.com/...`
7. Tap **"Submit Application"**

**Expected results:**
- ✅ Application submitted → See "Pending Approval" screen
- ❌ Error → Check form fields

**After submission:**
1. Go to Firebase Console > Firestore > providerApplications
2. You should see a new document with:
   - `userId`: jane's user ID
   - `status`: "Pending Approval"
   - `documentUrls`: array with Google Drive links
3. Go to providerProfiles collection
4. See jane's profile with `approvalStatus: "Pending Approval"`

---

## Step 5: Test Admin Approval Workflow

**In admin panel:**
1. Go to **Provider Approvals**
2. You should see Jane Smith's application

**Approve the provider:**
1. Click the **"Approve"** button
2. Expected: Application status updates

**After approval:**
1. Go to Firebase Console > Firestore > providerApplications
2. Find jane's application → `status` should now be "Approved"
3. Go to providerProfiles
4. Find jane's profile → `isApproved` should be `true`

**Back in mobile app:**
1. The pending provider should see their status updated
2. They should now be able to see jobs/bookings

---

## Step 6: Test Customer Booking

**In mobile app (as customer):**
1. Go to **Home** tab
2. Tap a service (e.g., "Electrician")
3. Tap an approved provider (should be Jane now)
4. Tap **"Book Now"**
5. Fill booking details:
   - Location: `456 Customer St`
   - Date/Time: Tomorrow at 10am
   - Notes: `Need wiring for new room`
6. Tap **"Submit Booking"**

**Expected results:**
- ✅ Booking created → See in "Bookings" tab
- ✅ Real-time update in provider app

**Verify in Firebase:**
1. Go to Firestore > bookings collection
2. New document should exist with:
   - `customerId`: john's ID
   - `providerId`: jane's ID
   - `status`: "Pending"
   - `serviceName`: "Electrician"

---

## Step 7: Test Provider Jobs View

**In mobile app (switch to provider account):**
1. Log out (go to Profile > Logout)
2. Log back in as Jane (jane@test.com / Test@1234)
3. Should see "Pending Approval" cleared → Full provider dashboard

**Go to **Jobs** tab:**
1. Should see John's booking under "New Requests"
2. Click the booking
3. See customer details and booking info
4. Tap **"Accept"** to accept the job

**After accepting:**
1. Booking status changes to "Accepted" in Firestore
2. John sees updated status in Bookings tab

---

## Step 8: Test Real-Time Sync

**Open two devices/browsers:**

**Device 1 (Customer - Browser 1):**
1. Login as John
2. Go to Bookings
3. Watch for new status

**Device 2 (Provider - Browser 2):**
1. Login as Jane (or different provider)
2. Accept a booking

**Expected:** Device 1 automatically updates with new status (real-time sync)

---

## Complete Test Checklist

- [ ] Admin can login
- [ ] Customer can register
- [ ] Customer data saved to Firestore
- [ ] Provider can register
- [ ] Provider onboarding saves to Firestore
- [ ] Admin can see pending applications
- [ ] Admin can approve provider
- [ ] Provider status updates in Firestore
- [ ] Customer can book a service
- [ ] Booking saves to Firestore
- [ ] Provider can see new bookings
- [ ] Provider can accept booking
- [ ] Status updates in real-time

---

## Common Errors & Fixes

### Error: "Firebase: Error (auth/invalid-api-key)"
**Solution:** Your `.env` values might be wrong
1. Go to Firebase Console > Settings
2. Copy the correct values
3. Update `.env` file
4. Restart the app

### Error: "User not found" on admin login
**Solution:** Admin account doesn't exist
1. Go to Firebase Console > Authentication
2. Create a new user with your admin email
3. Copy the UID
4. Go to Firestore > users collection
5. Create document with that UID and `role: "admin"`

### Error: "No service categories"
**Solution:** Service categories not created
1. Follow Step 1 above to create all 5 categories
2. Restart mobile app
3. They should appear

### Booking not appearing for provider
**Solution:** Provider might not be approved yet
1. Go to admin panel
2. Approve the provider
3. Provider logs out and logs back in
4. Bookings should appear

### Real-time updates not working
**Solution:** Firestore rules might be too restrictive
1. For MVP, use "Test Mode" in Firestore
2. Later, set up proper security rules

---

## Monitoring Your Data

**Check Firestore Console regularly:**

1. **Users Collection** → See all registered users
2. **Provider Applications** → See pending approvals
3. **Service Categories** → Verify all 5 are there
4. **Bookings** → See all bookings as they're created
5. **Payments** → Track transactions

---

## Next: Add More Test Data

Once comfortable with the flows, create:
- 3-4 test customers with different emails
- 2-3 test providers in various approval states
- 10-20 test bookings with different statuses
- A few completed bookings with reviews

---

## Production Considerations (Future)

- [ ] Enable Firestore Security Rules
- [ ] Set up Cloud Functions for notifications
- [ ] Configure Google Sign-In
- [ ] Set up payment processing
- [ ] Enable push notifications
- [ ] Configure email notifications
- [ ] Add analytics tracking

---

**You're now ready to test real Firebase integration end-to-end!**

Start with: `npm run mobile` or `npm run admin`

All data is real and persistent. Every action creates real Firestore documents.

Questions? Check the error message in browser console (admin) or Expo terminal (mobile).
