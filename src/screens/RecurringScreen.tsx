import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
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

import { RecurringRing } from '../components/charts/RecurringRing';
import { recurringItems, type RecurringItem } from '../data/recurring';
import { transactionCategoryOptions } from '../data/transactions';
import { hapticSelection, hapticSoft, hapticSuccess, hapticWarning } from '../lib/haptics';
import { inferCategoryLabel } from '../lib/transactions';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

type RecurringIconChoice = {
  icon: string;
  label: string;
  type: Exclude<RecurringItem['type'], 'add'>;
};

type RecurringIconGroup = {
  title: string;
  options: RecurringIconChoice[];
};

const recurringIconGroups: RecurringIconGroup[] = [
  {
    title: 'Streaming & Media',
    options: [
      { icon: 'spotify', label: 'Spotify', type: 'brand' },
      { icon: 'youtube', label: 'YouTube', type: 'brand' },
      { icon: 'N', label: 'Netflix', type: 'brand' },
      { icon: 'hotstar', label: 'Disney+', type: 'brand' },
      { icon: 'headphones', label: 'Audio', type: 'icon' },
      { icon: '📺', label: 'TV Emoji', type: 'emoji' }
    ]
  },
  {
    title: 'Food & Lifestyle',
    options: [
      { icon: '🍽️', label: 'Food', type: 'emoji' },
      { icon: '🥥', label: 'Coconut', type: 'emoji' },
      { icon: 'food-outline', label: 'Meal', type: 'icon' },
      { icon: 'coffee-outline', label: 'Coffee', type: 'icon' },
      { icon: 'basket', label: 'Groceries', type: 'icon' },
      { icon: '🍔', label: 'Restaurant', type: 'emoji' }
    ]
  },
  {
    title: 'Bills & Utilities',
    options: [
      { icon: 'google', label: 'Google', type: 'brand' },
      { icon: 'microsoft', label: 'Microsoft', type: 'brand' },
      { icon: 'wifi', label: 'Internet', type: 'icon' },
      { icon: 'flash-outline', label: 'Electricity', type: 'icon' },
      { icon: 'water-outline', label: 'Water', type: 'icon' },
      { icon: '📱', label: 'Mobile', type: 'emoji' }
    ]
  },
  {
    title: 'Home & Transport',
    options: [
      { icon: '🏠', label: 'Rent', type: 'emoji' },
      { icon: 'house', label: 'Home', type: 'icon' },
      { icon: 'car-outline', label: 'Car', type: 'icon' },
      { icon: 'train-car', label: 'Metro', type: 'icon' },
      { icon: '🚕', label: 'Taxi', type: 'emoji' },
      { icon: '🧾', label: 'Bills', type: 'emoji' }
    ]
  },
  {
    title: 'Finance & Work',
    options: [
      { icon: 'paypal', label: 'PayPal', type: 'brand' },
      { icon: 'amazon', label: 'Amazon', type: 'brand' },
      { icon: 'apple', label: 'Apple', type: 'brand' },
      { icon: 'cash', label: 'Cash', type: 'icon' },
      { icon: 'credit-card-outline', label: 'Card', type: 'icon' },
      { icon: 'wallet-outline', label: 'Wallet', type: 'icon' }
    ]
  },
  {
    title: 'Productivity & Cloud',
    options: [
      { icon: 'github', label: 'GitHub', type: 'brand' },
      { icon: 'slack', label: 'Slack', type: 'brand' },
      { icon: 'cloud-outline', label: 'Cloud', type: 'icon' },
      { icon: 'laptop', label: 'Software', type: 'icon' },
      { icon: 'folder-outline', label: 'Storage', type: 'icon' },
      { icon: '☁️', label: 'Cloud Emoji', type: 'emoji' }
    ]
  }
];
const recurringIconChoices = recurringIconGroups.flatMap((group) => group.options);

const brandFontAwesomeMap: Record<string, string> = {
  amazon: 'amazon',
  apple: 'apple',
  github: 'github',
  google: 'google',
  microsoft: 'microsoft',
  paypal: 'paypal',
  slack: 'slack',
  spotify: 'spotify',
  youtube: 'youtube'
};

