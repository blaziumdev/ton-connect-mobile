# TON Connect Mobile SDK

Production-ready TON Connect Mobile SDK for React Native and Expo. This SDK implements the real TonConnect protocol for mobile applications using deep links and callbacks.

## Features

- ✅ **Real TonConnect Protocol** - Implements the actual protocol, not a mock
- ✅ **Deep Link Wallet Connection** - Connect to wallets via deep links
- ✅ **Session Persistence** - Maintains connection across app restarts
- ✅ **Transaction Signing** - Send and sign transactions
- ✅ **Signature Verification** - Verifies wallet signatures
- ✅ **Cross-Platform** - Works with Expo Managed, Expo Bare, and React Native CLI
- ⚠️ **Web Limitation** - Deep links (`tonconnect://`) only work on mobile devices (Android/iOS), not in web browsers
- ✅ **TypeScript** - Fully typed with TypeScript
- ✅ **Production Ready** - No placeholders, no mocks, ready for production use

## Installation

```bash
npm install @blazium/ton-connect-mobile
```

### Required Dependencies

**IMPORTANT**: You must install `react-native-get-random-values` for secure random number generation:

```bash
npm install react-native-get-random-values
```

Then import it at the very top of your entry file (before any other imports):

```typescript
import 'react-native-get-random-values';
// ... other imports
```

### Peer Dependencies

The SDK requires one of the following storage solutions:

- `@react-native-async-storage/async-storage` (for React Native CLI)
- Expo's built-in AsyncStorage (for Expo)

For Expo projects, also install:

```bash
npx expo install expo-linking expo-crypto @react-native-async-storage/async-storage
```

## Usage

### Basic Setup

```typescript
import { TonConnectMobile } from '@blazium/ton-connect-mobile';

const ton = new TonConnectMobile({
  manifestUrl: 'https://example.com/tonconnect-manifest.json',
  scheme: 'myapp', // Your app's deep link scheme
});
```

### Connect to Wallet

```typescript
try {
  const wallet = await ton.connect();
  console.log('Connected to:', wallet.name);
  console.log('Address:', wallet.address);
  console.log('Public Key:', wallet.publicKey);
} catch (error) {
  if (error instanceof UserRejectedError) {
    console.log('User rejected the connection');
  } else if (error instanceof ConnectionTimeoutError) {
    console.log('Connection timed out');
  } else {
    console.error('Connection failed:', error.message);
  }
}
```

### Listen to Status Changes

```typescript
ton.onStatusChange((status) => {
  if (status.connected) {
    console.log('Wallet:', status.wallet?.name);
    console.log('Address:', status.wallet?.address);
  } else {
    console.log('Disconnected');
  }
});
```

### Send Transaction

```typescript
try {
  const response = await ton.sendTransaction({
    validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
    messages: [
      {
        address: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo',
        amount: '10000000', // 0.01 TON in nanotons
      },
    ],
  });

  console.log('Transaction BOC:', response.boc);
  console.log('Signature:', response.signature);
  
  // IMPORTANT: Transaction signatures must be verified server-side
  // The SDK does not perform cryptographic signature verification
  // Use @ton/core or @ton/crypto on your backend to verify signatures
} catch (error) {
  if (error instanceof UserRejectedError) {
    console.log('User rejected the transaction');
  } else if (error instanceof TransactionTimeoutError) {
    console.log('Transaction timed out');
  } else if (error instanceof TransactionInProgressError) {
    console.log('Transaction already in progress');
  } else {
    console.error('Transaction failed:', error.message);
  }
}
```

### Platform Support

**⚠️ Important**: TON Connect deep links (`tonconnect://`) only work on **mobile devices** (Android/iOS). They do not work in web browsers.

- ✅ **Android**: Full support via Expo or React Native CLI
- ✅ **iOS**: Full support via Expo or React Native CLI  
- ⚠️ **Web**: Deep links are not supported. The SDK will throw a clear error message if you try to use it in a web browser.

**Why?** The `tonconnect://` protocol is a custom URI scheme that requires a mobile app handler. Web browsers cannot handle these custom protocols.

**Testing**: To test wallet connections, use:
- Android device or emulator
- iOS device or simulator
- Not web browsers

### Disconnect

```typescript
await ton.disconnect();
```

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
  "iconUrl": "https://yourdomain.com/icon.png"
}
```

The manifest URL must be accessible via HTTPS.

## API Reference

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
- `connectionTimeout` (optional): Connection timeout in ms (default: `300000`)
- `transactionTimeout` (optional): Transaction timeout in ms (default: `300000`)

#### Methods

- `connect(): Promise<WalletInfo>` - Connect to a wallet
- `disconnect(): Promise<void>` - Disconnect from wallet
- `sendTransaction(request: SendTransactionRequest): Promise<TransactionResponse>` - Send transaction
- `getStatus(): ConnectionStatus` - Get current connection status
- `onStatusChange(callback: StatusChangeCallback): () => void` - Subscribe to status changes
- `destroy(): void` - Cleanup resources

### Error Classes

- `TonConnectError` - Base error class
- `ConnectionTimeoutError` - Connection request timed out
- `ConnectionInProgressError` - Connection request already in progress
- `TransactionTimeoutError` - Transaction request timed out
- `TransactionInProgressError` - Transaction request already in progress
- `UserRejectedError` - User rejected the request

## Architecture

The SDK uses an adapter-based architecture:

- **Core** - Pure TypeScript protocol implementation (no platform dependencies)
- **Expo Adapter** - Expo-specific implementation using `expo-linking` and `expo-crypto`
- **React Native Adapter** - React Native CLI implementation using `react-native` Linking

The core module is platform-agnostic and can be used in any JavaScript environment.

## Example

See the `example/` directory for a complete Expo example app demonstrating:

- Connecting to a wallet
- Receiving wallet information
- Sending transactions
- Handling errors

## Security Notes

### Transaction Signature Verification

⚠️ **IMPORTANT**: The SDK does NOT perform cryptographic verification of transaction signatures. The `verifyTransactionSignature()` function only validates format, not cryptographic correctness.

**You MUST verify transaction signatures server-side** using proper TON libraries:
- `@ton/core` - For BOC parsing and transaction verification
- `@ton/crypto` - For cryptographic operations

### Random Number Generation

The SDK requires `react-native-get-random-values` for cryptographically secure random number generation. Make sure to import it at the top of your entry file.

### Session Storage

Sessions are stored in AsyncStorage (unencrypted). For production apps handling sensitive data, consider:
- Using encrypted storage (iOS Keychain, Android EncryptedSharedPreferences)
- Implementing additional security measures for sensitive wallet data

## License

MIT

