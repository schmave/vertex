import dayjs from 'dayjs';
import Hammer from 'hammerjs';

interface Vector {
  x: number;
  y: number;
}
function sqr(x: number) {
  return x * x;
}
function dist2(v: Vector, w: Vector) {
  return sqr(v.x - w.x) + sqr(v.y - w.y);
}
function distToSegmentSquared(p: Vector, v: Vector, w: Vector) {
  var l2 = dist2(v, w);
  if (l2 == 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y),
  });
}
function distToSegment(p: Vector, v: Vector, w: Vector) {
  return Math.sqrt(distToSegmentSquared(p, v, w));
}
interface Shape {
  color: string;
  isPreDrawn?: boolean;
  vertices: number[];

  completed?: boolean;
}
interface Vertex {
  coordinates: number[];
  shapes: string[];

  // These properties are missing from the initial puzzle data
  id?: number;
  selected?: 0 | 1 | 2;
}
interface Puzzle {
  date: string;
  displayDate: string;
  id: string;
  palette: string[];
  puzzleConstructor: string;
  theme: string;
  shapes: Shape[];
  vertices: { [key: string]: Vertex };
}
type Stroke = [Vertex, Vertex];

let completedStrokes: Stroke[] = [];
let completed = false;

const canvasScale = Math.ceil(window.devicePixelRatio);
const fillCanvas = <HTMLCanvasElement>document.getElementById('fill');
const strokeCanvas = <HTMLCanvasElement>document.getElementById('stroke');
const pointsCanvas = <HTMLCanvasElement>document.getElementById('points');
const cursorCanvas = <HTMLCanvasElement>document.getElementById('cursor');
const uiCanvas = <HTMLCanvasElement>document.getElementById('uicanvas');

const fillCtx = <CanvasRenderingContext2D>fillCanvas.getContext('2d');
const strokeCtx = <CanvasRenderingContext2D>strokeCanvas.getContext('2d');
const pointsCtx = <CanvasRenderingContext2D>pointsCanvas.getContext('2d');
const cursorCtx = <CanvasRenderingContext2D>cursorCanvas.getContext('2d');
const uiCtx = <CanvasRenderingContext2D>uiCanvas.getContext('2d');

const backElement = <HTMLButtonElement>document.getElementById('back');
backElement.addEventListener('click', () => {
  window.location.reload();
});

const undoElement = <HTMLButtonElement>document.getElementById('undo');
const fullscreenElement = <HTMLButtonElement>(
  document.getElementById('fullscreen')
);
const zoomElement = <HTMLDivElement>document.getElementById('zoom');
const constructorElement = <HTMLSpanElement>(
  document.getElementById('constructor')
);
const themeElement = <HTMLSpanElement>document.getElementById('theme');
const dateElement = <HTMLSpanElement>document.getElementById('date');

let clicked: Vertex | null;
let selected: Vertex | null;
let mouseDown = false;
let mouse = { x: 0, y: 0 };

let puzzle: Puzzle;
let extents: { minX: number; minY: number; maxX: number; maxY: number };
let xShift: number;
let yShift: number;
let scale = 1;

document.addEventListener('fullscreenchange', (event) => {
  if (document.fullscreenElement) {
    fullscreenElement.style.display = 'none';
  } else {
    fullscreenElement.style.display = 'flex';
  }
});

export const goFullscreen = () =>
  document.documentElement.requestFullscreen({
    navigationUI: 'hide',
  });
fullscreenElement.addEventListener('click', goFullscreen);

function saveCompletedStrokes() {
  localStorage.setItem(
    `strokes-${puzzle.id}`,
    JSON.stringify(
      completedStrokes.map((stroke) => [stroke[0].id, stroke[1].id])
    )
  );
}

