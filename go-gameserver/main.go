package main

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var clients = make(map[*websocket.Conn]bool) // Track connected clients
var broadcast = make(chan Player)            // Broadcast incoming player states
var mu sync.Mutex                            // Mutex to protect concurrent map access

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

// Handle each incoming WebSocket connection
func handleConnection(w http.ResponseWriter, r *http.Request) {
	// Create an Upgrader instance
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all connections (for simplicity, change in production)
		},
	}

	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading connection:", err)
		return
	}
	defer conn.Close()

	// Add the client to the map of connected clients
	mu.Lock()
	clients[conn] = true
	mu.Unlock()

	// Start reading messages from the client
	for {
		var player Player
		// Read the incoming player state
		err := conn.ReadJSON(&player)
		if err != nil {
			log.Println("Error reading message:", err)
			// Remove client from map on error
			mu.Lock()
			delete(clients, conn)
			mu.Unlock()
			break
		}

		// Broadcast the player state to all connected clients
		broadcast <- player
	}
}

// Broadcast player state to all connected clients
func handleMessages() {
	for {
		// Get the next player state from the broadcast channel
		player := <-broadcast
		fmt.Println("Broadcasting player state:", player)

		// Send the player state to all connected clients
		mu.Lock()
		for client := range clients {
			err := client.WriteJSON(player)
			if err != nil {
				log.Println("Error writing message to client:", err)
				client.Close()
				delete(clients, client)
			}
		}
		mu.Unlock()
	}
}

func main() {
	// Set up the WebSocket endpoint
	http.HandleFunc("/ws", handleConnection)

	// Start the message broadcasting in a separate goroutine
	go handleMessages()

	// Start the server on port 8081
	log.Println("Server started on :8081")
	err := http.ListenAndServe(":8081", nil)
	if err != nil {
		log.Fatal("ListenAndServe failed:", err)
	}
}
