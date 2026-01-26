import { useState, useCallback } from 'react';

export function useFileSystem() {
    const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);

    const saveToFile = useCallback(async (data: any) => {
        try {
            let handle = fileHandle;

            if (!handle) {
                // If no handle, ask user where to save (Save As)
                try {
                    handle = await window.showSaveFilePicker({
                        suggestedName: 'smartcards.json',
                        types: [{
                            description: 'SmartCards Database',
                            accept: { 'application/json': ['.json'] },
                        }],
                    });
                    if (handle) {
                        setFileHandle(handle);
                        setFileName(handle.name);
                    } else {
                        return false;
                    }
                } catch (err) {
                    // User cancelled
                    return false;
                }
            }

            setIsSaving(true);
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();

            setLastSaved(new Date());
            setIsSaving(false);
            return true;
        } catch (error) {
            console.error('File write error:', error);
            setIsSaving(false);
            alert('Failed to save file. If you are using Dropbox, make sure the file is not locked.');
            return false;
        }
    }, [fileHandle]);

    const openFile = useCallback(async () => {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'SmartCards Database',
                    accept: { 'application/json': ['.json'] },
                }],
                multiple: false
            });

            const file = await handle.getFile();
            const text = await file.text();
            const data = JSON.parse(text);

            setFileHandle(handle);
            setFileName(handle.name);
            setLastSaved(new Date()); // It was just read, so it's "saved" in sync

            return data;
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('File open error:', err);
                alert('Failed to open file.');
            }
            return null;
        }
    }, []);

    const resetFile = useCallback(() => {
        setFileHandle(null);
        setFileName(null);
        setLastSaved(null);
    }, []);

    return {
        fileHandle,
        fileName,
        lastSaved,
        isSaving,
        saveToFile,
        openFile,
        resetFile
    };
}
