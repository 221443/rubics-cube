import "./style.css";
import { RubiksCubeApp } from "./rubiksCubeApp";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="app-shell">
    <section class="intro-panel">
      <p class="eyebrow">Interactive 3D puzzle</p>
      <h1>Rubik's Cube Control Room</h1>
      <p class="lede">
        Orbit the cube, queue face turns, scramble the puzzle, and rewind your move history.
        The scene runs entirely in the browser with touch and mouse support.
      </p>

      <div class="command-grid" aria-label="Cube moves">
        <button class="move-button" data-move="R">R</button>
        <button class="move-button" data-move="R'">R'</button>
        <button class="move-button" data-move="L">L</button>
        <button class="move-button" data-move="L'">L'</button>
        <button class="move-button" data-move="U">U</button>
        <button class="move-button" data-move="U'">U'</button>
        <button class="move-button" data-move="D">D</button>
        <button class="move-button" data-move="D'">D'</button>
        <button class="move-button" data-move="F">F</button>
        <button class="move-button" data-move="F'">F'</button>
        <button class="move-button" data-move="B">B</button>
        <button class="move-button" data-move="B'">B'</button>
      </div>

      <div class="action-row">
        <button class="action-button" data-action="scramble">Scramble</button>
        <button class="action-button" data-action="rewind">Rewind</button>
        <button class="action-button" data-action="reset">Reset</button>
      </div>
    </section>

    <section class="stage-panel">
      <div class="stage-frame">
        <canvas class="cube-canvas" aria-label="Interactive Rubik's cube"></canvas>
        <div class="stage-glow" aria-hidden="true"></div>
        <div class="gyro" aria-hidden="false" title="Quick views">
          <button class="gyro-btn" data-view="home" aria-label="Home">⤒</button>
          <div class="gyro-grid">
            <button class="gyro-btn" data-view="top" aria-label="Top">U</button>
            <button class="gyro-btn" data-view="front" aria-label="Front">F</button>
            <button class="gyro-btn" data-view="right" aria-label="Right">R</button>
            <button class="gyro-btn" data-view="left" aria-label="Left">L</button>
            <button class="gyro-btn" data-view="back" aria-label="Back">B</button>
            <button class="gyro-btn" data-view="bottom" aria-label="Bottom">D</button>
          </div>
        </div>
      </div>
    </section>

    <aside class="info-panel">
      <div class="stat-card">
        <span class="stat-label">Status</span>
        <strong id="status-text">Solved and ready.</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Queued Moves</span>
        <strong id="queue-text">None</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">History Depth</span>
        <strong id="history-text">0</strong>
      </div>

      <div class="tips-card">
        <h2>Controls</h2>
        <ul>
          <li>Drag to orbit the camera.</li>
          <li>Use the wheel or pinch to zoom.</li>
          <li>Press R, L, U, D, F, B to turn faces.</li>
          <li>Hold Shift with a move key for inverse turns.</li>
        </ul>
      </div>
    </aside>
  </main>
`;

new RubiksCubeApp(document.querySelector<HTMLElement>(".app-shell")!);
