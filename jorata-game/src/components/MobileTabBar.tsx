import { sounds } from '../game/audio';

interface Props {
  activeView: 'split' | 'world' | 'chat' | 'tasks' | 'camera';
  setActiveView: (view: 'split' | 'world' | 'chat' | 'tasks' | 'camera') => void;
  unreadChatCount: number;
  openTasksCount: number;
}

export function MobileTabBar({
  activeView,
  setActiveView,
  unreadChatCount,
  openTasksCount,
}: Props) {
  function switchTab(view: 'world' | 'chat' | 'tasks' | 'camera') {
    sounds.playUiClick();
    setActiveView(view);
  }

  return (
    <nav className="mobile-bottom-tabbar" aria-label="Mobile Navigation">
      <button
        className={`tabbar-btn ${activeView === 'chat' || activeView === 'split' ? 'active-tab' : ''}`}
        onClick={() => switchTab('chat')}
        aria-label="Chats and Channels"
      >
        <span className="tab-icon">💬</span>
        <span className="tab-text">Chats</span>
        {unreadChatCount > 0 && <span className="tab-badge">{unreadChatCount}</span>}
      </button>

      <button
        className={`tabbar-btn ${activeView === 'world' ? 'active-tab' : ''}`}
        onClick={() => switchTab('world')}
        aria-label="Meadow Sandbox World"
      >
        <span className="tab-icon">🎮</span>
        <span className="tab-text">World</span>
      </button>

      <button
        className={`tabbar-btn camera-tab ${activeView === 'camera' ? 'active-tab' : ''}`}
        onClick={() => switchTab('camera')}
        aria-label="Jorata Camera Studio"
      >
        <div className="camera-tab-circle">
          <span className="tab-icon">📸</span>
        </div>
        <span className="tab-text">Snap</span>
      </button>

      <button
        className={`tabbar-btn ${activeView === 'tasks' ? 'active-tab' : ''}`}
        onClick={() => switchTab('tasks')}
        aria-label="Collaborative Tasks"
      >
        <span className="tab-icon">📋</span>
        <span className="tab-text">Tasks</span>
        {openTasksCount > 0 && <span className="tab-badge tasks-badge">{openTasksCount}</span>}
      </button>
    </nav>
  );
}
