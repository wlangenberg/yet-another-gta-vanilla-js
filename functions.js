import { Player } from './src/scripts/player/player.js';
import { Platform } from './src/scripts/assets/platform/platform.js';
import { keys, ctx, canvas } from './constants.js';
import Camera from './src/scripts/camera/camera.js';

const gameObjects = []

const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 768;

let ws;

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    ws = new WebSocket(`ws://localhost:8081/ws`);
} else {
    ws = new WebSocket(`wss://${location.hostname}/ws`);
}

ws.onopen = () => {
    console.log('Connected to server');
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

const myplayer = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT - 50, 50, 50, 'white', ctx, true);
fetch('level.json')
    .then(response => response.json())
    .then(levelData => {
        levelData.rectangles.forEach(rect => {
            gameObjects.push(new Platform(rect.x, rect.y, rect.width, rect.height, 'red', ctx, false, ))
        });
        gameObjects.push(myplayer)
    })
    .catch(error => console.error('Error loading level:', error));

const camera = new Camera(myplayer, canvas, { worldHeight: WORLD_HEIGHT, smoothness: 0.02, minZoom: 1, maxZoom: 2, zoom: 1, latency: 0.1 });

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

const tick = (timestamp) => {
    if (timestamp - lastTime >= interval) {
        lastTime = timestamp;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        camera.update(interval);
        const transform = camera.getTransform();
        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.scale, transform.scale);

        for (let i = 0; i < gameObjects.length; i++) {
            gameObjects[i].update(interval, gameObjects)
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

export { myplayer, gameObjects };
