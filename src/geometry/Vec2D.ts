export class Vec2D {

    static readonly Zero = new Vec2D(0, 0);

    constructor(public readonly dx: number, public readonly dy: number) { }

    add(other: Vec2D): Vec2D {
        return new Vec2D(this.dx + other.dx, this.dy + other.dy);
    }

    mul(m: number): Vec2D {
        return new Vec2D(this.dx * m, this.dy * m);
    }

    get length(): number {
        return Math.hypot(this.dx, this.dy);
    }

    get unit(): Vec2D {
        const len = this.length;
        if (len === 0)
            return Vec2D.Zero;
        return new Vec2D(this.dx / len, this.dy / len);
    }

    dot(other: Vec2D): number {
        return this.dx * other.dx + this.dy * other.dy;
    }

    get right90(): Vec2D {
        return new Vec2D(this.dy, -this.dx);
    }
}
