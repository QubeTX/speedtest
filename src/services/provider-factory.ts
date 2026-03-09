import type { SpeedTestProvider, ProviderMode } from '../types/speedtest';
import { CloudflareProvider } from './cloudflare-provider';
import { NDT7Provider } from './ndt7-provider';
import { AggregatedProvider } from './aggregated-provider';

export function createProvider(mode: ProviderMode): SpeedTestProvider {
  switch (mode) {
    case 'cloudflare':
      return new CloudflareProvider();
    case 'ndt7':
      return new NDT7Provider();
    case 'both':
    default:
      return new AggregatedProvider();
  }
}
