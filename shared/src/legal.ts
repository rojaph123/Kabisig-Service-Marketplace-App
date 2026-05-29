export type LegalSection = {
  title: string;
  body: string;
};

export const KABISIG_TERMS_VERSION = "2026-05-29";
export const KABISIG_PRIVACY_NOTICE_VERSION = "2026-05-29";

export const kabisigTermsSections: LegalSection[] = [
  {
    title: "1. Acceptance of these terms",
    body:
      "By creating an account, signing in, submitting a booking, applying as a worker, uploading documents, paying through a QR code, or otherwise using Kabisig, you agree to these Terms and Agreement and the Kabisig Privacy Notice. If you do not agree, do not use the app."
  },
  {
    title: "2. What Kabisig provides",
    body:
      "Kabisig is a service marketplace and operations platform that helps customers find local workers, request bookings, coordinate schedules, communicate, submit reviews or complaints, and manage worker registration and commission payments. Kabisig is not the direct provider of the booked service unless clearly stated in writing by an authorized admin."
  },
  {
    title: "3. Independent workers",
    body:
      "Workers listed in Kabisig are independent service providers and are not employees, agents, partners, or legal representatives of Kabisig. Workers are responsible for their own skills, tools, permits, licenses where required, pricing discussions, work quality, conduct, safety practices, taxes, and compliance with applicable laws."
  },
  {
    title: "4. Account accuracy and security",
    body:
      "You must provide truthful, complete, and updated information, including your name, contact details, profile information, addresses, service categories, work samples, payment references, and uploaded documents. You are responsible for keeping your login credentials secure and for all activity made through your account."
  },
  {
    title: "5. Customer responsibilities",
    body:
      "Customers must provide accurate booking details, service location, schedule, attachments, notes, and safe access to the work area. Customers must confirm accepted bookings when required, treat workers respectfully, pay agreed charges, avoid false reports, and use reviews and complaints honestly."
  },
  {
    title: "6. Worker responsibilities",
    body:
      "Workers must accept only bookings they can lawfully and professionally complete, keep availability updated, arrive or update status on time, communicate respectfully, avoid unsafe or illegal work, protect customer information, and complete services with reasonable care. Workers must not bypass Kabisig payment, commission, review, or safety processes."
  },
  {
    title: "7. Bookings and status flow",
    body:
      "A booking may move through request, worker acceptance, customer confirmation, on-the-way, in-progress, completion, cancellation, reschedule, complaint, and review steps. A worker must not mark a booking as on the way unless the booking is accepted and customer confirmation is required and completed in the app."
  },
  {
    title: "8. Multiple bookings and schedule conflicts",
    body:
      "Kabisig may prevent duplicate or conflicting bookings for the same worker or customer time slot. Users must not create overlapping bookings to manipulate availability, hold multiple workers unfairly, avoid payment, or interfere with another user's legitimate booking."
  },
  {
    title: "9. Pricing, payments, and records",
    body:
      "Kabisig may store booking amounts, final payment amounts, payment methods, status changes, timestamps, proof images, reference numbers, payment dates, and related booking links. These records support worker earnings, customer history, admin review, dispute handling, reports, and marketplace transparency."
  },
  {
    title: "10. Worker registration payment",
    body:
      "If worker registration payment is enabled, a worker may be required to pay the displayed registration fee through the active admin QR code, upload clear proof of payment, provide a reference number and payment date, and wait for admin review before approval. Promo, waived, or free registration rules may be applied by admin when available."
  },
  {
    title: "11. Monthly worker commission",
    body:
      "Workers agree to pay the platform commission shown in the app for completed and paid bookings, currently intended as 10% unless the admin settings show a different rate. The commission billing cycle includes completed transactions from the 29th day of the previous month through the 28th day of the current month."
  },
  {
    title: "12. Official commission bill and QR payment",
    body:
      "Workers may view a running commission estimate before the billing date, but the official billing statement and payment QR code become available only on the 28th day of each month. Workers cannot pay commission in advance because the amount must be based on the finalized billing statement."
  },
  {
    title: "13. Commission due date, grace period, and surcharge",
    body:
      "The official monthly commission bill is due on the 5th day of the following month. The 8th day is the grace-period deadline. After the grace period, Kabisig may apply the daily overdue surcharge shown in the app, such as PHP 5 per day, until the outstanding balance is fully resolved."
  },
  {
    title: "14. Proof of commission payment and admin approval",
    body:
      "To settle a commission bill, the worker must upload a clear payment screenshot, reference number, and payment date. Payment remains pending until reviewed by an authorized Kabisig admin. A receipt or approved status is shown only after admin verification."
  },
  {
    title: "15. Booking restrictions for unpaid balances",
    body:
      "If a worker has an unpaid commission balance after the grace period, Kabisig may restrict that worker from accepting bookings, claiming matched posts, or using booking-related actions until the balance is fully paid and approved. Customers may still view the worker profile and send requests, but the worker cannot accept while restricted."
  },
  {
    title: "16. Reviews, complaints, and disputes",
    body:
      "Reviews, ratings, complaints, cancellation requests, reschedule requests, reports, messages, booking history, attachments, proof of work, proof of payment, and admin notes may be reviewed by Kabisig administrators to investigate issues, enforce rules, protect users, and improve trust and safety."
  },
  {
    title: "17. User content and uploads",
    body:
      "You are responsible for photos, videos, documents, messages, payment screenshots, work samples, and other content you upload. You confirm that you have the right to submit them and grant Kabisig permission to store, display, process, and review them as needed to operate the platform, verify accounts, resolve disputes, and comply with lawful obligations."
  },
  {
    title: "18. Prohibited conduct",
    body:
      "Users must not submit false information, impersonate others, misuse another person's data, upload harmful or illegal content, harass or threaten users, manipulate reviews, abuse booking or messaging features, avoid platform charges, submit fake payment proof, interfere with app security, or use Kabisig for unlawful activity."
  },
  {
    title: "19. Safety and emergency limitations",
    body:
      "Kabisig is not an emergency service. Users should contact the proper emergency, medical, police, fire, utility, or government authority for urgent or hazardous situations. Users are responsible for assessing safety before entering a site, allowing access, performing work, or continuing a booking."
  },
  {
    title: "20. Admin enforcement",
    body:
      "Kabisig may review, reject, approve, restrict, suspend, remove, or terminate accounts, provider profiles, bookings, content, payment submissions, or marketplace access when there is suspected fraud, safety risk, false information, non-payment, policy violation, abuse, legal concern, or conduct that may harm users or the platform."
  },
  {
    title: "21. Service availability and changes",
    body:
      "Kabisig may change, pause, improve, or discontinue features, categories, payment settings, commission rules, schedules, notices, and admin tools when needed for operations, safety, compliance, or product improvement. Some features may depend on internet access, third-party services, device permissions, or Firebase availability."
  },
  {
    title: "22. Disclaimers and limitation of liability",
    body:
      "To the maximum extent allowed by law, Kabisig does not guarantee every user's identity, skill, availability, pricing, conduct, service quality, response time, or outcome. Kabisig is not responsible for indirect, incidental, special, consequential, exemplary, or punitive damages, lost income, lost data, personal injury, property damage, or disputes caused by user conduct or third-party services, except where liability cannot legally be excluded."
  },
  {
    title: "23. User indemnity",
    body:
      "You agree to hold Kabisig, its admins, operators, and authorized representatives harmless from claims, losses, liabilities, damages, costs, or expenses arising from your false information, unlawful conduct, unsafe work, breach of these terms, misuse of another person's data, unpaid obligations, fake payment proof, uploaded content, or dispute with another user."
  },
  {
    title: "24. Updates to these terms",
    body:
      "Kabisig may update these terms when features, legal requirements, payment rules, commission rules, or marketplace operations change. The app may require you to accept the latest version before continuing. Continued use after an update means you accept the latest applicable terms."
  },
  {
    title: "25. Contact and support",
    body:
      "For account, booking, payment, privacy, complaint, or support concerns, contact Kabisig through the in-app Help screen or email support@kabisig.app. Admin decisions may require review of account, booking, payment, proof, message, and audit records."
  }
];

