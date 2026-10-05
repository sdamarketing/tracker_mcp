export type AuthMethod = 'oauth' | 'iam';

export interface TrackerConfig {
  apiToken: string;
  orgId: string;
  authMethod: AuthMethod;
  baseUrl: string;
  lang?: string;
}

export class ConfigError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(
      `Missing required environment variable ${name}. ` +
        `Set it in your MCP client config, or run "tracker-mcp setup" to configure everything interactively.`,
    );
  }
  return value;
}

export function loadConfig(): TrackerConfig {
  const apiToken = requireEnv('TRACKER_TOKEN');
  const orgId = requireEnv('TRACKER_ORG_ID');

  const authRaw = (process.env.TRACKER_AUTH ?? 'oauth').toLowerCase();
  if (authRaw !== 'oauth' && authRaw !== 'iam') {
    throw new ConfigError(
      `Invalid TRACKER_AUTH value: "${authRaw}". Use "oauth" (Yandex 360) or "iam" (Yandex Cloud).`,
    );
  }

  const baseUrl = (
    process.env.TRACKER_API_URL ?? 'https://api.tracker.yandex.net/v3'
  ).replace(/\/+$/, '');

  const lang = process.env.TRACKER_LANG;

  return {
    apiToken,
    orgId,
    authMethod: authRaw,
    baseUrl,
    lang,
  };
}
