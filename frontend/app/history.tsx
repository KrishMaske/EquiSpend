import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

interface Transaction {
    id: string;
    date: string;
    mode: string;
    product_name: string;
    price_scanned: number;
    fair_price: number;
    equity_gap: number;
    currency_symbol: string;
    type: 'girl' | 'travel';
    location?: string;
}

export default function HistoryScreen() {
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useFocusEffect(
        useCallback(() => {
            loadTransactions();
        }, [])
    );

    const loadTransactions = async () => {
        try {
            const raw = await AsyncStorage.getItem('scan_history');
            if (raw) {
                const parsed = JSON.parse(raw) as Transaction[];
                // Show newest first
                setTransactions(parsed.reverse());
            }
        } catch (e) {
            // silently fail
        }
    };

    const clearHistory = async () => {
        try {
            await AsyncStorage.removeItem('scan_history');
            setTransactions([]);
        } catch (e) {
            // silently fail
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const month = d.toLocaleString('default', { month: 'short' });
        const day = d.getDate();
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${month} ${day}, ${time}`;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
                    <Text style={styles.backArrowText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>History</Text>
                {transactions.length > 0 ? (
                    <TouchableOpacity onPress={clearHistory} activeOpacity={0.7}>
                        <Text style={styles.clearText}>Clear</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </Animated.View>

            {transactions.length === 0 ? (
                <Animated.View entering={FadeIn.duration(600)} style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>📋</Text>
                    <Text style={styles.emptyTitle}>No Scans Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Your scan history will appear here after you analyze a product
                    </Text>
                    <TouchableOpacity
                        style={styles.scanButton}
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.scanButtonText}>Start Scanning</Text>
                    </TouchableOpacity>
                </Animated.View>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.countLabel}>
                        {transactions.length} scan{transactions.length !== 1 ? 's' : ''}
                    </Text>

                    {transactions.map((tx, index) => {
                        const hasTax = tx.equity_gap > 0;
                        const percentMarkup =
                            tx.fair_price > 0
                                ? (((tx.price_scanned - tx.fair_price) / tx.fair_price) * 100).toFixed(0)
                                : '0';
                        const isGirl = tx.type === 'girl';
                        const accentColor = isGirl ? '#EC4899' : '#3B82F6';
                        const label = isGirl ? 'Pink Tax' : 'Tourist Tax';
                        const emoji = isGirl ? '🚺' : '🌍';

                        return (
                            <Animated.View
                                entering={FadeInDown.delay(index * 80).duration(400)}
                                key={tx.id}
                                style={styles.card}
                            >
                                {/* Top row */}
                                <View style={styles.cardTop}>
                                    <View style={styles.cardTopLeft}>
                                        <Text style={styles.cardEmoji}>{emoji}</Text>
                                        <View>
                                            <Text style={styles.cardProduct} numberOfLines={1}>
                                                {tx.product_name || 'Unknown Product'}
                                            </Text>
                                            <Text style={styles.cardDate}>
                                                {formatDate(tx.date)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.taxBadge, { backgroundColor: hasTax ? 'rgba(239,68,68,0.08)' : 'rgba(5,150,105,0.08)' }]}>
                                        <Text style={[styles.taxBadgeText, { color: hasTax ? '#DC2626' : '#059669' }]}>
                                            {hasTax ? `+${percentMarkup}%` : 'Fair'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Price row */}
                                <View style={styles.priceRow}>
                                    <View style={styles.priceItem}>
                                        <Text style={styles.priceLabel}>Scanned</Text>
                                        <Text style={styles.priceValue}>
                                            {tx.currency_symbol}{Number(tx.price_scanned).toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={styles.priceArrow}>
                                        <Text style={{ color: '#C8AAB2' }}>→</Text>
                                    </View>
                                    <View style={styles.priceItem}>
                                        <Text style={styles.priceLabel}>Fair Price</Text>
                                        <Text style={[styles.priceValue, { color: '#059669' }]}>
                                            {tx.currency_symbol}{Number(tx.fair_price).toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={styles.priceItem}>
                                        <Text style={styles.priceLabel}>{label}</Text>
                                        <Text style={[styles.priceValue, { color: hasTax ? '#DC2626' : '#059669' }]}>
                                            {hasTax ? `+${tx.currency_symbol}${Math.abs(tx.equity_gap).toFixed(2)}` : `${tx.currency_symbol}0.00`}
                                        </Text>
                                    </View>
                                </View>

                                {/* Bottom tag */}
                                {tx.location && (
                                    <View style={styles.cardBottom}>
                                        <Text style={styles.cardLocation}>📍 {tx.location}</Text>
                                    </View>
                                )}
                            </Animated.View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF0F3' },

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
    clearText: {
        fontSize: 14,
        color: '#DC2626',
        fontWeight: '600',
    },

    /* ---- Empty ---- */
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyEmoji: { fontSize: 56, marginBottom: 16 },
    emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: '#8A6B75', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    scanButton: {
        backgroundColor: '#1A1A1A',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 36,
    },
    scanButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

    /* ---- List ---- */
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    countLabel: {
        fontSize: 13,
        color: '#8A6B75',
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 14,
    },

    /* ---- Card ---- */
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    cardTopLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    cardEmoji: { fontSize: 24 },
    cardProduct: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
        maxWidth: 180,
    },
    cardDate: {
        fontSize: 12,
        color: '#8A6B75',
        marginTop: 2,
    },
    taxBadge: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    taxBadgeText: {
        fontSize: 13,
        fontWeight: '800',
    },

    /* ---- Price row ---- */
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF6F8',
        borderRadius: 12,
        padding: 12,
        gap: 6,
    },
    priceItem: {
        flex: 1,
        alignItems: 'center',
    },
    priceArrow: {
        paddingHorizontal: 4,
    },
    priceLabel: {
        fontSize: 10,
        color: '#8A6B75',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginBottom: 3,
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1A1A',
    },

    /* ---- Bottom ---- */
    cardBottom: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.04)',
    },
    cardLocation: {
        fontSize: 12,
        color: '#8A6B75',
        fontWeight: '500',
    },
});
