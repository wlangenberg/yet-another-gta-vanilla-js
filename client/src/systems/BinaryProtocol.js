// BinaryProtocol.js - Client-side implementation of the binary protocol

// Message types
const MessageTypes = {
    // Client -> Server messages
    PLAYER_UPDATE: 1,
    CHAT_MESSAGE: 2,
    GUN_FIRE: 3,
    HIT_REPORT: 4,
    PLAYER_JOIN: 5,
    PLAYER_LEAVE: 6,
    PLATFORM_DESTROY: 7,
    FRAGMENT_CREATE: 8,
    FRAGMENT_DESTROY: 9,

    // Server -> Client messages
    BROADCAST_PLAYER_UPDATE: 101,
    BROADCAST_CHAT_MESSAGE: 102,
    BROADCAST_GUN_FIRE: 103,
    BROADCAST_HIT_REPORT: 104,
    BROADCAST_PLAYER_JOIN: 105,
    BROADCAST_PLAYER_LEAVE: 106,
    INITIAL_STATE: 107,
    BROADCAST_PLATFORM_DESTROY: 108,
    BROADCAST_FRAGMENT_CREATE: 109,
    BROADCAST_FRAGMENT_DESTROY: 110
};

// Encode a player update message
function encodePlayerUpdate(player) {
    // Calculate buffer size
    const nameBytes = new TextEncoder().encode(player.name || '');
    const bufferSize = 
        1 + // Message type
        4 + // Player ID
        4 + // Name length
        nameBytes.length + // Name
        4 + // X
        4 + // Y
        4 + // Width
        4 + // Height
        4 + // Color R
        4 + // Color G
        4 + // Color B
        4 + // Color A
        4 + // Health
        4 + // Max Health
        1;  // Is Dead

    // Create buffer
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write message type
    view.setUint8(offset, MessageTypes.PLAYER_UPDATE);
    offset += 1;

    // Write player ID
    view.setInt32(offset, player.id, true);
    offset += 4;

    // Write player name
    view.setInt32(offset, nameBytes.length, true);
    offset += 4;
    
    for (let i = 0; i < nameBytes.length; i++) {
        view.setUint8(offset + i, nameBytes[i]);
    }
    offset += nameBytes.length;

    // Write player position and dimensions
    view.setFloat32(offset, player.x, true);
    offset += 4;
    
    view.setFloat32(offset, player.y, true);
    offset += 4;
    
    view.setFloat32(offset, player.width, true);
    offset += 4;
    
    view.setFloat32(offset, player.height, true);
    offset += 4;

    // Parse and write player color
    let colorR = 1.0, colorG = 1.0, colorB = 1.0, colorA = 1.0;
    if (player.color) {
        try {
            const colorArray = JSON.parse(player.color);
            colorR = colorArray[0] || 1.0;
            colorG = colorArray[1] || 1.0;
            colorB = colorArray[2] || 1.0;
            colorA = colorArray[3] || 1.0;
        } catch (e) {
            console.error("Error parsing color:", e);
        }
    }
    
    view.setFloat32(offset, colorR, true);
    offset += 4;
    
    view.setFloat32(offset, colorG, true);
    offset += 4;
    
    view.setFloat32(offset, colorB, true);
    offset += 4;
    
    view.setFloat32(offset, colorA, true);
    offset += 4;

    // Write player health
    view.setFloat32(offset, player.health || 100, true);
    offset += 4;
    
    view.setFloat32(offset, player.maxHealth || 100, true);
    offset += 4;

    // Write player is dead flag
    view.setUint8(offset, player.isDead ? 1 : 0);
    offset += 1;

    return buffer;
}

// Encode a chat message
function encodeChatMessage(playerId, message) {
    const messageBytes = new TextEncoder().encode(message);
    const bufferSize = 
        1 + // Message type
        4 + // Player ID
        4 + // Message length
        messageBytes.length; // Message

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write message type
    view.setUint8(offset, MessageTypes.CHAT_MESSAGE);
    offset += 1;

    // Write player ID
    view.setInt32(offset, playerId, true);
    offset += 4;

    // Write message
    view.setInt32(offset, messageBytes.length, true);
    offset += 4;
    
    for (let i = 0; i < messageBytes.length; i++) {
        view.setUint8(offset + i, messageBytes[i]);
    }

    return buffer;
}

