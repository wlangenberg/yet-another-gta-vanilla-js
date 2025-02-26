import Player from './src/entities/player/player.js';
import Platform from './src/entities/platforms/platform.js';
import { keys, allEntities, STATE, LAYERS } from './src/configuration/constants.js';
import { canvas, ctx as gl, } from './src/configuration/canvas.js';
import Camera from './src/systems/camera.js';
import SpatialGrid from './src/systems/SpatialGrid.js';
import SunWebGL from './src/entities/sun.js';
import SkyGradient from './src/systems/skyGradient.js';
import DayNightCycle from './src/systems/DayNightCycle.js';
import SnowSystem from './src/systems/SnowSystem.js';
import EntityBatchRenderer from './src/systems/EntityBatchRenderer.js';
import Fragment from './src/entities/fragments/Fragment.js';
import socket from './src/systems/sockets.js';
import Gun from './src/entities/player/Gun.js';
import GameMode, { GAME_MODES } from './src/systems/GameMode.js';
import uiManager from './src/systems/UIManager.js';
import chatUI from './src/systems/ChatUI.js';

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

// Create game mode selector UI
function createGameModeSelector() {
    const container = document.createElement('div');
    container.id = 'game-mode-selector';
    container.style.position = 'absolute';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    container.style.padding = '20px';
    container.style.borderRadius = '10px';
    container.style.color = 'white';
    container.style.fontFamily = 'monospace';
    container.style.textAlign = 'center';
    container.style.zIndex = '1000';
    
    const title = document.createElement('h2');
    title.textContent = 'Select Game Mode';
    container.appendChild(title);
    
    const modeList = document.createElement('div');
    modeList.style.display = 'flex';
    modeList.style.flexDirection = 'column';
    modeList.style.gap = '10px';
    modeList.style.marginTop = '20px';
    
    // Free Play mode button
    const freePlayBtn = document.createElement('button');
    freePlayBtn.textContent = 'Free Play';
    freePlayBtn.style.padding = '10px 20px';
    freePlayBtn.style.fontSize = '16px';
    freePlayBtn.style.cursor = 'pointer';
    freePlayBtn.style.backgroundColor = '#3498db';
    freePlayBtn.style.border = 'none';
    freePlayBtn.style.borderRadius = '5px';
    freePlayBtn.style.color = 'white';
    freePlayBtn.onclick = () => {
        startGame(GAME_MODES.FREE_PLAY);
        container.remove();
    };
    modeList.appendChild(freePlayBtn);
    
    // Death Match mode button
    const deathMatchBtn = document.createElement('button');
    deathMatchBtn.textContent = 'Death Match';
    deathMatchBtn.style.padding = '10px 20px';
    deathMatchBtn.style.fontSize = '16px';
    deathMatchBtn.style.cursor = 'pointer';
    deathMatchBtn.style.backgroundColor = '#e74c3c';
    deathMatchBtn.style.border = 'none';
    deathMatchBtn.style.borderRadius = '5px';
    deathMatchBtn.style.color = 'white';
    deathMatchBtn.onclick = () => {
        startGame(GAME_MODES.DEATH_MATCH);
        container.remove();
    };
    modeList.appendChild(deathMatchBtn);
    
    container.appendChild(modeList);
    document.body.appendChild(container);
}

const run = async () => {
    // Show game mode selector
    createGameModeSelector();
}

const startGame = async (gameMode) => {
    // Initialize the game mode
    window.gameMode = new GameMode(gameMode);
    window.gameMode.start();
    
    // Show game mode message
    uiManager.showGameModeMessage(`Game Mode: ${gameMode}`, 3000);
    
    // Initialize chat UI
    chatUI.initialize();

    const levelData = await fetch('assets/levels/level.json')
        .then(response => response.json())
        .catch(error => console.error('Error loading level:', error));

		// Initialize static entities (platforms)
		levelData.rectangles.forEach(rect => {
            const platform = new Platform(rect.x, rect.y, rect.width, rect.height, hexToWebGLColor(rect.color), canvas, rect.type, rect.layer)
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
            
            // Add player to game mode
            window.gameMode.addPlayer(STATE.myPlayer);
            
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
		window.camera = camera
		const bgColor = levelData?.backgroundColor || '#ffffff';
		const [r, g, b, a] = hexToWebGLColor(bgColor);

		canvas.style.backgroundColor = bgColor;
		gl.clearColor(r, g, b, a);

		console.log('allEntities', allEntities.length)

		// Initialize guns with predefined spawn locations
		const gunSpawnLocations = [
			{ x: STATE.myPlayer.x -100, y: STATE.myPlayer.y },
			// { x: 300, y: 400 },
			// Add more spawn locations as needed
		];

		gunSpawnLocations.forEach(async location => {

			const gun = new Gun(canvas, gl, location);
			await gun.animationsPromise
			allEntities.push(gun);
		});
		// Initialize WebGL shared resources for entities.
		allEntities.push(STATE.myPlayer);
		allEntities.forEach(entity => entity.init(gl));
		const sun = new SunWebGL(WORLD_WIDTH / 2, -1200, 350, 350, canvas, gl);

		const skyGradient = new SkyGradient(gl, sun);
		const dayNightCycle = new DayNightCycle(sun, skyGradient);
		
		// Add game instructions
		const instructions = document.createElement('div');
		instructions.style.position = 'absolute';
		instructions.style.top = '70px';
		instructions.style.left = '10px';
		instructions.style.color = 'white';
		instructions.style.fontFamily = 'monospace';
		instructions.style.fontSize = '14px';
		instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
		instructions.style.padding = '10px';
		instructions.style.borderRadius = '5px';
		instructions.innerHTML = `
			<h3>Controls:</h3>
			<p>WASD / Arrow Keys - Move</p>
			<p>Left Click - Shoot</p>
			<p>Right Click - Pick up/throw weapon</p>
			<p>T - Toggle chat</p>
		`;
		document.body.appendChild(instructions);

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
        
        // Update game mode
        if (window.gameMode) {
            window.gameMode.update();
            
            // Update UI
            if (window.gameMode.type === GAME_MODES.DEATH_MATCH) {
                uiManager.updateScoreboard(window.gameMode.getScoreboard());
                uiManager.updateTimer(window.gameMode.getTimeRemaining());
            }
        }
	
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
	
				// Update all entities
				for (let i = 0; i < allEntities.length; i++) {
					const entity = allEntities[i];
					if (entity.update) {
						entity.update(fixedTimeStep, allEntities, spatialGrid, camera);
					}
					
					// Only send updates for the local player
					if (entity.isLocalPlayer) {
						socket.updatePlayerState(entity);
					}
				}
				dayNightCycle.update(lastTime);
				// snowSystem.update(fixedTimeStep, snowList, spatialGrid);
				accumulatedTime -= fixedTimeStep;
			}
	
			// Render sky gradient
			gl.disable(gl.DEPTH_TEST);
			skyGradient.update();
			skyGradient.draw();
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);

			for (let currentLayer = LAYERS.BACKGROUND; currentLayer <= LAYERS.FOREGROUND; currentLayer++) {
				batchRenderer.begin();
				if (sun.renderLayer === currentLayer) batchRenderer.submit(sun);

				// Filter entities by current layer
				for (let i = 0; i < allEntities.length; i++) {
					const entity = allEntities[i];
					if (
						entity.renderLayer === currentLayer && 
						isEntityVisible(entity, camera)
					) {
						batchRenderer.submit(entity);
					}
				}
				
				batchRenderer.flush(viewProjectionMatrix);
			}
	
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
