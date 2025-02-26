package protocol

import (
	"fmt"
	"math"
)

// SpatialGrid is a simple spatial partitioning system for efficient entity queries
type SpatialGrid struct {
	cellSize  float32
	cells     map[string]map[int32]bool
	positions map[int32]Position
}

// Position represents an entity's position in the world
type Position struct {
	X, Y float32
}

// NewSpatialGrid creates a new spatial grid with the specified cell size
func NewSpatialGrid(cellSize float32) *SpatialGrid {
	return &SpatialGrid{
		cellSize:  cellSize,
		cells:     make(map[string]map[int32]bool),
		positions: make(map[int32]Position),
	}
}

// getCellKey returns the key for a cell at the given coordinates
func (g *SpatialGrid) getCellKey(x, y float32) string {
	cellX := int(math.Floor(float64(x / g.cellSize)))
	cellY := int(math.Floor(float64(y / g.cellSize)))
	return fmt.Sprintf("%d:%d", cellX, cellY)
}

// Insert adds an entity to the grid
func (g *SpatialGrid) Insert(id int32, x, y float32) {
	// Remove from old position if exists
	g.Remove(id)

	// Store new position
	g.positions[id] = Position{X: x, Y: y}

	// Get cell key
	key := g.getCellKey(x, y)

	// Create cell if it doesn't exist
	if _, exists := g.cells[key]; !exists {
		g.cells[key] = make(map[int32]bool)
	}

	// Add entity to cell
	g.cells[key][id] = true
}

// Remove removes an entity from the grid
func (g *SpatialGrid) Remove(id int32) {
	// Check if entity exists in the grid
	pos, exists := g.positions[id]
	if !exists {
		return
	}

	// Get cell key
	key := g.getCellKey(pos.X, pos.Y)

	// Remove entity from cell
	if cell, exists := g.cells[key]; exists {
		delete(cell, id)
		
		// Remove cell if empty
		if len(cell) == 0 {
			delete(g.cells, key)
		}
	}

	// Remove position
	delete(g.positions, id)
}

// GetNearbyEntities returns all entities within the specified radius of a point
func (g *SpatialGrid) GetNearbyEntities(x, y, radius float32) []int32 {
	result := make([]int32, 0)
	radiusSquared := radius * radius

	// Calculate cell range to check
	minCellX := int(math.Floor(float64((x - radius) / g.cellSize)))
	maxCellX := int(math.Floor(float64((x + radius) / g.cellSize)))
	minCellY := int(math.Floor(float64((y - radius) / g.cellSize)))
	maxCellY := int(math.Floor(float64((y + radius) / g.cellSize)))

	// Check all cells in range
	for cellX := minCellX; cellX <= maxCellX; cellX++ {
		for cellY := minCellY; cellY <= maxCellY; cellY++ {
			key := fmt.Sprintf("%d:%d", cellX, cellY)
			
			// Skip if cell doesn't exist
			if cell, exists := g.cells[key]; exists {
				// Check all entities in cell
				for id := range cell {
					pos := g.positions[id]
					
					// Calculate distance squared
					dx := pos.X - x
					dy := pos.Y - y
					distanceSquared := dx*dx + dy*dy
					
					// Add entity if within radius
					if distanceSquared <= radiusSquared {
						result = append(result, id)
					}
				}
			}
		}
	}

	return result
}

// GetPosition returns the position of an entity
func (g *SpatialGrid) GetPosition(id int32) (Position, bool) {
	pos, exists := g.positions[id]
	return pos, exists
}

// Clear removes all entities from the grid
func (g *SpatialGrid) Clear() {
	g.cells = make(map[string]map[int32]bool)
	g.positions = make(map[int32]Position)
}
