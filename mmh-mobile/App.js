import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

// ---- Theme -----------------------------------------------------------------
const COLORS = {
  primary: '#1b6b5d',
  primaryDark: '#134e48',
  bg: '#f4f5f0',
  card: '#ffffff',
  border: '#e4e7e0',
  text: '#1f2a28',
  subtext: '#5b6b67',
  badgeBg: '#e3f1ec',
  warnBg: '#fef2f2',
  warnBorder: '#fecaca',
  warnText: '#dc2626',
  newTag: '#0f766e',
};

// ---- Hardcoded patient data ------------------------------------------------
const MEDICINES = [
  {
    name: 'Amoxicillin 500mg',
    detail: '3x a day for 5 days — for infection',
    status: null,
  },
  {
    name: 'Bisoprolol 2.5mg',
    detail: '1x a day — medicine for heart rate',
    status: 'NEW',
  },
  {
    name: 'Apixaban 5mg',
    detail: '2x a day — medicine to prevent blood clots',
    status: 'NEW',
  },
  {
    name: 'Metformin 1g',
    detail: '1x a day — existing medicine',
    status: null,
  },
  {
    name: 'Atorvastatin 40mg',
    detail: 'At night — existing medicine',
    status: null,
  },
];

// Full verbatim clinician discharge summary (synthetic sample).
const ORIGINAL_NOTES =
  `Waikato Hospital — Discharge Summary
[SYNTHETIC TEST DOCUMENT — not a real patient]

Patient: Aroha Ngata (fictional)   NHI: ZZZ9999   DOB: 14/03/1958  Age 68
Ward: M3   Consultant: Dr S. Patel
Admitted: 28/07/2026   Discharged: 02/08/2026

Dx: 1. Community-acquired pneumonia (RLL)  2. T2DM (poorly controlled, HbA1c 74)
3. New AF  4. CKD stage 3a

PC: 4/7 productive cough, fevers, increasing SOB. O/E febrile 38.7, sats 89% RA,
RR 24, crackles R base.

Ix: CXR RLL consolidation. CRP 187, WCC 15.2, eGFR 52, Trop neg. ECG AF ~110bpm.

Mgmt: IV ceftriaxone 1g OD 3/7 then switched PO. Rate control w/ bisoprolol.
Commenced apixaban for AF (CHA2DS2-VASc 4). Metformin held during admission,
restarted on d/c.

Meds on discharge:
- Amoxicillin 500mg TDS PO — 5/7 course, complete it
- Bisoprolol 2.5mg OD (NEW)
- Apixaban 5mg BD (NEW) — do not stop without advice, bleeding risk
- Metformin 1g BD (unchanged)
- Atorvastatin 40mg nocte (unchanged)

F/U: Repeat CXR in 6/52 via GP. Anticoag clinic r/v 2/52. GP recheck renal fn 1/52.
Cardiology OPA re AF — letter to follow.

Safety-net: return if worsening SOB, chest pain, haemoptysis, or signs of bleeding
(melaena, bruising). Diabetic education referral made.

Clinician: Dr J. Lee, House Officer`;

// Warning signs — single source for both the card and the narration.
const WARNINGS = ['Worse shortness of breath (SOB)', 'Chest pain'];

