import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '@/constants/Colors';
import { HealthProviderService, HealthProvider } from '@/services/healthProviderService';
import { searchHospitals, HospitalEndpoint } from '@/services/hospitalDirectory';
import { AppleHealthService } from '@/services/appleHealthService';

type Step = 'search' | 'auth' | 'exchanging';

interface ConnectLabsModalProps {
  visible: boolean;
  onClose: () => void;
  onConnected: (provider: HealthProvider) => void;
}

export default function ConnectLabsModal({ visible, onClose, onConnected }: ConnectLabsModalProps) {
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<HospitalEndpoint | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  // Search results
  const hospitals = useMemo(() => searchHospitals(searchQuery), [searchQuery]);

  const handleAppleHealthConnect = async () => {
    if (!AppleHealthService.isAvailable()) {
      Alert.alert(
        'Apple Health',
        'Apple Health is only available on iOS devices. Please use a physical iPhone to connect.',
      );
      return;
    }

    setStep('exchanging');
    try {
      const success = await AppleHealthService.initialize();
      if (success) {
        const provider: HealthProvider = {
          id: 'apple-health',
          name: 'Apple Health',
          logo: '❤️',
          description: 'Import labs from Apple Health',
          authUrl: '',
          tokenUrl: '',
          fhirBaseUrl: '',
          scopes: [],
          redirectUri: '',
        };
        onConnected(provider);
        resetAndClose();
      } else {
        Alert.alert('Permission Denied', 'Please allow access to Health data in Settings > Privacy > Health.');
        setStep('search');
      }
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
      setStep('search');
    }
  };

  const handleHospitalSelect = (hospital: HospitalEndpoint) => {
    setSelectedHospital(hospital);

    // Build a HealthProvider from the hospital endpoint
    const provider: HealthProvider = {
      id: hospital.id,
      name: hospital.name,
      logo: hospital.logo || '🏥',
      description: `Connect to ${hospital.name}`,
      authUrl: hospital.authUrl,
      tokenUrl: hospital.tokenUrl,
      fhirBaseUrl: hospital.fhirBaseUrl,
      scopes: ['openid', 'fhirUser', 'patient/Observation.read', 'patient/Patient.read'],
      redirectUri: 'https://localhost/auth/callback',
    };

    const clientId = process.env.EXPO_PUBLIC_EPIC_CLIENT_ID || '';
    const state = Math.random().toString(36).substring(7);
    const url = HealthProviderService.generateAuthUrl(provider, clientId, state);
    setAuthUrl(url);
    setStep('auth');
  };

  const handleWebViewNavigation = async (navState: any) => {
    const { url } = navState;
    if (url.startsWith('https://localhost/auth/callback') && selectedHospital) {
      try {
        const result = await HealthProviderService.handleAuthCallback(url);
        if (result) {
          setStep('exchanging');
          const clientId = process.env.EXPO_PUBLIC_EPIC_CLIENT_ID || '';

          // Build provider from selected hospital
          const provider: HealthProvider = {
            id: selectedHospital.id,
            name: selectedHospital.name,
            logo: selectedHospital.logo || '🏥',
            description: `Connect to ${selectedHospital.name}`,
            authUrl: selectedHospital.authUrl,
            tokenUrl: selectedHospital.tokenUrl,
            fhirBaseUrl: selectedHospital.fhirBaseUrl,
            scopes: ['openid', 'fhirUser', 'patient/Observation.read', 'patient/Patient.read'],
            redirectUri: 'https://localhost/auth/callback',
          };

          await HealthProviderService.exchangeCodeForToken(provider, result.code, clientId);

          onConnected(provider);
          resetAndClose();
        }
      } catch (error) {
        console.error('Auth error:', error);
        Alert.alert('Authorization Error', (error as Error).message);
        setStep('search');
        setAuthUrl(null);
      }
    }
  };

  const resetAndClose = () => {
    setStep('search');
    setSearchQuery('');
    setSelectedHospital(null);
    setAuthUrl(null);
    onClose();
  };

  const goBack = () => {
    if (step === 'auth') {
      setStep('search');
      setAuthUrl(null);
      setSelectedHospital(null);
    } else {
      resetAndClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={resetAndClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <Ionicons
              name={step === 'search' ? 'close' : 'arrow-back'}
              size={24}
              color={palette.gray700}
            />
          </TouchableOpacity>
          <Text style={styles.title}>
            {step === 'search' ? 'Find Your Hospital' :
             step === 'auth' ? selectedHospital?.name || 'Sign In' :
             'Connecting...'}
          </Text>
        </View>

        {/* Step: Hospital Search */}
        {step === 'search' && (
          <>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={palette.gray400} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search hospitals (e.g., UCLA, Seattle Children's)"
                placeholderTextColor={palette.gray400}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={18} color={palette.gray400} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.hospitalList} keyboardShouldPersistTaps="handled">
              {/* Apple Health — recommended option */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.appleHealthCard}
                  onPress={handleAppleHealthConnect}
                  activeOpacity={0.7}
                >
                  <View style={styles.appleHealthIcon}>
                    <Text style={{ fontSize: 24 }}>❤️</Text>
                  </View>
                  <View style={styles.hospitalInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.hospitalName}>Apple Health</Text>
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    </View>
                    <Text style={styles.hospitalLocation}>
                      Import labs from all your connected hospitals at once
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.primary} />
                </TouchableOpacity>
              )}

              {/* Divider */}
              {Platform.OS === 'ios' && (
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or connect directly</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}

              <Text style={styles.resultCount}>
                {hospitals.length} hospital{hospitals.length !== 1 ? 's' : ''} found
              </Text>
              {hospitals.map((hospital) => (
                <TouchableOpacity
                  key={hospital.id}
                  style={styles.hospitalCard}
                  onPress={() => handleHospitalSelect(hospital)}
                  activeOpacity={0.7}
                >
                  <View style={styles.hospitalIcon}>
                    <Text style={styles.hospitalEmoji}>{hospital.logo || '🏥'}</Text>
                  </View>
                  <View style={styles.hospitalInfo}>
                    <Text style={styles.hospitalName}>{hospital.name}</Text>
                    <Text style={styles.hospitalLocation}>{hospital.location}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.gray400} />
                </TouchableOpacity>
              ))}

              {hospitals.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={palette.gray300} />
                  <Text style={styles.emptyTitle}>No hospitals found</Text>
                  <Text style={styles.emptySubtext}>
                    Try searching by hospital name or city
                  </Text>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </>
        )}

        {/* Step: OAuth Login */}
        {step === 'auth' && authUrl && (
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

        {/* Step: Exchanging token */}
        {step === 'exchanging' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={styles.loadingText}>
              Connecting to {selectedHospital?.name}...
            </Text>
            <Text style={styles.loadingSubtext}>
              Fetching your lab results
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.white,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray200,
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.gray900,
    flex: 1,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: palette.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.gray200,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: palette.gray900,
    paddingVertical: 14,
  },
  clearButton: {
    padding: 4,
  },
  // Hospital list
  hospitalList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultCount: {
    fontSize: 13,
    color: palette.gray400,
    marginBottom: 12,
    fontWeight: '500',
  },
  hospitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: palette.gray50,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.gray100,
  },
  hospitalIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: palette.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hospitalEmoji: {
    fontSize: 20,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.gray900,
  },
  hospitalLocation: {
    fontSize: 13,
    color: palette.gray500,
    marginTop: 2,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.gray500,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: palette.gray400,
    marginTop: 6,
    textAlign: 'center',
  },
  // WebView
  webview: {
    flex: 1,
  },
  // Apple Health
  appleHealthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF0F3',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFB3C1',
  },
  appleHealthIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFE0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recommendedBadge: {
    backgroundColor: palette.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  recommendedText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '700',
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.gray200,
  },
  dividerText: {
    fontSize: 12,
    color: palette.gray400,
    paddingHorizontal: 12,
    fontWeight: '500',
  },
  // Loading
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
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: palette.gray500,
    marginTop: 8,
  },
});