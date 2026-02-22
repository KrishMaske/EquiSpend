import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import apiFetch from '../constants/fetch';
import { saveAuth } from '../constants/auth';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Please enter your email and password.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.detail ?? 'Invalid email or password');
            }

            // Store auth token and user data
            await saveAuth(json.access_token, json.user);
            await AsyncStorage.setItem('user_email', email.trim());
            await AsyncStorage.setItem('user_logged_in', 'true');

            // Replace stack so user can't go back to login/home
            router.replace('/scanner');
        } catch (e: any) {
            setError(e.message ?? 'Login failed. Please try again.');
        } finally {
            setLoading(false);
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
                {/* Back arrow */}
                <TouchableOpacity style={styles.backArrow} onPress={() => router.back()} activeOpacity={0.7}>
                    <Text style={styles.backArrowText}>←</Text>
                </TouchableOpacity>

                {/* Logo / Brand */}
                <Animated.View entering={FadeIn.duration(800)} style={styles.brandContainer}>
                    <Image source={require('../assets/logo.png')} style={styles.logoImage} />
                    <View style={styles.brandRow}>
                        <Text style={styles.brandName}>Equi</Text>
                        <Text style={styles.brandAccent}>Spend</Text>
                    </View>
                    <Text style={styles.brandTagline}>Scan. Compare. Save.</Text>
                    <Text style={styles.brandSubtitle}>Login</Text>
                </Animated.View>

                {/* Form */}
                <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your email"
                            placeholderTextColor="#B8708A"
                            value={email}
                            onChangeText={(text) => { setEmail(text); setError(''); }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
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
                            onChangeText={(text) => { setPassword(text); setError(''); }}
                            secureTextEntry
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                        />
                    </View>

                    {error ? (
                        <Text style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text>
                    ) : null}

                    <TouchableOpacity style={styles.forgotPassword} activeOpacity={0.7}>
                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.loginButton, loading && { opacity: 0.6 }]}
                        onPress={handleLogin}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        <Text style={styles.loginButtonText}>{loading ? 'Logging in…' : 'Log In'}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Bottom */}
                <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.bottomContainer}>
                    <View style={styles.signupRow}>
                        <Text style={styles.signupText}>Don't have an account? </Text>
                        <TouchableOpacity activeOpacity={0.7}>
                            <Text style={styles.signupLink}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFD6E0',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
        paddingBottom: 40,
    },

    /* ---- Brand ---- */
    backArrow: {
        alignSelf: 'flex-start',
        marginBottom: 16,
    },
    backArrowText: {
        fontSize: 28,
        color: '#1A1A1A',
        fontWeight: '300',
    },
    brandContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoImage: {
        width: 120,
        height: 120,
        resizeMode: 'contain',
        marginBottom: 12,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandName: {
        fontSize: 42,
        fontWeight: '200',
        color: '#1A1A1A',
        letterSpacing: -1,
    },
    brandAccent: {
        fontSize: 42,
        fontWeight: '800',
        color: '#1A1A1A',
        letterSpacing: -1,
    },
    brandTagline: {
        fontSize: 14,
        color: '#4A2035',
        fontWeight: '500',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginTop: 8,
    },
    brandSubtitle: {
        fontSize: 28,
        color: '#1A1A1A',
        fontWeight: '700',
        marginTop: 20,
        textAlign: 'center',
    },

    /* ---- Form ---- */
    formContainer: {
        marginBottom: 32,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        fontSize: 16,
        color: '#1A1A1A',
        fontWeight: '500',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 28,
    },
    forgotPasswordText: {
        fontSize: 13,
        color: '#1A1A1A',
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: '#1A1A1A',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
    },
    loginButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },

    /* ---- Bottom ---- */
    bottomContainer: {
        alignItems: 'center',
        marginTop: 'auto',
        paddingTop: 24,
    },
    signupRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    signupText: {
        fontSize: 14,
        color: '#4A2035',
        fontWeight: '400',
    },
    signupLink: {
        fontSize: 14,
        color: '#1A1A1A',
        fontWeight: '700',
    },
});
