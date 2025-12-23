import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getRestaurantInspections, Inspection } from '../services/supabase';
import {
  calculateSafetyScore,
  getScoreDetails,
  calculatePercentile,
  translateInfraction,
} from '../utils/scoring';

interface RouteParams {
  establishmentId: number;
  name: string;
  address: string;
}

interface InspectionGroup {
  id: number;
  date: string;
  status: string;
  infractions: { severity: string; details: string }[];
}

export default function RestaurantDetailScreen() {
  const route = useRoute();
  const { establishmentId, name, address } = route.params as RouteParams;

  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<InspectionGroup[]>([]);
  const [safetyScore, setSafetyScore] = useState(0);
  const [scoreDetails, setScoreDetails] = useState({ color: '#6B665C', label: 'Loading', className: '' });
  const [percentile, setPercentile] = useState(0);
  const [violationCounts, setViolationCounts] = useState({ crucial: 0, significant: 0, minor: 0 });
  const [latestStatus, setLatestStatus] = useState('');

  useEffect(() => {
    loadInspections();
  }, [establishmentId]);

  async function loadInspections() {
    try {
      const data = await getRestaurantInspections(establishmentId);

      // Group by inspection_id
      const inspectionMap = new Map<number, InspectionGroup>();
      data.forEach((record: Inspection) => {
        const inspId = record.inspection_id;
        if (!inspectionMap.has(inspId)) {
          inspectionMap.set(inspId, {
            id: inspId,
            date: record.inspection_date,
            status: record.establishment_status,
            infractions: [],
          });
        }
        const severity = (record.severity || '').trim();
        if (severity && !severity.toUpperCase().startsWith('N')) {
          inspectionMap.get(inspId)!.infractions.push({
            severity,
            details: record.infraction_details || '',
          });
        }
      });

      const sortedInspections = Array.from(inspectionMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setInspections(sortedInspections);

      // Calculate score from latest inspection
      const latest = sortedInspections[0];
      if (latest) {
        let crucial = 0, significant = 0, minor = 0;
        latest.infractions.forEach((inf) => {
          const sev = inf.severity.toUpperCase();
          if (sev.startsWith('C')) crucial++;
          else if (sev.startsWith('S')) significant++;
          else if (sev.startsWith('M')) minor++;
        });

        setViolationCounts({ crucial, significant, minor });
        setLatestStatus(latest.status);

        const score = calculateSafetyScore(crucial, significant, minor, latest.status);
        setSafetyScore(score);
        setScoreDetails(getScoreDetails(score));
        setPercentile(calculatePercentile(score));

        // Haptic feedback based on score
        if (score >= 90) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (score < 60) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      }
    } catch (error) {
      console.error('Error loading inspections:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `${name} - Safety Score: ${safetyScore}/100 (${scoreDetails.label})\n\nCheck any Toronto restaurant on SupperSafe: suppersafe.com`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2D5A3D" />
        <Text style={styles.loadingText}>Analyzing inspection records...</Text>
      </View>
    );
  }

  const latest = inspections[0];
  const latestDate = latest
    ? new Date(latest.date).toLocaleDateString('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Status Bar */}
        <View
          style={[
            styles.statusBar,
            latestStatus === 'Pass'
              ? styles.statusPass
              : latestStatus === 'Conditional Pass'
              ? styles.statusConditional
              : styles.statusClosed,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              latestStatus === 'Pass'
                ? styles.statusTextPass
                : latestStatus === 'Conditional Pass'
                ? styles.statusTextConditional
                : styles.statusTextClosed,
            ]}
          >
            {latestStatus || 'Unknown'}
          </Text>
          <Text style={styles.statusDate}>Inspected {latestDate}</Text>
        </View>

        {/* Restaurant Info */}
        <View style={styles.header}>
          <Text style={styles.restaurantName}>{name}</Text>
          <Text style={styles.restaurantAddress}>{address}</Text>
        </View>

        {/* Safety Score Card */}
        <View style={[styles.scoreCard, { borderColor: scoreDetails.color + '40' }]}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreNumber, { color: scoreDetails.color }]}>
              {safetyScore}
            </Text>
            <Text style={styles.scoreOutOf}>out of 100</Text>
          </View>
          <Text style={[styles.scoreLabel, { color: scoreDetails.color }]}>
            {scoreDetails.label}
          </Text>
          <Text style={styles.percentileText}>
            {safetyScore >= 80
              ? `Safer than ${percentile}% of Toronto restaurants`
              : `Worse than ${100 - percentile}% of Toronto restaurants`}
          </Text>

          {/* Violation counts */}
          <View style={styles.violationPills}>
            <View style={styles.pill}>
              <View style={[styles.pillDot, styles.crucialDot]} />
              <Text style={styles.pillText}>{violationCounts.crucial} crucial</Text>
            </View>
            <View style={styles.pill}>
              <View style={[styles.pillDot, styles.significantDot]} />
              <Text style={styles.pillText}>{violationCounts.significant} significant</Text>
            </View>
            <View style={styles.pill}>
              <View style={[styles.pillDot, styles.minorDot]} />
              <Text style={styles.pillText}>{violationCounts.minor} minor</Text>
            </View>
          </View>
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Share Report</Text>
        </TouchableOpacity>

        {/* Findings */}
        {latest && latest.infractions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What inspectors found</Text>
            {latest.infractions.slice(0, 5).map((inf, index) => {
              const translated = translateInfraction(inf.details, inf.severity);
              return (
                <View
                  key={index}
                  style={[
                    styles.findingItem,
                    translated.severity === 'crucial' && styles.findingCrucial,
                    translated.severity === 'significant' && styles.findingSignificant,
                  ]}
                >
                  <Text style={styles.findingText}>{translated.text}</Text>
                  {translated.severity !== 'minor' && (
                    <View
                      style={[
                        styles.severityTag,
                        translated.severity === 'crucial'
                          ? styles.crucialTag
                          : styles.significantTag,
                      ]}
                    >
                      <Text style={styles.severityTagText}>{translated.severity}</Text>
                    </View>
                  )}
                </View>
              );
            })}
            {latest.infractions.length > 5 && (
              <Text style={styles.moreFindings}>
                + {latest.infractions.length - 5} more issues
              </Text>
            )}
          </View>
        )}

        {/* Inspection History */}
        {inspections.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inspection History</Text>
            <Text style={styles.historyCount}>
              {inspections.length} visits since{' '}
              {new Date(inspections[inspections.length - 1].date).getFullYear()}
            </Text>
            <View style={styles.trendBars}>
              {inspections.slice(0, 6).reverse().map((insp, index) => {
                const count = insp.infractions.length;
                const height = Math.max(8, Math.min(48, count * 8 + 8));
                return (
                  <View
                    key={index}
                    style={[
                      styles.trendBar,
                      { height },
                      count === 0
                        ? styles.barClean
                        : count <= 2
                        ? styles.barWarning
                        : styles.barDanger,
                      index === inspections.slice(0, 6).length - 1 && styles.barCurrent,
                    ]}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Data Source */}
        <Text style={styles.dataSource}>Data from Toronto Public Health DineSafe</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9F7',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B665C',
  },
  scrollView: {
    flex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  statusPass: {
    backgroundColor: '#ECFDF5',
  },
  statusConditional: {
    backgroundColor: '#FFFBEB',
  },
  statusClosed: {
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusTextPass: {
    color: '#059669',
  },
  statusTextConditional: {
    color: '#D97706',
  },
  statusTextClosed: {
    color: '#DC2626',
  },
  statusDate: {
    fontSize: 12,
    color: '#6B665C',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 14,
    color: '#6B665C',
  },
  scoreCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FAF9F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: '700',
  },
  scoreOutOf: {
    fontSize: 12,
    color: '#A09A8F',
    marginTop: 2,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  percentileText: {
    fontSize: 14,
    color: '#6B665C',
    marginBottom: 16,
  },
  violationPills: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF9F7',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  crucialDot: {
    backgroundColor: '#DC2626',
  },
  significantDot: {
    backgroundColor: '#D97706',
  },
  minorDot: {
    backgroundColor: '#9CA3AF',
  },
  pillText: {
    fontSize: 12,
    color: '#4A4640',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D5A3D',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B665C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  findingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DD',
  },
  findingCrucial: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  findingSignificant: {
    backgroundColor: '#FFFBEB',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  findingText: {
    flex: 1,
    fontSize: 14,
    color: '#4A4640',
  },
  severityTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  crucialTag: {
    backgroundColor: '#DC2626',
  },
  significantTag: {
    backgroundColor: '#F59E0B',
  },
  severityTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  moreFindings: {
    fontSize: 12,
    color: '#6B665C',
    fontStyle: 'italic',
    marginTop: 8,
  },
  historyCount: {
    fontSize: 12,
    color: '#A09A8F',
    marginBottom: 12,
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 48,
  },
  trendBar: {
    flex: 1,
    borderRadius: 4,
  },
  barClean: {
    backgroundColor: '#34D399',
  },
  barWarning: {
    backgroundColor: '#FBBF24',
  },
  barDanger: {
    backgroundColor: '#F87171',
  },
  barCurrent: {
    borderWidth: 2,
    borderColor: '#2D5A3D',
  },
  dataSource: {
    fontSize: 10,
    color: '#A09A8F',
    textAlign: 'center',
    marginVertical: 24,
  },
});
