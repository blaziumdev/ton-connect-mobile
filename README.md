# @blazium/ton-connect-mobile

Production-ready TON Connect Mobile SDK for React Native and Expo. Implements the real TonConnect protocol for mobile applications using deep links and callbacks.

**Full compatibility with `@tonconnect/ui-react` API** - Use the same hooks, components, and functions you're familiar with!

## Features

- ✅ **Full `@tonconnect/ui-react` Compatibility** - Drop-in replacement
- ✅ **React Native & Expo Support** - Works with both Expo and React Native CLI
- ✅ **Android & iOS Support** - Full deep linking support
- ✅ **Multiple Wallet Support** - Tonkeeper (including Web), Tonhub, MyTonWallet, Telegram Wallet
- ✅ **Beautiful Wallet Selection Modal** - Grid layout matching @tonconnect/ui-react design
- ✅ **Transaction Signing** - Send transactions with wallet approval
- ✅ **Data Signing** - Sign arbitrary data for authentication
- ✅ **Transaction Builder Utilities** - Helper functions for building transactions
- ✅ **Connection Retry Logic** - Automatic retry with exponential backoff
- ✅ **Enhanced Error Messages** - Clear error messages with recovery suggestions
- ✅ **Wallet Availability Checking** - Check if wallets are available
- ✅ **Session Persistence** - Maintains connection across app restarts
- ✅ **Network Switching** - Switch between mainnet and testnet dynamically
- ✅ **Event Emitters** - Listen to connect, disconnect, transaction, and error events
- ✅ **Wallet Balance Checking** - Get wallet balance via TON Center API
- ✅ **Transaction Status Tracking** - Track transaction status with polling
- ✅ **TypeScript** - Full type safety
- ✅ **Production Ready** - Battle-tested implementation

## Installation

```bash
npm install @blazium/ton-connect-mobile
```

### Peer Dependencies

```bash
# For Expo projects
npm install expo-linking expo-crypto @react-native-async-storage/async-storage

# For React Native CLI projects
npm install @react-native-async-storage/async-storage react-native-get-random-values
```

## Quick Start

### React Integration (Recommended - @tonconnect/ui-react Compatible)

```typescript
import { TonConnectUIProvider, useTonConnectUI, useTonWallet, TonConnectButton } from '@blazium/ton-connect-mobile/react';

function App() {
  return (
    <TonConnectUIProvider
      config={{
        manifestUrl: 'https://yourdomain.com/tonconnect-manifest.json',
        scheme: 'myapp',
      }}
    >
      <YourApp />
    </TonConnectUIProvider>
  );
}

function YourApp() {
  const tonConnectUI = useTonConnectUI();
  const wallet = useTonWallet();

  return (
    <View>
      <TonConnectButton />
      {wallet?.connected && (
        <Text>Connected: {wallet.account?.address}</Text>
      )}
    </View>
  );
}
```

### Direct SDK Usage

```typescript
import { TonConnectMobile } from '@blazium/ton-connect-mobile';

const ton = new TonConnectMobile({
  manifestUrl: 'https://yourdomain.com/tonconnect-manifest.json',
  scheme: 'myapp',
});

// Connect to wallet
const wallet = await ton.connect();

// Send transaction
const response = await ton.sendTransaction({
  validUntil: Date.now() + 5 * 60 * 1000,
  messages: [
    {
      address: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo',
      amount: '10000000', // 0.01 TON
    },
  ],
});

// Sign data
const signed = await ton.signData('Hello, TON!', '1.0');

// Disconnect
await ton.disconnect();
```

## React Integration API

### Components

#### `TonConnectUIProvider`

React context provider that wraps your app and provides TON Connect functionality.

```typescript
<TonConnectUIProvider config={config}>
  <YourApp />
</TonConnectUIProvider>
```

#### `TonConnectButton`

Pre-built button component for connecting/disconnecting wallets.

```typescript
<TonConnectButton
  text="Connect Wallet"
  connectedText="Disconnect"
  onPress={() => {
    // Custom handler (optional)
  }}
/>
```

### Hooks

#### `useTonConnectUI()`

Access the TonConnectUI instance with all methods and features.

