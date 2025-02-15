class CollisionCore {
    checkCollision(movableObject) {
        return !(
            movableObject.x >= this.x + this.width ||
            movableObject.x + movableObject.width <= this.x ||
            movableObject.y >= this.y + this.height ||
            movableObject.y + movableObject.height <= this.y
        )
    }

    checkBroadPhaseCollision(other) {
        const expandedX = this.velocity.x > 0 ? this.x : this.x + this.velocity.x
        const expandedY = this.velocity.y > 0 ? this.y : this.y + this.velocity.y
        const expandedWidth = this.velocity.x > 0 ? this.width + this.velocity.x : this.width - this.velocity.x
        const expandedHeight = this.velocity.y > 0 ? this.height + this.velocity.y : this.height - this.velocity.y

        return !(
            other.x >= expandedX + expandedWidth ||
            other.x + other.width <= expandedX ||
            other.y >= expandedY + expandedHeight ||
            other.y + other.height <= expandedY
        )
    }

    handleCollision(movableObject) {
        if (!this.checkCollision(movableObject)) {
            return
        }

        const bottomOverlap = movableObject.y + movableObject.height - this.y
        const topOverlap = this.y + this.height - movableObject.y

        if (movableObject.velocity.y > 0 && bottomOverlap > 0 && bottomOverlap < movableObject.height) {
            movableObject.y = this.y - movableObject.height
            movableObject.velocity.y = 0
            movableObject.grounded = true
        } 
        else if (movableObject.velocity.y < 0 && topOverlap > 0 && topOverlap < movableObject.height * 0.5) {
            movableObject.y = this.y + this.height
            movableObject.velocity.y = 0
        } 
        else {
            const middleX = this.x + this.width / 2
            if (movableObject.x + movableObject.width / 2 < middleX) {
                if (movableObject.height - (this.y - movableObject.y) <= movableObject.stepHeight) {
                    movableObject.velocity.y -= 0.005
                } 
                else {
                    movableObject.x = this.x - movableObject.width
                    if (this.hasGravity) {
                        this.velocity.x += movableObject.velocity.x
                    }
                    movableObject.velocity.x = 0
                }
            } 
            else {
                if (movableObject.height - (this.y - movableObject.y) <= movableObject.stepHeight) {
                    movableObject.velocity.y -= 0.005
                } 
                else {
                    movableObject.x = this.x + this.width
                    if (this.hasGravity) {
                        this.velocity.x += movableObject.velocity.x
                    }
                    movableObject.velocity.x = 0
                }
            }
        }
    }
}

export default CollisionCore