function loadCompletedStrokes() {
  const data = localStorage.getItem(`strokes-${puzzle.id}`);
  if (data) {
    const strokeData: [number, number][] = JSON.parse(data);
    completedStrokes = [];
    for (const strokeI in strokeData) {
      const stroke = strokeData[strokeI];
      completedStrokes.push([
        puzzle.vertices[stroke[0]],
        puzzle.vertices[stroke[1]],
      ]);
    }
  }
  // renderShapes marks completed shapes as completed
  renderShapes();
}

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    if (newModule) {
      // Just reload so that things aren't broken after a hot update.
      // I can't figure out how to make this work properly.
      window.location.reload();
      // console.warn("HOT UPDATE main.ts -- things will be broken now");
      // // This is a step in the right direction
      // newModule.createGame(puzzle);
    }
  });

  import.meta.hot.dispose((data) => {
    // hammertime.get("pinch").set({ enable: false });
    // hammertime.get("pan").set({ enable: false });
    // isDead = true;
  });
}

export function createGame(puzzleData: Puzzle) {
  puzzle = puzzleData;
  for (const vertexId in puzzle.vertices) {
    puzzle.vertices[vertexId].id = parseInt(vertexId, 10);
  }
  loadCompletedStrokes();

  extents = getExtents();
  if (
    ((extents.maxX - extents.minX) * (extents.maxY - extents.minY)) /
      (document.documentElement.clientWidth *
        canvasScale *
        document.documentElement.clientHeight *
        canvasScale) <
    0.25
  ) {
    console.log('doubling');
    //double coordinates of vertices
    for (const key in puzzle.vertices) {
      puzzle.vertices[key].coordinates = puzzle.vertices[key].coordinates.map(
        (coord) => coord * 2
      );
    }
    extents = getExtents();
  }

  xShift =
    -extents.minX +
    (document.documentElement.clientWidth * canvasScale) / 2 -
    (extents.maxX - extents.minX) / 2;
  yShift =
    -extents.minY +
    (document.documentElement.clientHeight * canvasScale) / 2 -
    (extents.maxY - extents.minY) / 2;

  window.visualViewport?.addEventListener('resize', onResize);
  window.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('touchmove', (event) => event.preventDefault());
  window.addEventListener('keyup', onKeyup);
  window.addEventListener('wheel', onWheel);

  uiCanvas.addEventListener('mousedown', (event) => {
    if (event.button == 2) {
      removeClosestSegment(event.clientX, event.clientY);
    }
  });
  uiCanvas.addEventListener('mousemove', (event) => {
    if (!mouseDown) {
      onMousemove(event);
    }
  });

  undoElement.addEventListener('click', undoStroke);
  zoomElement.children[0]?.addEventListener('click', () =>
    zoom(
      scale + 0.4,
      (document.documentElement.clientWidth * canvasScale) / 2,
      (document.documentElement.clientHeight * canvasScale) / 2
    )
  );
  zoomElement.children[1]?.addEventListener('click', () =>
    zoom(
      scale - 0.4,
      (document.documentElement.clientWidth * canvasScale) / 2,
      (document.documentElement.clientHeight * canvasScale) / 2
    )
  );

  constructorElement.innerText = puzzle.puzzleConstructor;
  themeElement.innerText = puzzle.theme;
  dateElement.innerText = dayjs(puzzle.date).format('dddd,	MMMM DD, YYYY');

  setCanvasSizes();
  render();
}

function setCanvasSizes() {
  const height = document.documentElement.clientHeight * canvasScale;
  const width = document.documentElement.clientWidth * canvasScale;
  fillCanvas.height = height;
  fillCanvas.width = width;
  strokeCanvas.height = height;
  strokeCanvas.width = width;
  pointsCanvas.height = height;
  pointsCanvas.width = width;
  cursorCanvas.height = height;
  cursorCanvas.width = width;
  uiCanvas.height = height;
  uiCanvas.width = width;
}
function getExtents(): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const minX = Math.min(
    ...Object.keys(puzzle.vertices).map(
      (key) => puzzle.vertices[key].coordinates[0]
    )
  );
  const minY = Math.min(
    ...Object.keys(puzzle.vertices).map(
      (key) => puzzle.vertices[key].coordinates[1]
    )
  );
  const maxX = Math.max(
    ...Object.keys(puzzle.vertices).map(
      (key) => puzzle.vertices[key].coordinates[0]
    )
  );
  const maxY = Math.max(
    ...Object.keys(puzzle.vertices).map(
      (key) => puzzle.vertices[key].coordinates[1]
    )
  );
  return { minX, minY, maxX, maxY };
}

