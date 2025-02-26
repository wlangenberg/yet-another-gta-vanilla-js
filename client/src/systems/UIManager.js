// UIManager.js - Manages UI elements like health bars, scoreboard, etc.

class UIManager {
    constructor() {
        this.container = null;
        this.scoreboard = null;
        this.timer = null;
        this.healthBars = new Map(); // Map of entity IDs to health bar elements
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;
        
        // Create main UI container
        this.container = document.createElement('div');
        this.container.id = 'game-ui';
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.pointerEvents = 'none'; // Don't interfere with game input
        document.body.appendChild(this.container);
        
        // Create scoreboard
        this.scoreboard = document.createElement('div');
        this.scoreboard.id = 'scoreboard';
        this.scoreboard.style.position = 'absolute';
        this.scoreboard.style.top = '10px';
        this.scoreboard.style.right = '10px';
        this.scoreboard.style.padding = '10px';
        this.scoreboard.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.scoreboard.style.color = 'white';
        this.scoreboard.style.fontFamily = 'monospace';
        this.scoreboard.style.fontSize = '14px';
        this.scoreboard.style.borderRadius = '5px';
        this.scoreboard.style.display = 'none'; // Hidden by default
        this.container.appendChild(this.scoreboard);
        
        // Create timer
        this.timer = document.createElement('div');
        this.timer.id = 'timer';
        this.timer.style.position = 'absolute';
        this.timer.style.top = '10px';
        this.timer.style.left = '50%';
        this.timer.style.transform = 'translateX(-50%)';
        this.timer.style.padding = '5px 15px';
        this.timer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.timer.style.color = 'white';
        this.timer.style.fontFamily = 'monospace';
        this.timer.style.fontSize = '18px';
        this.timer.style.borderRadius = '5px';
        this.timer.style.display = 'none'; // Hidden by default
        this.container.appendChild(this.timer);
        
        this.initialized = true;
    }

    updateScoreboard(scoreData) {
        if (!this.initialized) this.initialize();
        
        if (!scoreData || scoreData.length === 0) {
            this.scoreboard.style.display = 'none';
            return;
        }
        
        this.scoreboard.style.display = 'block';
        this.scoreboard.innerHTML = '<h3>Scoreboard</h3>';
        
        const table = document.createElement('table');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        
        // Create header row
        const headerRow = document.createElement('tr');
        const nameHeader = document.createElement('th');
        nameHeader.textContent = 'Player';
        nameHeader.style.textAlign = 'left';
        nameHeader.style.padding = '3px 10px';
        
        const scoreHeader = document.createElement('th');
        scoreHeader.textContent = 'Score';
        scoreHeader.style.textAlign = 'right';
        scoreHeader.style.padding = '3px 10px';
        
        headerRow.appendChild(nameHeader);
        headerRow.appendChild(scoreHeader);
        table.appendChild(headerRow);
        
        // Add player rows
        scoreData.forEach(player => {
            const row = document.createElement('tr');
            
            const nameCell = document.createElement('td');
            nameCell.textContent = player.name;
            nameCell.style.padding = '3px 10px';
            
            const scoreCell = document.createElement('td');
            scoreCell.textContent = player.score;
            scoreCell.style.textAlign = 'right';
            scoreCell.style.padding = '3px 10px';
            
            row.appendChild(nameCell);
            row.appendChild(scoreCell);
            table.appendChild(row);
        });
        
        this.scoreboard.appendChild(table);
    }

    updateTimer(timeRemaining) {
        if (!this.initialized) this.initialize();
        
        if (timeRemaining === Infinity || timeRemaining <= 0) {
            this.timer.style.display = 'none';
            return;
        }
        
        this.timer.style.display = 'block';
        
        // Format time as MM:SS
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        this.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateHealthBar(entity, camera) {
        if (!this.initialized) this.initialize();
        if (!entity.health || entity.health <= 0 || entity.isDead) return;
        
        // Calculate screen position
        const screenX = entity.x - camera.x;
        const screenY = entity.y - camera.y;
        
        // Check if entity is on screen
        if (
            screenX + entity.width < 0 ||
            screenX > camera.viewportWidth ||
            screenY + entity.height < 0 ||
            screenY > camera.viewportHeight
        ) {
            // Entity is off-screen, remove health bar if it exists
            if (this.healthBars.has(entity.id)) {
                const healthBar = this.healthBars.get(entity.id);
                healthBar.remove();
                this.healthBars.delete(entity.id);
            }
            return;
        }
        
        // Create or update health bar
        let healthBar;
        if (this.healthBars.has(entity.id)) {
            healthBar = this.healthBars.get(entity.id);
        } else {
            // Create health bar container
            healthBar = document.createElement('div');
            healthBar.style.position = 'absolute';
            healthBar.style.height = '5px';
            healthBar.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            healthBar.style.borderRadius = '2px';
            healthBar.style.overflow = 'hidden';
            
            // Create health fill
            const healthFill = document.createElement('div');
            healthFill.style.height = '100%';
            healthFill.style.width = '100%';
            healthFill.style.backgroundColor = '#2ecc71'; // Green
            healthBar.appendChild(healthFill);
            
            this.container.appendChild(healthBar);
            this.healthBars.set(entity.id, healthBar);
        }
        
        // Position health bar above entity
        const barWidth = entity.width * camera.zoom;
        healthBar.style.width = `${barWidth}px`;
        healthBar.style.left = `${screenX}px`;
        healthBar.style.top = `${screenY - 10}px`; // 10px above entity
        
        // Update health fill
        const healthFill = healthBar.firstChild;
        const healthPercent = (entity.health / entity.maxHealth) * 100;
        healthFill.style.width = `${healthPercent}%`;
        
        // Update color based on health percentage
        if (healthPercent > 60) {
            healthFill.style.backgroundColor = '#2ecc71'; // Green
        } else if (healthPercent > 30) {
            healthFill.style.backgroundColor = '#f39c12'; // Orange
        } else {
            healthFill.style.backgroundColor = '#e74c3c'; // Red
        }
    }

    clearHealthBars() {
        this.healthBars.forEach(healthBar => {
            healthBar.remove();
        });
        this.healthBars.clear();
    }

    showGameModeMessage(message, duration = 3000) {
        if (!this.initialized) this.initialize();
        
        const messageElement = document.createElement('div');
        messageElement.style.position = 'absolute';
        messageElement.style.top = '30%';
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translate(-50%, -50%)';
        messageElement.style.padding = '20px';
        messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        messageElement.style.color = 'white';
        messageElement.style.fontFamily = 'monospace';
        messageElement.style.fontSize = '24px';
        messageElement.style.borderRadius = '5px';
        messageElement.style.textAlign = 'center';
        messageElement.style.zIndex = '1000';
        messageElement.textContent = message;
        
        this.container.appendChild(messageElement);
        
        // Remove after duration
        setTimeout(() => {
            messageElement.remove();
        }, duration);
    }
}

// Create a singleton instance
const uiManager = new UIManager();
export default uiManager;
