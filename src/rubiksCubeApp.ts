import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";

type MoveName = "R" | "R'" | "L" | "L'" | "U" | "U'" | "D" | "D'" | "F" | "F'" | "B" | "B'";
type Axis = "x" | "y" | "z";

type MoveDefinition = {
  axis: Axis;
  layer: -1 | 0 | 1;
  direction: 1 | -1;
};

type QueuedMove = {
  move: MoveName;
  recordHistory: boolean;
};

type Cubie = {
  mesh: THREE.Mesh;
  coord: THREE.Vector3;
};

type ActiveTurn = {
  entry: QueuedMove;
  group: THREE.Group;
  cubies: Cubie[];
  axis: Axis;
  targetAngle: number;
  elapsed: number;
};

const TURN_DURATION = 0.22;
const CUBIE_SPACING = 1.05;

const MOVE_DEFINITIONS: Record<MoveName, MoveDefinition> = {
  R: { axis: "x", layer: 1, direction: -1 },
  "R'": { axis: "x", layer: 1, direction: 1 },
  L: { axis: "x", layer: -1, direction: 1 },
  "L'": { axis: "x", layer: -1, direction: -1 },
  U: { axis: "y", layer: 1, direction: -1 },
  "U'": { axis: "y", layer: 1, direction: 1 },
  D: { axis: "y", layer: -1, direction: 1 },
  "D'": { axis: "y", layer: -1, direction: -1 },
  F: { axis: "z", layer: 1, direction: -1 },
  "F'": { axis: "z", layer: 1, direction: 1 },
  B: { axis: "z", layer: -1, direction: 1 },
  "B'": { axis: "z", layer: -1, direction: -1 },
};

const SCRAMBLE_POOL = Object.keys(MOVE_DEFINITIONS) as MoveName[];

const STICKER_COLORS = {
  right: "#ff4d4d",
  left: "#ff8f1f",
  top: "#f5f7fa",
  bottom: "#f7d047",
  front: "#3fe084",
  back: "#4d71ff",
  inner: "#111723",
};

export class RubiksCubeApp {
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly statusText: HTMLElement;
  private readonly queueText: HTMLElement;
  private readonly historyText: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private readonly controls: TrackballControls;
  private readonly clock = new THREE.Clock();
  private readonly cubeRoot = new THREE.Group();
  private readonly cubieGeometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  private readonly resizeObserver: ResizeObserver;
  private cubies: Cubie[] = [];
  private moveQueue: QueuedMove[] = [];
  private moveHistory: MoveName[] = [];
  private activeTurn: ActiveTurn | null = null;
  private initialCameraPos = new THREE.Vector3();
  private initialTarget = new THREE.Vector3();
  private cameraTween: {
    startOffset: THREE.Vector3;
    endOffset: THREE.Vector3;
    target: THREE.Vector3;
    elapsed: number;
    duration: number;
  } | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.canvas = host.querySelector<HTMLCanvasElement>(".cube-canvas")!;
    this.statusText = host.querySelector<HTMLElement>("#status-text")!;
    this.queueText = host.querySelector<HTMLElement>("#queue-text")!;
    this.historyText = host.querySelector<HTMLElement>("#history-text")!;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.position.set(6.5, 6.3, 7.4);

    this.controls = new TrackballControls(this.camera, this.canvas);
    this.controls.minDistance = 5;
    this.controls.maxDistance = 12;
    this.controls.zoomSpeed = 1.2;
    this.controls.rotateSpeed = 4;
    this.controls.panSpeed = 0.8;
    this.controls.noPan = true;
    this.controls.dynamicDampingFactor = 0.12;
    this.controls.target.set(0, 0, 0);

    this.scene.add(this.cubeRoot);
    this.configureScene();
    this.buildCube();
    this.bindUi();
    this.resize();
    this.updateHud("Solved and ready.");
    // setup gyro quick-views and store home position
    this.createGyro();
    this.initialCameraPos.copy(this.camera.position);
    this.initialTarget.copy(this.controls.target);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    window.addEventListener("keydown", this.handleKeydown);