const brandColorMap: Record<string, string> = {
  amazon: '#FF9900',
  apple: '#D0D0D0',
  github: '#D0D3DA',
  google: '#4F8FF7',
  microsoft: '#7BC44A',
  paypal: '#169BD7',
  slack: '#D26AE6',
  spotify: '#1ED760',
  youtube: '#FF0000'
};

function iconChoiceFromItem(item: RecurringItem): RecurringIconChoice {
  const matched = recurringIconChoices.find((choice) => choice.type === item.type && choice.icon === item.icon);

  if (matched) {
    return matched;
  }

  if (item.type === 'emoji') {
    return {
      icon: item.icon,
      label: 'Emoji',
      type: 'emoji'
    };
  }

  return recurringIconChoices[0];
}

function renderIconChoicePreview(choice: RecurringIconChoice) {
  if (choice.type === 'emoji') {
    return (
      <Text allowFontScaling={false} style={styles.iconChoiceEmoji}>
        {choice.icon}
      </Text>
    );
  }

  if (choice.type === 'brand') {
    if (choice.icon === 'hotstar') {
      return (
        <Text allowFontScaling={false} style={styles.iconChoiceHotstar}>
          Disney+
        </Text>
      );
    }

    if (choice.icon === 'N') {
      return (
        <Text allowFontScaling={false} style={styles.iconChoiceNetflix}>
          N
        </Text>
      );
    }

    const brandName = brandFontAwesomeMap[choice.icon];

    if (brandName) {
      return <FontAwesome5 color={brandColorMap[choice.icon] ?? colors.textPrimary} name={brandName as any} size={20} />;
    }
  }

  return <MaterialCommunityIcons color={colors.textPrimary} name={choice.icon as any} size={20} />;
}

function renderCardIcon(item: RecurringItem) {
  if (item.type === 'add') {
    return (
      <Text allowFontScaling={false} style={styles.addCardPlus}>
        +
      </Text>
    );
  }

  if (item.type === 'emoji') {
    return (
      <Text allowFontScaling={false} style={styles.emojiIcon}>
        {item.icon}
      </Text>
    );
  }

  if (item.type === 'brand') {
    if (item.icon === 'hotstar') {
      return (
        <Text allowFontScaling={false} style={styles.hotstarText}>
          Disney+
        </Text>
      );
    }

    if (item.icon === 'N') {
      return (
        <Text allowFontScaling={false} style={styles.netflixText}>
          N
        </Text>
      );
    }

    const brandName = brandFontAwesomeMap[item.icon];

    if (brandName) {
      return <FontAwesome5 color={brandColorMap[item.icon] ?? colors.textPrimary} name={brandName as any} size={24} />;
    }
  }

  return <MaterialCommunityIcons color={colors.textPrimary} name={item.icon as any} size={25} />;
}

