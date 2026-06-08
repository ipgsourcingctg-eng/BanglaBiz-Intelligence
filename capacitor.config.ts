import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.salespulse.app',
  appName: 'SalesPulse',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
