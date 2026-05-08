import { getApp } from "@react-native-firebase/app";

/**
 * React Native Firebase auto-initializes from google-services.json (Android)
 * and GoogleService-Info.plist (iOS). No manual initializeApp() needed.
 *
 * For Expo managed workflow, config is set in app.json plugins.
 */

const app = getApp();

export { app };
