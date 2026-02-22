import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSharedLocation } from '../image-store';

export default function TalkScreen() {
    const router = useRouter();
    const loc = getSharedLocation();
    const locationStr = loc?.country || loc?.city || 'United States';

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
            <style>
                :root {
                    --bg-dark: #FFF0F3;
                    --form-bg: rgba(255, 255, 255, 0.8);
                }
                body {
                    margin: 0;
                    padding: 0;
                    background-color: var(--bg-dark);
                    background-image: 
                        radial-gradient(circle at 50% 50%, rgba(255, 149, 182, 0.3), transparent 60%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
                    color: #4A2035;
                }
                
                .header-container {
                    text-align: center;
                    margin-bottom: 30px;
                    z-index: 10;
                }

                h1 {
                    font-size: 36px;
                    font-weight: 800;
                    margin: 0;
                    color: #D46A92;
                    letter-spacing: -1px;
                }

                .subtitle {
                    font-size: 16px;
                    color: #8A6B75;
                    margin-top: 8px;
                    font-weight: 500;
                }

                .instructions {
                    background: var(--form-bg);
                    border: 1px solid rgba(255, 149, 182, 0.3);
                    padding: 20px;
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                    font-size: 15px;
                    color: #4A2035;
                    text-align: center;
                    max-width: 280px;
                    margin-bottom: 40px;
                    box-shadow: 0 4px 30px rgba(255, 149, 182, 0.15);
                }

                /* Override widget styles to match our premium theme and center it */
                elevenlabs-convai {
                    z-index: 20;
                    --elevenlabs-bg: #FFFFFF;
                    --elevenlabs-primary: #FF95B6;
                    --elevenlabs-text: #4A2035;
                    --elevenlabs-border-radius: 24px;
                    transform: scale(1.1); /* Make it slightly larger */
                }
            </style>
            <script src="https://elevenlabs.io/convai-widget/index.js" async></script>
        </head>
        <body>
            <div class="header-container">
                <h1>Haggle in <br/>${locationStr}</h1>
                <div class="subtitle">Your AI negotiation partner</div>
            </div>

            <div class="instructions">
                Tap to connect, then hand your phone to the shopkeeper.
            </div>

            <elevenlabs-convai agent-id="agent_2901kj1h8knpern8x2yqxxdbkz9n" action-text="Start Haggling" dynamic-variables='{"location": "${locationStr}"}'></elevenlabs-convai>
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
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF0F3',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#FFF0F3',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 149, 182, 0.2)',
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
        backgroundColor: '#FFF0F3',
    }
});
