
import { STATE, allEntities, canvas, ctx as gl } from './constants.js'
import Player from './player.js'
import toast from './src/scripts/toast.js'
import Platform from './platform.js'

class Socket {
    ws
    
    connectOnline() {
        const wsUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') 
            ? `ws://localhost:8081/ws` 
            : `wss://${location.hostname}/ws`
        
        
        this.ws = new WebSocket(wsUrl);
        console.log('SSS', this.ws)
        this.ws.onopen = () => {
            console.log('Connected to server');
        }
        
        // Implement ws reconnect
        this.ws.onclose = (_) => {
            console.log('Connection closed, retrying after 5 seconds');
            setTimeout(() => {
                ws = new WebSocket(wsUrl);
            }, 5000);
        }
        
        this.ws.onerror = (error) => {
            console.error('Error:', error);
        }
        
        this.ws.onmessage = (message) => {
            try {
                const data = JSON.parse(message.data);
                if (data.type === 'PlayerUpdate') {
                    // LAGGY AF
                    // if (!data?.player?.name) {
                    //     for (let j = 0; j < allEntities.length; j++) {
                    //         const entity = data?.player ?? {}
                    //         if (allEntities[j].id === entity.id) {
                    //             allEntities[j].x = entity.x
                    //             allEntities[j].y = entity.y
                    //             return
                    //         }
                    //     }   
                    //     return
                    // }
                    const player = this.createPlayerFromJson(data?.player);
                    if (player.id === STATE.myPlayer.id) {
                        return;
                    }
                    for (let j = 0; j < allEntities.length; j++) {
                        if (allEntities[j].id === player.id) {
                            allEntities[j] = player;
                            return
                        }
                    }
                    if (player instanceof Player) {
                        allEntities.push(player);

                    }
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
    }

    updatePlayerState = (playerData) => {
        if (this.ws.readyState === 1) {
            const player = {
                ...playerData,
                color: JSON.stringify(playerData.color)
            }
            this.ws.send(JSON.stringify(player));
        }
    }

    createPlayerFromJson(json) {
        // console.log(json)
        if (json.name) {

            const player = new Player(canvas, gl, { x: json.x, y: json.y, isLocalPlayer: false});
            player.id = json.id;
            return player;
        } else {
            // console.log(json.color)
            const coloj = JSON.parse(json.color)
            const color = [coloj[0], coloj[1], coloj[2], coloj[3]]
            const player = new Platform(json.x, json.y, json.width, json.height, color);
            player.id = json.id;
            // player.name = json.name;
            return player;
        }
    }
}

const socket = new Socket()
export default socket