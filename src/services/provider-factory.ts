import type { SpeedTestProvider, ProviderMode, TestProfile } from '../types/speedtest';
import { CloudflareProvider } from './cloudflare-provider';
import { NDT7Provider } from './ndt7-provider';
import { MSAKProvider } from './msak-provider';
import { LibreSpeedProvider } from './librespeed-provider';
import { FastcomProvider } from './fastcom-provider';
import { CacheFlyProvider } from './cachefly-provider';
import { VultrProvider } from './vultr-provider';
import { AggregatedProvider } from './aggregated-provider';

/**
 * Registry order — the canonical construction/draw order the v4 statistical
 * notes pin so the shared PCG32 block-bootstrap index streams are reproducible
 * (`applenq` is CLI-only and never constructed on web). METHODOLOGY.md §3.
 */
export const REGISTRY_ORDER = [
  'cloudflare',
  'ndt7',
  'msak',
  'librespeed',
  'fastcom',
  'cachefly',
  'vultr',
] as const;

export type RegistryProviderKey = (typeof REGISTRY_ORDER)[number];

interface RegistryEntry {
  key: RegistryProviderKey;
  make: () => SpeedTestProvider;
  /** M-Lab providers require the data-policy consent gate. */
  requiresConsent: boolean;
}

/** The full provider registry in canonical order (single source of truth). */
export const PROVIDER_REGISTRY: RegistryEntry[] = [
  { key: 'cloudflare', make: () => new CloudflareProvider(), requiresConsent: false },
  { key: 'ndt7', make: () => new NDT7Provider(), requiresConsent: true },
  { key: 'msak', make: () => new MSAKProvider(), requiresConsent: true },
  { key: 'librespeed', make: () => new LibreSpeedProvider(), requiresConsent: false },
  { key: 'fastcom', make: () => new FastcomProvider(), requiresConsent: false },
  { key: 'cachefly', make: () => new CacheFlyProvider(), requiresConsent: false },
  { key: 'vultr', make: () => new VultrProvider(), requiresConsent: false },
];

/** FAST-mode subset (METHODOLOGY.md §3). */
const FAST_KEYS: RegistryProviderKey[] = ['cloudflare', 'ndt7', 'msak'];

export interface ResolvedProvider {
  key: RegistryProviderKey;
  make: () => SpeedTestProvider;
}

/**
 * The ordered set of providers a given profile runs, after applying the consent
 * gate (M-Lab providers drop out when consent hasn't been given). Registry
 * order is preserved — this is what the orchestrator (and its shared bootstrap
 * stream) iterates.
 */
export function resolveProviderPlan(profile: TestProfile, consent: boolean): ResolvedProvider[] {
  const wanted = profile === 'fast'
    ? PROVIDER_REGISTRY.filter((e) => FAST_KEYS.includes(e.key))
    : PROVIDER_REGISTRY;
  return wanted
    .filter((e) => !e.requiresConsent || consent)
    .map((e) => ({ key: e.key, make: e.make }));
}

export interface CreateProviderOptions {
  /** v4 test mode for the aggregated (`'both'`) path. Default `'full'`. */
  profile?: TestProfile;
  /** M-Lab data-policy consent (gates NDT7 + MSAK). Default `false`. */
  consent?: boolean;
}

/**
 * Construct the provider for a settings `mode`. `'both'` builds the v4
 * N-provider {@link AggregatedProvider} configured by `profile`/`consent`;
 * every other mode builds that single provider in isolation (settings
 * back-compat + debugging). Back-compatible with the one-argument call site.
 */
export function createProvider(mode: ProviderMode, opts: CreateProviderOptions = {}): SpeedTestProvider {
  switch (mode) {
    case 'cloudflare':
      return new CloudflareProvider();
    case 'ndt7':
    case 'msak':
      // M-Lab data-collection gate enforced HERE, not just at the caller: a
      // consent-requiring provider is only constructed when consent was given.
      // Otherwise downgrade to Cloudflare so no direct caller of
      // createProvider('ndt7'|'msak') can run M-Lab without acceptance.
      if (opts.consent !== true) {
        console.warn(`[provider-factory] '${mode}' requires M-Lab data-policy consent; downgrading to Cloudflare.`);
        return new CloudflareProvider();
      }
      return mode === 'ndt7' ? new NDT7Provider() : new MSAKProvider();
    case 'librespeed':
      return new LibreSpeedProvider();
    case 'fastcom':
      return new FastcomProvider();
    case 'cachefly':
      return new CacheFlyProvider();
    case 'vultr':
      return new VultrProvider();
    case 'both':
    default:
      return new AggregatedProvider({
        profile: opts.profile ?? 'full',
        consent: opts.consent ?? false,
      });
  }
}
