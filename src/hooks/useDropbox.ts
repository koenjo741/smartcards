import { Dropbox } from 'dropbox';
import { useState, useCallback, useEffect } from 'react';
import type { BackupData } from '../types';

export const DROPBOX_APP_KEY = 'ag0x9i8pgyothjr';
const REDIRECT_URI = window.location.origin + '/';
const TOKEN_ENDPOINT = 'https://api.dropboxapi.com/oauth2/token';
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
/** Refresh access token 5 minutes before it expires */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// ─── Module-level singletons (shared across hook instances) ────────────────
let cachedUserName: string | null = null;
let accountCheckPromise: Promise<any> | null = null;
/** Shared promise to prevent parallel token refresh calls */
let tokenRefreshPromise: Promise<string> | null = null;

// ─── Types ─────────────────────────────────────────────────────────────────

interface SaveResult {
    success: boolean;
    errorType?: 'auth' | 'server_error' | 'network';
}

export type LoadResult =
    | { type: 'success'; data: BackupData; rev: string; contentHash: string; size: number }
    | { type: 'not_found' }
    | { type: 'error'; error: any };

// ─── PKCE Helpers ──────────────────────────────────────────────────────────

function base64UrlEncode(buffer: Uint8Array): string {
    let str = '';
    buffer.forEach(byte => { str += String.fromCharCode(byte); });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateCodeVerifier(): string {
    const array = new Uint8Array(96); // → 128-char Base64URL string
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
}

// ─── Token Storage ─────────────────────────────────────────────────────────

function storeTokens(accessToken: string, expiresIn: number, refreshToken?: string): void {
    const expiry = Date.now() + expiresIn * 1000;
    localStorage.setItem('dropbox_access_token', accessToken);
    localStorage.setItem('dropbox_access_token_expiry', String(expiry));
    if (refreshToken) {
        localStorage.setItem('dropbox_refresh_token', refreshToken);
    }
}

function clearTokens(): void {
    localStorage.removeItem('dropbox_access_token');
    localStorage.removeItem('dropbox_access_token_expiry');
    localStorage.removeItem('dropbox_refresh_token');
    localStorage.removeItem('dropbox_token'); // Legacy implicit-flow token
}

/**
 * Returns a cached access token if still valid (not within refresh margin).
 * Falls back to the legacy implicit-flow token (no expiry stored → treated as valid).
 * Returns null when the token needs refreshing.
 */
function getStoredAccessToken(): string | null {
    const token =
        localStorage.getItem('dropbox_access_token') ??
        localStorage.getItem('dropbox_token'); // Legacy fallback

    if (!token) return null;

    const expiry = Number(localStorage.getItem('dropbox_access_token_expiry') ?? 0);
    if (!expiry) return token; // Legacy token has no expiry — treat as valid
    if (Date.now() < expiry - TOKEN_REFRESH_MARGIN_MS) return token;

    return null; // Needs refresh
}

// ─── Token Exchange & Refresh ──────────────────────────────────────────────

async function exchangeCodeForTokens(code: string, verifier: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}> {
    const body = new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        client_id: DROPBOX_APP_KEY,
        code_verifier: verifier,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Object.assign(new Error('Dropbox token exchange failed'), { status: response.status, error });
    }

    const data = await response.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in ?? 14400,
    };
}

async function doRefreshAccessToken(): Promise<string> {
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    if (!refreshToken) throw new Error('No Dropbox refresh token stored');

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: DROPBOX_APP_KEY,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw Object.assign(new Error('Dropbox token refresh failed'), { status: response.status, error });
    }

    const data = await response.json();
    storeTokens(data.access_token, data.expires_in ?? 14400);
    return data.access_token;
}

// ─── Utility ───────────────────────────────────────────────────────────────

/** Exponential backoff: 1s, 2s, 4s */
const backoffDelay = (attempt: number) =>
    new Promise<void>(resolve => setTimeout(resolve, BASE_BACKOFF_MS * Math.pow(2, attempt)));

