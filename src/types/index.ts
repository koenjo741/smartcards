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
}
