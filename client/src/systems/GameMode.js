// GameMode.js - Manages different game modes and their rules

export const GAME_MODES = {
    FREE_PLAY: 'free_play',
    DEATH_MATCH: 'death_match',
    // Add more game modes here as needed
};

class GameMode {
    constructor(type = GAME_MODES.FREE_PLAY) {
        this.type = type;
        this.players = new Map(); // Map of player IDs to player data
        this.scores = new Map(); // Map of player IDs to scores
        this.timeLimit = 0; // Time limit in seconds (0 = no limit)
        this.scoreLimit = 0; // Score limit (0 = no limit)
        this.startTime = Date.now();
        this.isActive = false;
        this.respawnTime = 3; // Default respawn time in seconds
        
        // Initialize mode-specific settings
        this.initializeMode(type);
    }

    initializeMode(type) {
        switch(type) {
            case GAME_MODES.DEATH_MATCH:
                this.timeLimit = 300; // 5 minutes
                this.scoreLimit = 10; // First to 10 kills
                this.respawnTime = 3; // 3 seconds respawn
                break;
            case GAME_MODES.FREE_PLAY:
            default:
                // No specific settings for free play
                break;
        }
    }

    start() {
        this.isActive = true;
        this.startTime = Date.now();
        console.log(`Game mode ${this.type} started`);
    }

    end() {
        this.isActive = false;
        console.log(`Game mode ${this.type} ended`);
        return this.getWinner();
    }

    getWinner() {
        if (this.type === GAME_MODES.DEATH_MATCH) {
            let highestScore = 0;
            let winner = null;
            
            this.scores.forEach((score, playerId) => {
                if (score > highestScore) {
                    highestScore = score;
                    winner = playerId;
                }
            });
            
            return { winner, score: highestScore };
        }
        
        return null;
    }

    addPlayer(player) {
        this.players.set(player.id, player);
        this.scores.set(player.id, 0);
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        this.scores.delete(playerId);
    }

    recordKill(killerId, victimId) {
        if (this.type === GAME_MODES.DEATH_MATCH) {
            const currentScore = this.scores.get(killerId) || 0;
            this.scores.set(killerId, currentScore + 1);
            
            // Check if score limit reached
            if (this.scoreLimit > 0 && currentScore + 1 >= this.scoreLimit) {
                this.end();
            }
        }
    }

    getTimeRemaining() {
        if (this.timeLimit === 0) return Infinity;
        
        const elapsedTime = (Date.now() - this.startTime) / 1000;
        return Math.max(0, this.timeLimit - elapsedTime);
    }

    update() {
        if (!this.isActive) return;
        
        // Check time limit
        if (this.timeLimit > 0 && this.getTimeRemaining() <= 0) {
            this.end();
        }
    }

    getScoreboard() {
        const scoreboard = [];
        
        this.scores.forEach((score, playerId) => {
            const player = this.players.get(playerId);
            if (player) {
                scoreboard.push({
                    id: playerId,
                    name: player.name,
                    score
                });
            }
        });
        
        // Sort by score (highest first)
        scoreboard.sort((a, b) => b.score - a.score);
        
        return scoreboard;
    }
}

export default GameMode;
