// JORATA 2.0 Social, Messaging, and Collaborative Task Types

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // usernames who reacted
}

export interface SnapAttachment {
  id: string;
  dataUrl: string;
  caption?: string;
  filter?: string;
  createdAt: number;
}

export interface ExtendedMessage {
  id: string;
  username: string;
  text: string;
  system?: boolean;
  at: number;
  reactions?: MessageReaction[];
  attachment?: SnapAttachment;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'tasks' | 'world' | 'media';
  unreadCount?: number;
}

export interface Community {
  id: string;
  name: string;
  icon: string;
  description: string;
  channels: Channel[];
}

export interface CollaborativeTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: number;
  completedAt?: number;
}
