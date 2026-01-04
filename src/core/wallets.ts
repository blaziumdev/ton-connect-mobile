/**
 * TON Connect compatible wallet definitions
 * Each wallet has its own universal link format
 */

export interface WalletDefinition {
  /** Wallet name for display */
  name: string;
  /** Wallet app name */
  appName: string;
  /** Universal link base URL for this wallet */
  universalLink: string;
  /** Deep link scheme (if supported) */
  deepLink?: string;
  /** Wallet icon URL (optional) */
  iconUrl?: string;
  /** Platform support */
  platforms: ('ios' | 'android' | 'web')[];
  /** Preferred return strategy for this wallet */
  preferredReturnStrategy?: 'back' | 'post_redirect' | 'none';
  /** Whether this wallet requires returnScheme in payload */
  requiresReturnScheme?: boolean;
}

/**
 * List of supported TON Connect wallets
 */
export const SUPPORTED_WALLETS: WalletDefinition[] = [
  {
    name: 'Tonkeeper',
    appName: 'Tonkeeper',
    universalLink: 'https://app.tonkeeper.com/ton-connect',
    deepLink: 'tonkeeper://',
    iconUrl: 'https://tonkeeper.com/assets/tonconnect-icon.png',
    platforms: ['ios', 'android', 'web'], // CRITICAL FIX: Tonkeeper Web is supported
    preferredReturnStrategy: 'post_redirect', // CRITICAL FIX: 'back' strategy may not send callback properly, use 'post_redirect'
    requiresReturnScheme: true, // CRITICAL FIX: Mobile apps need returnScheme for proper callback handling
  },
  {
    name: 'MyTonWallet',
    appName: 'MyTonWallet',
    universalLink: 'https://connect.mytonwallet.org',
    deepLink: 'mytonwallet://',
    iconUrl: 'https://static.mytonwallet.io/icon-256.png',
    platforms: ['ios', 'android', 'web'],
    preferredReturnStrategy: 'post_redirect',
    requiresReturnScheme: true, // MyTonWallet requires explicit returnScheme
  },
  {
    name: 'Wallet in Telegram',
    appName: 'Wallet',
    universalLink: 'https://wallet.tg/ton-connect',
    deepLink: 'tg://',
    iconUrl: 'https://wallet.tg/images/logo-288.png',
    platforms: ['ios', 'android'],
    preferredReturnStrategy: 'post_redirect',
    requiresReturnScheme: true, // Telegram Wallet requires explicit returnScheme
  },
  {
    name: 'Tonhub',
    appName: 'Tonhub',
    universalLink: 'https://tonhub.com/ton-connect',
    deepLink: 'tonhub://',
    iconUrl: 'https://tonhub.com/tonconnect_logo.png',
    platforms: ['ios', 'android'],
    preferredReturnStrategy: 'post_redirect',
    requiresReturnScheme: true, // Tonhub requires explicit returnScheme for proper callback
  },
];

/**
 * Get wallet definition by name
 */
export function getWalletByName(name: string): WalletDefinition | undefined {
  return SUPPORTED_WALLETS.find(
    (wallet) => wallet.name.toLowerCase() === name.toLowerCase() || wallet.appName.toLowerCase() === name.toLowerCase()
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

