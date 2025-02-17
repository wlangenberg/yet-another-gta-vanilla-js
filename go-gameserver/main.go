package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

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

	broadcast <- Message{Type: "PlayerConnect"}
	fmt.Println("New player connected:", conn.RemoteAddr())

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

func handleMessages() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	var messageCount int
	var countMutex sync.Mutex // Mutex to protect messageCount

	go func() {
		for range ticker.C {
			countMutex.Lock()
			log.Printf("Messages sent per second: %d", messageCount)
			messageCount = 0 // Reset the counter
			countMutex.Unlock()
		}
	}()

	for {
		select {
		case msg := <-broadcast:
			mu.Lock()
			for client := range clients {
				err := client.WriteJSON(msg)
				if err != nil {
					log.Println("Error writing message:", err)
					client.Close()
					delete(clients, client)
				} else {
					countMutex.Lock()
					messageCount++ // Safely increment the counter
					countMutex.Unlock()
				}
			}
			mu.Unlock()
		}
	}
}

func main() {
	http.HandleFunc("/ws", handleConnection)
	go handleMessages()

	log.Println("Server started on :8081")
	err := http.ListenAndServe("0.0.0.0:8081", nil)
	if err != nil {
		log.Fatal("ListenAndServe failed:", err)
	}
}
