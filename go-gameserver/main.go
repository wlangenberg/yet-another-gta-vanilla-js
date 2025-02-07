package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var clients = make(map[*websocket.Conn]bool) // Track connected clients
var broadcast = make(chan Message)           // Broadcast incoming messages

// Message struct to hold the incoming message format
type Message struct {
	Player string `json:"player"`
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
	clients[conn] = true

	// Start reading messages from the client
	for {
		var msg Message
		// Read the incoming message as text

		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Println("Error reading message:", err)
			delete(clients, conn)
			break
		}
		// Send the message to the broadcast channel
		broadcast <- msg
	}
}

// Broadcast messages to all connected clients
func handleMessages() {
	for {
		// Get the next message from the broadcast channel
		msg := <-broadcast
		fmt.Println("Message received: ", msg)
		// Send the message to all connected clients
		for client := range clients {
			err := client.WriteJSON(msg)
			if err != nil {
				log.Println("Error writing message to client:", err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

func main() {
	// Set up the WebSocket endpoint
	http.HandleFunc("/ws", handleConnection)

	// Start the message broadcasting in a separate goroutine
	go handleMessages()

	// Start the server on port 8080
	log.Println("Server started on :8081")
	err := http.ListenAndServe("0.0.0.0:8081", nil)
	if err != nil {
		log.Fatal("ListenAndServe failed:", err)
	}
}
