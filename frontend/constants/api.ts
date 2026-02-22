import { Platform } from 'react-native';

const NGROK_URL = 'https://conciliar-dextrosinistrally-jessika.ngrok-free.dev';

const API_BASE_URL =
    Platform.OS === 'web'
        ? 'http://localhost:8000'
        : NGROK_URL;

export default API_BASE_URL;
