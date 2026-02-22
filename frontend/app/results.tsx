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
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiFetch from '../constants/fetch';
import { getToken } from '../constants/auth';

const { width } = Dimensions.get('window');

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

            if (location) {
                formData.append('latitude', String(location.latitude));
                formData.append('longitude', String(location.longitude));
                if (location.city) formData.append('city', location.city);
                if (location.state) formData.append('state', location.state);
                if (location.country) formData.append('country', location.country);
            }

            if (manualPrice !== null) {
                formData.append('manual_price', String(manualPrice));
            }
            formData.append('currency', currency);

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

            // Attach auth token if available
            const token = await getToken();
            const headers: Record<string, string> = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await apiFetch('/scan', {
                method: 'POST',
                headers,
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

            // Save to history
            saveToHistory(results);
        } catch (err: any) {
            setErrorMsg(err.message ?? 'Unknown error');
            setState('error');
        }
    };

    const saveToHistory = async (results: AnalysisData) => {
        try {
            const raw = await AsyncStorage.getItem('scan_history');
            const history = raw ? JSON.parse(raw) : [];
            const now = new Date().toISOString();
            const loc = location?.city
                ? [location.city, location.state, location.country].filter(Boolean).join(', ')
                : undefined;

            if (results.girl) {
                history.push({
                    id: `${now}-girl`,
                    date: now,
                    mode,
                    product_name: results.girl.product_name ?? 'Unknown Product',
                    price_scanned: results.girl.price_scanned ?? 0,
                    fair_price: results.girl.fair_price ?? 0,
                    equity_gap: results.girl.equity_gap ?? 0,
                    currency_symbol: results.girl.currency_symbol ?? currency ?? '$',
                    type: 'girl',
                    location: loc,
                });
            }
            if (results.travel) {
                history.push({
                    id: `${now}-travel`,
                    date: now,
                    mode,
                    product_name: results.travel.product_name ?? 'Unknown Product',
                    price_scanned: results.travel.price_scanned ?? 0,
                    fair_price: results.travel.fair_price ?? 0,
                    equity_gap: results.travel.equity_gap ?? 0,
                    currency_symbol: results.travel.currency_symbol ?? currency ?? '$',
                    type: 'travel',
                    location: loc,
                });
            }

            await AsyncStorage.setItem('scan_history', JSON.stringify(history));
        } catch (e) {
            // silently fail
        }
    };

    // =====================================================================
    // RENDER: Loading
    // =====================================================================
    const renderLoading = () => (
        <Animated.View entering={FadeIn.duration(600)} style={styles.centerContainer}>
            <View style={styles.loadingCard}>
                <ActivityIndicator color="#FF95B6" size="large" />
                <Text style={styles.loadingTitle}>Analyzing Product…</Text>
                <Text style={styles.loadingSubtitle}>
                    Running analysis algorithm
                </Text>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.loadingThumb} />
                ) : null}

                {location?.city && (
                    <View style={styles.locationPill}>
                        <Text style={styles.locationPillText}>
                            📍 {[location.city, location.state, location.country].filter(Boolean).join(', ')}
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
                        <Text style={[styles.alertBannerTitle, { color: hasTax ? '#DC2626' : '#059669' }]}>
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
                        <Text style={[styles.priceValue, { color: '#059669' }]}>
                            {currencySymbol}{Number(fairPrice).toFixed(2)}
                        </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabelBold}>{label}</Text>
                        <Text
                            style={[styles.priceValueBold, { color: hasTax ? '#DC2626' : '#059669' }]}
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
                    <View style={[styles.miniStat, { borderColor: '#05966930' }]}>
                        <Text style={[styles.miniStatValue, { color: '#059669' }]}>
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
                                    <View style={[styles.modeBadge, { backgroundColor: 'rgba(236,72,153,0.1)' }]}>
                                        <Text style={[styles.modeBadgeText, { color: '#EC4899' }]}>🚺 Girl</Text>
                                    </View>
                                )}
                                {hasTravel && (
                                    <View style={[styles.modeBadge, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
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
    container: { flex: 1, backgroundColor: '#FFF0F3' },

    /* ---- Center container ---- */
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

    /* ---- Loading ---- */
    loadingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 36,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 182, 0.2)',
    },
    loadingTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', marginTop: 20 },
    loadingSubtitle: { fontSize: 13, color: '#8A6B75', marginTop: 6, textAlign: 'center' },
    loadingThumb: {
        width: 80,
        height: 80,
        borderRadius: 12,
        marginTop: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    locationPill: {
        marginTop: 12,
        backgroundColor: 'rgba(255,149,182,0.1)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    locationPillText: { fontSize: 12, color: '#4A2035', fontWeight: '600' },
    loadingModes: { flexDirection: 'row', gap: 10, marginTop: 12 },
    loadingModePill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    loadingModeText: { fontSize: 12, color: '#4A2035', fontWeight: '600' },

    /* ---- Error ---- */
    errorCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 36,
        alignItems: 'center',
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    errorEmoji: { fontSize: 48, marginBottom: 12 },
    errorTitle: { fontSize: 22, fontWeight: '700', color: '#DC2626', marginBottom: 8 },
    errorMessage: { fontSize: 13, color: '#4A2035', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    retryButton: {
        backgroundColor: '#FF95B6',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 32,
        marginBottom: 12,
    },
    retryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    backLink: { paddingVertical: 8 },
    backLinkText: { fontSize: 14, color: '#8A6B75', fontWeight: '600' },

    /* ---- Header ---- */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'android' ? 48 : 24,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,149,182,0.15)',
    },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backArrow: { fontSize: 20, color: '#FF95B6' },
    backText: { fontSize: 14, color: '#FF95B6', fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.5 },
    headerSpacer: { width: 80 },

    /* ---- ScrollView ---- */
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },

    /* ---- Thumb row ---- */
    thumbRow: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        alignItems: 'center',
        gap: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    resultThumb: {
        width: 64,
        height: 64,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    thumbInfo: { flex: 1 },
    thumbTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
    thumbLocation: { fontSize: 12, color: '#FF95B6', marginBottom: 6, fontWeight: '500' },
    thumbModes: { flexDirection: 'row', gap: 8 },
    modeBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    modeBadgeText: { fontSize: 12, fontWeight: '600' },

    /* ---- Result card ---- */
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
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
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        borderBottomColor: 'rgba(239, 68, 68, 0.1)',
    },
    alertBannerSuccess: {
        backgroundColor: 'rgba(5, 150, 105, 0.06)',
        borderBottomColor: 'rgba(5, 150, 105, 0.1)',
    },
    alertBannerEmoji: { fontSize: 28 },
    alertBannerTextContainer: { flex: 1 },
    alertBannerTitle: { fontSize: 18, fontWeight: '800' },
    alertBannerSub: { fontSize: 12, color: '#8A6B75', marginTop: 2 },
    cardSection: { padding: 18 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    cardIcon: { fontSize: 22 },
    cardTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', flex: 1 },
    divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 12 },

    /* ---- Price rows ---- */
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 5,
    },
    priceLabel: { fontSize: 14, color: '#8A6B75', fontWeight: '500' },
    priceValue: { fontSize: 15, color: '#1A1A1A', fontWeight: '600' },
    priceLabelBold: { fontSize: 15, color: '#1A1A1A', fontWeight: '700' },
    priceValueBold: { fontSize: 20, fontWeight: '800' },

    /* ---- Mini stats ---- */
    miniStatsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 14 },
    miniStat: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: '#FFF6F8',
    },
    miniStatValue: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    miniStatLabel: {
        fontSize: 10,
        color: '#8A6B75',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    /* ---- Suggestion ---- */
    suggestionBox: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
        padding: 18,
    },
    suggestionText: { fontSize: 13, color: '#4A2035', lineHeight: 20, marginBottom: 14 },
    suggestionButton: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    suggestionButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

    /* ---- Scan Again ---- */
    scanAgainButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 182, 0.3)',
    },
    scanAgainText: { fontSize: 16, fontWeight: '700', color: '#FF95B6' },
});