export const kabisigPrivacyNoticeSections: LegalSection[] = [
  {
    title: "1. Privacy notice overview",
    body:
      "This Privacy Notice explains how Kabisig collects, uses, stores, shares, protects, and retains personal information when you use the app as a customer, worker, or admin. It is intended to support transparent processing under applicable privacy laws, including the Philippine Data Privacy Act of 2012 where applicable."
  },
  {
    title: "2. Information we collect",
    body:
      "Kabisig may collect account details, contact information, profile photos, customer addresses, optional GPS pins, worker identity details, valid ID or verification files, emergency contact details, work samples, service categories, availability, booking details, messages, reviews, complaints, payment records, QR payment proof, reference numbers, payment dates, notification records, device/session information, audit logs, and support requests."
  },
  {
    title: "3. Why we use information",
    body:
      "Kabisig uses information to create and secure accounts, verify workers, display public provider profiles, match customers with workers, process bookings, prevent duplicate bookings, send notifications, support maps and directions, record payments and commissions, review complaints, detect abuse, produce admin reports, improve reliability, and comply with legal, accounting, safety, and operational needs."
  },
  {
    title: "4. Location and address data",
    body:
      "Customers may provide complete addresses and optional GPS pins so workers can locate a service site. Workers may provide service areas or profile locations. Location information is used for booking coordination, navigation support, safety review, and dispute handling. Only submit location information that you are authorized to share."
  },
  {
    title: "5. Photos, documents, and payment proof",
    body:
      "Kabisig may store and review uploaded photos, videos, documents, work samples, IDs, QR payment screenshots, receipts, and other attachments. These files are used for worker verification, booking support, payment review, dispute handling, safety checks, and account enforcement."
  },
  {
    title: "6. Sharing of information",
    body:
      "Kabisig may share limited information with other users when needed for a booking, such as customer booking details with the assigned worker or approved worker profile details with customers. Admins may access records for operations, verification, complaints, payments, safety, and support. Kabisig may also use service providers for authentication, database, file storage, maps, notifications, hosting, analytics, and security."
  },
  {
    title: "7. Payment and commission records",
    body:
      "Kabisig keeps payment and commission records, including amounts, billing cycles, due dates, surcharge calculations, QR payment status, proof images, reference numbers, reviewed-by admin details, approval status, and receipts. These records help confirm payment, prevent fraud, resolve disputes, enforce restrictions, and maintain accounting history."
  },
  {
    title: "8. Retention of information",
    body:
      "Kabisig retains account, booking, payment, commission, provider verification, complaint, audit, support, and safety records for as long as needed to operate the platform, resolve disputes, comply with legal or accounting obligations, prevent fraud, and preserve accurate service history. Some records may remain after account inactivity or deletion requests when retention is legally or operationally necessary."
  },
  {
    title: "9. Security safeguards",
    body:
      "Kabisig uses reasonable technical and organizational safeguards such as authenticated access, Firebase security rules, role-based admin access, storage controls, and audit records. No system is perfectly secure, so users should protect their own accounts, avoid sharing passwords, and immediately report suspicious activity."
  },
  {
    title: "10. Your privacy rights",
    body:
      "Subject to applicable law and necessary retention limits, you may request access, correction, deletion, blocking, or a copy of your personal information, and you may raise concerns about how your information is handled. Some requests may require identity verification and may be limited when records are needed for disputes, safety, payments, accounting, fraud prevention, or legal compliance."
  },
  {
    title: "11. Children and eligibility",
    body:
      "Kabisig is intended for users who can lawfully enter into service, booking, payment, and worker agreements. Users who are minors or otherwise unable to consent must not create an account or submit personal information without the required consent of a parent, guardian, or lawful representative."
  },
  {
    title: "12. Privacy contact",
    body:
      "For privacy questions, correction requests, account concerns, or data-related complaints, contact Kabisig through the in-app Help screen or email support@kabisig.app. Kabisig may need account, booking, payment, or identity details to verify and process the request."
  }
];

