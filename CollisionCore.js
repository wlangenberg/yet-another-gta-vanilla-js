class CollisionCore {
    // Static helper method for AABB collision check (used for broadphase testing)
    static staticCheckCollision(a, b) {
        return !(
            a.x >= b.x + b.width ||
            a.x + a.width <= b.x ||
            a.y >= b.y + b.height ||
            a.y + a.height <= b.y
        );
    }

    // Compute the broadphase box for the moving object over dt time.
    getBroadphaseBox(dt) {
        return {
            x: this.velocity.x > 0 ? this.x : this.x + this.velocity.x * dt,
            y: this.velocity.y > 0 ? this.y : this.y + this.velocity.y * dt,
            width: this.velocity.x > 0
                ? this.width + this.velocity.x * dt
                : this.width - this.velocity.x * dt,
            height: this.velocity.y > 0
                ? this.height + this.velocity.y * dt
                : this.height - this.velocity.y * dt
        };
    }

    // Swept AABB collision detection.
    // "this" is the moving object and "other" is treated as static.
    sweptAABB(other, dt = 1) {
        let xInvEntry, yInvEntry;
        let xInvExit, yInvExit;

        if (this.velocity.x > 0) {
            xInvEntry = other.x - (this.x + this.width);
            xInvExit = (other.x + other.width) - this.x;
        } else {
            xInvEntry = (other.x + other.width) - this.x;
            xInvExit = other.x - (this.x + this.width);
        }

        if (this.velocity.y > 0) {
            yInvEntry = other.y - (this.y + this.height);
            yInvExit = (other.y + other.height) - this.y;
        } else {
            yInvEntry = (other.y + other.height) - this.y;
            yInvExit = other.y - (this.y + this.height);
        }

        let xEntry, yEntry, xExit, yExit;
        if (this.velocity.x === 0) {
            xEntry = -Infinity;
            xExit = Infinity;
        } else {
            xEntry = xInvEntry / (this.velocity.x * dt);
            xExit = xInvExit / (this.velocity.x * dt);
        }

        if (this.velocity.y === 0) {
            yEntry = -Infinity;
            yExit = Infinity;
        } else {
            yEntry = yInvEntry / (this.velocity.y * dt);
            yExit = yInvExit / (this.velocity.y * dt);
        }

        const entryTime = Math.max(xEntry, yEntry);
        const exitTime = Math.min(xExit, yExit);

        // No collision if the entry time is not within [0,1] or if it comes after the exit.
        if (entryTime > exitTime || entryTime < 0 || entryTime > 1) {
            return { collision: false, entryTime: 1, normalX: 0, normalY: 0 };
        } else {
            let normalX = 0;
            let normalY = 0;
            if (xEntry > yEntry) {
                normalX = this.velocity.x < 0 ? 1 : -1;
            } else {
                normalY = this.velocity.y < 0 ? 1 : -1;
            }
            return { collision: true, entryTime, normalX, normalY };
        }
    }

    // A one-step collision resolution using swept AABB.
    // Moves the object up to the collision point, then slides it along the collision surface.
    handleCollision(other, dt = 1) {
        const broadphaseBox = this.getBroadphaseBox(dt);
        if (!CollisionCore.staticCheckCollision(broadphaseBox, other)) {
            // No collision predicted; move normally.
            this.x += this.velocity.x * dt;
            this.y += this.velocity.y * dt;
            return;
        }

        const result = this.sweptAABB(other, dt);
        if (result.collision) {
            // Move to the collision point.
            this.x += this.velocity.x * result.entryTime * dt;
            this.y += this.velocity.y * result.entryTime * dt;

            // Calculate sliding velocity (project the remaining movement onto the collision surface)
            const dot = this.velocity.x * result.normalX + this.velocity.y * result.normalY;
            const slideVel = {
                x: this.velocity.x - dot * result.normalX,
                y: this.velocity.y - dot * result.normalY
            };

            // Move the remaining time along the slide vector.
            const remainingTime = 1 - result.entryTime;
            this.x += slideVel.x * remainingTime * dt;
            this.y += slideVel.y * remainingTime * dt;

            // Update velocity.
            this.velocity.x = slideVel.x;
            this.velocity.y = slideVel.y;

            // If the collision came from above, set grounded.
            if (result.normalY === -1) {
                this.grounded = true;
            }
        } else {
            // No collision resolved; move normally.
            this.x += this.velocity.x * dt;
            this.y += this.velocity.y * dt;
        }
    }
}

export default CollisionCore;
