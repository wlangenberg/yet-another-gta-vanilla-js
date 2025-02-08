import { Player } from './src/scripts/player/player.js';
import { Platform } from './src/scripts/assets/platform/platform.js';
import { keys, ctx, canvas } from './constants.js';
import Camera from './src/scripts/camera.js';

const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 768;

let players = [];
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
            for (let j = 0; j < players.length; j++) {
                if (players[j].id === player.id) {
                    players[j] = player;
                    return
                }
            }
            players.push(player);
        } else if (data.type === 'PlayerDisconnect') {
            for (let j = 0; j < players.length; j++) {
                if (players[j].id === data.id) {
                    players.splice(j, 1);
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
    const player = new Player(json.x, json.y, json.width, json.height, json.color);
    player.id = json.id;
    player.name = json.name;
    player.dy = json.dy;
    player.jumpForce = json.jumpForce;
    player.maxSpeed = json.maxSpeed;
    player.friction = json.friction;
    player.speed = json.speed;
    player.direction = json.direction;
    player.acceleration = json.acceleration;
    player.originalHeight = json.originalHeight;
    player.grounded = json.grounded;
    player.jumpTimer = json.jumpTimer;
    return player;
}

let updatePlayerState = (playerData) => {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(playerData));
    }
}

const myplayer = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT - 50, 50, 50, 'white');
const platforms = [
    new Platform(0, WORLD_HEIGHT - 100, WORLD_WIDTH, 100, 'blue'), // Ground platform
    new Platform(200, 500, 200, 50, 'red'),
    new Platform(500, 600, 150, 20, 'red'),
    new Platform(100, 400, 150, 20, 'red'),
    new Platform(-200, 300, 350, 20, 'red'),
    new Platform(-300, 200, 350, 20, 'red'),
    new Platform(800, 400, 100, 20, 'yellow')
];

const camera = new Camera(myplayer, canvas, { worldHeight: WORLD_HEIGHT, smoothness: 0.1, minZoom: 1, maxZoom: 2, zoom: 1, latency: 0.1 });

myplayer.draw();

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

        myplayer.animate(interval, platforms);
        myplayer.move(interval);
        platforms.forEach(platform => platform.draw());

        for (let i = 0; i < players.length; i++) {
            players[i].draw();
        }

        if (myplayer.speed > 0) {
            updatePlayerState(myplayer);
        }

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

export { myplayer, platforms };