export const kabisigWorkerAgreementSections: LegalSection[] = [
  {
    title: "Worker identity and application",
    body:
      "Every profile detail, service category, qualification statement, work sample, verification file, emergency contact, and communication you submit to Kabisig must be accurate, current, and lawfully yours to provide for marketplace review."
  },
  {
    title: "Admin review and public profile",
    body:
      "Kabisig may review your profile photo, valid ID, emergency contact, work samples, business name, service categories, service areas, registration payment status, and uploaded requirements before approval. Approved public profile details may be shown to customers."
  },
  {
    title: "Approval is not guaranteed",
    body:
      "Provider applications are assessed for identity verification, safety, professionalism, service relevance, and completion of required information. Approval is not automatic, and admin may request revisions, reject, suspend, or remove a provider profile when needed."
  },
  {
    title: "Booking conduct",
    body:
      "You agree to accept only bookings you can complete professionally, keep availability truthful, avoid overlapping or unsafe work, communicate respectfully, follow booking status requirements, and not mark a booking as on the way before the required customer confirmation."
  },
  {
    title: "Commission billing",
    body:
      "You agree to pay the worker commission shown in the app for completed and paid bookings. The monthly billing cycle covers the 29th day of the previous month through the 28th day of the current month, and the official bill is released on the 28th day."
  },
  {
    title: "Commission payment proof",
    body:
      "The QR code for commission payment is shown only when the official bill is available. To pay, upload a clear payment screenshot, reference number, and payment date, then wait for admin approval before the bill is treated as paid."
  },
  {
    title: "Due date and restrictions",
    body:
      "Commission is due on the 5th day of the following month, with a grace period through the 8th day. If a balance remains unpaid after the grace period, Kabisig may apply the displayed daily surcharge and restrict booking-related actions until payment is completed and approved."
  },
  {
    title: "Reviews, complaints, and enforcement",
    body:
      "Customer reviews, complaint records, messages, payment records, response quality, cancellation behavior, and service completion history may be reviewed by Kabisig to preserve trust, safety, payment compliance, and marketplace quality."
  },
  {
    title: "Content and lawful use",
    body:
      "You agree not to upload falsified documents, misleading images, fake payment proof, offensive content, or materials that violate privacy, intellectual property, or applicable law. Kabisig may suspend or remove accounts that breach these terms."
  }
];
