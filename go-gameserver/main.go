package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"gameeserever/protocol"
)

// Define a custom message type that can be either a protocol.Message or a JSON message
type BroadcastMessage struct {
	BinaryMsg protocol.Message
	JSONMsg   map[string]interface{}
	IsBinary  bool
}

var (
	clients     = make(map[*websocket.Conn]*ClientState) // Track clients by connection
	broadcast   = make(chan BroadcastMessage)            // Broadcast channel for messages
	mu          sync.Mutex                               // Mutex for safe concurrent access
	nextPlayerID int32 = 1                               // Next player ID to assign
	upgrader    = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all connections (adjust for production)
		},
	}
)

// ClientState holds the state of a connected client
type ClientState struct {
	Player protocol.Player
	Conn   *websocket.Conn
}

// Handle incoming WebSocket connections
func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading connection:", err)
		return
	}
	
	// Create a new client state with a server-assigned ID
	clientID := nextPlayerID
	nextPlayerID++
	
	clientState := &ClientState{
		Player: protocol.Player{
			ID:           clientID,
			Name:         "Player" + strconv.Itoa(int(clientID)),
			Health:       100,
			MaxHealth:    100,
			IsDead:       false,
			// Set default dimensions for player
			Width:        50,
			Height:       70,
			// Set default color
			ColorR:       1.0,
			ColorG:       1.0,
			ColorB:       1.0,
			ColorA:       1.0,
			// Set default direction and face direction
			Direction:    0,
			FaceDirection: 1,
			VelocityX:    0,
			VelocityY:    0,
		},
		Conn: conn,
	}
	
	// Add the client to the clients map
	mu.Lock()
	clients[conn] = clientState
	mu.Unlock()
	
	// Set up a defer to clean up when the connection closes
	defer func() {
		mu.Lock()
		delete(clients, conn)
		mu.Unlock()
		
		// Notify other clients that this player has left
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastPlayerLeaveMessage{PlayerID: clientID},
			IsBinary: true,
		}
		
		conn.Close()
		log.Printf("Player %d disconnected", clientID)
	}()
	
	// Notify other clients that a new player has joined
	broadcast <- BroadcastMessage{
		BinaryMsg: protocol.BroadcastPlayerJoinMessage{PlayerID: clientID},
		IsBinary: true,
	}
	log.Printf("Player %d connected from %s", clientID, conn.RemoteAddr())
	
	// Send the initial state to the new client
	sendInitialState(conn)
	
	// Handle incoming messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}
		
		// Try to decode the message as binary first
		binaryMsg, err := protocol.DecodeMessage(message)
		if err == nil {
			// Successfully decoded binary message
			handleBinaryMessage(binaryMsg, conn)
		} else {
			// Try to decode as JSON for backward compatibility
			var jsonData map[string]interface{}
			if err := json.Unmarshal(message, &jsonData); err == nil {
				handleJSONMessage(jsonData, conn)
			} else {
				log.Printf("Error decoding message: %v", err)
			}
		}
	}
}

// Send the initial state to a new client
func sendInitialState(conn *websocket.Conn) {
	mu.Lock()
	defer mu.Unlock()
	
	// Get the client state for this connection
	clientState, exists := clients[conn]
	if !exists {
		log.Println("Client not found when sending initial state")
		return
	}
	
	// First, send the client their own player data
	selfInitialState := protocol.InitialStateMessage{
		Players: []protocol.Player{clientState.Player},
	}
	
	data, err := selfInitialState.Encode()
	if err != nil {
		log.Printf("Error encoding self initial state: %v", err)
		return
	}
	
	if err := conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
		log.Printf("Error sending self initial state: %v", err)
		return
	}
	
	// Then collect all other players
	otherPlayers := make([]protocol.Player, 0, len(clients)-1)
	for _, client := range clients {
		if client.Conn != conn { // Don't include the new client
			otherPlayers = append(otherPlayers, client.Player)
		}
	}
	
	// Create and send the initial state message with other players
	initialState := protocol.InitialStateMessage{
		Players: otherPlayers,
	}
	
	data, err = initialState.Encode()
	if err != nil {
		log.Printf("Error encoding initial state: %v", err)
		return
	}
	
	if err := conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
		log.Printf("Error sending initial state: %v", err)
	}
}

