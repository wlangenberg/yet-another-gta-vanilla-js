import { Player } from './src/scripts/player/player.js';
import { Platform } from './src/scripts/assets/platform/platform.js';
import { keys, ctx, canvas } from './constants.js';

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
        const player = createPlayerFromJson(data);
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
    ws.send(JSON.stringify(playerData));
}

const myplayer = new Player(20, 20, 50, 50, 'white');
const platform = new Platform(0, canvas.height - 100, canvas.width, 100, 'blue');
myplayer.draw();
platform.draw();

const fps = 144;
const interval = 1000 / fps;
let lastTime = 0;

const tick = (timestamp) => {
    if (timestamp - lastTime >= interval) {
        lastTime = timestamp;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        myplayer.animate(interval);
        myplayer.move(interval);
        platform.draw();

        for (let i = 0; i < players.length; i++) {
            players[i].draw();
        }
        if (myplayer.speed > 0) {
            updatePlayerState(myplayer);
        }
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

export { myplayer };
