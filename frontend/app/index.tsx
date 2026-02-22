import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Dimensions,
    Image,
    ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { isLoggedIn } from '../constants/auth';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
    const router = useRouter();
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const loggedIn = await isLoggedIn();
                if (loggedIn) {
                    router.replace('/scanner');
                    return;
                }
            } catch (e) {
                // silently fail — show login screen
            }
            setCheckingAuth(false);
        };
        checkAuth();
    }, []);

    if (checkingAuth) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#FF95B6" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Background gradient circles */}
            <View style={styles.gradientCircle1} />
            <View style={styles.gradientCircle2} />
            <View style={styles.gradientCircle3} />

            {/* Logo area */}
            <Animated.View entering={FadeIn.duration(1200)} style={styles.logoContainer}>
                <View style={styles.logoIconContainer}>
                    <Image source={require('../assets/logo.png')} style={styles.logoImage} />
                </View>
                <View style={styles.brandRow}>
                    <Text style={styles.title}>Equi</Text>
                    <Text style={styles.titleAccent}>Spend</Text>
                </View>
            </Animated.View>

            {/* Tagline */}
            <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.taglineContainer}>
                <Text style={styles.tagline}>
                    Scan. Compare. Save.
                </Text>
                <Text style={styles.subtitle}>
                    Detect hidden price markups in real-time
                </Text>
            </Animated.View>

            {/* Buttons */}
            <Animated.View entering={FadeInDown.delay(800).duration(600)} style={styles.buttonsContainer}>
                <TouchableOpacity
                    style={styles.loginButton}
                    onPress={() => router.push('/login')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.loginButtonText}>Log In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.signUpButton}
                    onPress={() => router.push('/signup')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.signUpButtonText}>Sign Up</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Bottom decorative line */}
            <View style={styles.bottomBar} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#FFF0F3',
    },
    gradientCircle1: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        backgroundColor: 'rgba(255, 149, 182, 0.12)',
        top: -width * 0.4,
        left: -width * 0.3,
    },
    gradientCircle2: {
        position: 'absolute',
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
        backgroundColor: 'rgba(255, 182, 193, 0.15)',
        bottom: -width * 0.2,
        right: -width * 0.2,
    },
    gradientCircle3: {
        position: 'absolute',
        width: width * 0.5,
        height: width * 0.5,
        borderRadius: width * 0.25,
        backgroundColor: 'rgba(255, 200, 210, 0.12)',
        bottom: height * 0.3,
        left: -width * 0.1,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoIconContainer: {
        marginBottom: 12,
    },
    logoImage: {
        width: 140,
        height: 140,
        resizeMode: 'contain',
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 52,
        fontWeight: '200',
        color: '#1A1A1A',
        letterSpacing: -1,
    },
    titleAccent: {
        fontSize: 52,
        fontWeight: '800',
        color: '#FF95B6',
        letterSpacing: -1,
    },
    taglineContainer: {
        alignItems: 'center',
        marginBottom: 56,
    },
    tagline: {
        fontSize: 18,
        color: '#4A2035',
        fontWeight: '600',
        letterSpacing: 4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#8A6B75',
        fontWeight: '400',
        letterSpacing: 0.5,
    },

    /* ---- Buttons ---- */
    buttonsContainer: {
        width: '100%',
        paddingHorizontal: 40,
        gap: 14,
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
    signUpButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#1A1A1A',
    },
    signUpButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: 0.5,
    },

    bottomBar: {
        position: 'absolute',
        bottom: 40,
        width: 60,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFCDD9',
    },
});
