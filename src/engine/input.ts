import type { Action } from '../sim/types';

export type InputAction = Action | 'pause' | 'tap';

/**
 * Keyboard + touch/mouse swipe input. Swipes fire as soon as the finger has
 * travelled far enough (no need to lift), one action per gesture. Scrolling
 * and pull-to-refresh are suppressed only on the game surface.
 */
export class InputController {
  enabled = false;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private tracking = false;
  private fired = false;
  private pointerId = -1;
  private disposers: (() => void)[] = [];

  constructor(
    private surface: HTMLElement,
    private onAction: (a: InputAction) => void,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opts);
      this.disposers.push(() => el.removeEventListener(ev, fn as EventListener, opts));
    };
    on(window, 'keydown', (e: KeyboardEvent) => this.onKey(e));
    on(surface, 'pointerdown', (e: PointerEvent) => this.onDown(e));
    on(surface, 'pointermove', (e: PointerEvent) => this.onMove(e));
    on(surface, 'pointerup', (e: PointerEvent) => this.onUp(e));
    on(surface, 'pointercancel', () => (this.tracking = false));
    on(surface, 'touchmove', (e: TouchEvent) => {
      if (this.enabled) e.preventDefault();
    }, { passive: false });
    on(surface, 'contextmenu', (e: Event) => e.preventDefault());
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.enabled) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    let a: InputAction | null = null;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        a = 'left';
        break;
      case 'ArrowRight':
      case 'KeyD':
        a = 'right';
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        a = 'jump';
        break;
      case 'ArrowDown':
      case 'KeyS':
        a = 'slide';
        break;
      case 'Escape':
      case 'KeyP':
        a = 'pause';
        break;
      case 'Enter':
        a = 'tap';
        break;
    }
    if (!a) return;
    e.preventDefault();
    // A HUD button keeping focus after a click must not also react to Space/Enter.
    if (t && t.tagName === 'BUTTON') t.blur();
    if (e.repeat && a !== 'left' && a !== 'right') return;
    this.onAction(a);
  }

  private onDown(e: PointerEvent): void {
    if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.tracking = true;
    this.fired = false;
    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startT = performance.now();
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* not all browsers allow capture on every element */
    }
  }

  private threshold(): number {
    return Math.max(22, Math.min(window.innerWidth, window.innerHeight) * 0.045);
  }

  private onMove(e: PointerEvent): void {
    if (!this.enabled || !this.tracking || this.fired || e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const th = this.threshold();
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    this.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) this.onAction(dx < 0 ? 'left' : 'right');
    else this.onAction(dy < 0 ? 'jump' : 'slide');
  }

  private onUp(e: PointerEvent): void {
    if (!this.tracking || e.pointerId !== this.pointerId) return;
    this.tracking = false;
    if (!this.enabled || this.fired) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const dt = performance.now() - this.startT;
    if (Math.hypot(dx, dy) < 14 && dt < 350) this.onAction('tap');
  }
}