// Handle a binary protocol message
func handleBinaryMessage(msg protocol.Message, conn *websocket.Conn) {
	mu.Lock()
	clientState, exists := clients[conn]
	mu.Unlock()
	
	if !exists {
		log.Println("Message from unknown client")
		return
	}
	
	switch m := msg.(type) {
	case protocol.PlayerUpdateMessage:
		// Validate the player ID
		if m.Player.ID != clientState.Player.ID {
			log.Printf("Player %d tried to update as player %d", clientState.Player.ID, m.Player.ID)
			return
		}
		
		mu.Lock()
		// Update player state but preserve some properties
		prevHealth := clientState.Player.Health
		prevMaxHealth := clientState.Player.MaxHealth
		prevIsDead := clientState.Player.IsDead
		
		// Update position and movement data
		clientState.Player.X = m.Player.X
		clientState.Player.Y = m.Player.Y
		clientState.Player.Width = m.Player.Width
		clientState.Player.Height = m.Player.Height
		clientState.Player.ColorR = m.Player.ColorR
		clientState.Player.ColorG = m.Player.ColorG
		clientState.Player.ColorB = m.Player.ColorB
		clientState.Player.ColorA = m.Player.ColorA
		
		// Update direction and face direction
		clientState.Player.Direction = m.Player.Direction
		clientState.Player.FaceDirection = m.Player.FaceDirection
		
		// Update velocity
		clientState.Player.VelocityX = m.Player.VelocityX
		clientState.Player.VelocityY = m.Player.VelocityY
		
		// Only update health-related fields if they've changed
		if m.Player.Health != prevHealth || m.Player.MaxHealth != prevMaxHealth || m.Player.IsDead != prevIsDead {
			clientState.Player.Health = m.Player.Health
			clientState.Player.MaxHealth = m.Player.MaxHealth
			clientState.Player.IsDead = m.Player.IsDead
		}
		mu.Unlock()
		
		// Broadcast the update to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastPlayerUpdateMessage{
				Player: clientState.Player,
			},
			IsBinary: true,
		}
		
	case protocol.ChatMessageMessage:
		// Validate the message
		if m.Chat.PlayerID != clientState.Player.ID {
			log.Printf("Player %d tried to send a chat message as player %d", clientState.Player.ID, m.Chat.PlayerID)
			return
		}
		
		// Broadcast the chat message to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastChatMessageMessage{
				Chat: m.Chat,
			},
			IsBinary: true,
		}
		
	case protocol.GunFireMessage:
		// Validate the message
		if m.Fire.PlayerID != clientState.Player.ID {
			log.Printf("Player %d tried to fire a gun as player %d", clientState.Player.ID, m.Fire.PlayerID)
			return
		}
		
		// Broadcast the gun fire to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastGunFireMessage{
				Fire: m.Fire,
			},
			IsBinary: true,
		}
		
	case protocol.HitReportMessage:
		// Validate the message
		if m.Hit.ShooterID != clientState.Player.ID {
			log.Printf("Player %d tried to report a hit as player %d", clientState.Player.ID, m.Hit.ShooterID)
			return
		}
		
		// Find the target player
		var targetClient *ClientState
		mu.Lock()
		for _, client := range clients {
			if client.Player.ID == m.Hit.TargetID {
				targetClient = client
				break
			}
		}
		mu.Unlock()
		
		if targetClient == nil {
			log.Printf("Player %d tried to hit non-existent player %d", m.Hit.ShooterID, m.Hit.TargetID)
			return
		}
		
		// Find the shooter player
		var shooterClient *ClientState
		mu.Lock()
		for _, client := range clients {
			if client.Player.ID == m.Hit.ShooterID {
				shooterClient = client
				break
			}
		}
		mu.Unlock()
		
		// Apply damage to the target player
		mu.Lock()
		if !targetClient.Player.IsDead {
			targetClient.Player.Health -= m.Hit.Damage
			log.Printf("Player %d hit player %d for %f damage. Health now: %f",
				m.Hit.ShooterID, m.Hit.TargetID, m.Hit.Damage, targetClient.Player.Health)
			
			if targetClient.Player.Health <= 0 {
				targetClient.Player.Health = 0
				targetClient.Player.IsDead = true
				log.Printf("Player %d was killed by player %d", m.Hit.TargetID, m.Hit.ShooterID)
				
				// Start a timer to respawn the player
				go func(targetID int32) {
					time.Sleep(3 * time.Second) // 3 second respawn time
					
					mu.Lock()
					defer mu.Unlock()
					
					// Find the target player again (they might have disconnected)
					for _, client := range clients {
						if client.Player.ID == targetID {
							// Respawn the player
							client.Player.Health = client.Player.MaxHealth
							client.Player.IsDead = false
							log.Printf("Player %d respawned with health %f", targetID, client.Player.Health)
							
							// Broadcast the update
							broadcast <- BroadcastMessage{
								BinaryMsg: protocol.BroadcastPlayerUpdateMessage{
									Player: client.Player,
								},
								IsBinary: true,
							}
							break
						}
					}
				}(m.Hit.TargetID)
			}
		}
		mu.Unlock()
		
		// Broadcast the hit to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastHitReportMessage{
				Hit: m.Hit,
			},
			IsBinary: true,
		}
		
		// Broadcast the updated target player state to all clients
		mu.Lock()
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastPlayerUpdateMessage{
				Player: targetClient.Player,
			},
			IsBinary: true,
		}
		mu.Unlock()
		
		// Also send a direct update to the target player to ensure they get the update
		if targetClient != nil {
			data, err := protocol.BroadcastPlayerUpdateMessage{
				Player: targetClient.Player,
			}.Encode()
			if err == nil {
				targetClient.Conn.WriteMessage(websocket.BinaryMessage, data)
			}
		}
		
		// Also send a direct update to the shooter player to confirm the hit
		if shooterClient != nil {
			data, err := protocol.BroadcastHitReportMessage{
				Hit: m.Hit,
			}.Encode()
			if err == nil {
				shooterClient.Conn.WriteMessage(websocket.BinaryMessage, data)
			}
		}
		
	case protocol.PlatformDestroyMessage:
		// Validate the message
		if m.Destroy.ShooterID != clientState.Player.ID {
			log.Printf("Player %d tried to destroy a platform as player %d", clientState.Player.ID, m.Destroy.ShooterID)
			return
		}
		
		// Broadcast the platform destruction to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastPlatformDestroyMessage{
				Destroy: m.Destroy,
			},
			IsBinary: true,
		}
		
	case protocol.FragmentCreateMessage:
		// Validate the message
		if m.Fragment.OriginalEntityID == 0 {
			log.Printf("Player %d tried to create a fragment with invalid original entity ID", clientState.Player.ID)
			return
		}
		
		// Broadcast the fragment creation to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastFragmentCreateMessage{
				Fragment: m.Fragment,
			},
			IsBinary: true,
		}
		
	case protocol.FragmentDestroyMessage:
		// Validate the message
		if m.Destroy.FragmentID == 0 {
			log.Printf("Player %d tried to destroy a fragment with invalid ID", clientState.Player.ID)
			return
		}
		
		// Broadcast the fragment destruction to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastFragmentDestroyMessage{
				Destroy: m.Destroy,
			},
			IsBinary: true,
		}
		
	case protocol.GunAttachmentMessage:
		// Validate the message
		if m.Attachment.PlayerID != clientState.Player.ID {
			log.Printf("Player %d tried to attach a gun as player %d", clientState.Player.ID, m.Attachment.PlayerID)
			return
		}
		
		// Broadcast the gun attachment to all clients
		broadcast <- BroadcastMessage{
			BinaryMsg: protocol.BroadcastGunAttachmentMessage{
				Attachment: m.Attachment,
			},
			IsBinary: true,
		}
	}
}

