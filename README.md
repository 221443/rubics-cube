# Rubik's Cube Control Room

Interactive 3D Rubik's cube puzzle built with Vite, TypeScript, and Three.js.

## Requirements

- Node.js 18 or newer
- npm

## Install

```bash
npm install
```

## Run locally

Start the development server:

```bash
npm run dev
```

Vite will print the local URL in the terminal, usually:

```text
http://localhost:5173/
```

Open that address in your browser to use the app.

## Build for production

```bash
npm run build
```

This creates an optimized production build in the `dist` folder.

## Preview the production build

```bash
npm run preview
```

## Controls

- Drag the cube to orbit the camera.
- Use the mouse wheel or pinch gesture to zoom.
- Click the face move buttons for `R`, `L`, `U`, `D`, `F`, and `B` turns.
- Hold `Shift` while pressing a move key to apply the inverse turn.
- Press `Space` to scramble.
- Press `Backspace` to rewind the move history.
- Use the on-screen `Scramble`, `Rewind`, and `Reset` buttons for quick actions.

## Notes

- The app uses Three.js for rendering and OrbitControls for camera movement.
- The build is intentionally simple so it can run locally without any extra services.
