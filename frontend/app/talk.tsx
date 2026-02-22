import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSharedLocation, getSharedManualPrice } from '../image-store';

const AGENT_ID = 'agent_2901kj1h8knpern8x2yqxxdbkz9n';

export default function TalkScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        productName?: string;
        askingPrice?: string;
        fairPrice?: string;
    }>();

    const loc = getSharedLocation();
    const { currency } = getSharedManualPrice();
    const locationStr = [loc?.city, loc?.state, loc?.country].filter(Boolean).join(', ') || 'Unknown';
    const productName = params.productName || 'this item';
    const askingPrice = params.askingPrice || '';
    const fairPrice = params.fairPrice || '';
    const hasPriceData = !!(askingPrice && fairPrice);

    const dynamicVars = JSON.stringify({
        location: locationStr,
        product_name: productName,
        asking_price: askingPrice,
        fair_price: fairPrice,
        currency: currency || 'USD',
    }).replace(/'/g, "\\'");

    const productLine = askingPrice && fairPrice
        ? `${productName} · Asked ${currency || '$'} ${askingPrice} · Fair ${currency || '$'} ${fairPrice}`
        : productName;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #FFF6F8;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
            color: #4A2035;
            overflow: hidden;
        }

        .hero {
            text-align: center;
            margin-bottom: 24px;
            padding: 0 24px;
        }
        .hero-emoji { font-size: 48px; margin-bottom: 12px; }
        .hero h1 {
            font-size: 28px;
            font-weight: 800;
            color: #D46A92;
            letter-spacing: -0.5px;
            line-height: 1.2;
        }
        .hero .subtitle {
            font-size: 14px;
            color: #8A6B75;
            margin-top: 6px;
            font-weight: 500;
        }

        .instructions {
            background: rgba(255,255,255,0.85);
            border: 1px solid rgba(255,149,182,0.25);
            padding: 16px 20px;
            border-radius: 16px;
            font-size: 14px;
            color: #4A2035;
            text-align: center;
            max-width: 300px;
            margin-bottom: 32px;
            line-height: 1.5;
            box-shadow: 0 2px 20px rgba(255,149,182,0.1);
        }
        .instructions strong { color: #D46A92; }

        .product-tag {
            background: rgba(255,149,182,0.12);
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 12px;
            color: #8A6B75;
            margin-bottom: 20px;
            max-width: 280px;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        elevenlabs-convai {
            --elevenlabs-bg: #FFFFFF;
            --elevenlabs-primary: #FF95B6;
            --elevenlabs-text: #4A2035;
            --elevenlabs-border-radius: 24px;
            transform: scale(1.15);
        }
    </style>
    <script src="https://elevenlabs.io/convai-widget/index.js" async></script>
</head>
<body>
    <div class="hero">
        <div class="hero-emoji">🤝</div>
        <h1>Haggle in<br/>${locationStr}</h1>
        <div class="subtitle">AI negotiation agent</div>
    </div>

    <div class="product-tag">${productLine}</div>

    <div class="instructions">
        ${hasPriceData
            ? `Tap the button to connect, then <strong>hand your phone to the shopkeeper</strong>. The AI will negotiate in their language.`
            : `<strong style="color:#DC2626">⚠️ No price data!</strong><br/>Go back, scan a product first, then tap <strong>Haggle This Price</strong> from the results page for the best experience.`
        }
    </div>

    <elevenlabs-convai
        agent-id="${AGENT_ID}"
        action-text="Start Haggling"
        dynamic-variables='${dynamicVars}'
    ></elevenlabs-convai>
</body>
</html>
    `;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="chevron-down" size={28} color="#D46A92" />
                </TouchableOpacity>
                <Text style={styles.title}>AI Negotiator</Text>
                <View style={{ width: 28 }} />
            </View>

            <WebView
                source={{ html: htmlContent, baseUrl: 'https://localhost' }}
                originWhitelist={['*']}
                style={styles.webview}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                mediaCapturePermissionGrantType="grant"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF6F8',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 44,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#FFF6F8',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 149, 182, 0.15)',
    },
    title: {
        color: '#D46A92',
        fontSize: 18,
        fontWeight: '700',
    },
    backButton: {
        padding: 4,
    },
    webview: {
        flex: 1,
        backgroundColor: '#FFF6F8',
    },
});
