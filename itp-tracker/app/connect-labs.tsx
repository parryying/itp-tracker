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