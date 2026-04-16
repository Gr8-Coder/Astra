import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryBudgetItems } from '../data/categories';
import { type TransactionGroup } from '../data/transactions';
import { type AgentActionTarget, agentLineup, buildAgentEngineResult, type AgentInsight } from '../lib/agents';
import {
  ASTRA_AGENT_SYSTEM_PROMPT_V1,
  ensureAstraAgentReady,
  loadAstraAgentProfileStats,
  type AgentProfileStats
} from '../lib/agentLearning';
import { loadCategoryBudgetItems } from '../lib/categories';
import { loadCurrentMonthCategorySpendMap } from '../lib/derived';
import { hapticSelection, hapticSoft } from '../lib/haptics';
import { clamp, colors, fonts, formatCurrency, radii, shadows } from '../theme';

type AgentsScreenProps = {
  onNavigateToTab?: (target: AgentActionTarget) => void;
  refreshToken: number;
  transactionGroups: TransactionGroup[];
  userId: string;
};

function severityColor(severity: AgentInsight['severity']) {
  if (severity === 'critical') {
    return '#FF5A5A';
  }

  if (severity === 'warning') {
    return colors.warning;
  }

  if (severity === 'good') {
    return colors.positive;
  }

  return colors.accentSoft;
}

function severityLabel(severity: AgentInsight['severity']) {
  if (severity === 'critical') {
    return 'Critical';
  }

  if (severity === 'warning') {
    return 'Attention';
  }

  if (severity === 'good') {
    return 'Healthy';
  }

  return 'Insight';
}

function statusColor(status: (typeof agentLineup)[number]['status']) {
  if (status === 'live') {
    return colors.positive;
  }

  if (status === 'learning') {
    return colors.warning;
  }

  return colors.textMuted;
}

