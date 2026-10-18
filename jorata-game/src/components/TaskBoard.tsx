import { useEffect, useState, type FormEvent } from 'react';
import type { CollaborativeTask } from '../types/social';
import { taskStore } from '../game/taskStore';
import { sounds } from '../game/audio';
import type { Player } from '../../shared/game';

interface Props {
  me: Player | undefined;
  onShareToChat: (text: string) => void;
  onClose?: () => void;
}

export function TaskBoard({ me, onShareToChat, onClose }: Props) {
  const [tasks, setTasks] = useState<CollaborativeTask[]>(() => taskStore.getTasks());
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [newDue, setNewDue] = useState('Today');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    return taskStore.subscribe(updated => setTasks(updated));
  }, []);

  const total = tasks.length;
  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  function handleToggle(task: CollaborativeTask) {
    const isNowDone = taskStore.toggleTask(task.id);
    if (isNowDone) {
      onShareToChat(`🎉 Completed goal: "${task.title}"!`);
    }
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const task = taskStore.addTask(
      newTitle.trim(),
      me?.username || 'Anyone',
      newPriority,
      newDue
    );
    onShareToChat(`📋 New meadow goal created: "${task.title}"`);
    setNewTitle('');
    setIsAdding(false);
  }

  return (
    <div className="task-board-view" aria-label="Collaborative Tasks">
      {/* Task Board Header */}
      <header className="task-board-header">
        <div className="task-title-group">
          <span className="eyebrow">COMMUNITY COLLABORATION</span>
          <h2>Meadow Goals & Tasks</h2>
        </div>
        {onClose && (
          <button className="icon-close-btn" onClick={onClose} aria-label="Close tasks">
            ✕
          </button>
        )}
      </header>

      {/* Progress Card */}
      <div className="task-progress-card">
        <div className="progress-meta-row">
          <span className="progress-label">Shared Meadow Progress</span>
          <span className="progress-stats">
            <strong>{completedCount}</strong> of {total} completed ({progressPercent}%)
          </span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Action / Filter Bar */}
      <div className="task-filter-bar">
        <div className="filter-pill-group">
          <button
            className={`filter-pill ${filter === 'all' ? 'active-filter' : ''}`}
            onClick={() => {
              sounds.playUiClick();
              setFilter('all');
            }}
          >
            All ({total})
          </button>
          <button
            className={`filter-pill ${filter === 'active' ? 'active-filter' : ''}`}
            onClick={() => {
              sounds.playUiClick();
              setFilter('active');
            }}
          >
            In Progress ({total - completedCount})
          </button>
          <button
            className={`filter-pill ${filter === 'completed' ? 'active-filter' : ''}`}
            onClick={() => {
              sounds.playUiClick();
              setFilter('completed');
            }}
          >
            Completed ({completedCount})
          </button>
        </div>

        <button
          className="add-task-btn"
          onClick={() => {
            sounds.playUiClick();
            setIsAdding(!isAdding);
          }}
        >
          {isAdding ? 'Cancel' : '+ New Goal'}
        </button>
      </div>

      {/* Inline New Task Creator */}
      {isAdding && (
        <form className="new-task-form-card" onSubmit={handleCreate}>
          <input
            autoFocus
            type="text"
            placeholder="What should we build or achieve next?"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            maxLength={120}
            required
          />
          <div className="form-meta-row">
            <div className="form-selects">
              <label>
                Priority:
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value as 'low' | 'normal' | 'high')}
                >
                  <option value="low">🌱 Low</option>
                  <option value="normal">🌿 Normal</option>
                  <option value="high">🔥 High</option>
                </select>
              </label>

              <label>
                Target:
                <select value={newDue} onChange={e => setNewDue(e.target.value)}>
                  <option value="Today">Today</option>
                  <option value="Sunset">At Sunset</option>
                  <option value="Tomorrow">Tomorrow</option>
                  <option value="Soon">Soon</option>
                </select>
              </label>
            </div>

            <button type="submit" className="action-button primary" disabled={!newTitle.trim()}>
              Create Goal <span>→</span>
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      <div className="task-items-stream">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            className={`task-row-card ${task.completed ? 'task-done' : ''}`}
          >
            <button
              className={`task-checkbox ${task.completed ? 'checked' : ''}`}
              onClick={() => handleToggle(task)}
              aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
            >
              {task.completed ? '✓' : ''}
            </button>

            <div className="task-details">
              <span className="task-title">{task.title}</span>
              {task.description && <p className="task-desc">{task.description}</p>}
              <div className="task-tags-row">
                <span className="task-assignee-tag">👤 {task.assignee}</span>
                <span className="task-due-tag">⏱ {task.dueDate}</span>
                <span className={`task-priority-tag priority-${task.priority}`}>
                  {task.priority === 'high' ? '🔥 High' : task.priority === 'low' ? '🌱 Low' : '🌿 Normal'}
                </span>
              </div>
            </div>

            <button
              className="task-delete-btn"
              onClick={() => taskStore.deleteTask(task.id)}
              title="Delete goal"
              aria-label="Delete goal"
            >
              ✕
            </button>
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="empty-tasks-state">
            <span className="empty-icon">🌱</span>
            <h4>No goals in this view</h4>
            <p>Create a goal above and invite fellow explorers to collaborate!</p>
          </div>
        )}
      </div>
    </div>
  );
}