/** Wraps a promise with a timeout to prevent indefinite hangs */
const withTimeout = <T>(promise: Promise<T>, ms = 30000): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Dropbox API timeout after ${ms}ms`)), ms);
        promise.then(
            res => { clearTimeout(timer); resolve(res); },
            err => { clearTimeout(timer); reject(err); }
        );
    });

/**
 * Initiate PKCE login. Generates verifier/challenge, stores verifier in
 * sessionStorage (survives the redirect), then navigates to Dropbox OAuth.
 *
 * @param forceReapprove - true only for explicit account-switch, not normal login.
 */
async function initiateDropboxLogin(forceReapprove = false): Promise<void> {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem('dropbox_pkce_verifier', verifier);

    const params = new URLSearchParams({
        client_id: DROPBOX_APP_KEY,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        token_access_type: 'offline',   // ← gives us a refresh token
        force_reapprove: String(forceReapprove),
    });

    window.location.href = `https://www.dropbox.com/oauth2/authorize?${params}`;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDropbox() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [userName, setUserName] = useState<string | null>(null);
    const [connectionError, setConnectionError] = useState<boolean>(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    /**
     * Returns a valid access token, silently refreshing via refresh token if
     * the cached access token is missing or near expiry.
     * Uses a shared promise to prevent parallel refresh network calls.
     */
    const getValidToken = useCallback(async (): Promise<string | null> => {
        const cached = getStoredAccessToken();
        if (cached) return cached;

        const hasRefreshToken = !!localStorage.getItem('dropbox_refresh_token');
        if (!hasRefreshToken) return null;

        if (!tokenRefreshPromise) {
            tokenRefreshPromise = doRefreshAccessToken().finally(() => {
                tokenRefreshPromise = null;
            });
        }

        try {
            return await tokenRefreshPromise;
        } catch {
            return null;
        }
    }, []);

    const handleAuthError = useCallback(() => {
        setConnectionError(true);
        setIsAuthenticated(false);
        setUserEmail(null);
        clearTokens();
        cachedUserName = null;
        accountCheckPromise = null;
        tokenRefreshPromise = null;
    }, []);

    // ── Auth initialisation on mount ────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            const searchParams = new URLSearchParams(window.location.search);
            const code = searchParams.get('code');

            if (code) {
                // ── PKCE callback: exchange code for tokens ──────────────────
                const verifier = sessionStorage.getItem('dropbox_pkce_verifier');
                sessionStorage.removeItem('dropbox_pkce_verifier');
                // Keep 'dropbox_auto_connect_attempted' set during the async token exchange.
                // React StrictMode mounts effects twice: the second mount would otherwise find
                // no tokens in localStorage (exchange still pending) and immediately redirect
                // back to Dropbox, cancelling the first mount's fetch → infinite loop.
                sessionStorage.setItem('dropbox_auto_connect_attempted', '1');

                // Clean up URL immediately so a refresh doesn't re-trigger the flow
                window.history.replaceState(null, '', window.location.pathname);

                if (!verifier) {
                    console.error('[Dropbox] PKCE verifier missing — cannot exchange code');
                    setIsAuthChecking(false);
                    return;
                }

                try {
                    const { accessToken, refreshToken, expiresIn } =
                        await exchangeCodeForTokens(code, verifier);

                    storeTokens(accessToken, expiresIn, refreshToken);

                    const client = new Dropbox({ accessToken });
                    const account = await client.usersGetCurrentAccount();
                    cachedUserName = account.result.name.display_name;

                    setIsAuthenticated(true);
                    setConnectionError(false);
                    setUserName(cachedUserName);
                    setUserEmail(account.result.email);
                    setLastSynced(new Date());
                } catch (err) {
                    console.error('[Dropbox] Token exchange failed:', err);
                    clearTokens();
                } finally {
                    setIsAuthChecking(false);
                }

            } else {
                // ── No OAuth callback: try stored tokens ─────────────────────
                const hasAnyToken =
                    !!localStorage.getItem('dropbox_access_token') ||
                    !!localStorage.getItem('dropbox_refresh_token') ||
                    !!localStorage.getItem('dropbox_token'); // Legacy

                if (hasAnyToken) {
                    const token = await getValidToken();

                    if (!token) {
                        // Refresh token is expired / revoked — need re-auth
                        handleAuthError();
                        if (!sessionStorage.getItem('dropbox_auto_connect_attempted')) {
                            sessionStorage.setItem('dropbox_auto_connect_attempted', '1');
                            void initiateDropboxLogin(false);
                        } else {
                            setIsAuthChecking(false);
                        }
                        return;
                    }

                    setIsAuthenticated(true);
                    setConnectionError(false);

                    // Fetch account info (deduplicated across multiple hook instances)
                    if (!accountCheckPromise) {
                        const client = new Dropbox({ accessToken: token });
                        accountCheckPromise = client.usersGetCurrentAccount()
                            .then(res => {
                                cachedUserName = res.result.name.display_name;
                                setUserEmail(res.result.email);
                                return res;
                            })
                            .catch(err => {
                                accountCheckPromise = null;
                                throw err;
                            });
                    }

                    try {
                        await accountCheckPromise;
                        if (cachedUserName) setUserName(cachedUserName);
                        setLastSynced(new Date());
                    } catch (err: any) {
                        const is401 =
                            err?.status === 401 ||
                            err?.error?.error_summary?.includes('expired_access_token');

                        if (is401 && !localStorage.getItem('dropbox_refresh_token')) {
                            // Legacy implicit-flow token truly expired, no refresh token available
                            handleAuthError();
                            if (!sessionStorage.getItem('dropbox_auto_connect_attempted')) {
                                sessionStorage.setItem('dropbox_auto_connect_attempted', '1');
                                void initiateDropboxLogin(false);
                            }
                        } else if (!is401) {
                            console.warn('[Dropbox] Transient error fetching account info:', err);
                        }
                        // If is401 but we DO have a refresh token: getValidToken already failed,
                        // so handleAuthError was already called above.
                    } finally {
                        setIsAuthChecking(false);
                    }

                } else {
                    // ── No tokens at all: auto-connect on first visit ─────────
                    if (!sessionStorage.getItem('dropbox_auto_connect_attempted')) {
                        sessionStorage.setItem('dropbox_auto_connect_attempted', '1');
                        void initiateDropboxLogin(false);
                    } else {
                        setIsAuthChecking(false);
                    }
                }
            }
        };

        void init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Public connect: normal login (no forced re-approval) ────────────────
    const connect = useCallback(() => void initiateDropboxLogin(false), []);

    // ── Public connect: explicit account switch (forces consent screen) ─────
    const connectSwitchAccount = useCallback(() => void initiateDropboxLogin(true), []);

    // ── Disconnect ───────────────────────────────────────────────────────────
    const disconnect = useCallback(() => {
        clearTokens();
        // Prevent auto-reconnect so the user explicitly controls next connection
        sessionStorage.setItem('dropbox_auto_connect_attempted', '1');
        setIsAuthenticated(false);
        setUserName(null);
        setUserEmail(null);
        cachedUserName = null;
        accountCheckPromise = null;
        tokenRefreshPromise = null;
    }, []);

    // ── API helpers ──────────────────────────────────────────────────────────

    /** Returns an authenticated Dropbox client or null. */
    const getClient = useCallback(async (): Promise<Dropbox | null> => {
        const token = await getValidToken();
        if (!token) return null;
        return new Dropbox({ accessToken: token });
    }, [getValidToken]);

    // ── Save Data ────────────────────────────────────────────────────────────
    const saveData = useCallback(async (data: BackupData): Promise<SaveResult> => {
        const client = await getClient();
        if (!client) return { success: false };

        setIsSyncing(true);
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    await client.filesUpload({
                        path: '/smartcards.json',
                        contents: blob,
                        mode: { '.tag': 'overwrite' },
                    });
                    setLastSynced(new Date());
                    setConnectionError(false);
                    return { success: true };
                } catch (error: any) {
                    const status = error?.status;
                    const summary = error?.error?.error_summary as string | undefined;

                    if (status === 401 || summary?.includes('expired_access_token')) {
                        handleAuthError();
                        return { success: false, errorType: 'auth' };
                    }

                    if ((status === 503 || !status) && attempt < MAX_RETRIES) {
                        console.warn(`[Dropbox] save attempt ${attempt + 1} failed, retrying…`);
                        await backoffDelay(attempt);
                        continue;
                    }

                    return { success: false, errorType: status === 503 ? 'server_error' : 'network' };
                }
            }
            return { success: false, errorType: 'network' };
        } finally {
            setIsSyncing(false);
        }
    }, [getClient, handleAuthError]);

    // ── Load Data ────────────────────────────────────────────────────────────
    const loadData = useCallback(async (): Promise<LoadResult> => {
        const client = await getClient();
        if (!client) return { type: 'error', error: 'Not authenticated' };

        setIsSyncing(true);
        try {
            const response = await client.filesDownload({ path: '/smartcards.json' });
            const result = response.result as any;
            const blob = (result as unknown as { fileBlob: Blob }).fileBlob;
            const text = await blob.text();
            const rev: string = result.rev ?? 'unknown';
            const contentHash: string = result.content_hash ?? 'unknown';
            const size: number = result.size ?? 0;

            console.log(`[Dropbox] loadData: rev=${rev} size=${size} hash=${contentHash.slice(0, 12)}…`);
            setLastSynced(new Date());
            return { type: 'success', data: JSON.parse(text) as BackupData, rev, contentHash, size };
        } catch (error: any) {
            const summary = error?.error?.error_summary ?? '';
            if ((error.status === 409 && summary.includes('path/not_found')) || error.status === 404) {
                return { type: 'not_found' };
            }
            console.error('[Dropbox] download error:', error);
            return { type: 'error', error };
        } finally {
            setIsSyncing(false);
        }
    }, [getClient]);

    // ── Upload File ──────────────────────────────────────────────────────────
    const uploadFile = useCallback(async (file: File) => {
        const client = await getClient();
        if (!client) throw new Error('Not connected to Dropbox');

        const safeName = file.name.replace(/[\\/:\"*?<>|]/g, '-');
        const path = `/attachments/${Date.now()}_${safeName}`;

        try {
            const response = await withTimeout(
                client.filesUpload({ path, contents: file }),
                60_000
            );
            return {
                id: response.result.id,
                name: file.name,
                path: response.result.path_display ?? path,
                type: file.type,
                size: file.size,
            };
        } catch (error: any) {
            console.error('[Dropbox] upload error:', error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            throw error;
        }
    }, [getClient, handleAuthError]);

    // ── Get Temporary File Link ──────────────────────────────────────────────
    const getFileLink = useCallback(async (path: string): Promise<string | null> => {
        const client = await getClient();
        if (!client) return null;

        try {
            const response = await withTimeout(client.filesGetTemporaryLink({ path }), 15_000);
            return response.result.link;
        } catch (error: any) {
            console.error('[Dropbox] getFileLink error:', path, error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            return null;
        }
    }, [getClient, handleAuthError]);

    // ── Get File Content ─────────────────────────────────────────────────────
    const getFileContent = useCallback(async (path: string): Promise<Blob | null> => {
        const client = await getClient();
        if (!client) return null;

        try {
            const response = await withTimeout(client.filesDownload({ path }), 30_000);
            return (response.result as unknown as { fileBlob: Blob }).fileBlob;
        } catch (error: any) {
            console.error('[Dropbox] getFileContent error:', path, error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            throw error;
        }
    }, [getClient, handleAuthError]);

    // ── Delete File ──────────────────────────────────────────────────────────
    const deleteFile = useCallback(async (path: string): Promise<boolean> => {
        const client = await getClient();
        if (!client) throw new Error('Not connected to Dropbox');

        try {
            await withTimeout(client.filesDeleteV2({ path }), 15_000);
            return true;
        } catch (error: any) {
            console.error('[Dropbox] deleteFile error:', path, error);
            if (error?.status === 401 || error?.error?.error_summary?.includes('expired')) {
                handleAuthError();
            }
            const summary = (error as { error?: { error_summary?: string } })?.error?.error_summary;
            if (summary?.includes('path_lookup/not_found')) return true; // Already gone
            return false;
        }
    }, [getClient, handleAuthError]);

    return {
        isAuthenticated,
        isAuthChecking,
        userName,
        userEmail,
        isSyncing,
        lastSynced,
        connectionError,
        connect,
        connectSwitchAccount,
        disconnect,
        saveData,
        loadData,
        uploadFile,
        getFileContent,
        deleteFile,
        getFileLink,
    };
}