// Encode a gun fire message
function encodeGunFire(playerId, x, y, angle, damage) {
    const bufferSize = 
        1 + // Message type
        4 + // Player ID
        4 + // X
        4 + // Y
        4 + // Angle
        4;  // Damage

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write message type
    view.setUint8(offset, MessageTypes.GUN_FIRE);
    offset += 1;

    // Write player ID
    view.setInt32(offset, playerId, true);
    offset += 4;

    // Write position and angle
    view.setFloat32(offset, x, true);
    offset += 4;
    
    view.setFloat32(offset, y, true);
    offset += 4;
    
    view.setFloat32(offset, angle, true);
    offset += 4;
    
    view.setFloat32(offset, damage, true);
    offset += 4;

    return buffer;
}

// Encode a hit report message
function encodeHitReport(shooterId, targetId, damage) {
    const bufferSize = 
        1 + // Message type
        4 + // Shooter ID
        4 + // Target ID
        4;  // Damage

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write message type
    view.setUint8(offset, MessageTypes.HIT_REPORT);
    offset += 1;

    // Write shooter and target IDs
    view.setInt32(offset, shooterId, true);
    offset += 4;
    
    view.setInt32(offset, targetId, true);
    offset += 4;

    // Write damage
    view.setFloat32(offset, damage, true);
    offset += 4;

    return buffer;
}

// Encode a platform destroy message
function encodePlatformDestroy(platformId, shooterId) {
    const bufferSize = 
        1 + // Message type
        4 + // Platform ID
        4;  // Shooter ID (who destroyed it)

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write message type
    view.setUint8(offset, MessageTypes.PLATFORM_DESTROY);
    offset += 1;

    // Write platform and shooter IDs
    view.setInt32(offset, platformId, true);
    offset += 4;
    
    view.setInt32(offset, shooterId, true);
    offset += 4;

    return buffer;
}

// Encode a fragment create message
function encodeFragmentCreate(fragmentData) {
    const bufferSize = 
        1 + // Message type
        4 + // Fragment ID
        4 + // Original Entity ID
        4 + // X
        4 + // Y
        4 + // Width
        4 + // Height
        4 + // Velocity X
        4 + // Velocity Y
        4 + // Color R
        4 + // Color G
        4 + // Color B
        4;  // Color A

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write message type
    view.setUint8(offset, MessageTypes.FRAGMENT_CREATE);
    offset += 1;

    // Write fragment ID
    view.setInt32(offset, fragmentData.id, true);
    offset += 4;
    
    // Write original entity ID
    view.setInt32(offset, fragmentData.originalEntityId, true);
    offset += 4;

    // Write position and dimensions
    view.setFloat32(offset, fragmentData.x, true);
    offset += 4;
    
    view.setFloat32(offset, fragmentData.y, true);
    offset += 4;
    
    view.setFloat32(offset, fragmentData.width, true);
    offset += 4;
    
    view.setFloat32(offset, fragmentData.height, true);
    offset += 4;
    
    // Write velocity
    view.setFloat32(offset, fragmentData.velocityX, true);
    offset += 4;
    
    view.setFloat32(offset, fragmentData.velocityY, true);
    offset += 4;

    // Write color
    view.setFloat32(offset, fragmentData.colorR, true);
    offset += 4;
    
    view.setFloat32(offset, fragmentData.colorG, true);
    offset += 4;
    
    view.setFloat32(offset, fragmentData.colorB, true);
    offset += 4;
    
    view.setFloat32(offset, fragmentData.colorA, true);
    offset += 4;

    return buffer;
}

// Encode a fragment destroy message
function encodeFragmentDestroy(fragmentId) {
    const bufferSize = 
        1 + // Message type
        4;  // Fragment ID

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Write message type
    view.setUint8(offset, MessageTypes.FRAGMENT_DESTROY);
    offset += 1;

    // Write fragment ID
    view.setInt32(offset, fragmentId, true);
    offset += 4;

    return buffer;
}

