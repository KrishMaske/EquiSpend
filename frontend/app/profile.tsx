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

export default function ProfileScreen() {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [saved, setSaved] = useState(false);

    // Load saved profile data on mount
    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            // Load user data from auth if profile fields are empty
            const user = await getUser();
            const data = await AsyncStorage.multiGet([
                'profile_firstName',
                'profile_lastName',
                'profile_username',
                'profile_email',
                'profile_phone',
                'profile_password',
            ]);
            const map: Record<string, string> = {};
            data.forEach(([key, value]) => {
                if (value) map[key] = value;
            });

            // Pre-fill email from auth user if not saved in profile yet
            const authEmail = user?.email ?? '';
            setFirstName(map['profile_firstName'] ?? '');
            setLastName(map['profile_lastName'] ?? '');
            setUsername(map['profile_username'] ?? '');
            setEmail(map['profile_email'] ?? authEmail);
            setPhone(map['profile_phone'] ?? '');
            setPassword(map['profile_password'] ?? '');
        } catch (e) {
            // silently fail
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
            ]);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            // silently fail
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
                {/* Header */}
                <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                        <Text style={styles.backArrowText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Profile</Text>
                    <View style={{ width: 28 }} />
                </Animated.View>

                {/* Avatar area */}
                <Animated.View entering={FadeIn.duration(800)} style={styles.avatarContainer}>
                    <Image source={require('../assets/logo.png')} style={styles.avatarImage} />
                    <Text style={styles.avatarLabel}>Your Profile</Text>
                </Animated.View>

                {/* Form */}
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

    /* ---- Avatar ---- */
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

    /* ---- Form ---- */
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
});
