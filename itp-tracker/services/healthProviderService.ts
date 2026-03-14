import { Linking } from 'react-native';

export interface HealthProvider {
  id: string;
  name: string;
  logo: string;
  description: string;
  authUrl: string;
  scopes: string[];
  redirectUri: string;
}

export const HEALTH_PROVIDERS: HealthProvider[] = [
  {
    id: 'epic',
    name: 'Epic MyChart',
    logo: '🏥',
    description: 'Connect to Epic MyChart for lab results',
    authUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    scopes: ['patient/Observation.read', 'patient/Patient.read', 'launch/patient'],
    redirectUri: 'itptracker://auth/callback',
  },
  // Add more providers later
];

export class HealthProviderService {
  static generateAuthUrl(provider: HealthProvider, clientId: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scopes.join(' '),
      state,
      aud: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    });

    return `${provider.authUrl}?${params.toString()}`;
  }

  static async handleAuthCallback(url: string): Promise<{ code: string; state: string } | null> {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code || !state) {
      return null;
    }

    return { code, state };
  }

  static async exchangeCodeForToken(
    provider: HealthProvider,
    code: string,
    clientId: string,
    clientSecret: string
  ): Promise<any> {
    const response = await fetch('https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: provider.redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }
}