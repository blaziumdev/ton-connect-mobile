# TON Connect Mobile SDK - Test Project

This is a test project for `@blazium/ton-connect-mobile` SDK demonstrating both direct SDK usage and the new React integration layer.

## Features

- ✅ Direct SDK usage examples
- ✅ React integration (`@tonconnect/ui-react` compatible)
- ✅ Wallet selection modal
- ✅ Transaction sending
- ✅ Data signing
- ✅ Connection/disconnection
- ✅ Full TypeScript support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Make sure the manifest URL is accessible:
   - Update `App.tsx` with your manifest URL
   - Or use the provided test URL: `https://moonpaw-game.vercel.app/tonconnect-manifest.json`

3. Run the app:
```bash
npm start
```

Then press:
- `a` for Android
- `i` for iOS
- `w` for Web (limited support - deep links don't work in browsers)

## React Integration

This project demonstrates the new React integration that provides full compatibility with `@tonconnect/ui-react`:

```tsx
import {
  TonConnectUIProvider,
  useTonConnectUI,
  useTonWallet,
  TonConnectButton,
} from '@blazium/ton-connect-mobile/react';
```

See `README-REACT-INTEGRATION.md` for detailed documentation.

## Development Notes

- In development, the project imports from `../src/react` (relative path)
- In production, use `@blazium/ton-connect-mobile/react`
- The SDK source files are included in the package for development

## Testing

1. **Connection Test**: Tap "Connect Wallet" and select a wallet
2. **Transaction Test**: After connecting, tap "Send Transaction"
3. **Sign Data Test**: After connecting, tap "Sign Data"
4. **Disconnect Test**: Tap "Disconnect" to test disconnection

## Troubleshooting

### "No TON wallet app found"
- Make sure you have a TON wallet installed (Tonkeeper, Tonhub, etc.)
- On Android emulator, you may need to install the wallet app

### "Invalid connection" error
- Check that your manifest URL is accessible
- Verify the manifest file has valid `iconUrl`
- Ensure the manifest `url` field matches your domain

### Deep links not working
- Make sure `scheme` in `app.json` matches the SDK config
- On Android, check `AndroidManifest.xml` has the intent filter
- Deep links only work on mobile devices, not in web browsers

## More Information

- See `README-REACT-INTEGRATION.md` for React integration details
- See main SDK README for full API documentation
