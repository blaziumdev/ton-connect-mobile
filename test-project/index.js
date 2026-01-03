// Test project for @blazium/ton-connect-mobile
// IMPORTANT: Import react-native-get-random-values first
import 'react-native-get-random-values';

import { TonConnectMobile } from '@blazium/ton-connect-mobile';

// Initialize SDK
const ton = new TonConnectMobile({
  manifestUrl: 'https://example.com/tonconnect-manifest.json',
  scheme: 'testapp',
});

// Test connection
async function testConnection() {
  try {
    console.log('Testing connection...');
    const wallet = await ton.connect();
    console.log('Connected to:', wallet.name);
    console.log('Address:', wallet.address);
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
}

// Test status change
ton.onStatusChange((status) => {
  console.log('Status changed:', status.connected ? 'Connected' : 'Disconnected');
  if (status.wallet) {
    console.log('Wallet:', status.wallet.name);
  }
});

// Export for testing
export { ton, testConnection };

