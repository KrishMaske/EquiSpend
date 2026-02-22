import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_access_token';
const USER_KEY = 'auth_user';

export async function saveAuth(accessToken: string, user: any): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser(): Promise<any | null> {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
}

export async function clearAuth(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, 'user_logged_in', 'user_email', 'user_name', 'user_username']);
}

export async function isLoggedIn(): Promise<boolean> {
    const token = await getToken();
    return token !== null;
}