```typescript
const tonConnectUI = useTonConnectUI();

<<<<<<< HEAD
// Connection methods:
await tonConnectUI.connectWallet();
await tonConnectUI.disconnect();
await tonConnectUI.restoreConnection(); // Restore from stored session

// Transaction methods:
await tonConnectUI.sendTransaction({ ... });
await tonConnectUI.signData({ data: '...', version: '1.0' });

// Modal methods:
await tonConnectUI.openModal();
tonConnectUI.closeModal();

// Wallet customization:
tonConnectUI.setWalletList([...]); // Customize available wallets

// Network management:
const network = tonConnectUI.getNetwork(); // Get current network
tonConnectUI.setNetwork('testnet'); // Switch to testnet

// Balance checking:
const balance = await tonConnectUI.getBalance(); // Get connected wallet balance
const balance2 = await tonConnectUI.getBalance(address); // Get specific address balance

// Transaction status:
const status = await tonConnectUI.getTransactionStatusByHash(txHash, address);

// Event listeners:
const unsubscribe = tonConnectUI.on('connect', (wallet) => {
  console.log('Connected:', wallet);
});
tonConnectUI.on('disconnect', () => console.log('Disconnected'));
tonConnectUI.on('transaction', (tx) => console.log('Transaction:', tx));
tonConnectUI.on('error', (error) => console.error('Error:', error));

// State access:
tonConnectUI.wallet; // Current wallet state
tonConnectUI.modalState.open; // Modal open state
tonConnectUI.uiVersion; // UI kit version
```

#### `useTonWallet()`

Get current wallet state.

```typescript
const wallet = useTonWallet();

// wallet?.connected - boolean
// wallet?.account?.address - string
// wallet?.account?.publicKey - string
// wallet?.account?.chain - number
// wallet?.wallet?.name - string
```

#### `useTonConnectModal()`

Access modal state and controls.

```typescript
const modal = useTonConnectModal();

// modal.open - boolean
// modal.openModal() - Promise<void>
// modal.close() - void
```

#### `useTonConnectSDK()`

Access the underlying SDK instance for advanced usage.

```typescript
const sdk = useTonConnectSDK();

// Advanced methods:
sdk.setPreferredWallet('Tonhub');
sdk.getSupportedWallets();
```

## Direct SDK API

### `TonConnectMobile`

Main SDK class.

#### Constructor

```typescript
new TonConnectMobile(config: TonConnectMobileConfig)
```

**Config Options:**

- `manifestUrl` (required): URL to your TonConnect manifest file
- `scheme` (required): Your app's deep link scheme
- `storageKeyPrefix` (optional): Prefix for storage keys (default: `'tonconnect_'`)
<<<<<<< HEAD
- `connectionTimeout` (optional): Connection timeout in ms (default: `300000` = 5 minutes)
- `transactionTimeout` (optional): Transaction timeout in ms (default: `300000` = 5 minutes)
- `skipCanOpenURLCheck` (optional): Skip canOpenURL check (default: `true` for Android compatibility)
- `preferredWallet` (optional): Default wallet name
- `network` (optional): Network to use - `'mainnet'` or `'testnet'` (default: `'mainnet'`)
- `tonApiEndpoint` (optional): Custom TON API endpoint (default: auto-selected based on network)

#### Methods

##### `connect(): Promise<WalletInfo>`

Connect to a wallet.

```typescript
const wallet = await ton.connect();
```

##### `sendTransaction(request: SendTransactionRequest): Promise<{ boc: string; signature: string }>`

Send a transaction.

```typescript
const response = await ton.sendTransaction({
  validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
  messages: [
    {
      address: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo',
      amount: '10000000', // 0.01 TON in nanotons
    },
  ],
});
```

##### `signData(data: string | Uint8Array, version?: string): Promise<{ signature: string; timestamp: number }>`

Sign arbitrary data.

```typescript
const signed = await ton.signData('Hello, TON!', '1.0');
```

##### `disconnect(): Promise<void>`

Disconnect from wallet.
```typescript
await ton.disconnect();
```

##### `getStatus(): ConnectionStatus`

Get current connection status.

```typescript
const status = ton.getStatus();
// { connected: boolean, wallet: WalletInfo | null }
```

##### `getSupportedWallets(): WalletDefinition[]`

Get list of supported wallets.

```typescript
const wallets = ton.getSupportedWallets();
```

##### `setPreferredWallet(name: string): void`

Set preferred wallet.

```typescript
ton.setPreferredWallet('Tonhub');
```