    this.renderer.setAnimationLoop(() => this.animate());
  }

  private configureScene() {
    this.scene.background = null;

    const ambient = new THREE.AmbientLight("#ffffff", 1.9);
    const key = new THREE.DirectionalLight("#ffffff", 2.3);
    const rim = new THREE.DirectionalLight("#6fd6ff", 1.1);
    const fill = new THREE.DirectionalLight("#ff9d4d", 0.9);

    key.position.set(8, 12, 8);
    rim.position.set(-7, 6, -10);
    fill.position.set(0, -5, 8);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), new THREE.MeshBasicMaterial({ color: "#10253f", transparent: true, opacity: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.25;

    this.scene.add(ambient, key, rim, fill, floor);
  }

  private buildCube() {
    this.cubies = [];

    for (const x of [-1, 0, 1]) {
      for (const y of [-1, 0, 1]) {
        for (const z of [-1, 0, 1]) {
          const mesh = new THREE.Mesh(this.cubieGeometry, this.createCubieMaterials(x, y, z));
          mesh.position.set(x * CUBIE_SPACING, y * CUBIE_SPACING, z * CUBIE_SPACING);

          const cubie: Cubie = {
            mesh,
            coord: new THREE.Vector3(x, y, z),
          };

          this.cubies.push(cubie);
          this.cubeRoot.add(mesh);
        }
      }
    }

    this.cubeRoot.rotation.x = -0.45;
    this.cubeRoot.rotation.y = 0.55;
  }

  private createCubieMaterials(x: number, y: number, z: number) {
    const materialOptions = { roughness: 0.34, metalness: 0.04 };

    return [
      new THREE.MeshStandardMaterial({ color: x === 1 ? STICKER_COLORS.right : STICKER_COLORS.inner, ...materialOptions }),
      new THREE.MeshStandardMaterial({ color: x === -1 ? STICKER_COLORS.left : STICKER_COLORS.inner, ...materialOptions }),
      new THREE.MeshStandardMaterial({ color: y === 1 ? STICKER_COLORS.top : STICKER_COLORS.inner, roughness: 0.22, metalness: 0.03 }),
      new THREE.MeshStandardMaterial({ color: y === -1 ? STICKER_COLORS.bottom : STICKER_COLORS.inner, roughness: 0.3, metalness: 0.03 }),
      new THREE.MeshStandardMaterial({ color: z === 1 ? STICKER_COLORS.front : STICKER_COLORS.inner, ...materialOptions }),
      new THREE.MeshStandardMaterial({ color: z === -1 ? STICKER_COLORS.back : STICKER_COLORS.inner, ...materialOptions }),
    ].map((material) => {
      material.emissive = new THREE.Color("#020406");
      material.emissiveIntensity = 0.12;
      return material;
    }) as THREE.MeshStandardMaterial[];
  }

  private bindUi() {
    this.host.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((button) => {
      button.addEventListener("click", () => {
        this.enqueueMove(button.dataset.move as MoveName);
      });
    });

    this.host.querySelector('[data-action="scramble"]')?.addEventListener("click", () => {
      this.scrambleCube();
    });
    this.host.querySelector('[data-action="rewind"]')?.addEventListener("click", () => {
      this.rewindHistory();
    });
    this.host.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
      this.resetCube();
    });
  }

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.repeat) {
      return;
    }

    const key = event.key.toUpperCase();
    if ("RLUDFB".includes(key)) {
      const move = `${key}${event.shiftKey ? "'" : ""}` as MoveName;
      this.enqueueMove(move);
      event.preventDefault();
      return;
    }

    if (event.code === "Space") {
      this.scrambleCube();
      event.preventDefault();
      return;
    }

    if (event.key === "Backspace") {
      this.rewindHistory();
      event.preventDefault();
    }
  };

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate() {
    const delta = this.clock.getDelta();
    this.controls.update();

    if (this.cameraTween) {
      this.cameraTween.elapsed += delta;
      const t = Math.min(this.cameraTween.elapsed / this.cameraTween.duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const currentOffset = lerpOrbitOffset(this.cameraTween.startOffset, this.cameraTween.endOffset, eased);

      this.camera.position.copy(this.cameraTween.target).add(currentOffset);
      this.controls.target.copy(this.cameraTween.target);
      this.controls.update();

      if (t >= 1) {
        this.cameraTween = null;
      }
    }

    if (this.activeTurn) {
      this.activeTurn.elapsed += delta;
      const progress = Math.min(this.activeTurn.elapsed / TURN_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      this.activeTurn.group.rotation[this.activeTurn.axis] = this.activeTurn.targetAngle * eased;

      if (progress >= 1) {
        this.finishTurn();
      }
    } else if (this.moveQueue.length > 0) {
      this.startNextTurn();
    }

    this.renderer.render(this.scene, this.camera);
  }

  private enqueueMove(move: MoveName, recordHistory = true) {
    this.moveQueue.push({ move, recordHistory });
    this.updateHud(this.activeTurn ? `Queued ${move}.` : `Ready for ${move}.`);
  }

  private createGyro() {
    const gyro = this.host.querySelector<HTMLElement>(".gyro");
    if (!gyro) return;

    gyro.querySelectorAll<HTMLElement>("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        if (view) this.applyView(view);
      });
    });
  }

  private applyView(view: string) {
    const distance = this.camera.position.distanceTo(this.controls.target);
    let endPos = new THREE.Vector3();

    switch (view) {
      case "front":
        endPos.set(0, 0, distance);
        break;
      case "back":
        endPos.set(0, 0, -distance);
        break;
      case "right":
        endPos.set(distance, 0, 0);
        break;
      case "left":
        endPos.set(-distance, 0, 0);
        break;
      case "top":
        endPos.set(0, distance, distance * 0.25);
        break;
      case "bottom":
        endPos.set(0, -distance, distance * 0.25);
        break;
      case "home":
      default:
        endPos.copy(this.initialCameraPos).sub(this.initialTarget).setLength(distance).add(this.initialTarget);
        break;
    }

    const endTarget = this.initialTarget.clone();
    this.startCameraTween(endPos, endTarget, 0.6);
  }

  private startCameraTween(endPos: THREE.Vector3, endTarget: THREE.Vector3, duration = 0.6) {
    this.cameraTween = {
      startOffset: this.camera.position.clone().sub(endTarget),
      endOffset: endPos.clone().sub(endTarget),
      target: endTarget.clone(),
      elapsed: 0,
      duration,
    };
  }

  private startNextTurn() {
    const entry = this.moveQueue.shift();
    if (!entry) {
      return;
    }

    const definition = MOVE_DEFINITIONS[entry.move];
    const group = new THREE.Group();
    const cubies = this.cubies.filter((cubie) => cubie.coord[definition.axis] === definition.layer);

    this.cubeRoot.add(group);
    cubies.forEach((cubie) => group.attach(cubie.mesh));

    if (entry.recordHistory) {
      this.moveHistory.push(entry.move);
    }

    this.activeTurn = {
      entry,
      group,
      cubies,
      axis: definition.axis,
      targetAngle: definition.direction * (Math.PI / 2),
      elapsed: 0,
    };

    this.updateHud(`Turning ${entry.move}.`);
  }

  private finishTurn() {
    if (!this.activeTurn) {
      return;
    }

    const { group, cubies, axis, entry } = this.activeTurn;
    group.rotation[axis] = this.activeTurn.targetAngle;

    cubies.forEach((cubie) => {
      this.cubeRoot.attach(cubie.mesh);
      this.snapCubie(cubie);
    });

    this.cubeRoot.remove(group);
    this.activeTurn = null;
    this.updateHud(`Completed ${entry.move}.`);
  }

  private snapCubie(cubie: Cubie) {
    cubie.mesh.position.set(
      Math.round(cubie.mesh.position.x / CUBIE_SPACING) * CUBIE_SPACING,
      Math.round(cubie.mesh.position.y / CUBIE_SPACING) * CUBIE_SPACING,
      Math.round(cubie.mesh.position.z / CUBIE_SPACING) * CUBIE_SPACING,
    );

    cubie.coord.set(
      Math.round(cubie.mesh.position.x / CUBIE_SPACING),
      Math.round(cubie.mesh.position.y / CUBIE_SPACING),
      Math.round(cubie.mesh.position.z / CUBIE_SPACING),
    );

    const snappedRight = snapAxisVector(new THREE.Vector3(1, 0, 0).applyQuaternion(cubie.mesh.quaternion));
    const provisionalUp = snapAxisVector(new THREE.Vector3(0, 1, 0).applyQuaternion(cubie.mesh.quaternion));
    const snappedForward = snapAxisVector(new THREE.Vector3().crossVectors(snappedRight, provisionalUp));
    const snappedUp = new THREE.Vector3().crossVectors(snappedForward, snappedRight);

    const basis = new THREE.Matrix4().makeBasis(snappedRight, snappedUp, snappedForward);
    cubie.mesh.quaternion.setFromRotationMatrix(basis);
  }

  private scrambleCube() {
    let previousAxis: Axis | null = null;
    const sequence: MoveName[] = [];

    while (sequence.length < 20) {
      const candidate = SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
      const candidateAxis = MOVE_DEFINITIONS[candidate].axis;
      if (candidateAxis === previousAxis) {
        continue;
      }

      previousAxis = candidateAxis;
      sequence.push(candidate);
    }

    sequence.forEach((move) => this.enqueueMove(move, true));
    this.updateHud("Scramble sequence queued.");
  }

  private rewindHistory() {
    if (this.moveHistory.length === 0) {
      this.updateHud("No move history to rewind.");
      return;
    }

    const solution = [...this.moveHistory].reverse().map(invertMove);
    this.moveHistory = [];
    solution.forEach((move) => this.enqueueMove(move, false));
    this.updateHud("Rewind sequence queued.");
  }

  private resetCube() {
    this.moveQueue = [];
    this.moveHistory = [];

    if (this.activeTurn) {
      this.activeTurn.cubies.forEach((cubie) => this.cubeRoot.attach(cubie.mesh));
      this.cubeRoot.remove(this.activeTurn.group);
      this.activeTurn = null;
    }

    this.cubies.forEach((cubie) => this.cubeRoot.remove(cubie.mesh));
    this.buildCube();
    this.updateHud("Cube reset to solved state.");
  }

  private updateHud(statusMessage: string) {
    this.statusText.textContent = statusMessage;
    this.queueText.textContent =
      this.moveQueue.length > 0
        ? this.moveQueue
            .slice(0, 8)
            .map((entry) => entry.move)
            .join(" ")
        : "None";
    this.historyText.textContent = `${this.moveHistory.length}`;
  }
}

function invertMove(move: MoveName): MoveName {
  return (move.endsWith("'") ? move.slice(0, -1) : `${move}'`) as MoveName;
}

function snapAxisVector(vector: THREE.Vector3) {
  const candidates = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  return candidates.reduce((best, candidate) => {
    return candidate.dot(vector) > best.dot(vector) ? candidate : best;
  });
}

function lerpOrbitOffset(start: THREE.Vector3, end: THREE.Vector3, t: number) {
  const startSpherical = new THREE.Spherical().setFromVector3(start);
  const endSpherical = new THREE.Spherical().setFromVector3(end);
  const thetaDelta = normalizeAngle(endSpherical.theta - startSpherical.theta);
  const spherical = new THREE.Spherical(
    THREE.MathUtils.lerp(startSpherical.radius, endSpherical.radius, t),
    THREE.MathUtils.lerp(startSpherical.phi, endSpherical.phi, t),
    startSpherical.theta + thetaDelta * t,
  );

  return new THREE.Vector3().setFromSpherical(spherical);
}

function normalizeAngle(angle: number) {
  if (angle > Math.PI) {
    return angle - Math.PI * 2;
  }

  if (angle < -Math.PI) {
    return angle + Math.PI * 2;
  }

  return angle;
}
