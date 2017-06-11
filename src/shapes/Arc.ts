import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";
import { ICanvasContext } from "../TrackingContext";
import { getUnitQuadRoots, TAU, HALF_PI, THREE_HALF_PI, EPSILON } from "./MathLib";

export class Arc implements IShape {

    private controlX: number;
    private controlY: number;
    private endX: number;
    private endY: number;
    private radius: number;
    private centerX: number;
    private centerY: number;
    private tangent1X: number;
    private tangent1Y: number;
    private tangent2X: number;
    private tangent2Y: number;
    private startAngle: number;
    private endAngle: number;
    private weight: number;
    private clockwise: boolean;
    // AABB:
    private xMin: number;
    private xMax: number;
    private yMin: number;
    private yMax: number;

    constructor(startPointX: number, startPointY: number, cpX: number, cpY: number, endPointX: number, endPointY: number, radius: number) {
        this.radius = radius;
        this.controlX = cpX;
        this.controlY = cpY;
        this.endX = endPointX;
        this.endY = endPointY;
        this.getTangentPoints(startPointX, startPointY);
        this.getCenter();
        this.getAngles();
        this.calculateAABB();
    }
    
    render(context: ICanvasContext) {
        context.arcTo(this.controlX, this.controlY, this.endX, this.endY, this.radius);
    }

    getBounds() {
        return [this.xMin, this.yMin, this.xMax, this.yMax];
    }

    private calculateAABB() {
        this.presetAABB();
        if (this.clockwise) {
            if (!(this.startAngle >= Math.PI && this.endAngle < Math.PI)) {
                this.xMax = Math.max(this.tangent1X, this.tangent2X);
            }
            if (!((this.startAngle <= THREE_HALF_PI && this.endAngle >= THREE_HALF_PI) 
                || (this.startAngle >= THREE_HALF_PI && this.endAngle < this.startAngle && this.endAngle > THREE_HALF_PI))) { 
                this.yMin = Math.min(this.tangent1Y, this.tangent2Y); 
            }
            if (!(this.startAngle <= Math.PI && this.endAngle > Math.PI)) {
                this.xMin = Math.min(this.tangent1X, this.tangent2X);
            }
            if (!((this.startAngle <= HALF_PI && this.endAngle > HALF_PI) 
                || (this.startAngle >= HALF_PI && this.endAngle < this.startAngle && this.endAngle > HALF_PI))) { 
                this.yMax = Math.max(this.tangent1Y, this.tangent2Y); 
            }
        } else {
            if (!(this.startAngle <= Math.PI && this.endAngle > Math.PI)) {
                this.xMax = Math.max(this.tangent1X, this.tangent2X);
            }
            if (!((this.startAngle >= THREE_HALF_PI && this.endAngle < THREE_HALF_PI) 
                || (this.startAngle <= THREE_HALF_PI && this.endAngle > this.startAngle && this.endAngle < THREE_HALF_PI))) {
                this.yMin = Math.min(this.tangent1Y, this.tangent2Y);
            }
            if (!(this.startAngle >= Math.PI && this.endAngle < Math.PI)) {
                this.xMin = Math.min(this.tangent1X, this.tangent2X);
            }
            if (!((this.startAngle >= HALF_PI && this.endAngle < HALF_PI) || (this.startAngle <= HALF_PI && this.endAngle > this.startAngle && this.endAngle < HALF_PI))) {
                this.yMax = Math.max(this.tangent1Y, this.tangent2Y);
            }
        }
    }

    private presetAABB() {
        this.xMin = this.centerX - this.radius;
        this.xMax = this.centerX + this.radius;
        this.yMin = this.centerY - this.radius;
        this.yMax = this.centerY + this.radius;
    }

    private getTangentPoints(startPointX: number, startPointY: number) {
        let magTan1 = Math.sqrt((this.controlX - startPointX) * (this.controlX - startPointX) + (this.controlY - startPointY) * (this.controlY - startPointY));
        let magTan2 = Math.sqrt((this.endX - this.controlX) * (this.endX - this.controlX) + (this.endY - this.controlY) * (this.endY - this.controlY));
        let beforeX = (this.controlX - startPointX) / magTan1
        let beforeY = (this.controlY - startPointY) / magTan1;
        let afterX = (this.endX - this.controlX) / magTan2;
        let afterY = (this.endY - this.controlY) / magTan2;
        let dist =  this.radius * (1 - (beforeX * afterX + beforeY * afterY)) / (beforeX * afterY - beforeY * afterX);
        this.clockwise = dist >= 0;
        dist = Math.abs(dist);
        this.tangent1X = this.controlX - dist * beforeX;
        this.tangent1Y = this.controlY - dist * beforeY;
        this.tangent2X = this.controlX + dist * afterX;
        this.tangent2Y = this.controlY + dist * afterY;
        this.weight = Math.sqrt(0.5 + 0.5   *(beforeX * afterX + beforeY * afterY));
    }