##### `onStatusChange(callback: (status: ConnectionStatus) => void): () => void`

Subscribe to connection status changes.

```typescript
const unsubscribe = ton.onStatusChange((status) => {
  console.log('Status changed:', status);
});
```

<<<<<<< HEAD
##### `getNetwork(): Network`

Get current network (mainnet or testnet).

```typescript
const network = ton.getNetwork(); // 'mainnet' or 'testnet'
```

##### `setNetwork(network: Network): void`

Switch between mainnet and testnet.

```typescript
ton.setNetwork('testnet'); // Switch to testnet
// Note: Warning is logged if switching while wallet is connected
```

##### `getBalance(address?: string): Promise<BalanceResponse>`

Get wallet balance from TON Center API.

```typescript
// Get balance of connected wallet
const balance = await ton.getBalance();

// Get balance of specific address
const balance = await ton.getBalance('EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo');

// Response:
// {
//   balance: "1000000000", // in nanotons
//   balanceTon: "1.0", // formatted TON
//   network: "mainnet"
// }
```

##### `getTransactionStatusByHash(txHash: string, address: string): Promise<TransactionStatusResponse>`

Get transaction status by hash (recommended method).

```typescript
const status = await ton.getTransactionStatusByHash(txHash, address);

// Response:
// {
//   status: "confirmed" | "pending" | "failed" | "unknown",
//   hash?: string,
//   blockNumber?: number,
//   error?: string
// }
```

##### `getTransactionStatus(boc: string, maxAttempts?: number, intervalMs?: number): Promise<TransactionStatusResponse>`

Get transaction status from BOC (requires BOC parsing library).

```typescript
// Note: This method requires BOC parsing. Use getTransactionStatusByHash() instead.
const status = await ton.getTransactionStatus(boc, 10, 2000);
```

##### `on<T>(event: TonConnectEventType, listener: TonConnectEventListener<T>): () => void`

Add event listener.

```typescript
// Listen to connection events
const unsubscribe = ton.on('connect', (wallet) => {
  console.log('Connected to:', wallet.name);
});

// Listen to transaction events
ton.on('transaction', (tx) => {
  console.log('Transaction sent:', tx.boc);
});

// Listen to errors
ton.on('error', (error) => {
  console.error('SDK error:', error);
});

// Cleanup
unsubscribe();
```

##### `off<T>(event: TonConnectEventType, listener: TonConnectEventListener<T>): void`

Remove event listener.

```typescript
ton.off('connect', listener);
```

##### `removeAllListeners(event?: TonConnectEventType): void`

Remove all listeners for an event, or all events.

```typescript
ton.removeAllListeners('connect'); // Remove all connect listeners
ton.removeAllListeners(); // Remove all listeners
```

## Platform Support

- ✅ **Android**: Full support via Expo or React Native CLI
- ✅ **iOS**: Full support via Expo or React Native CLI  
- ✅ **Web**: Universal links supported (opens wallet in new tab/window)

**Web Platform Notes:**
- On web, wallets with universal links (like Tonkeeper Web, MyTonWallet) can be opened in a new browser tab
- The SDK automatically detects web platform and shows all available wallets
- Wallet availability is checked based on universal link support
- Deep links (`tonconnect://`) are not supported in web browsers, but universal links work perfectly

**Testing**: 
- Android device or emulator
- iOS device or simulator
- Web browsers (for wallets with web support like Tonkeeper Web)

## Platform Support

- ✅ **Android**: Full support via Expo or React Native CLI
- ✅ **iOS**: Full support via Expo or React Native CLI  
- ⚠️ **Web**: Deep links are not supported. The SDK will throw a clear error message if you try to use it in a web browser.

**Why?** The `tonconnect://` protocol is a custom URI scheme that requires a mobile app handler. Web browsers cannot handle these custom protocols.

**Testing**: To test wallet connections, use:
- Android device or emulator
- iOS device or simulator
- Not web browsers
>>>>>>> af0bd46f78c13fb8e9799027e48d4fa228a49e3c

## Configuration

### Expo Setup

In your `app.json` or `app.config.js`, configure the deep link scheme:

```json
{
  "expo": {
    "scheme": "myapp"
  }
}
```

### React Native CLI Setup

For iOS, add to `ios/YourApp/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>myapp</string>
    </array>
  </dict>
</array>
```

