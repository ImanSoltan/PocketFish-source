import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agilewithai.pocketfish',
  appName: 'PocketFish',
  webDir: 'dist',
  plugins: {
    Camera: { presentationStyle: 'fullscreen' },
  },
};

export default config;
