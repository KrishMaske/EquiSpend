import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
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
    TextInput,
    KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { getSharedImage, getSharedLocation, getSharedManualPrice, IdentifiedProduct } from '../image-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiFetch from '../constants/fetch';
import { getToken } from '../constants/auth';
import { CURRENCIES, CURRENCY_SYMBOLS } from '../constants/currencies';

const { width } = Dimensions.get('window');

interface ScanResult {
    product_name?: string;
    price_scanned?: number;
    fair_price?: number;
    equity_gap?: number;
    currency_symbol?: string;
    comparable_product?: string;
    source?: string;
}

interface AnalysisData {
    girl?: ScanResult;
    travel?: ScanResult;
    general?: ScanResult;
}

type Phase = 'identifying' | 'verify' | 'analyzing' | 'results' | 'error';

export default function ResultsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode: string }>();

    const imageUri = getSharedImage() ?? '';
    const location = getSharedLocation();
    const { currency } = getSharedManualPrice();
    const mode = params.mode ?? 'girl';

    const [phase, setPhase] = useState<Phase>('identifying');
    const [product, setProduct] = useState<IdentifiedProduct | null>(null);
    const [userPrice, setUserPrice] = useState('');
    const [analysisData, setAnalysisData] = useState<AnalysisData>({});
    const [errorMsg, setErrorMsg] = useState('');

    // Editable product fields
    const [editBrand, setEditBrand] = useState('');
    const [editName, setEditName] = useState('');

    // Currency
    const [scanCurrency, setScanCurrency] = useState(currency);
    const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
    const [homeCurrency, setHomeCurrency] = useState<string>(currency);
    const [homeCurrencySymbol, setHomeCurrencySymbol] = useState<string>(CURRENCY_SYMBOLS[currency] || '$');
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);

    useEffect(() => {
        identifyProduct();
    }, []);

    useEffect(() => {
        const loadHomeCurrency = async () => {
            try {
                const saved = await AsyncStorage.getItem('profile_homeCurrency');
                if (saved) {
                    setHomeCurrency(saved);
                    setHomeCurrencySymbol(CURRENCY_SYMBOLS[saved] || saved);
                }
            } catch {}
        };
        loadHomeCurrency();
    }, []);

    const fetchExchangeRate = async (from: string, to: string) => {
        if (from === to) { setExchangeRate(null); return; }
        try {
            const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
            const data = await res.json();
            if (data.result === 'success' && data.rates?.[to]) {
                setExchangeRate(data.rates[to]);
            }
        } catch {
            setExchangeRate(null);
        }
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 1: Send image to /scan/identify
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const identifyProduct = async () => {
        setPhase('identifying');
        setErrorMsg('');

        try {
            const formData = new FormData();

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

            const token = await getToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await apiFetch('/scan/identify', {
                method: 'POST',
                headers,
                body: formData,
            });

            const json = await res.json();

            if (json.status !== 'success') {
                throw new Error(json.detail ?? json.message ?? 'Identification failed.');
            }

            const data = json.data as IdentifiedProduct;
            setProduct(data);
            setEditBrand(data.brand);
            setEditName(data.product_name);
            setPhase('verify');
        } catch (err: any) {
            setErrorMsg(err.message ?? 'Failed to identify product');
            setPhase('error');
        }
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHASE 2: Send confirmed data + price to /scan/analyze
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const runAnalysis = async () => {
        if (!userPrice || isNaN(Number(userPrice))) {
            setErrorMsg('Please enter a valid price.');
            return;
        }

        setPhase('analyzing');
        setErrorMsg('');

        try {
            const formData = new FormData();
            formData.append('mode', mode);
            formData.append('brand', editBrand || product?.brand || '');
            formData.append('product_name', editName || product?.product_name || '');
            formData.append('category', product?.category || '');
            formData.append('volume', product?.volume || '');
            formData.append('gender_marketing', product?.gender_marketing || 'unisex');
            formData.append('user_price', userPrice);
            formData.append('currency', scanCurrency);

            if (location) {
                if (location.city) formData.append('city', location.city);
                if (location.state) formData.append('state', location.state);
                if (location.country) formData.append('country', location.country);
            }

            const token = await getToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await apiFetch('/scan/analyze', {
                method: 'POST',
                headers,
                body: formData,
            });

            const json = await res.json();

            if (json.status !== 'success') {
                throw new Error(json.detail ?? json.message ?? 'Analysis failed.');
            }

            const results: AnalysisData = {};
            if (mode === 'both') {
                results.girl = json.data.girl;
                results.travel = json.data.travel;
            } else if (mode === 'general') {
                results.general = json.data.general;
            } else {
                results[mode as keyof AnalysisData] = json.data;
            }

            setAnalysisData(results);
            setPhase('results');
            saveToHistory(results);
            fetchExchangeRate(scanCurrency, homeCurrency);
        } catch (err: any) {
            setErrorMsg(err.message ?? 'Analysis failed');
            setPhase('error');
        }
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Save to history
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
                    currency_symbol: results.girl.currency_symbol ?? scanCurrency ?? '$',
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
                    currency_symbol: results.travel.currency_symbol ?? scanCurrency ?? '$',
                    type: 'travel',
                    location: loc,
                });
            }
            if (results.general) {
                history.push({
                    id: `${now}-general`,
                    date: now,
                    mode,
                    product_name: results.general.product_name ?? 'Unknown Product',
                    price_scanned: results.general.price_scanned ?? 0,
                    fair_price: results.general.fair_price ?? 0,
                    equity_gap: results.general.equity_gap ?? 0,
                    currency_symbol: results.general.currency_symbol ?? scanCurrency ?? '$',
                    type: 'general',
                    location: loc,
                });
            }

            await AsyncStorage.setItem('scan_history', JSON.stringify(history));
        } catch (e) {
            // silently fail
        }
    };

    // =====================================================================
    // RENDER: Identifying (Phase 1 loading)
    // =====================================================================
    const renderIdentifying = () => (
        <Animated.View entering={FadeIn.duration(600)} style={styles.centerContainer}>
            <View style={styles.loadingCard}>
                <ActivityIndicator color="#FF95B6" size="large" />
                <Text style={styles.loadingTitle}>Identifying Product…</Text>
                <Text style={styles.loadingSubtitle}>
                    Analyzing the image to detect your product
                </Text>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.loadingThumb} />
                ) : null}
            </View>
        </Animated.View>
    );

    // =====================================================================
    // RENDER: Verify (user confirms product + enters price)
    // =====================================================================
    const renderVerify = () => (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.verifyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <Animated.View entering={FadeIn.duration(600)} style={styles.verifyHeader}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                        <Text style={styles.backArrow}>←</Text>
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Verify Product</Text>
                    <View style={styles.headerSpacer} />
                </Animated.View>

                {/* Product image + detected info */}
                <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.verifyCard}>
                    <View style={styles.verifyImageRow}>
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.verifyImage} />
                        ) : null}
                        <View style={styles.verifyBadges}>
                            <View style={[styles.genderBadge, {
                                backgroundColor: product?.gender_marketing === 'women'
                                    ? 'rgba(236,72,153,0.1)'
                                    : product?.gender_marketing === 'men'
                                        ? 'rgba(59,130,246,0.1)'
                                        : 'rgba(139,92,246,0.1)'
                            }]}>
                                <Text style={[styles.genderBadgeText, {
                                    color: product?.gender_marketing === 'women'
                                        ? '#EC4899'
                                        : product?.gender_marketing === 'men'
                                            ? '#3B82F6'
                                            : '#8B5CF6'
                                }]}>
                                    {product?.gender_marketing === 'women' ? '🚺 Women' :
                                        product?.gender_marketing === 'men' ? '🚹 Men' : '⚪ Unisex'}
                                </Text>
                            </View>
                            {product?.category ? (
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryBadgeText}>{product.category}</Text>
                                </View>
                            ) : null}
                            {product?.volume ? (
                                <View style={styles.volumeBadge}>
                                    <Text style={styles.volumeBadgeText}>{product.volume}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    {/* AI description */}
                    {product?.description ? (
                        <Text style={styles.aiDescription}>🤖  {product.description}</Text>
                    ) : null}

                    <View style={styles.divider} />

                    {/* Editable fields */}
                    <Text style={styles.fieldLabel}>Brand</Text>
                    <TextInput
                        style={styles.fieldInput}
                        value={editBrand}
                        onChangeText={setEditBrand}
                        placeholder="Brand name"
                        placeholderTextColor="#C4A8B2"
                    />

                    <Text style={styles.fieldLabel}>Product Name</Text>
                    <TextInput
                        style={styles.fieldInput}
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Product name"
                        placeholderTextColor="#C4A8B2"
                    />

                    <View style={styles.divider} />

                    {/* Price input */}
                    <Text style={styles.priceInputLabel}>💰 Enter the price you see</Text>
                    <View style={styles.priceInputRow}>
                        <TouchableOpacity onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}>
                            <Text style={styles.currencyLabel}>{scanCurrency} ▼</Text>
                        </TouchableOpacity>
                        <TextInput
                            style={styles.priceInput}
                            value={userPrice}
                            onChangeText={setUserPrice}
                            placeholder="0.00"
                            placeholderTextColor="#C4A8B2"
                            keyboardType="decimal-pad"
                            autoFocus={false}
                        />
                    </View>

                    {showCurrencyPicker && (
                        <View style={styles.verifyCurrencyDropdown}>
                            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {CURRENCIES.map((c) => (
                                    <TouchableOpacity
                                        key={c.code}
                                        style={[styles.verifyCurrencyOption, scanCurrency === c.code && styles.verifyCurrencyOptionActive]}
                                        onPress={() => { setScanCurrency(c.code); setShowCurrencyPicker(false); }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.verifyCurrencySymbol}>{c.symbol}</Text>
                                        <Text style={styles.verifyCurrencyLabel}>{c.code} — {c.label}</Text>
                                        {scanCurrency === c.code && <Text style={styles.verifyCurrencyCheck}>✓</Text>}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Mode info */}
                    <View style={styles.modeInfoRow}>
                        {(mode === 'girl' || mode === 'both') && (
                            <View style={[styles.modePill, { borderColor: '#EC4899' }]}>
                                <Text style={styles.modePillText}>🚺 Pink Tax</Text>
                            </View>
                        )}
                        {(mode === 'travel' || mode === 'both') && (
                            <View style={[styles.modePill, { borderColor: '#3B82F6' }]}>
                                <Text style={styles.modePillText}>🌍 Tourist Tax</Text>
                            </View>
                        )}
                        {mode === 'general' && (
                            <View style={[styles.modePill, { borderColor: '#F59E0B' }]}>
                                <Text style={styles.modePillText}>💰 Price Gouging</Text>
                            </View>
                        )}
                    </View>

                    {location?.city && (
                        <View style={styles.locationPill}>
                            <Text style={styles.locationPillText}>
                                📍 {[location.city, location.state, location.country].filter(Boolean).join(', ')}
                            </Text>
                        </View>
                    )}
                </Animated.View>

                {/* Action buttons */}
                <Animated.View entering={FadeInUp.delay(300).duration(600)}>
                    <TouchableOpacity
                        style={[styles.analyzeButton, (!userPrice || isNaN(Number(userPrice))) && styles.analyzeButtonDisabled]}
                        onPress={runAnalysis}
                        activeOpacity={0.7}
                        disabled={!userPrice || isNaN(Number(userPrice))}
                    >
                        <Text style={styles.analyzeButtonText}>🔍  Run Analysis</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.rescanButton} onPress={() => router.back()} activeOpacity={0.7}>
                        <Text style={styles.rescanButtonText}>📷  Wrong product? Scan again</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );

    // =====================================================================
    // RENDER: Analyzing (Phase 2 loading)
    // =====================================================================
    const renderAnalyzing = () => (
        <Animated.View entering={FadeIn.duration(600)} style={styles.centerContainer}>
            <View style={styles.loadingCard}>
                <ActivityIndicator color="#FF95B6" size="large" />
                <Text style={styles.loadingTitle}>Finding Comparison…</Text>
                <Text style={styles.loadingSubtitle}>
                    {mode === 'travel'
                        ? 'Searching for the standard retail price'
                        : mode === 'general'
                            ? 'Comparing against fair online prices'
                            : 'Finding a comparable product to compare pricing'}
                </Text>
                <View style={styles.analyzeProductInfo}>
                    <Text style={styles.analyzeProductName}>{editName || product?.product_name}</Text>
                    <Text style={styles.analyzeProductBrand}>{editBrand || product?.brand}</Text>
                    <Text style={styles.analyzeProductPrice}>Your price: {scanCurrency} {userPrice}</Text>
                </View>

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
                    {mode === 'general' && (
                        <View style={[styles.loadingModePill, { borderColor: '#F59E0B' }]}>
                            <Text style={styles.loadingModeText}>💰 Price Gouging</Text>
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
                <Text style={styles.errorTitle}>Something went wrong</Text>
                <Text style={styles.errorMessage}>{errorMsg}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={identifyProduct} activeOpacity={0.7}>
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
        const currencySymbol = data.currency_symbol ?? scanCurrency ?? '$';
        const comparableProduct = data.comparable_product ?? '';
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
                        <Text style={styles.priceLabel}>Your Price</Text>
                        <Text style={styles.priceValue}>{currencySymbol}{Number(priceScanned).toFixed(2)}</Text>
                    </View>
                    {exchangeRate !== null && scanCurrency !== homeCurrency && (
                        <Text style={styles.convertedPrice}>
                            ≈ {homeCurrencySymbol}{(Number(priceScanned) * exchangeRate).toFixed(2)} {homeCurrency}
                        </Text>
                    )}
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>
                            {label === 'Pink Tax' ? 'Comparable Price' : 'Market Price'}
                        </Text>
                        <Text style={[styles.priceValue, { color: '#059669' }]}>
                            {fairPrice > 0 ? `${currencySymbol}${Number(fairPrice).toFixed(2)}` : 'Not found'}
                        </Text>
                    </View>
                    {exchangeRate !== null && scanCurrency !== homeCurrency && fairPrice > 0 && (
                        <Text style={styles.convertedPrice}>
                            ≈ {homeCurrencySymbol}{(Number(fairPrice) * exchangeRate).toFixed(2)} {homeCurrency}
                        </Text>
                    )}

                    {/* Show what we compared against */}
                    {comparableProduct ? (
                        <View style={styles.comparedToRow}>
                            <Text style={styles.comparedToLabel}>
                                {label === 'Pink Tax' ? '🔄 Compared to:' : '🏪 Source:'}
                            </Text>
                            <Text style={styles.comparedToValue} numberOfLines={2}>{comparableProduct}</Text>
                        </View>
                    ) : null}

                    <View style={styles.divider} />
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabelBold}>{label}</Text>
                        <Text
                            style={[styles.priceValueBold, { color: hasTax ? '#DC2626' : '#059669' }]}
                        >
                            {hasTax ? `+${currencySymbol}${Math.abs(Number(equityGap)).toFixed(2)}` : `${currencySymbol}0.00`}
                        </Text>
                    </View>
                    {exchangeRate !== null && scanCurrency !== homeCurrency && hasTax && (
                        <Text style={styles.convertedPrice}>
                            ≈ +{homeCurrencySymbol}{(Math.abs(Number(equityGap)) * exchangeRate).toFixed(2)} {homeCurrency}
                        </Text>
                    )}
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
                                ? `Look for the generic or ${product?.gender_marketing === 'women' ? 'male' : 'female'}-equivalent version. You could save ${currencySymbol}${Math.abs(Number(equityGap)).toFixed(2)} per purchase.`
                                : label === 'Price Gouging'
                                    ? `This product may be overpriced. The fair online price is ${currencySymbol}${Number(fairPrice).toFixed(2)}. You could save ${currencySymbol}${Math.abs(Number(equityGap)).toFixed(2)}.`
                                    : `Check for the MRP label or compare at a local vendor. The fair price is ${currencySymbol}${Number(fairPrice).toFixed(2)}.`}
                        </Text>
                    </View>
                )}
            </Animated.View>
        );
    };

    // =====================================================================
    // RENDER: Results
    // =====================================================================
    const renderResults = () => {
        const hasGirl = !!analysisData.girl;
        const hasTravel = !!analysisData.travel;
        const hasGeneral = !!analysisData.general;

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
                    {/* Scanned image + info row */}
                    <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.thumbRow}>
                        {imageUri ? (
                            <Image source={{ uri: imageUri }} style={styles.resultThumb} />
                        ) : null}
                        <View style={styles.thumbInfo}>
                            <Text style={styles.thumbTitle}>{editName || product?.product_name || 'Product'}</Text>
                            <Text style={styles.thumbBrand}>{editBrand || product?.brand}</Text>
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
                                {hasGeneral && (
                                    <View style={[styles.modeBadge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                                        <Text style={[styles.modeBadgeText, { color: '#F59E0B' }]}>💰 Price Check</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Animated.View>

                    {/* Pink Tax results */}
                    {hasGirl && renderResultCard('Pink Tax', '🚺', '#EC4899', analysisData.girl!, 200)}

                    {/* Tourist Tax results */}
                    {hasTravel &&
                        renderResultCard('Tourist Tax', '🌍', '#3B82F6', analysisData.travel!, hasGirl ? 500 : 200)}

                    {/* General Price Gouging results */}
                    {hasGeneral &&
                        renderResultCard('Price Gouging', '💰', '#F59E0B', analysisData.general!, (hasGirl || hasTravel) ? 800 : 200)}

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
            {phase === 'identifying' && renderIdentifying()}
            {phase === 'verify' && renderVerify()}
            {phase === 'analyzing' && renderAnalyzing()}
            {phase === 'results' && renderResults()}
            {phase === 'error' && renderError()}
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
        alignSelf: 'flex-start',
    },
    locationPillText: { fontSize: 12, color: '#4A2035', fontWeight: '600' },
    loadingModes: { flexDirection: 'row', gap: 10, marginTop: 12 },
    loadingModePill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    loadingModeText: { fontSize: 12, color: '#4A2035', fontWeight: '600' },

    /* ---- Analyzing phase ---- */
    analyzeProductInfo: { alignItems: 'center', marginTop: 16, gap: 4 },
    analyzeProductName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
    analyzeProductBrand: { fontSize: 13, color: '#8A6B75', fontWeight: '500' },
    analyzeProductPrice: { fontSize: 14, color: '#FF95B6', fontWeight: '600', marginTop: 4 },

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
    verifyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backArrow: { fontSize: 20, color: '#FF95B6' },
    backText: { fontSize: 14, color: '#FF95B6', fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.5 },
    headerSpacer: { width: 80 },

    /* ---- ScrollView ---- */
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    verifyContent: {
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'android' ? 48 : 24,
        paddingBottom: 40,
    },

    /* ---- Verify card ---- */
    verifyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    verifyImageRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
        marginBottom: 14,
    },
    verifyImage: {
        width: 90,
        height: 90,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    verifyBadges: { flex: 1, gap: 8, flexDirection: 'row', flexWrap: 'wrap' },
    genderBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    genderBadgeText: { fontSize: 13, fontWeight: '700' },
    categoryBadge: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(139,92,246,0.1)',
    },
    categoryBadgeText: { fontSize: 13, fontWeight: '600', color: '#8B5CF6' },
    volumeBadge: {
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(107,114,128,0.1)',
    },
    volumeBadgeText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
    aiDescription: {
        fontSize: 13,
        color: '#4A2035',
        lineHeight: 20,
        marginBottom: 8,
        fontStyle: 'italic',
    },

    /* ---- Fields ---- */
    fieldLabel: { fontSize: 12, fontWeight: '700', color: '#8A6B75', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldInput: {
        backgroundColor: '#FFF6F8',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.2)',
    },

    /* ---- Price input ---- */
    priceInputLabel: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginTop: 8, marginBottom: 8 },
    priceInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF6F8',
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#FF95B6',
        overflow: 'hidden',
    },
    currencyLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FF95B6',
        paddingHorizontal: 14,
    },
    priceInput: {
        flex: 1,
        fontSize: 22,
        fontWeight: '800',
        color: '#1A1A1A',
        paddingVertical: 14,
        paddingRight: 14,
    },

    /* ---- Mode info row ---- */
    modeInfoRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    modePill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    modePillText: { fontSize: 12, color: '#4A2035', fontWeight: '600' },

    /* ---- Buttons ---- */
    analyzeButton: {
        backgroundColor: '#FF95B6',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        marginBottom: 12,
    },
    analyzeButtonDisabled: { opacity: 0.4 },
    analyzeButtonText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
    rescanButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 182, 0.3)',
        marginBottom: 12,
    },
    rescanButtonText: { fontSize: 14, fontWeight: '600', color: '#8A6B75' },

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
    thumbTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
    thumbBrand: { fontSize: 13, color: '#8A6B75', fontWeight: '500', marginBottom: 4 },
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

    /* ---- Compared to row ---- */
    comparedToRow: {
        marginTop: 6,
        padding: 10,
        backgroundColor: 'rgba(139,92,246,0.05)',
        borderRadius: 10,
    },
    comparedToLabel: { fontSize: 11, fontWeight: '700', color: '#8B5CF6', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
    comparedToValue: { fontSize: 13, color: '#4A2035', lineHeight: 18 },

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

    /* ---- Verify Currency Dropdown ---- */
    verifyCurrencyDropdown: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 182, 0.25)',
        overflow: 'hidden',
    },
    verifyCurrencyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.04)',
    },
    verifyCurrencyOptionActive: {
        backgroundColor: 'rgba(255, 149, 182, 0.08)',
    },
    verifyCurrencySymbol: {
        fontSize: 15,
        color: '#D46A92',
        fontWeight: '700',
        width: 24,
        textAlign: 'center',
    },
    verifyCurrencyLabel: {
        flex: 1,
        fontSize: 13,
        color: '#4A2035',
    },
    verifyCurrencyCheck: {
        fontSize: 14,
        color: '#059669',
        fontWeight: '700',
    },

    /* ---- Converted Price ---- */
    convertedPrice: {
        fontSize: 12,
        color: '#8A6B75',
        fontStyle: 'italic',
        textAlign: 'right',
        marginTop: -2,
        marginBottom: 4,
        paddingHorizontal: 18,
    },
});
