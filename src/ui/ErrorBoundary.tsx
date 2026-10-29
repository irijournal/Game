import React from 'react';

interface State {
  error: string | null;
}

/** Last line of defence: a readable message instead of a blank screen. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(e: unknown): State {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown): void {
    console.error('UP RUN UI error', e);
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal">
        <h1>UP RUN hit a pothole</h1>
        <p>Something went wrong in the game interface. Your saved progress is safe.</p>
        <pre>{this.state.error}</pre>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload game
        </button>
      </div>
    );
  }
}
