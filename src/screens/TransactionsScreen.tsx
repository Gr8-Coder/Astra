import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
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

import {
  transactionCategoryOptions,
  type TransactionCategoryOption,
  type TransactionGroup,
  type TransactionItem
} from '../data/transactions';
import { hapticSelection, hapticSoft, hapticSuccess, hapticWarning } from '../lib/haptics';
import { clamp, colors, fonts, formatCurrency, radii } from '../theme';

function amountText(item: TransactionItem) {
  return item.amountLabel ?? formatCurrency(item.amount);
}

function CategoryPill({
  category,
  icon,
  pillColor
}: {
  category: string;
  icon: string;
  pillColor: string;
}) {
  const isLong = category.length > 12;

  return (
    <View style={[styles.categoryPill, { backgroundColor: pillColor }, isLong ? styles.categoryPillLong : null]}>
      <Text allowFontScaling={false} style={styles.categoryEmoji}>
        {icon}
      </Text>
      <Text allowFontScaling={false} numberOfLines={1} style={[styles.categoryText, isLong ? styles.categoryTextLong : null]}>
        {category}
      </Text>
    </View>
  );
}

type TransactionsScreenProps = {
  onAddTransaction: (item: TransactionItem) => Promise<void>;
  onStartFreshFromNow: () => Promise<void>;
  ready: boolean;
  smsSyncHint?: string;
  transactionGroups: TransactionGroup[];
};

