/**
 * Expo config. Only public (EXPO_PUBLIC_*) values and the optional Google Maps
 * key are read here; no server secret ever belongs in the mobile app.
 */
module.exports = {
  expo: {
    name: 'WildGuard LK',
    slug: 'wildguard-lk',
    scheme: 'wildguard',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0C3B2E',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'lk.wildguard.mobile',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'WildGuard LK uses your location to find your village when you report wildlife conflict, and to record your route while you patrol.',
        NSCameraUsageDescription:
          'WildGuard LK uses the camera so you can attach a photo to a report or a patrol incident.',
        NSPhotoLibraryUsageDescription: 'WildGuard LK lets you attach a photo to a report.',
      },
    },
    android: {
      package: 'lk.wildguard.mobile',
      adaptiveIcon: {
        backgroundColor: '#0C3B2E',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'CAMERA'],
      config: {
        googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' },
      },
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'WildGuard LK uses your location to find your village when you report wildlife conflict, and to record your route while you patrol.',
        },
      ],
      [
        'expo-image-picker',
        {
          cameraPermission: 'WildGuard LK uses the camera so you can attach a photo to a report.',
          photosPermission: 'WildGuard LK lets you attach a photo to a report.',
        },
      ],
    ],
    experiments: { typedRoutes: false },
  },
};
