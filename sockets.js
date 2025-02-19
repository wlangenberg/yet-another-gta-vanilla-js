
import { STATE, allEntities, canvas, ctx as gl } from './constants.js'
import Player from './player.js'
import toast from './src/scripts/toast.js'


let ws;
let wsUrl = `wss://${location.hostname}/ws`;

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
            if (player.id === STATE.myPlayer.id) {
                return;
            }
            for (let j = 0; j < allEntities.length; j++) {
                if (allEntities[j].id === player.id) {
                    allEntities[j] = player;
                    return
                }
            }
            allEntities.push(player);
        } else if (data.type === 'PlayerDisconnect') {
            for (let j = 0; j < allEntities.length; j++) {
                if (allEntities[j].id === data.id) {
                    allEntities.splice(j, 1);
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
    const player = new Player(canvas, gl, { x: json.x, y: json.y, isLocalPlayer: false});
    player.id = json.id;
    player.name = json.name;
    return player;
}

export const updatePlayerState = (playerData) => {
    if (ws.readyState === 1) {
        const player = {
            ...playerData,
            color: JSON.stringify(playerData.color)
        }
        ws.send(JSON.stringify(player));
    }
}

