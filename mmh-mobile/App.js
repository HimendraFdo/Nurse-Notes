import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeModules } from 'react-native';
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

// ---- Records store ---------------------------------------------------------
// The list below is NOT hardcoded — it is the set of summaries a clinician has
// actually approved and submitted from the Nurse Notes desktop app. That app
// POSTs each approved document to a small local store (see the repo's
// server/records-api.js), served on the Vite dev server. We fetch it from that
// same machine.
//
// Must match the port the Nurse Notes web app runs on. `npm run dev` pins the
// web server to 5199 (and to --host, so it's reachable over the LAN).
const STORE_PORT = 5199;

// ── Reaching the store from the phone ──────────────────────────────────────
// FULL-URL OVERRIDE. Set this to reach the store directly, ignoring everything
// below. REQUIRED when Expo runs in --tunnel mode (the phone is not on your
// LAN, so it can't hit your PC's IP): expose the store with its own tunnel and
// paste that URL here. Examples:
//   ngrok:       run `ngrok http 5199`      → 'https://abc123.ngrok-free.app'
//   cloudflared: run `cloudflared tunnel --url http://localhost:5199'
// Leave blank to auto-detect (works for Expo web and Expo Go on the SAME Wi-Fi).
const API_BASE_OVERRIDE = 'https://realizing-tianna-lollingly.ngrok-free.dev';

function resolveApiBase() {
  if (API_BASE_OVERRIDE) return API_BASE_OVERRIDE.replace(/\/+$/, '');

  // Expo web → same host the page is served from.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${STORE_PORT}`;
  }

  // Expo Go / device on the SAME LAN → reuse the Metro bundle host (your PC's
  // LAN IP — the phone already loads the app from it) and swap in the store
  // port. NOTE: in --tunnel mode this resolves to the tunnel domain, which does
  // NOT forward port 5199 — use API_BASE_OVERRIDE above instead.
  const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
  const m = scriptURL.match(/https?:\/\/([^:/]+)/);
  const host = m ? m[1] : 'localhost';
  return `http://${host}:${STORE_PORT}`;
}

const API_BASE = resolveApiBase();

async function fetchRecords() {
  const res = await fetch(`${API_BASE}/api/records`, {
    headers: {
      Accept: 'application/json',
      // Skip ngrok's interstitial HTML warning when the store is tunnelled.
      'ngrok-skip-browser-warning': 'true',
    },
  });
  if (!res.ok) throw new Error(`Store returned HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ---- Formatting helpers ----------------------------------------------------
function formatWhen(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('en-NZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

// Turn shorthand / markdown into something the TTS engine reads naturally.
function speakable(text) {
  return String(text)
    .replace(/[*#_`>]/g, '') // strip markdown markers
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

// ---- Tiny markdown renderer ------------------------------------------------
// The approved summary is stored as the clinician-edited markdown. We render a
// practical subset (headings, bullets, bold, paragraphs) so the phone shows
// exactly what was approved — no re-parsing into a fixed template.
function renderInline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <Text key={`${keyPrefix}-b${i}`} style={styles.mdBold}>
          {m[1]}
        </Text>
      );
    }
    return part;
  });
}

function Markdown({ text }) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let key = 0;

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        <Text key={key++} style={[styles.mdHeading, level >= 3 && styles.mdHeadingSm]}>
          {renderInline(heading[2], `h${key}`)}
        </Text>,
      );
      continue;
    }

    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push(
        <View key={key++} style={styles.mdBulletRow}>
          <View style={styles.mdBulletDot} />
          <Text style={styles.mdBulletText}>{renderInline(bullet[1], `li${key}`)}</Text>
        </View>,
      );
      continue;
    }

    const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (numbered) {
      blocks.push(
        <View key={key++} style={styles.mdBulletRow}>
          <Text style={styles.mdNumber}>{numbered[1]}.</Text>
          <Text style={styles.mdBulletText}>{renderInline(numbered[2], `no${key}`)}</Text>
        </View>,
      );
      continue;
    }

    blocks.push(
      <Text key={key++} style={styles.mdParagraph}>
        {renderInline(line, `p${key}`)}
      </Text>,
    );
  }

  if (blocks.length === 0) {
    return <Text style={styles.mdParagraph}>No content.</Text>;
  }
  return <View>{blocks}</View>;
}

