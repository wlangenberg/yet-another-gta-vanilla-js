import Player from './src/entities/player/player.js';
import Platform from './src/entities/platforms/platform.js';
import { keys, ctx as gl, allEntities, canvas, STATE } from './src/configuration/constants.js';
import Camera from './src/systems/camera.js';
import SpatialGrid from './src/systems/SpatialGrid.js';
import SunWebGL from './src/entities/sun.js';
import SkyGradient from './src/systems/skyGradient.js';
import DayNightCycle from './src/systems/DayNightCycle.js';
import SnowSystem from './src/systems/SnowSystem.js';
import EntityBatchRenderer from './src/systems/EntityBatchRenderer.js';
import Fragment from './src/entities/fragments/Fragment.js';
import socket from './src/systems/sockets.js'

window.addEventListener('keydown', e => {
		keys[e.code] = true;
});
window.addEventListener('keyup', e => {
		keys[e.code] = false;
});

const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 768;

function hexToWebGLColor(hex, alpha = 1.0) {
		hex = hex.replace('#', '');
		if (hex.length === 3) {
			hex = hex.split('').map(c => c + c).join('');
		}
		const bigint = parseInt(hex, 16);
		const r = ((bigint >> 16) & 255) / 255;
		const g = ((bigint >> 8) & 255) / 255;
		const b = (bigint & 255) / 255;
		return [r, g, b, alpha];
}

function isEntityVisible(entity, camera) {
	// Simple AABB check using the camera's view rectangle
		return (
			entity.x + entity.width >= camera.x &&
			entity.x <= camera.x + camera.viewportWidth &&
			entity.y + entity.height >= camera.y &&
			entity.y <= camera.y + camera.viewportHeight
		);
}

