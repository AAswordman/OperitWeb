import { MarketError } from './shared.js';

/** Validates declared artifact contracts while accepting publishers that omit the field. */
export function validateArtifactApiVersion(type: string, apiVersion: string | undefined, minAppVer: string, maxAppVer?: string): void {
  if ((type !== 'script' && type !== 'package') || apiVersion === undefined) return;
  const api = parseVersion(apiVersion, 'version.apiVersion', false);
  const minimum = parseVersion(minAppVer, 'version.minAppVer', true);
  if (api[0] >= 2 && minimum[0] < 2) {
    throw new MarketError('validation_failed', 'API 2.0.0 and newer require version.minAppVer >= 2.0.0', 400);
  }
  if (maxAppVer !== undefined) {
    const maximum = parseVersion(maxAppVer, 'version.maxAppVer', true);
    for (const index of [0, 1, 2, 3] as const) {
      const difference = minimum[index] - maximum[index];
      if (difference > 0) throw new MarketError('validation_failed', 'version.minAppVer must not exceed version.maxAppVer', 400);
      if (difference < 0) break;
    }
  }
}

/** Parses API triples and app versions with an optional numeric build suffix. */
function parseVersion(value: string, field: string, allowBuild: boolean): [number, number, number, number] {
  const match = (allowBuild ? /^(\d+)\.(\d+)\.(\d+)(?:\+(\d+))?$/ : /^(\d+)\.(\d+)\.(\d+)$/).exec(value);
  if (!match) throw new MarketError('validation_failed', `${field} must use major.minor.patch${allowBuild ? ' with an optional +build' : ''} format`, 400);
  const parts: [number, number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 0)];
  if (parts.some(part => !Number.isSafeInteger(part))) throw new MarketError('validation_failed', `${field} contains an invalid version component`, 400);
  return parts;
}