// ---- Small components -------------------------------------------------------
function Badge({ icon, label, bg, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function AppBar({ onBack, title }) {
  return (
    <View style={styles.appBar}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.appBarBack}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
      ) : (
        <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#ffffff" />
      )}
      <Text style={styles.appBarTitle}>{title}</Text>
      <View style={styles.appBarSpacer} />
      <Ionicons name="person-circle-outline" size={26} color="#ffffff" />
    </View>
  );
}

// ---- Records list screen ---------------------------------------------------
function RecordsList({ records, loading, error, onRefresh, onOpen }) {
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading && records.length > 0} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.listHeading}>Health Records</Text>
      <Text style={styles.listSub}>Summaries your care team has approved and sent to you.</Text>

      {error && (
        <View style={styles.noticeCard}>
          <Ionicons name="cloud-offline-outline" size={18} color={COLORS.warnText} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.noticeText}>
              Can't reach your records right now. Pull down to try again.
            </Text>
            <Text style={styles.noticeAddr}>Tried: {API_BASE}/api/records</Text>
          </View>
        </View>
      )}

      {loading && records.length === 0 && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.centerText}>Loading your records…</Text>
        </View>
      )}

      {!loading && !error && records.length === 0 && (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="file-outline" size={40} color={COLORS.subtext} />
          <Text style={styles.centerText}>No records yet</Text>
          <Text style={styles.centerHint}>
            When a nurse approves and submits a summary, it appears here.
          </Text>
        </View>
      )}

      {records.map((r) => (
        <TouchableOpacity
          key={r.id}
          style={styles.recordItem}
          activeOpacity={0.7}
          onPress={() => onOpen(r.id)}
        >
          <View style={styles.recordIcon}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recordTitle}>{r.patientName || 'Discharge summary'}</Text>
            <Text style={styles.recordMeta} numberOfLines={1}>
              {[r.hospital, r.ward].filter(Boolean).join(' · ') || 'Discharge summary'}
            </Text>
            <View style={styles.recordTagRow}>
              <View style={styles.approvedPill}>
                <Ionicons name="shield-checkmark" size={11} color={COLORS.primary} />
                <Text style={styles.approvedPillText}>Approved</Text>
              </View>
            </View>
            <Text style={styles.recordWhen}>{formatWhen(r.submittedAt)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.subtext} />
        </TouchableOpacity>
      ))}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ---- Record detail screen --------------------------------------------------
