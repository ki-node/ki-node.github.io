import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.kinode.hub',
  appName: 'Orbit',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 15_000,
      backgroundColor: '#01011b',
      showSpinner: false,
    },
  },
};

export default config;
