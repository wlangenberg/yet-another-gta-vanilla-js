package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var (
	clients   = make(map[*websocket.Conn]Player) // Track players by connection
	broadcast = make(chan Message)               // Broadcast channel for player updates
	mu        sync.Mutex                         // Mutex for safe concurrent access
	upgrader  = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all connections (adjust for production)
		},
	}
)

// Player struct to hold the player state
type Player struct {
	Id        int     `json:"id"`
	Name      string  `json:"name"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Width     float64 `json:"width"`
	Height    float64 `json:"height"`
	Color     string  `json:"color"`
	Dy        float64 `json:"dy"`
	Speed     float64 `json:"speed"`
	Direction float64 `json:"direction"`
	JumpTimer int     `json:"jumpTimer"`
	Grounded  bool    `json:"grounded"`
}

// Message struct for sending different types of messages
type Message struct {
	Type   string  `json:"type"`             // "PlayerUpdate" or "PlayerDisconnect"
	Player *Player `json:"player,omitempty"` // Player data (for updates)
	Id     int     `json:"id,omitempty"`     // Player ID (for disconnections)
}

// Handle incoming WebSocket connections
func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading connection:", err)
		return
	}
	defer func() {
		mu.Lock()
		player, exists := clients[conn]
		if exists {
			delete(clients, conn)
			// Notify others of the disconnection
			broadcast <- Message{Type: "PlayerDisconnect", Id: player.Id}
		}
		mu.Unlock()
		conn.Close()
	}()

	// Send all existing players to the newly connected client
	mu.Lock()
	for _, player := range clients {
		err := conn.WriteJSON(Message{Type: "PlayerUpdate", Player: &player})
		if err != nil {
			log.Println("Error sending initial player list:", err)
			mu.Unlock()
			return
		}
	}
	mu.Unlock()

	// Read messages from the client
	for {
		var player Player
		err := conn.ReadJSON(&player)
		if err != nil {
			log.Println("Player disconnected:", err)
			mu.Lock()
			player, exists := clients[conn]
			if exists {
				delete(clients, conn)
				// Notify others of the disconnection
				broadcast <- Message{Type: "PlayerDisconnect", Id: player.Id}
			}
			mu.Unlock()
			break
		}

		// Store the player's updated state
		mu.Lock()
		clients[conn] = player
		mu.Unlock()

		// Broadcast updated player state
		broadcast <- Message{Type: "PlayerUpdate", Player: &player}
	}
}

// Broadcast messages to all clients
func handleMessages() {
	for {
		msg := <-broadcast
		fmt.Println("Broadcasting:", msg)

		mu.Lock()
		for client := range clients {
			err := client.WriteJSON(msg)
			if err != nil {
				log.Println("Error writing message:", err)
				client.Close()
				delete(clients, client)
			}
		}
		mu.Unlock()
	}
}

func main() {
	http.HandleFunc("/ws", handleConnection)
	go handleMessages()

	log.Println("Server started on :8081")
	err := http.ListenAndServe(":8081", nil)
	if err != nil {
		log.Fatal("ListenAndServe failed:", err)
	}
}
