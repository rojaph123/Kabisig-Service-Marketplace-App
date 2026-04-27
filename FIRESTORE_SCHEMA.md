# Firestore Database Schema - Kabisig

## Collections Reference

### 1. `users`
Main user account collection. Created when user registers.

**Document ID:** Firebase Auth UID

**Fields:**
```typescript
{
  uid: string;           // Firebase Auth UID (auto)
  email: string;         // User email
  fullName: string;      // Full name from registration
  role: "customer" | "provider" | "admin";  // User role
  avatar?: string;       // Profile picture URL (Google Drive link)
  createdAt: Timestamp;  // Registration time
  updatedAt: Timestamp;  // Last update time
}
```

**Example:**
```json
{
  "uid": "user123abc",
  "email": "john@test.com",
  "fullName": "John Doe",
  "role": "customer",
  "createdAt": 1713667200000,
  "updatedAt": 1713667200000
}
```

---

### 2. `customerProfiles`
Customer-specific profile data. Created automatically with user account.

**Document ID:** Firebase Auth UID (same as users)

**Fields:**
```typescript
{
  userId: string;        // Reference to users collection
  phone?: string;        // Phone number
  address?: string;      // Street address
  city?: string;         // City
  state?: string;        // State/Province
  zipCode?: string;      // Postal code
  preferences?: {
    serviceTypes?: string[];  // Preferred services
    radius?: number;          // Service radius in km
  };
  totalBookings: number; // Lifetime bookings
  totalSpent: number;    // Total money spent
  averageRating: number; // Overall rating
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Example:**
```json
{
  "userId": "user123abc",
  "phone": "09123456789",
  "address": "123 Main Street",
  "city": "Manila",
  "state": "NCR",
  "zipCode": "1000",
  "totalBookings": 5,
  "totalSpent": 7500,
  "averageRating": 4.5,
  "createdAt": 1713667200000,
  "updatedAt": 1713667200000
}
```

---

### 3. `providerProfiles`
Provider-specific profile data. Created when provider registers.

**Document ID:** Firebase Auth UID (same as users)

**Fields:**
```typescript
{
  userId: string;              // Reference to users collection
  businessName: string;        // Business/trade name
  phone: string;               // Business phone
  address: string;             // Business address
  city: string;                // City
  state: string;               // State/Province
  zipCode: string;             // Postal code
  serviceCategories: string[]; // IDs of services offered
  yearsOfExperience: number;   // Professional experience
  bio: string;                 // Professional bio
  profilePhoto?: string;       // Google Drive link to photo
  isApproved: boolean;         // Admin approval status
  approvalStatus: "Pending Approval" | "Approved" | "Rejected";
  totalJobs: number;           // Completed jobs
  totalEarnings: number;       // Total earnings
  averageRating: number;       // Service rating
  documents?: {
    validId?: string;          // Google Drive link
    certificate?: string;      // Google Drive link
    insurance?: string;        // Google Drive link
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Example:**
```json
{
  "userId": "provider456xyz",
  "businessName": "Smith Electrical Services",
  "phone": "09987654321",
  "address": "456 Business Ave",
  "city": "Quezon City",
  "state": "NCR",
  "zipCode": "1100",
  "serviceCategories": ["electrician", "plumber"],
  "yearsOfExperience": 5,
  "bio": "Professional electrician with 5 years experience",
  "isApproved": true,
  "approvalStatus": "Approved",
  "totalJobs": 42,
  "totalEarnings": 125000,
  "averageRating": 4.8,
  "documents": {
    "validId": "https://drive.google.com/...",
    "certificate": "https://drive.google.com/..."
  },
  "createdAt": 1713667200000,
  "updatedAt": 1713667200000
}
```

---

### 4. `providerApplications`
Provider onboarding applications queue.

**Document ID:** Auto-generated (ProviderApplicationUID)

**Fields:**
```typescript
{
  userId: string;              // Reference to user
  businessName: string;        // Business name from form
  phone: string;               // Phone number
  address: string;             // Business address
  city: string;                // City
  serviceCategories: string[]; // Selected services
  yearsOfExperience: number;   // Years experience
  bio: string;                 // Professional bio
  documentUrls: {
    profilePhoto: string;      // Google Drive link
    validId: string;           // Google Drive link
    certificate: string;       // Google Drive link
  };
  status: "Pending Approval" | "Approved" | "Rejected";
  adminNotes?: string;         // Approval/rejection reason
  submittedAt: Timestamp;      // When submitted
  reviewedAt?: Timestamp;      // When reviewed
  reviewedBy?: string;         // Admin who reviewed
}
```

**Example:**
```json
{
  "userId": "provider456xyz",
  "businessName": "Smith Electrical Services",
  "phone": "09987654321",
  "address": "456 Business Ave",
  "city": "Quezon City",
  "serviceCategories": ["electrician"],
  "yearsOfExperience": 5,
  "bio": "Professional electrician",
  "documentUrls": {
    "profilePhoto": "https://drive.google.com/...",
    "validId": "https://drive.google.com/...",
    "certificate": "https://drive.google.com/..."
  },
  "status": "Pending Approval",
  "submittedAt": 1713667200000
}
```

---

### 5. `serviceCategories`
Available service types. CREATE THESE MANUALLY FIRST!

**Document ID:** Category slug (lowercase, no spaces)

**Fields:**
```typescript
{
  id: string;              // Category ID (electrician, plumber, etc)
  name: string;            // Display name
  icon: string;            // Icon name (Zap, Droplets, Flame, Hammer, Home)
  description: string;     // Category description
  startingPrice: number;   // Minimum price
  averageRating?: number;  // Category average rating
  totalProviders?: number; // Number of providers
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Example (5 to create manually):**
```json
{
  "id": "electrician",
  "name": "Electrician",
  "icon": "Zap",
  "description": "Wiring, repairs, and installations",
  "startingPrice": 500,
  "createdAt": 1713667200000,
  "updatedAt": 1713667200000
}
```

---

### 6. `bookings`
Service requests from customers to providers.

**Document ID:** Auto-generated (BookingUID)

**Fields:**
```typescript
{
  customerId: string;      // Reference to customer
  providerId: string;      // Reference to provider
  categoryId: string;      // Service category
  status: "Pending" | "Accepted" | "In Progress" | "Completed" | "Cancelled";
  serviceDate: Timestamp;  // When service is scheduled
  location: string;        // Where service will be done
  notes: string;           // Customer notes
  estimatedDuration: number; // Hours
  estimatedPrice: number;  // Base price
  finalPrice?: number;     // Actual price charged
  paymentId?: string;      // Reference to payment
  rating?: number;         // Customer rating (1-5)
  review?: string;         // Customer review
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Example:**
```json
{
  "customerId": "user123abc",
  "providerId": "provider456xyz",
  "categoryId": "electrician",
  "status": "Accepted",
  "serviceDate": 1713753600000,
  "location": "123 Main Street, Manila",
  "notes": "Need wiring for new room",
  "estimatedDuration": 2,
  "estimatedPrice": 1500,
  "createdAt": 1713667200000,
  "updatedAt": 1713667200000
}
```

---

### 7. `payments`
Payment records and transactions.

**Document ID:** Auto-generated (PaymentUID)

**Fields:**
```typescript
{
  bookingId: string;       // Reference to booking
  customerId: string;      // Reference to customer
  providerId: string;      // Reference to provider
  amount: number;          // Payment amount
  currency: string;        // Currency (PHP, USD, etc)
  status: "Pending" | "Processing" | "Completed" | "Failed" | "Refunded";
  paymentMethod: string;   // Method (credit_card, gcash, etc)
  transactionId?: string;  // Payment gateway transaction ID
  receipt?: string;        // Receipt URL
  notes?: string;          // Payment notes
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

**Example:**
```json
{
  "bookingId": "booking123",
  "customerId": "user123abc",
  "providerId": "provider456xyz",
  "amount": 1500,
  "currency": "PHP",
  "status": "Completed",
  "paymentMethod": "gcash",
  "transactionId": "TXN-123456",
  "createdAt": 1713667200000,
  "completedAt": 1713667200000
}
```

---

### 8. `messageThreads`
Chat conversation metadata.

**Document ID:** Auto-generated (ThreadUID)

**Fields:**
```typescript
{
  participants: string[];  // User IDs in conversation
  bookingId?: string;      // Related booking ID
  lastMessage?: string;    // Preview of last message
  lastMessageTime?: Timestamp;
  unreadCount?: number;    // Unread count
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 9. `messages`
Individual chat messages.

**Subcollection of:** `messageThreads/{threadId}/messages`

**Document ID:** Auto-generated

**Fields:**
```typescript
{
  senderId: string;        // User who sent message
  senderName: string;      // Sender display name
  message: string;         // Message text
  type: "text" | "image" | "file";
  content?: string;        // File URL if applicable
  readBy: string[];        // User IDs who read
  createdAt: Timestamp;
}
```

---

### 10. `reviews`
Customer reviews and ratings.

**Document ID:** Auto-generated (ReviewUID)

**Fields:**
```typescript
{
  bookingId: string;       // Reference to booking
  customerId: string;      // Who wrote review
  providerId: string;      // Who is being reviewed
  rating: number;          // 1-5 stars
  title: string;           // Review title
  text: string;            // Review text
  serviceQuality: number;  // 1-5
  communication: number;   // 1-5
  timeliness: number;      // 1-5
  helpful: number;         // Number of helpful votes
  createdAt: Timestamp;
}
```

---

### 11. `notifications`
In-app notifications and alerts.

**Document ID:** Auto-generated

**Fields:**
```typescript
{
  userId: string;          // Who receives notification
  type: string;            // notification type (booking, approval, message, etc)
  title: string;           // Notification title
  message: string;         // Notification message
  data?: object;           // Additional data
  read: boolean;           // Whether read
  readAt?: Timestamp;
  actionUrl?: string;      // Link to relevant screen
  createdAt: Timestamp;
}
```

---

### 12. `complaints`
User complaints and reports.

**Document ID:** Auto-generated

**Fields:**
```typescript
{
  reporterId: string;      // Who reported
  reportedUserId: string;  // Who is being reported
  bookingId?: string;      // Related booking
  reason: string;          // Complaint reason
  description: string;     // Detailed description
  severity: "low" | "medium" | "high"; // Severity level
  status: "Open" | "Under Review" | "Resolved" | "Dismissed";
  adminNotes?: string;     // Admin response
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}
```

---

## Getting Started

### Step 1: Manual Setup
Create these collections FIRST in Firebase Console:
```
serviceCategories/
├── electrician
├── plumber
├── welder
├── construction-worker
└── roofer
```

### Step 2: Automatic Setup
These collections are created automatically as users interact:
- `users` - When user registers
- `customerProfiles` - When customer created
- `providerProfiles` - When provider created
- `providerApplications` - When provider submits
- `bookings` - When customer books
- `payments` - When payment made
- `messageThreads` & `messages` - When chat starts
- `reviews` - When booking completed
- `notifications` - When event occurs
- `complaints` - When user complains

### Step 3: Verify Structure
After testing, check Firebase Console > Firestore > Data tab to see all collections created.

---

## Query Examples

### Get All Users by Role
```typescript
db.collection('users').where('role', '==', 'provider')
```

### Get Approved Providers
```typescript
db.collection('providerProfiles').where('isApproved', '==', true)
```

### Get Pending Approvals
```typescript
db.collection('providerApplications').where('status', '==', 'Pending Approval')
```

### Get Customer Bookings
```typescript
db.collection('bookings').where('customerId', '==', userId)
```

### Get Provider Jobs
```typescript
db.collection('bookings').where('providerId', '==', providerId)
```

### Get Completed Bookings (for reviews)
```typescript
db.collection('bookings').where('status', '==', 'Completed')
```

---

## Indexes for Performance

For production, create these Firestore indexes:
- `users` - Index on `(role, createdAt)`
- `bookings` - Index on `(customerId, createdAt)`
- `bookings` - Index on `(providerId, status)`
- `providerApplications` - Index on `(status, submittedAt)`
- `reviews` - Index on `(providerId, rating)`

---

## Security Rules (Test Mode vs Production)

**For MVP (Test Mode):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**For Production (Later):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own docs
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Providers can read all approved providers
    match /providerProfiles/{doc=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.userId;
    }
    
    // And so on...
  }
}
```

---

**Database Version:** 1.0  
**Last Updated:** April 21, 2026  
**Status:** Ready for MVP Testing