For Android, add to `android/app/src/main/AndroidManifest.xml`:

```xml
<activity>
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" />
  </intent-filter>
</activity>
```

## Manifest File

Create a `tonconnect-manifest.json` file on your server with the following structure:

```json
{
  "url": "https://yourdomain.com",
  "name": "Your App Name",
  "iconUrl": "https://yourdomain.com/icon.png",
  "termsOfUseUrl": "https://yourdomain.com/terms",
  "privacyPolicyUrl": "https://yourdomain.com/privacy"
}
```

The manifest URL must be accessible via HTTPS.

**Important Notes:**
- The `url` field should match your app's domain
- The `iconUrl` must be a valid, accessible URL
- The manifest file must be served with proper CORS headers
- For local development, you can use a production manifest for testing

## Supported Wallets

<<<<<<< HEAD
- **Tonkeeper** - Full support (iOS, Android, Web)
- **MyTonWallet** - Full support (iOS, Android, Web)
- **Tonhub** - Full support (iOS, Android)
- **Wallet in Telegram** - Full support (iOS, Android)

**Note**: Wallet icons are automatically loaded from official sources. If an icon fails to load, a placeholder with the wallet's initial is shown.
## Migration from @tonconnect/ui-react

This SDK is a drop-in replacement for `@tonconnect/ui-react` in React Native/Expo environments.

### Before (Web only)

```typescript
import { TonConnectUIProvider, useTonConnectUI } from '@tonconnect/ui-react';
```

### After (React Native/Expo)

```typescript
import { TonConnectUIProvider, useTonConnectUI } from '@blazium/ton-connect-mobile/react';
```

**That's it!** The API is identical, so your existing code will work without changes.

## Error Handling

The SDK provides specific error types:

```typescript
import {
  TonConnectError,
  ConnectionTimeoutError,
  TransactionTimeoutError,
  UserRejectedError,
  ConnectionInProgressError,
  TransactionInProgressError,
} from '@blazium/ton-connect-mobile';

try {
  await ton.connect();
} catch (error) {
  if (error instanceof UserRejectedError) {
    // User rejected the connection
  } else if (error instanceof ConnectionTimeoutError) {
    // Connection timed out
  }
}
```

## Examples

See the `test-project` directory for a complete example application demonstrating:
- React integration with `@tonconnect/ui-react` compatibility
- Direct SDK usage
- Transaction sending
- Data signing
- Wallet selection
- Error handling

## TypeScript

Full TypeScript support with comprehensive type definitions.

```typescript
import type {
  TonConnectMobileConfig,
  WalletInfo,
  ConnectionStatus,
  SendTransactionRequest,
  TransactionResponse,
} from '@blazium/ton-connect-mobile';
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [https://github.com/blaziumdev/ton-connect-mobile/issues](https://github.com/blaziumdev/ton-connect-mobile/issues)

<<<<<<< HEAD
## New Features in v1.2.3

### 🌐 Network Switching
Switch between mainnet and testnet dynamically:

```typescript
// Initialize with network
const ton = new TonConnectMobile({
  network: 'testnet', // or 'mainnet' (default)
  // ... other config
});

// Or switch at runtime
ton.setNetwork('testnet');
tonConnectUI.setNetwork('testnet');

// Get current network
const network = ton.getNetwork(); // 'mainnet' or 'testnet'
```

**Features:**
- Chain ID automatically updates (-239 for mainnet, -3 for testnet)
- TON API endpoint automatically switches based on network
- Warning logged if switching network while wallet is connected
- React components automatically update chain ID

### 📡 Event Emitters
Listen to SDK events for reactive programming:

```typescript
// Add event listeners
tonConnectUI.on('connect', (wallet) => {
  console.log('Connected to:', wallet.name);
});

tonConnectUI.on('disconnect', () => {
  console.log('Disconnected');
});

tonConnectUI.on('transaction', (tx) => {
  console.log('Transaction sent:', tx.boc);
});

tonConnectUI.on('error', (error) => {
  console.error('SDK error:', error);
});

