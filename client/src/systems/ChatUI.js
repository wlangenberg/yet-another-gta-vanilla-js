// ChatUI.js - Simple chat UI for the game

import socket from './sockets.js';
import { STATE } from '../configuration/constants.js';

class ChatUI {
    constructor() {
        this.container = null;
        this.chatBox = null;
        this.chatInput = null;
        this.chatForm = null;
        this.isVisible = false;
        this.initialized = false;
        this.chatToggleKey = 'KeyT'; // Press T to toggle chat
        this.chatCloseKey = 'Escape'; // Press Escape to close chat
        
        // Bind methods
        this.toggleChat = this.toggleChat.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.updateChat = this.updateChat.bind(this);
    }
    
    initialize() {
        if (this.initialized) return;
        
        // Create chat container
        this.container = document.createElement('div');
        this.container.id = 'chat-container';
        this.container.style.position = 'absolute';
        this.container.style.bottom = '10px';
        this.container.style.left = '10px';
        this.container.style.width = '300px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.borderRadius = '5px';
        this.container.style.padding = '10px';
        this.container.style.display = 'none';
        this.container.style.zIndex = '1000';
        
        // Create chat box
        this.chatBox = document.createElement('div');
        this.chatBox.id = 'chat-box';
        this.chatBox.style.height = '150px';
        this.chatBox.style.overflowY = 'auto';
        this.chatBox.style.marginBottom = '10px';
        this.chatBox.style.color = 'white';
        this.chatBox.style.fontFamily = 'monospace';
        this.chatBox.style.fontSize = '14px';
        this.container.appendChild(this.chatBox);
        
        // Create chat form
        this.chatForm = document.createElement('form');
        this.chatForm.id = 'chat-form';
        this.chatForm.style.display = 'flex';
        this.chatForm.addEventListener('submit', this.handleSubmit);
        
        // Create chat input
        this.chatInput = document.createElement('input');
        this.chatInput.id = 'chat-input';
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'Type a message...';
        this.chatInput.style.flex = '1';
        this.chatInput.style.padding = '5px';
        this.chatInput.style.borderRadius = '3px';
        this.chatInput.style.border = 'none';
        this.chatInput.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        this.chatForm.appendChild(this.chatInput);
        
        // Create send button
        const sendButton = document.createElement('button');
        sendButton.type = 'submit';
        sendButton.textContent = 'Send';
        sendButton.style.marginLeft = '5px';
        sendButton.style.padding = '5px 10px';
        sendButton.style.borderRadius = '3px';
        sendButton.style.border = 'none';
        sendButton.style.backgroundColor = '#4CAF50';
        sendButton.style.color = 'white';
        sendButton.style.cursor = 'pointer';
        this.chatForm.appendChild(sendButton);
        
        this.container.appendChild(this.chatForm);
        document.body.appendChild(this.container);
        
        // Add event listeners
        window.addEventListener('keydown', this.handleKeyDown);
        
        // Start chat update interval
        setInterval(this.updateChat, 1000);
        
        this.initialized = true;
    }
    
    toggleChat() {
        if (!this.initialized) this.initialize();
        
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'block' : 'none';
        
        if (this.isVisible) {
            this.chatInput.focus();
            this.updateChat();
        }
    }
    
    handleKeyDown(event) {
        // Toggle chat with T key
        if (event.code === this.chatToggleKey && !this.isVisible) {
            event.preventDefault();
            this.toggleChat();
        }
        
        // Close chat with Escape key
        if (event.code === this.chatCloseKey && this.isVisible) {
            event.preventDefault();
            this.toggleChat();
        }
    }
    
    handleSubmit(event) {
        event.preventDefault();
        
        const message = this.chatInput.value.trim();
        if (message && STATE.myPlayer) {
            // Send message to server
            socket.sendChatMessage(message);
            
            // Clear input
            this.chatInput.value = '';
        }
    }
    
    updateChat() {
        if (!this.initialized || !this.isVisible) return;
        
        const messages = socket.getChatMessages();
        if (!messages || messages.length === 0) return;
        
        // Clear chat box
        this.chatBox.innerHTML = '';
        
        // Add messages
        messages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.style.marginBottom = '5px';
            
            // Format timestamp
            const date = new Date(msg.timestamp);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            
            // Format message
            messageElement.innerHTML = `<span style="color: #aaa;">[${timeString}]</span> <span style="color: #4CAF50;">${msg.playerName}:</span> ${msg.message}`;
            
            this.chatBox.appendChild(messageElement);
        });
        
        // Scroll to bottom
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }
}

// Create a singleton instance
const chatUI = new ChatUI();
export default chatUI;
