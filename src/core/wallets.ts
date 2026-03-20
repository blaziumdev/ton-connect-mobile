/**
 * TON Connect compatible wallet definitions
 * Each wallet has its own universal link and bridge URL
 * Data sourced from official https://github.com/ton-connect/wallets-list
 */

export interface WalletDefinition {
  /** Wallet name for display */
  name: string;
  /** Wallet app name (identifier) */
  appName: string;
  /** Universal link base URL for this wallet */
  universalLink: string;
  /** HTTP Bridge URL for SSE communication */
  bridgeUrl: string;
  /** Deep link scheme (if supported) */
  deepLink?: string;
  /** Wallet icon URL (optional) */
  iconUrl?: string;
  /** Platform support */
  platforms: ('ios' | 'android' | 'web')[];
}

/**
 * List of supported TON Connect wallets
 * Bridge URLs from official wallets-v2.json
 */
export const SUPPORTED_WALLETS: WalletDefinition[] = [
  {
    name: 'Tonkeeper',
    appName: 'tonkeeper',
    universalLink: 'https://app.tonkeeper.com/ton-connect',
    bridgeUrl: 'https://bridge.tonapi.io/bridge',
    deepLink: 'tonkeeper-tc://',
    iconUrl: 'https://tonkeeper.com/assets/tonconnect-icon.png',
    platforms: ['ios', 'android', 'web'],
  },
  {
    name: 'MyTonWallet',
    appName: 'mytonwallet',
    universalLink: 'https://connect.mytonwallet.org',
    bridgeUrl: 'https://tonconnectbridge.mytonwallet.org/bridge/',
    deepLink: 'mytonwallet-tc://',
    iconUrl: 'https://static.mytonwallet.io/icon-256.png',
    platforms: ['ios', 'android', 'web'],
  },
  {
    name: 'Wallet in Telegram',
    appName: 'telegram-wallet',
    universalLink: 'https://t.me/wallet?attach=wallet',
    bridgeUrl: 'https://walletbot.me/tonconnect-bridge/bridge',
    deepLink: 'tg://',
    iconUrl: 'https://wallet.tg/images/logo-288.png',
    platforms: ['ios', 'android'],
  },
  {
    name: 'Tonhub',
    appName: 'tonhub',
    universalLink: 'https://tonhub.com/ton-connect',
    bridgeUrl: 'https://connect.tonhubapi.com/tonconnect',
    deepLink: 'tonhub://',
    iconUrl: 'https://tonhub.com/tonconnect_logo.png',
    platforms: ['ios', 'android'],
  },
];

/**
 * Get wallet definition by name
 */
export function getWalletByName(name: string): WalletDefinition | undefined {
  return SUPPORTED_WALLETS.find(
    (wallet) =>
      wallet.name.toLowerCase() === name.toLowerCase() ||
      wallet.appName.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get default wallet (Tonkeeper)
 */
export function getDefaultWallet(): WalletDefinition {
  return SUPPORTED_WALLETS[0]; // Tonkeeper
}

/**
 * Get all wallets for a specific platform
 */
export function getWalletsForPlatform(platform: 'ios' | 'android' | 'web'): WalletDefinition[] {
  return SUPPORTED_WALLETS.filter((wallet) => wallet.platforms.includes(platform));
}
