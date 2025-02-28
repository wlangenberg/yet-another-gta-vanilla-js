import { STATE, allEntities, LAYERS } from '../configuration/constants.js';
import { canvas, ctx as gl } from '../configuration/canvas.js';
import Player from '../entities/player/player.js';
import toast from './toast.js';
import Platform from '../entities/platforms/platform.js';
import BinaryProtocol from './BinaryProtocol.js';
import Gun from '../entities/player/Gun.js';
import Bullet from '../entities/player/Bullet.js';
import Fragment from '../entities/fragments/Fragment.js';

// Chat message container
const chatMessages = [];
const MAX_CHAT_MESSAGES = 10;

class Socket {
    ws = null;
    binaryMode = true; // Use binary protocol by default
    
    // Track remote players by ID to prevent duplicates
    remotePlayers = new Map();
    
    connectOnline() {
        const wsUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
            ? `ws://127.0.0.1:8081/ws`
            : `wss://${location.hostname}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            toast.show('Connected to server');
            
            // Send initial player ID to server if we have a local player
            if (STATE.myPlayer) {
                console.log('Sending initial player ID to server:', STATE.myPlayer.id);
                this.sendInitialPlayerID(STATE.myPlayer.id);
            }
        };
        
        // Implement ws reconnect
        this.ws.onclose = () => {
            console.log('Connection closed, retrying after 5 seconds');
            toast.show('Connection closed, retrying...');
            setTimeout(() => {
                this.connectOnline();
            }, 5000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            toast.show('Connection error');
        };
        
        this.ws.onmessage = async (message) => {
            try {
                // Check if the message is a Blob (binary data)
                if (this.binaryMode && (message.data instanceof ArrayBuffer || message.data instanceof Blob)) {
                    // Convert Blob to ArrayBuffer if needed
                    let arrayBuffer;
                    if (message.data instanceof Blob) {
                        arrayBuffer = await message.data.arrayBuffer();
                    } else {
                        arrayBuffer = message.data;
                    }
                    
                    // Decode the binary message
                    const data = BinaryProtocol.decodeMessage(arrayBuffer);
                    if (data) {
                        await this.handleBinaryMessage(data);
                        return;
                    }
                }
                // If not binary or binary decoding failed, try JSON
                // Make sure we have a string for JSON parsing
                let jsonData;
                if (typeof message.data === 'string') {
                    jsonData = message.data;
                } else if (message.data instanceof Blob) {
                    jsonData = await message.data.text();
                } else {
                    console.error('Unsupported message format');
                    return;
                }
                
                try {
                    const data = JSON.parse(jsonData);
                    await this.handleJSONMessage(data);
                } catch (e) {
                    console.error('Error parsing JSON message:', e);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };
    }
    
    // Handle binary protocol messages
    async handleBinaryMessage(data) {
        // console.log(`Received binary message of type: ${data.type}`, data);
        
        switch (data.type) {
            case 'PlayerUpdate':
                await this.handlePlayerUpdate(data.player);
                break;
                
            case 'PlayerDisconnect':
                this.handlePlayerDisconnect(data.id);
                break;
                
            case 'PlayerJoin':
                toast.show('New player connected!');
                break;
                
            case 'InitialState':
                await this.handleInitialState(data.players);
                break;
                
            case 'ChatMessage':
                this.handleChatMessage(data.playerId, data.message);
                break;
                
            case 'GunFire':
                this.handleGunFire(data.playerId, data.x, data.y, data.angle, data.damage);
                break;
                
            case 'HitReport':
                this.handleHitReport(data.shooterId, data.targetId, data.damage);
                break;
                
            case 'PlatformDestroy':
                this.handlePlatformDestroy(data.platformId, data.shooterId);
                break;
                
            case 'FragmentCreate':
                this.handleFragmentCreate(data.fragment);
                break;
                
            case 'FragmentDestroy':
                this.handleFragmentDestroy(data.fragmentId);
                break;
                
            case 'GunAttachment':
                this.handleGunAttachment(data.data);
                break;
                
            default:
                console.debug(`Unknown binary message type: ${data.type}`);
        }
    }
    
    // Handle platform destruction
    handlePlatformDestroy(platformId, shooterId) {
        // Find the platform
        let platformIndex = -1;
        let platform = null;
        
        for (let i = 0; i < allEntities.length; i++) {
            if (allEntities[i].id === platformId) {
                platformIndex = i;
                platform = allEntities[i];
                break;
            }
        }
        
        if (platformIndex === -1 || !platform) {
            console.warn(`Platform with ID ${platformId} not found for destruction`);
            return;
        }
        
        // Remove the platform from entities
        allEntities.splice(platformIndex, 1);
        
        // Find the shooter (if any)
        let shooter = null;
        if (shooterId) {
            for (const entity of allEntities) {
                if (entity.id === shooterId) {
                    shooter = entity;
                    break;
                }
            }
        }
        
        console.log(`Platform ${platformId} destroyed by ${shooter ? shooter.name : 'unknown'}`);
    }
    
    // Handle fragment creation
    handleFragmentCreate(fragmentData) {
        // Create a new fragment with options
        const fragmentOptions = {
            id: fragmentData.id,
            x: fragmentData.x,
            y: fragmentData.y,
            width: fragmentData.width,
            height: fragmentData.height,
            color: [fragmentData.colorR, fragmentData.colorG, fragmentData.colorB, fragmentData.colorA],
            type: 'fragment',
            layer: 1
        };
        
        const fragment = new Fragment(fragmentOptions);
        
        // Set additional fragment properties
        fragment.originalEntityId = fragmentData.originalEntityId;
        fragment.velocity.x = fragmentData.velocityX;
        fragment.velocity.y = fragmentData.velocityY;
        fragment.hasGravity = true;
        
        // Add fragment to entities
        allEntities.push(fragment);
        
        console.log(`Fragment ${fragment.id} created from entity ${fragment.originalEntityId}`);
    }
    
    // Handle fragment destruction
    handleFragmentDestroy(fragmentId) {
        if (!fragmentId) return;
        
        // Find the fragment
        let fragmentIndex = -1;
        
        for (let i = 0; i < allEntities.length; i++) {
            if (allEntities[i].id === fragmentId && allEntities[i].isFragment) {
                fragmentIndex = i;
                break;
            }
        }
        
        if (fragmentIndex === -1) {
            console.warn(`Fragment with ID ${fragmentId} not found for destruction`);
            return;
        }
        
        // Remove the fragment from entities
        allEntities.splice(fragmentIndex, 1);
        
        console.log(`Fragment ${fragmentId} destroyed`);
    }
    
    // Handle JSON messages (for backward compatibility)
    async handleJSONMessage(data) {
        console.log('JSON')
        if (data.type === 'PlayerUpdate') {
            await this.handlePlayerUpdate(data.player);
        } else if (data.type === 'PlayerDisconnect') {
            this.handlePlayerDisconnect(data.id);
        } else if (data.type === 'PlayerConnect') {
            toast.show('New player connected!');
        } else if (data.type === 'GunAttachment') {
            this.handleGunAttachment(data.data);
        } else if (data.type === 'FragmentDestroy') {
            this.handleFragmentDestroy(data.fragmentId);
        } else if (data.type === 'InitialState') {
            await this.handleInitialState(data.players);
        } else {
            console.debug(`Unknown JSON message type: ${data.type}`);
        }
    }
    
    // Handle gun attachment
    handleGunAttachment(data) {
        if (!data || !data.gunId || !data.playerId) return;
        
        // Find the gun and player
        let gun = null;
        let player = null;
        
        for (const entity of allEntities) {
            if (entity.id === data.gunId && entity instanceof Gun) {
                gun = entity;
            } else if (entity.id === data.playerId && entity instanceof Player) {
                player = entity;
            }
            
            // Break early if we found both
            if (gun && player) break;
        }
        
        // If we couldn't find the gun, create a new one
        if (!gun && player) {
            const gunOptions = {
                id: data.gunId,
                x: player.x,
                y: player.y,
                canvas: canvas,
                gl: gl,
                rotation: data.rotation || 0
            };
            
            gun = new Gun(gunOptions);
            gun.init(gl);
            allEntities.push(gun);
            console.log(`Created new gun ${gun.id} for player ${player.id}`);
        }
        
        // If we found both gun and player, attach the gun to the player
        if (gun && player) {
            gun.attachedTo = player;
            gun.attachmentOffset = {
                x: data.attachmentOffsetX || 30,
                y: data.attachmentOffsetY || -20
            };
            gun.hasGravity = false;
            gun.hasCollision = false;
            gun.sleeping = true;
            gun.setRenderLayer(2);
            
            // Set rotation if provided
            if (data.rotation !== undefined) {
                gun.rotation = data.rotation;
            }
            
            console.log(`Gun ${gun.id} attached to player ${player.id}`);
        } else {
            console.warn(`Could not find player ${data.playerId} for gun attachment`);
        }
    }
    
    // Send gun attachment update
    sendGunAttachment(gunId, playerId, offsetX, offsetY, rotation) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeGunAttachment(gunId, playerId, offsetX, offsetY, rotation);
            this.ws.send(buffer);
        } else {
            // Fall back to JSON
            this.ws.send(JSON.stringify({
                type: 'GunAttachment',
                data: {
                    gunId: gunId,
                    playerId: playerId,
                    attachmentOffsetX: offsetX,
                    attachmentOffsetY: offsetY,
                    rotation: rotation
                }
            }));
        }
    }
    
    // Interpolation settings
    interpolationDelay = 100; // ms
    
    // Handle player update
    async handlePlayerUpdate(playerData) {
        if (!playerData || !playerData.id) {
            console.warn("Received player update with no ID");
            return;
        }
        
        // Handle updates for our own player (health updates, etc.)
        if (STATE.myPlayer && playerData.id === STATE.myPlayer.id) {
            console.log(`Updating local player: ${JSON.stringify(playerData)}`);
            
            // Update health properties
            if (playerData.health !== undefined) {
                STATE.myPlayer.health = playerData.health;
            }
            if (playerData.maxHealth !== undefined) {
                STATE.myPlayer.maxHealth = playerData.maxHealth;
            }
            if (playerData.isDead !== undefined) {
                STATE.myPlayer.isDead = playerData.isDead;
            }
            
            return;
        }
        
        // Check if player already exists in our tracking map
        const existingPlayer = this.remotePlayers.get(playerData.id);
        const existsInAllEntities = allEntities.find((e) => e.id === playerData.id)
        if (existingPlayer || existsInAllEntities) {
            // Update existing player instead of creating a new one
            
            // Store current position as previous position for interpolation
            existingPlayer.prevX = existingPlayer.x;
            existingPlayer.prevY = existingPlayer.y;
            
            // Store target position for interpolation
            existingPlayer.targetX = playerData.x;
            existingPlayer.targetY = playerData.y;
            
            // Set interpolation start time
            existingPlayer.interpolationStartTime = performance.now();
            
            // Update health properties
            if (playerData.health !== undefined) {
                existingPlayer.health = playerData.health;
            }
            if (playerData.maxHealth !== undefined) {
                existingPlayer.maxHealth = playerData.maxHealth;
            }
            if (playerData.isDead !== undefined) {
                existingPlayer.isDead = playerData.isDead;
            }
            
            // Update velocity for prediction
            if (playerData.velocityX !== undefined) {
                existingPlayer.velocity.x = playerData.velocityX;
            }
            if (playerData.velocityY !== undefined) {
                existingPlayer.velocity.y = playerData.velocityY;
            }
            
            // Update width and height if provided
            if (playerData.width) existingPlayer.width = playerData.width;
            if (playerData.height) existingPlayer.height = playerData.height;
            
            // Update direction and face direction if provided
            if (playerData.direction !== undefined) {
                existingPlayer.direction = playerData.direction;
                // Make animation match direction
                if (existingPlayer.direction !== 0) {
                    existingPlayer.animationController.play('run');
                } else {
                    existingPlayer.animationController.play('idle');
                }
            }
            
            if (playerData.faceDirection !== undefined) {
                existingPlayer.faceDirection = playerData.faceDirection;
                existingPlayer.animationController.setFlipped(existingPlayer.faceDirection === -1);
            }
            
            // Ensure the player is properly set up
            existingPlayer.renderLayer = LAYERS.PLAYER;
            existingPlayer.hasCollision = true;
            existingPlayer.sleeping = false;
            existingPlayer.type = 'player';
            existingPlayer.isInterpolating = true;
        } else {
            // Only create a new player if it doesn't exist
            console.log(`Creating new remote player with ID: ${playerData.id}`);
            
            const playerOptions = {
                id: playerData.id,
                x: playerData.x,
                y: playerData.y,
                width: playerData.width || 20,
                height: playerData.height || 64,
                isLocalPlayer: false,
                direction: playerData.direction || 0,
                faceDirection: playerData.faceDirection || 1,
                health: playerData.health,
                maxHealth: playerData.maxHealth,
                isDead: playerData.isDead
            };
            
            const player = new Player(playerOptions);
            player.name = playerData.name || `Player${playerData.id.toString().substring(0, 6)}`;
            
            // Initialize the player
            player.init(gl);
            await player.animationsPromise;
            
            // Set up player properties
            if (playerData.velocityX !== undefined) {
                player.velocity.x = playerData.velocityX;
            }
            if (playerData.velocityY !== undefined) {
                player.velocity.y = playerData.velocityY;
            }
            
            // Add player to our tracking map
            this.remotePlayers.set(playerData.id, player);
            
            // Add player to entity list
            allEntities.push(player);
            
            // Add player to game mode if it exists
            if (window.gameMode && !window.gameMode.players.has(player.id)) {
                window.gameMode.addPlayer(player);
            }
            
            console.log(`Created new remote player: ${player.id} at (${player.x}, ${player.y})`);
        }
    }
    
    // Handle player disconnect
    handlePlayerDisconnect(playerId) {
        // Remove from remotePlayers map
        if (this.remotePlayers.has(playerId)) {
            this.remotePlayers.delete(playerId);
        }
        
        // Remove from allEntities array
        for (let j = 0; j < allEntities.length; j++) {
            if (allEntities[j].id === playerId) {
                allEntities.splice(j, 1);
                toast.show(`Player ${playerId} disconnected`);
                return;
            }
        }
    }
    
    // Handle initial state
    async handleInitialState(players) {
        console.log("Received initial state with players:", players);
        
        // First, check if we need to update our local player's ID
        if (STATE.myPlayer) {
            // The server will send us our own player data with the server-assigned ID
            // We need to find it and update our local player's ID
            for (const playerData of players) {
                // Check if this is our player (based on position or other properties)
                // Since we don't have a reliable way to identify our player in the initial state,
                // we'll just use the first player data for now
                if (players.length > 0 && !STATE.myPlayer.serverIdAssigned) {
                    console.log(`Updating local player ID from ${STATE.myPlayer.id} to server-assigned ID: ${players[0].id}`);
                    STATE.myPlayer.id = players[0].id;
                    STATE.myPlayer.serverIdAssigned = true;
                    break;
                }
            }
        }
        
        // Then process all other players
        for (const playerData of players) {
            // Skip our own player since we already updated it
            if (STATE.myPlayer && playerData.id === STATE.myPlayer.id) {
                continue;
            }
            await this.handlePlayerUpdate(playerData);
        }
    }
    
    // Handle chat message
    handleChatMessage(playerId, message) {
        // Find player name
        let playerName = `Player${playerId}`;
        for (const entity of allEntities) {
            if (entity.id === playerId && entity.name) {
                playerName = entity.name;
                break;
            }
        }
        
        // Add message to chat
        chatMessages.push({
            playerId,
            playerName,
            message,
            timestamp: Date.now()
        });
        
        // Limit chat messages
        if (chatMessages.length > MAX_CHAT_MESSAGES) {
            chatMessages.shift();
        }
        
        // Show toast
        toast.show(`${playerName}: ${message}`);
    }
    
    // Handle gun fire
    handleGunFire(playerId, x, y, angle, damage) {
        // Find the shooter
        let shooter = null;
        for (const entity of allEntities) {
            if (entity.id === playerId) {
                shooter = entity;
                break;
            }
        }
        
        if (!shooter) return;
        
        // Create a bullet with options
        const bulletOptions = {
            x: x,
            y: y,
            rotation: angle,
            speed: 800,
            damage: damage || 10,
            lifetime: 2
        };
        
        const bullet = new Bullet(bulletOptions);
        
        // Set the bullet's owner
        bullet.ownerId = playerId;
        
        // Add the bullet to entities
        allEntities.push(bullet);
    }
    
    // Handle hit report
    handleHitReport(shooterId, targetId, damage) {
        console.log(`Hit report: shooter ${shooterId} hit target ${targetId} for ${damage} damage`);
        
        // Check if the target is our local player
        if (STATE.myPlayer && targetId === STATE.myPlayer.id) {
            console.log(`Local player hit for ${damage} damage`);
            // Apply damage to local player
            if (STATE.myPlayer.health !== undefined) {
                STATE.myPlayer.health -= damage;
                if (STATE.myPlayer.health <= 0) {
                    STATE.myPlayer.health = 0;
                    STATE.myPlayer.isDead = true;
                }
            }
            return;
        }
        
        // Check if the target is in our remotePlayers map
        const targetPlayer = this.remotePlayers.get(targetId);
        if (targetPlayer) {
            console.log(`Remote player ${targetId} hit for ${damage} damage`);
            // Apply damage to remote player
            if (targetPlayer.health !== undefined) {
                targetPlayer.health -= damage;
                if (targetPlayer.health <= 0) {
                    targetPlayer.health = 0;
                    targetPlayer.isDead = true;
                }
            }
            return;
        }
        
        // If we didn't find the player in our maps, search through all entities
        for (const entity of allEntities) {
            if (entity.id === targetId) {
                console.log(`Entity ${targetId} hit for ${damage} damage`);
                // Apply damage (the server has already done this, but we update the client-side representation)
                if (entity.health !== undefined) {
                    entity.health -= damage;
                    if (entity.health <= 0) {
                        entity.health = 0;
                        entity.isDead = true;
                    }
                }
                break;
            }
        }
    }

    // Send player state update - simplified version
    // Throttling and delta checking now handled by each entity
    updatePlayerState = (playerData) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        // Ensure direction and faceDirection are included
        const direction = playerData.direction !== undefined ? playerData.direction : 0;
        const faceDirection = playerData.faceDirection !== undefined ? playerData.faceDirection : 1;
        
        if (this.binaryMode) {
            // Encode the player update using binary protocol
            const buffer = BinaryProtocol.encodePlayerUpdate({
                id: playerData.id,
                name: playerData.name,
                x: playerData.x,
                y: playerData.y,
                width: playerData.width,
                height: playerData.height,
                color: JSON.stringify(playerData.color),
                health: playerData.health,
                maxHealth: playerData.maxHealth,
                isDead: playerData.isDead,
                velocityX: playerData.velocity.x,
                velocityY: playerData.velocity.y,
                direction: direction,
                faceDirection: faceDirection
            });
            
            this.ws.send(buffer);
        }
    }
    // Send chat message
    sendChatMessage(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeChatMessage(STATE.myPlayer.id, message);
            this.ws.send(buffer);
        }
    }
    
    // Send gun fire
    sendGunFire(x, y, angle, damage) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeGunFire(STATE.myPlayer.id, x, y, angle, damage);
            this.ws.send(buffer);
        }
    }
    
    // Send hit report
    sendHitReport(targetId, damage) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeHitReport(STATE.myPlayer.id, targetId, damage);
            this.ws.send(buffer);
        }
    }
    
    // Send platform destroy
    sendPlatformDestroy(platformId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodePlatformDestroy(platformId, STATE.myPlayer.id);
            this.ws.send(buffer);
        }
    }
    
    // Send fragment create
    sendFragmentCreate(fragment) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        // Extract color components
        let colorR = 1.0, colorG = 1.0, colorB = 1.0, colorA = 1.0;
        if (fragment.color && Array.isArray(fragment.color) && fragment.color.length >= 4) {
            [colorR, colorG, colorB, colorA] = fragment.color;
        }
        
        const fragmentData = {
            id: fragment.id,
            originalEntityId: fragment.originalEntityId || 0,
            x: fragment.x,
            y: fragment.y,
            width: fragment.width,
            height: fragment.height,
            velocityX: fragment.velocity.x,
            velocityY: fragment.velocity.y,
            colorR: colorR,
            colorG: colorG,
            colorB: colorB,
            colorA: colorA
        };
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeFragmentCreate(fragmentData);
            this.ws.send(buffer);
        }
    }
    
    // Send fragment destroy
    sendFragmentDestroy(fragmentId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeFragmentDestroy(fragmentId);
            this.ws.send(buffer);
        }
    }

    // Get chat messages
    getChatMessages() {
        return chatMessages;
    }
    
    // Send initial player ID to server
    sendInitialPlayerID(playerId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        console.log('Sending initial player ID to server:', playerId);
        
        // For now, use JSON since we don't have a binary protocol method for this yet
        this.ws.send(JSON.stringify({
            type: 'InitialPlayerID',
            clientId: playerId
        }));
    }
}

const socket = new Socket()
export default socket
