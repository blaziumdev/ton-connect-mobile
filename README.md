# @blazium/ton-connect-mobile

Production-ready TON Connect Mobile SDK for React Native and Expo. Implements the real TonConnect protocol for mobile applications using deep links and callbacks.

**Full compatibility with `@tonconnect/ui-react` API** - Use the same hooks, components, and functions you're familiar with!

## Features

- ✅ **Full `@tonconnect/ui-react` Compatibility** - Drop-in replacement
- ✅ **React Native & Expo Support** - Works with both Expo and React Native CLI
- ✅ **Android & iOS Support** - Full deep linking support
- ✅ **Multiple Wallet Support** - Tonkeeper, Tonhub, MyTonWallet, Telegram Wallet
- ✅ **Transaction Signing** - Send transactions with wallet approval
- ✅ **Data Signing** - Sign arbitrary data for authentication
- ✅ **Session Persistence** - Maintains connection across app restarts
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

Access the TonConnectUI instance with all methods.

```typescript
const tonConnectUI = useTonConnectUI();

// Methods:
await tonConnectUI.connectWallet();
await tonConnectUI.disconnect();
await tonConnectUI.sendTransaction({ ... });
await tonConnectUI.signData({ data: '...', version: '1.0' });
await tonConnectUI.openModal();
tonConnectUI.closeModal();
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
- `connectionTimeout` (optional): Connection timeout in ms (default: `30000`)
- `transactionTimeout` (optional): Transaction timeout in ms (default: `300000`)
- `skipCanOpenURLCheck` (optional): Skip canOpenURL check (default: `true` for Android compatibility)
- `preferredWallet` (optional): Default wallet name

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

## Platform Support

**⚠️ Important**: TON Connect deep links (`tonconnect://`) only work on **mobile devices** (Android/iOS). They do not work in web browsers.

- ✅ **Android**: Full support via Expo or React Native CLI
- ✅ **iOS**: Full support via Expo or React Native CLI  
- ⚠️ **Web**: Deep links are not supported. The SDK will throw a clear error message if you try to use it in a web browser.

**Why?** The `tonconnect://` protocol is a custom URI scheme that requires a mobile app handler. Web browsers cannot handle these custom protocols.

**Testing**: To test wallet connections, use:
- Android device or emulator
- iOS device or simulator
- Not web browsers

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

- **Tonkeeper** - Full support
- **Tonhub** - Full support
- **MyTonWallet** - Full support
- **Wallet in Telegram** - Full support

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

## Changelog

### v1.1.5
- ✅ Full `@tonconnect/ui-react` compatibility
- ✅ React integration layer with hooks and components
- ✅ Improved wallet callback handling
- ✅ Enhanced logging and debugging
- ✅ Better error messages
- ✅ Android emulator localhost fix (10.0.2.2)
- ✅ `post_redirect` return strategy for better compatibility
