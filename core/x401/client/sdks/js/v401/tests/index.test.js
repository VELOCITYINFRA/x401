// index.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGeolocationData, detectWallets } from '../index.js';

describe('Helper Functions', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
  });

  it('detectWallets finds phantom', () => {
    global.window = { phantom: { solana: {} } };
    const wallets = detectWallets();
    expect(wallets).toContain('phantom');
  });

  it('detectWallets finds multiple wallets', () => {
    global.window = {
      phantom: { solana: {} },
      backpack: {},
      solflare: {}
    };
    
    const wallets = detectWallets();
    expect(wallets.length).toBe(3);
  });

  it('getGeolocationData handles success', async () => {
    // Use vi.stubGlobal instead
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({ coords: { latitude: 40, longitude: -74 } });
        })
      }
    });

    const result = await getGeolocationData();
    expect(result.latitude).toBe(40);
    expect(result.longitude).toBe(-74);
    
    vi.unstubAllGlobals();
  });

  it('getGeolocationData handles permission denied', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((success, error) => {
          error({ code: 1, message: 'denied' });
        })
      }
    });

    const result = await getGeolocationData();
    expect(result.error).toContain('Permission Denied');
    
    vi.unstubAllGlobals();
  });

  it('getGeolocationData handles unsupported browser', async () => {
    vi.stubGlobal('navigator', {});

    const result = await getGeolocationData();
    expect(result.error).toBe('Geolocation not supported by this browser.');
    
    vi.unstubAllGlobals();
  });
});