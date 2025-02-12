import { GameObject } from './game-object.js'

class Sun extends GameObject {
    constructor(x, y, width, height, ctx) {
        super(x, y, width, height, 'yellow', ctx, false);
        this.rayCount = 564;
        this.shadowColor = 'rgba(0, 0, 0, 0.6)';
        this.rayLength = 2100;
        this.shadowLength = this.rayLength;
        this.maxConnectionDistance = 1000;
        this.shadowBlur = 15;
    }

    castRays(objects) {
        const rays = [];
        const shadowOrigins = [];
        const angleStep = (Math.PI * 2) / this.rayCount;

        for (let i = 0; i < this.rayCount; i++) {
            const angle = i * angleStep;
            const ray = {
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                dx: Math.cos(angle),
                dy: Math.sin(angle)
            };

            let closestIntersection = null;
            let minDistance = Infinity;

            // Find intersection with objects
            for (const obj of objects) {
                if (obj === this) continue;
                const intersection = this.getRayIntersection(ray, obj);
                if (intersection && intersection.distance < minDistance) {
                    closestIntersection = intersection;
                    minDistance = intersection.distance;
                }
            }

            // If intersection found, store the ray and shadow origin
            if (closestIntersection) {
                rays.push({
                    start: { x: ray.x, y: ray.y },
                    end: closestIntersection
                });

                // Shadow extends downward
                const shadowEnd = {
                    x: closestIntersection.x,
                    y: closestIntersection.y + this.shadowLength
                };

                // Add shadow origin
                shadowOrigins.push({ x: closestIntersection.x, y: closestIntersection.y });
            }
        }

        return { rays, shadowOrigins };
    }

    getRayIntersection(ray, obj) {
        const x0 = obj.x;
        const y0 = obj.y;
        const x1 = obj.x + obj.width;
        const y1 = obj.y + obj.height;

        const x2 = ray.x;
        const y2 = ray.y;
        const dx = ray.dx;
        const dy = ray.dy;

        let intersections = [];

        if (dy !== 0) {
            // Intersection with top edge (y = y0)
            const tx = x2 + (y0 - y2) * dx / dy;
            if (tx >= x0 && tx <= x1) {
                intersections.push({ x: tx, y: y0 });
            }
            // Intersection with bottom edge (y = y1)
            const bx = x2 + (y1 - y2) * dx / dy;
            if (bx >= x0 && bx <= x1) {
                intersections.push({ x: bx, y: y1 });
            }
        }

        if (dx !== 0) {
            // Intersection with left edge (x = x0)
            const ty = y2 + (x0 - x2) * dy / dx;
            if (ty >= y0 && ty <= y1) {
                intersections.push({ x: x0, y: ty });
            }
            // Intersection with right edge (x = x1)
            const by = y2 + (x1 - x2) * dy / dx;
            if (by >= y0 && by <= y1) {
                intersections.push({ x: x1, y: by });
            }
        }

        let closestIntersection = null;
        let minDistance = Infinity;

        for (const intersection of intersections) {
            const distance = Math.sqrt(
                Math.pow(intersection.x - ray.x, 2) +
                Math.pow(intersection.y - ray.y, 2)
            );
            if (distance < minDistance) {
                closestIntersection = { ...intersection, distance };
                minDistance = distance;
            }
        }

        return closestIntersection;
    }

    drawShadows(ctx, shadowOrigins) {
        ctx.fillStyle = this.shadowColor;

        // Apply shadow blur to create softer shadows
        ctx.shadowBlur = this.shadowBlur;
        ctx.shadowColor = this.shadowColor;

        ctx.beginPath();

        // Connect shadow origins with a polygon to create a single shadow area
        for (let i = 0; i < shadowOrigins.length - 1; i++) {
            const startOrigin = shadowOrigins[i];
            const endOrigin = shadowOrigins[i + 1];

            // Only connect shadow origins that are within the allowed maximum distance
            const distance = Math.sqrt(
                Math.pow(endOrigin.x - startOrigin.x, 2) +
                Math.pow(endOrigin.y - startOrigin.y, 2)
            );

            if (distance <= this.maxConnectionDistance) {
                ctx.moveTo(startOrigin.x, startOrigin.y + this.shadowLength);
                ctx.lineTo(endOrigin.x, endOrigin.y + this.shadowLength);
                ctx.lineTo(endOrigin.x, endOrigin.y);
                ctx.lineTo(startOrigin.x, startOrigin.y);
                ctx.closePath();
            }
        }

        ctx.fill();
        ctx.shadowBlur = 0;  // Reset shadow blur for subsequent drawings
    }

    drawRays(ctx, rays) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 1;
        for (const ray of rays) {
            ctx.beginPath();
            ctx.moveTo(ray.start.x, ray.start.y);
            ctx.lineTo(ray.end.x, ray.end.y);
            ctx.stroke();
        }
    }

    update(interval, allGameObjects = [], spatialGrid) {
        super.update(interval, allGameObjects, spatialGrid);
        const { rays, shadowOrigins } = this.castRays(allGameObjects);
        // this.drawRays(this.ctx, rays);
        this.drawShadows(this.ctx, shadowOrigins);
    }
}

export { Sun };