export function AgentsScreen({
  onNavigateToTab,
  refreshToken,
  transactionGroups,
  userId
}: AgentsScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = clamp(width * 0.052, 16, 24);
  const [loading, setLoading] = useState(false);
  const [errorHint, setErrorHint] = useState('');
  const [profileStats, setProfileStats] = useState<AgentProfileStats | null>(null);
  const [engineResult, setEngineResult] = useState(() =>
    buildAgentEngineResult({
      categoryBudgetItems,
      spentByCategory: {},
      transactionGroups
    })
  );

  const signature = useMemo(
    () =>
      transactionGroups
        .map((group) => `${group.label}:${group.transactions.map((item) => `${item.merchant}-${item.amount}`).join(',')}`)
        .join('|'),
    [transactionGroups]
  );
  const promptPreview = useMemo(() => {
    const compact = ASTRA_AGENT_SYSTEM_PROMPT_V1.replace(/\s+/g, ' ').trim();
    return compact.slice(0, 148);
  }, []);

  useEffect(() => {
    let active = true;

    async function refreshAgents() {
      setLoading(true);

      try {
        const [budgetItems, spentByCategory, stats] = await Promise.all([
          loadCategoryBudgetItems(userId),
          loadCurrentMonthCategorySpendMap(userId),
          (async () => {
            await ensureAstraAgentReady(userId);
            return loadAstraAgentProfileStats(userId);
          })()
        ]);

        if (!active) {
          return;
        }

        setProfileStats(stats);
        setEngineResult(
          buildAgentEngineResult({
            categoryBudgetItems: budgetItems,
            spentByCategory,
            transactionGroups
          })
        );
        setErrorHint('');
      } catch (error) {
        console.warn('[agents] fallback to local intelligence', error);

        if (!active) {
          return;
        }

        const fallbackStats = await loadAstraAgentProfileStats(userId).catch(() => null);
        setProfileStats(fallbackStats);
        setEngineResult(
          buildAgentEngineResult({
            categoryBudgetItems,
            spentByCategory: {},
            transactionGroups
          })
        );
        setErrorHint('Cloud sync is unavailable right now. Showing local agent intelligence.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void refreshAgents();

    return () => {
      active = false;
    };
  }, [refreshToken, signature, transactionGroups, userId]);

  function handleInsightAction(target: AgentActionTarget) {
    hapticSelection();
    onNavigateToTab?.(target);
  }

  return (
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
        <LinearGradient
          colors={['rgba(87, 171, 255, 0.2)', 'rgba(10, 39, 73, 0.96)']}
          end={{ x: 0.9, y: 1 }}
          start={{ x: 0.1, y: 0 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleRow}>
              <Ionicons color={colors.accentSoft} name="sparkles-outline" size={18} />
              <Text allowFontScaling={false} style={styles.heroEyebrow}>
                Agent OS
              </Text>
            </View>
            <Pressable
              onPress={hapticSoft}
              style={({ pressed }) => [styles.refreshButton, pressed ? styles.refreshButtonPressed : null]}
            >
              {loading ? (
                <ActivityIndicator color={colors.accentSoft} size="small" />
              ) : (
                <Ionicons color={colors.accentSoft} name="refresh-outline" size={17} />
              )}
            </Pressable>
          </View>

          <Text allowFontScaling={false} style={styles.heroTitle}>
            Astra AI Agents
          </Text>
          <Text allowFontScaling={false} style={styles.heroSub}>
            Live agents are monitoring spend, budget pressure, and pattern quality.
          </Text>

          <View style={styles.snapshotGrid}>
            <View style={styles.snapshotCard}>
              <Text allowFontScaling={false} style={styles.snapshotLabel}>
                Net Flow
              </Text>
              <Text allowFontScaling={false} style={styles.snapshotValue}>
                {formatCurrency(engineResult.snapshot.netFlow)}
              </Text>
            </View>
            <View style={styles.snapshotCard}>
              <Text allowFontScaling={false} style={styles.snapshotLabel}>
                Outflow
              </Text>
              <Text allowFontScaling={false} style={styles.snapshotValue}>
                {formatCurrency(engineResult.snapshot.monthlyOutflow)}
              </Text>
            </View>
            <View style={styles.snapshotCard}>
              <Text allowFontScaling={false} style={styles.snapshotLabel}>
                Critical
              </Text>
              <Text allowFontScaling={false} style={styles.snapshotValue}>
                {engineResult.snapshot.criticalCount}
              </Text>
            </View>
            <View style={styles.snapshotCard}>
              <Text allowFontScaling={false} style={styles.snapshotLabel}>
                Budget Risks
              </Text>
              <Text allowFontScaling={false} style={styles.snapshotValue}>
                {engineResult.snapshot.budgetPressureCount}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {errorHint ? (
        <View style={styles.warningBar}>
          <Ionicons color={colors.warning} name="warning-outline" size={14} />
          <Text allowFontScaling={false} style={styles.warningText}>
            {errorHint}
          </Text>
        </View>
      ) : null}

      <View style={styles.trainingCard}>
        <View style={styles.trainingHeaderRow}>
          <Text allowFontScaling={false} style={styles.trainingTitle}>
            AGENT TRAINING
          </Text>
          <Text allowFontScaling={false} style={styles.trainingMeta}>
            {profileStats?.modelVersion ?? 'astra-local-intelligence-v1'}
          </Text>
        </View>

        <Text allowFontScaling={false} style={styles.trainingLine}>
          Prompt {profileStats?.promptVersion ?? 'astra-prompt-v1'} | {profileStats?.sampleCount ?? 0} learned examples
        </Text>
        <Text allowFontScaling={false} style={styles.trainingLine}>
          Fine-tuned on {profileStats?.fineTunedSampleCount ?? 0} user corrections
        </Text>
        <Text allowFontScaling={false} style={styles.trainingPromptPreview}>
          {promptPreview}...
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text allowFontScaling={false} style={styles.sectionTitle}>
          AGENT INSIGHTS
        </Text>
        <Text allowFontScaling={false} style={styles.sectionMeta}>
          {engineResult.insights.length} active
        </Text>
      </View>

      {engineResult.insights.map((insight) => {
        const accent = severityColor(insight.severity);

        return (
          <View key={insight.id} style={styles.insightCard}>
            <View
              style={[
                styles.insightAccent,
                {
                  backgroundColor: accent
                }
              ]}
            />
            <View style={styles.insightBody}>
              <View style={styles.insightTopRow}>
                <Text allowFontScaling={false} style={styles.insightAgent}>
                  {insight.agentName}
                </Text>
                <View
                  style={[
                    styles.severityBadge,
                    {
                      borderColor: `${accent}66`,
                      backgroundColor: `${accent}22`
                    }
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.severityText,
                      {
                        color: accent
                      }
                    ]}
                  >
                    {severityLabel(insight.severity)}
                  </Text>
                </View>
              </View>

              <Text allowFontScaling={false} style={styles.insightTitle}>
                {insight.title}
              </Text>
              <Text allowFontScaling={false} style={styles.insightSummary}>
                {insight.summary}
              </Text>
              <Text allowFontScaling={false} style={styles.insightDetail}>
                {insight.detail}
              </Text>

              <View style={styles.insightFooter}>
                <Text allowFontScaling={false} style={styles.confidenceLabel}>
                  Confidence {(insight.confidence * 100).toFixed(0)}%
                </Text>
                <Pressable
                  onPress={() => handleInsightAction(insight.actionTarget)}
                  style={({ pressed }) => [styles.actionButton, pressed ? styles.actionButtonPressed : null]}
                >
                  <Text allowFontScaling={false} style={styles.actionText}>
                    {insight.actionLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}

      <View style={[styles.sectionHeader, styles.roadmapHeader]}>
        <Text allowFontScaling={false} style={styles.sectionTitle}>
          AGENT ROADMAP
        </Text>
        <Text allowFontScaling={false} style={styles.sectionMeta}>
          {agentLineup.length} total
        </Text>
      </View>

      {agentLineup.map((item) => (
        <View key={item.id} style={styles.lineupCard}>
          <View style={styles.lineupRow}>
            <Text allowFontScaling={false} style={styles.lineupName}>
              {item.name}
            </Text>
            <View style={styles.lineupStatusRow}>
              <View
                style={[
                  styles.lineupDot,
                  {
                    backgroundColor: statusColor(item.status)
                  }
                ]}
              />
              <Text
                allowFontScaling={false}
                style={[
                  styles.lineupStatus,
                  {
                    color: statusColor(item.status)
                  }
                ]}
              >
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text allowFontScaling={false} style={styles.lineupDescription}>
            {item.description}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: 'rgba(87, 171, 255, 0.18)',
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 34,
    paddingHorizontal: 14,
    justifyContent: 'center'
  },
  actionButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }]
  },
  actionText: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 10.8
  },
  confidenceLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10
  },
  content: {
    paddingTop: 6
  },
  heroCard: {
    borderColor: colors.borderSoft,
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14
  },
  heroEyebrow: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    marginLeft: 7
  },
  heroShell: {
    borderRadius: radii.xl,
    marginBottom: 16,
    ...shadows.card
  },
  heroSub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11.1,
    lineHeight: 17,
    marginTop: 4
  },
  heroTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    letterSpacing: -0.25,
    marginTop: 2
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  insightAccent: {
    borderRadius: radii.pill,
    width: 4
  },
  insightAgent: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 10.5
  },
  insightBody: {
    flex: 1,
    marginLeft: 10
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  insightDetail: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10.2,
    lineHeight: 15.5,
    marginTop: 6
  },
  insightFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9
  },
  insightSummary: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 10.7,
    marginTop: 4
  },
  insightTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13.4,
    marginTop: 4
  },
  insightTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  lineupCard: {
    backgroundColor: colors.surfacePanel,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  lineupDescription: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 10.8,
    lineHeight: 16,
    marginTop: 5
  },
  lineupDot: {
    borderRadius: radii.pill,
    height: 8,
    marginRight: 6,
    width: 8
  },
  lineupName: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 12.6
  },
  lineupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  lineupStatus: {
    fontFamily: fonts.medium,
    fontSize: 9.4
  },
  lineupStatusRow: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  refreshButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: colors.borderSoft,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  refreshButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }]
  },
  roadmapHeader: {
    marginTop: 8
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9
  },
  sectionMeta: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.15
  },
  severityBadge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  severityText: {
    fontFamily: fonts.medium,
    fontSize: 9.1
  },
  snapshotCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 9,
    width: '48.5%'
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12
  },
  snapshotLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 9.2
  },
  snapshotValue: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13.2,
    marginTop: 6
  },
  trainingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  trainingHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  trainingLine: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 10.1,
    marginTop: 5
  },
  trainingMeta: {
    color: colors.accentSoft,
    fontFamily: fonts.medium,
    fontSize: 9.8
  },
  trainingPromptPreview: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 9.8,
    lineHeight: 14.5,
    marginTop: 7
  },
  trainingTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.05
  },
  warningBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(240, 203, 82, 0.1)',
    borderColor: 'rgba(240, 203, 82, 0.35)',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  warningText: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 10.2,
    marginLeft: 7
  }
});
