import { generateWorld, type Input, type Player, type World } from '../../shared/game';

export interface SpeechBubble {
  text: string;
  at: number;
  expiresAt: number;
}

export class GameModel {
  world: World = generateWorld();
  id = '';
  players: Player[] = [];
  local: Player | null = null;
  input: Input = { left: false, right: false, jump: false };
  selected = 4;
  mode: 'place' | 'remove' = 'place';
  connected = false;
  receivedAt = 0;
  cameraX = 0;
  cameraY = 0;

  // Active in-world speech bubbles keyed by player username
  bubbles = new Map<string, SpeechBubble>();

  sync(players: Player[]) {
    this.players = players;
    this.receivedAt = performance.now();
    const self = players.find(p => p.id === this.id);
    if (self && (!this.local || Math.hypot(self.x - this.local.x, self.y - this.local.y) > 3)) {
      this.local = { ...self };
    }
  }

  addBubble(username: string, text: string) {
    const now = performance.now();
    // Longer messages stay slightly longer, capped between 3.5s and 6.5s
    const duration = Math.max(3500, Math.min(6500, 2500 + text.length * 75));
    this.bubbles.set(username, {
      text,
      at: now,
      expiresAt: now + duration,
    });
  }

  getBubble(username: string): SpeechBubble | undefined {
    const bubble = this.bubbles.get(username);
    if (!bubble) return undefined;
    if (performance.now() > bubble.expiresAt) {
      this.bubbles.delete(username);
      return undefined;
    }
    return bubble;
  }
}
