import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';
import { HealthProviderService, HEALTH_PROVIDERS, HealthProvider } from '@/services/healthProviderService';

interface ConnectLabsModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected: (provider: HealthProvider) => void;
}

export default function ConnectLabsModal({ visible, onClose, onConnected }: ConnectLabsModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<HealthProvider | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [exchangingToken, setExchangingToken] = useState(false);

  const handleProviderSelect = (provider: HealthProvider) => {
    setSelectedProvider(provider);
    const clientId = process.env.EXPO_PUBLIC_EPIC_CLIENT_ID || '';
    const state = Math.random().toString(36).substring(7);
    const url = HealthProviderService.generateAuthUrl(provider, clientId, state);
    setAuthUrl(url);
  };

  const handleWebViewNavigation = async (navState: any) => {
    const { url } = navState;
    if (url.startsWith('https://localhost/auth/callback')) {
      try {
        const result = await HealthProviderService.handleAuthCallback(url);
        if (result && selectedProvider) {
          // Exchange auth code for access token
          setExchangingToken(true);
          const clientId = process.env.EXPO_PUBLIC_EPIC_CLIENT_ID || '';
          await HealthProviderService.exchangeCodeForToken(
            selectedProvider,
            result.code,
            clientId,
          );
          setExchangingToken(false);

          onConnected(selectedProvider);
          setSelectedProvider(null);
          setAuthUrl(null);
          onClose();
        }
      } catch (error) {
        setExchangingToken(false);
        console.error('Auth error:', error);
        Alert.alert('Authorization Error', (error as Error).message);
        setSelectedProvider(null);
        setAuthUrl(null);
      }
    }
  };

  const handleClose = () => {
    setSelectedProvider(null);
    setAuthUrl(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={palette.gray700} />
          </TouchableOpacity>
          <Text style={styles.title}>Connect Lab Providers</Text>
        </View>

        {!authUrl ? (
          <ScrollView style={styles.content}>
            <Text style={styles.subtitle}>Import lab results automatically from your health providers</Text>
            {HEALTH_PROVIDERS.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                style={styles.providerCard}
                onPress={() => handleProviderSelect(provider)}
              >
                <Text style={styles.providerLogo}>{provider.logo}</Text>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{provider.name}</Text>
                  <Text style={styles.providerDesc}>{provider.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.gray400} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : exchangingToken ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={styles.loadingText}>Connecting to {selectedProvider?.name}...</Text>
            <Text style={styles.loadingSubtext}>Fetching your lab results</Text>
          </View>
        ) : (
          <WebView
            source={{ uri: authUrl }}
            onNavigationStateChange={handleWebViewNavigation}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith('https://localhost/auth/callback')) {
                handleWebViewNavigation({ url: request.url });
                return false;
              }
              return true;
            }}
            style={styles.webview}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray200,
  },
  closeButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.gray900,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    color: palette.gray600,
    marginBottom: 24,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: palette.gray50,
    borderRadius: 8,
    marginBottom: 12,
  },
  providerLogo: {
    fontSize: 24,
    marginRight: 12,
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '500',
    color: palette.gray900,
  },
  providerDesc: {
    fontSize: 14,
    color: palette.gray600,
    marginTop: 2,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.gray900,
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: palette.gray500,
    marginTop: 8,
  },
});