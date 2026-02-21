import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View,
    Dimensions,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    FadeIn,
    FadeInDown,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
    const router = useRouter();
    const pulseOpacity = useSharedValue(0.4);

    useEffect(() => {
        pulseOpacity.value = withRepeat(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const pulseStyle = useAnimatedStyle(() => ({
        opacity: pulseOpacity.value,
    }));

    const handleTap = () => {
        router.push('/scanner');
    };

    return (
        <TouchableWithoutFeedback onPress={handleTap}>
            <View style={styles.container}>
                {/* Background gradient circles */}
                <View style={styles.gradientCircle1} />
                <View style={styles.gradientCircle2} />
                <View style={styles.gradientCircle3} />

                {/* Logo area */}
                <Animated.View entering={FadeIn.duration(1200)} style={styles.logoContainer}>
                    <View style={styles.logoIconContainer}>
                        <Text style={styles.logoIcon}>⚖️</Text>
                    </View>
                    <Text style={styles.title}>Equi</Text>
                    <Text style={styles.titleAccent}>Spend</Text>
                </Animated.View>

                {/* Tagline */}
                <Animated.View entering={FadeInDown.delay(600).duration(1000)} style={styles.taglineContainer}>
                    <Text style={styles.tagline}>
                        Scan. Compare. Save.
                    </Text>
                    <Text style={styles.subtitle}>
                        Detect hidden price markups in real-time
                    </Text>
                </Animated.View>

                {/* Tap to start */}
                <Animated.View style={[styles.tapContainer, pulseStyle]}>
                    <Text style={styles.tapText}>Tap anywhere to start</Text>
                    <Text style={styles.tapArrow}>↓</Text>
                </Animated.View>

                {/* Bottom decorative line */}
                <View style={styles.bottomBar} />
            </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E1A',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    gradientCircle1: {
        position: 'absolute',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width * 0.6,
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        top: -width * 0.4,
        left: -width * 0.3,
    },
    gradientCircle2: {
        position: 'absolute',
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
        backgroundColor: 'rgba(236, 72, 153, 0.06)',
        bottom: -width * 0.2,
        right: -width * 0.2,
    },
    gradientCircle3: {
        position: 'absolute',
        width: width * 0.5,
        height: width * 0.5,
        borderRadius: width * 0.25,
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        bottom: height * 0.3,
        left: -width * 0.1,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    logoIconContainer: {
        marginRight: 12,
    },
    logoIcon: {
        fontSize: 48,
    },
    title: {
        fontSize: 52,
        fontWeight: '200',
        color: '#FFFFFF',
        letterSpacing: -1,
    },
    titleAccent: {
        fontSize: 52,
        fontWeight: '800',
        color: '#818CF8',
        letterSpacing: -1,
    },
    taglineContainer: {
        alignItems: 'center',
        marginBottom: 80,
    },
    tagline: {
        fontSize: 18,
        color: '#94A3B8',
        fontWeight: '600',
        letterSpacing: 4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '400',
        letterSpacing: 0.5,
    },
    tapContainer: {
        position: 'absolute',
        bottom: 100,
        alignItems: 'center',
    },
    tapText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
        letterSpacing: 1,
    },
    tapArrow: {
        fontSize: 18,
        color: '#64748B',
        marginTop: 4,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 40,
        width: 60,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#1E293B',
    },
});
