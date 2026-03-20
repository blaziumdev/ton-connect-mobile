/**
 * Core module exports
 */

export { SessionCrypto } from './session';
export { BridgeGateway } from './bridge';
export {
  buildConnectUniversalLink,
  buildReturnUniversalLink,
  buildSendTransactionRpcRequest,
  buildDisconnectRpcRequest,
  parseConnectResponse,
  parseRpcResponse,
  extractWalletInfoFromEvent,
  validateTransactionRequest,
} from './protocol';
export { SUPPORTED_WALLETS, getWalletByName, getDefaultWallet, getWalletsForPlatform } from './wallets';
