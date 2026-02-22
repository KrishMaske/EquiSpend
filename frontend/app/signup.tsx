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

export default function SignUpScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSignUp = async () => {
        // Save user info
        try {
            await AsyncStorage.setItem('user_name', name);
            await AsyncStorage.setItem('user_email', email);
            await AsyncStorage.setItem('user_logged_in', 'true');
        } catch (e) {
            // silently fail
        }
        // Replace stack so user can't go back to signup/home
        router.replace('/scanner');
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

                {/* Brand */}
                <Animated.View entering={FadeIn.duration(800)} style={styles.brandContainer}>
                    <Image source={require('../assets/logo.png')} style={styles.logoImage} />
                    <View style={styles.brandRow}>
                        <Text style={styles.brandName}>Equi</Text>
                        <Text style={styles.brandAccent}>Spend</Text>
                    </View>
                    <Text style={styles.brandTagline}>Create your account</Text>
                    <Text style={styles.brandSubtitle}>Sign Up</Text>
                </Animated.View>

                {/* Form */}
                <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter your full name"
                            placeholderTextColor="#B8708A"
                            value={name}
                            onChangeText={setName}
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
                            onChangeText={setEmail}
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
                            onChangeText={setPassword}
                            secureTextEntry
                            returnKeyType="done"
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.signUpButton}
                        onPress={handleSignUp}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.signUpButtonText}>Sign Up</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Bottom */}
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

    /* ---- Bottom ---- */
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
