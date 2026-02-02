import type { Credential } from '@agent-infra/shared';

export interface ProviderConfig {
  name: string;
  type: 'oauth2' | 'api_key' | 'basic_auth' | 'bearer_token';
  authUrl?: string;
  tokenUrl?: string;
  scopes: string[];
  additionalParams?: Record<string, string>;
}

export interface IntegrationTemplate {
  id: string;
  name: string;
  provider: string;
  config: ProviderConfig;
  setupSteps: SetupStep[];
  estimatedSetupTimeMin: number;
}

export interface SetupStep {
  order: number;
  title: string;
  description: string;
  action: 'navigate' | 'copy' | 'paste' | 'confirm';
  url?: string;
  fieldName?: string;
}

export interface CredentialHealth {
  credential: Credential;
  status: 'healthy' | 'expiring' | 'expired' | 'revoked';
  expiresIn?: number;
  lastUsed?: number;
  usageCount: number;
  recommendations: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}