function getStrokesAtPoint(vertex: Vertex | string): Stroke[] {
  if (typeof vertex === 'string') {
    vertex = puzzle.vertices[vertex];
  }
  const strokes: Stroke[] = [];
  for (let shapeIdx of vertex.shapes) {
    for (let shapeVertex of puzzle.shapes[parseInt(shapeIdx)].vertices) {
      if (puzzle.vertices[shapeVertex] === vertex) {
        continue;
      }
      const stroke: Stroke = [vertex, puzzle.vertices[shapeVertex]];
      if (
        strokes.find(
          (s) =>
            (s[0] === stroke[0] && s[1] === stroke[1]) ||
            (s[0] === stroke[1] && s[1] === stroke[0])
        )
      ) {
        continue;
      }
      strokes.push(stroke);
    }
  }
  return strokes;
}
function getCompletedStrokesAtPoint(vertex: Vertex | string): Stroke[] {
  if (typeof vertex === 'string') {
    vertex = puzzle.vertices[vertex];
  }
  const strokes: Stroke[] = completedStrokes.filter(
    (stroke) => stroke[0] === vertex || stroke[1] === vertex
  );

  return strokes;
}
function isStrokeCompleted(stroke: Stroke) {
  return completedStrokes.find(
    (s) =>
      (s[0] === stroke[0] && s[1] === stroke[1]) ||
      (s[0] === stroke[1] && s[1] === stroke[0])
  );
}

function getPointSize(key: string) {
  const number =
    getStrokesAtPoint(key).length - getCompletedStrokesAtPoint(key).length;
  const size = number < 4 ? 12 : number < 7 ? 18 : 24;
  // This was the old way of adjusting the size of the points a little bit based
  // on the current zoom.
  // Math.min(0.2 * scale + 0.8, 1.75);
  return size * canvasScale * 1;
}