    // Awesome explanation here: https://math.stackexchange.com/a/87374
    private getCenter() {
        let tx_dist = this.tangent2X - this.tangent1X;
        let ty_dist = this.tangent2Y - this.tangent1Y;
        let d = (tx_dist)*(tx_dist) + (ty_dist)*(ty_dist);
        let sqrt_d = Math.sqrt(d);
        let h = Math.sqrt(this.radius * this.radius - d/4);
        this.centerX = (this.tangent1X + this.tangent2X)/2 + (this.clockwise ? -1 : 1) * h * (ty_dist) / sqrt_d;
        this.centerY = (this.tangent1Y + this.tangent2Y)/2 - (this.clockwise ? -1 : 1) * h * (tx_dist) / sqrt_d;
    }

    private getAngles() {
        this.startAngle = Math.atan2(this.tangent1Y - this.centerY, this.tangent1X - this.centerX);
        this.endAngle = Math.atan2(this.tangent2Y - this.centerY, this.tangent2X - this.centerX);
        this.startAngle = (TAU + this.startAngle) % TAU;
        this.endAngle = (TAU + this.endAngle) % TAU;
    }

    getStartPoint(): [number, number] {
        return [this.tangent1X, this.tangent1Y];
    }

    getEndPoint(): [number, number] {
        return [this.tangent2X, this.tangent2Y];
    }

    intersects(rect: [number,number,number,number]) {
        if (!(this.centerX > rect[0] - this.radius && this.centerY > rect[1] - this.radius && 
            this.centerX < rect[0] + rect[2] + this.radius && this.centerY < rect[1] + rect[3] + this.radius)) {
            return false;
        }
        // Translate rect so that circle is centred at 0,0
        let r0 = rect[0] - this.centerX;
        let r1 = rect[1] - this.centerY;
        // bottom line
        if (this.intersectsSegment(r0, r0 + rect[2], r1 + rect[3], true)) return true;
        // right line
        if (this.intersectsSegment(r1, r1 + rect[3], r0 + rect[2], false)) return true;
        // top line
        if (this.intersectsSegment(r0, r0 + rect[2], r1, true)) return true;
        // left line
        if (this.intersectsSegment(r1, r1 + rect[3], r0, false)) return true;
        return false;
    }

    private intersectsSegment(startPoint: number, endPoint: number, axisDistance: number, horizontal: boolean) {
        // x^2 + y^2 = r^2
        // y = mx + c with m = 0 => y = c = axisDistance
        // x^2 + axisDistance^2 = r^2, x = sqrt(r^2 - axisDistance^2)
        if (this.radius < Math.abs(axisDistance)) return false;
        let intcpt = Math.sqrt(this.radius * this.radius - axisDistance * axisDistance);
        if (this.betweenArc(horizontal ? Math.atan2(axisDistance, intcpt) : Math.atan2(intcpt, axisDistance)) && intcpt >= startPoint && intcpt <= endPoint) return true;
        if (this.betweenArc(horizontal ? Math.atan2(axisDistance, -intcpt) : Math.atan2(-intcpt, axisDistance)) && -intcpt >= startPoint && -intcpt <= endPoint) return true;
        return false;
    }

    private betweenArc(angle: number) {
        angle = (TAU + (angle % TAU)) % TAU;
        if(this.startAngle <= this.endAngle) {
            if(this.endAngle - this.startAngle <= Math.PI) {
                return this.startAngle <= angle && angle <= this.endAngle;
            } else {
                return this.endAngle <= angle || angle <= this.startAngle;
            }
        } else {
            if(this.startAngle - this.endAngle <= Math.PI) {
                return this.endAngle <= angle && angle <= this.startAngle;
            } else {
                return this.startAngle <= angle || angle <= this.endAngle;
            }
        }
    }

}