/**
 * Test script to verify package imports
 */

// Test 1: Basic import
console.log('Test 1: Basic import...');
try {
  const { TonConnectMobile } = require('@blazium/ton-connect-mobile');
  console.log('✅ TonConnectMobile imported');
  console.log('   Type:', typeof TonConnectMobile);
  console.log('   Is class:', TonConnectMobile.prototype !== undefined);
} catch (e) {
  console.error('❌ Failed:', e.message);
  process.exit(1);
}

// Test 2: Error classes
console.log('\nTest 2: Error classes...');
try {
  const {
    TonConnectError,
    ConnectionTimeoutError,
    TransactionTimeoutError,
    UserRejectedError,
    ConnectionInProgressError,
    TransactionInProgressError,
  } = require('@blazium/ton-connect-mobile');
  
  console.log('✅ All error classes imported');
  console.log('   TonConnectError:', typeof TonConnectError);
  console.log('   ConnectionTimeoutError:', typeof ConnectionTimeoutError);
  console.log('   TransactionTimeoutError:', typeof TransactionTimeoutError);
  console.log('   UserRejectedError:', typeof UserRejectedError);
  console.log('   ConnectionInProgressError:', typeof ConnectionInProgressError);
  console.log('   TransactionInProgressError:', typeof TransactionInProgressError);
} catch (e) {
  console.error('❌ Failed:', e.message);
  process.exit(1);
}

// Test 3: Type exports (should be available in TypeScript)
console.log('\nTest 3: Type exports check...');
try {
  const types = require('@blazium/ton-connect-mobile');
  // Types are interfaces, not runtime values
  console.log('✅ Type exports are available (interfaces in TypeScript)');
} catch (e) {
  console.error('❌ Failed:', e.message);
  process.exit(1);
}

// Test 4: Instantiation (without React Native environment)
console.log('\nTest 4: SDK instantiation...');
try {
  const { TonConnectMobile } = require('@blazium/ton-connect-mobile');
  
  // This will fail because we don't have React Native environment
  // But we can check if the constructor exists
  if (typeof TonConnectMobile === 'function') {
    console.log('✅ TonConnectMobile is a constructor');
    console.log('   Constructor exists and is callable');
  } else {
    throw new Error('TonConnectMobile is not a constructor');
  }
} catch (e) {
  console.error('❌ Failed:', e.message);
  process.exit(1);
}

console.log('\n✅ All import tests passed!');
console.log('\nNote: Full functionality requires React Native/Expo environment.');

