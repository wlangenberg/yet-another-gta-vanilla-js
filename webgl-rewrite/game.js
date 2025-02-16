import Player from './player.js';
import Platform from './platform.js';
import { keys, ctx as gl, allEntities, canvas } from './constants.js';
import Camera from './camera.js';
import SpatialGrid from './SpatialGrid.js';
import SunWebGL from './sun.js';
import SkyGradient from './skyGradient.js';
import DayNightCycle  from './DayNightCycle.js';

window.addEventListener('keydown', e => {
    keys[e.code] = true
})
window.addEventListener('keyup', e => {
    keys[e.code] = false
})

const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 768;


let myplayer
function hexToWebGLColor(hex, alpha = 1.0) {
    hex = hex.replace('#', '')
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('') // Convert shorthand hex to full
    }
    const bigint = parseInt(hex, 16)
    const r = ((bigint >> 16) & 255) / 255
    const g = ((bigint >> 8) & 255) / 255
    const b = (bigint & 255) / 255
    return [r, g, b, alpha]
}

const run = async () => {
  const levelData = await fetch('level.json')
    .then(response => response.json())
    .catch(error => console.error('Error loading level:', error));

  levelData.rectangles.forEach(rect => {
    const gravity = rect.y < -1220 ? true : false;
    let color;
    if (rect.color === 'sandybrown') {
      color = [0.96, 0.64, 0.38, 1.0]; // RGBA for Sandybrown (#F4A460)
    } else if (rect.color === 'green') {
      color = [0.0, 0.5, 0.0, 1.0]; // RGBA for Green (#008000)
    } else if (rect.color === 'grey') {
      color = [0.5, 0.5, 0.5, 1.0]; // RGBA for Grey (#808080)
    } else {
      color = [1.0, 1.0, 1.0, 1.0]; // Default to white if no match
    }

    allEntities.push(new Platform(rect.x, rect.y, rect.width, rect.height, color));
  });

  const camera = (() => {
    if (levelData.playerSpawns && levelData.playerSpawns.length > 0) {
      const randomSpawn = levelData.playerSpawns[Math.floor(Math.random() * levelData.playerSpawns.length)];

      myplayer = new Player(canvas, gl, { x: randomSpawn.x, y: randomSpawn.y });
      return new Camera(myplayer, canvas, { worldHeight: WORLD_HEIGHT, smoothness: 0.02, minZoom: 1, maxZoom: 2, zoom: 1, latency: 0.1, x: randomSpawn.x, y: randomSpawn.y });
    }
  })();

  const bgColor = levelData?.backgroundColor || '#ffffff';
  const [r, g, b, a] = hexToWebGLColor(bgColor);

  canvas.style.backgroundColor = bgColor; // CSS
  gl.clearColor(r, g, b, a); // WebGL

  allEntities.forEach(platform => platform.init(gl));
  allEntities.push(myplayer);
  const sun = new SunWebGL(WORLD_WIDTH / 2, -1200, 350, 350, canvas, gl);
//   allEntities.push(sun);

  const skyGradient = new SkyGradient(gl, sun);
  const dayNightCycle = new DayNightCycle(sun, skyGradient);

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const spatialGrid = new SpatialGrid(100);
  let lastTime = performance.now()
  const fixedTimeStep = 1 / 90  // 60 updates per second
  let accumulatedTime = 0
  
  // Create and style the FPS counter element
  const fpsCounter = document.createElement('div')
  fpsCounter.style.position = 'absolute'
  fpsCounter.style.top = '10px'
  fpsCounter.style.left = '10px'
  fpsCounter.style.color = 'white'
  fpsCounter.style.fontSize = '2rem'
  fpsCounter.style.fontFamily = 'monospace'
  document.body.appendChild(fpsCounter)
  
// Variables for FPS smoothing over a 500ms interval
const fpsUpdateInterval = 500  // in milliseconds
let lastFpsUpdate = performance.now()
let fpsFrameCount = 0
let displayedFPS = 0

function gameLoop() {
    const currentTime = performance.now()
    let deltaTime = (currentTime - lastTime) / 1000
    lastTime = currentTime

    // Increment frame count for FPS smoothing
    fpsFrameCount++
    if (currentTime - lastFpsUpdate >= fpsUpdateInterval) {
        displayedFPS = fpsFrameCount / ((currentTime - lastFpsUpdate) / 1000)
        fpsCounter.innerText = `FPS: ${Math.round(displayedFPS)}`
        fpsFrameCount = 0
        lastFpsUpdate = currentTime
    }

    accumulatedTime += deltaTime

    requestAnimationFrame(gameLoop)

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // Update the camera
    camera.update()

    // Get the combined view-projection matrix from the camera
    const viewProjectionMatrix = camera.getViewMatrix()

    // Update entities and day-night cycle
    while (accumulatedTime >= fixedTimeStep) {
        spatialGrid.clear()
        allEntities.forEach(obj => spatialGrid.insert(obj))
        allEntities.forEach(entity => {
            if (entity.update) {
                entity.update(fixedTimeStep, allEntities, spatialGrid, camera)
            }
        })
        dayNightCycle.update(lastTime)  // Update the day-night cycle
        accumulatedTime -= fixedTimeStep
    }

    // Render all entities except the sun
    for (let i = 0; i < allEntities.length; i++) {
        const entity = allEntities[i]
        if (entity.render && !(entity instanceof SunWebGL)) {
            entity.render(viewProjectionMatrix)
        }
    }

    // Render the sun and shadows last
    skyGradient.update()
    skyGradient.draw()
    sun.render(fixedTimeStep, allEntities, spatialGrid, camera)
}

gameLoop()
  
}

run();