import { initializeApp, getApps, getApp } from "@react-native-firebase/app";

/**
 * React Native Firebase reads config from google-services.json (Android)
 * and GoogleService-Info.plist (iOS) automatically.
 *
 * For Expo managed workflow, config is set in app.json plugins.
 * Ensure the Firebase config files are placed in the project root.
 */

const app = getApps().length === 0 ? initializeApp() : getApp();

export { app };
