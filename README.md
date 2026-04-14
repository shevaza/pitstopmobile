# PitStop Mobile

This folder contains the Expo client for PitStop 2.0. The mobile app depends on the root web app and API being available, so complete the root setup in [`../README.md`](C:\Users\shafiq.zabet\Desktop\code\pitstop2.0\README.md) first.

## Prerequisites

- Node.js 20 or later
- Expo Go on your phone, or an Android/iOS simulator
- A running PitStop backend from the repository root
- Azure AD app registration access for mobile sign-in

## Install

```bash
cd mobile
npm install
```

## Mobile environment setup

Create `mobile/.env` with:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR-PC-IP:3000
EXPO_PUBLIC_AZURE_AD_CLIENT_ID=your-azure-app-client-id
EXPO_PUBLIC_AZURE_AD_TENANT_ID=your-azure-tenant-id
EXPO_PUBLIC_AZURE_AD_REDIRECT_URI=pitstopmobile://auth
```

### What each value does

- `EXPO_PUBLIC_API_BASE_URL`: base URL for the PitStop web API. Use your computer's LAN IP when testing on a physical device.
- `EXPO_PUBLIC_AZURE_AD_CLIENT_ID`: Azure AD application ID used for the mobile sign-in flow.
- `EXPO_PUBLIC_AZURE_AD_TENANT_ID`: Azure tenant ID.
- `EXPO_PUBLIC_AZURE_AD_REDIRECT_URI`: redirect URI sent to Azure AD during mobile sign-in. Defaults to `pitstopmobile://auth` if omitted.

### Choosing the API URL

Use one of these depending on how you run the app:

- Physical phone on the same Wi-Fi: `http://192.168.x.x:3000`
- Android emulator: `http://10.0.2.2:3000`
- iOS simulator on the same Mac as the backend: `http://localhost:3000`

Do not use `localhost` when testing on a real phone because it points to the phone itself, not your development machine.

## Azure AD mobile auth setup

The Expo app uses the custom scheme `pitstopmobile`, defined in [`app.json`](C:\Users\shafiq.zabet\Desktop\code\pitstop2.0\mobile\app.json). Your Azure AD app registration must allow the mobile redirect URI sent by the app.

Make sure the Azure AD app registration for `EXPO_PUBLIC_AZURE_AD_CLIENT_ID` has this redirect URI under **Authentication** -> **Mobile and desktop applications**:

```text
pitstopmobile://auth
```

If your tenant already has a different mobile redirect URI registered, set `EXPO_PUBLIC_AZURE_AD_REDIRECT_URI` to that exact value and restart Expo. Azure AD requires an exact match, including scheme, path, and trailing slash.

## Run

Start the backend from the repository root. Use the LAN script when testing from Expo on a physical phone:

```bash
pnpm dev:lan
```

Then start Expo from `mobile/`:

```bash
npx expo start
```

You can also use:

```bash
npm run android
npm run ios
npm run web
```

## First-run checklist

After cloning from GitHub, verify all of the following before testing sign-in:

- The root app is running on port `3000`
- Root `.env` is configured correctly
- `mobile/.env` points to the correct backend URL
- Your phone/simulator can reach the backend over the network
- Azure AD redirect URIs are registered for both web and mobile

## Notes

- Expo Go hosts only the mobile client. The Node.js, Prisma, Next.js, and Supabase logic stays in the root application.
- The app sends the signed-in user's ID token to the backend in the `Authorization` header.
- If module access fails after sign-in, the problem is usually in the backend config, not the Expo app itself.

## Troubleshooting

- `AADSTS50011` means Azure AD rejected the redirect URI sent by the app. Add `pitstopmobile://auth` under **Authentication** -> **Mobile and desktop applications** for the Azure app registration, or set `EXPO_PUBLIC_AZURE_AD_REDIRECT_URI` to a URI already registered there.
- If sign-in opens but never returns to the app, re-check the `pitstopmobile://auth` redirect URI registration.
- If API requests fail on a phone, verify `EXPO_PUBLIC_API_BASE_URL` uses your computer's LAN IP and that both devices are on the same network.
- If sign-in works but access is empty, verify the backend Supabase and Azure access configuration in [`../README.md`](C:\Users\shafiq.zabet\Desktop\code\pitstop2.0\README.md).
