import { Player } from './src/scripts/player/player.js';
import { SpatialGrid  } from './src/scripts/game-object.js'
import { Sun  } from './src/scripts/sun.js'
import { Platform } from './src/scripts/assets/platform/platform.js';
import { keys, ctx, canvas } from './constants.js';
import Camera from './src/scripts/camera/camera.js';
import toast from './src/scripts/toast.js'

const gameObjects = []

const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 768;

let ws;
let myplayer;
let wsUrl = `wss://${location.hostname}/ws`;

const run = async () => {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        wsUrl = `ws://localhost:8081/ws`;
    }
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('Connected to server');
    }
    
    // Implement ws reconnect
    ws.onclose = (_) => {
        console.log('Connection closed, retrying after 5 seconds');
        setTimeout(() => {
            ws = new WebSocket(wsUrl);
        }, 5000);
    }
    
    ws.onerror = (error) => {
        console.error('Error:', error);
    }
    
    ws.onmessage = (message) => {
        try {
            const data = JSON.parse(message.data);
            if (data.type === 'PlayerUpdate') {
                const player = createPlayerFromJson(data?.player);
                if (player.id === myplayer.id) {
                    return;
                }
                for (let j = 0; j < gameObjects.length; j++) {
                    if (gameObjects[j].id === player.id) {
                        gameObjects[j] = player;
                        return
                    }
                }
                gameObjects.push(player);
            } else if (data.type === 'PlayerDisconnect') {
                for (let j = 0; j < gameObjects.length; j++) {
                    if (gameObjects[j].id === data.id) {
                        gameObjects.splice(j, 1);
                        return;
                    }
                }
            } else if (data.type === 'PlayerConnect') {
                toast.show('New player connected!');
            } else {
                console.debug(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            console.error(error);
        }
    }
    
    function createPlayerFromJson(json) {
        const player = new Player(json.x, json.y, json.width, json.height, json.color, ctx, true);
        player.id = json.id;
        player.name = json.name;
        player.jumpForce = json.jumpForce;
        return player;
    }
    
    let updatePlayerState = (playerData) => {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify(playerData));
        }
    }
    
    const levelData = await fetch('level.json')
        .then(response => response.json())
        .catch(error => console.error('Error loading level:', error));
    levelData.rectangles.forEach(rect => {
        const gravity = rect.y < -1220 ? true : false
        gameObjects.push(new Platform(rect.x, rect.y, rect.width, rect.height, rect.color, ctx, gravity, ))
    });
    const camera = (() => {
        if (levelData.playerSpawns && levelData.playerSpawns.length > 0) {
            const randomSpawn = levelData.playerSpawns[Math.floor(Math.random() * levelData.playerSpawns.length)];
            myplayer = new Player(randomSpawn.x, randomSpawn.y, 50, 50, 'white', ctx, true);
            return new Camera(myplayer, canvas, { worldHeight: WORLD_HEIGHT, smoothness: 0.02, minZoom: 1, maxZoom: 2, zoom: 1, latency: 0.1, x: randomSpawn.x, y: randomSpawn.y, });
        } else {
            myplayer = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT - 50, 50, 50, 'white', ctx, true);
            return new Camera(myplayer, canvas, { worldHeight: WORLD_HEIGHT, smoothness: 0.02, minZoom: 1, maxZoom: 2, zoom: 1, latency: 0.1 });
        }
    })()
    canvas.style.backgroundColor = levelData?.backgroundColor || '#ffffff';
    gameObjects.push(myplayer)
    gameObjects.push(new Sun(WORLD_WIDTH / 2, -1200, 50, 50, ctx));
    
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        camera.setZoom(1)
    }
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas()
    
    const fps = 144;
    const interval = 1000 / fps;
    let lastTime = 0;
    
    const spatialGrid = new SpatialGrid(100)
    const tick = (timestamp) => {
        if (timestamp - lastTime >= interval) {
            lastTime = timestamp;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
    
            camera.update(interval);
            const transform = camera.getTransform();
            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.scale(transform.scale, transform.scale);
            spatialGrid.clear();
            gameObjects.forEach(obj => spatialGrid.insert(obj));
            
            for (let i = 0; i < gameObjects.length; i++) {
                gameObjects[i].update(interval, gameObjects, spatialGrid)
            }
    
            updatePlayerState(myplayer);
            ctx.restore();
        }
    
        requestAnimationFrame(tick);
    };
    
    tick(0);
    
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.code] = false;
    });
}
run()

export { myplayer, gameObjects };