// Remove listener
const unsubscribe = tonConnectUI.on('connect', listener);
unsubscribe(); // or
tonConnectUI.off('connect', listener);
```

**Available Events:**
- `connect` - Fired when wallet connects
- `disconnect` - Fired when wallet disconnects
- `transaction` - Fired when transaction is sent
- `error` - Fired when an error occurs
- `statusChange` - Fired when connection status changes

### 💰 Wallet Balance Checking
Get wallet balance from TON Center API:

```typescript
// Get balance of connected wallet
const balance = await tonConnectUI.getBalance();

// Get balance of specific address
const balance = await tonConnectUI.getBalance('EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo');

// Response:
// {
//   balance: "1000000000", // in nanotons
//   balanceTon: "1.0", // formatted TON
//   network: "mainnet"
// }
```

**Features:**
- Automatically uses correct API endpoint based on network
- Returns balance in both nanotons and formatted TON
- Validates address format before API call
- Handles API errors gracefully

### 📊 Transaction Status Tracking
Track transaction status after sending:

```typescript
// Using transaction hash (recommended)
const status = await tonConnectUI.getTransactionStatusByHash(txHash, address);

// Response:
// {
//   status: "confirmed" | "pending" | "failed" | "unknown",
//   hash: "transaction_hash",
//   blockNumber: 12345,
//   error?: "error message"
// }

// Using BOC (requires BOC parsing library)
const status = await tonConnectUI.getTransactionStatus(boc, maxAttempts, intervalMs);
```

**Features:**
- Polling mechanism with configurable attempts and intervals
- Network-specific API endpoint selection
- Returns detailed status information
- Handles API errors gracefully

### 🎯 Complete TonConnectUI API
All features from `@tonconnect/ui-react` are now available:

```typescript
const tonConnectUI = useTonConnectUI();

// Restore connection from stored session
await tonConnectUI.restoreConnection();

// Customize available wallets
tonConnectUI.setWalletList([
  { name: 'Tonkeeper', universalLink: '...', platforms: ['ios', 'android', 'web'] },
  { name: 'MyTonWallet', universalLink: '...', platforms: ['ios', 'android', 'web'] },
]);
```

### 🎨 Wallet Selection Modal
Beautiful, built-in wallet selection modal with grid layout matching @tonconnect/ui-react design. Automatically appears when you call `openModal()`:

```typescript
import { WalletSelectionModal } from '@blazium/ton-connect-mobile/react';

// The modal is automatically shown by TonConnectUIProvider when openModal() is called
// Or use it manually:
<WalletSelectionModal
  visible={showModal}
  onClose={() => setShowModal(false)}
/>
```

**Features:**
- Grid layout (4 columns) matching @tonconnect/ui-react design
- Real wallet icons loaded from official sources
- Availability status for each wallet
- Automatic wallet filtering by platform
- Smooth animations and loading states
- Custom wallet list support via `setWalletList()`

### 🛠️ Transaction Builder Utilities
Helper functions for building transactions easily:

```typescript
import {
  buildTransferTransaction,
  buildMultiTransferTransaction,
  tonToNano,
  nanoToTon,
  formatTonAddress,
  isValidTonAddress,
} from '@blazium/ton-connect-mobile';

// Simple transfer
const tx = buildTransferTransaction(
  'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo',
  0.1 // 0.1 TON
);

// Multiple transfers
const multiTx = buildMultiTransferTransaction([
  { to: 'EQ...', amount: 0.1 },
  { to: 'EQ...', amount: 0.2 },
]);

// Convert TON to nanotons
const nanotons = tonToNano(1.5); // "1500000000"

// Format address for display
const formatted = formatTonAddress('EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo');
// "EQD0vd...qIo"
```

### 🔄 Retry Utilities
Automatic retry logic with exponential backoff:

```typescript
import { retry } from '@blazium/ton-connect-mobile';

