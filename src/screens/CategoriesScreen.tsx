import { Ionicons } from '@expo/vector-icons';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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

import { BudgetMixRing, type BudgetMixSegment } from '../components/charts/BudgetMixRing';
import { categoryBudgetItems, type CategoryBudgetItem } from '../data/categories';
import { addCategoryWithBudget, loadCategoryBudgetItems, rebalanceCategoryBudget } from '../lib/categories';
import { loadCurrentMonthCategorySpendMap } from '../lib/derived';
import { hapticSelection, hapticSoft, hapticSuccess, hapticWarning } from '../lib/haptics';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

const parentChoices = [
  { label: 'Top level', value: 'none' as const },
  { label: 'Food & Drink', value: 'Food & Drink' as const },
  { label: 'Shopping', value: 'Shopping' as const }
];

const iconChoices = [
  'pricetag-outline',
  'restaurant-outline',
  'nutrition-outline',
  'cafe-outline',
  'car-sport-outline',
  'shirt-outline',
  'bag-handle-outline',
  'boat-outline',
  'film-outline',
  'construct-outline',
  'tv-outline',
  'medkit-outline',
  'barbell-outline',
  'gift-outline',
  'home-outline',
  'phone-portrait-outline',
  'airplane-outline',
  'wallet-outline',
  'cart-outline',
  'flash-outline'
] as const;
const colorChoices = [
  '#52D273',
  '#8BEA57',
  '#2CC9D6',
  '#7C6BFF',
  '#5FA3FF',
  '#A36BFF',
  '#FF6B9D',
  '#FF8A3D',
  '#3E71FF',
  '#FF5F5F',
  '#F07B52',
  '#9AA9BD',
  '#4BD6B0',
  '#27A2F2',
  '#C77DFF',
  '#6BCB77',
  '#FFC145',
  '#00C2A8',
  '#F07DEA',
  '#FF9671',
  '#4ECDC4',
  '#778BEB',
  '#5AA9E6',
  '#E76F51',
  '#2A9D8F',
  '#D65DB1',
  '#00A5CF'
];

const categoryAliases: Record<string, string> = {
  shop: 'Shops',
  shops: 'Shops',
  travel: 'Car & Transport',
  restaurant: 'Restaurant',
  restaurants: 'Restaurant'
};

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase();
}

function toneFromRatio(ratio: number): CategoryBudgetItem['tone'] {
  if (ratio > 1) {
    return 'red';
  }

  if (ratio >= 0.85) {
    return 'orange';
  }

  if (ratio >= 0.65) {
    return 'yellow';
  }

  return 'green';
}

const BudgetRow = memo(function BudgetRow({
  item,
  onToggleGroup,
  isGroupExpanded,
  spentWidth,
  budgetColumnWidth,
  budgetValueWidth,
  width
}: {
  item: CategoryBudgetItem;
  isGroupExpanded?: boolean;
  spentWidth: number;
  budgetColumnWidth: number;
  budgetValueWidth: number;
  onToggleGroup?: () => void;
  width: number;
}) {
  const isNarrow = width < 390;
  const ratio = Math.min(item.spent / Math.max(item.budget, 1), 1);
  const progress = useRef(new Animated.Value(ratio)).current;
  const barColor = item.spent > item.budget ? colors.danger : item.accent;
  const indentation = item.level === 1 ? 28 : 0;
  const itemIconSize = item.level === 1 ? 17 : 16;
  const shouldToggle = item.isGroup && typeof onToggleGroup === 'function';
  const iconName = shouldToggle ? (isGroupExpanded ? 'caret-up' : 'caret-down') : item.icon;
  const iconColor = item.isGroup ? colors.textMuted : colors.textPrimary;
  const animatedWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  useEffect(() => {
    Animated.timing(progress, {
      duration: 190,
      toValue: ratio,
      useNativeDriver: false
    }).start();
  }, [progress, ratio]);

  return (
    <View style={styles.row}>
      <View style={[styles.nameColumn, { paddingLeft: indentation }]}>
        <View style={[styles.colorDot, { backgroundColor: item.accent }]} />
        <Pressable
          disabled={!shouldToggle}
          onPress={onToggleGroup}
          style={({ pressed }) => [
            styles.namePill,
            item.isGroup ? styles.groupPill : null,
            shouldToggle && pressed ? styles.groupPillPressed : null
          ]}
        >
          <Ionicons color={iconColor} name={iconName as any} size={item.isGroup ? 14 : itemIconSize} />
          <Text
            adjustsFontSizeToFit
            allowFontScaling={false}
            minimumFontScale={0.72}
            numberOfLines={1}
            style={styles.nameText}
          >
            {item.name}
          </Text>
        </Pressable>
      </View>

      <Text
        allowFontScaling={false}
        style={[styles.spentValue, { width: spentWidth }, isNarrow ? styles.valueNarrow : null]}
      >
        {formatCurrency(item.spent)}
      </Text>

      <View style={[styles.budgetColumn, { width: budgetColumnWidth }]}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { backgroundColor: barColor, width: animatedWidth }]} />
        </View>
        <Text
          allowFontScaling={false}
          style={[styles.budgetValue, { width: budgetValueWidth }, isNarrow ? styles.valueNarrow : null]}
        >
          {formatCurrency(item.budget)}
        </Text>
      </View>
    </View>
  );
});

