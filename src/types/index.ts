export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface Attachment {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}

export interface Card {
  id: string;
  title: string;
  content: string;
  projectIds: string[];
  dueDate?: string;
  attachments?: Attachment[];
  linkedCardIds?: string[];
  googleEventId?: string;
  googleCalendarId?: string;
}

export interface BackupData {
  projects: Project[];
  cards: Card[];
  customColors?: string[];
  _meta?: {
    lastSaved: number;
    appVersion?: string;
  };
}
