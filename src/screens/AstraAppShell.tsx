import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clamp, colors, fonts, radii } from '../theme';
import { AccountsScreen } from './AccountsScreen';
import { CategoriesScreen } from './CategoriesScreen';
import { DashboardScreen } from './DashboardScreen';
import { InvestmentsScreen } from './InvestmentsScreen';
import { RecurringScreen } from './RecurringScreen';
import { TransactionsScreen } from './TransactionsScreen';

const tabs = ['Accounts', 'Investments', 'Transactions', 'Dashboard', 'Categories', 'Recurring'] as const;
const initialTab = 'Dashboard' as const;
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

type Tab = (typeof tabs)[number];

export function AstraAppShell() {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
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

  const pagerPageScrollHandler = useMemo(
    () =>
      Animated.event([{ nativeEvent: { offset: pageOffset, position: pagePosition } }], {
        useNativeDriver: false
      }),
    [pageOffset, pagePosition]
  );

  function handleTabPress(tab: Tab) {
    const index = tabs.indexOf(tab);
    setActiveTab(tab);
    pagerRef.current?.setPage(index);
  }

  function handlePageSelected(event: PagerViewOnPageSelectedEvent) {
    const nextIndex = event.nativeEvent.position;
    const nextTab = tabs[nextIndex];

    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }

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
            <Pressable style={styles.headerIconButton}>
              <Ionicons color={colors.accentSoft} name="settings-sharp" size={22} />
            </Pressable>
            <Pressable style={styles.headerIconButton}>
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
          <AnimatedPagerView
            initialPage={tabs.indexOf(initialTab)}
            onPageScroll={pagerPageScrollHandler}
            onPageSelected={handlePageSelected}
            ref={pagerRef}
            style={styles.pager}
          >
            <View collapsable={false} style={styles.screenPage}>
              <AccountsScreen />
            </View>

            <View collapsable={false} style={styles.screenPage}>
              <InvestmentsScreen />
            </View>

            <View collapsable={false} style={styles.screenPage}>
              <TransactionsScreen />
            </View>

            <View collapsable={false} style={styles.screenPage}>
              <DashboardScreen />
            </View>

            <View collapsable={false} style={styles.screenPage}>
              <CategoriesScreen />
            </View>

            <View collapsable={false} style={styles.screenPage}>
              <RecurringScreen />
            </View>
          </AnimatedPagerView>
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38
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
    opacity: 0.82
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
