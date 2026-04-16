import {
  syncSmsDetectedBankAccountsFromTransactions,
  type SyncSmsDetectedBanksResult
} from './accounts';
import {
  syncSmsTransactionsFromNow,
  type SmsSyncRunResult
} from './transactions';

export type SmsIntelligenceAgentRunResult = {
  accountSync: SyncSmsDetectedBanksResult;
  transactionSync: SmsSyncRunResult;
};

export async function runSmsIntelligenceAgent(userId: string): Promise<SmsIntelligenceAgentRunResult> {
  const transactionSync = await syncSmsTransactionsFromNow(userId);

  const accountSync = await syncSmsDetectedBankAccountsFromTransactions({
    matchedMessages: transactionSync.matchedCount,
    scannedMessages: transactionSync.scannedCount,
    transactions: transactionSync.transactions,
    userId
  });

  return {
    accountSync,
    transactionSync
  };
}
