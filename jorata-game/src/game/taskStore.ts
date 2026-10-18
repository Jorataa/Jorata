import type { CollaborativeTask } from '../types/social';
import { sounds } from './audio';

const STORAGE_KEY = 'jorata-collaborative-tasks';

const INITIAL_TASKS: CollaborativeTask[] = [
  {
    id: 'task-1',
    title: 'Build the Meadow East Bridge',
    description: 'Use timber planks and clay pillars to connect the twin hills.',
    completed: true,
    assignee: 'Breeze Mason',
    dueDate: 'Today',
    priority: 'high',
    createdAt: Date.now() - 3600000,
    completedAt: Date.now() - 1800000,
  },
  {
    id: 'task-2',
    title: 'Construct the Glass Lookout Tower',
    description: 'Reach high above the clouds for a panoramic meadow view.',
    completed: false,
    assignee: 'All Explorers',
    dueDate: 'Sunset',
    priority: 'normal',
    createdAt: Date.now() - 2400000,
  },
  {
    id: 'task-3',
    title: 'Pave the spawn arrival welcome walkway',
    description: 'Keep the protected arrival area neat with tidy stone and clay borders.',
    completed: true,
    assignee: 'Mossy Wanderer',
    dueDate: 'Yesterday',
    priority: 'low',
    createdAt: Date.now() - 7200000,
    completedAt: Date.now() - 5400000,
  },
  {
    id: 'task-4',
    title: 'Snap a community group photo at the meadow sign',
    description: 'Gather by the MEADOW signpost and take a Jorata Snap.',
    completed: false,
    assignee: 'Anyone',
    dueDate: 'Soon',
    priority: 'normal',
    createdAt: Date.now() - 1200000,
  },
];

class TaskStore {
  private tasks: CollaborativeTask[] = [];
  private listeners = new Set<(tasks: CollaborativeTask[]) => void>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.tasks = JSON.parse(data);
      } else {
        this.tasks = [...INITIAL_TASKS];
        this.save();
      }
    } catch {
      this.tasks = [...INITIAL_TASKS];
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch {}
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.getTasks());
    }
  }

  public subscribe(listener: (tasks: CollaborativeTask[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getTasks());
    return () => this.listeners.delete(listener);
  }

  public getTasks(): CollaborativeTask[] {
    return [...this.tasks];
  }

  public addTask(title: string, assignee = 'Anyone', priority: 'low' | 'normal' | 'high' = 'normal', dueDate = 'Soon'): CollaborativeTask {
    const newTask: CollaborativeTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      completed: false,
      assignee: assignee.trim() || 'Anyone',
      priority,
      dueDate,
      createdAt: Date.now(),
    };
    this.tasks.unshift(newTask);
    this.save();
    sounds.playUiClick();
    return newTask;
  }

  public toggleTask(id: string): boolean {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return false;
    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : undefined;
    this.save();
    if (task.completed) {
      sounds.playChatPop();
    } else {
      sounds.playUiClick();
    }
    return task.completed;
  }

  public deleteTask(id: string) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.save();
    sounds.playUiClick();
  }
}

export const taskStore = new TaskStore();
