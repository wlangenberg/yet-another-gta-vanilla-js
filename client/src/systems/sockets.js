
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
    
    connectOnline() {
        const wsUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') 
            ? `ws://127.0.0.1:8081/ws` 
            : `wss://${location.hostname}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            toast.show('Connected to server');
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
                
                // const data = JSON.parse(jsonData);
                // await this.handleJSONMessage(data);
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };
    }
    
    // Handle binary protocol messages
    async handleBinaryMessage(data) {
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
        // Create a new fragment
        const fragment = new Fragment(canvas, gl, {
            x: fragmentData.x,
            y: fragmentData.y,
            width: fragmentData.width,
            height: fragmentData.height,
            color: [fragmentData.colorR, fragmentData.colorG, fragmentData.colorB, fragmentData.colorA]
        });
        
        // Set fragment properties
        fragment.id = fragmentData.id;
        fragment.originalEntityId = fragmentData.originalEntityId;
        fragment.velocity.x = fragmentData.velocityX;
        fragment.velocity.y = fragmentData.velocityY;
        fragment.hasGravity = true;
        fragment.type = 'fragment';
        fragment.renderLayer = 1; // Ensure fragments are visible
        
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
        } else {
            console.debug(`Unknown JSON message type: ${data.type}`);
        }
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
            
            console.log(`Gun ${gun.id} attached to player ${player.id}`);
        } else {
            console.warn(`Could not find gun ${data.gunId} or player ${data.playerId} for attachment`);
        }
    }
    
    // Handle player update
    async handlePlayerUpdate(playerData) {
        if (!playerData || !playerData.id) return;
        
        // Skip updates for our own player
        if (STATE.myPlayer && playerData.id === STATE.myPlayer.id) {
            return;
        }
        
        // Check if player already exists - use ID as the only identifier
        let existingPlayerIndex = -1;
        for (let j = 0; j < allEntities.length; j++) {
            const entity = allEntities[j];
            // Only check ID for player identification
            if (entity instanceof Player && entity.id === playerData.id) {
                existingPlayerIndex = j;
                break;
            }
        }
        
        if (existingPlayerIndex >= 0) {
            // Update existing player instead of creating a new one
            const existingPlayer = allEntities[existingPlayerIndex];
            
            // Update core properties
            existingPlayer.x = playerData.x;
            existingPlayer.y = playerData.y;
            existingPlayer.width = playerData.width || existingPlayer.width;
            existingPlayer.height = playerData.height || existingPlayer.height;
            
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
            
            // Update velocity if provided (prevents jerky movement)
            if (playerData.velocityX !== undefined) {
                existingPlayer.velocity.x = playerData.velocityX;
            }
            if (playerData.velocityY !== undefined) {
                existingPlayer.velocity.y = playerData.velocityY;
            }
            
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
            
            // Make sure this entity is awake and not sleeping
            existingPlayer.sleeping = false;
        } else {
            // Only create a new player if it doesn't exist
            const player = await this.createPlayerFromJson(playerData);
            if (player instanceof Player) {
                // Make sure the player has a valid ID
                if (!player.id && playerData.id) {
                    player.id = playerData.id;
                }
                
                // Add player to entity list
                allEntities.push(player);
                
                console.log(`Created new remote player: ${player.id || player.name}`);
            }
        }
    }
    
    // Handle player disconnect
    handlePlayerDisconnect(playerId) {
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
        for (const playerData of players) {
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
        
        // Create a bullet
        const bullet = new Bullet(canvas, gl, {
            x,
            y,
            rotation: angle,
            speed: 800,
            damage: damage || 10,
            lifetime: 2
        });
        
        // Set the bullet's owner
        bullet.ownerId = playerId;
        
        // Add the bullet to entities
        allEntities.push(bullet);
    }
    
    // Handle hit report
    handleHitReport(shooterId, targetId, damage) {
        // Find the target
        for (const entity of allEntities) {
            if (entity.id === targetId) {
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

    // Track last sent positions to avoid sending redundant updates
    lastSentPositions = new Map();
    updateThreshold = 0.1; // Minimum distance to move before sending update
    lastUpdateTime = 0;
    updateInterval = 50; // Minimum time between updates in ms
    
    // Send player state update with throttling and delta checking
    updatePlayerState = (playerData) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const now = performance.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        
        // Skip update if not enough time has passed since last update
        if (timeSinceLastUpdate < this.updateInterval) {
            return;
        }
        
        // Check if the entity has moved enough to warrant an update
        const lastPos = this.lastSentPositions.get(playerData.id);
        const hasMovedEnough = !lastPos || 
            Math.abs(lastPos.x - playerData.x) > this.updateThreshold || 
            Math.abs(lastPos.y - playerData.y) > this.updateThreshold ||
            lastPos.direction !== playerData.direction ||
            lastPos.faceDirection !== playerData.faceDirection ||
            lastPos.health !== playerData.health ||
            lastPos.isDead !== playerData.isDead;
        
        if (!hasMovedEnough) {
            return; // Skip update if entity hasn't changed significantly
        }
        
        // Update last sent position
        this.lastSentPositions.set(playerData.id, {
            x: playerData.x,
            y: playerData.y,
            direction: playerData.direction,
            faceDirection: playerData.faceDirection,
            health: playerData.health,
            isDead: playerData.isDead
        });
        
        this.lastUpdateTime = now;
        
        if (this.binaryMode) {
            // Extend the protocol to include additional properties
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
                direction: playerData.direction,
                faceDirection: playerData.faceDirection
            });
            
            this.ws.send(buffer);
        } else {
            // Fall back to JSON with extended properties
            const player = {
                ...playerData,
                color: JSON.stringify(playerData.color),
                health: playerData.health,
                maxHealth: playerData.maxHealth,
                isDead: playerData.isDead,
                velocityX: playerData.velocity.x,
                velocityY: playerData.velocity.y,
                direction: playerData.direction,
                faceDirection: playerData.faceDirection
            };
            
            this.ws.send(JSON.stringify(player));
        }
    }
    // Send chat message
    sendChatMessage(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeChatMessage(STATE.myPlayer.id, message);
            this.ws.send(buffer);
        } else {
            // Fall back to JSON
            this.ws.send(JSON.stringify({
                type: 'ChatMessage',
                playerId: STATE.myPlayer.id,
                message: message
            }));
        }
    }
    
    // Send gun fire
    sendGunFire(x, y, angle, damage) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeGunFire(STATE.myPlayer.id, x, y, angle, damage);
            this.ws.send(buffer);
        } else {
            // Fall back to JSON
            this.ws.send(JSON.stringify({
                type: 'GunFire',
                playerId: STATE.myPlayer.id,
                x: x,
                y: y,
                angle: angle,
                damage: damage
            }));
        }
    }
    
    // Send hit report
    sendHitReport(targetId, damage) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeHitReport(STATE.myPlayer.id, targetId, damage);
            this.ws.send(buffer);
        } else {
            // Fall back to JSON
            this.ws.send(JSON.stringify({
                type: 'HitReport',
                shooterId: STATE.myPlayer.id,
                targetId: targetId,
                damage: damage
            }));
        }
    }
    
    // Send platform destroy
    sendPlatformDestroy(platformId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodePlatformDestroy(platformId, STATE.myPlayer.id);
            this.ws.send(buffer);
        } else {
            // Fall back to JSON
            this.ws.send(JSON.stringify({
                type: 'PlatformDestroy',
                platformId: platformId,
                shooterId: STATE.myPlayer.id
            }));
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
        } else {
            // Fall back to JSON
            this.ws.send(JSON.stringify({
                type: 'FragmentCreate',
                fragment: fragmentData
            }));
        }
    }
    
    // Send fragment destroy
    sendFragmentDestroy(fragmentId) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !STATE.myPlayer) return;
        
        if (this.binaryMode) {
            // Use binary protocol
            const buffer = BinaryProtocol.encodeFragmentDestroy(fragmentId);
            this.ws.send(buffer);
        } else {
            // Fall back to JSON
            this.ws.send(JSON.stringify({
                type: 'FragmentDestroy',
                fragmentId: fragmentId
            }));
        }
    }

    // Create player from JSON data
    async createPlayerFromJson(json) {
        if (!json) return null;

        if (json.name && json.name.includes('Player')) {
            // Create player entity
            const player = new Player(canvas, gl, { 
                x: json.x, 
                y: json.y, 
                isLocalPlayer: false
            });
            
            player.id = json.id;
            player.name = json.name;
            
            // Set health properties if they exist
            if (json.health !== undefined) {
                player.health = json.health;
            }
            if (json.maxHealth !== undefined) {
                player.maxHealth = json.maxHealth;
            }
            if (json.isDead !== undefined) {
                player.isDead = json.isDead;
            }
            
            // Ensure player is properly initialized
            player.init(gl);


            await player.animationsPromise;
            
            // Make sure player is visible and properly configured
            player.renderLayer = LAYERS.PLAYER;
            player.hasCollision = true;
            player.sleeping = false;
            player.type = 'player';
            player.color = [1.0, 1.0, 1.0, 1.0]; // Ensure proper color
            player.setScale(8); // Set proper scale for player animations
            
            // Add player to game mode if it exists
            if (window.gameMode && !window.gameMode.players.has(player.id)) {
                window.gameMode.addPlayer(player);
            }
            
            console.log(`Remote player created: ${player.id} at (${player.x}, ${player.y})`);
            return player;
        } else {
            // Create platform or other entity
            let color;
            if (typeof json.color === 'string') {
                try {
                    const colorArray = JSON.parse(json.color);
                    color = [colorArray[0], colorArray[1], colorArray[2], colorArray[3]];
                } catch (e) {
                    color = [1.0, 1.0, 1.0, 1.0]; // Default white
                }
            } else if (json.colorR !== undefined) {
                color = [json.colorR, json.colorG, json.colorB, json.colorA];
            } else {
                color = [1.0, 1.0, 1.0, 1.0]; // Default white
            }
            
            const entity = new Platform(json.x, json.y, json.width, json.height, color);
            entity.id = json.id;
            return entity;
        }
    }
    
    // Get chat messages
    getChatMessages() {
        return chatMessages;
    }
}

const socket = new Socket()
export default socket