function IconPickerSections({
  onSelect,
  selectedChoice
}: {
  onSelect: (choice: RecurringIconChoice) => void;
  selectedChoice: RecurringIconChoice;
}) {
  return (
    <View style={styles.iconPickerShell}>
      <ScrollView nestedScrollEnabled style={styles.iconPickerScroll}>
        {recurringIconGroups.map((group) => (
          <View key={group.title} style={styles.iconGroupSection}>
            <Text allowFontScaling={false} style={styles.iconGroupTitle}>
              {group.title}
            </Text>
            <View style={styles.iconGroupGrid}>
              {group.options.map((choice) => (
                <Pressable
                  key={`${group.title}-${choice.type}-${choice.icon}`}
                  onPress={() => {
                    hapticSelection();
                    onSelect(choice);
                  }}
                  style={[
                    styles.iconChoiceChip,
                    selectedChoice.type === choice.type && selectedChoice.icon === choice.icon
                      ? styles.iconChoiceChipActive
                      : null
                  ]}
                >
                  {renderIconChoicePreview(choice)}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type RecurringScreenProps = {
  onRecurringPaymentStateChange?: (params: { item: RecurringItem; nextPaid: boolean }) => Promise<void>;
};

function createRecurringId(label: string, dueDay: string) {
  const normalized = `${label}-${dueDay}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalized || 'recurring'}-${Date.now().toString(36)}`;
}

export function RecurringScreen({ onRecurringPaymentStateChange }: RecurringScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 390;
  const horizontalPadding = clamp(width * 0.052, 16, 24);
  const [items, setItems] = useState<RecurringItem[]>(recurringItems);
  const [isSyncingItemId, setIsSyncingItemId] = useState<string | null>(null);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditPickerVisible, setIsEditPickerVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isEditCategoryDropdownOpen, setIsEditCategoryDropdownOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDay, setNewDueDay] = useState('');
  const [newIconChoice, setNewIconChoice] = useState<RecurringIconChoice>(recurringIconChoices[0]);
  const [editTargetId, setEditTargetId] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryLabel, setEditCategoryLabel] = useState('');
  const [editDueDay, setEditDueDay] = useState('');
  const [editIconChoice, setEditIconChoice] = useState<RecurringIconChoice>(recurringIconChoices[0]);
  const suppressNextPressItemId = useRef<string | null>(null);
  const contentWidth = width - horizontalPadding * 2;
  const gap = 12;
  const cardWidth = (contentWidth - gap * 2) / 3;
  const { leftToPay, paidSoFar, totalToPay } = useMemo(() => {
    const billItems = items.filter((item) => item.type !== 'add');
    const total = billItems.reduce((sum, item) => sum + item.amount, 0);
    const paid = billItems.reduce((sum, item) => sum + (item.paid ? item.amount : 0), 0);
    const left = Math.max(total - paid, 0);

    return {
      leftToPay: left,
      paidSoFar: paid,
      totalToPay: total
    };
  }, [items]);
  const paidRatio = totalToPay > 0 ? paidSoFar / totalToPay : 0;
  const editableItems = useMemo(() => items.filter((item) => item.type !== 'add'), [items]);
  const selectedEditItem = useMemo(
    () => editableItems.find((item) => item.id === editTargetId) ?? null,
    [editTargetId, editableItems]
  );
  const smartSuggestedEditCategory = useMemo(
    () => inferCategoryLabel((editLabel || selectedEditItem?.label || '').trim()),
    [editLabel, selectedEditItem]
  );

  async function syncRecurringPayment(item: RecurringItem, nextPaid: boolean) {
    if (!onRecurringPaymentStateChange) {
      return;
    }

    setIsSyncingItemId(item.id);

    try {
      await onRecurringPaymentStateChange({
        item,
        nextPaid
      });
    } finally {
      setIsSyncingItemId((current) => (current === item.id ? null : current));
    }
  }

  async function handleTogglePaid(item: RecurringItem) {
    if (item.type === 'add' || isSyncingItemId === item.id) {
      return;
    }

    const nextPaid = !Boolean(item.paid);
    const optimisticItem: RecurringItem = {
      ...item,
      paid: nextPaid
    };

    setItems((currentItems) =>
      currentItems.map((current) => (current.id === item.id ? optimisticItem : current))
    );

    try {
      await syncRecurringPayment(optimisticItem, nextPaid);
      hapticSuccess();
    } catch (error) {
      hapticWarning();
      setItems((currentItems) =>
        currentItems.map((current) => (current.id === item.id ? item : current))
      );
      const message = error instanceof Error ? error.message : 'Could not sync recurring payment.';
      Alert.alert('Sync failed', message);
    }
  }

  function closeAddModal() {
    hapticSoft();
    setIsAddModalVisible(false);
    setNewLabel('');
    setNewAmount('');
    setNewDueDay('');
    setNewIconChoice(recurringIconChoices[0]);
  }

  function closeEditModal() {
    hapticSoft();
    setIsEditPickerVisible(false);
    setIsEditModalVisible(false);
    setIsEditCategoryDropdownOpen(false);
  }

  function assignedCategoryForItem(item: RecurringItem) {
    return item.categoryLabel ?? inferCategoryLabel(item.label);
  }

  function fillEditForm(item: RecurringItem) {
    setEditTargetId(item.id);
    setEditLabel(item.label);
    setEditAmount(String(item.amount));
    setEditCategoryLabel(assignedCategoryForItem(item));
    setEditDueDay(item.dueDay);
    setIsEditCategoryDropdownOpen(false);
    setEditIconChoice(iconChoiceFromItem(item));
  }

  function handleAddRecurring() {
    const label = newLabel.trim();
    const dueDay = newDueDay.trim();
    const amount = Number.parseFloat(newAmount.replace(/,/g, '').trim());

    if (!label) {
      hapticWarning();
      Alert.alert('Missing name', 'Please enter recurring item name.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      hapticWarning();
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    if (!dueDay) {
      hapticWarning();
      Alert.alert('Missing due day', 'Please enter due day like 10th.');
      return;
    }

    const createdItem: RecurringItem = {
      amount: Math.round(amount * 100) / 100,
      categoryLabel: inferCategoryLabel(label),
      dueDay,
      id: createRecurringId(label, dueDay),
      icon: newIconChoice.icon,
      label,
      paid: false,
      type: newIconChoice.type
    };

    setItems((currentItems) => {
      const addIndex = currentItems.findIndex((item) => item.type === 'add');

      if (addIndex === -1) {
        return [...currentItems, createdItem];
      }

      return [...currentItems.slice(0, addIndex), createdItem, ...currentItems.slice(addIndex)];
    });

    hapticSuccess();
    closeAddModal();
  }

  function openEditModal() {
    if (!editableItems.length) {
      hapticWarning();
      Alert.alert('No recurring items', 'Add a recurring item first.');
      return;
    }

    hapticSoft();
    setIsEditPickerVisible(true);
  }

  function handleSelectEditTarget(targetId: string) {
    const targetItem = editableItems.find((item) => item.id === targetId);

    if (!targetItem) {
      return;
    }

    hapticSelection();
    fillEditForm(targetItem);
    setIsEditPickerVisible(false);
    setIsEditModalVisible(true);
  }

  function handleCardLongPress(item: RecurringItem) {
    if (item.type === 'add') {
      return;
    }

    hapticSoft();
    suppressNextPressItemId.current = item.id;
    fillEditForm(item);
    setIsEditPickerVisible(false);
    setIsEditModalVisible(true);
  }

  async function handleApplyEdit() {
    const name = editLabel.trim();
    const dueDay = editDueDay.trim();
    const category = editCategoryLabel.trim();
    const amount = Number.parseFloat(editAmount.replace(/,/g, '').trim());
    const currentTarget = editableItems.find((item) => item.id === editTargetId);

    if (!editTargetId || !currentTarget) {
      hapticWarning();
      Alert.alert('Missing item', 'Please choose item to edit.');
      return;
    }

    if (!name) {
      hapticWarning();
      Alert.alert('Missing name', 'Please enter recurring item name.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      hapticWarning();
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    if (!category) {
      hapticWarning();
      Alert.alert('Missing category', 'Please choose a category for this recurring item.');
      return;
    }

    if (!dueDay) {
      hapticWarning();
      Alert.alert('Missing due day', 'Please enter due day like 10th.');
      return;
    }

    const updatedItem: RecurringItem = {
      ...currentTarget,
      amount: Math.round(amount * 100) / 100,
      categoryLabel: category,
      dueDay,
      icon: editIconChoice.icon,
      label: name,
      type: editIconChoice.type
    };

    setItems((currentItems) =>
      currentItems.map((item) => (item.id === editTargetId ? updatedItem : item))
    );
    hapticSuccess();
    closeEditModal();

    if (!updatedItem.paid) {
      return;
    }

    try {
      await syncRecurringPayment(updatedItem, true);
    } catch (error) {
      hapticWarning();
      setItems((currentItems) =>
        currentItems.map((item) => (item.id === editTargetId ? currentTarget : item))
      );
      const message = error instanceof Error ? error.message : 'Could not sync updated recurring item.';
      Alert.alert('Sync failed', message);
    }
  }

  function handleCardPress(item: RecurringItem) {
    if (item.type === 'add') {
      hapticSoft();
      setIsAddModalVisible(true);
      return;
    }

    if (suppressNextPressItemId.current === item.id) {
      suppressNextPressItemId.current = null;
      return;
    }

    hapticSelection();
    void handleTogglePaid(item);
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: 24 + insets.bottom,
            paddingHorizontal: horizontalPadding
          }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryShell}>
          <View style={[styles.summaryCard, isCompact ? styles.summaryCardCompact : null]}>
            <View style={styles.summaryBlock}>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {formatCurrency(paidSoFar)}
              </Text>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                paid so far
              </Text>
            </View>

            <View style={styles.summaryRingWrap}>
              <View style={styles.summaryRingShell}>
                <RecurringRing paidRatio={paidRatio} size={isCompact ? 76 : 82} strokeWidth={12} />
                <View style={styles.summaryRingCenter}>
                  <Text allowFontScaling={false} numberOfLines={1} style={styles.summaryRingCenterValue}>
                    {formatCurrency(leftToPay)}
                  </Text>
                  <Text allowFontScaling={false} style={styles.summaryRingCenterLabel}>
                    left
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.summaryBlock, styles.summaryBlockRight]}>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {formatCurrency(totalToPay)}
              </Text>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                total to pay
              </Text>
            </View>
          </View>
        </View>

        <Text allowFontScaling={false} style={styles.sectionTitle}>
          This Month
        </Text>

        <View style={styles.grid}>
          {items.map((item) => {
            const isSyncing = isSyncingItemId === item.id;

            return (
              <Pressable
                delayLongPress={260}
                disabled={isSyncing}
                key={item.id}
                onLongPress={() => handleCardLongPress(item)}
                onPress={() => handleCardPress(item)}
                style={[
                  styles.itemCard,
                  {
                    width: cardWidth
                  },
                  item.type === 'add' ? styles.addCard : null,
                  item.paid ? styles.itemCardPaid : null,
                  isSyncing ? styles.itemCardSyncing : null
                ]}
              >
                {item.paid ? (
                  <View style={styles.checkmarkWrap}>
                    <Ionicons color={colors.textPrimary} name="checkmark" size={18} />
                  </View>
                ) : null}

                <View style={styles.cardContent}>
                  {renderCardIcon(item)}

                  {item.type !== 'add' ? (
                    <>
                      <Text
                        allowFontScaling={false}
                        numberOfLines={2}
                        style={[styles.cardLabel, item.label.length > 9 ? styles.cardLabelCompact : null]}
                      >
                        {item.label}
                      </Text>
                      <Text allowFontScaling={false} style={styles.cardAmount}>
                        {formatCurrency(item.amount)}
                      </Text>
                      <Text allowFontScaling={false} style={styles.cardDue}>
                        {item.dueDay}
                      </Text>
                    </>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.futureRow}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>
            In The Future
          </Text>
          <Ionicons color={colors.textPrimary} name="menu" size={26} />
        </View>

        <Pressable onPress={openEditModal} style={({ pressed }) => [styles.editButton, pressed ? styles.buttonPressed : null]}>
          <Ionicons color={colors.accentSoft} name="create-outline" size={15} />
          <Text allowFontScaling={false} style={styles.editButtonText}>
            Edit recurring values
          </Text>
        </Pressable>
      </ScrollView>

      <Modal animationType="fade" onRequestClose={closeAddModal} transparent visible={isAddModalVisible}>
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
              Add recurring item
            </Text>

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Name
            </Text>
            <TextInput
              allowFontScaling={false}
              autoCapitalize="words"
              onChangeText={setNewLabel}
              placeholder="e.g. YouTube Premium"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={newLabel}
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Amount
            </Text>
            <TextInput
              allowFontScaling={false}
              keyboardType="decimal-pad"
              onChangeText={setNewAmount}
              placeholder="e.g. 199"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={newAmount}
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Due day
            </Text>
            <TextInput
              allowFontScaling={false}
              onChangeText={setNewDueDay}
              placeholder="e.g. 10th"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={newDueDay}
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Choose icon
            </Text>
            <IconPickerSections onSelect={setNewIconChoice} selectedChoice={newIconChoice} />

            <View style={styles.modalActions}>
              <Pressable onPress={closeAddModal} style={({ pressed }) => [styles.modalCancel, pressed ? styles.buttonPressed : null]}>
                <Text allowFontScaling={false} style={styles.modalCancelText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={handleAddRecurring} style={({ pressed }) => [styles.modalPrimary, pressed ? styles.buttonPressed : null]}>
                <Text allowFontScaling={false} style={styles.modalPrimaryText}>
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsEditPickerVisible(false)}
        transparent
        visible={isEditPickerVisible}
      >
        <View style={styles.modalRoot}>
          <Pressable onPress={() => setIsEditPickerVisible(false)} style={styles.modalBackdrop} />
          <View
            style={[
              styles.modalCard,
              {
                marginHorizontal: horizontalPadding
              }
            ]}
          >
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Choose recurring item
            </Text>

            <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
              {editableItems.map((item) => (
                <Pressable
                  key={`picker-${item.id}`}
                  onPress={() => handleSelectEditTarget(item.id)}
                  style={styles.editPickerOption}
                >
                  <View style={styles.editPickerIconWrap}>{renderIconChoicePreview(iconChoiceFromItem(item))}</View>
                  <View style={styles.editPickerMain}>
                    <Text allowFontScaling={false} numberOfLines={1} style={styles.editPickerTitle}>
                      {item.label}
                    </Text>
                    <Text allowFontScaling={false} style={styles.editPickerMeta}>
                      {formatCurrency(item.amount)} • {item.dueDay}
                    </Text>
                  </View>
                  <Ionicons color={colors.textMuted} name="chevron-forward" size={15} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={closeEditModal} transparent visible={isEditModalVisible}>
        <View style={styles.modalRoot}>
          <Pressable onPress={closeEditModal} style={styles.modalBackdrop} />
          <View
            style={[
              styles.modalCard,
              {
                marginHorizontal: horizontalPadding
              }
            ]}
          >
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Edit recurring item
            </Text>

            <Text allowFontScaling={false} style={styles.fieldHint}>
              Editing: {selectedEditItem?.label ?? 'Recurring item'}
            </Text>

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Name
            </Text>
            <TextInput
              allowFontScaling={false}
              autoCapitalize="words"
              onChangeText={setEditLabel}
              placeholder="Recurring name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={editLabel}
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Category
            </Text>
            <Pressable
              onPress={() => setIsEditCategoryDropdownOpen((current) => !current)}
              style={({ pressed }) => [styles.dropdownTrigger, pressed ? styles.dropdownPressed : null]}
            >
              <Text allowFontScaling={false} numberOfLines={1} style={styles.dropdownText}>
                {editCategoryLabel || smartSuggestedEditCategory}
              </Text>
              <Ionicons
                color={colors.textSecondary}
                name={isEditCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
              />
            </Pressable>

            {isEditCategoryDropdownOpen ? (
              <View style={styles.dropdownMenu}>
                <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                  {transactionCategoryOptions.map((option) => (
                    <Pressable
                      key={option.label}
                      onPress={() => {
                        setEditCategoryLabel(option.label);
                        setIsEditCategoryDropdownOpen(false);
                      }}
                      style={[
                        styles.dropdownOption,
                        editCategoryLabel === option.label ? styles.dropdownOptionActive : null
                      ]}
                    >
                      <View style={styles.dropdownOptionRow}>
                        <Text allowFontScaling={false} style={styles.dropdownOptionEmoji}>
                          {option.icon}
                        </Text>
                        <Text allowFontScaling={false} style={styles.dropdownOptionText}>
                          {option.label}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Text allowFontScaling={false} style={styles.fieldHint}>
              Smart suggestion: {smartSuggestedEditCategory}
            </Text>

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Icon
            </Text>
            <IconPickerSections onSelect={setEditIconChoice} selectedChoice={editIconChoice} />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Amount
            </Text>
            <TextInput
              allowFontScaling={false}
              keyboardType="decimal-pad"
              onChangeText={setEditAmount}
              placeholder="Amount"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={editAmount}
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Due day
            </Text>
            <TextInput
              allowFontScaling={false}
              onChangeText={setEditDueDay}
              placeholder="e.g. 10th"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={editDueDay}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={closeEditModal} style={({ pressed }) => [styles.modalCancel, pressed ? styles.buttonPressed : null]}>
                <Text allowFontScaling={false} style={styles.modalCancelText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handleApplyEdit();
                }}
                style={({ pressed }) => [styles.modalPrimary, pressed ? styles.buttonPressed : null]}
              >
                <Text allowFontScaling={false} style={styles.modalPrimaryText}>
                  Save
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
  screen: {
    flex: 1
  },
  content: {
    paddingTop: 4
  },
  summaryShell: {
    borderRadius: radii.xl,
    marginBottom: 22,
    ...shadows.card
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 162,
    paddingHorizontal: 18,
    paddingVertical: 18
  },
  summaryCardCompact: {
    minHeight: 156,
    paddingHorizontal: 14
  },
  summaryBlock: {
    flex: 1
  },
  summaryBlockRight: {
    alignItems: 'flex-end'
  },
  summaryRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  summaryRingShell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  summaryRingCenter: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    height: 43,
    justifyContent: 'center',
    position: 'absolute',
    width: 43
  },
  summaryRingCenterValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 7.6
  },
  summaryRingCenterLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 7
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15.6
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.9,
    lineHeight: 12.5,
    marginTop: 6
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10.2,
    letterSpacing: 0.8,
    marginBottom: 14,
    textTransform: 'uppercase'
  },
  grid: {
    columnGap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12
  },
  itemCard: {
    backgroundColor: '#02182D',
    borderRadius: 18,
    minHeight: 126,
    overflow: 'hidden',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    ...shadows.card
  },
  itemCardPaid: {
    borderColor: 'rgba(87, 171, 255, 0.5)'
  },
  itemCardSyncing: {
    opacity: 0.62
  },
  addCard: {
    justifyContent: 'center'
  },
  checkmarkWrap: {
    alignItems: 'center',
    position: 'absolute',
    right: 9,
    top: 9,
    zIndex: 1
  },
  cardContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 14
  },
  emojiIcon: {
    fontSize: 27,
    marginBottom: 8
  },
  netflixText: {
    color: '#E50914',
    fontFamily: fonts.bold,
    fontSize: 28,
    marginBottom: 8
  },
  hotstarText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 9,
    marginBottom: 10
  },
  cardLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 8.6,
    lineHeight: 10.8,
    marginBottom: 7,
    minHeight: 22,
    textAlign: 'center'
  },
  cardLabelCompact: {
    fontSize: 7.8
  },
  cardAmount: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 8.7,
    marginBottom: 4
  },
  cardDue: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 7.2
  },
  addCardPlus: {
    color: colors.textSecondary,
    fontFamily: fonts.light,
    fontSize: 34
  },
  futureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingBottom: 6
  },
  editButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48
  },
  editButtonText: {
    color: colors.accentSoft,
    fontFamily: fonts.semiBold,
    fontSize: 11.2,
    marginLeft: 6,
    textTransform: 'uppercase'
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 8, 18, 0.72)'
  },
  modalCard: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    width: '100%'
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    marginBottom: 8
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 10.6,
    marginBottom: 6,
    marginTop: 8
  },
  fieldHint: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10.4,
    marginTop: 6
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    minHeight: 42,
    paddingHorizontal: 12
  },
  iconPickerShell: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
    maxHeight: 214
  },
  iconPickerScroll: {
    maxHeight: 214,
    paddingHorizontal: 8
  },
  iconGroupSection: {
    paddingBottom: 6,
    paddingTop: 8
  },
  iconGroupTitle: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10,
    marginBottom: 7
  },
  iconGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  iconChoiceChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginBottom: 8,
    marginRight: 8,
    width: 50
  },
  iconChoiceChipActive: {
    borderColor: colors.accentSoft,
    transform: [{ scale: 1.04 }]
  },
  iconChoiceEmoji: {
    fontSize: 18
  },
  iconChoiceHotstar: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 7.4
  },
  iconChoiceNetflix: {
    color: '#E50914',
    fontFamily: fonts.bold,
    fontSize: 20
  },
  dropdownTrigger: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 42,
    paddingHorizontal: 12
  },
  dropdownPressed: {
    opacity: 0.86
  },
  dropdownText: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12
  },
  dropdownMenu: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6
  },
  dropdownScroll: {
    maxHeight: 165
  },
  dropdownOption: {
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12
  },
  dropdownOptionRow: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  dropdownOptionEmoji: {
    fontSize: 13.5,
    marginRight: 8
  },
  dropdownOptionActive: {
    backgroundColor: colors.accentMuted
  },
  dropdownOptionText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 11.5
  },
  editPickerOption: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 8,
    minHeight: 52,
    paddingHorizontal: 10
  },
  editPickerIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 30
  },
  editPickerMain: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8
  },
  editPickerTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 12.6
  },
  editPickerMeta: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10.2,
    marginTop: 2
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 14
  },
  modalCancel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12
  },
  modalPrimary: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 10,
    minHeight: 42
  },
  modalPrimaryText: {
    color: colors.background,
    fontFamily: fonts.semiBold,
    fontSize: 12.3
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }]
  }
});