export function TransactionsScreen({
  onAddTransaction,
  onStartFreshFromNow,
  ready,
  smsSyncHint,
  transactionGroups
}: TransactionsScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 390;
  const horizontalPadding = clamp(width * 0.052, 16, 24);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [merchantInput, setMerchantInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategoryOption | null>(null);
  const [isCategoryMenuVisible, setIsCategoryMenuVisible] = useState(false);
  const previousTransactionsSignature = useRef('');

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredGroups = useMemo(
    () =>
      transactionGroups
        .map((group) => {
          if (!normalizedQuery) {
            return group;
          }

          const groupLabelMatch = group.label.toLowerCase().includes(normalizedQuery);
          const filteredTransactions = groupLabelMatch
            ? group.transactions
            : group.transactions.filter((item) => {
                const searchable = [item.merchant, item.category, amountText(item), String(item.amount)]
                  .join(' ')
                  .toLowerCase();

                return searchable.includes(normalizedQuery);
              });

          return {
            ...group,
            transactions: filteredTransactions
          };
        })
        .filter((group) => group.transactions.length > 0),
    [normalizedQuery, transactionGroups]
  );

  const transactionsSignature = useMemo(
    () =>
      transactionGroups
        .map((group) => `${group.label}:${group.transactions.length}`)
        .join('|'),
    [transactionGroups]
  );

  useEffect(() => {
    if (!previousTransactionsSignature.current) {
      previousTransactionsSignature.current = transactionsSignature;
      return;
    }

    if (previousTransactionsSignature.current !== transactionsSignature) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      previousTransactionsSignature.current = transactionsSignature;
    }
  }, [transactionsSignature]);

  function openAddModal() {
    hapticSoft();
    resetForm();
    setIsAddModalVisible(true);
  }

  function closeAddModal() {
    hapticSoft();
    setIsAddModalVisible(false);
    setIsCategoryMenuVisible(false);
  }

  function resetForm() {
    setMerchantInput('');
    setAmountInput('');
    setSelectedCategory(null);
    setIsCategoryMenuVisible(false);
  }

  async function handleSaveTransaction() {
    const merchant = merchantInput.trim();
    const parsedAmount = Number.parseFloat(amountInput.replace(/,/g, '').trim());

    if (!merchant) {
      hapticWarning();
      Alert.alert('Missing merchant', 'Please enter where you spent this amount.');
      return;
    }

    if (!selectedCategory) {
      hapticWarning();
      Alert.alert('Missing category', 'Please pick a category from the dropdown.');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      hapticWarning();
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    const roundedAmount = Math.round(parsedAmount * 100) / 100;
    const hasDecimals = roundedAmount % 1 !== 0;
    const formattedAmount = `₹ ${roundedAmount.toLocaleString('en-IN', {
      maximumFractionDigits: hasDecimals ? 2 : 0,
      minimumFractionDigits: hasDecimals ? 2 : 0
    })}`;

    try {
      setIsSaving(true);
      await onAddTransaction({
        amount: roundedAmount,
        amountLabel: hasDecimals ? formattedAmount : undefined,
        category: selectedCategory.label,
        categoryIcon: selectedCategory.icon,
        isManual: true,
        merchant,
        pillColor: selectedCategory.pillColor
      });

      hapticSuccess();
      closeAddModal();
      resetForm();
    } catch (error) {
      hapticWarning();
      const message = error instanceof Error ? error.message : 'Could not save transaction.';
      Alert.alert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleStartFreshPress() {
    Alert.alert(
      'Start fresh?',
      'This will clear old transactions and start SMS tracking from now only.',
      [
        {
          style: 'cancel',
          text: 'Cancel'
        },
        {
          style: 'destructive',
          text: 'Start fresh',
          onPress: () => {
            void (async () => {
              try {
                setIsResetting(true);
                await onStartFreshFromNow();
                hapticSuccess();
              } catch (error) {
                hapticWarning();
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Could not start fresh right now.';
                Alert.alert('Reset failed', message);
              } finally {
                setIsResetting(false);
              }
            })();
          }
        }
      ]
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: 28 + insets.bottom,
            paddingHorizontal: horizontalPadding
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchRow}>
          <LinearGradient
            colors={[colors.surface, colors.surfaceSoft]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.searchCard}
          >
            <View style={styles.searchLead}>
              <Ionicons color={colors.textSecondary} name="search-outline" size={isCompact ? 25 : 28} />
            </View>
            <TextInput
              allowFontScaling={false}
              onChangeText={setSearchQuery}
              placeholder="Search"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={searchQuery}
            />
          </LinearGradient>

          <Pressable
            onPress={() => {
              hapticSelection();
              setSearchQuery('');
            }}
            style={({ pressed }) => [
              styles.filterButton,
              searchQuery.trim() ? styles.filterButtonActive : null,
              pressed ? styles.filterButtonPressed : null
            ]}
          >
            <MaterialCommunityIcons
              color={searchQuery.trim() ? colors.accentSoft : colors.textPrimary}
              name={searchQuery.trim() ? 'close' : 'tune-variant'}
              size={22}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={openAddModal}
          style={({ pressed }) => [styles.addCard, pressed ? styles.addCardPressed : null]}
        >
          <View style={styles.addIconWrap}>
            <Ionicons color={colors.accentSoft} name="add" size={16} />
          </View>
          <Text allowFontScaling={false} style={styles.addCardText}>
            Add new transaction
          </Text>
        </Pressable>

        <Pressable
          disabled={isResetting}
          onPress={handleStartFreshPress}
          style={({ pressed }) => [
            styles.freshStartButton,
            isResetting ? styles.saveButtonDisabled : null,
            pressed && !isResetting ? styles.modalButtonPressed : null
          ]}
        >
          <Ionicons color={colors.accentSoft} name="refresh-outline" size={16} />
          <Text allowFontScaling={false} style={styles.freshStartButtonText}>
            {isResetting ? 'Resetting...' : 'Start fresh from now'}
          </Text>
        </Pressable>

        {smsSyncHint ? (
          <Text allowFontScaling={false} style={styles.smsHintText}>
            {smsSyncHint}
          </Text>
        ) : null}

        {!ready ? (
          <View style={styles.emptyCard}>
            <Ionicons color={colors.textMuted} name="sync-outline" size={20} />
            <Text allowFontScaling={false} style={styles.emptyText}>
              Syncing your transactions...
            </Text>
          </View>
        ) : filteredGroups.length ? (
          filteredGroups.map((group) => (
            <View key={group.label} style={styles.groupCard}>
              <Text
                allowFontScaling={false}
                style={[styles.groupLabel, group.tone === 'today' ? styles.groupLabelToday : null]}
              >
                {group.label}
              </Text>

              {group.transactions.map((item, index) => (
                <View
                  key={`${group.label}-${item.merchant}-${index}`}
                  style={[
                    styles.transactionRow,
                    index < group.transactions.length - 1 ? styles.transactionRowDivider : null
                  ]}
                >
                  <View style={styles.merchantWrap}>
                    <Text allowFontScaling={false} numberOfLines={2} style={styles.merchant}>
                      {item.merchant}
                    </Text>
                    {item.subtitle ? (
                      <Text allowFontScaling={false} numberOfLines={1} style={styles.merchantSubtitle}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.transactionRight}>
                    <CategoryPill
                      category={item.category}
                      icon={item.categoryIcon}
                      pillColor={item.pillColor}
                    />
                    <Text allowFontScaling={false} style={styles.amount}>
                      {amountText(item)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons color={colors.textMuted} name="search-outline" size={20} />
            <Text allowFontScaling={false} style={styles.emptyText}>
              {searchQuery.trim()
                ? `No transaction found for "${searchQuery.trim()}"`
                : 'No transactions yet. New SMS and manual entries will appear here.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeAddModal}
        transparent
        visible={isAddModalVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable onPress={closeAddModal} style={styles.modalBackdrop} />
          <View
            style={[
              styles.modalCard,
              {
                marginHorizontal: horizontalPadding
              }
            ]}
          >
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Add transaction
            </Text>

            <View style={styles.fieldBlock}>
              <Text allowFontScaling={false} style={styles.fieldLabel}>
                Where did you spend?
              </Text>
              <TextInput
                allowFontScaling={false}
                autoCapitalize="words"
                onChangeText={setMerchantInput}
                placeholder="e.g. Blinkit, Uber, Starbucks"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={merchantInput}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text allowFontScaling={false} style={styles.fieldLabel}>
                Category
              </Text>

              <Pressable
                onPress={() => {
                  hapticSelection();
                  setIsCategoryMenuVisible((current) => !current);
                }}
                style={({ pressed }) => [styles.dropdownTrigger, pressed ? styles.dropdownPressed : null]}
              >
                <View style={styles.dropdownValue}>
                  <Text allowFontScaling={false} style={styles.dropdownEmoji}>
                    {selectedCategory?.icon ?? '🏷️'}
                  </Text>
                  <Text allowFontScaling={false} style={styles.dropdownText}>
                    {selectedCategory?.label ?? 'Select category'}
                  </Text>
                </View>
                <Ionicons
                  color={colors.textSecondary}
                  name={isCategoryMenuVisible ? 'chevron-up' : 'chevron-down'}
                  size={18}
                />
              </Pressable>

              {isCategoryMenuVisible ? (
                <View style={styles.dropdownMenu}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    style={styles.dropdownScroll}
                  >
                    {transactionCategoryOptions.map((option) => (
                      <Pressable
                        key={option.label}
                        onPress={() => {
                          hapticSelection();
                          setSelectedCategory(option);
                          setIsCategoryMenuVisible(false);
                        }}
                        style={({ pressed }) => [
                          styles.dropdownOption,
                          selectedCategory?.label === option.label ? styles.dropdownOptionActive : null,
                          pressed ? styles.dropdownOptionPressed : null
                        ]}
                      >
                        <Text allowFontScaling={false} style={styles.dropdownOptionEmoji}>
                          {option.icon}
                        </Text>
                        <Text allowFontScaling={false} style={styles.dropdownOptionText}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text allowFontScaling={false} style={styles.fieldLabel}>
                Amount spent
              </Text>
              <TextInput
                allowFontScaling={false}
                keyboardType="decimal-pad"
                onChangeText={setAmountInput}
                placeholder="e.g. 499"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={amountInput}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                disabled={isSaving}
                onPress={closeAddModal}
                style={({ pressed }) => [styles.cancelButton, pressed ? styles.modalButtonPressed : null]}
              >
                <Text allowFontScaling={false} style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={isSaving}
                onPress={() => {
                  void handleSaveTransaction();
                }}
                style={({ pressed }) => [
                  styles.saveButton,
                  isSaving ? styles.saveButtonDisabled : null,
                  pressed && !isSaving ? styles.modalButtonPressed : null
                ]}
              >
                <Text allowFontScaling={false} style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    paddingTop: 6
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 18
  },
  searchCard: {
    alignItems: 'center',
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: 20
  },
  searchLead: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    width: 32
  },
  searchInput: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 18.5,
    letterSpacing: 0.2
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    marginLeft: 10,
    width: 50
  },
  filterButtonActive: {
    borderColor: colors.accentDeep
  },
  filterButtonPressed: {
    opacity: 0.85
  },
  addCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: colors.borderSoft,
    borderRadius: 22,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 28,
    minHeight: 84
  },
  addCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.992 }]
  },
  freshStartButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(87, 171, 255, 0.08)',
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 40
  },
  freshStartButtonText: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginLeft: 8
  },
  smsHintText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 9.4,
    marginBottom: 16
  },
  addIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    marginRight: 12,
    width: 28
  },
  addCardText: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 14.2
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: colors.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 72,
    paddingHorizontal: 18
  },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    marginLeft: 8
  },
  groupCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderColor: colors.borderSoft,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  groupLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 9.4,
    letterSpacing: 0.85,
    marginBottom: 12
  },
  groupLabelToday: {
    fontSize: 12.8,
    letterSpacing: 0
  },
  transactionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 10
  },
  transactionRowDivider: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1
  },
  merchant: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13.2,
    lineHeight: 18,
    paddingRight: 10
  },
  merchantWrap: {
    flex: 1
  },
  merchantSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10.2,
    marginTop: 2
  },
  transactionRight: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0
  },
  categoryPill: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 10
  },
  categoryPillLong: {
    paddingHorizontal: 9
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 8
  },
  categoryText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 8.4,
    textTransform: 'uppercase'
  },
  categoryTextLong: {
    fontSize: 7.3
  },
  amount: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 10.2,
    marginLeft: 12,
    minWidth: 72,
    textAlign: 'right'
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 8, 18, 0.74)'
  },
  modalCard: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderStrong,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    width: '100%'
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    marginBottom: 14
  },
  fieldBlock: {
    marginBottom: 12
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    marginBottom: 8
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    minHeight: 46,
    paddingHorizontal: 14
  },
  dropdownTrigger: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: 14
  },
  dropdownPressed: {
    opacity: 0.86
  },
  dropdownValue: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  dropdownEmoji: {
    fontSize: 14,
    marginRight: 8
  },
  dropdownText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13
  },
  dropdownMenu: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    maxHeight: 180
  },
  dropdownScroll: {
    maxHeight: 180
  },
  dropdownOption: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 40,
    paddingHorizontal: 12
  },
  dropdownOptionActive: {
    backgroundColor: colors.accentMuted
  },
  dropdownOptionPressed: {
    opacity: 0.8
  },
  dropdownOptionEmoji: {
    fontSize: 14,
    marginRight: 8
  },
  dropdownOptionText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 6
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12.4
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 10,
    minHeight: 44,
    paddingHorizontal: 12
  },
  saveButtonDisabled: {
    opacity: 0.7
  },
  modalButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }]
  },
  saveButtonText: {
    color: colors.background,
    fontFamily: fonts.semiBold,
    fontSize: 12.8
  }
});
