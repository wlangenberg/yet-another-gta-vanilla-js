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

var (
	clients     = make(map[*websocket.Conn]*ClientState) // Track clients by connection
	broadcast   = make(chan protocol.Message)            // Broadcast channel for messages
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
	
	// Create a new client state
	clientID := nextPlayerID
	nextPlayerID++
	
	clientState := &ClientState{
		Player: protocol.Player{
			ID:        clientID,
			Name:      "Player" + strconv.Itoa(int(clientID)),
			Health:    100,
			MaxHealth: 100,
			IsDead:    false,
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
		broadcast <- protocol.BroadcastPlayerLeaveMessage{PlayerID: clientID}
		
		conn.Close()
		log.Printf("Player %d disconnected", clientID)
	}()
	
	// Notify other clients that a new player has joined
	broadcast <- protocol.BroadcastPlayerJoinMessage{PlayerID: clientID}
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
	
	// Collect all players
	players := make([]protocol.Player, 0, len(clients))
	for _, client := range clients {
		if client.Conn != conn { // Don't include the new client
			players = append(players, client.Player)
		}
	}
	
	// Create and send the initial state message
	initialState := protocol.InitialStateMessage{
		Players: players,
	}
	
	data, err := initialState.Encode()
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
		// Update the player's state
		m.Player.ID = clientState.Player.ID // Ensure the ID doesn't change
		m.Player.Name = clientState.Player.Name // Ensure the name doesn't change
		
		mu.Lock()
		// Update player state
		clientState.Player = m.Player
		mu.Unlock()
		
		// Broadcast the update to all clients
		broadcast <- protocol.BroadcastPlayerUpdateMessage{
			Player: m.Player,
		}
		
	case protocol.ChatMessageMessage:
		// Validate the message
		if m.Chat.PlayerID != clientState.Player.ID {
			log.Printf("Player %d tried to send a chat message as player %d", clientState.Player.ID, m.Chat.PlayerID)
			return
		}
		
		// Broadcast the chat message to all clients
		broadcast <- protocol.BroadcastChatMessageMessage{
			Chat: m.Chat,
		}
		
	case protocol.GunFireMessage:
		// Validate the message
		if m.Fire.PlayerID != clientState.Player.ID {
			log.Printf("Player %d tried to fire a gun as player %d", clientState.Player.ID, m.Fire.PlayerID)
			return
		}
		
		// Broadcast the gun fire to all clients
		broadcast <- protocol.BroadcastGunFireMessage{
			Fire: m.Fire,
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
		
		// Apply damage to the target player
		mu.Lock()
		if !targetClient.Player.IsDead {
			targetClient.Player.Health -= m.Hit.Damage
			if targetClient.Player.Health <= 0 {
				targetClient.Player.Health = 0
				targetClient.Player.IsDead = true
				
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
							
							// Broadcast the update
							broadcast <- protocol.BroadcastPlayerUpdateMessage{
								Player: client.Player,
							}
							break
						}
					}
				}(m.Hit.TargetID)
			}
		}
		mu.Unlock()
		
		// Broadcast the hit to all clients
		broadcast <- protocol.BroadcastHitReportMessage{
			Hit: m.Hit,
		}
		
		// Broadcast the updated target player state
		mu.Lock()
		broadcast <- protocol.BroadcastPlayerUpdateMessage{
			Player: targetClient.Player,
		}
		mu.Unlock()
		
	case protocol.PlatformDestroyMessage:
		// Validate the message
		if m.Destroy.ShooterID != clientState.Player.ID {
			log.Printf("Player %d tried to destroy a platform as player %d", clientState.Player.ID, m.Destroy.ShooterID)
			return
		}
		
		// Broadcast the platform destruction to all clients
		broadcast <- protocol.BroadcastPlatformDestroyMessage{
			Destroy: m.Destroy,
		}
		
	case protocol.FragmentCreateMessage:
		// Validate the message
		if m.Fragment.OriginalEntityID == 0 {
			log.Printf("Player %d tried to create a fragment with invalid original entity ID", clientState.Player.ID)
			return
		}
		
		// Broadcast the fragment creation to all clients
		broadcast <- protocol.BroadcastFragmentCreateMessage{
			Fragment: m.Fragment,
		}
		
	case protocol.FragmentDestroyMessage:
		// Validate the message
		if m.Destroy.FragmentID == 0 {
			log.Printf("Player %d tried to destroy a fragment with invalid ID", clientState.Player.ID)
			return
		}
		
		// Broadcast the fragment destruction to all clients
		broadcast <- protocol.BroadcastFragmentDestroyMessage{
			Destroy: m.Destroy,
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
	
	// Extract player data

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
	broadcast <- protocol.BroadcastPlayerUpdateMessage{
		Player: clientState.Player,
	}
}

// Handle broadcasting messages to all clients with optimizations
func handleMessages() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	var messageCount int
	var countMutex sync.Mutex // Mutex to protect messageCount
	
	// Message batching
	const batchInterval = 50 * time.Millisecond
	batchTicker := time.NewTicker(batchInterval)
	defer batchTicker.Stop()
	
	// Message queue for batching
	messageQueue := make([]protocol.Message, 0, 100)
	
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
			messageQueue = make([]protocol.Message, 0, 100) // Reset queue
			clientMap := make(map[*websocket.Conn]*ClientState)
			
			// Create a copy of the clients map to avoid holding the lock
			for client, state := range clients {
				clientMap[client] = state
			}
			mu.Unlock()
			
			// Group messages by client to reduce the number of WebSocket writes
			clientMessages := make(map[*websocket.Conn][]protocol.Message)
			
			// Organize messages by client
			for _, msg := range localQueue {
				switch m := msg.(type) {
				case protocol.BroadcastPlayerUpdateMessage:
					// Send player updates to all clients except the player themselves
					playerID := m.Player.ID
					
					for client, state := range clientMap {
						// Skip sending updates about a player to themselves
						if state.Player.ID == playerID {
							continue
						}
						
						clientMessages[client] = append(clientMessages[client], m)
					}
				
				case protocol.BroadcastPlayerJoinMessage, protocol.BroadcastPlayerLeaveMessage,
					 protocol.BroadcastChatMessageMessage, protocol.BroadcastGunFireMessage,
					 protocol.BroadcastHitReportMessage, protocol.BroadcastPlatformDestroyMessage,
					 protocol.BroadcastFragmentCreateMessage, protocol.BroadcastFragmentDestroyMessage:
					// These messages are sent to all clients
					for client := range clientMap {
						clientMessages[client] = append(clientMessages[client], m)
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
					data, err := msg.Encode()
					if err != nil {
						log.Printf("Error encoding message: %v", err)
						continue
					}
					
					err = client.WriteMessage(websocket.BinaryMessage, data)
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
