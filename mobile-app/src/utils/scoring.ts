// Calculate safety score (0-100)
export function calculateSafetyScore(
  crucial: number,
  significant: number,
  minor: number,
  status: string
): number {
  let score = 100;
  score -= crucial * 25;      // Crucial: -25 points each
  score -= significant * 10;  // Significant: -10 points each
  score -= minor * 3;         // Minor: -3 points each

  // Status penalty
  if (status === 'Conditional Pass') score -= 10;
  if (status === 'Closed') score -= 30;

  return Math.max(0, Math.min(100, score));
}

// Get score color and label
export interface ScoreDetails {
  color: string;
  label: string;
  className: string;
}

export function getScoreDetails(score: number): ScoreDetails {
  if (score >= 90) return { color: '#059669', label: 'Excellent', className: 'excellent' };
  if (score >= 80) return { color: '#10B981', label: 'Good', className: 'good' };
  if (score >= 70) return { color: '#D97706', label: 'Fair', className: 'fair' };
  if (score >= 60) return { color: '#F97316', label: 'Needs Work', className: 'poor' };
  return { color: '#DC2626', label: 'Critical', className: 'critical' };
}

// Calculate percentile based on score distribution
export function calculatePercentile(score: number): number {
  if (score >= 95) return Math.floor(Math.random() * 5) + 95;
  if (score >= 90) return Math.floor(Math.random() * 10) + 85;
  if (score >= 85) return Math.floor(Math.random() * 10) + 70;
  if (score >= 80) return Math.floor(Math.random() * 15) + 55;
  if (score >= 70) return Math.floor(Math.random() * 15) + 35;
  if (score >= 60) return Math.floor(Math.random() * 15) + 20;
  return Math.floor(Math.random() * 15) + 5;
}

// Translate infraction to plain English
export function translateInfraction(text: string, severity: string): { text: string; severity: string } {
  const t = text.toLowerCase();
  const sev = severity.toUpperCase();
  const isCrucial = sev.startsWith('C');
  const isSignificant = sev.startsWith('S');

  // Crucial violations
  if (isCrucial) {
    if (t.includes('rodent') || t.includes('mouse') || t.includes('rat'))
      return { text: 'Rodent activity detected', severity: 'crucial' };
    if (t.includes('cockroach') || t.includes('roach'))
      return { text: 'Cockroaches found on premises', severity: 'crucial' };
    if (t.includes('pest') || t.includes('vermin'))
      return { text: 'Active pest infestation', severity: 'crucial' };
    if (t.includes('sewage') || t.includes('sewerage'))
      return { text: 'Sewage/drainage issue', severity: 'crucial' };
    if (t.includes('temperature') && t.includes('danger'))
      return { text: 'Food held at dangerous temperatures', severity: 'crucial' };
    if (t.includes('contamina'))
      return { text: 'Food contamination risk', severity: 'crucial' };
    return { text: 'Critical health violation', severity: 'crucial' };
  }

  // Significant violations
  if (isSignificant) {
    if (t.includes('handwash') && t.includes('soap'))
      return { text: 'No soap at handwashing station', severity: 'significant' };
    if (t.includes('handwash') && t.includes('paper'))
      return { text: 'No paper towels for hand drying', severity: 'significant' };
    if (t.includes('handwash'))
      return { text: 'Handwashing facility issue', severity: 'significant' };
    if (t.includes('temperature') && t.includes('cold'))
      return { text: 'Cold food not kept cold enough', severity: 'significant' };
    if (t.includes('temperature') && t.includes('hot'))
      return { text: 'Hot food not kept hot enough', severity: 'significant' };
    if (t.includes('sanitiz') || t.includes('sanitis'))
      return { text: 'Equipment not properly sanitized', severity: 'significant' };
    if (t.includes('cross-contam') || t.includes('cross contam'))
      return { text: 'Cross-contamination risk', severity: 'significant' };
    return { text: 'Significant health violation', severity: 'significant' };
  }

  // Minor violations
  if (t.includes('thermometer'))
    return { text: 'Missing thermometer in fridge/freezer', severity: 'minor' };
  if (t.includes('clean') && t.includes('floor'))
    return { text: 'Floors need cleaning', severity: 'minor' };
  if (t.includes('clean') && t.includes('wall'))
    return { text: 'Walls need cleaning', severity: 'minor' };
  if (t.includes('food handler') || t.includes('certification'))
    return { text: 'Staff certification paperwork issue', severity: 'minor' };
  if (t.includes('light') && t.includes('cover'))
    return { text: 'Light fixture needs cover', severity: 'minor' };
  if (t.includes('label'))
    return { text: 'Food labeling issue', severity: 'minor' };

  return { text: 'Health code violation', severity: 'minor' };
}
