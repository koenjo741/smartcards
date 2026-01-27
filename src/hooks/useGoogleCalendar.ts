import { useState, useEffect, useCallback } from 'react';
import type { Card } from '../types';

// Types for Google API (simplified)
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

export const useGoogleCalendar = () => {
    const [isGapiLoaded, setIsGapiLoaded] = useState(false);
    const [isGisLoaded, setIsGisLoaded] = useState(false);
    const [tokenClient, setTokenClient] = useState<any>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Load scripts
    useEffect(() => {
        const loadGapi = () => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => setIsGapiLoaded(true);
            document.body.appendChild(script);
        };

        const loadGis = () => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => setIsGisLoaded(true);
            document.body.appendChild(script);
        };

        loadGapi();
        loadGis();
    }, []);

    // Initialize GAPI and GIS
    useEffect(() => {
        if (!isGapiLoaded || !isGisLoaded) return;

        const initializeGapiClient = async () => {
            const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
            if (!apiKey) {
                console.warn('Google API Key not found');
                return;
            }

            try {
                await window.gapi.client.init({
                    apiKey: apiKey,
                    discoveryDocs: [DISCOVERY_DOC],
                });
            } catch (err) {
                console.error('Error initializing GAPI client', err);
            }
        };

        const initializeGisClient = () => {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (!clientId) {
                console.warn('Google Client ID not found');
                return;
            }

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (response: any) => {
                    if (response.error !== undefined) {
                        throw response;
                    }
                    setIsAuthenticated(true);
                },
            });
            setTokenClient(client);

            // Check if we have a valid token in generic logic if needed, 
            // but GIS handles the popup flow primarily.
            // For persistent 'silent' auth, we'd check expiration, 
            // but typically we just re-request on user action if needed.
        };

        window.gapi.load('client', initializeGapiClient);
        initializeGisClient();
    }, [isGapiLoaded, isGisLoaded]);

    const login = useCallback(async () => {
        if (!tokenClient) return false;

        return new Promise((resolve) => {
            // Overwrite callback for this specific request to handle promise
            tokenClient.callback = (resp: any) => {
                if (resp.error) {
                    console.error(resp);
                    resolve(false);
                    return;
                }
                setIsAuthenticated(true);
                resolve(true);
            };

            // Trigger flow
            if (window.gapi.client.getToken() === null) {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                tokenClient.requestAccessToken({ prompt: '' });
            }
        });
    }, [tokenClient]);

    const ensureAuth = async () => {
        if (isAuthenticated) return true;
        if (window.gapi.client.getToken() !== null) {
            setIsAuthenticated(true);
            return true;
        }
        return await login();
    };

    // Helper: Find or Create "SmartCards" Calendar
    const getTargetCalendar = useCallback(async () => {
        try {
            const response = await window.gapi.client.calendar.calendarList.list();
            const calendars = response.result.items || [];

            const existing = calendars.find((c: any) => c.summary === 'SmartCards');
            if (existing) {
                return existing.id;
            }

            const createResponse = await window.gapi.client.calendar.calendars.insert({
                resource: {
                    summary: 'SmartCards',
                    description: 'Created by SmartCards App',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            });
            return createResponse.result.id;

        } catch (error) {
            console.error("Error finding/creating calendar:", error);
            return 'primary';
        }
    }, []);

    const createEvent = useCallback(async (card: Card) => {
        setIsLoading(true);
        try {
            const authed = await ensureAuth();
            if (!authed) throw new Error("Auth failed");

            if (!card.dueDate) throw new Error("No due date");

            const event = {
                'summary': card.title,
                'description': card.content ? stripHtml(card.content) : '',
                'start': {
                    'date': card.dueDate,
                },
                'end': {
                    'date': card.dueDate,
                }
            };

            const startDate = new Date(card.dueDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 1);
            event.end.date = endDate.toISOString().split('T')[0];

            const calendarId = await getTargetCalendar();
            const request = window.gapi.client.calendar.events.insert({
                'calendarId': calendarId,
                'resource': event,
            });

            const response = await request;

            // Return both IDs so we can store them
            return { eventId: response.result.id, calendarId };

        } catch (error) {
            console.error("Error creating event", error);
            alert("Termin konnte nicht erstellt werden.");
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [ensureAuth, getTargetCalendar]);

    const deleteEvent = useCallback(async (eventId: string, calendarId: string = 'primary') => {
        setIsLoading(true);
        try {
            const authed = await ensureAuth();
            if (!authed) throw new Error("Auth failed");

            const request = window.gapi.client.calendar.events.delete({
                'calendarId': calendarId,
                'eventId': eventId,
            });

            await request;
            return true;

        } catch (error) {
            console.error("Error deleting event", error);
            // Fallback: Try primary if specific calendar failed (migration)
            if (calendarId !== 'primary') {
                try {
                    await window.gapi.client.calendar.events.delete({
                        'calendarId': 'primary',
                        'eventId': eventId,
                    });
                    return true;
                } catch (e2) {
                    console.error("Fallback delete failed", e2);
                }
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [ensureAuth]);

    return {
        isReady: !!tokenClient && isGapiLoaded,
        isAuthenticated,
        login,
        createEvent,
        deleteEvent,
        isLoading
    };
};

function stripHtml(html: string) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim();
}
