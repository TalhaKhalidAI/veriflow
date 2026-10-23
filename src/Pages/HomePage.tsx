import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

const BLACK = '#0f172a';
const YELLOW = '#facc15';
const PANEL = '#111827';

export default function HomePage() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>VeriFlow</Text>
        <Text style={styles.subtitle}>Offline JWT verification for industrial operations</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <Link href="/scanner" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Open Scanner</Text>
          </Pressable>
        </Link>
        <Link href="/settings" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Manage Keys</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BLACK,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: YELLOW,
    fontSize: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: '#e2e8f0',
    fontSize: 16,
    marginTop: 8,
  },
  card: {
    backgroundColor: PANEL,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 16,
    padding: 18,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  primaryButton: {
    minHeight: 56,
    backgroundColor: YELLOW,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: BLACK,
    fontWeight: '900',
    fontSize: 18,
  },
  secondaryButton: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: YELLOW,
    fontWeight: '800',
    fontSize: 18,
  },
});
