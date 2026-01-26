export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface Card {
  id: string;
  title: string;
  content: string;
  projectIds: string[];
  dueDate?: string;
}