function RecordDetail({ record }) {
  const [tab, setTab] = useState('plain'); // 'plain' | 'original'
  const [playing, setPlaying] = useState(false);
  const nzVoiceRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!mounted || !voices) return;
        const nz = voices.find((v) => v.language === 'en-NZ');
        const enAny = voices.find((v) => (v.language || '').startsWith('en'));
        nzVoiceRef.current = (nz || enAny)?.identifier ?? null;
      })
      .catch(() => {});
    return () => {
      mounted = false;
      Speech.stop();
    };
  }, []);

  const initials = (record.patientName || 'PT')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const toggleNarration = () => {
    if (playing) {
      Speech.stop();
      setPlaying(false);
      return;
    }
    const script =
      'Here is your approved summary. ' + speakable(record.plainText) + ' End of summary.';
    setPlaying(true);
    Speech.speak(script, {
      language: 'en-NZ',
      voice: nzVoiceRef.current || undefined,
      pitch: 1.0,
      rate: 0.95,
      onDone: () => setPlaying(false),
      onStopped: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Approved release banner — from the real submission */}
      <View style={styles.approvedBanner}>
        <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
        <Text style={styles.approvedText}>
          {record.approvedBy
            ? `Approved by ${record.approvedBy}${record.approvedAt ? ` (${record.approvedAt})` : ''}`
            : 'Approved for release'}
        </Text>
      </View>

      {/* Patient card */}
      <View style={styles.card}>
        <View style={styles.patientRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{record.patientName || 'Patient'}</Text>
            {!!record.nhi && <Text style={styles.patientMeta}>NHI: {record.nhi}</Text>}
            <Text style={styles.patientMeta}>
              {[record.hospital, record.ward].filter(Boolean).join(' · ') || 'Discharge summary'}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <Badge
          icon={<Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />}
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
          <Text style={[styles.segmentText, tab === 'plain' && styles.segmentTextActive]}>
            Plain Language Summary
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, tab === 'original' && styles.segmentActive]}
          activeOpacity={0.8}
          onPress={() => setTab('original')}
        >
          <Text style={[styles.segmentText, tab === 'original' && styles.segmentTextActive]}>
            Original Medical Notes
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'plain' ? (
        <View>
          <TouchableOpacity
            style={[styles.audioBtn, playing && styles.audioBtnPlaying]}
            activeOpacity={0.85}
            onPress={toggleNarration}
          >
            <Ionicons name={playing ? 'pause-circle' : 'volume-high'} size={20} color="#ffffff" />
            <Text style={styles.audioBtnText}>{playing ? 'Playing…' : 'Listen to Summary'}</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="text-box-check-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Your Plain-Language Summary</Text>
            </View>
            <Markdown text={record.plainText} />
          </View>

          <View style={styles.footerBadge}>
            <MaterialCommunityIcons name="book-open-variant" size={14} color={COLORS.subtext} />
            <Text style={styles.footerBadgeText}>
              Rewritten in plain language · Reviewed by your care team
            </Text>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="file-document-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Original Medical Notes</Text>
            </View>
            <View style={styles.monoWrap}>
              <Text style={styles.mono}>
                {record.originalText || 'The original clinician notes were not included.'}
              </Text>
            </View>
          </View>
          <View style={styles.footerBadge}>
            <Ionicons name="lock-closed" size={13} color={COLORS.subtext} />
            <Text style={styles.footerBadgeText}>Verbatim clinician record · Read only</Text>
          </View>
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ---- Root ------------------------------------------------------------------
export default function App() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecords();
      setRecords(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + light polling while viewing the list, so a summary the
  // clinician submits appears without the patient doing anything.
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedId) return undefined;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [selectedId, load]);

  const selected = selectedId ? records.find((r) => r.id === selectedId) : null;

  // If the selected record vanished (e.g. store reset), fall back to the list.
  useEffect(() => {
    if (selectedId && !selected && !loading) setSelectedId(null);
  }, [selectedId, selected, loading]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />
      {selected ? (
        <>
          <AppBar title="Nurse Notes" onBack={() => setSelectedId(null)} />
          <RecordDetail record={selected} />
        </>
      ) : (
        <>
          <AppBar title="Nurse Notes" />
          <RecordsList
            records={records}
            loading={loading}
            error={error}
            onRefresh={load}
            onOpen={setSelectedId}
          />
        </>
      )}
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
  appBarBack: { marginRight: 2 },
  appBarTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  appBarSpacer: { flex: 1 },
  scroll: { padding: 16 },

  // List
  listHeading: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  listSub: { fontSize: 13, color: COLORS.subtext, marginBottom: 16 },

  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  recordIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recordTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  recordMeta: { fontSize: 13, color: COLORS.subtext, marginTop: 1 },
  recordTagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  approvedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.badgeBg,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  approvedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 4,
  },
  recordWhen: { fontSize: 12, color: COLORS.subtext, marginTop: 6 },

  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warnBg,
    borderWidth: 1,
    borderColor: COLORS.warnBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { color: COLORS.warnText, fontSize: 13, fontWeight: '500' },
  noticeAddr: {
    color: COLORS.warnText,
    fontSize: 11,
    marginTop: 4,
    opacity: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  centerBox: { alignItems: 'center', paddingVertical: 48 },
  centerText: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  centerHint: { fontSize: 13, color: COLORS.subtext, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },

  // Detail
  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  approvedText: { color: '#ffffff', fontSize: 13, fontWeight: '600', marginLeft: 8, flex: 1 },

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
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

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
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: COLORS.subtext },
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
  audioBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginLeft: 8 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginLeft: 8, flex: 1 },

  // Markdown blocks
  mdHeading: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 10, marginBottom: 6 },
  mdHeadingSm: { fontSize: 14 },
  mdParagraph: { fontSize: 14, lineHeight: 21, color: COLORS.text, marginBottom: 8 },
  mdBold: { fontWeight: '800', color: COLORS.text },
  mdBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 4 },
  mdBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 7,
    marginRight: 10,
  },
  mdNumber: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginRight: 8, lineHeight: 21 },
  mdBulletText: { flex: 1, fontSize: 14, lineHeight: 21, color: COLORS.text },

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