// Handle a JSON message (for backward compatibility)
func handleJSONMessage(data map[string]interface{}, conn *websocket.Conn) {
	mu.Lock()
	clientState, exists := clients[conn]
	mu.Unlock()
	
	if !exists {
		log.Println("Message from unknown client")
		return
	}
	
	// Check message type
	msgType, _ := data["type"].(string)
	
	// Handle InitialPlayerID message
	if msgType == "InitialPlayerID" {
		clientId, ok := data["clientId"].(float64)
		if ok {
			log.Printf("Received initial player ID from client: %v", int64(clientId))
			
			// Send the server-assigned ID back to the client
			// This will help the client update its local player ID
			initialState := protocol.InitialStateMessage{
				Players: []protocol.Player{
					{
						ID:           clientState.Player.ID,
						Name:         clientState.Player.Name,
						X:            clientState.Player.X,
						Y:            clientState.Player.Y,
						Width:        clientState.Player.Width,
						Height:       clientState.Player.Height,
						ColorR:       clientState.Player.ColorR,
						ColorG:       clientState.Player.ColorG,
						ColorB:       clientState.Player.ColorB,
						ColorA:       clientState.Player.ColorA,
						Health:       clientState.Player.Health,
						MaxHealth:    clientState.Player.MaxHealth,
						IsDead:       clientState.Player.IsDead,
						Direction:    clientState.Player.Direction,
						FaceDirection: clientState.Player.FaceDirection,
						VelocityX:    clientState.Player.VelocityX,
						VelocityY:    clientState.Player.VelocityY,
					},
				},
			}
			
			data, err := initialState.Encode()
			if err != nil {
				log.Printf("Error encoding initial state: %v", err)
				return
			}
			
			if err := conn.WriteMessage(websocket.BinaryMessage, data); err != nil {
				log.Printf("Error sending initial state: %v", err)
			}
			
			return
		}
	}
	
	// Handle gun attachment messages
	if msgType == "GunAttachment" {
		attachmentData, ok := data["data"].(map[string]interface{})
		if ok {
			gunId, _ := attachmentData["gunId"].(float64)
			playerId, _ := attachmentData["playerId"].(float64)
			offsetX, _ := attachmentData["attachmentOffsetX"].(float64)
			offsetY, _ := attachmentData["attachmentOffsetY"].(float64)
			rotation, _ := attachmentData["rotation"].(float64)
			
			// Validate that the player ID matches the client's player ID
			if int32(playerId) != clientState.Player.ID {
				log.Printf("Player %d tried to attach a gun as player %d", clientState.Player.ID, int32(playerId))
				return
			}
			
			// Create a gun attachment message
			attachment := protocol.GunAttachment{
				GunID:    int32(gunId),
				PlayerID: int32(playerId),
				OffsetX:  float32(offsetX),
				OffsetY:  float32(offsetY),
				Rotation: float32(rotation),
			}
			
			// Broadcast the gun attachment to all clients using binary protocol
			broadcast <- BroadcastMessage{
				BinaryMsg: protocol.BroadcastGunAttachmentMessage{
					Attachment: attachment,
				},
				IsBinary: true,
			}
			
			return
		}
	}
	
	// Extract player data for regular updates
	x, _ := data["x"].(float64)
	y, _ := data["y"].(float64)
	width, _ := data["width"].(float64)
	height, _ := data["height"].(float64)
	colorStr, _ := data["color"].(string)
	health, _ := data["health"].(float64)
	maxHealth, _ := data["maxHealth"].(float64)
	isDead, _ := data["isDead"].(bool)
	
	// Parse color
	colorR, colorG, colorB, colorA := protocol.ParseColorString(colorStr)
	
	// Update the player's state
	mu.Lock()
	
	clientState.Player.X = float32(x)
	clientState.Player.Y = float32(y)
	clientState.Player.Width = float32(width)
	clientState.Player.Height = float32(height)
	clientState.Player.ColorR = colorR
	clientState.Player.ColorG = colorG
	clientState.Player.ColorB = colorB
	clientState.Player.ColorA = colorA
	
	// Only update health-related fields if they're provided
	if health > 0 {
		clientState.Player.Health = float32(health)
	}
	if maxHealth > 0 {
		clientState.Player.MaxHealth = float32(maxHealth)
	}
	clientState.Player.IsDead = isDead
	mu.Unlock()
	
	// Broadcast the update to all clients
	broadcast <- BroadcastMessage{
		BinaryMsg: protocol.BroadcastPlayerUpdateMessage{
			Player: clientState.Player,
		},
		IsBinary: true,
	}
}

