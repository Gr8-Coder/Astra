import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent
} from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type RecurringItem } from '../data/recurring';
import {
  transactionCategoryOptions,
  type TransactionGroup,
  type TransactionItem
} from '../data/transactions';
import { type AgentActionTarget } from '../lib/agents';
import {
  addTransactionAndReloadGroups,
  clearTransactionsAndStartFreshSmsTracking,
  inferCategoryLabel,
  loadTransactionGroups,
  removeRecurringPaymentAndReloadGroups,
  upsertRecurringPaymentAndReloadGroups
} from '../lib/transactions';
import { isSmsSyncUnavailableError } from '../lib/androidSms';
import { hapticSelection, hapticSoft } from '../lib/haptics';
import { runSmsIntelligenceAgent } from '../lib/smsIntelligenceAgent';
import { clamp, colors, fonts, radii } from '../theme';
import { AccountsScreen } from './AccountsScreen';
import { AgentsScreen } from './AgentsScreen';
import { CategoriesScreen } from './CategoriesScreen';
import { DashboardScreen } from './DashboardScreen';
import { InvestmentsScreen } from './InvestmentsScreen';
import { RecurringScreen } from './RecurringScreen';
import { TransactionsScreen } from './TransactionsScreen';

const tabs = ['Accounts', 'Investments', 'Transactions', 'Dashboard', 'Categories', 'Recurring', 'Agents'] as const;
const initialTab = 'Dashboard' as const;
const recurringAmountEpsilon = 0.01;
const oneTimeFreshStartKeyPrefix = 'astra.transactions.fresh-start-applied';
const fallbackCategoryVisual = {
  icon: '✨',
  label: 'Other',
  pillColor: '#4C76D6'
};

const categoryVisualByLabel = transactionCategoryOptions.reduce<
  Record<string, { icon: string; label: string; pillColor: string }>
>((lookup, option) => {
  lookup[option.label.trim().toLowerCase()] = {
    icon: option.icon,
    label: option.label,
    pillColor: option.pillColor
  };

  return lookup;
}, {});

