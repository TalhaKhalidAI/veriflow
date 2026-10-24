import { config } from '@gluestack-ui/config';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GluestackUIProvider config={config}>
        <AnimatedSplashOverlay />
        <Drawer
          screenOptions={{
            headerShown: true,
            headerTitle: 'VeriFlow',
            headerStyle: { backgroundColor: '#07111d' },
            headerTintColor: '#facc15',
            headerTitleStyle: { fontWeight: '900', fontSize: 28 },
            drawerStyle: { backgroundColor: '#0b1220', width: 280 },
            drawerActiveTintColor: '#facc15',
            drawerInactiveTintColor: '#e2e8f0',
            drawerLabelStyle: { fontWeight: '700' },
            sceneContainerStyle: { backgroundColor: '#050b14' },
          }}
        >
          <Drawer.Screen name="index" options={{ title: 'Home', drawerLabel: 'Home' }} />
          <Drawer.Screen name="scanner" options={{ title: 'Scanner', drawerLabel: 'Scanner' }} />
          <Drawer.Screen name="settings" options={{ title: 'Settings', drawerLabel: 'Settings' }} />
        </Drawer>
      </GluestackUIProvider>
    </ThemeProvider>
  );
}
