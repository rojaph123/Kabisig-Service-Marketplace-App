# Kabisig App Deployment Requirements

This folder is the release packet for Google Play Console and Apple App Store Connect.

Before submission, replace `https://YOUR_ADMIN_WEB_DOMAIN` with the real hosted admin web domain.

## Build commands

Run these after logging in to Expo/EAS:

```bash
npm run build:android:production
npm run build:ios:production
```

Android production builds create an `.aab` for Google Play. iOS production builds are uploaded through EAS/TestFlight after Apple credentials are configured.

## Public URLs after admin web hosting

- Terms: `https://YOUR_ADMIN_WEB_DOMAIN/terms`
- Privacy: `https://YOUR_ADMIN_WEB_DOMAIN/privacy`
- Data deletion: `https://YOUR_ADMIN_WEB_DOMAIN/data-deletion`
- Support: `https://YOUR_ADMIN_WEB_DOMAIN/support`

## Final manual requirements

- Google Play Console account
- Apple Developer account
- EAS login and credentials
- Real demo reviewer accounts
- Real screenshots from final production build
- Privacy/data safety answers checked against the current app behavior
