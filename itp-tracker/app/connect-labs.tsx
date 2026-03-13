import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { palette } from '@/constants/Colors';
import {
  PROVIDERS,
  HealthProvider,
  ProviderConnection,
  getConnections,
  removeConnection,
  getAuthUrl,
  exchangeCodeForToken,
  syncAllLabs,
  getLastSyncTime,
} from '@/services/healthProviderService';
import { WebView } from 'react-native-webview';

export default function ConnectLabsScreen() {
  const router = useRouter();
  const [connections, setConnections] = React.useState<ProviderConnection[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState<string | null>(null);
  const [webViewProvider, setWebViewProvider] = React.useState<HealthProvider | null>(null);
  const [webViewUrl, setWebViewUrl] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    const [conns, sync] = await Promise.all([
      getConnections(),
      getLastSyncTime(),
    ]);
    setConnections(conns);
    setLastSync(sync);
    setLoaded(true);
  };

  const handleConnect = (provider: HealthProvider) => {
    if (!provider.clientId) {
      Alert.alert(
        'Setup Required',
        `To connect ${provider.name}, you need to register your app and add the client ID to your .env file.\n\nEnvironment variable: EXPO_PUBLIC_${provider.id.replace(/-/g, '_').toUpperCase()}_CLIENT_ID`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = getAuthUrl(provider, state);
    setWebViewProvider(provider);
    setWebViewUrl(authUrl);
  };

  const handleWebViewNavigationChange = async (navState: any) => {
    const { url } = navState;
    if (!url.startsWith('https://localhost/auth/callback')) return;

    // Extract the code from the callback URL
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const error = urlObj.searchParams.get('error');

    setWebViewProvider(null);
    setWebViewUrl('');

    if (error) {
      Alert.alert('Connection Failed', `Authorization was denied: ${error}`);
      return;
    }

    if (!code || !webViewProvider) {
      Alert.alert('Connection Failed', 'No authorization code received.');
      return;
    }

    try {
      setSyncing(true);
      await exchangeCodeForToken(webViewProvider, code);
      await loadState();

      // Auto-sync labs after connecting
      const result = await syncAllLabs();
      Alert.alert(
        'Connected!',
        `${webViewProvider.name} connected successfully.\n${result.synced} lab results imported.${result.errors.length > 0 ? '\n\nWarnings: ' + result.errors.join(', ') : ''}`,
      );
    } catch (err: any) {
      Alert.alert('Connection Failed', err.message);
    } finally {
      setSyncing(false);
      await loadState();
    }
  };

  const handleDisconnect = (providerId: string) => {
    const provider = PROVIDERS.find((p) => p.id === providerId);
    Alert.alert(
      'Disconnect',
      `Remove ${provider?.name} connection? Your previously imported lab data will remain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await removeConnection(providerId);
            await loadState();
          },
        },
      ]
    );
  };

  const handleSyncAll = async () => {
    if (connections.length === 0) {
      Alert.alert('No Providers', 'Connect a health provider first to sync labs.');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncAllLabs();
      await loadState();
      Alert.alert(
        'Sync Complete',
        `${result.synced} lab results updated.${result.errors.length > 0 ? '\n\nErrors:\n' + result.errors.join('\n') : ''}`,
      );
    } catch (err: any) {
      Alert.alert('Sync Failed', err.message);
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = (providerId: string) =>
    connections.some((c) => c.providerId === providerId);

  const getConnection = (providerId: string) =>
    connections.find((c) => c.providerId === providerId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={palette.gray600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect Labs</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* Intro */}
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="shield-checkmark" size={28} color={palette.success} />
          </View>
          <Text style={styles.introTitle}>Secure Health Data Sync</Text>
          <Text style={styles.introDesc}>
            Connect your health portals to automatically import lab results.
            You log in directly with your provider — we never see your credentials.
          </Text>
        </View>

        {/* Connected Providers */}
        {connections.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Connected</Text>
              <TouchableOpacity
                style={styles.syncAllBtn}
                onPress={handleSyncAll}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <>
                    <Ionicons name="sync" size={16} color={palette.primary} />
                    <Text style={styles.syncAllText}>Sync All</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {connections.map((conn) => {
              const provider = PROVIDERS.find((p) => p.id === conn.providerId);
              if (!provider) return null;
              return (
                <View key={conn.providerId} style={styles.connectedCard}>
                  <View style={[styles.providerIcon, { backgroundColor: provider.color + '15' }]}>
                    <Ionicons name={provider.icon as any} size={24} color={provider.color} />
                  </View>
                  <View style={styles.connectedInfo}>
                    <Text style={styles.connectedName}>{provider.name}</Text>
                    <Text style={styles.connectedMeta}>
                      Connected {new Date(conn.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDisconnect(conn.providerId)}
                    style={styles.disconnectBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color={palette.critical} />
                  </TouchableOpacity>
                </View>
              );
            })}
            {lastSync && (
              <Text style={styles.lastSyncText}>
                Last synced: {new Date(lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </Text>
            )}
          </View>
        )}

        {/* Available Providers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {connections.length > 0 ? 'Add More Providers' : 'Available Providers'}
          </Text>
          {PROVIDERS.filter((p) => !isConnected(p.id)).map((provider) => (
            <TouchableOpacity
              key={provider.id}
              style={styles.providerCard}
              onPress={() => handleConnect(provider)}
              activeOpacity={0.7}
            >
              <View style={[styles.providerIcon, { backgroundColor: provider.color + '15' }]}>
                <Ionicons name={provider.icon as any} size={24} color={provider.color} />
              </View>
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerDesc} numberOfLines={2}>
                  {provider.description}
                </Text>
              </View>
              <View style={styles.connectBtnWrap}>
                {provider.clientId ? (
                  <View style={styles.connectBtn}>
                    <Text style={styles.connectBtnText}>Connect</Text>
                  </View>
                ) : (
                  <View style={[styles.connectBtn, { backgroundColor: palette.gray100 }]}>
                    <Text style={[styles.connectBtnText, { color: palette.gray400 }]}>Setup</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.howItWorksCard}>
            {[
              { icon: 'finger-print', text: 'Log in with your own portal credentials' },
              { icon: 'lock-closed', text: 'OAuth keeps your password private' },
              { icon: 'download', text: 'Lab results are imported via FHIR (open standard)' },
              { icon: 'phone-portrait', text: 'Data stays on your device + cloud sync' },
            ].map((step, i) => (
              <View key={i} style={styles.howStep}>
                <View style={styles.howStepNum}>
                  <Ionicons name={step.icon as any} size={18} color={palette.primary} />
                </View>
                <Text style={styles.howStepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* OAuth WebView Modal */}
      <Modal visible={!!webViewProvider} animationType="slide">
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity
              onPress={() => { setWebViewProvider(null); setWebViewUrl(''); }}
              style={styles.webViewClose}
            >
              <Ionicons name="close" size={24} color={palette.gray600} />
            </TouchableOpacity>
            <Text style={styles.webViewTitle}>
              Sign in to {webViewProvider?.name}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          {webViewUrl ? (
            <WebView
              source={{ uri: webViewUrl }}
              onNavigationStateChange={handleWebViewNavigationChange}
              style={{ flex: 1 }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color={palette.primary} />
                  <Text style={styles.webViewLoadingText}>Loading sign-in page...</Text>
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.gray50 },
  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
  },
  closeBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: palette.gray800 },

  introCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: palette.successLight,
  },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  introTitle: { fontSize: 18, fontWeight: '700', color: palette.gray800, marginBottom: 8 },
  introDesc: { fontSize: 14, color: palette.gray500, textAlign: 'center', lineHeight: 20 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: palette.gray700, marginBottom: 12 },
  syncAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncAllText: { fontSize: 14, fontWeight: '600', color: palette.primary },

  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.successLight,
  },
  connectedInfo: { flex: 1, marginLeft: 12 },
  connectedName: { fontSize: 15, fontWeight: '600', color: palette.gray800 },
  connectedMeta: { fontSize: 12, color: palette.gray400, marginTop: 2 },
  disconnectBtn: { padding: 8 },
  lastSyncText: { fontSize: 12, color: palette.gray400, textAlign: 'center', marginTop: 4 },

  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.gray100,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontSize: 15, fontWeight: '600', color: palette.gray800 },
  providerDesc: { fontSize: 12, color: palette.gray500, marginTop: 2, lineHeight: 16 },
  connectBtnWrap: { marginLeft: 8 },
  connectBtn: {
    backgroundColor: palette.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectBtnText: { fontSize: 13, fontWeight: '600', color: palette.primary },

  howItWorksCard: {
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 16,
  },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  howStepNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  howStepText: { flex: 1, fontSize: 14, color: palette.gray600, lineHeight: 20 },

  webViewContainer: { flex: 1, backgroundColor: palette.white },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray100,
    paddingTop: 50,
  },
  webViewClose: { width: 40 },
  webViewTitle: { fontSize: 16, fontWeight: '600', color: palette.gray800 },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.white,
  },
  webViewLoadingText: { fontSize: 14, color: palette.gray500, marginTop: 12 },
});
