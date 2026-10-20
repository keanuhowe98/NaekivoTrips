import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.naekivo.trips',
  appName: 'Naekivo Trips',
  webDir: 'dist',
  backgroundColor: '#f7f8f5',
  // Bundle the app locally for offline access; no remote server URL is used.
  android: {
    backgroundColor: '#f7f8f5',
  },
  ios: {
    backgroundColor: '#f7f8f5',
    // The shared CSS applies env(safe-area-inset-*) to the app chrome.
    contentInset: 'never',
  },
};

export default config;