type CategoriesScreenProps = {
  onDataMutation?: () => void;
  optimisticCategoryDeltas?: Record<string, number>;
  refreshToken: number;
  userId: string;
};

export function CategoriesScreen({
  onDataMutation,
  optimisticCategoryDeltas = {},
  refreshToken,
  userId
}: CategoriesScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = clamp(width * 0.055, 16, 26);
  const isNarrow = width < 390;
  const contentWidth = width - horizontalPadding * 2;
  const spentWidth = isNarrow ? 56 : 60;
  const budgetValueWidth = isNarrow ? 46 : 50;
  const budgetColumnWidth = isNarrow ? 128 : 138;

  const [categoryItems, setCategoryItems] = useState<CategoryBudgetItem[]>(categoryBudgetItems);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [liveSpentByCategory, setLiveSpentByCategory] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Food & Drink': false,
    Shopping: false
  });

  const [isAddCategoryVisible, setIsAddCategoryVisible] = useState(false);
  const [newCategoryParent, setNewCategoryParent] = useState<(typeof parentChoices)[number]['value']>('none');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBudget, setNewCategoryBudget] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<(typeof iconChoices)[number]>(iconChoices[0]);
  const [newCategoryColor, setNewCategoryColor] = useState(colorChoices[0]);

  const [isRebalanceVisible, setIsRebalanceVisible] = useState(false);
  const [isRebalanceDropdownOpen, setIsRebalanceDropdownOpen] = useState(false);
  const [rebalanceCategoryName, setRebalanceCategoryName] = useState('');
  const [rebalanceBudget, setRebalanceBudget] = useState('');
  const previousMetricsSignature = useRef('');
  const hasBootstrappedRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!hasBootstrappedRef.current) {
        setIsBootstrapping(true);
      }

      try {
        const [storedItems, spentMap] = await Promise.all([
          loadCategoryBudgetItems(userId),
          loadCurrentMonthCategorySpendMap(userId)
        ]);

        if (!active) {
          return;
        }

        setCategoryItems(storedItems.length ? storedItems : categoryBudgetItems);
        setLiveSpentByCategory(spentMap);
      } catch (error) {
        console.warn('[categories] failed to load persisted category view', error);

        if (active) {
          setCategoryItems(categoryBudgetItems);
          setLiveSpentByCategory({});
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
          hasBootstrappedRef.current = true;
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [refreshToken, userId]);

  const canonicalByNormalizedName = useMemo(() => {
    const lookup: Record<string, string> = {};

    categoryItems.forEach((item) => {
      lookup[normalizeCategoryName(item.name)] = item.name;
    });

    Object.entries(categoryAliases).forEach(([alias, canonical]) => {
      lookup[normalizeCategoryName(alias)] = canonical;
    });

    return lookup;
  }, [categoryItems]);

  const spentByCategory = useMemo(() => {
    const totals: Record<string, number> = {};

    Object.entries(liveSpentByCategory).forEach(([name, spent]) => {
      const canonicalName = canonicalByNormalizedName[normalizeCategoryName(name)] ?? name;
      totals[canonicalName] = (totals[canonicalName] ?? 0) + spent;
    });

    Object.entries(optimisticCategoryDeltas).forEach(([name, delta]) => {
      const canonicalName = canonicalByNormalizedName[normalizeCategoryName(name)] ?? name;
      totals[canonicalName] = Math.round(((totals[canonicalName] ?? 0) + delta) * 100) / 100;
    });

    return totals;
  }, [canonicalByNormalizedName, liveSpentByCategory, optimisticCategoryDeltas]);

  const categoryItemsWithLiveSpent = useMemo(() => {
    const childNamesByGroup = new Map<string, string[]>();
    let activeGroup: string | null = null;

    categoryItems.forEach((item) => {
      if (item.isGroup) {
        activeGroup = item.name;
        childNamesByGroup.set(item.name, []);
        return;
      }

      if (item.level === 1 && activeGroup) {
        childNamesByGroup.get(activeGroup)?.push(item.name);
        return;
      }

      activeGroup = null;
    });

    return categoryItems.map((item) => {
      let spent = spentByCategory[item.name] ?? item.spent;

      if (item.isGroup) {
        const children = childNamesByGroup.get(item.name) ?? [];
        const childrenSpent = children.reduce((sum, childName) => sum + (spentByCategory[childName] ?? 0), 0);
        spent += childrenSpent;
      }

      const roundedSpent = Math.round(spent * 100) / 100;
      const ratio = item.budget > 0 ? roundedSpent / item.budget : 0;

      return {
        ...item,
        spent: roundedSpent,
        tone: toneFromRatio(ratio)
      };
    });
  }, [categoryItems, spentByCategory]);

  const categoryMetricsSignature = useMemo(
    () =>
      categoryItemsWithLiveSpent
        .map((item) => `${item.name}:${item.spent}:${item.budget}:${item.tone}`)
        .join('|'),
    [categoryItemsWithLiveSpent]
  );

  useEffect(() => {
    if (!previousMetricsSignature.current) {
      previousMetricsSignature.current = categoryMetricsSignature;
      return;
    }

    if (previousMetricsSignature.current !== categoryMetricsSignature) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      previousMetricsSignature.current = categoryMetricsSignature;
    }
  }, [categoryMetricsSignature]);

  const visibleCategoryItems = useMemo(() => {
    const visible: CategoryBudgetItem[] = [];
    let activeGroupName: string | null = null;

    categoryItemsWithLiveSpent.forEach((item) => {
      if (item.isGroup) {
        visible.push(item);
        activeGroupName = item.name;
        return;
      }

      if (item.level === 1 && activeGroupName) {
        if (expandedGroups[activeGroupName]) {
          visible.push(item);
        }
        return;
      }

      activeGroupName = null;
      visible.push(item);
    });

    return visible;
  }, [categoryItemsWithLiveSpent, expandedGroups]);

  const liveSpentSummary = useMemo(() => {
    const total = categoryItemsWithLiveSpent.reduce((sum, item) => {
      if (item.level === 1) {
        return sum;
      }

      return sum + item.spent;
    }, 0);

    return Math.round(total * 100) / 100;
  }, [categoryItemsWithLiveSpent]);

  const totalBudgetSummary = useMemo(() => {
    const total = categoryItemsWithLiveSpent.reduce((sum, item) => {
      if (item.level === 1) {
        return sum;
      }

      return sum + item.budget;
    }, 0);

    return Math.round(total * 100) / 100;
  }, [categoryItemsWithLiveSpent]);

  const topLevelCategoryItems = useMemo(
    () => categoryItemsWithLiveSpent.filter((item) => item.level !== 1),
    [categoryItemsWithLiveSpent]
  );

  const ringSegments = useMemo<BudgetMixSegment[]>(() => {
    const fillRatio = totalBudgetSummary > 0 ? Math.min(liveSpentSummary / totalBudgetSummary, 1) : 0;
    const topLevelSpentItems = topLevelCategoryItems.filter((item) => item.spent > 0);
    const spentTotalForRing = topLevelSpentItems.reduce((sum, item) => sum + item.spent, 0);

    if (fillRatio <= 0 || spentTotalForRing <= 0) {
      return [];
    }

    return topLevelSpentItems
      .slice()
      .sort((a, b) => b.spent - a.spent)
      .map((item) => ({
        color: item.accent,
        ratio: (item.spent / spentTotalForRing) * fillRatio
      }));
  }, [liveSpentSummary, topLevelCategoryItems, totalBudgetSummary]);

  const spentPercent = useMemo(() => {
    if (totalBudgetSummary <= 0) {
      return 0;
    }

    return (liveSpentSummary / totalBudgetSummary) * 100;
  }, [liveSpentSummary, totalBudgetSummary]);

  const rebalanceOptions = useMemo(
    () => categoryItems.filter((item) => !item.isGroup).map((item) => item.name),
    [categoryItems]
  );

  function handleToggleGroup(groupName: string) {
    hapticSelection();
    setExpandedGroups((current) => ({
      ...current,
      [groupName]: !current[groupName]
    }));
  }

  function resetAddCategoryForm() {
    setNewCategoryParent('none');
    setNewCategoryName('');
    setNewCategoryBudget('');
    setNewCategoryIcon(iconChoices[0]);
    setNewCategoryColor(colorChoices[0]);
  }

  function closeAddCategoryModal() {
    hapticSoft();
    setIsAddCategoryVisible(false);
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    const parsedBudget = Number.parseFloat(newCategoryBudget.replace(/,/g, '').trim());

    if (!name) {
      hapticWarning();
      Alert.alert('Missing category name', 'Please enter a category name.');
      return;
    }

    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      hapticWarning();
      Alert.alert('Invalid budget', 'Please enter a valid budget amount greater than 0.');
      return;
    }

    const normalizedName = normalizeCategoryName(name);
    const duplicate = categoryItems.some((item) => normalizeCategoryName(item.name) === normalizedName);

    if (duplicate) {
      hapticWarning();
      Alert.alert('Duplicate category', 'This category already exists.');
      return;
    }

    try {
      const roundedBudget = Math.round(parsedBudget * 100) / 100;
      const newItem = await addCategoryWithBudget({
        accentColor: newCategoryColor,
        budget: roundedBudget,
        icon: newCategoryIcon,
        name,
        parentCategoryName: newCategoryParent === 'none' ? undefined : newCategoryParent,
        userId
      });

      setCategoryItems((current) => {
        if (newCategoryParent === 'none') {
          return [...current, newItem];
        }

        const parentIndex = current.findIndex((item) => item.isGroup && item.name === newCategoryParent);

        if (parentIndex === -1) {
          return [...current, { ...newItem, level: undefined }];
        }

        let insertIndex = parentIndex + 1;

        while (insertIndex < current.length && current[insertIndex].level === 1) {
          insertIndex += 1;
        }

        return [...current.slice(0, insertIndex), newItem, ...current.slice(insertIndex)];
      });

      if (newCategoryParent !== 'none') {
        setExpandedGroups((current) => ({
          ...current,
          [newCategoryParent]: true
        }));
      }

      onDataMutation?.();
      hapticSuccess();
      closeAddCategoryModal();
      resetAddCategoryForm();
    } catch (error) {
      hapticWarning();
      const message = error instanceof Error ? error.message : 'Could not add category right now.';
      Alert.alert('Add failed', message);
    }
  }

  function openRebalanceModal() {
    if (!rebalanceOptions.length) {
      hapticWarning();
      Alert.alert('No categories', 'Add a category first before rebalancing.');
      return;
    }

    const initialCategory = rebalanceCategoryName && rebalanceOptions.includes(rebalanceCategoryName)
      ? rebalanceCategoryName
      : rebalanceOptions[0];
    const currentBudget = categoryItems.find((item) => item.name === initialCategory)?.budget ?? 0;

    setRebalanceCategoryName(initialCategory);
    setRebalanceBudget(String(currentBudget));
    setIsRebalanceDropdownOpen(false);
    hapticSoft();
    setIsRebalanceVisible(true);
  }

  function closeRebalanceModal() {
    hapticSoft();
    setIsRebalanceVisible(false);
    setIsRebalanceDropdownOpen(false);
  }

  async function handleApplyRebalance() {
    if (!rebalanceCategoryName) {
      hapticWarning();
      Alert.alert('Missing category', 'Please choose a category to rebalance.');
      return;
    }

    const parsedBudget = Number.parseFloat(rebalanceBudget.replace(/,/g, '').trim());

    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      hapticWarning();
      Alert.alert('Invalid budget', 'Please enter a valid budget amount.');
      return;
    }

    try {
      const roundedBudget = Math.round(parsedBudget * 100) / 100;
      const persistedBudget = await rebalanceCategoryBudget({
        budget: roundedBudget,
        categoryName: rebalanceCategoryName,
        userId
      });

      setCategoryItems((current) =>
        current.map((item) =>
          item.name === rebalanceCategoryName
            ? {
                ...item,
                budget: persistedBudget
              }
            : item
        )
      );
      onDataMutation?.();
      hapticSuccess();
      closeRebalanceModal();
    } catch (error) {
      hapticWarning();
      const message =
        error instanceof Error ? error.message : 'Could not rebalance this category right now.';
      Alert.alert('Rebalance failed', message);
    }
  }

  return (
    <View style={styles.flex}>
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
        {isBootstrapping ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.accentSoft} size="small" />
            <Text allowFontScaling={false} style={styles.loadingText}>
              Syncing categories...
            </Text>
          </View>
        ) : null}

        <View style={styles.summaryShell}>
          <View style={[styles.summaryCard, isNarrow ? styles.summaryCardNarrow : null]}>
            <View style={styles.summaryBlock}>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {formatCurrency(liveSpentSummary)}
              </Text>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                spent so far
              </Text>
            </View>

            <View style={styles.summaryRingWrap}>
              <View style={styles.ringShell}>
                <BudgetMixRing
                  segments={ringSegments}
                  size={isNarrow ? 74 : 82}
                  strokeWidth={isNarrow ? 11 : 12}
                />
                <View style={styles.ringCenter}>
                  <Text allowFontScaling={false} style={styles.ringCenterValue}>
                    {Math.round(spentPercent)}%
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryBlock}>
              <Text allowFontScaling={false} style={styles.summaryValue}>
                {formatCurrency(totalBudgetSummary)}
              </Text>
              <Text allowFontScaling={false} style={styles.summaryLabel}>
                total budget
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tableHeader}>
          <View style={styles.nameColumn} />
          <Text allowFontScaling={false} style={[styles.tableHeaderText, { width: spentWidth }]}>
            SPENT
          </Text>
          <Text allowFontScaling={false} style={[styles.tableHeaderText, { width: budgetColumnWidth }]}>
            BUDGET
          </Text>
        </View>

        {visibleCategoryItems.map((item) => (
          <BudgetRow
            key={`${item.name}-${item.level ?? 0}`}
            budgetColumnWidth={budgetColumnWidth}
            budgetValueWidth={budgetValueWidth}
            isGroupExpanded={item.isGroup ? expandedGroups[item.name] : undefined}
            item={item}
            onToggleGroup={item.isGroup ? () => handleToggleGroup(item.name) : undefined}
            spentWidth={spentWidth}
            width={contentWidth}
          />
        ))}

        <View style={[styles.footerActions, width < 372 ? styles.footerActionsStack : null]}>
          <Pressable
            onPress={() => {
              hapticSoft();
              setIsAddCategoryVisible(true);
            }}
            style={({ pressed }) => [
              styles.actionButtonShell,
              width < 372 ? styles.actionButtonShellStack : null,
              pressed ? styles.actionPressed : null
            ]}
          >
            <Text allowFontScaling={false} style={styles.actionButtonText}>
              Add a Category
            </Text>
          </Pressable>

          <Pressable
            onPress={openRebalanceModal}
            style={({ pressed }) => [
              styles.actionButtonShell,
              width < 372 ? styles.actionButtonShellStack : null,
              pressed ? styles.actionPressed : null
            ]}
          >
            <Text allowFontScaling={false} style={styles.actionButtonText}>
              Rebalance Budget
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal animationType="fade" onRequestClose={closeAddCategoryModal} transparent visible={isAddCategoryVisible}>
        <View style={styles.modalRoot}>
          <Pressable onPress={closeAddCategoryModal} style={styles.modalBackdrop} />
          <View
            style={[
              styles.modalCard,
              {
                marginHorizontal: horizontalPadding
              }
            ]}
          >
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Add a Category
            </Text>

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Category type
            </Text>
            <View style={styles.choiceRow}>
              {parentChoices.map((choice) => (
                <Pressable
                  key={choice.value}
                  onPress={() => {
                    hapticSelection();
                    setNewCategoryParent(choice.value);
                  }}
                  style={[
                    styles.choiceChip,
                    newCategoryParent === choice.value ? styles.choiceChipActive : null
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[
                      styles.choiceChipText,
                      newCategoryParent === choice.value ? styles.choiceChipTextActive : null
                    ]}
                  >
                    {choice.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Category name
            </Text>
            <TextInput
              allowFontScaling={false}
              autoCapitalize="words"
              onChangeText={setNewCategoryName}
              placeholder="Type category name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={newCategoryName}
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Monthly budget
            </Text>
            <TextInput
              allowFontScaling={false}
              keyboardType="decimal-pad"
              onChangeText={setNewCategoryBudget}
              placeholder="e.g. 1200"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={newCategoryBudget}
            />

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Choose icon
            </Text>
            <View style={styles.iconGrid}>
              {iconChoices.map((iconName) => (
                <Pressable
                  key={iconName}
                  onPress={() => {
                    hapticSelection();
                    setNewCategoryIcon(iconName);
                  }}
                  style={[styles.iconChip, newCategoryIcon === iconName ? styles.iconChipActive : null]}
                >
                  <Ionicons
                    color={newCategoryIcon === iconName ? colors.accentSoft : colors.textSecondary}
                    name={iconName}
                    size={18}
                  />
                </Pressable>
              ))}
            </View>

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Choose color
            </Text>
            <View style={styles.colorGrid}>
              {colorChoices.map((accent) => (
                <Pressable
                  key={accent}
                  onPress={() => {
                    hapticSelection();
                    setNewCategoryColor(accent);
                  }}
                  style={[
                    styles.colorChip,
                    newCategoryColor === accent ? styles.colorChipActive : null
                  ]}
                >
                  <View style={[styles.colorCircle, { backgroundColor: accent }]} />
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={closeAddCategoryModal} style={styles.cancelButton}>
                <Text allowFontScaling={false} style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handleAddCategory();
                }}
                style={styles.saveButton}
              >
                <Text allowFontScaling={false} style={styles.saveButtonText}>
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" onRequestClose={closeRebalanceModal} transparent visible={isRebalanceVisible}>
        <View style={styles.modalRoot}>
          <Pressable onPress={closeRebalanceModal} style={styles.modalBackdrop} />
          <View
            style={[
              styles.modalCard,
              {
                marginHorizontal: horizontalPadding
              }
            ]}
          >
            <Text allowFontScaling={false} style={styles.modalTitle}>
              Rebalance Budget
            </Text>

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              Select category
            </Text>

            <Pressable
              onPress={() => {
                hapticSelection();
                setIsRebalanceDropdownOpen((current) => !current);
              }}
              style={({ pressed }) => [styles.dropdownTrigger, pressed ? styles.dropdownPressed : null]}
            >
              <Text allowFontScaling={false} numberOfLines={1} style={styles.dropdownText}>
                {rebalanceCategoryName || 'Choose category'}
              </Text>
              <Ionicons
                color={colors.textSecondary}
                name={isRebalanceDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
              />
            </Pressable>

            {isRebalanceDropdownOpen ? (
              <View style={styles.dropdownMenu}>
                <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                  {rebalanceOptions.map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => {
                        hapticSelection();
                        setRebalanceCategoryName(name);
                        const matchedBudget = categoryItems.find((item) => item.name === name)?.budget ?? 0;
                        setRebalanceBudget(String(matchedBudget));
                        setIsRebalanceDropdownOpen(false);
                      }}
                      style={[
                        styles.dropdownOption,
                        rebalanceCategoryName === name ? styles.dropdownOptionActive : null
                      ]}
                    >
                      <Text allowFontScaling={false} style={styles.dropdownOptionText}>
                        {name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Text allowFontScaling={false} style={styles.fieldLabel}>
              New budget amount
            </Text>
            <TextInput
              allowFontScaling={false}
              keyboardType="decimal-pad"
              onChangeText={setRebalanceBudget}
              placeholder="e.g. 2000"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={rebalanceBudget}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={closeRebalanceModal} style={styles.cancelButton}>
                <Text allowFontScaling={false} style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handleApplyRebalance();
                }}
                style={styles.saveButton}
              >
                <Text allowFontScaling={false} style={styles.saveButtonText}>
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
  flex: {
    flex: 1
  },
  content: {
    paddingTop: 4
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
    minHeight: 164,
    paddingHorizontal: 14,
    paddingVertical: 18
  },
  summaryCardNarrow: {
    minHeight: 154,
    paddingHorizontal: 12
  },
  summaryBlock: {
    flex: 1
  },
  summaryRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  ringShell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  ringCenter: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    width: 38
  },
  ringCenterValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 9.8
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15.5
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 8.8,
    lineHeight: 12,
    marginTop: 6
  },
  tableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4
  },
  tableHeaderText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 9.8,
    letterSpacing: 0.8,
    textAlign: 'right',
    width: 84
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10
  },
  nameColumn: {
    alignItems: 'center',
    flex: 1.9,
    flexDirection: 'row',
    minWidth: 0,
    paddingRight: 8
  },
  colorDot: {
    borderColor: 'rgba(255, 255, 255, 0.26)',
    borderRadius: 9,
    borderWidth: 1,
    height: 16,
    marginRight: 8,
    width: 16
  },
  namePill: {
    alignItems: 'center',
    backgroundColor: '#123764',
    borderRadius: 999,
    flexDirection: 'row',
    maxWidth: '100%',
    minHeight: 33,
    paddingHorizontal: 10
  },
  groupPill: {
    paddingRight: 14
  },
  groupPillPressed: {
    opacity: 0.84
  },
  nameText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 8.5,
    marginLeft: 6,
    textTransform: 'uppercase'
  },
  spentValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 10.6,
    textAlign: 'right'
  },
  budgetColumn: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 8
  },
  progressTrack: {
    backgroundColor: '#E5E2E5',
    borderRadius: 999,
    flex: 1,
    height: 12,
    overflow: 'hidden'
  },
  progressFill: {
    borderRadius: 999,
    height: '100%'
  },
  budgetValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 10.6,
    marginLeft: 7,
    textAlign: 'right'
  },
  valueNarrow: {
    fontSize: 10.2
  },
  footerActions: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20
  },
  footerActionsStack: {
    flexDirection: 'column'
  },
  actionButtonShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 56,
    ...shadows.card
  },
  actionButtonShellStack: {
    width: '100%'
  },
  actionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  actionButtonText: {
    color: colors.accent,
    fontFamily: fonts.semiBold,
    fontSize: 11.8,
    textTransform: 'uppercase'
  },
  modalRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(1, 7, 17, 0.74)'
  },
  modalCard: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '84%',
    padding: 14,
    width: '100%'
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    marginBottom: 10
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 10.8,
    marginBottom: 7,
    marginTop: 8
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 13,
    minHeight: 44,
    paddingHorizontal: 12
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8
  },
  choiceChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 8
  },
  choiceChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentDeep
  },
  choiceChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 10
  },
  choiceChipTextActive: {
    color: colors.accentSoft
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  iconChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  iconChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentDeep,
    borderWidth: 1.5
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  colorChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  colorChipActive: {
    borderColor: colors.accentSoft,
    borderWidth: 1.5
  },
  colorCircle: {
    borderRadius: 6,
    height: 18,
    width: 18
  },
  dropdownTrigger: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 12
  },
  dropdownPressed: {
    opacity: 0.84
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
    maxHeight: 168
  },
  dropdownOption: {
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12
  },
  dropdownOptionActive: {
    backgroundColor: colors.accentMuted
  },
  dropdownOptionText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 11.6
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 14
  },
  cancelButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 10,
    minHeight: 42
  },
  saveButtonText: {
    color: colors.background,
    fontFamily: fonts.semiBold,
    fontSize: 12.4
  }
});
