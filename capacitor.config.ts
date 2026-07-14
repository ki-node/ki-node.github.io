import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.kinode.hub',
  appName: 'ki-node',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 15_000,
      backgroundColor: '#140c22',
      showSpinner: false,
    },
  },
};

export default config;
