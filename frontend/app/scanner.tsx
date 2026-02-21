import { useRouter } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
    Image,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Animated, { FadeIn, FadeInDown, SlideInUp } from 'react-native-reanimated';
import { setSharedImage, setSharedLocation } from '../image-store';

const { width } = Dimensions.get('window');
const PREVIEW_SIZE = width > 500 ? 320 : width * 0.65;

export default function ScannerScreen() {
    const router = useRouter();
    const [girlActive, setGirlActive] = useState(true);
    const [travelActive, setTravelActive] = useState(false);
    const [imageUri, setImageUri] = useState<string | null>(null);

    // Location state
    const [locationLoading, setLocationLoading] = useState(true);
    const [locationCity, setLocationCity] = useState<string | null>(null);
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

            // Reverse geocode to get city & country
            const [geo] = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });

            if (geo) {
                setLocationCity(geo.city ?? geo.subregion ?? geo.region ?? null);
                setLocationCountry(geo.country ?? null);
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

    // ---- Take a photo (native camera or web file input with capture) ----
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

    // ---- Pick from photo library ----
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

    // ---- Web file input handler ----
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

    // ---- Navigate to results ----
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

        // Store image + location in shared memory
        setSharedImage(imageUri);
        setSharedLocation(
            locationCoords
                ? {
                    ...locationCoords,
                    city: locationCity ?? undefined,
                    country: locationCountry ?? undefined,
                }
                : null
        );

        router.push({
            pathname: '/results',
            params: { mode: getMode() },
        });
    };

    const bothActive = girlActive && travelActive;
    const scanButtonColor = bothActive
        ? '#8B5CF6'
        : girlActive
            ? '#EC4899'
            : travelActive
                ? '#3B82F6'
                : '#334155';

    const locationDisplay = locationLoading
        ? 'Detecting…'
        : locationCity && locationCountry
            ? `${locationCity}, ${locationCountry}`
            : locationCity ?? locationCountry ?? 'Unknown';

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

            {/* Location banner */}
            <Animated.View entering={FadeIn.duration(500)} style={styles.locationBanner}>
                <Text style={styles.locationIcon}>📍</Text>
                <View style={styles.locationTextGroup}>
                    <Text style={styles.locationLabel}>Your Location</Text>
                    {locationLoading ? (
                        <View style={styles.locationLoadingRow}>
                            <ActivityIndicator size="small" color="#818CF8" />
                            <Text style={styles.locationValue}>Detecting…</Text>
                        </View>
                    ) : locationError ? (
                        <TouchableOpacity onPress={getLocation} activeOpacity={0.7}>
                            <Text style={[styles.locationValue, { color: '#F87171' }]}>
                                {locationError} — Tap to retry
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Text style={styles.locationValue}>{locationDisplay}</Text>
                    )}
                </View>
                {!locationLoading && !locationError && (
                    <TouchableOpacity onPress={getLocation} activeOpacity={0.7} style={styles.locationRefresh}>
                        <Text style={styles.locationRefreshText}>↻</Text>
                    </TouchableOpacity>
                )}
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

                            <View style={styles.placeholderContent}>
                                <Text style={styles.placeholderEmoji}>📷</Text>
                                <Text style={styles.placeholderText}>
                                    Take a photo or upload an image
                                </Text>
                                <Text style={styles.placeholderSubText}>
                                    Point at a product, price tag, or receipt
                                </Text>
                            </View>
                        </View>

                        <View style={styles.captureButtons}>
                            <TouchableOpacity
                                style={styles.captureButton}
                                onPress={takePhoto}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.captureEmoji}>📸</Text>
                                <Text style={styles.captureText}>Camera</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.captureButton}
                                onPress={pickImage}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.captureEmoji}>🖼️</Text>
                                <Text style={styles.captureText}>Upload</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Bottom controls */}
            <Animated.View entering={SlideInUp.duration(600)} style={styles.controlsPanel}>
                {/* Mode Toggles */}
                <Animated.View
                    entering={FadeInDown.delay(200).duration(500)}
                    style={styles.modeToggleContainer}
                >
                    <Text style={styles.modeLabel}>Analysis Modes</Text>
                    <Text style={styles.modeHint}>Select one or both</Text>
                    <View style={styles.modeToggle}>
                        <TouchableOpacity
                            style={[styles.modeButton, girlActive && styles.modeButtonActiveGirl]}
                            onPress={() => setGirlActive((p) => !p)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modeEmoji}>🚺</Text>
                            <View style={styles.modeTextGroup}>
                                <Text style={[styles.modeButtonText, girlActive && styles.modeButtonTextActive]}>
                                    Girl Mode
                                </Text>
                                <Text style={styles.modeButtonSub}>Pink Tax</Text>
                            </View>
                            {girlActive && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modeButton, travelActive && styles.modeButtonActiveTravel]}
                            onPress={() => setTravelActive((p) => !p)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.modeEmoji}>🌍</Text>
                            <View style={styles.modeTextGroup}>
                                <Text style={[styles.modeButtonText, travelActive && styles.modeButtonTextActive]}>
                                    Travel Mode
                                </Text>
                                <Text style={styles.modeButtonSub}>Tourist Tax</Text>
                            </View>
                            {travelActive && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>
                    </View>
                </Animated.View>

                {/* Analyze Button */}
                <Animated.View entering={FadeInDown.delay(400).duration(500)}>
                    <TouchableOpacity
                        style={[
                            styles.analyzeButton,
                            { backgroundColor: atLeastOneMode ? scanButtonColor : '#334155' },
                            !imageUri && styles.analyzeButtonDim,
                        ]}
                        onPress={handleAnalyze}
                        activeOpacity={0.7}
                    >
                        <View style={styles.analyzeButtonInner}>
                            <Text style={styles.analyzeButtonIcon}>🔍</Text>
                            <Text style={styles.analyzeButtonText}>
                                {imageUri ? 'Analyze Product' : 'Select an Image First'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                <Text style={styles.modeDescription}>
                    {bothActive
                        ? 'Checks for both Pink Tax and Tourist Tax on this product'
                        : girlActive
                            ? 'Detects the "Pink Tax" – price gaps on gendered products'
                            : travelActive
                                ? 'Detects the "Tourist Tax" – inflated prices for travelers'
                                : 'Select a mode to begin analysis'}
                </Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
    },

    /* ---- Location banner ---- */
    locationBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111827',
        paddingTop: Platform.OS === 'ios' ? 56 : Platform.OS === 'android' ? 44 : 16,
        paddingBottom: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(129, 140, 248, 0.1)',
        gap: 10,
    },
    locationIcon: {
        fontSize: 22,
    },
    locationTextGroup: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 10,
        color: '#64748B',
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
        color: '#E2E8F0',
        fontWeight: '600',
    },
    locationRefresh: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(129, 140, 248, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationRefreshText: {
        fontSize: 18,
        color: '#818CF8',
        fontWeight: '700',
    },

    /* ---- Camera area ---- */
    cameraArea: {
        flex: 1,
        backgroundColor: '#111827',
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
        borderColor: 'rgba(129, 140, 248, 0.15)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderContent: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    placeholderEmoji: {
        fontSize: 56,
        marginBottom: 16,
    },
    placeholderText: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '600',
        textAlign: 'center',
    },
    placeholderSubText: {
        fontSize: 13,
        color: '#475569',
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
        backgroundColor: '#1E293B',
        paddingVertical: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.15)',
    },
    captureEmoji: {
        fontSize: 20,
    },
    captureText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#94A3B8',
    },
    previewContainer: {
        width: PREVIEW_SIZE + 20,
        height: PREVIEW_SIZE + 20,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(129, 140, 248, 0.3)',
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
        backgroundColor: 'rgba(0,0,0,0.6)',
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
        borderColor: '#818CF8',
    },
    cornerTL: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 20 },
    cornerTR: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 20 },
    cornerBL: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 20 },
    cornerBR: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 20 },

    /* ---- Controls panel ---- */
    controlsPanel: {
        backgroundColor: '#0F1629',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 36,
        borderTopWidth: 1,
        borderTopColor: 'rgba(129, 140, 248, 0.1)',
    },
    modeToggleContainer: { marginBottom: 18 },
    modeLabel: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    modeHint: { fontSize: 11, color: '#475569', marginBottom: 10 },
    modeToggle: { flexDirection: 'row', gap: 12 },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: '#1E293B',
        borderWidth: 1.5,
        borderColor: '#1E293B',
        gap: 8,
    },
    modeButtonActiveGirl: { backgroundColor: 'rgba(236, 72, 153, 0.12)', borderColor: '#EC4899' },
    modeButtonActiveTravel: { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: '#3B82F6' },
    modeEmoji: { fontSize: 20 },
    modeTextGroup: { flex: 1 },
    modeButtonText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    modeButtonTextActive: { color: '#FFFFFF' },
    modeButtonSub: { fontSize: 11, color: '#475569', marginTop: 1 },
    checkmark: { fontSize: 16, fontWeight: '700', color: '#10B981' },

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
    analyzeButtonIcon: { fontSize: 20 },
    analyzeButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },

    /* ---- Mode description ---- */
    modeDescription: { fontSize: 13, color: '#475569', textAlign: 'center', lineHeight: 18 },
});
