export { };

declare global {
    interface Window {
        showOpenFilePicker(options?: any): Promise<FileSystemFileHandle[]>;
        showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
    }

    interface FileSystemHandle {
        kind: 'file' | 'directory';
        name: string;
    }

    interface FileSystemFileHandle extends FileSystemHandle {
        getFile(): Promise<File>;
        createWritable(): Promise<FileSystemWritableFileStream>;
    }

    interface FileSystemWritableFileStream extends WritableStream {
        write(data: any): Promise<void>;
        seek(position: number): Promise<void>;
        truncate(size: number): Promise<void>;
    }
}