// Decode a message from the server
function decodeMessage(buffer) {
    const view = new DataView(buffer);
    const messageType = view.getUint8(0);
    let offset = 1;

    switch (messageType) {
        case MessageTypes.BROADCAST_PLAYER_UPDATE:
            return decodeBroadcastPlayerUpdate(view, offset);
        
        case MessageTypes.BROADCAST_CHAT_MESSAGE:
            return decodeBroadcastChatMessage(view, offset);
        
        case MessageTypes.BROADCAST_GUN_FIRE:
            return decodeBroadcastGunFire(view, offset);
        
        case MessageTypes.BROADCAST_HIT_REPORT:
            return decodeBroadcastHitReport(view, offset);
        
        case MessageTypes.BROADCAST_PLAYER_JOIN:
            return decodeBroadcastPlayerJoin(view, offset);
        
        case MessageTypes.BROADCAST_PLAYER_LEAVE:
            return decodeBroadcastPlayerLeave(view, offset);
        
        case MessageTypes.INITIAL_STATE:
            return decodeInitialState(view, offset);
            
        case MessageTypes.BROADCAST_PLATFORM_DESTROY:
            return decodeBroadcastPlatformDestroy(view, offset);
            
        case MessageTypes.BROADCAST_FRAGMENT_CREATE:
            return decodeBroadcastFragmentCreate(view, offset);
            
        case MessageTypes.BROADCAST_FRAGMENT_DESTROY:
            return decodeBroadcastFragmentDestroy(view, offset);
        
        default:
            console.error("Unknown message type:", messageType);
            return null;
    }
}

// Decode a broadcast platform destroy message
function decodeBroadcastPlatformDestroy(view, offset) {
    // Read platform and shooter IDs
    const platformId = view.getInt32(offset, true);
    offset += 4;
    
    const shooterId = view.getInt32(offset, true);
    offset += 4;

    return {
        type: 'PlatformDestroy',
        platformId: platformId,
        shooterId: shooterId
    };
}

// Decode a broadcast fragment create message
function decodeBroadcastFragmentCreate(view, offset) {
    // Read fragment data
    const fragmentId = view.getInt32(offset, true);
    offset += 4;
    
    const originalEntityId = view.getInt32(offset, true);
    offset += 4;
    
    const x = view.getFloat32(offset, true);
    offset += 4;
    
    const y = view.getFloat32(offset, true);
    offset += 4;
    
    const width = view.getFloat32(offset, true);
    offset += 4;
    
    const height = view.getFloat32(offset, true);
    offset += 4;
    
    const velocityX = view.getFloat32(offset, true);
    offset += 4;
    
    const velocityY = view.getFloat32(offset, true);
    offset += 4;
    
    const colorR = view.getFloat32(offset, true);
    offset += 4;
    
    const colorG = view.getFloat32(offset, true);
    offset += 4;
    
    const colorB = view.getFloat32(offset, true);
    offset += 4;
    
    const colorA = view.getFloat32(offset, true);
    offset += 4;

    return {
        type: 'FragmentCreate',
        fragment: {
            id: fragmentId,
            originalEntityId: originalEntityId,
            x: x,
            y: y,
            width: width,
            height: height,
            velocityX: velocityX,
            velocityY: velocityY,
            colorR: colorR,
            colorG: colorG,
            colorB: colorB,
            colorA: colorA
        }
    };
}

// Decode a broadcast player update message
function decodeBroadcastPlayerUpdate(view, offset) {
    const player = {};

    // Read player ID
    player.id = view.getInt32(offset, true);
    offset += 4;

    // Read player name
    const nameLength = view.getInt32(offset, true);
    offset += 4;
    
    const nameBytes = new Uint8Array(nameLength);
    for (let i = 0; i < nameLength; i++) {
        nameBytes[i] = view.getUint8(offset + i);
    }
    player.name = new TextDecoder().decode(nameBytes);
    offset += nameLength;

    // Read player position and dimensions
    player.x = view.getFloat32(offset, true);
    offset += 4;
    
    player.y = view.getFloat32(offset, true);
    offset += 4;
    
    player.width = view.getFloat32(offset, true);
    offset += 4;
    
    player.height = view.getFloat32(offset, true);
    offset += 4;

    // Read player color
    const colorR = view.getFloat32(offset, true);
    offset += 4;
    
    const colorG = view.getFloat32(offset, true);
    offset += 4;
    
    const colorB = view.getFloat32(offset, true);
    offset += 4;
    
    const colorA = view.getFloat32(offset, true);
    offset += 4;
    
    player.color = JSON.stringify([colorR, colorG, colorB, colorA]);

    // Read player health
    player.health = view.getFloat32(offset, true);
    offset += 4;
    
    player.maxHealth = view.getFloat32(offset, true);
    offset += 4;

    // Read player is dead flag
    player.isDead = view.getUint8(offset) !== 0;
    offset += 1;

    return {
        type: 'PlayerUpdate',
        player: player
    };
}