function renderStrokes() {
  strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
  if (completed) return;
  for (const stroke of completedStrokes) {
    strokeCtx.strokeStyle = 'black';
    strokeCtx.lineWidth = 1;
    strokeCtx.beginPath();
    strokeCtx.moveTo(
      scale * stroke[0].coordinates[0] + xShift,
      scale * stroke[0].coordinates[1] + yShift
    );
    strokeCtx.lineTo(
      scale * stroke[1].coordinates[0] + xShift,
      scale * stroke[1].coordinates[1] + yShift
    );
    strokeCtx.closePath();
    strokeCtx.stroke();
  }
}
function renderShapes() {
  fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);
  let allCompleted = true;
  for (const shape of puzzle.shapes) {
    if (
      isStrokeCompleted([
        puzzle.vertices[shape.vertices[0]],
        puzzle.vertices[shape.vertices[1]],
      ]) &&
      isStrokeCompleted([
        puzzle.vertices[shape.vertices[1]],
        puzzle.vertices[shape.vertices[2]],
      ]) &&
      isStrokeCompleted([
        puzzle.vertices[shape.vertices[2]],
        puzzle.vertices[shape.vertices[0]],
      ])
    ) {
      shape.completed = true;
    } else if (completed) {
      shape.completed = true;
    } else {
      allCompleted = false;
      shape.completed = false;
    }
    if (shape.isPreDrawn) {
      if (
        !isStrokeCompleted([
          puzzle.vertices[shape.vertices[0]],
          puzzle.vertices[shape.vertices[1]],
        ])
      )
        completedStrokes.push([
          puzzle.vertices[shape.vertices[0]],
          puzzle.vertices[shape.vertices[1]],
        ]);
      if (
        !isStrokeCompleted([
          puzzle.vertices[shape.vertices[1]],
          puzzle.vertices[shape.vertices[2]],
        ])
      )
        completedStrokes.push([
          puzzle.vertices[shape.vertices[1]],
          puzzle.vertices[shape.vertices[2]],
        ]);
      if (
        !isStrokeCompleted([
          puzzle.vertices[shape.vertices[2]],
          puzzle.vertices[shape.vertices[0]],
        ])
      )
        completedStrokes.push([
          puzzle.vertices[shape.vertices[2]],
          puzzle.vertices[shape.vertices[0]],
        ]);
      shape.completed = true;
      shape.isPreDrawn = false;
      renderStrokes();
      renderPoints();
    }
    if (shape.completed) {
      fillCtx.fillStyle = puzzle.palette[parseInt(shape.color)];
      fillCtx.beginPath();
      fillCtx.moveTo(
        scale * puzzle.vertices[shape.vertices[0]].coordinates[0] + xShift,
        scale * puzzle.vertices[shape.vertices[0]].coordinates[1] + yShift
      );
      fillCtx.lineTo(
        scale * puzzle.vertices[shape.vertices[1]].coordinates[0] + xShift,
        scale * puzzle.vertices[shape.vertices[1]].coordinates[1] + yShift
      );
      fillCtx.lineTo(
        scale * puzzle.vertices[shape.vertices[2]].coordinates[0] + xShift,
        scale * puzzle.vertices[shape.vertices[2]].coordinates[1] + yShift
      );
      fillCtx.closePath();
      fillCtx.fill();
    }
  }
  if (allCompleted) {
    completed = true;
    renderStrokes();
    renderPoints();
    renderCursor();
    renderUI();
  }
}
function renderPoints() {
  pointsCtx.clearRect(0, 0, pointsCanvas.width, pointsCanvas.height);
  if (completed) return;
  for (const key in puzzle.vertices) {
    const vertex = puzzle.vertices[key];
    const strokes =
      getStrokesAtPoint(key).length - getCompletedStrokesAtPoint(key).length;

    if (
      strokes === 0 &&
      !vertex.shapes.find((shape) => !puzzle.shapes[parseInt(shape)].completed)
    )
      continue;

    const size = getPointSize(key);

    pointsCtx.strokeStyle = vertex.selected === 2 ? '#e7ad34' : 'black';

    pointsCtx.lineWidth = 1;
    pointsCtx.setLineDash([1, 1]);
    pointsCtx.beginPath();
    pointsCtx.arc(
      scale * vertex.coordinates[0] + xShift,
      scale * vertex.coordinates[1] + yShift,
      1.5 * size,
      0,
      2 * Math.PI
    );
    pointsCtx.closePath();
    if (vertex.selected) {
      pointsCtx.fillStyle =
        vertex.selected === 2 ? '#e7ad3433' : 'rgba(0, 0, 0, 0.2)';
      pointsCtx.fill();
    }
    pointsCtx.stroke();

    pointsCtx.fillStyle =
      vertex.selected === 2
        ? '#e7ad34'
        : vertex.selected === 1
        ? 'black'
        : '#f7f5f6';
    pointsCtx.lineWidth = 1;
    pointsCtx.setLineDash([]);
    pointsCtx.beginPath();
    pointsCtx.arc(
      scale * vertex.coordinates[0] + xShift,
      scale * vertex.coordinates[1] + yShift,
      size,
      0,
      2 * Math.PI
    );
    pointsCtx.closePath();
    pointsCtx.fill();
    pointsCtx.stroke();

    pointsCtx.font = `${15 * canvasScale}px Inter`;
    pointsCtx.textAlign = 'center';
    pointsCtx.textBaseline = 'middle';
    pointsCtx.fillStyle = vertex.selected === 1 ? '#f7f5f6' : 'black';
    pointsCtx.fillText(
      strokes.toString(),
      scale * vertex.coordinates[0] + xShift,
      scale * vertex.coordinates[1] + yShift
    );
  }
}
function renderCursor() {
  cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
  if (completed) return;
  if (clicked && mouseDown) {
    if (clicked.selected === 2) {
      cursorCtx.strokeStyle = '#e7ad34';
      cursorCtx.fillStyle = '#e7ad34';
    } else {
      cursorCtx.strokeStyle = 'black';
      cursorCtx.fillStyle = 'black';
    }

    cursorCtx.lineWidth = 4;
    cursorCtx.setLineDash([4, 4]);
    cursorCtx.beginPath();
    cursorCtx.moveTo(
      scale * clicked.coordinates[0] + xShift,
      scale * clicked.coordinates[1] + yShift
    );
    cursorCtx.lineTo(mouse.x, mouse.y);
    cursorCtx.stroke();
    cursorCtx.closePath();

    cursorCtx.moveTo(mouse.x, mouse.y);
    cursorCtx.arc(mouse.x, mouse.y, 4, 0, 2 * Math.PI);
    cursorCtx.fill();
    cursorCtx.lineWidth = 1;
    cursorCtx.setLineDash([1, 1]);
    cursorCtx.beginPath();
    cursorCtx.arc(mouse.x, mouse.y, 24, 0, 2 * Math.PI);
    cursorCtx.closePath();
    cursorCtx.stroke();
  }
}
function renderUI() {
  uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

  const footerHeight = 40 * canvasScale;
  const footerTop = uiCanvas.height - footerHeight;

  uiCtx.fillStyle = '#f7f5f6';
  uiCtx.strokeStyle = 'black';
  uiCtx.lineWidth = 2;
  uiCtx.fillRect(0, footerTop, uiCanvas.width, footerHeight);
  uiCtx.beginPath();
  uiCtx.moveTo(0, footerTop);
  uiCtx.lineTo(uiCanvas.width, footerTop);
  uiCtx.closePath();
  uiCtx.stroke();

  // triangle
  const triangleHeight = 40 * canvasScale;
  const triangleWidth = 50 * canvasScale;
  uiCtx.beginPath();
  uiCtx.moveTo(uiCanvas.width / 2, footerTop - triangleHeight / 2);
  uiCtx.lineTo(
    uiCanvas.width / 2 - triangleWidth / 2,
    footerTop + triangleHeight / 2
  );
  uiCtx.lineTo(
    uiCanvas.width / 2 + triangleWidth / 2,
    footerTop + triangleHeight / 2
  );
  uiCtx.closePath();
  uiCtx.fill();
  uiCtx.stroke();

  uiCtx.textBaseline = 'middle';
  uiCtx.fillStyle = 'black';
  uiCtx.font = `${14 * canvasScale}px Inter`;
  uiCtx.textAlign = 'center';
  uiCtx.fillText(
    puzzle.shapes
      .filter((shape) => !shape.isPreDrawn && !shape.completed)
      .length.toString(),
    uiCanvas.width / 2,
    footerTop + 7 * canvasScale
  );
}
function createStroke(vertex1: Vertex, vertex2: Vertex): boolean {
  // LINES CANNOT CROSS!!!!
  const ax = Math.floor(vertex1.coordinates[0]); // for some reason old puzzles have non-integer coordinates
  const ay = Math.floor(vertex1.coordinates[1]);
  const bx = Math.floor(vertex2.coordinates[0]);
  const by = Math.floor(vertex2.coordinates[1]);
  for (let stroke of completedStrokes) {
    const cx = Math.floor(stroke[0].coordinates[0]);
    const cy = Math.floor(stroke[0].coordinates[1]);
    const dx = Math.floor(stroke[1].coordinates[0]);
    const dy = Math.floor(stroke[1].coordinates[1]);
    const den = (dy - cy) * (bx - ax) - (dx - cx) * (by - ay);
    if (den === 0) {
      continue;
    }
    const ua = ((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)) / den;
    const ub = ((bx - ax) * (ay - cy) - (by - ay) * (ax - cx)) / den;
    if (ua > 0 && ua < 1 && ub > 0 && ub < 1) {
      console.log('crossing', vertex1, vertex2, stroke);
      return false;
    }
  }

  // DOES THE POINT HAVE ENOUGH REMAINING STROKES???
  if (
    getStrokesAtPoint(vertex1).length -
      getCompletedStrokesAtPoint(vertex1).length <
      1 ||
    getStrokesAtPoint(vertex2).length -
      getCompletedStrokesAtPoint(vertex2).length <
      1
  ) {
    return false;
  }
  const stroke: Stroke = [vertex1, vertex2];

  if (isStrokeCompleted(stroke)) {
    return false;
  }
  completedStrokes.push(stroke);
  saveCompletedStrokes();
  undoElement.classList.remove('disabled');
  render();
  return true;
}

