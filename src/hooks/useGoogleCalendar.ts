import { useState, useEffect, useCallback } from 'react';
import { stripHtml } from '../utils/helpers';
import type { Card } from '../types';

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

    // Load Google API scripts
    useEffect(() => {
        const loadScript = (src: string, onLoad: () => void) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = onLoad;
            document.body.appendChild(script);
        };

        loadScript('https://apis.google.com/js/api.js', () => setIsGapiLoaded(true));
        loadScript('https://accounts.google.com/gsi/client', () => setIsGisLoaded(true));
    }, []);

    // Initialize GAPI and GIS
    useEffect(() => {
        if (!isGapiLoaded || !isGisLoaded) return;

        const initGapi = async () => {
            const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
            if (!apiKey) return;

            try {
                await window.gapi.client.init({
                    apiKey,
                    discoveryDocs: [DISCOVERY_DOC],
                });
            } catch (err) {
                console.error('GAPI init error:', err);
            }
        };

        const initGis = () => {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
            if (!clientId) return;

            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (response: any) => {
                    if (response.error) throw response;
                    window.gapi.client?.setToken(response);
                    setIsAuthenticated(true);
                },
            });
            setTokenClient(client);
        };

        window.gapi.load('client', initGapi);
        initGis();
    }, [isGapiLoaded, isGisLoaded]);

    const login = useCallback(async () => {
        if (!tokenClient) return false;

        return new Promise((resolve) => {
            tokenClient.callback = (resp: any) => {
                if (resp.error) {
                    console.error(resp);
                    resolve(false);
                    return;
                }
                window.gapi.client?.setToken(resp);
                setIsAuthenticated(true);
                resolve(true);
            };

            tokenClient.requestAccessToken({ prompt: '' });
        });
    }, [tokenClient]);

    const ensureAuth = useCallback(async () => {
        if (isAuthenticated) return true;
        if (window.gapi.client.getToken() !== null) {
            setIsAuthenticated(true);
            return true;
        }
        return await login();
    }, [isAuthenticated, login]);

    // Find or Create "SmartCards" Calendar
    const getTargetCalendar = useCallback(async () => {
        try {
            const response = await window.gapi.client.calendar.calendarList.list();
            const calendars = response.result.items || [];
            const existing = calendars.find((c: any) => c.summary === 'SmartCards');

            if (existing) return existing.id;

            const createResponse = await window.gapi.client.calendar.calendars.insert({
                resource: {
                    summary: 'SmartCards',
                    description: 'Created by SmartCards App',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
            });
            return createResponse.result.id;
        } catch (error) {
            console.error('Calendar lookup/create error:', error);
            return 'primary';
        }
    }, []);

    /** Build a Google Calendar event resource from a Card */
    const buildEventResource = (card: Card) => {
        if (!card.dueDate) throw new Error('No due date');

        const startDate = new Date(card.dueDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);

        return {
            summary: card.title,
            description: card.content ? stripHtml(card.content) : '',
            start: { date: card.dueDate },
            end: { date: endDate.toISOString().split('T')[0] },
        };
    };

    const createEvent = useCallback(async (card: Card) => {
        setIsLoading(true);
        try {
            if (!(await ensureAuth())) throw new Error('Auth failed');

            const event = buildEventResource(card);
            const calendarId = await getTargetCalendar();

            const response = await window.gapi.client.calendar.events.insert({
                calendarId,
                resource: event,
            });

            return { eventId: response.result.id, calendarId };
        } catch (error) {
            console.error('Create event error:', error);
            alert('Termin konnte nicht erstellt werden.');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [ensureAuth, getTargetCalendar]);

    const deleteEvent = useCallback(async (eventId: string, calendarId: string = 'primary') => {
        setIsLoading(true);
        try {
            if (!(await ensureAuth())) throw new Error('Auth failed');

            await window.gapi.client.calendar.events.delete({ calendarId, eventId });
            return true;
        } catch (error) {
            console.error('Delete event error:', error);

            // Fallback: try primary calendar if specific one failed (migration case)
            if (calendarId !== 'primary') {
                try {
                    await window.gapi.client.calendar.events.delete({
                        calendarId: 'primary',
                        eventId,
                    });
                    return true;
                } catch {
                    // Both calendars failed
                }
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [ensureAuth]);

    const updateEvent = useCallback(async (card: Card, eventId: string, calendarId: string = 'primary') => {
        setIsLoading(true);
        try {
            if (!(await ensureAuth())) return false;
            if (!card.dueDate) return false;

            const event = buildEventResource(card);

            await window.gapi.client.calendar.events.patch({
                calendarId,
                eventId,
                resource: event,
            });

            return true;
        } catch (error: any) {
            console.error('Update event error:', error);
            if (error.status === 401 || error.status === 403) {
                setIsAuthenticated(false);
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [ensureAuth]);

    const listUpcomingEvents = useCallback(async () => {
        setIsLoading(true);
        try {
            if (!(await ensureAuth())) return [];

            const calendarListResponse = await window.gapi.client.calendar.calendarList.list();
            const visibleCalendars = calendarListResponse.result.items.filter((c: any) => c.selected);
            const calendarsToFetch = visibleCalendars.length > 0 ? visibleCalendars : [{ id: 'primary' }];

            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const bufferDay = new Date(now);
            bufferDay.setDate(bufferDay.getDate() + 3);
            bufferDay.setHours(0, 0, 0, 0);

            const promises = calendarsToFetch.map((cal: any) =>
                window.gapi.client.calendar.events.list({
                    calendarId: cal.id,
                    timeMin: startOfDay.toISOString(),
                    timeMax: bufferDay.toISOString(),
                    showDeleted: false,
                    singleEvents: true,
                    orderBy: 'startTime',
                }).then((r: any) => r.result.items || [])
                    .catch(() => [])
            );

            const allEvents = (await Promise.all(promises)).flat();

            allEvents.sort((a, b) => {
                const startA = a.start.dateTime || a.start.date;
                const startB = b.start.dateTime || b.start.date;
                return startA.localeCompare(startB);
            });

            return allEvents;
        } catch (error) {
            console.error('List events error:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [ensureAuth, getTargetCalendar]);

    return {
        isReady: !!tokenClient && isGapiLoaded,
        isAuthenticated,
        login,
        createEvent,
        deleteEvent,
        updateEvent,
        listUpcomingEvents,
        isLoading,
    };
};