// Decode a broadcast chat message
function decodeBroadcastChatMessage(view, offset) {
    // Read player ID
    const playerId = view.getInt32(offset, true);
    offset += 4;

    // Read message
    const messageLength = view.getInt32(offset, true);
    offset += 4;
    
    const messageBytes = new Uint8Array(messageLength);
    for (let i = 0; i < messageLength; i++) {
        messageBytes[i] = view.getUint8(offset + i);
    }
    const message = new TextDecoder().decode(messageBytes);
    offset += messageLength;

    return {
        type: 'ChatMessage',
        playerId: playerId,
        message: message
    };
}

// Decode a broadcast gun fire message
function decodeBroadcastGunFire(view, offset) {
    // Read player ID
    const playerId = view.getInt32(offset, true);
    offset += 4;

    // Read position and angle
    const x = view.getFloat32(offset, true);
    offset += 4;
    
    const y = view.getFloat32(offset, true);
    offset += 4;
    
    const angle = view.getFloat32(offset, true);
    offset += 4;
    
    const damage = view.getFloat32(offset, true);
    offset += 4;

    return {
        type: 'GunFire',
        playerId: playerId,
        x: x,
        y: y,
        angle: angle,
        damage: damage
    };
}

// Decode a broadcast hit report message
function decodeBroadcastHitReport(view, offset) {
    // Read shooter and target IDs
    const shooterId = view.getInt32(offset, true);
    offset += 4;
    
    const targetId = view.getInt32(offset, true);
    offset += 4;

    // Read damage
    const damage = view.getFloat32(offset, true);
    offset += 4;

    return {
        type: 'HitReport',
        shooterId: shooterId,
        targetId: targetId,
        damage: damage
    };
}

// Decode a broadcast player join message
function decodeBroadcastPlayerJoin(view, offset) {
    // Read player ID
    const playerId = view.getInt32(offset, true);
    offset += 4;

    return {
        type: 'PlayerJoin',
        playerId: playerId
    };
}

// Decode a broadcast player leave message
function decodeBroadcastPlayerLeave(view, offset) {
    // Read player ID
    const playerId = view.getInt32(offset, true);
    offset += 4;

    return {
        type: 'PlayerDisconnect',
        id: playerId
    };
}

// Decode an initial state message
function decodeInitialState(view, offset) {
    // Read number of players
    const playerCount = view.getInt32(offset, true);
    offset += 4;

    const players = [];
    for (let i = 0; i < playerCount; i++) {
        const player = {};

        // Read player ID
        player.id = view.getInt32(offset, true);
        offset += 4;

        // Read player name
        const nameLength = view.getInt32(offset, true);
        offset += 4;
        
        const nameBytes = new Uint8Array(nameLength);
        for (let j = 0; j < nameLength; j++) {
            nameBytes[j] = view.getUint8(offset + j);
        }
        player.name = new TextDecoder().decode(nameBytes);
        offset += nameLength;

        // Read player position and dimensions
        player.x = view.getFloat32(offset, true);
        offset += 4;
        
        player.y = view.getFloat32(offset, true);
        offset += 4;
        
        player.width = view.getFloat32(offset, true);
        offset += 4;
        
        player.height = view.getFloat32(offset, true);
        offset += 4;

        // Read player color
        const colorR = view.getFloat32(offset, true);
        offset += 4;
        
        const colorG = view.getFloat32(offset, true);
        offset += 4;
        
        const colorB = view.getFloat32(offset, true);
        offset += 4;
        
        const colorA = view.getFloat32(offset, true);
        offset += 4;
        
        player.color = JSON.stringify([colorR, colorG, colorB, colorA]);

        // Read player health
        player.health = view.getFloat32(offset, true);
        offset += 4;
        
        player.maxHealth = view.getFloat32(offset, true);
        offset += 4;

        // Read player is dead flag
        player.isDead = view.getUint8(offset) !== 0;
        offset += 1;

        players.push(player);
    }

    return {
        type: 'InitialState',
        players: players
    };
}

// Decode a broadcast fragment destroy message
function decodeBroadcastFragmentDestroy(view, offset) {
    // Read fragment ID
    const fragmentId = view.getInt32(offset, true);
    offset += 4;

    return {
        type: 'FragmentDestroy',
        fragmentId: fragmentId
    };
}

export default {
    MessageTypes,
    encodePlayerUpdate,
    encodeChatMessage,
    encodeGunFire,
    encodeHitReport,
    encodePlatformDestroy,
    encodeFragmentCreate,
    encodeFragmentDestroy,
    decodeMessage
};
