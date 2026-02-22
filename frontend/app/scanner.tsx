import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions,
    Image,
    Alert,
    Platform,
    ActivityIndicator,
    ScrollView,
    Switch,
    Modal,
    KeyboardAvoidingView,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, { FadeIn, FadeInDown, SlideInUp } from 'react-native-reanimated';
import { setSharedImage, setSharedLocation, setSharedManualPrice } from '../image-store';

const CURRENCIES = [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'GBP', symbol: '£', label: 'British Pound' },
    { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
    { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
    { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
    { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
    { code: 'CHF', symbol: 'Fr', label: 'Swiss Franc' },
    { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
    { code: 'MXN', symbol: '$', label: 'Mexican Peso' },
    { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
    { code: 'KRW', symbol: '₩', label: 'South Korean Won' },
    { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
    { code: 'SAR', symbol: '﷼', label: 'Saudi Riyal' },
    { code: 'THB', symbol: '฿', label: 'Thai Baht' },
    { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah' },
    { code: 'TRY', symbol: '₺', label: 'Turkish Lira' },
    { code: 'ZAR', symbol: 'R', label: 'South African Rand' },
    { code: 'SEK', symbol: 'kr', label: 'Swedish Krona' },
];

const POPULAR_COUNTRIES = [
    'France', 'Japan', 'Spain', 'Italy', 'Germany', 'Mexico', 'Brazil',
    'China', 'South Korea', 'India', 'Thailand', 'Vietnam', 'Indonesia',
    'United Arab Emirates', 'Saudi Arabia', 'Egypt', 'Turkey',
    'Russia', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Argentina'
];

const { width } = Dimensions.get('window');
const PREVIEW_SIZE = width > 500 ? 380 : width * 0.85;

export default function ScannerScreen() {
    const router = useRouter();
    const [girlActive, setGirlActive] = useState(true);
    const [travelActive, setTravelActive] = useState(false);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    // Manual price override state (collapsed by default — price is auto-detected)
    const [showManualPrice, setShowManualPrice] = useState(false);
    const [manualPriceText, setManualPriceText] = useState('');
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [searchLocationText, setSearchLocationText] = useState('');

    // Location state
    const [locationLoading, setLocationLoading] = useState(true);
    const [locationCity, setLocationCity] = useState<string | null>(null);
    const [locationState, setLocationState] = useState<string | null>(null);
    const [locationCountry, setLocationCountry] = useState<string | null>(null);
    const [locationCoords, setLocationCoords] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    // Web file input ref
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // ---- Fetch location on mount ----
    useEffect(() => {
        getLocation();
    }, []);

    const getLocation = async () => {
        setLocationLoading(true);
        setLocationError(null);
        try {
            if (Platform.OS === 'web') {
                const res = await fetch('https://ipapi.co/json/');
                if (!res.ok) throw new Error('IP geolocation failed');
                const data = await res.json();
                if (data.error) throw new Error(data.reason ?? 'IP geolocation error');
                setLocationCoords({
                    latitude: data.latitude,
                    longitude: data.longitude,
                });
                setLocationCity(data.city ?? null);
                setLocationState(data.region ?? null);
                setLocationCountry(data.country_name ?? null);
            } else {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocationError('Location permission denied');
                    setLocationLoading(false);
                    return;
                }

                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                setLocationCoords({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });

                const [geo] = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                });

                if (geo) {
                    setLocationCity(geo.city ?? geo.subregion ?? null);
                    setLocationState(geo.region ?? null);
                    setLocationCountry(geo.country ?? null);
                }
            }
        } catch (e: any) {
            setLocationError(e.message ?? 'Could not get location');
        } finally {
            setLocationLoading(false);
        }
    };

    const getMode = (): string => {
        if (girlActive && travelActive) return 'both';
        if (girlActive) return 'girl';
        if (travelActive) return 'travel';
        return 'girl';
    };

    const atLeastOneMode = girlActive || travelActive;

    const takePhoto = async () => {
        if (Platform.OS === 'web') {
            if (fileInputRef.current) {
                fileInputRef.current.setAttribute('capture', 'environment');
                fileInputRef.current.click();
            }
            return;
        }

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Needed', 'EquiSpend needs camera access to scan products.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
        });

        if (!result.canceled && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
        }
    };

    const pickImage = async () => {
        if (Platform.OS === 'web') {
            if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture');
                fileInputRef.current.click();
            }
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Needed', 'EquiSpend needs photo library access.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [1, 1],
        });

        if (!result.canceled && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleWebFileSelect = (event: any) => {
        const file = event.target?.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setImageUri(reader.result as string);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }
    };

    const handleAnalyze = () => {
        if (!imageUri) {
            if (Platform.OS === 'web') {
                window.alert('Please take a photo or upload an image first.');
            } else {
                Alert.alert('No Image', 'Take a photo or upload an image first.');
            }
            return;
        }
        if (!atLeastOneMode) {
            if (Platform.OS === 'web') {
                window.alert('Select at least one analysis mode.');
            } else {
                Alert.alert('No Mode Selected', 'Select at least one analysis mode.');
            }
            return;
        }

        setSharedImage(imageUri);
        setSharedLocation(
            locationCoords
                ? {
                    ...locationCoords,
                    city: locationCity ?? undefined,
                    state: locationState ?? undefined,
                    country: locationCountry ?? undefined,
                }
                : null
        );
        const parsedPrice = manualPriceText.trim() !== '' ? parseFloat(manualPriceText) : null;
        setSharedManualPrice(!isNaN(parsedPrice as number) ? parsedPrice : null, selectedCurrency);

        router.push({
            pathname: '/results',
            params: { mode: getMode() },
        });
    };

    const bothActive = girlActive && travelActive;
    const scanButtonColor = bothActive
        ? '#D46A92'
        : girlActive
            ? '#EC4899'
            : travelActive
                ? '#3B82F6'
                : '#C8AAB2';

    const locationDisplay = locationLoading
        ? 'Detecting…'
        : [locationCity, locationState, locationCountry].filter(Boolean).join(', ') || 'Unknown';

    return (
        <View style={styles.container}>
            {/* Hidden file input for web */}
            {Platform.OS === 'web' && (
                <input
                    ref={fileInputRef as any}
                    type="file"
                    accept="image/*"
                    aria-label="Upload product image"
                    onChange={handleWebFileSelect}
                    style={{ display: 'none' }}
                />
            )}

            {/* Location Picker Modal */}
            <Modal
                visible={showLocationPicker}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowLocationPicker(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowLocationPicker(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                            <KeyboardAvoidingView
                                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                                style={styles.modalKeyboardAvoid}
                            >
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Where are you playing?</Text>
                                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowLocationPicker(false)}>
                                            <Text style={styles.modalCloseText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Type a country or city..."
                                        placeholderTextColor="#B8708A"
                                        value={searchLocationText}
                                        onChangeText={setSearchLocationText}
                                        onSubmitEditing={() => {
                                            if (searchLocationText.trim()) {
                                                setLocationCountry(searchLocationText.trim());
                                                setLocationCity(null);
                                                setShowLocationPicker(false);
                                            }
                                        }}
                                        returnKeyType="search"
                                    />
                                    <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                                        {POPULAR_COUNTRIES.filter(c => c.toLowerCase().includes(searchLocationText.toLowerCase())).map((country) => (
                                            <TouchableOpacity
                                                key={country}
                                                style={styles.modalOption}
                                                onPress={() => {
                                                    setLocationCountry(country);
                                                    setLocationCity(null);
                                                    setShowLocationPicker(false);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.modalOptionText}>{country}</Text>
                                                {locationCountry === country && <Text style={styles.modalOptionCheck}>✓</Text>}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                    <TouchableOpacity style={styles.modalAutoBtn} onPress={() => { setShowLocationPicker(false); getLocation(); }} activeOpacity={0.7}>
                                        <Text style={styles.modalAutoBtnText}>📍 Auto-Detect Location</Text>
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Location banner */}
            <Animated.View entering={FadeIn.duration(500)} style={styles.locationBannerContainer}>
                <View style={styles.locationBannerRow}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <TouchableOpacity style={styles.locationTextGroup} activeOpacity={0.7} onPress={() => setShowLocationPicker(true)}>
                        <Text style={styles.locationLabel}>Your Location</Text>
                        {locationLoading ? (
                            <View style={styles.locationLoadingRow}>
                                <ActivityIndicator size="small" color="#FF95B6" />
                                <Text style={styles.locationValue}>Detecting…</Text>
                            </View>
                        ) : locationError ? (
                            <Text style={[styles.locationValue, { color: '#DC2626' }]}>
                                {locationError} — Tap to edit
                            </Text>
                        ) : (
                            <Text style={styles.locationValue}>{locationDisplay} ✎</Text>
                        )}
                    </TouchableOpacity>
                    {!locationLoading && !locationError && (
                        <TouchableOpacity onPress={getLocation} activeOpacity={0.7} style={styles.locationRefresh}>
                            <Text style={styles.locationRefreshText}>↻</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.locationButtonGroup}>
                    <TouchableOpacity onPress={() => router.push('/history')} activeOpacity={0.7} style={styles.profileButton}>
                        <Text style={styles.profileButtonText}>History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.7} style={styles.profileButton}>
                        <Text style={styles.profileButtonText}>Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        setSharedLocation(
                            locationCoords
                                ? { ...locationCoords, city: locationCity ?? undefined, state: locationState ?? undefined, country: locationCountry ?? undefined }
                                : locationCity || locationCountry
                                    ? { latitude: 0, longitude: 0, city: locationCity ?? undefined, state: locationState ?? undefined, country: locationCountry ?? undefined }
                                    : null
                        );
                        router.push('/talk');
                    }} activeOpacity={0.7} style={[styles.profileButton, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                        <Text style={[styles.profileButtonText, { color: '#3B82F6' }]}>Haggle</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* Image preview / capture area */}
            <View style={styles.cameraArea}>
                {imageUri ? (
                    <Animated.View entering={FadeIn.duration(400)} style={styles.previewContainer}>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={() => setImageUri(null)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.clearButtonText}>✕</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <View style={styles.placeholderContainer}>
                        <View style={styles.scanBox}>
                            <View style={[styles.corner, styles.cornerTL]} />
                            <View style={[styles.corner, styles.cornerTR]} />
                            <View style={[styles.corner, styles.cornerBL]} />
                            <View style={[styles.corner, styles.cornerBR]} />

                            {Platform.OS !== 'web' && cameraPermission?.granted ? (
                                <CameraView style={styles.cameraPreview} facing="back" />
                            ) : (
                                <View style={styles.placeholderContent}>
                                    <Text style={styles.placeholderEmoji}>Scan</Text>
                                    <Text style={styles.placeholderText}>
                                        Point at a product
                                    </Text>
                                </View>
                            )}

                            {/* Capture button inside scan box */}
                            <TouchableOpacity
                                style={styles.captureCircle}
                                onPress={takePhoto}
                                activeOpacity={0.7}
                            >
                                <View style={styles.captureCircleInner} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Bottom controls */}
            <Animated.View entering={SlideInUp.duration(600)} style={styles.controlsPanel}>

                <TouchableOpacity
                    onPress={() => setShowAdvanced(!showAdvanced)}
                    activeOpacity={0.7}
                    style={styles.advancedToggle}
                >
                    <Text style={styles.advancedToggleText}>
                        {showAdvanced ? 'Hide Advanced Options ▲' : 'Show Advanced Options (Modes & Price) ▼'}
                    </Text>
                </TouchableOpacity>

                {showAdvanced && (
                    <View>
                        {/* Manual Price Input — auto-detected by default */}
                        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.priceInputContainer}>
                            <Text style={{ fontSize: 12, fontFamily: 'Avenir', color: '#8A6B75', marginBottom: 6 }}>
                                Price is auto-detected from the image.
                            </Text>
                            <TouchableOpacity
                                onPress={() => { setShowManualPrice((p) => !p); if (showManualPrice) { setManualPriceText(''); setShowCurrencyPicker(false); } }}
                                activeOpacity={0.7}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: showManualPrice ? 10 : 0 }}
                            >
                                <Text style={{ fontSize: 12, fontFamily: 'Avenir', fontWeight: '700', color: '#FF95B6' }}>
                                    {showManualPrice ? '▾ Hide manual override' : '▸ Enter price manually'}
                                </Text>
                            </TouchableOpacity>

                            {showManualPrice && (
                                <>
                                    <View style={styles.priceRow}>
                                        <TouchableOpacity
                                            style={styles.currencyButton}
                                            onPress={() => setShowCurrencyPicker((p) => !p)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.currencyButtonText}>
                                                {selectedCurrency} {CURRENCIES.find(c => c.code === selectedCurrency)?.symbol}
                                            </Text>
                                            <Text style={styles.currencyChevron}>{showCurrencyPicker ? '▲' : '▼'}</Text>
                                        </TouchableOpacity>

                                        <TextInput
                                            style={styles.priceInput}
                                            placeholder="e.g. 12.99"
                                            placeholderTextColor="#B8708A"
                                            keyboardType="decimal-pad"
                                            value={manualPriceText}
                                            onChangeText={setManualPriceText}
                                            returnKeyType="done"
                                            accessibilityLabel="Manual price input"
                                        />
                                        {manualPriceText.length > 0 && (
                                            <TouchableOpacity onPress={() => setManualPriceText('')} style={styles.priceClearBtn}>
                                                <Text style={styles.priceClearText}>✕</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {showCurrencyPicker && (
                                        <View style={styles.currencyDropdown}>
                                            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                                                {CURRENCIES.map((c) => (
                                                    <TouchableOpacity
                                                        key={c.code}
                                                        style={[
                                                            styles.currencyOption,
                                                            selectedCurrency === c.code && styles.currencyOptionActive,
                                                        ]}
                                                        onPress={() => {
                                                            setSelectedCurrency(c.code);
                                                            setShowCurrencyPicker(false);
                                                        }}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={styles.currencyOptionSymbol}>{c.symbol}</Text>
                                                        <Text style={styles.currencyOptionLabel}>{c.code} — {c.label}</Text>
                                                        {selectedCurrency === c.code && (
                                                            <Text style={styles.currencyOptionCheck}>✓</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </>
                            )}
                        </Animated.View>

                        {/* Mode Toggle Switch */}
                        <Animated.View
                            entering={FadeInDown.delay(100).duration(300)}
                            style={styles.modeToggleContainer}
                        >
                            <Text style={styles.modeLabel}>Analysis Modes</Text>
                            <View style={styles.toggleRow}>
                                <View style={styles.toggleItem}>
                                    <Text style={[styles.toggleLabel, girlActive && styles.toggleLabelActive]}>Pink Tax</Text>
                                    <Switch
                                        value={girlActive}
                                        onValueChange={setGirlActive}
                                        trackColor={{ false: '#E8D5DB', true: '#FFCDD9' }}
                                        thumbColor={girlActive ? '#EC4899' : '#C8AAB2'}
                                        ios_backgroundColor="#E8D5DB"
                                    />
                                </View>
                                <View style={styles.toggleItem}>
                                    <Text style={[styles.toggleLabel, travelActive && styles.toggleLabelActiveTravel]}>Travel</Text>
                                    <Switch
                                        value={travelActive}
                                        onValueChange={setTravelActive}
                                        trackColor={{ false: '#E8D5DB', true: '#93C5FD' }}
                                        thumbColor={travelActive ? '#3B82F6' : '#C8AAB2'}
                                        ios_backgroundColor="#E8D5DB"
                                    />
                                </View>
                            </View>
                        </Animated.View>
                    </View>
                )}

                {/* Analyze Button */}
                <Animated.View entering={FadeInDown.delay(200).duration(500)}>
                    <TouchableOpacity
                        style={[
                            styles.analyzeButton,
                            { backgroundColor: !imageUri ? '#FF95B6' : (atLeastOneMode ? scanButtonColor : '#C8AAB2') },
                        ]}
                        onPress={imageUri ? handleAnalyze : pickImage}
                        activeOpacity={0.7}
                    >
                        <View style={styles.analyzeButtonInner}>
                            <Text style={styles.analyzeButtonIcon}>
                                {imageUri ? '✨' : '📸'}
                            </Text>
                            <Text style={styles.analyzeButtonText}>
                                {imageUri ? 'Analyze Product' : 'Upload Photos to Scan'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                <Text style={styles.modeDescription}>
                    {bothActive
                        ? 'Checks for Pink Tax & Tourist Tax'
                        : girlActive
                            ? 'Detects price gaps on gendered products'
                            : travelActive
                                ? 'Detects inflated prices for travelers'
                                : 'Select a mode to begin'}
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF0F3',
    },

    /* ---- Location banner ---- */
    locationBannerContainer: {
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 44 : 16,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 149, 182, 0.2)',
    },
    locationBannerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    locationButtonGroup: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'flex-start',
    },
    locationIcon: {
        fontSize: 20,
    },
    locationTextGroup: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 10,
        color: '#8A6B75',
        fontFamily: 'Avenir',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 1,
    },
    locationLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    locationValue: {
        fontSize: 15,
        color: '#1A1A1A',
        fontFamily: 'Avenir',
        fontWeight: '600',
    },
    locationRefresh: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 149, 182, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationRefreshText: {
        fontSize: 18,
        color: '#FF95B6',
        fontWeight: '700',
    },
    profileButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 149, 182, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileButtonText: {
        fontSize: 11,
        fontFamily: 'Avenir',
        fontWeight: '700',
        color: '#FF95B6',
        letterSpacing: 0.3,
    },

    /* ---- Camera area ---- */
    cameraArea: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        gap: 28,
    },
    scanBox: {
        width: PREVIEW_SIZE,
        height: PREVIEW_SIZE,
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 182, 0.15)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    cameraPreview: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },
    placeholderContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    placeholderEmoji: {
        fontSize: 28,
        fontFamily: 'Avenir',
        fontWeight: '800',
        color: '#FF95B6',
        marginBottom: 16,
    },
    placeholderText: {
        fontSize: 16,
        color: '#4A2035',
        fontFamily: 'Avenir',
        fontWeight: '600',
        textAlign: 'center',
    },
    placeholderSubText: {
        fontSize: 13,
        fontFamily: 'Avenir',
        color: '#8A6B75',
        marginTop: 6,
        textAlign: 'center',
    },
    captureButtons: {
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 40,
    },
    captureButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 149, 182, 0.2)',
    },
    captureCircle: {
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    captureCircleInner: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
    },
    captureEmoji: {
        fontSize: 13,
        fontFamily: 'Avenir',
        fontWeight: '600',
        color: '#FF95B6',
    },
    captureText: {
        fontSize: 15,
        fontFamily: 'Avenir',
        fontWeight: '600',
        color: '#4A2035',
    },
    previewContainer: {
        width: PREVIEW_SIZE + 20,
        height: PREVIEW_SIZE + 20,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255, 149, 182, 0.4)',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
    },
    clearButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    corner: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderColor: '#FF95B6',
    },
    cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 20 },
    cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 20 },
    cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 20 },
    cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 20 },

    /* ---- Controls panel ---- */
    controlsPanel: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 40 : 36,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 149, 182, 0.15)',
    },
    advancedToggle: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    advancedToggleText: {
        color: '#8A6B75',
        fontSize: 12,
        fontFamily: 'Avenir',
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    /* ---- Manual price input ---- */
    priceInputContainer: { marginBottom: 16 },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    currencyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F3',
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.3)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 6,
        minWidth: 90,
    },
    currencyButtonText: { fontSize: 13, fontWeight: '700', color: '#FF95B6' },
    currencyChevron: { fontSize: 10, color: '#8A6B75' },
    priceInput: {
        flex: 1,
        backgroundColor: '#FFF0F3',
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.3)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#1A1A1A',
        fontWeight: '600',
    },
    priceClearBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,149,182,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    priceClearText: { fontSize: 14, color: '#8A6B75', fontWeight: '700' },
    currencyDropdown: {
        marginTop: 6,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.25)',
        overflow: 'hidden',
    },
    currencyOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.04)',
    },
    currencyOptionActive: { backgroundColor: 'rgba(255,149,182,0.1)' },
    currencyOptionSymbol: { fontSize: 15, color: '#FF95B6', width: 24, textAlign: 'center' },
    currencyOptionLabel: { flex: 1, fontSize: 13, color: '#4A2035', fontWeight: '500' },
    currencyOptionCheck: { fontSize: 14, color: '#10B981', fontWeight: '700' },
    modeToggleContainer: { marginBottom: 18 },
    modeLabel: {
        fontSize: 13,
        color: '#8A6B75',
        fontFamily: 'Avenir',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        backgroundColor: '#FFF6F8',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    toggleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    toggleLabel: {
        fontSize: 15,
        fontFamily: 'Avenir',
        fontWeight: '600',
        color: '#C8AAB2',
    },
    toggleLabelActive: {
        color: '#EC4899',
        fontWeight: '800',
    },
    toggleLabelActiveTravel: {
        color: '#3B82F6',
        fontWeight: '800',
    },

    /* ---- Analyze button ---- */
    analyzeButton: {
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    analyzeButtonDim: { opacity: 0.5 },
    analyzeButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    analyzeButtonIcon: { fontSize: 14, fontFamily: 'Avenir', fontWeight: '700', color: '#FFFFFF' },
    analyzeButtonText: { fontSize: 17, fontFamily: 'Avenir', fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },

    /* ---- Mode description ---- */
    modeDescription: { fontSize: 13, fontFamily: 'Avenir', color: '#8A6B75', textAlign: 'center', lineHeight: 18 },

    /* ---- Modal Styles ---- */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 14, 26, 0.5)',
        justifyContent: 'flex-end',
    },
    modalKeyboardAvoid: {
        width: '100%',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF0F3',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#D46A92',
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalCloseText: {
        fontSize: 18,
        color: '#8A6B75',
        fontWeight: '800',
    },
    modalInput: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.3)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#1A1A1A',
        fontWeight: '600',
        marginBottom: 16,
    },
    modalList: {
        maxHeight: 300,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.15)',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,149,182,0.1)',
        justifyContent: 'space-between',
    },
    modalOptionText: {
        fontSize: 15,
        color: '#4A2035',
        fontWeight: '600',
    },
    modalOptionCheck: {
        fontSize: 16,
        color: '#D46A92',
        fontWeight: '800',
    },
    modalAutoBtn: {
        marginTop: 20,
        backgroundColor: 'rgba(255,149,182,0.15)',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    modalAutoBtnText: {
        color: '#D46A92',
        fontSize: 15,
        fontWeight: '700',
    },
});