const run = async () => {

		const levelData = await fetch('assets/levels/level.json')
			.then(response => response.json())
			.catch(error => console.error('Error loading level:', error));

		// Initialize static entities (platforms)
		levelData.rectangles.forEach(rect => {
			let color;
			if (rect.color === 'sandybrown') {
				color = [0.96, 0.64, 0.38, 1.0];
			} else if (rect.color === 'green') {
				color = [0.0, 0.5, 0.0, 1.0];
			} else if (rect.color === 'grey') {
				color = [0.5, 0.5, 0.5, 1.0];
			} else {
				color = [1.0, 1.0, 1.0, 1.0];
			}
            const platform = new Platform(rect.x, rect.y, rect.width, rect.height, color, canvas, rect.type)
			allEntities.push(platform);
            // const newWidth = platform.width / 2;
            // const newHeight = platform.height / 2;
            // for (let row = 0; row < 2; row++) {
            //     for (let col = 0; col < 2; col++) {
            //         const fragmentX = platform.x + col * newWidth;
            //         const fragmentY = platform.y + row * newHeight;
            //         const fragment = new Fragment(platform.canvas, platform.gl, {
            //             x: fragmentX,
            //             y: fragmentY,
            //             width: newWidth,
            //             height: newHeight,
            //             color: Array.from(platform.color)
            //         });
            //         fragment.sleep = false
            //         allEntities.push(fragment);
            //     }
            // }
		});
        
        console.log('allEntities', allEntities.length)

		// Initialize the player and camera
		const camera = (() => {
			if (levelData.playerSpawns && levelData.playerSpawns.length > 0) {
				const randomSpawn = levelData.playerSpawns[Math.floor(Math.random() * levelData.playerSpawns.length)];
				STATE.myPlayer = new Player(canvas, gl, { x: randomSpawn.x, y: randomSpawn.y });
				return new Camera(STATE.myPlayer, canvas, {
					worldHeight: WORLD_HEIGHT,
					smoothness: 0.02,
					minZoom: 1,
					maxZoom: 2,
					zoom: 1,
					latency: 0.1,
					x: randomSpawn.x,
					y: randomSpawn.y
				});
			}
		})();

		const bgColor = levelData?.backgroundColor || '#ffffff';
		const [r, g, b, a] = hexToWebGLColor(bgColor);

		canvas.style.backgroundColor = bgColor;
		gl.clearColor(r, g, b, a);

		// Initialize WebGL shared resources for entities.
		allEntities.push(STATE.myPlayer);
		allEntities.forEach(entity => entity.init(gl));
		const sun = new SunWebGL(WORLD_WIDTH / 2, -1200, 350, 350, canvas, gl);

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
		let lastTime = performance.now();
		const fixedTimeStep = 1 / 90;
		let accumulatedTime = 0;

		const fpsCounter = document.createElement('div');
		fpsCounter.style.position = 'absolute';
		fpsCounter.style.top = '10px';
		fpsCounter.style.left = '10px';
		fpsCounter.style.color = 'white';
		fpsCounter.style.fontSize = '2rem';
		fpsCounter.style.fontFamily = 'monospace';
		document.body.appendChild(fpsCounter);

		const fpsUpdateInterval = 500;
		let lastFpsUpdate = performance.now();
		let fpsFrameCount = 0;
		let displayedFPS = 0;
		const snowSystem = new SnowSystem(canvas, gl, WORLD_WIDTH + 5000);
		const snowList = [];

		// Clean up destroyed entities (for example, expired fragments)
		function cleanupEntities() {
			for (let i = allEntities.length - 1; i >= 0; i--) {
				if (allEntities[i].destroyed) {
					allEntities.splice(i, 1);
				}
		}
		}

		// Create a batch renderer for instanced drawing.
		const batchRenderer = new EntityBatchRenderer(gl);
		socket.connectOnline()
		function gameLoop() {
			const currentTime = performance.now();
			let deltaTime = (currentTime - lastTime) / 1000;
			lastTime = currentTime;
	
			fpsFrameCount++;
			if (currentTime - lastFpsUpdate >= fpsUpdateInterval) {
				displayedFPS = fpsFrameCount / ((currentTime - lastFpsUpdate) / 1000);
				fpsCounter.innerText = `FPS: ${Math.round(displayedFPS)}`;
				fpsFrameCount = 0;
				lastFpsUpdate = currentTime;
			}
	
			accumulatedTime += deltaTime;
			requestAnimationFrame(gameLoop);
	
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			camera.update();
	
			const viewProjectionMatrix = camera.getViewMatrix();
	
			// Fixed update loop: update collisions and physics.
			while (accumulatedTime >= fixedTimeStep) {
				spatialGrid.clear();
				cleanupEntities();
				allEntities.forEach(obj => spatialGrid.insert(obj));
				snowList.forEach(snow => {
					if (snow.update) {
						snow.update(fixedTimeStep, allEntities, spatialGrid, camera);
					}
				});
	
				for (let i = 0; i < allEntities.length; i++) {
					const entity = allEntities[i];
					if (entity.update) {
						entity.update(fixedTimeStep, allEntities, spatialGrid, camera);
					} 
					if ((entity?.sleeping === false) || (entity.name && entity.isLocalPlayer)) {
						socket.updatePlayerState(entity);
					}
				}
				dayNightCycle.update(lastTime);
				snowSystem.update(fixedTimeStep, snowList, spatialGrid);
				accumulatedTime -= fixedTimeStep;
			}
	
			// Render sky gradient
			gl.disable(gl.DEPTH_TEST);
			skyGradient.update();
			skyGradient.draw();
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
	
			// --- RENDERING PASSES WITH LAYERING ---
			// 1. Render background entities first (type "background")
			batchRenderer.begin();
			for (let i = 0; i < allEntities.length; i++) {
				const entity = allEntities[i];
				if (entity.render && entity.type === 'background' && isEntityVisible(entity, camera)) {
					batchRenderer.submit(entity);
				}
			}
			batchRenderer.flush(viewProjectionMatrix);
	
			// 2. Render non-background entities (excluding SunWebGL)
			batchRenderer.begin();
			for (let i = 0; i < allEntities.length; i++) {
				const entity = allEntities[i];
				if (
					entity.render &&
					entity.type !== 'background' &&
					!(entity instanceof SunWebGL) &&
					isEntityVisible(entity, camera)
				) {
					batchRenderer.submit(entity);
				}
			}
			batchRenderer.flush(viewProjectionMatrix);
	
			// 3. Render snow entities
			batchRenderer.begin();
			for (let i = 0; i < snowList.length; i++) {
				const entity = snowList[i];
				if (entity.render && isEntityVisible(entity, camera)) {
					batchRenderer.submit(entity);
				}
			}
			batchRenderer.flush(viewProjectionMatrix);
	
			// 4. Finally, render the sun.
			sun.render(fixedTimeStep, allEntities, spatialGrid, camera);
		}
		gameLoop();
};

run();