function onResize() {
  setCanvasSizes();
  render();
}

function isStrokeInShape(stroke: Stroke, shape: Shape): boolean {
  return (
    shape.vertices.includes(stroke[0].id!) &&
    shape.vertices.includes(stroke[1].id!)
  );
}

function undoStroke() {
  if (completedStrokes.length <= 0) {
    undoElement.classList.add('disabled');
    return;
  }
  undoElement.classList.remove('disabled');

  const completedShapes = puzzle.shapes.filter((s) => s.completed);

  // Find the most recently completed stroke that is not part of a completed shape
  for (let i = completedStrokes.length - 1; i >= 0; i--) {
    const stroke = completedStrokes[i];
    // If this stroke is not in any completed shape.
    if (completedShapes.every((shape) => !isStrokeInShape(stroke, shape))) {
      completedStrokes.splice(i, 1);
      break;
    }
  }
  saveCompletedStrokes();
  render();
}

function onKeyup(event: KeyboardEvent) {
  if (event.key === 'Backspace' && completedStrokes.length > 0) {
    undoStroke();
  }
}

function zoom(newScale: number, focusX: number, focusY: number) {
  if (newScale >= 10) {
    newScale = 10;
    zoomElement.children[0].classList.add('disabled');
  } else if (newScale <= 0.4) {
    newScale = 0.4;
    zoomElement.children[1].classList.add('disabled');
  } else {
    zoomElement.children[0].classList.remove('disabled');
    zoomElement.children[1].classList.remove('disabled');
  }
  const x = (focusX - xShift) / scale; // mouse x in puzzle coordinates
  const newX = newScale * x + xShift; // screen x of same puzzle coordinates in new scale
  xShift -= newX - focusX; // difference between new screen x (which cannot exceed min/max of puzzle) and mouse x

  const y = (focusY - yShift) / scale;
  const newY = newScale * y + yShift;
  yShift -= newY - focusY;
  scale = newScale;
  render();
}
let pinchStart: number = scale;
const hammertime = new Hammer(uiCanvas);
hammertime.get('pan').set({ threshold: 3, direction: Hammer.DIRECTION_ALL });

