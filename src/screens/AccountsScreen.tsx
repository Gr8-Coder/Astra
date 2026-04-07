import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestmentTrendChart } from '../components/charts/InvestmentTrendChart';
import {
  accountOverviewSnapshots,
  creditCards,
  investmentRanges,
  type DepositoryAccount,
  type RangeKey
} from '../data/accounts';
import { type TrendPoint } from '../data/investments';
import {
  addManualBankAccount,
  deleteDepositoryAccount,
  loadAccountAssetTrendPoints,
  loadDepositoryAccounts,
  searchBanks,
  type IndianBankOption
} from '../lib/accounts';
import { hapticSelection, hapticSoft, hapticSuccess, hapticWarning } from '../lib/haptics';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

function formatCurrencyFixed(amount: number) {
  return `₹ ${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function depositoryItemKey(item: DepositoryAccount, index?: number) {
  if (item.id) {
    return item.id;
  }

  return `${item.name}|${item.label}|${item.current}|${index ?? 0}`;
}

function AccountsSectionHeader({
  actionLabel,
  onActionPress,
  totalLabel,
  title
}: {
  actionLabel?: string;
  onActionPress?: () => void;
  title: string;
  totalLabel: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Ionicons color={colors.textMuted} name="caret-up" size={14} />
        <Text allowFontScaling={false} style={styles.sectionTitle}>
          {title}
        </Text>
        <Text allowFontScaling={false} style={styles.sectionTotal}>
          {totalLabel}
        </Text>
      </View>
      {actionLabel ? (
        onActionPress ? (
          <Pressable
            onPress={onActionPress}
            style={({ pressed }) => [
              styles.sectionActionButton,
              pressed ? styles.sectionActionButtonPressed : null
            ]}
          >
            <Text allowFontScaling={false} style={styles.sectionAction}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : (
          <Text allowFontScaling={false} style={styles.sectionAction}>
            {actionLabel}
          </Text>
        )
      ) : null}
    </View>
  );
}

type AccountsScreenProps = {
  refreshToken: number;
  userId: string;
};

type ConnectStep = 'bank' | 'balance';

export function AccountsScreen({ refreshToken, userId }: AccountsScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeRange, setActiveRange] = useState<RangeKey>('3M');
  const [depositoryItems, setDepositoryItems] = useState<DepositoryAccount[]>([]);
  const [isDepositoryLoading, setIsDepositoryLoading] = useState(false);
  const [isConnectModalVisible, setIsConnectModalVisible] = useState(false);
  const [isAccountActionsVisible, setIsAccountActionsVisible] = useState(false);
  const [selectedDepositoryAccount, setSelectedDepositoryAccount] = useState<DepositoryAccount | null>(null);
  const [selectedDepositoryAccountKey, setSelectedDepositoryAccountKey] = useState<string | null>(null);
  const [connectStep, setConnectStep] = useState<ConnectStep>('bank');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<IndianBankOption | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [accountMaskInput, setAccountMaskInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDeletingDepositoryAccount, setIsDeletingDepositoryAccount] = useState(false);
  const snapshot = accountOverviewSnapshots[activeRange];
  const [liveTrendPoints, setLiveTrendPoints] = useState<TrendPoint[]>(snapshot.points);
  const horizontalPadding = clamp(width * 0.052, 16, 24);
  const filteredBanks = useMemo(() => searchBanks(bankSearchQuery), [bankSearchQuery]);
  const depositoryTotal = useMemo(
    () => depositoryItems.reduce((sum, item) => sum + item.current, 0),
    [depositoryItems]
  );
  const depositoryTotalLabel = useMemo(() => formatCurrencyFixed(depositoryTotal), [depositoryTotal]);
  const liveSnapshot = useMemo(
    () => ({
      ...snapshot,
      assets: Math.round(Math.max(0, depositoryTotal) * 100) / 100,
      debt: 0
    }),
    [depositoryTotal, snapshot]
  );
  const creditCardsForNow = useMemo(
    () =>
      creditCards.map((card) => ({
        ...card,
        balance: 0,
        utilizedLabel: '0.00%'
      })),
    []
  );
  const creditCardsTotalForNowLabel = useMemo(() => formatCurrencyFixed(0), []);

  useEffect(() => {
    setLiveTrendPoints(snapshot.points);
  }, [snapshot.points]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setIsDepositoryLoading(true);

      try {
        const loaded = await loadDepositoryAccounts(userId);

        if (active) {
          setDepositoryItems(loaded);
        }
      } catch (error) {
        if (active) {
          setDepositoryItems([]);
          console.warn('[accounts] failed to load depository accounts', error);
        }
      } finally {
        if (active) {
          setIsDepositoryLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    async function syncTrend() {
      try {
        const points = await loadAccountAssetTrendPoints({
          currentAssets: depositoryTotal,
          range: activeRange,
          userId
        });

        if (active && points.length) {
          setLiveTrendPoints(points);
        }
      } catch (error) {
        if (active) {
          setLiveTrendPoints(snapshot.points);
          console.warn('[accounts] failed to load account trend points', error);
        }
      }
    }

    void syncTrend();

    return () => {
      active = false;
    };
  }, [activeRange, depositoryTotal, refreshToken, snapshot.points, userId]);

  function resetConnectState() {
    setConnectStep('bank');
    setBankSearchQuery('');
    setSelectedBank(null);
    setBalanceInput('');
    setAccountMaskInput('');
  }

  function openConnectModal() {
    hapticSoft();
    resetConnectState();
    setIsConnectModalVisible(true);
  }

  function closeConnectModal() {
    if (isConnecting) {
      return;
    }

    hapticSoft();
    setIsConnectModalVisible(false);
    resetConnectState();
  }

  function openAccountActions(account: DepositoryAccount, key: string) {
    hapticSoft();
    setSelectedDepositoryAccount(account);
    setSelectedDepositoryAccountKey(key);
    setIsAccountActionsVisible(true);
  }

  function closeAccountActions(force = false) {
    if (isDeletingDepositoryAccount && !force) {
      return;
    }

    setIsAccountActionsVisible(false);
    setSelectedDepositoryAccount(null);
    setSelectedDepositoryAccountKey(null);
  }

  function handleEditDepositoryAccount() {
    hapticSelection();
    Alert.alert('Coming soon', 'Edit bank account details will be added in the next step.');
    closeAccountActions();
  }

  async function handleDeleteDepositoryAccount() {
    if (!selectedDepositoryAccount) {
      return;
    }

    const targetKey = selectedDepositoryAccountKey;

    try {
      setIsDeletingDepositoryAccount(true);

      if (selectedDepositoryAccount.id) {
        await deleteDepositoryAccount({
          accountId: selectedDepositoryAccount.id,
          userId
        });
      }

      if (targetKey) {
        setDepositoryItems((current) =>
          current.filter((item, index) => depositoryItemKey(item, index) !== targetKey)
        );
      }

      hapticSuccess();
      closeAccountActions(true);
      Alert.alert('Deleted', `${selectedDepositoryAccount.name} has been removed from Depository.`);
    } catch (error) {
      hapticWarning();
      const message =
        error instanceof Error
          ? error.message
          : 'Could not delete this bank account right now.';
      Alert.alert('Delete failed', message);
    } finally {
      setIsDeletingDepositoryAccount(false);
    }
  }

  function goToBalanceStep() {
    if (!selectedBank) {
      hapticWarning();
      Alert.alert('Missing bank', 'Select a bank to continue.');
      return;
    }

    hapticSelection();
    setConnectStep('balance');
  }

  async function handleConnectBank() {
    if (!selectedBank) {
      hapticWarning();
      Alert.alert('Missing bank', 'Select a bank to continue.');
      return;
    }

    try {
      setIsConnecting(true);

      const parsedBalance = Number.parseFloat(balanceInput.replace(/,/g, '').trim());

      if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
        hapticWarning();
        Alert.alert('Invalid amount', 'Please enter a valid current balance.');
        return;
      }

      await addManualBankAccount({
        accountMask: accountMaskInput,
        bankName: selectedBank.name,
        currentBalance: parsedBalance,
        userId
      });

      const refreshed = await loadDepositoryAccounts(userId);
      setDepositoryItems(refreshed);
      hapticSuccess();
      closeConnectModal();
      Alert.alert('Bank added', `${selectedBank.name} has been added to your Depository section.`);
    } catch (error) {
      hapticWarning();
      const message =
        error instanceof Error
          ? error.message
          : 'Could not add this bank account. Please try again.';

      Alert.alert('Add failed', message);
    } finally {
      setIsConnecting(false);
    }
  }

  const isBalanceValid = Number.isFinite(Number.parseFloat(balanceInput.replace(/,/g, '').trim()));

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: 28 + insets.bottom,
            paddingHorizontal: horizontalPadding
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroShell}>
          <View style={styles.heroCard}>
            <Ionicons color={colors.accentMuted} name="settings-sharp" size={22} style={styles.heroIcon} />

            <View style={styles.heroSummaryRow}>
              <View style={styles.summaryBlock}>
                <Text allowFontScaling={false} style={styles.summaryValue}>
                  {formatCurrency(liveSnapshot.assets)}
                </Text>
                <Text allowFontScaling={false} style={styles.summaryLabel}>
                  in assets
                </Text>
              </View>

              <View style={styles.summaryBlock}>
                <Text allowFontScaling={false} style={styles.summaryValue}>
                  {formatCurrency(liveSnapshot.debt)}
                </Text>
                <Text allowFontScaling={false} style={styles.summaryLabel}>
                  in debt
                </Text>
              </View>
            </View>

            <View style={styles.heroChartWrap}>
              <InvestmentTrendChart points={liveTrendPoints} />
            </View>

            <View style={styles.rangeRow}>
              {investmentRanges.map((range) => {
                const isActive = range === activeRange;

                return (
                  <Pressable
                    key={range}
                    onPress={() => {
                      hapticSelection();
                      setActiveRange(range);
                    }}
                    style={[styles.rangeChip, isActive ? styles.rangeChipActive : null]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[styles.rangeLabel, isActive ? styles.rangeLabelActive : null]}
                    >
                      {range}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <AccountsSectionHeader
          actionLabel="add >"
          title="Credit Cards"
          totalLabel={creditCardsTotalForNowLabel}
        />
        {creditCardsForNow.map((card) => (
          <View key={card.brand} style={styles.instrumentRow}>
            <View style={[styles.instrumentCard, { backgroundColor: card.visualColor }]}>
              <Text allowFontScaling={false} style={styles.instrumentBrand}>
                {card.brand}
              </Text>
              <Text allowFontScaling={false} style={styles.instrumentLabel}>
                {card.label}
              </Text>
            </View>

            <View style={styles.metricsWrap}>
              <View style={styles.metricsColumns}>
                <View style={styles.metricColumn}>
                  <Text allowFontScaling={false} style={styles.metricHeading}>
                    BALANCE
                  </Text>
                  <Text allowFontScaling={false} style={styles.metricValue}>
                    {formatCurrencyFixed(card.balance)}
                  </Text>
                </View>
                <View style={styles.metricColumnRight}>
                  <Text allowFontScaling={false} style={styles.metricHeading}>
                    UTILIZED
                  </Text>
                  <Text allowFontScaling={false} style={styles.metricValue}>
                    {card.utilizedLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}

        <AccountsSectionHeader
          actionLabel="add >"
          onActionPress={openConnectModal}
          title="Depository"
          totalLabel={depositoryTotalLabel}
        />
        {isDepositoryLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accentSoft} size="small" />
            <Text allowFontScaling={false} style={styles.loadingText}>
              Syncing connected banks...
            </Text>
          </View>
        ) : null}

        {depositoryItems.length ? (
          depositoryItems.map((account, index) => (
            <Pressable
              delayLongPress={260}
              key={depositoryItemKey(account, index)}
              onLongPress={() => openAccountActions(account, depositoryItemKey(account, index))}
              style={({ pressed }) => [
                styles.instrumentRow,
                pressed ? styles.depositoryRowPressed : null
              ]}
            >
              <View style={[styles.instrumentCard, { backgroundColor: account.visualColor }, styles.depositoryCard]}>
                <Text allowFontScaling={false} style={styles.instrumentBrand}>
                  {account.name}
                </Text>
                <Text allowFontScaling={false} style={styles.instrumentLabel}>
                  {account.label}
                </Text>
              </View>

              <View style={styles.metricsWrap}>
                <View style={styles.metricsColumns}>
                  <View style={styles.metricColumn}>
                    <Text allowFontScaling={false} style={styles.metricHeading}>
                      CURRENT
                    </Text>
                    <Text allowFontScaling={false} style={styles.metricValue}>
                      {formatCurrencyFixed(account.current)}
                    </Text>
                  </View>
                  <View style={styles.metricColumnRight}>
                    <Text allowFontScaling={false} style={styles.metricHeading}>
                      CHANGE
                    </Text>
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.metricValue,
                        account.changeLabel === 'Latest SMS' ? styles.metricValueHighlight : null
                      ]}
                    >
                      {account.changeLabel}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text allowFontScaling={false} style={styles.emptyStateTitle}>
              No banks connected yet
            </Text>
            <Text allowFontScaling={false} style={styles.emptyStateText}>
              Tap add to connect your first bank account.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => closeAccountActions()}
        transparent
        visible={isAccountActionsVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable onPress={() => closeAccountActions()} style={styles.modalBackdrop} />
          <View
            style={[
              styles.modalCard,
              {
                marginHorizontal: horizontalPadding,
                marginBottom: insets.bottom + 18
              }
            ]}
          >
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Manage bank account
            </Text>
            <Text allowFontScaling={false} style={styles.modalSubtitle}>
              {selectedDepositoryAccount
                ? `${selectedDepositoryAccount.name} • ${selectedDepositoryAccount.label}`
                : 'Select an action'}
            </Text>

            <Pressable
              disabled={isDeletingDepositoryAccount}
              onPress={handleEditDepositoryAccount}
              style={({ pressed }) => [
                styles.accountActionButton,
                pressed ? styles.accountActionButtonPressed : null
              ]}
            >
              <Ionicons color={colors.accentSoft} name="create-outline" size={18} />
              <Text allowFontScaling={false} style={styles.accountActionText}>
                Edit (coming soon)
              </Text>
            </Pressable>

            <Pressable
              disabled={isDeletingDepositoryAccount}
              onPress={() => {
                Alert.alert(
                  'Delete account?',
                  'This will remove this bank card from the app.',
                  [
                    {
                      style: 'cancel',
                      text: 'Cancel'
                    },
                    {
                      style: 'destructive',
                      text: 'Delete',
                      onPress: () => {
                        void handleDeleteDepositoryAccount();
                      }
                    }
                  ]
                );
              }}
              style={({ pressed }) => [
                styles.accountActionButton,
                styles.accountActionDanger,
                pressed ? styles.accountActionButtonPressed : null
              ]}
            >
              {isDeletingDepositoryAccount ? (
                <ActivityIndicator color="#FF7B7B" size="small" />
              ) : (
                <Ionicons color="#FF7B7B" name="trash-outline" size={18} />
              )}
              <Text allowFontScaling={false} style={styles.accountActionDangerText}>
                Delete account
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeConnectModal}
        transparent
        visible={isConnectModalVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable onPress={closeConnectModal} style={styles.modalBackdrop} />
          <View
            style={[
              styles.modalCard,
              {
                marginHorizontal: horizontalPadding,
                marginBottom: insets.bottom + 18
              }
            ]}
          >
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Add bank account
            </Text>
            <Text allowFontScaling={false} style={styles.modalSubtitle}>
              {connectStep === 'bank'
                ? 'Step 1 of 2 • Select bank'
                : 'Step 2 of 2 • Add current balance'}
            </Text>

            {connectStep === 'bank' ? (
              <>
                <TextInput
                  allowFontScaling={false}
                  onChangeText={setBankSearchQuery}
                  placeholder="Search banks in India"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={bankSearchQuery}
                />
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.bankList}>
                  {filteredBanks.map((bank) => {
                    const isSelected = selectedBank?.code === bank.code;

                    return (
                      <Pressable
                        key={bank.code}
                        onPress={() => {
                          hapticSelection();
                          setSelectedBank(bank);
                        }}
                        style={({ pressed }) => [
                          styles.bankRow,
                          isSelected ? styles.bankRowSelected : null,
                          pressed ? styles.bankRowPressed : null
                        ]}
                      >
                        <View style={[styles.bankDot, { backgroundColor: bank.accentColor }]} />
                        <Text allowFontScaling={false} style={styles.bankName}>
                          {bank.name}
                        </Text>
                        <Text allowFontScaling={false} style={styles.bankCode}>
                          {bank.code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  disabled={!selectedBank}
                  onPress={() => {
                    hapticSelection();
                    goToBalanceStep();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !selectedBank ? styles.buttonDisabled : null,
                    pressed && selectedBank ? styles.primaryButtonPressed : null
                  ]}
                >
                  <Text allowFontScaling={false} style={styles.primaryButtonText}>
                    Continue
                  </Text>
                </Pressable>
              </>
            ) : null}

            {connectStep === 'balance' ? (
              <>
                <View style={styles.selectedBankPill}>
                  <Text allowFontScaling={false} style={styles.selectedBankPillText}>
                    {selectedBank?.name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      hapticSelection();
                      setConnectStep('bank');
                    }}
                  >
                    <Text allowFontScaling={false} style={styles.changeBankText}>
                      change
                    </Text>
                  </Pressable>
                </View>

                <Text allowFontScaling={false} style={styles.fieldLabel}>
                  Current balance
                </Text>
                <TextInput
                  allowFontScaling={false}
                  keyboardType="decimal-pad"
                  onChangeText={setBalanceInput}
                  placeholder="e.g. 54876.78"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={balanceInput}
                />
                <Text allowFontScaling={false} style={styles.fieldLabel}>
                  Account last 4 digits (optional)
                </Text>
                <TextInput
                  allowFontScaling={false}
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(value) => setAccountMaskInput(value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 3008"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  value={accountMaskInput}
                />

                <Text allowFontScaling={false} style={styles.helperText}>
                  We will use this as your opening balance and map new SMS transactions from now.
                </Text>

                <View style={styles.modalActions}>
                  <Pressable
                    disabled={isConnecting}
                    onPress={() => {
                      hapticSelection();
                      setConnectStep('bank');
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text allowFontScaling={false} style={styles.secondaryButtonText}>
                      Back
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={!isBalanceValid || isConnecting}
                    onPress={handleConnectBank}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      styles.primaryButtonInline,
                      !isBalanceValid || isConnecting ? styles.buttonDisabled : null,
                      pressed && isBalanceValid && !isConnecting ? styles.primaryButtonPressed : null
                    ]}
                  >
                    {isConnecting ? (
                      <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                      <Text allowFontScaling={false} style={styles.primaryButtonText}>
                        Add bank
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 6
  },
  heroShell: {
    borderRadius: radii.xl,
    marginBottom: 26,
    ...shadows.card
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16
  },
  heroIcon: {
    position: 'absolute',
    right: 18,
    top: 18
  },
  heroSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 40
  },
  summaryBlock: {
    minWidth: 124
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 22
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.9,
    marginTop: 4
  },
  heroChartWrap: {
    marginTop: 10,
    paddingHorizontal: 2
  },
  rangeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8
  },
  rangeChip: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 46,
    paddingHorizontal: 10
  },
  rangeChipActive: {
    backgroundColor: colors.surfaceSoft
  },
  rangeLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.8
  },
  rangeLabelActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionHeaderLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 11.2,
    marginLeft: 6
  },
  sectionTotal: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginLeft: 16
  },
  sectionActionButton: {
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  sectionActionButtonPressed: {
    backgroundColor: 'rgba(87, 171, 255, 0.14)',
    transform: [{ scale: 0.985 }]
  },
  sectionAction: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 10.8
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 9.4,
    marginLeft: 8
  },
  instrumentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16
  },
  depositoryRowPressed: {
    opacity: 0.88
  },
  instrumentCard: {
    borderRadius: 20,
    flex: 0.92,
    minHeight: 146,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  depositoryCard: {
    minHeight: 126
  },
  instrumentBrand: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14
  },
  instrumentLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10,
    marginTop: 'auto'
  },
  metricsWrap: {
    flex: 1.18,
    marginLeft: 16
  },
  metricsColumns: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  metricColumn: {
    flex: 1
  },
  metricColumnRight: {
    alignItems: 'flex-end',
    flex: 0.9
  },
  metricHeading: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 9.8
  },
  metricValue: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10.4,
    marginTop: 10
  },
  metricValueHighlight: {
    color: colors.accentSoft,
    fontFamily: fonts.semiBold
  },
  emptyState: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  emptyStateTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 11
  },
  emptyStateText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 9.6,
    marginTop: 6
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.52)'
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 24,
    borderWidth: 1,
    maxHeight: '86%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14.4
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 9.6,
    marginBottom: 12,
    marginTop: 4
  },
  accountActionButton: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 14
  },
  accountActionButtonPressed: {
    opacity: 0.85
  },
  accountActionText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10.4,
    marginLeft: 10
  },
  accountActionDanger: {
    marginTop: 10
  },
  accountActionDangerText: {
    color: '#FF7B7B',
    fontFamily: fonts.semiBold,
    fontSize: 10.4,
    marginLeft: 10
  },
  input: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 11.4,
    minHeight: 48,
    paddingHorizontal: 14
  },
  bankList: {
    marginTop: 12,
    maxHeight: 284
  },
  bankRow: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    minHeight: 44,
    paddingHorizontal: 12
  },
  bankRowSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(87, 171, 255, 0.14)'
  },
  bankRowPressed: {
    opacity: 0.8
  },
  bankDot: {
    borderRadius: 6,
    height: 12,
    marginRight: 10,
    width: 12
  },
  bankName: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10.9
  },
  bankCode: {
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 9.5
  },
  selectedBankPill: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 42,
    paddingHorizontal: 14
  },
  selectedBankPillText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 10.8
  },
  changeBankText: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 9.8
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 9.7,
    marginBottom: 8
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 9.3,
    marginTop: 8
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 14
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10.5
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44
  },
  primaryButtonInline: {
    flex: 1,
    marginLeft: 10,
    marginTop: 0
  },
  primaryButtonText: {
    color: colors.background,
    fontFamily: fonts.semiBold,
    fontSize: 10.6
  },
  primaryButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  },
  buttonDisabled: {
    opacity: 0.45
  }
});
