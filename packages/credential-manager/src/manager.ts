import type { Credential } from '@agent-infra/shared';
import { generateId, now, SECURITY, maskSensitiveData } from '@agent-infra/shared';
import type { 
  ProviderConfig, 
  IntegrationTemplate, 
  CredentialHealth,
  TokenResponse 
} from './types';

// Pre-built integration templates for <10min setup
const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    provider: 'openai',
    config: {
      name: 'OpenAI',
      type: 'api_key',
      scopes: ['api'],
    },
    setupSteps: [
      {
        order: 1,
        title: 'Navigate to OpenAI Dashboard',
        description: 'Go to your OpenAI API keys page',
        action: 'navigate',
        url: 'https://platform.openai.com/api-keys',
      },
      {
        order: 2,
        title: 'Create New Key',
        description: 'Click "Create new secret key"',
        action: 'confirm',
      },
      {
        order: 3,
        title: 'Copy API Key',
        description: 'Copy the generated key (starts with sk-)',
        action: 'copy',
        fieldName: 'apiKey',
      },
    ],
    estimatedSetupTimeMin: 3,
  },
  {
    id: 'github',
    name: 'GitHub',
    provider: 'github',
    config: {
      name: 'GitHub',
      type: 'oauth2',
      authUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['repo', 'read:user'],
    },
    setupSteps: [
      {
        order: 1,
        title: 'Create OAuth App',
        description: 'Go to GitHub Developer Settings',
        action: 'navigate',
        url: 'https://github.com/settings/developers',
      },
      {
        order: 2,
        title: 'Configure OAuth',
        description: 'Set callback URL to your domain',
        action: 'paste',
        fieldName: 'callbackUrl',
      },
      {
        order: 3,
        title: 'Authorize',
        description: 'Click authorize to complete setup',
        action: 'confirm',
      },
    ],
    estimatedSetupTimeMin: 5,
  },
  {
    id: 'slack',
    name: 'Slack',
    provider: 'slack',
    config: {
      name: 'Slack',
      type: 'oauth2',
      authUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['chat:write', 'users:read'],
    },
    setupSteps: [
      {
        order: 1,
        title: 'Create Slack App',
        description: 'Go to Slack API dashboard',
        action: 'navigate',
        url: 'https://api.slack.com/apps',
      },
      {
        order: 2,
        title: 'Install to Workspace',
        description: 'Install the app to your workspace',
        action: 'confirm',
      },
      {
        order: 3,
        title: 'Copy Bot Token',
        description: 'Copy the Bot User OAuth Token',
        action: 'copy',
        fieldName: 'botToken',
      },
    ],
    estimatedSetupTimeMin: 7,
  },
];

export class CredentialManager {
  private credentials: Map<string, Credential> = new Map();
  private templates: Map<string, IntegrationTemplate> = new Map();

  constructor() {
    // Load templates
    for (const template of INTEGRATION_TEMPLATES) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Get available integration templates
   */
  getTemplates(): IntegrationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a specific template
   */
  getTemplate(id: string): IntegrationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Register a new integration template
   */
  registerTemplate(template: IntegrationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Create OAuth authorization URL
   */
  createOAuthUrl(
    templateId: string,
    redirectUri: string,
    state: string
  ): string | undefined {
    const template = this.templates.get(templateId);
    if (!template || template.config.type !== 'oauth2') {
      return undefined;
    }

    const params = new URLSearchParams({
      client_id: '${CLIENT_ID}', // To be filled by user
      redirect_uri: redirectUri,
      scope: template.config.scopes.join(' '),
      state,
      response_type: 'code',
    });

    if (template.config.additionalParams) {
      for (const [key, value] of Object.entries(template.config.additionalParams)) {
        params.set(key, value);
      }
    }

    return `${template.config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for tokens
   */
  async exchangeCode(
    templateId: string,
    code: string,
    redirectUri: string
  ): Promise<TokenResponse | undefined> {
    const template = this.templates.get(templateId);
    if (!template || !template.config.tokenUrl) {
      return undefined;
    }

    // In production, make actual HTTP request
    // Mock response for now
    return {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: template.config.scopes.join(' '),
    };
  }

  /**
   * Store a credential securely
   */
  storeCredential(
    provider: string,
    type: Credential['type'],
    data: string,
    scopes: string[]
  ): Credential {
    const credential: Credential = {
      id: generateId(),
      provider,
      type,
      scopes,
      encryptedData: this.encrypt(data),
      metadata: {
        name: `${provider} ${type}`,
        description: `Credential for ${provider}`,
        createdAt: now(),
        usageCount: 0,
        rotationRequired: false,
      },
    };

    this.credentials.set(credential.id, credential);
    return credential;
  }

  /**
   * Get a credential by ID
   */
  getCredential(id: string): Credential | undefined {
    const credential = this.credentials.get(id);
    if (credential) {
      // Update last used
      credential.metadata.lastUsedAt = now();
      credential.metadata.usageCount++;
    }
    return credential;
  }

  /**
   * Check credential health
   */
  checkHealth(credential: Credential): CredentialHealth {
    const issues: string[] = [];
    let status: CredentialHealth['status'] = 'healthy';

    // Check expiration
    if (credential.expiresAt) {
      const expiresIn = credential.expiresAt - now();
      if (expiresIn < 0) {
        status = 'expired';
        issues.push('Credential has expired');
      } else if (expiresIn < SECURITY.tokenRefreshBuffer) {
        status = 'expiring';
        issues.push('Credential expires soon');
      }
    }

    // Check age
    const age = now() - credential.metadata.createdAt;
    if (age > SECURITY.maxCredentialAge) {
      issues.push('Credential is older than 90 days, rotation recommended');
    }

    // Check usage
    if (credential.metadata.rotationRequired) {
      issues.push('Rotation flagged by security policy');
    }

    return {
      credential,
      status,
      expiresIn: credential.expiresAt ? credential.expiresAt - now() : undefined,
      lastUsed: credential.metadata.lastUsedAt,
      usageCount: credential.metadata.usageCount,
      recommendations: issues,
    };
  }

  /**
   * Refresh an OAuth token
   */
  async refreshToken(credential: Credential): Promise<Credential | undefined> {
    if (!credential.refreshToken) {
      return undefined;
    }

    // In production, make actual refresh request
    // Mock for now
    const newToken: TokenResponse = {
      access_token: 'new_mock_access_token',
      refresh_token: credential.refreshToken,
      expires_in: 3600,
      token_type: 'Bearer',
    };

    // Update credential
    credential.encryptedData = this.encrypt(newToken.access_token);
    credential.expiresAt = now() + (newToken.expires_in || 3600) * 1000;

    return credential;
  }

  /**
   * Revoke a credential
   */
  async revokeCredential(id: string): Promise<boolean> {
    const credential = this.credentials.get(id);
    if (!credential) {
      return false;
    }

    // In production, call provider's revoke endpoint
    this.credentials.delete(id);
    return true;
  }

  /**
   * List all credentials
   */
  listCredentials(): Credential[] {
    return Array.from(this.credentials.values()).map(c => ({
      ...c,
      encryptedData: maskSensitiveData(c.encryptedData),
    }));
  }

  /**
   * Mock encryption - in production use proper encryption
   */
  private encrypt(data: string): string {
    return `enc:${Buffer.from(data).toString('base64')}`;
  }

  /**
   * Mock decryption
   */
  decrypt(encryptedData: string): string {
    if (encryptedData.startsWith('enc:')) {
      return Buffer.from(encryptedData.slice(4), 'base64').toString();
    }
    return encryptedData;
  }
}