hammertime.on('panstart panend panmove pancancel', (e) => {
  if (e.type === 'panstart') {
    if (mouseDown) {
      onMouseup();
    }
    onMousedown(e.center.x, e.center.y, null);
  } else if (e.type === 'panend' || e.type === 'pancancel') {
    onMouseup();
  } else if (e.type === 'panmove') {
    if (e.srcEvent instanceof MouseEvent) {
      onMousemove(e.srcEvent);
    } else {
      console.log('NO NO NO bad move', e.srcEvent);
    }
  }
});
hammertime.get('pinch').set({ enable: true });
hammertime.on('pinchend pinchcancel', function (event) {
  mouseDown = false;
});

hammertime.on('pinch', function (event) {
  if (!mouseDown) {
    mouseDown = true;
    pinchStart = scale;
  }
  const newScale = pinchStart + (event.scale - 1);

  const focusX = event.center.x * canvasScale;
  const focusY = event.center.y * canvasScale;

  zoom(newScale, focusX, focusY);
});
function onWheel(event: WheelEvent) {
  if (event.deltaY < 0) {
    zoom(scale + 0.2, mouse.x, mouse.y);
  }
  if (event.deltaY > 0) {
    zoom(scale - 0.2, mouse.x, mouse.y);
  }
}

function removeClosestSegment(x: number, y: number) {
  let closestDist = Infinity;
  let closest;
  for (const stroke of completedStrokes) {
    let dist = distToSegment(
      {
        x: (x * canvasScale - xShift) / scale,
        y: (y * canvasScale - yShift) / scale,
      },
      { x: stroke[0].coordinates[0], y: stroke[0].coordinates[1] },
      { x: stroke[1].coordinates[0], y: stroke[1].coordinates[1] }
    );
    if (dist < closestDist) {
      closestDist = dist;
      closest = stroke;
    }
  }
  if (closest && closestDist < 10) {
    let stroke = completedStrokes.indexOf(<Stroke>isStrokeCompleted(closest));
    completedStrokes.splice(stroke, 1);
    render();
  }
}

