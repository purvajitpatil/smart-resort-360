# StaySmart Guest — React Native (Expo) App

This is a **React Native (Expo)** port of the StaySmart guest web app (`apps/guest-web/`),
designed to run on **Android**, **iOS**, and **Web** with a single codebase.

## What it does

- Same 4 tabs as the web app: **Stay** · **Assistant** · **Requests** · **Preferences**
- Talks to the same FastAPI backend (`apps/staySmart/backend`) — no backend changes needed
- JWT-based auth, dark/light via system, fully responsive

## Project structure

```
StaySmartGuest/
├── App.tsx                 # Root component with React Navigation (bottom tabs)
├── app.json                # Expo config (Android package: com.staysmart.guest)
├── src/
│   ├── lib/
│   │   ├── api.ts          # Fetch wrapper with token refresh
│   │   ├── storage.ts      # AsyncStorage adapter (replaces localStorage)
│   │   └── domain.ts       # Typed endpoints (Stay, Requests, Memory, Chat…)
│   ├── components/
│   │   ├── Shell.tsx       # App frame: header + scroll + tab bar
│   │   ├── ui.tsx          # Chips, Section, Empty, Loading, Button, Icon…
│   │   ├── Toast.tsx       # Transient notification
│   │   └── RequireAuth.tsx # Auth gate
│   └── screens/
│       ├── Login.tsx
│       ├── Home.tsx
│       ├── Assistant.tsx
│       ├── Requests.tsx
│       └── Memory.tsx
└── assets/                 # App icons and splash images
```

## Run it

### Option 1 — Expo Go (no Android Studio required)
```bash
cd StaySmartGuest
npx expo start
# Scan QR code with Expo Go app on Android
```

### Option 2 — Android emulator (Android Studio)
```bash
cd StaySmartGuest
npx expo run:android
```

### Option 3 — Build a real APK
```bash
npm install -g eas-cli
eas build -p android --profile preview
```

## Connect to your backend

By default the app uses `/api/v1` (relative — works with the same origin in dev).
For Android emulator, set this environment variable to your host machine's IP:
```bash
# In .env.local or via eas.json
EXPO_PUBLIC_API_BASE=http://10.0.2.2:8000/api/v1
```

`10.0.2.2` is the special Android emulator alias for the host machine's `127.0.0.1`.

## Demo credentials (from the backend)

- **Guest**: `guest@smartresort360.demo` / `DemoGuest!2026`
- **Staff**: any staff user with `DemoStaff!2026`
- **Manager**: `manager@smartresort360.demo` / `DemoManager!2026`

## How it compares to the web app

| Feature | Web (`apps/guest-web`) | Native (this) |
|---|---|---|
| Routing | `react-router-dom` | `@react-navigation/bottom-tabs` |
| CSS | Tailwind v4 | `StyleSheet.create()` + design tokens |
| Storage | `localStorage` | `@react-native-async-storage/async-storage` |
| Icons | Inline SVG | `@expo/vector-icons` (MaterialCommunityIcons) |
| Build | Vite | Metro (via Expo) |
| Auth | Same JWT flow | Same JWT flow |

The **domain types** (`src/lib/domain.ts`) are intentionally identical to
`apps/guest-web/src/lib/domain.ts` — so any backend changes are picked up by both apps.

## What was deliberately not ported

- **Login-as-guest flow** (a different code path for first-time users) — to keep the
  build focused. Add it back if you have a guest demo.
- **Notifications screen** — uses SSE which needs a different transport on mobile.
  Add via WebSocket or polling.
- **Map view / Recommendations** — would need `react-native-maps` or similar. The data
  layer is already in `domain.ts`; the UI is left to a future iteration.

## Porting the staff app

The staff app follows the same pattern. Create `StaySmartStaff/` with the same `npx
create-expo-app` template, then copy `apps/staff-dashboard/src/lib/{api,domain}.ts`
and adapt the pages to React Native. Use a sidebar-drawer or stack instead of tabs.
