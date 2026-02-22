import { Platform } from 'react-native';

// -------------------------------------------------------------------
// API Base URL Configuration
// -------------------------------------------------------------------
// The ngrok static domain provides a permanent public URL that works
// from any device (phone, emulator, web) without changing IPs.
//
// To start the backend with ngrok:  cd backend && .\start.ps1
// -------------------------------------------------------------------
const NGROK_URL = 'https://conciliar-dextrosinistrally-jessika.ngrok-free.dev';

const API_BASE_URL =
    Platform.OS === 'web'
        ? 'http://localhost:8000'   // Web dev uses localhost directly (faster)
        : NGROK_URL;               // Mobile always uses the public ngrok tunnel

export default API_BASE_URL;