function onMousedown(x: number, y: number, button: number | null) {
  mouse.x = x * canvasScale;
  mouse.y = y * canvasScale;
  mouseDown = true;
  handleSelection();
}

let hovered: Vertex;
function handleSelection() {
  const x = (mouse.x - xShift) / scale;
  const y = (mouse.y - yShift) / scale;
  let dist = Infinity;
  let closestKey = '';
  for (const key in puzzle.vertices) {
    const vertex = puzzle.vertices[key];
    if (
      (vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2 <
      dist
    ) {
      dist =
        (vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2;
      closestKey = key;
    }
  }
  dist = Math.sqrt(dist);
  const screenDist = dist * scale;
  if (closestKey && screenDist < 3 * getPointSize(closestKey)) {
    if (mouseDown) {
      clicked = puzzle.vertices[closestKey];

      const strokes =
        getStrokesAtPoint(clicked).length -
        getCompletedStrokesAtPoint(clicked).length;

      if (strokes > 0) {
        clicked.selected = 1;
        renderPoints();
      } else {
        clicked = null;
      }
    } else {
      if (hovered && hovered !== puzzle.vertices[closestKey]) {
        hovered.selected = 0;
      }
      hovered = puzzle.vertices[closestKey];
      hovered.selected = 1;
    }
    renderPoints();
  } else if (hovered && hovered.selected !== 0) {
    hovered.selected = 0;
    renderPoints();
  }
  renderCursor();
}

function onMouseup() {
  mouseDown = false;

  if (clicked?.selected && selected?.selected) {
    createStroke(clicked, selected);
  }

  if (clicked) clicked.selected = 0;
  clicked = null;
  if (selected) selected.selected = 0;
  selected = null;
  renderCursor();
  renderPoints();
}
function onMousemove(event: MouseEvent) {
  mouse.x = event.clientX * canvasScale;
  mouse.y = event.clientY * canvasScale;

  if (clicked) {
    handleDrag();
  } else if (mouseDown) {
    xShift += event.movementX * canvasScale;
    yShift += event.movementY * canvasScale;
    render();
  } else {
    handleSelection();
  }

  renderCursor();
}
function handleDrag() {
  if (!clicked) return;
  const x = (mouse.x - xShift) / scale;
  const y = (mouse.y - yShift) / scale;
  let dist = Infinity;
  let closestKey = '';
  for (const key in puzzle.vertices) {
    const vertex = puzzle.vertices[key];
    if (vertex === clicked) continue;
    if (
      (vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2 <
      dist
    ) {
      dist =
        (vertex.coordinates[0] - x) ** 2 + (vertex.coordinates[1] - y) ** 2;
      closestKey = key;
    }
  }
  if (
    closestKey &&
    dist < ((1.5 * getPointSize(closestKey) + 24) / scale) ** 2
  ) {
    if (selected && selected !== puzzle.vertices[closestKey]) {
      selected.selected = 0;
    }
    selected = puzzle.vertices[closestKey];
    selected.selected = 2;
    clicked.selected = 2;
    renderPoints();
  } else if (clicked.selected !== 1 || selected) {
    clicked.selected = 1;
    if (selected) selected.selected = 0;
    renderPoints();
  }
  renderCursor();
}

function render() {
  renderStrokes();
  renderPoints();
  renderShapes();
  renderCursor();
  renderUI();
}
