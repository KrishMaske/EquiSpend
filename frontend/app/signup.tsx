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

export default function SignUpScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignUp = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Please enter your email and password.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await apiFetch('/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.detail ?? 'Sign up failed. Please try again.');
            }

            const loginRes = await apiFetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const loginJson = await loginRes.json();

            if (loginRes.ok && loginJson.access_token) {
                await saveAuth(loginJson.access_token, loginJson.user);
            }

            await AsyncStorage.setItem('user_name', name.trim());
            await AsyncStorage.setItem('user_email', email.trim());
            await AsyncStorage.setItem('user_logged_in', 'true');
            await AsyncStorage.setItem('profile_firstName', name.trim().split(' ')[0] ?? '');
            await AsyncStorage.setItem('profile_lastName', name.trim().split(' ').slice(1).join(' '));
            await AsyncStorage.setItem('profile_email', email.trim());

            router.replace('/scanner');
        } catch (e: any) {
            setError(e.message ?? 'Sign up failed. Please try again.');
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
                <TouchableOpacity style={styles.backArrow} onPress={() => router.back()} activeOpacity={0.7}>
                    <Text style={styles.backArrowText}>←</Text>
                </TouchableOpacity>

                <Animated.View entering={FadeIn.duration(800)} style={styles.brandContainer}>
                    <Image source={require('../assets/logo.png')} style={styles.logoImage} />
                    <View style={styles.brandRow}>
                        <Text style={styles.brandName}>Equi</Text>
                        <Text style={styles.brandAccent}>Spend</Text>
                    </View>
                    <Text style={styles.brandTagline}>Create your account</Text>
                    <Text style={styles.brandSubtitle}>Sign Up</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your full name"
                            placeholderTextColor="#B8708A"
                            value={name}
                            onChangeText={(text) => { setName(text); setError(''); }}
                            autoCapitalize="words"
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
                            onChangeText={(text) => { setEmail(text); setError(''); }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            returnKeyType="next"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Create Password</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Create a password"
                            placeholderTextColor="#B8708A"
                            value={password}
                            onChangeText={(text) => { setPassword(text); setError(''); }}
                            secureTextEntry
                            returnKeyType="done"
                            onSubmitEditing={handleSignUp}
                        />
                    </View>

                    {error ? (
                        <Text style={{ color: '#DC2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.signUpButton, loading && { opacity: 0.6 }]}
                        onPress={handleSignUp}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        <Text style={styles.signUpButtonText}>{loading ? 'Creating account…' : 'Sign Up'}</Text>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.bottomContainer}>
                    <View style={styles.loginRow}>
                        <Text style={styles.loginText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7}>
                            <Text style={styles.loginLink}>Log In</Text>
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
        marginBottom: 40,
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
    signUpButton: {
        backgroundColor: '#1A1A1A',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 8,
    },
    signUpButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },

    bottomContainer: {
        alignItems: 'center',
        marginTop: 'auto',
        paddingTop: 24,
    },
    loginRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loginText: {
        fontSize: 14,
        color: '#4A2035',
        fontWeight: '400',
    },
    loginLink: {
        fontSize: 14,
        color: '#1A1A1A',
        fontWeight: '700',
    },
});
