import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    Dimensions,
    ActivityIndicator,
    Image,
    Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { getSharedImage, getSharedLocation, getSharedManualPrice } from '../image-store';

const { width } = Dimensions.get('window');

// -------------------------------------------------------------------
// IMPORTANT: Change this to your computer's local IP when running
// the FastAPI backend on a physical device / emulator.
// e.g. "http://192.168.1.42:8000"
// -------------------------------------------------------------------
const API_BASE_URL = 'http://localhost:8000';

interface ScanResult {
    product_name?: string;
    price_scanned?: number;
    fair_price?: number;
    equity_gap?: number;
    currency_symbol?: string;
}

interface AnalysisData {
    girl?: ScanResult;
    travel?: ScanResult;
}

type AnalysisState = 'loading' | 'success' | 'error';

export default function ResultsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode: string }>();

    const imageUri = getSharedImage() ?? '';
    const location = getSharedLocation();
    const { price: manualPrice, currency } = getSharedManualPrice();
    const mode = params.mode ?? 'girl';

    const [state, setState] = useState<AnalysisState>('loading');
    const [analysisData, setAnalysisData] = useState<AnalysisData>({});
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        analyzeImage();
    }, []);

    const analyzeImage = async () => {
        setState('loading');
        setErrorMsg('');

        try {
            const formData = new FormData();
            formData.append('mode', mode);

            // Attach location data if available
            if (location) {
                formData.append('latitude', String(location.latitude));
                formData.append('longitude', String(location.longitude));
                if (location.city) formData.append('city', location.city);
                if (location.country) formData.append('country', location.country);
            }

            // Attach manual price + currency if provided
            if (manualPrice !== null) {
                formData.append('manual_price', String(manualPrice));
            }
            formData.append('currency', currency);

            // Attach image — web needs blob, native needs file URI object
            if (Platform.OS === 'web') {
                const response = await fetch(imageUri);
                const blob = await response.blob();
                formData.append('image', blob, 'scan.jpg');
            } else {
                formData.append('image', {
                    uri: imageUri,
                    name: 'scan.jpg',
                    type: 'image/jpeg',
                } as any);
            }

            const res = await fetch(`${API_BASE_URL}/scan`, {
                method: 'POST',
                body: formData,
            });

            const json = await res.json();

            if (json.status !== 'success') {
                throw new Error(json.message ?? 'Backend returned an error.');
            }

            const results: AnalysisData = {};
            if (mode === 'both') {
                results.girl = json.data.girl;
                results.travel = json.data.travel;
            } else {
                results[mode as keyof AnalysisData] = json.data;
            }

            setAnalysisData(results);
            setState('success');
        } catch (err: any) {
            setErrorMsg(err.message ?? 'Unknown error');
            setState('error');
        }
    };

    // =====================================================================
    // RENDER: Loading
    // =====================================================================
    const renderLoading = () => (
        <Animated.View entering={FadeIn.duration(600)} style={styles.centerContainer}>
            <View style={styles.loadingCard}>
                <ActivityIndicator color="#818CF8" size="large" />
                <Text style={styles.loadingTitle}>Analyzing Product…</Text>
                <Text style={styles.loadingSubtitle}>
                    Sending to Gemini AI for price analysis
                </Text>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.loadingThumb} />
                ) : null}

                {/* Location pill in loading */}
                {location?.city && (
                    <View style={styles.locationPill}>
                        <Text style={styles.locationPillText}>
                            📍 {location.city}{location.country ? `, ${location.country}` : ''}
                        </Text>
                    </View>
                )}

                <View style={styles.loadingModes}>
                    {(mode === 'girl' || mode === 'both') && (
                        <View style={[styles.loadingModePill, { borderColor: '#EC4899' }]}>
                            <Text style={styles.loadingModeText}>🚺 Pink Tax</Text>
                        </View>
                    )}
                    {(mode === 'travel' || mode === 'both') && (
                        <View style={[styles.loadingModePill, { borderColor: '#3B82F6' }]}>
                            <Text style={styles.loadingModeText}>🌍 Tourist Tax</Text>
                        </View>
                    )}
                </View>
            </View>
        </Animated.View>
    );

    // =====================================================================
    // RENDER: Error
    // =====================================================================
    const renderError = () => (
        <Animated.View entering={FadeIn.duration(600)} style={styles.centerContainer}>
            <View style={styles.errorCard}>
                <Text style={styles.errorEmoji}>❌</Text>
                <Text style={styles.errorTitle}>Analysis Failed</Text>
                <Text style={styles.errorMessage}>{errorMsg}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={analyzeImage} activeOpacity={0.7}>
                    <Text style={styles.retryButtonText}>🔄  Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backLink} onPress={() => router.back()} activeOpacity={0.7}>
                    <Text style={styles.backLinkText}>← Go Back</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );

    // =====================================================================
    // RENDER: Result Card
    // =====================================================================
    const renderResultCard = (
        label: string,
        emoji: string,
        accentColor: string,
        data: ScanResult,
        delay: number
    ) => {
        const productName = data.product_name ?? 'Unknown Product';
        const priceScanned = data.price_scanned ?? 0;
        const fairPrice = data.fair_price ?? 0;
        const equityGap = data.equity_gap ?? 0;
        const currencySymbol = data.currency_symbol ?? currency ?? '$';
        const percentMarkup =
            fairPrice > 0 ? (((priceScanned - fairPrice) / fairPrice) * 100).toFixed(0) : '0';
        const hasTax = equityGap > 0;

        return (
            <Animated.View
                entering={FadeInDown.delay(delay).duration(600)}
                style={styles.card}
                key={label}
            >
                {/* Alert Banner */}
                <View
                    style={[
                        styles.alertBanner,
                        hasTax ? styles.alertBannerDanger : styles.alertBannerSuccess,
                    ]}
                >
                    <Text style={styles.alertBannerEmoji}>{hasTax ? '⚠️' : '✅'}</Text>
                    <View style={styles.alertBannerTextContainer}>
                        <Text style={[styles.alertBannerTitle, { color: hasTax ? '#FCA5A5' : '#86EFAC' }]}>
                            {hasTax ? `${label} Detected!` : 'Fair Price!'}
                        </Text>
                        <Text style={styles.alertBannerSub}>
                            {hasTax ? `${percentMarkup}% premium detected` : 'No markup found'}
                        </Text>
                    </View>
                </View>

                {/* Product info */}
                <View style={styles.cardSection}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardIcon}>{emoji}</Text>
                        <Text style={styles.cardTitle}>{productName}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Price Scanned</Text>
                        <Text style={styles.priceValue}>{currencySymbol}{Number(priceScanned).toFixed(2)}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Market Price</Text>
                        <Text style={[styles.priceValue, { color: '#10B981' }]}>
                            {currencySymbol}{Number(fairPrice).toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabelBold}>{label}</Text>
                        <Text
                            style={[styles.priceValueBold, { color: hasTax ? '#F87171' : '#10B981' }]}
                        >
                            {hasTax ? `+${currencySymbol}${Math.abs(Number(equityGap)).toFixed(2)}` : `${currencySymbol}0.00`}
                        </Text>
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.miniStatsRow}>
                    <View style={[styles.miniStat, { borderColor: accentColor + '30' }]}>
                        <Text style={[styles.miniStatValue, { color: accentColor }]}>{percentMarkup}%</Text>
                        <Text style={styles.miniStatLabel}>Markup</Text>
                    </View>
                    <View style={[styles.miniStat, { borderColor: '#10B98130' }]}>
                        <Text style={[styles.miniStatValue, { color: '#10B981' }]}>
                            {currencySymbol}{Math.abs(Number(equityGap)).toFixed(2)}
                        </Text>
                        <Text style={styles.miniStatLabel}>Savings</Text>
                    </View>
                </View>

                {/* Suggestion */}
                {hasTax && (
                    <View style={styles.suggestionBox}>
                        <Text style={styles.suggestionText}>
                            {label === 'Pink Tax'
                                ? `Look for the generic or male-equivalent version. You could save ${currencySymbol}${Math.abs(Number(equityGap)).toFixed(2)} per purchase.`
                                : `Check for the MRP label or compare at a local vendor. The fair price is ${currencySymbol}${Number(fairPrice).toFixed(2)}.`}
                        </Text>
                    </View>
                )}
            </Animated.View>
        );
    };

    // =====================================================================
    // RENDER: Success
    // =====================================================================
    const renderSuccess = () => {
        const hasGirl = !!analysisData.girl;
        const hasTravel = !!analysisData.travel;

        return (
            <>
                {/* Header */}
                <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                        <Text style={styles.backArrow}>←</Text>
                        <Text style={styles.backText}>Scan Again</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Results</Text>
                    <View style={styles.headerSpacer} />
                </Animated.View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Scanned image + location thumb row */}
                    <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.thumbRow}>
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.resultThumb} />
                        ) : null}
                        <View style={styles.thumbInfo}>
                            <Text style={styles.thumbTitle}>Scanned Product</Text>
                            {location?.city && (
                                <Text style={styles.thumbLocation}>
                                    📍 {location.city}{location.country ? `, ${location.country}` : ''}
                                </Text>
                            )}
                            <View style={styles.thumbModes}>
                                {hasGirl && (
                                    <View style={[styles.modeBadge, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
                                        <Text style={[styles.modeBadgeText, { color: '#EC4899' }]}>🚺 Girl</Text>
                                    </View>
                                )}
                                {hasTravel && (
                                    <View style={[styles.modeBadge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                                        <Text style={[styles.modeBadgeText, { color: '#3B82F6' }]}>🌍 Travel</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Animated.View>

                    {/* Girl mode results */}
                    {hasGirl && renderResultCard('Pink Tax', '🚺', '#EC4899', analysisData.girl!, 200)}

                    {/* Travel mode results */}
                    {hasTravel &&
                        renderResultCard('Tourist Tax', '🌍', '#3B82F6', analysisData.travel!, hasGirl ? 500 : 200)}

                    {/* Scan Another */}
                    <Animated.View entering={FadeInUp.delay(800).duration(600)}>
                        <TouchableOpacity style={styles.scanAgainButton} onPress={() => router.back()} activeOpacity={0.7}>
                            <Text style={styles.scanAgainText}>📷  Scan Another Product</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </>
        );
    };

    // =====================================================================
    // MAIN RENDER
    // =====================================================================
    return (
        <View style={styles.container}>
            {state === 'loading' && renderLoading()}
            {state === 'error' && renderError()}
            {state === 'success' && renderSuccess()}
        </View>
    );
}

// =====================================================================
// STYLES
// =====================================================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0E1A' },

    /* ---- Center container ---- */
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

    /* ---- Loading ---- */
    loadingCard: {
        backgroundColor: '#111827',
        borderRadius: 24,
        padding: 36,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.15)',
    },
    loadingTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 20 },
    loadingSubtitle: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center' },
    loadingThumb: {
        width: 80,
        height: 80,
        borderRadius: 12,
        marginTop: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    locationPill: {
        marginTop: 12,
        backgroundColor: 'rgba(129,140,248,0.1)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    locationPillText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    loadingModes: { flexDirection: 'row', gap: 10, marginTop: 12 },
    loadingModePill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    loadingModeText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

    /* ---- Error ---- */
    errorCard: {
        backgroundColor: '#111827',
        borderRadius: 24,
        padding: 36,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    errorEmoji: { fontSize: 48, marginBottom: 12 },
    errorTitle: { fontSize: 22, fontWeight: '700', color: '#FCA5A5', marginBottom: 8 },
    errorMessage: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryButton: {
        backgroundColor: '#818CF8',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 32,
        marginBottom: 12,
    },
    retryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    backLink: { paddingVertical: 8 },
    backLinkText: { fontSize: 14, color: '#64748B', fontWeight: '600' },

    /* ---- Header ---- */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'android' ? 48 : 24,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backArrow: { fontSize: 20, color: '#818CF8' },
    backText: { fontSize: 14, color: '#818CF8', fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
    headerSpacer: { width: 80 },

    /* ---- ScrollView ---- */
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },

    /* ---- Thumb row ---- */
    thumbRow: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    resultThumb: {
        width: 64,
        height: 64,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    thumbInfo: { flex: 1 },
    thumbTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
    thumbLocation: { fontSize: 12, color: '#818CF8', marginBottom: 6, fontWeight: '500' },
    thumbModes: { flexDirection: 'row', gap: 8 },
    modeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    modeBadgeText: { fontSize: 12, fontWeight: '600' },

    /* ---- Result card ---- */
    card: {
        backgroundColor: '#111827',
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
    },
    alertBannerDanger: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderBottomColor: 'rgba(239, 68, 68, 0.15)',
    },
    alertBannerSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderBottomColor: 'rgba(16, 185, 129, 0.15)',
    },
    alertBannerEmoji: { fontSize: 28 },
    alertBannerTextContainer: { flex: 1 },
    alertBannerTitle: { fontSize: 18, fontWeight: '800' },
    alertBannerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    cardSection: { padding: 18 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    cardIcon: { fontSize: 22 },
    cardTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', flex: 1 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },

    /* ---- Price rows ---- */
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    priceLabel: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
    priceValue: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },
    priceLabelBold: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },
    priceValueBold: { fontSize: 20, fontWeight: '800' },

    /* ---- Mini stats ---- */
    miniStatsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 14 },
    miniStat: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    miniStatValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    miniStatLabel: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    /* ---- Suggestion ---- */
    suggestionBox: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        padding: 18,
    },
    suggestionText: { fontSize: 13, color: '#94A3B8', lineHeight: 20, marginBottom: 14 },
    suggestionButton: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    suggestionButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

    /* ---- Scan Again ---- */
    scanAgainButton: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.15)',
    },
    scanAgainText: { fontSize: 16, fontWeight: '700', color: '#818CF8' },
});
