# Naekivo Trips

A responsive travel planner for the web, Android, and iOS. The React + TypeScript app is shared across platforms; Capacitor packages the same interface into native Android and iOS apps.

This first version stores trips on the current device. It includes example travel content and a deterministic planning engine. It does not connect to booking services, live weather, live maps, an AI provider, or a cloud account.

## Run the web app

Use Node.js 22 or newer (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To verify and preview the production bundle:

```sh
npm test
npm run build
npm run preview
```

The build output is `dist/`. Serve it over HTTPS to support installation as a progressive web app and browser sharing. The app includes a web manifest, app icons, and a production-only service worker. Supported browsers can install it using their Install app or Add to Home Screen command.

The service worker caches public static assets only. It deliberately leaves navigation, authentication pages, and API responses on the network. A web cold start still needs internet; an already open app can continue using its local trip data. The native apps bundle their interface locally and can open without a network connection.

## Android

The native Android project lives in `android/`. Install Android Studio 2025.2.1 or later and Android SDK Platform 36 (see `android/variables.gradle`); use the JDK provided by Android Studio. These are the [Capacitor 8 environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).

```sh
npm ci
npm run mobile:sync
npm run android
```

Select an emulator or connected Android device in Android Studio and run the app. To build a debug APK from Windows after the SDK and JDK are configured:

```powershell
cd android
.\gradlew.bat assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/`. Use Android Studio's signed bundle workflow for a Google Play release; release signing credentials are not included in this repository.

## iOS

The native iOS project lives in `ios/` and uses Swift Package Manager. Building or running iOS requires a Mac with Xcode 26 or later and the Xcode command-line tools. Windows can edit the shared source but cannot compile an iOS application. See the [Capacitor iOS setup](https://capacitorjs.com/docs/getting-started/environment-setup) and [Swift Package Manager workflow](https://capacitorjs.com/docs/ios/spm).

On a Mac:

```sh
npm ci
npm run mobile:sync
npm run ios
```

In Xcode, select the App target, select a simulator or device, and configure the signing team for device runs. App Store distribution requires the appropriate Apple developer account, signing configuration, and an archive built in Xcode. None of those credentials are stored here.

`ios/App/App/PrivacyInfo.xcprivacy` is included in the App target's resources and declares the UserDefaults access used for local trip preferences. This follows the [Preferences privacy manifest guidance](https://capacitorjs.com/docs/apis/preferences). Update these declarations when adding services or plugins that change data collection.

## Updating the mobile apps

After changing web code, run `npm run mobile:sync` before rebuilding in Android Studio or Xcode. This builds the production interface and copies it into both native projects, including the Preferences and Share plugins. The native app identifier is `com.naekivo.trips`; change it before a first store release if your organization uses a different identifier.

The native projects are generated once and kept in source control. Do not run `cap add` again on an existing platform; that command is only needed when creating a platform project for the first time.

## Data and service boundaries

- Trips persist through Capacitor Preferences: local storage on the web, SharedPreferences on Android, and UserDefaults on iOS. Data is scoped to the browser or device; it does not automatically sync across installations. [Preferences behavior](https://capacitorjs.com/docs/apis/preferences).
- Preferences is a lightweight local store, not an encrypted document vault. Do not use this version to store passport scans, payment information, or other sensitive identity documents.
- Replanning uses the user's chosen scenario and locally defined activity alternatives. Weather labels and prices are sample planning estimates, not current forecasts, availability, or purchasable offers.
- Sharing sends itinerary content through the platform share sheet or the available browser fallback. It does not create a live collaborative trip link.
- Browser data can be removed by clearing site storage. Uninstalling a native app can remove its local data. Use the app's backup/export feature to retain a copy.
- Cloud authentication, shared trip editing, payments, push notifications, document uploads, and live integrations require additional backend work and provider credentials.

## Validation and release status

The web app can be built and tested on Windows. Both native projects have been generated and synced successfully, with native branding and plugin registrations. Native resource XML and the iOS privacy manifest were parsed successfully. Android `assembleDebug` was attempted but stopped because no Java/JDK is configured; no Android SDK was found in the environment. iOS compilation requires macOS/Xcode. Native compilation and real-device behavior have therefore not been verified here. No signed APK, Android App Bundle, or iOS archive has been produced, and no app has been submitted to either store.

Before distribution, run the app on physical Android and iOS devices and verify storage persistence, sharing, keyboard layout, safe areas, and offline launch. Review the app identifier, branding, privacy disclosures, and signing settings for your release.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | Shared React interface, planner, and local persistence |
| `tests/` | Planning and data validation tests |
| `public/` | Web icons, local imagery, manifest, and static-asset service worker |
| `capacitor.config.ts` | Shared native application configuration |
| `android/` | Android Studio project |
| `ios/` | Xcode project with Swift Package Manager dependencies |
| `dist/` | Generated production web bundle; rebuild rather than edit |

## Product basis and local assets

The implementation follows the [shared Naekivo planning conversation](https://chatgpt.com/share/6ad62dbd-6e78-83e9-ad91-6528f3737ca1): independent travel planning with budgets, interests, accessibility preferences, travel buffers, and user-reviewed adaptations. The initial catalog is illustrative, and the app does not claim destination-wide discovery coverage or an Emerald Coast Explorer integration.

DM Sans and Manrope are bundled locally with their SIL Open Font Licenses in `public/fonts/`. Photography is bundled from Unsplash as general travel inspiration, not as verified photos of the named itinerary ideas:

- `coast.jpg`: https://images.unsplash.com/photo-1507525428034-b723cf961d3e
- `beach.jpg`: https://images.unsplash.com/photo-1473116763249-2faaef81ccda
- `town.jpg`: https://images.unsplash.com/photo-1510414842594-a61c69b5ae57

`npm test` includes planner unit tests and React interaction tests using a simulated DOM. This is not a substitute for visual browser and native device testing. Browser UI automation was unavailable during this build, so visual rendering and installed-app behavior still need device verification.
