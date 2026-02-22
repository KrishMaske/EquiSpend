import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAuth, getUser } from '../constants/auth';
import { CURRENCIES } from '../constants/currencies';

export default function ProfileScreen() {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [saved, setSaved] = useState(false);
    const [homeCurrency, setHomeCurrency] = useState('USD');
    const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const user = await getUser();
            const data = await AsyncStorage.multiGet([
                'profile_firstName',
                'profile_lastName',
                'profile_username',
                'profile_email',
                'profile_phone',
                'profile_password',
                'profile_homeCurrency',
            ]);
            const map: Record<string, string> = {};
            data.forEach(([key, value]) => {
                if (value) map[key] = value;
            });

            const authEmail = user?.email ?? '';
            setFirstName(map['profile_firstName'] ?? '');
            setLastName(map['profile_lastName'] ?? '');
            setUsername(map['profile_username'] ?? '');
            setEmail(map['profile_email'] ?? authEmail);
            setPhone(map['profile_phone'] ?? '');
            setPassword(map['profile_password'] ?? '');
            setHomeCurrency(map['profile_homeCurrency'] ?? 'USD');
        } catch (e) {
        }
    };

    const handleSave = async () => {
        try {
            await AsyncStorage.multiSet([
                ['profile_firstName', firstName],
                ['profile_lastName', lastName],
                ['profile_username', username],
                ['profile_email', email],
                ['profile_phone', phone],
                ['profile_password', password],
                ['profile_homeCurrency', homeCurrency],
            ]);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <Text style={styles.backArrowText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={{ width: 28 }} />
                </Animated.View>

                <Animated.View entering={FadeIn.duration(800)} style={styles.avatarContainer}>
                    <Image source={require('../assets/logo.png')} style={styles.avatarImage} />
                    <Text style={styles.avatarLabel}>Your Profile</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.formContainer}>
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.halfInput]}>
                            <Text style={styles.inputLabel}>First Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="First name"
                                placeholderTextColor="#B8708A"
                                value={firstName}
                                onChangeText={setFirstName}
                                autoCapitalize="words"
                                returnKeyType="next"
                            />
                        </View>
                        <View style={[styles.inputGroup, styles.halfInput]}>
                            <Text style={styles.inputLabel}>Last Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Last name"
                                placeholderTextColor="#B8708A"
                                value={lastName}
                                onChangeText={setLastName}
                                autoCapitalize="words"
                                returnKeyType="next"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Username</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your username"
                            placeholderTextColor="#B8708A"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="next"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#B8708A"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            returnKeyType="next"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Phone Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your phone number"
                            placeholderTextColor="#B8708A"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            returnKeyType="next"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your password"
                            placeholderTextColor="#B8708A"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            returnKeyType="done"
                        />
                    </View>

                    <View style={styles.sectionDivider} />
                    <Text style={styles.sectionTitle}>Preferences</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Home Currency</Text>
                        <Text style={{ fontSize: 12, color: '#8A6B75', marginBottom: 8 }}>
                            Your preferred currency — used to show converted prices while traveling
                        </Text>
                        <TouchableOpacity
                            style={styles.currencySelector}
                            onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.currencySelectorText}>
                                {CURRENCIES.find(c => c.code === homeCurrency)?.symbol} {homeCurrency} — {CURRENCIES.find(c => c.code === homeCurrency)?.label}
                            </Text>
                            <Text style={styles.currencySelectorChevron}>{showCurrencyPicker ? '▲' : '▼'}</Text>
                        </TouchableOpacity>

                        {showCurrencyPicker && (
                            <View style={styles.currencyDropdown}>
                                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    {CURRENCIES.map((c) => (
                                        <TouchableOpacity
                                            key={c.code}
                                            style={[styles.currencyItem, homeCurrency === c.code && styles.currencyItemActive]}
                                            onPress={() => { setHomeCurrency(c.code); setShowCurrencyPicker(false); }}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.currencyItemSymbol}>{c.symbol}</Text>
                                            <Text style={styles.currencyItemLabel}>{c.code} — {c.label}</Text>
                                            {homeCurrency === c.code && <Text style={styles.currencyItemCheck}>✓</Text>}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSave}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.saveButtonText}>
                            {saved ? '✓ Saved!' : 'Save Changes'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: '#DC2626', marginTop: 12 }]}
                        onPress={async () => {
                            await clearAuth();
                            router.replace('/');
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.saveButtonText}>Log Out</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF0F3',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },

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
    backArrowText: {
        fontSize: 28,
        color: '#1A1A1A',
        fontWeight: '300',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: 0.5,
    },

    avatarContainer: {
        alignItems: 'center',
        paddingVertical: 28,
    },
    avatarImage: {
        width: 80,
        height: 80,
        resizeMode: 'contain',
        marginBottom: 10,
    },
    avatarLabel: {
        fontSize: 14,
        color: '#8A6B75',
        fontWeight: '500',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    formContainer: {
        paddingHorizontal: 24,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfInput: {
        flex: 1,
    },
    inputGroup: {
        marginBottom: 18,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 15,
        color: '#1A1A1A',
        fontWeight: '500',
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.25)',
    },
    saveButton: {
        backgroundColor: '#1A1A1A',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },

    sectionDivider: {
        height: 1,
        backgroundColor: 'rgba(255,149,182,0.2)',
        marginVertical: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8A6B75',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 16,
    },
    currencySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.25)',
    },
    currencySelectorText: {
        fontSize: 15,
        color: '#1A1A1A',
        fontWeight: '600',
    },
    currencySelectorChevron: {
        fontSize: 12,
        color: '#8A6B75',
    },
    currencyDropdown: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,149,182,0.2)',
        overflow: 'hidden',
    },
    currencyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.04)',
    },
    currencyItemActive: {
        backgroundColor: 'rgba(255,149,182,0.1)',
    },
    currencyItemSymbol: {
        fontSize: 16,
        color: '#FF95B6',
        width: 28,
        textAlign: 'center',
        fontWeight: '700',
    },
    currencyItemLabel: {
        flex: 1,
        fontSize: 14,
        color: '#4A2035',
        fontWeight: '500',
    },
    currencyItemCheck: {
        fontSize: 14,
        color: '#10B981',
        fontWeight: '700',
    },
});
