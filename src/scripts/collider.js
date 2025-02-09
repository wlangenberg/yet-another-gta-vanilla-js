class Collider {
    static checkAABBCollision(objA, objB) {
        return (
            objA.x < objB.x + objB.width &&
            objA.x + objA.width > objB.x &&
            objA.y < objB.y + objB.height &&
            objA.y + objA.height > objB.y
        );
    }

    static handleCollisions(movingObject, staticObjects) {
        for (let obj of staticObjects) {
            if (this.checkAABBCollision(movingObject, obj)) {
                return obj; // Return the first object we collide with
            }
        }
        return null; // No collision detected
    }

    static raycastCollision(movingObject, staticObjects, velocity) {
        let futureX = movingObject.x + velocity.x;
        let futureY = movingObject.y + velocity.y;

        let tempObject = { ...movingObject, x: futureX, y: futureY };

        return this.handleCollisions(tempObject, staticObjects);
    }
}

export { Collider };