try {
  await retry(
    () => ton.connect(),
    {
      maxAttempts: 3,
      initialDelay: 1000,
      multiplier: 2,
      shouldRetry: (error) => error.name !== 'UserRejectedError',
    }
  );
} catch (error) {
  // Handle error
}
```

### 📱 Wallet Availability Checking
Check if a wallet is available on the current platform:

```typescript
const isAvailable = await ton.isWalletAvailable('Tonkeeper');
if (isAvailable) {
  await ton.connect();
}
```

**Platform Detection:**
- On web: Checks if wallet has universal link support (can open in new tab)
- On mobile: Checks if wallet supports the current platform (iOS/Android)
- Uses adapter type for reliable platform detection
- All wallets with universal links are considered available on web

### 💬 Enhanced Error Messages
All errors now include helpful recovery suggestions:

```typescript
try {
  await ton.connect();
} catch (error) {
  if (error instanceof ConnectionTimeoutError) {
    console.error(error.message);
    console.log('Suggestion:', error.recoverySuggestion);
  }
}
```

## Changelog

### v1.2.3
- ✅ **NEW**: Network switching - Switch between mainnet and testnet dynamically
- ✅ **NEW**: Event emitters - Listen to connect, disconnect, transaction, and error events
- ✅ **NEW**: Wallet balance checking - Get wallet balance via TON Center API integration
- ✅ **NEW**: Transaction status tracking - Track transaction status with polling mechanism
- ✅ **NEW**: Complete TonConnectUI API implementation - all features from @tonconnect/ui-react
- ✅ **NEW**: `restoreConnection()` method - restore connection from stored session
- ✅ **NEW**: `setWalletList()` method - customize available wallets in modal
- ✅ **NEW**: Wallet selection modal with grid layout matching @tonconnect/ui-react design
- ✅ **NEW**: Real wallet icons loaded from official sources
- ✅ **NEW**: Improved web platform support (Tonkeeper Web, MyTonWallet Web)
- ✅ **IMPROVED**: Wallet availability detection using adapter type (more reliable)
- ✅ **IMPROVED**: All wallets shown on web platform (with availability status)
- ✅ **IMPROVED**: Chain ID automatically updates when network changes
- ✅ **FIXED**: Tonkeeper now correctly shows as available on web
- ✅ **FIXED**: All Turkish comments translated to English

### v1.2.0
- ✅ **NEW**: Beautiful wallet selection modal component
- ✅ **NEW**: Transaction builder utilities (`buildTransferTransaction`, `tonToNano`, etc.)
- ✅ **NEW**: Retry utilities with exponential backoff
- ✅ **NEW**: Enhanced error messages with recovery suggestions
- ✅ **NEW**: Wallet availability checking (`isWalletAvailable`)
- ✅ Improved wallet callback handling
- ✅ Enhanced logging and debugging
- ✅ Better TypeScript types

## Changelog

### v1.2.3
- ✅ **NEW**: Network switching - Switch between mainnet and testnet dynamically
- ✅ **NEW**: Event emitters - Listen to connect, disconnect, transaction, and error events
- ✅ **NEW**: Wallet balance checking - Get wallet balance via TON Center API integration
- ✅ **NEW**: Transaction status tracking - Track transaction status with polling mechanism
- ✅ **NEW**: Complete TonConnectUI API implementation - all features from @tonconnect/ui-react
- ✅ **NEW**: `restoreConnection()` method - restore connection from stored session
- ✅ **NEW**: `setWalletList()` method - customize available wallets in modal
- ✅ **NEW**: Wallet selection modal with grid layout matching @tonconnect/ui-react design
- ✅ **NEW**: Real wallet icons loaded from official sources
- ✅ **NEW**: Improved web platform support (Tonkeeper Web, MyTonWallet Web)
- ✅ **IMPROVED**: Wallet availability detection using adapter type (more reliable)
- ✅ **IMPROVED**: All wallets shown on web platform (with availability status)
- ✅ **IMPROVED**: Chain ID automatically updates when network changes
- ✅ **FIXED**: Tonkeeper now correctly shows as available on web
- ✅ **FIXED**: All Turkish comments translated to English

### v1.2.0
- ✅ **NEW**: Beautiful wallet selection modal component
- ✅ **NEW**: Transaction builder utilities (`buildTransferTransaction`, `tonToNano`, etc.)
- ✅ **NEW**: Retry utilities with exponential backoff
- ✅ **NEW**: Enhanced error messages with recovery suggestions
- ✅ **NEW**: Wallet availability checking (`isWalletAvailable`)
- ✅ Improved wallet callback handling
- ✅ Enhanced logging and debugging
- ✅ Better TypeScript types

### v1.1.5
- ✅ Full `@tonconnect/ui-react` compatibility
- ✅ React integration layer with hooks and components
- ✅ Improved wallet callback handling
- ✅ Enhanced logging and debugging
- ✅ Better error messages
- ✅ Android emulator localhost fix (10.0.2.2)
- ✅ `post_redirect` return strategy for better compatibility
