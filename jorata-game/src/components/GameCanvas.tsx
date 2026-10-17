import { useEffect, useRef } from 'react';
import type { Input, Player } from '../../shared/game';
import { GameModel } from '../game/model';
import { startRenderer } from '../game/renderer';

interface Props {
  model: GameModel;
  sendInput: (input: Input) => void;
  edit: (x: number, y: number, remove: boolean) => void;
  select: (id: number) => void;
  onInspectPlayer?: (player: Player) => void;
  onToggleEmotes?: () => void;
  onSnapshot?: () => void;
  onToggleMode?: () => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function GameCanvas(props: Props) {
  const localRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;

  useEffect(() => {
    const canvas = props.canvasRef?.current || localRef.current;
    if (!canvas) return;

    return startRenderer(
      canvas,
      props.model,
      input => callbacks.current.sendInput(input),
      (x, y, remove) => callbacks.current.edit(x, y, remove),
      id => callbacks.current.select(id),
      player => callbacks.current.onInspectPlayer?.(player),
      () => callbacks.current.onToggleEmotes?.(),
      () => callbacks.current.onSnapshot?.(),
      () => callbacks.current.onToggleMode?.()
    );
  }, [props.model, props.canvasRef]);

  return (
    <canvas
      id="game-canvas"
      ref={props.canvasRef || localRef}
      tabIndex={0}
      aria-label="The Meadow multiplayer world. A and D or arrows to move, W or Space to jump. Click to build, right click to demolish."
    />
  );
}
