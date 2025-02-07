const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gravity = 0.1;
const keys = [];
let players = [];

const ws = new WebSocket('ws://localhost:8081/ws');

ws.onopen = () => {
    console.log('Connected to server');
}

ws.onmessage = (message) => {
    try {
        const data = JSON.parse(message.data);
        const player = createPlayerFromJson(data);
        let found = false;
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
