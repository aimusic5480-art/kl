import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.twende.client',
  appName: 'Aletwende',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