// Handle broadcasting messages to all clients with optimizations
func handleMessages() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	var messageCount int
	var countMutex sync.Mutex // Mutex to protect messageCount
	
	// Message batching - faster updates for better responsiveness
	const batchInterval = 16 * time.Millisecond // ~60 updates per second
	batchTicker := time.NewTicker(batchInterval)
	defer batchTicker.Stop()
	
	// Message queue for batching
	messageQueue := make([]BroadcastMessage, 0, 100)
	
	// Stats reporting
	go func() {
		for range ticker.C {
			countMutex.Lock()
			log.Printf("Messages sent per second: %d", messageCount)
			messageCount = 0 // Reset the counter
			countMutex.Unlock()
		}
	}()
	
	// Process batched messages
	go func() {
		for range batchTicker.C {
			if len(messageQueue) == 0 {
				continue
			}
			
			// Process all queued messages
			mu.Lock()
			localQueue := messageQueue
			messageQueue = make([]BroadcastMessage, 0, 100) // Reset queue
			clientMap := make(map[*websocket.Conn]*ClientState)
			
			// Create a copy of the clients map to avoid holding the lock
			for client, state := range clients {
				clientMap[client] = state
			}
			mu.Unlock()
			
			// Group messages by client and type to reduce the number of WebSocket writes
			clientMessages := make(map[*websocket.Conn][]interface{})
			
			// First, sort messages by priority (player updates first)
			playerUpdates := make([]interface{}, 0)
			otherMessages := make([]interface{}, 0)
			jsonMessages := make([]interface{}, 0)
			
			for _, msg := range localQueue {
				if msg.IsBinary {
					// Check if it's a player update message
					if playerUpdateMsg, ok := msg.BinaryMsg.(protocol.BroadcastPlayerUpdateMessage); ok {
						playerUpdates = append(playerUpdates, playerUpdateMsg)
					} else {
						otherMessages = append(otherMessages, msg.BinaryMsg)
					}
				} else {
					// JSON message
					jsonMessages = append(jsonMessages, msg.JSONMsg)
				}
			}
			
			// Process player updates first
			for _, msg := range playerUpdates {
				m := msg.(protocol.BroadcastPlayerUpdateMessage)
				playerID := m.Player.ID
				
				for client, state := range clientMap {
					// Skip sending updates about a player to themselves
					if state.Player.ID == playerID {
						continue
					}
					
					clientMessages[client] = append(clientMessages[client], m)
				}
			}
			
			// Then process other binary protocol messages
			for _, msg := range otherMessages {
				switch m := msg.(type) {
				case protocol.BroadcastPlayerJoinMessage, protocol.BroadcastPlayerLeaveMessage,
					 protocol.BroadcastChatMessageMessage, protocol.BroadcastGunFireMessage,
					 protocol.BroadcastHitReportMessage, protocol.BroadcastPlatformDestroyMessage,
					 protocol.BroadcastFragmentCreateMessage, protocol.BroadcastFragmentDestroyMessage,
					 protocol.BroadcastGunAttachmentMessage:
					// These messages are sent to all clients
					for client := range clientMap {
						clientMessages[client] = append(clientMessages[client], m)
					}
				}
			}
			
			// Finally, process JSON messages
			for _, msg := range jsonMessages {
				jsonMsg := msg.(map[string]interface{})
				
				// Handle gun attachment messages
				if msgType, ok := jsonMsg["type"].(string); ok && msgType == "GunAttachment" {
					// Send to all clients
					for client := range clientMap {
						clientMessages[client] = append(clientMessages[client], jsonMsg)
					}
				}
			}
			
			// Send batched messages to each client
			for client, messages := range clientMessages {
				if len(messages) == 0 {
					continue
				}
				
				// For now, send each message individually
				// In a more advanced implementation, we could combine multiple messages into a single binary packet
				for _, msg := range messages {
					var err error
					
					// Check if this is a binary protocol message or a JSON message
					if binaryMsg, ok := msg.(protocol.Message); ok {
						// Binary protocol message
						data, encodeErr := binaryMsg.Encode()
						if encodeErr != nil {
							log.Printf("Error encoding binary message: %v", encodeErr)
							continue
						}
						
						err = client.WriteMessage(websocket.BinaryMessage, data)
					} else if jsonMsg, ok := msg.(map[string]interface{}); ok {
						// JSON message
						data, encodeErr := json.Marshal(jsonMsg)
						if encodeErr != nil {
							log.Printf("Error encoding JSON message: %v", encodeErr)
							continue
						}
						
						err = client.WriteMessage(websocket.TextMessage, data)
					} else {
						log.Printf("Unknown message type: %T", msg)
						continue
					}
					if err != nil {
						log.Printf("Error writing message: %v", err)
						mu.Lock()
						client.Close()
						delete(clients, client)
						mu.Unlock()
						break
					} else {
						countMutex.Lock()
						messageCount++ // Safely increment the counter
						countMutex.Unlock()
					}
				}
			}
		}
	}()
	
	// Main message handling loop
	for {
		select {
		case msg := <-broadcast:
			// Add message to queue for batched processing
			messageQueue = append(messageQueue, msg)
		}
	}
}

func main() {
	http.HandleFunc("/ws", handleConnection)
	go handleMessages()
	
	fmt.Println("Server started on :8081")
	err := http.ListenAndServe("0.0.0.0:8081", nil)
	if err != nil {
		log.Fatal("ListenAndServe failed:", err)
	}
}
