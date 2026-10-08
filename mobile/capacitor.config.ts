import type { CapacitorConfig } from '@capacitor/cli';

// The app opens the published حِرَفي site, so every update you publish from
// Rocket reaches the app instantly — no store review needed for web changes.
// Change SERVER_URL (or set HERAFI_URL) when you move to your own domain.
const SERVER_URL = process.env.HERAFI_URL || 'https://sanaei1489.builtwithrocket.new';

const config: CapacitorConfig = {
  // The store id. It can't be changed after the first upload to Google Play /
  // the App Store, and it must match the app you add in Firebase.
  appId: 'com.herafi.app',
  appName: 'حِرَفي',
  webDir: 'www',

  server: {
    url: `${SERVER_URL}/home-screen`,
    cleartext: false,
    // Shown from the app itself when the site can't be reached (no internet).
    errorPath: 'error.html',
  },

  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
  },

  ios: {
    contentInset: 'never',
    backgroundColor: '#ffffff',
    limitsNavigationsToAppBoundDomains: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    FirebaseMessaging: {
      // Show notifications as banners with sound even while the app is open.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