// Turn on-screen shorthand into something the TTS engine reads naturally
// (e.g. "3x a day" -> "three times a day", strip the "(SOB)" abbreviation).
function speakable(text) {
  return text
    .replace(/\(SOB\)/g, '')
    .replace(/\bSOB\b/g, 'shortness of breath')
    .replace(/\b1x a day\b/gi, 'once a day')
    .replace(/\b2x a day\b/gi, 'twice a day')
    .replace(/\b3x a day\b/gi, 'three times a day')
    .replace(/\b(\d+)x a day\b/gi, '$1 times a day')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build the spoken narration from the SAME data that renders the cards,
// so the audio can never drift out of sync with what's on screen.
function buildNarration() {
  const meds = MEDICINES.map((m) => {
    const isNew = m.status === 'NEW' ? 'This is a new medicine. ' : '';
    return `${m.name}. ${isNew}${speakable(m.detail)}.`;
  }).join(' ');

  const warns = WARNINGS.map(speakable).join(', or ');

  return (
    'Here is a summary of your discharge from Waikato Hospital. ' +
    'Here are your medicines and what changed. ' +
    meds +
    ' Warning signs. Call for help now if you have ' +
    warns +
    '. That is the end of your summary.'
  );
}

const NARRATION_SCRIPT = buildNarration();

// ---- Small components -------------------------------------------------------
function Badge({ icon, label, bg, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ---- Screen ----------------------------------------------------------------
export default function App() {
  const [tab, setTab] = useState('plain'); // 'plain' | 'original'
  const [playing, setPlaying] = useState(false);
  const nzVoiceRef = useRef(null); // preferred en-NZ voice identifier, if the device has one

  // Find a New Zealand English voice on mount; fall back to any English voice.
  useEffect(() => {
    let mounted = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!mounted || !voices) return;
        const nz = voices.find((v) => v.language === 'en-NZ');
        const enAny = voices.find((v) => (v.language || '').startsWith('en'));
        nzVoiceRef.current = (nz || enAny)?.identifier ?? null;
      })
      .catch(() => {
        /* voice list is best-effort; language option below still applies */
      });
    // Stop any narration if the screen unmounts.
    return () => {
      mounted = false;
      Speech.stop();
    };
  }, []);

  const toggleNarration = () => {
    if (playing) {
      Speech.stop();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    Speech.speak(NARRATION_SCRIPT, {
      language: 'en-NZ', // Kiwi accent where the device provides it
      voice: nzVoiceRef.current || undefined,
      pitch: 1.0,
      rate: 0.95, // slightly slower for clarity
      onDone: () => setPlaying(false),
      onStopped: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      {/* Top App Bar */}
      <View style={styles.appBar}>
        <MaterialCommunityIcons name="heart-pulse" size={22} color="#ffffff" />
        <Text style={styles.appBarTitle}>ManageMyHealth</Text>
        <View style={styles.appBarSpacer} />
        <Ionicons name="person-circle-outline" size={26} color="#ffffff" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Approved release banner */}
        <View style={styles.approvedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
          <Text style={styles.approvedText}>
            Approved by Nurse William Hernandez (7 Aug 2026, 10:00 am)
          </Text>
        </View>

        {/* Patient card */}
        <View style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AN</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>Aroha Ngata</Text>
              <Text style={styles.patientMeta}>NHI: ZZZ9999</Text>
              <Text style={styles.patientMeta}>Waikato Hospital · Ward M3</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Badge
            icon={
              <Ionicons
                name="shield-checkmark"
                size={14}
                color={COLORS.primary}
              />
            }
            label="Approved for Release"
            bg={COLORS.badgeBg}
            color={COLORS.primary}
          />
        </View>

        {/* Segmented tabs */}
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'plain' && styles.segmentActive]}
            activeOpacity={0.8}
            onPress={() => setTab('plain')}
          >
            <Text
              style={[
                styles.segmentText,
                tab === 'plain' && styles.segmentTextActive,
              ]}
            >
              Plain Language Summary
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              tab === 'original' && styles.segmentActive,
            ]}
            activeOpacity={0.8}
            onPress={() => setTab('original')}
          >
            <Text
              style={[
                styles.segmentText,
                tab === 'original' && styles.segmentTextActive,
              ]}
            >
              Original Medical Notes
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'plain' ? (
          <View>
            {/* Audio narration button */}
            <TouchableOpacity
              style={[styles.audioBtn, playing && styles.audioBtnPlaying]}
              activeOpacity={0.85}
              onPress={toggleNarration}
            >
              <Ionicons
                name={playing ? 'pause-circle' : 'volume-high'}
                size={20}
                color="#ffffff"
              />
              <Text style={styles.audioBtnText}>
                {playing ? 'Playing…' : 'Listen to Summary'}
              </Text>
            </TouchableOpacity>

            {/* Card 1: Medicines */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="pill"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.cardTitle}>Your Medicines &amp; What Changed</Text>
              </View>

              {MEDICINES.map((m, i) => (
                <View
                  key={m.name}
                  style={[
                    styles.medRow,
                    i === MEDICINES.length - 1 && styles.medRowLast,
                  ]}
                >
                  <View style={styles.medBullet} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.medNameRow}>
                      <Text style={styles.medName}>{m.name}</Text>
                      {m.status === 'NEW' && (
                        <View style={styles.newTag}>
                          <Text style={styles.newTagText}>NEW</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.medDetail}>{m.detail}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Card 2: Warning signs */}
            <View style={styles.warnCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="warning" size={20} color={COLORS.warnText} />
                <Text style={[styles.cardTitle, { color: COLORS.warnText }]}>
                  Warning Signs — Call someone now
                </Text>
              </View>
              <Text style={styles.warnLead}>Call for help if you have:</Text>
              {WARNINGS.map((w) => (
                <View key={w} style={styles.warnItem}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={COLORS.warnText}
                  />
                  <Text style={styles.warnItemText}>{w}</Text>
                </View>
              ))}
            </View>

            {/* Footer badge */}
            <View style={styles.footerBadge}>
              <MaterialCommunityIcons
                name="book-open-variant"
                size={14}
                color={COLORS.subtext}
              />
              <Text style={styles.footerBadgeText}>
                Simplified to Grade 6 Reading Level · Reduced from 61 Jargon
                Terms
              </Text>
            </View>
          </View>
        ) : (
          <View>
            {/* Original clinical notes */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.cardTitle}>Original Medical Notes</Text>
              </View>
              <View style={styles.monoWrap}>
                <Text style={styles.mono}>{ORIGINAL_NOTES}</Text>
              </View>
            </View>
            <View style={styles.footerBadge}>
              <Ionicons
                name="lock-closed"
                size={13}
                color={COLORS.subtext}
              />
              <Text style={styles.footerBadgeText}>
                Verbatim clinician record · Read only
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Styles ----------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  appBarTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  appBarSpacer: { flex: 1 },
  scroll: { padding: 16 },

  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  approvedText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 14,
  },
  patientRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  patientName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  patientMeta: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },

  segment: {
    flexDirection: 'row',
    backgroundColor: '#e8eae4',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.subtext,
  },
  segmentTextActive: { color: COLORS.primaryDark },

  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: COLORS.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  audioBtnPlaying: { backgroundColor: COLORS.primaryDark },
  audioBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 8,
    flex: 1,
  },

  medRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  medRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  medBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    marginRight: 12,
  },
  medNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  medName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  medDetail: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },
  newTag: {
    backgroundColor: COLORS.badgeBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  newTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.newTag,
    letterSpacing: 0.5,
  },

  warnCard: {
    backgroundColor: COLORS.warnBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warnBorder,
    padding: 18,
    marginBottom: 14,
  },
  warnLead: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warnText,
    marginBottom: 8,
  },
  warnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  warnItemText: {
    fontSize: 14,
    color: COLORS.warnText,
    fontWeight: '500',
    marginLeft: 8,
  },

  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#eef0ea',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  footerBadgeText: {
    fontSize: 11,
    color: COLORS.subtext,
    fontWeight: '600',
    marginLeft: 6,
    flexShrink: 1,
  },

  monoWrap: {
    backgroundColor: '#f7f8f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    lineHeight: 20,
    color: COLORS.text,
  },
});