type Tab = (typeof tabs)[number];

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function amountLabelFromAmount(amount: number) {
  const hasDecimals = amount % 1 !== 0;

  if (!hasDecimals) {
    return undefined;
  }

  return `₹ ${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function buildOptimisticRecurringTransactionItem(item: RecurringItem): TransactionItem {
  const roundedAmount = Math.round(Math.abs(item.amount) * 100) / 100;
  const inferredCategory = inferCategoryLabel(item.label, item.categoryLabel);
  const categoryVisual = categoryVisualByLabel[normalizeValue(inferredCategory)] ?? fallbackCategoryVisual;

  return {
    amount: roundedAmount,
    amountLabel: amountLabelFromAmount(roundedAmount),
    category: categoryVisual.label,
    categoryIcon: categoryVisual.icon,
    merchant: item.label,
    pillColor: categoryVisual.pillColor,
    recurringItemId: item.id,
    source: 'recurring'
  };
}

function isSameRecurringTransaction(
  transaction: TransactionItem,
  recurringItem: RecurringItem,
  inferredCategory: string
) {
  if (transaction.recurringItemId) {
    return transaction.recurringItemId === recurringItem.id;
  }

  if (transaction.source !== 'recurring') {
    return false;
  }

  const isSameMerchant = normalizeValue(transaction.merchant) === normalizeValue(recurringItem.label);
  const isSameAmount = Math.abs(transaction.amount - recurringItem.amount) < recurringAmountEpsilon;
  const isSameCategory = normalizeValue(transaction.category) === normalizeValue(inferredCategory);

  return isSameMerchant && isSameAmount && isSameCategory;
}

function applyOptimisticRecurringMutation(
  groups: TransactionGroup[],
  recurringItem: RecurringItem,
  nextPaid: boolean
): TransactionGroup[] {
  const inferredCategory = inferCategoryLabel(recurringItem.label, recurringItem.categoryLabel);
  const withoutRecurringEntry: TransactionGroup[] = groups
    .map((group) => ({
      ...group,
      transactions: group.transactions.filter(
        (transaction) => !isSameRecurringTransaction(transaction, recurringItem, inferredCategory)
      )
    }))
    .filter((group) => group.transactions.length > 0);

  if (!nextPaid) {
    return withoutRecurringEntry;
  }

  const nextTransaction = buildOptimisticRecurringTransactionItem(recurringItem);
  const todayIndex = withoutRecurringEntry.findIndex((group) => group.label === 'Today');

  if (todayIndex === -1) {
    return [
      {
        label: 'Today',
        tone: 'today' as const,
        transactions: [nextTransaction]
      },
      ...withoutRecurringEntry
    ];
  }

  return withoutRecurringEntry.map((group, index) =>
    index === todayIndex
      ? {
          ...group,
          transactions: [nextTransaction, ...group.transactions]
        }
      : group
  );
}

type AstraAppShellProps = {
  session: Session;
};

export function AstraAppShell({ session }: AstraAppShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [transactionGroups, setTransactionGroups] = useState<TransactionGroup[]>([]);
  const [optimisticCategoryDeltas, setOptimisticCategoryDeltas] = useState<Record<string, number>>({});
  const [smsSyncHint, setSmsSyncHint] = useState('SMS sync will start from now when you open Transactions.');
  const [dataRefreshToken, setDataRefreshToken] = useState(0);
  const transactionGroupsRef = useRef<TransactionGroup[]>([]);
  const smsWarningShownRef = useRef(false);
  const [transactionsReady, setTransactionsReady] = useState(false);
  const [mountedTabs, setMountedTabs] = useState<Record<Tab, boolean>>(() =>
    tabs.reduce(
      (accumulator, tab) => {
        accumulator[tab] = tab === initialTab;
        return accumulator;
      },
      {} as Record<Tab, boolean>
    )
  );
  const { width } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const pagePosition = useRef(new Animated.Value(tabs.indexOf(initialTab))).current;
  const pageOffset = useRef(new Animated.Value(0)).current;
  const horizontalPadding = clamp(width * 0.06, 18, 28);
  const isCompact = width < 380;
  const tabSlotWidth = isCompact ? 110 : 118;
  const navViewportWidth = width - horizontalPadding * 2;
  const navStripWidth = tabSlotWidth * tabs.length;
  const activePillWidth = isCompact ? 144 : 152;
  const scrollProgress = useMemo(
    () => Animated.add(pagePosition, pageOffset),
    [pageOffset, pagePosition]
  );

  function getTabOffset(index: number) {
    return navViewportWidth / 2 - (index * tabSlotWidth + tabSlotWidth / 2);
  }

  const tabStripTranslateX = useMemo(
    () =>
      scrollProgress.interpolate({
        inputRange: tabs.map((_, index) => index),
        outputRange: tabs.map((_, index) => getTabOffset(index)),
        extrapolate: 'clamp'
      }),
    [navViewportWidth, scrollProgress, tabSlotWidth]
  );

  function handlePageScroll(event: PagerViewOnPageScrollEvent) {
    pageOffset.setValue(event.nativeEvent.offset);
    pagePosition.setValue(event.nativeEvent.position);
  }

  useEffect(() => {
    transactionGroupsRef.current = transactionGroups;
  }, [transactionGroups]);

  function ensureTabMounted(tab: Tab) {
    setMountedTabs((current) => (current[tab] ? current : { ...current, [tab]: true }));
  }

  function bumpDataRefreshToken() {
    setDataRefreshToken((current) => current + 1);
  }

  function applyOptimisticCategoryDelta(categoryLabel: string, delta: number) {
    if (!Number.isFinite(delta) || Math.abs(delta) <= 0.0001) {
      return;
    }

    const key = normalizeValue(categoryLabel);

    if (!key) {
      return;
    }

    setOptimisticCategoryDeltas((current) => {
      const next = { ...current };
      const nextValue = roundMoney((next[key] ?? 0) + delta);

      if (Math.abs(nextValue) <= 0.0001) {
        delete next[key];
      } else {
        next[key] = nextValue;
      }

      return next;
    });
  }

  function handleTabPress(tab: Tab) {
    const index = tabs.indexOf(tab);
    hapticSelection();
    ensureTabMounted(tab);
    setActiveTab(tab);
    pagerRef.current?.setPage(index);
  }

  function handleAgentNavigate(targetTab: AgentActionTarget) {
    const tab = tabs.find((item) => item === targetTab);

    if (!tab) {
      return;
    }

    const index = tabs.indexOf(tab);

    if (index < 0) {
      return;
    }

    hapticSelection();
    ensureTabMounted(tab);
    setActiveTab(tab);
    pagerRef.current?.setPage(index);
  }

  function handleHeaderAction(kind: 'chat' | 'settings') {
    hapticSoft();
    Alert.alert(
      'Coming soon',
      kind === 'settings'
        ? 'Settings panel will be connected in the next pass.'
        : 'In-app support chat will be connected in the next pass.'
    );
  }

  function handlePageSelected(event: PagerViewOnPageSelectedEvent) {
    const nextIndex = event.nativeEvent.position;
    const nextTab = tabs[nextIndex];

    if (nextTab && nextTab !== activeTab) {
      hapticSelection();
      ensureTabMounted(nextTab);
      setActiveTab(nextTab);
    } else if (nextTab) {
      ensureTabMounted(nextTab);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrapTransactions() {
      setTransactionsReady(false);

      try {
        const freshStartKey = `${oneTimeFreshStartKeyPrefix}.${session.user.id}`;
        const hasAppliedFreshStart = Boolean(await AsyncStorage.getItem(freshStartKey));
        const loadedGroups = hasAppliedFreshStart
          ? await loadTransactionGroups(session.user.id)
          : await clearTransactionsAndStartFreshSmsTracking(session.user.id);

        if (!hasAppliedFreshStart) {
          await AsyncStorage.setItem(freshStartKey, '1');
        }

        if (isMounted) {
          transactionGroupsRef.current = loadedGroups;
          if (!hasAppliedFreshStart) {
            setSmsSyncHint('Fresh start enabled. Older transactions were cleared.');
          }
          startTransition(() => {
            setTransactionGroups(loadedGroups);
          });
        }
      } catch (error) {
        console.warn('[transactions] failed to bootstrap', error);

        if (isMounted) {
          Alert.alert(
            'Sync warning',
            'Could not load transactions from the cloud.'
          );
          transactionGroupsRef.current = [];
          startTransition(() => {
            setTransactionGroups([]);
          });
        }
      } finally {
        if (isMounted) {
          setTransactionsReady(true);
        }
      }
    }

    void bootstrapTransactions();

    return () => {
      isMounted = false;
    };
  }, [session.user.id]);

  async function handleAddTransaction(nextItem: TransactionItem) {
    const refreshedGroups = await addTransactionAndReloadGroups(session.user.id, nextItem);
    transactionGroupsRef.current = refreshedGroups;
    startTransition(() => {
      setTransactionGroups(refreshedGroups);
    });
    bumpDataRefreshToken();
  }

  async function handleStartFreshFromNow() {
    const refreshedGroups = await clearTransactionsAndStartFreshSmsTracking(session.user.id);
    transactionGroupsRef.current = refreshedGroups;
    setSmsSyncHint('Fresh start enabled. Only new SMS from now will be tracked.');
    startTransition(() => {
      setTransactionGroups(refreshedGroups);
    });
    bumpDataRefreshToken();
  }

  async function handleRecurringPaymentStateChange({
    item,
    nextPaid
  }: {
    item: RecurringItem;
    nextPaid: boolean;
  }) {
    const inferredCategoryLabel = inferCategoryLabel(item.label, item.categoryLabel);
    const optimisticDelta = nextPaid ? roundMoney(item.amount) : -roundMoney(item.amount);
    applyOptimisticCategoryDelta(inferredCategoryLabel, optimisticDelta);

    const previousGroups = transactionGroupsRef.current;
    const optimisticGroups = applyOptimisticRecurringMutation(previousGroups, item, nextPaid);
    transactionGroupsRef.current = optimisticGroups;
    startTransition(() => {
      setTransactionGroups(optimisticGroups);
    });

    try {
      const refreshedGroups = nextPaid
        ? await upsertRecurringPaymentAndReloadGroups(session.user.id, {
            amount: item.amount,
            categoryLabel: item.categoryLabel,
            merchant: item.label,
            recurringItemId: item.id
          })
        : await removeRecurringPaymentAndReloadGroups(session.user.id, item.id);

      transactionGroupsRef.current = refreshedGroups;
      startTransition(() => {
        setTransactionGroups(refreshedGroups);
      });
      applyOptimisticCategoryDelta(inferredCategoryLabel, -optimisticDelta);
      bumpDataRefreshToken();
    } catch (error) {
      transactionGroupsRef.current = previousGroups;
      startTransition(() => {
        setTransactionGroups(previousGroups);
      });
      applyOptimisticCategoryDelta(inferredCategoryLabel, -optimisticDelta);
      throw error;
    }
  }

  useEffect(() => {
    let active = true;
    let syncInFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function runSync() {
      if (!active || syncInFlight) {
        return;
      }

      syncInFlight = true;

      try {
        const result = await runSmsIntelligenceAgent(session.user.id);
        const transactionSync = result.transactionSync;
        const accountSync = result.accountSync;

        if (!active) {
          return;
        }

        transactionGroupsRef.current = transactionSync.groups;
        startTransition(() => {
          setTransactionGroups(transactionSync.groups);
        });

        if (transactionSync.trackingStarted) {
          setSmsSyncHint('SMS tracking started from now. Older messages are ignored.');
        } else if (transactionSync.syncedCount > 0 || accountSync.updatedAccounts > 0) {
          const transactionPart =
            transactionSync.syncedCount > 0
              ? `${transactionSync.syncedCount} SMS transaction${transactionSync.syncedCount > 1 ? 's' : ''}`
              : '';
          const accountPart =
            accountSync.updatedAccounts > 0
              ? `${accountSync.updatedAccounts} bank account${accountSync.updatedAccounts > 1 ? 's' : ''}`
              : '';
          const combined = [transactionPart, accountPart].filter(Boolean).join(' and ');

          setSmsSyncHint(`SMS Intelligence Agent synced ${combined}.`);
          bumpDataRefreshToken();
        } else {
          setSmsSyncHint('SMS Intelligence Agent is watching for new bank SMS from now.');
        }
      } catch (error) {
        if (isSmsSyncUnavailableError(error)) {
          if (!smsWarningShownRef.current && active) {
            smsWarningShownRef.current = true;
            setSmsSyncHint('Enable SMS permission on Android to auto-sync new transactions.');
          }
        } else {
          console.warn('[transactions] sms sync failed', error);
        }
      } finally {
        syncInFlight = false;
      }

      if (active) {
        timer = setTimeout(() => {
          void runSync();
        }, 18000);
      }
    }

    void runSync();

    return () => {
      active = false;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [session.user.id]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.safeArea}>
        <LinearGradient
          colors={[colors.background, colors.backgroundAlt, '#081C31']}
          end={{ x: 0.9, y: 1 }}
          start={{ x: 0.1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.backgroundDecor}>
          <LinearGradient
            colors={['rgba(117, 184, 255, 0.14)', 'rgba(117, 184, 255, 0.04)', 'transparent']}
            end={{ x: 0.25, y: 0.9 }}
            start={{ x: 0.92, y: 0 }}
            style={styles.headerGlow}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'transparent']}
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={styles.topHairline}
          />
        </View>

        <View
          style={[
            styles.header,
            {
              paddingHorizontal: horizontalPadding
            }
          ]}
        >
          <View style={styles.headerActionsRow}>
            <Pressable
              onPress={() => handleHeaderAction('settings')}
              style={({ pressed }) => [styles.headerIconButton, pressed ? styles.headerIconButtonPressed : null]}
            >
              <Ionicons color={colors.accentSoft} name="settings-sharp" size={22} />
            </Pressable>
            <Pressable
              onPress={() => handleHeaderAction('chat')}
              style={({ pressed }) => [styles.headerIconButton, pressed ? styles.headerIconButtonPressed : null]}
            >
              <Ionicons color={colors.accentSoft} name="chatbox-ellipses-outline" size={21} />
            </Pressable>
          </View>

          <Text allowFontScaling={false} style={styles.logo}>
            Astra
          </Text>

          <View style={styles.tabViewport}>
            <View style={styles.tabRail} />
            <LinearGradient
              pointerEvents="none"
              colors={[colors.accentSoft, colors.accent]}
              style={[
                styles.activeTabPill,
                {
                  left: (navViewportWidth - activePillWidth) / 2,
                  width: activePillWidth
                }
              ]}
            />

            <Animated.View
              style={[
                styles.tabRow,
                {
                  width: navStripWidth,
                  transform: [{ translateX: tabStripTranslateX }]
                }
              ]}
            >
              {tabs.map((tab) => {
                const index = tabs.indexOf(tab);
                const tabColor = scrollProgress.interpolate({
                  inputRange: [index - 1, index, index + 1],
                  outputRange: [colors.textMuted, colors.backgroundAlt, colors.textMuted],
                  extrapolate: 'clamp'
                });
                const tabOpacity = scrollProgress.interpolate({
                  inputRange: [index - 1, index, index + 1],
                  outputRange: [0.72, 1, 0.72],
                  extrapolate: 'clamp'
                });
                const tabScale = scrollProgress.interpolate({
                  inputRange: [index - 1, index, index + 1],
                  outputRange: [0.98, 1.02, 0.98],
                  extrapolate: 'clamp'
                });

                return (
                  <Pressable
                    key={tab}
                    onPress={() => handleTabPress(tab)}
                    style={({ pressed }) => [
                      styles.tabButton,
                      {
                        width: tabSlotWidth
                      },
                      pressed ? styles.tabButtonPressed : null
                    ]}
                  >
                    <Animated.Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={[
                        styles.tabText,
                        {
                          color: tabColor,
                          opacity: tabOpacity,
                          transform: [{ scale: tabScale }]
                        }
                      ]}
                    >
                      {tab}
                    </Animated.Text>
                  </Pressable>
                );
              })}
            </Animated.View>
          </View>
        </View>

        <View style={styles.content}>
          <PagerView
            initialPage={tabs.indexOf(initialTab)}
            offscreenPageLimit={1}
            onPageScroll={handlePageScroll}
            onPageSelected={handlePageSelected}
            ref={pagerRef}
            style={styles.pager}
          >
            <View collapsable={false} style={styles.screenPage}>
              {mountedTabs.Accounts ? (
                <AccountsScreen refreshToken={dataRefreshToken} userId={session.user.id} />
              ) : null}
            </View>

            <View collapsable={false} style={styles.screenPage}>
              {mountedTabs.Investments ? <InvestmentsScreen /> : null}
            </View>

            <View collapsable={false} style={styles.screenPage}>
              {mountedTabs.Transactions ? (
                <TransactionsScreen
                  onAddTransaction={handleAddTransaction}
                  onStartFreshFromNow={handleStartFreshFromNow}
                  ready={transactionsReady}
                  smsSyncHint={smsSyncHint}
                  transactionGroups={transactionGroups}
                />
              ) : null}
            </View>

            <View collapsable={false} style={styles.screenPage}>
              {mountedTabs.Dashboard ? (
                <DashboardScreen refreshToken={dataRefreshToken} userId={session.user.id} />
              ) : null}
            </View>

            <View collapsable={false} style={styles.screenPage}>
              {mountedTabs.Categories ? (
                <CategoriesScreen
                  onDataMutation={bumpDataRefreshToken}
                  optimisticCategoryDeltas={optimisticCategoryDeltas}
                  refreshToken={dataRefreshToken}
                  userId={session.user.id}
                />
              ) : null}
            </View>

            <View collapsable={false} style={styles.screenPage}>
              {mountedTabs.Recurring ? (
                <RecurringScreen onRecurringPaymentStateChange={handleRecurringPaymentStateChange} />
              ) : null}
            </View>

            <View collapsable={false} style={styles.screenPage}>
              {mountedTabs.Agents ? (
                <AgentsScreen
                  onNavigateToTab={handleAgentNavigate}
                  refreshToken={dataRefreshToken}
                  transactionGroups={transactionGroups}
                  userId={session.user.id}
                />
              ) : null}
            </View>
          </PagerView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  backgroundDecor: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  headerGlow: {
    height: 220,
    opacity: 0.95,
    position: 'absolute',
    right: -12,
    top: -8,
    width: '72%'
  },
  topHairline: {
    height: 1,
    left: 22,
    opacity: 0.55,
    position: 'absolute',
    right: 22,
    top: 0
  },
  header: {
    paddingBottom: 16,
    paddingTop: 8
  },
  headerActionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  headerIconButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.96 }]
  },
  logo: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 28,
    letterSpacing: -0.9,
    marginBottom: 16,
    textAlign: 'center'
  },
  tabViewport: {
    height: 50,
    justifyContent: 'center',
    overflow: 'hidden'
  },
  tabRail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1
  },
  activeTabPill: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: radii.pill,
    height: 42,
    position: 'absolute',
    top: 4
  },
  tabRow: {
    alignItems: 'center',
    flexDirection: 'row',
    position: 'absolute'
  },
  tabButton: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    minHeight: 50
  },
  tabButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }]
  },
  tabText: {
    fontFamily: fonts.medium,
    fontSize: 11.2
  },
  content: {
    flex: 1,
    overflow: 'hidden'
  },
  pager: {
    flex: 1
  },
  screenPage: {
    flex: 1
  }
});
