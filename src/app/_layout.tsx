import { config } from '@gluestack-ui/config';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Drawer, DrawerContentScrollView, DrawerItemList } from 'expo-router/drawer';
import * as SplashScreen from 'expo-splash-screen';
import { Image, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <GluestackUIProvider config={config}>
        <AnimatedSplashOverlay />
        <Drawer
          drawerContent={(props) => (
            <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
              <View style={styles.drawerBrand}>
                <Image
                  source={require('../assets/msi.png')}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                  accessibilityLabel="VeriFlow logo"
                />
                <View>
                  <Text style={styles.drawerTitle}>VeriFlow</Text>
                  <Text style={styles.drawerSubtitle}>INDUSTRIAL OFFLINE SCANNER</Text>
                </View>
              </View>
              <DrawerItemList {...props} />
            </DrawerContentScrollView>
          )}
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
            sceneStyle: { backgroundColor: '#050b14' },
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

const styles = StyleSheet.create({
  drawerContent: {
    flexGrow: 1,
    backgroundColor: '#0b1220',
  },
  drawerBrand: {
    minHeight: 112,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  drawerLogo: {
    width: 58,
    height: 58,
  },
  drawerTitle: {
    color: '#facc15',
    fontSize: 22,
    fontWeight: '900',
  },
  drawerSubtitle: {
    color: '#cbd5e1',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
  },
});
