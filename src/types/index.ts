export interface GanttProjectProps {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  info?: string;
  status: 'Geplant' | 'In Arbeit' | 'Fertig';
  totalBudget?: number;
  yearlyBudgets?: Record<string, number>; // e.g. { "2026": 5000, "2027": 10000 }
}

export interface Project {
  id: string;
  name: string;
  color: string;
  isGantt?: boolean;
  gantt?: GanttProjectProps;
}

export interface Attachment {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
}

export interface Milestone {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
}

export interface GanttCardProps {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  info?: string;
  status: 'Geplant' | 'In Arbeit' | 'Fertig';
  plannedBudget?: number;
  consumedBudget?: number;
  companies?: string[];
  milestones?: Milestone[];
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
  isGantt?: boolean;
  gantt?: GanttCardProps;
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
