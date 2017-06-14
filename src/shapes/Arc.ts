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
        [this.startAngle, this.endAngle] = this.getAngles(this.tangent1X, this.tangent1Y, this.tangent2X, this.tangent2Y);
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

    private getAngles(t1x: number, t1y: number, t2x: number, t2y: number) {
        let angles: number[] = [0,0];
        angles[0] = Math.atan2(t1y - this.centerY, t1x - this.centerX);
        angles[1] = Math.atan2(t2y - this.centerY, t2x - this.centerX);
        angles[0] = (TAU + angles[0]) % TAU;
        angles[1] = (TAU + angles[1]) % TAU;
        return angles;
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
        if (this.intersectsSegment(r0, r0 + rect[2], r1 + rect[3], this.startAngle, this.endAngle, true)) return true;
        // right line
        if (this.intersectsSegment(r1, r1 + rect[3], r0 + rect[2], this.startAngle, this.endAngle, false)) return true;
        // top line
        if (this.intersectsSegment(r0, r0 + rect[2], r1, this.startAngle, this.endAngle, true)) return true;
        // left line
        if (this.intersectsSegment(r1, r1 + rect[3], r0, this.startAngle, this.endAngle, false)) return true;
        return false;
    }

    windingNumber(point: [number, number]) {
        let isMono = (this.tangent1X <= this.centerX && this.tangent2X >= this.centerX);
        if (!isMono) {
            return this.monoWind(point, this.tangent1X, this.tangent1Y, this.tangent2X, this.tangent2Y);
        } else {
            let yVal = (this.tangent1Y === this.yMax || this.tangent2Y === this.yMax) ? this.yMin : this.yMax;
            return this.monoWind(point, this.tangent1X, this.tangent1Y, this.centerX, yVal) + this.monoWind(point, this.centerX, yVal, this.tangent2X, this.tangent2Y);
        }
    }

    private monoWind(point: [number, number], t1x: number, t1y: number, t2x: number, t2y: number) {
        let wn = 1;
        if (t1y > t2y) {
            if (point[1] < t2y || point[1] >= t1y) return 0;
            wn = -1;
        } else {
            if (point[1] < t1y || point[1] >= t2y) return 0;
        }
        // Nearly sure the below can be done in a cleverer way
        let angles = this.getAngles(t1x, t1y, t2x, t2y);
        return (this.intersectsSegment(-Infinity, point[0] - this.centerX, point[1] - this.centerY, angles[0], angles[1], true)) ? wn : 0;
    }

    private intersectsSegment(startPoint: number, endPoint: number, axisDistance: number, startAngle: number, endAngle: number, horizontal: boolean) {
        // x^2 + y^2 = r^2
        // y = mx + c with m = 0 => y = c = axisDistance
        // x^2 + axisDistance^2 = r^2, x = sqrt(r^2 - axisDistance^2)
        if (this.radius < Math.abs(axisDistance)) return false;
        let intcpt = Math.sqrt(this.radius * this.radius - axisDistance * axisDistance);
        if (this.betweenArc(horizontal ? Math.atan2(axisDistance, intcpt) : Math.atan2(intcpt, axisDistance), startAngle, endAngle) && intcpt >= startPoint && intcpt <= endPoint) return true;
        if (this.betweenArc(horizontal ? Math.atan2(axisDistance, -intcpt) : Math.atan2(-intcpt, axisDistance), startAngle, endAngle) && -intcpt >= startPoint && -intcpt <= endPoint) return true;
        return false;
    }

    private betweenArc(angle: number, startAngle: number, endAngle: number) {
        angle = (TAU + (angle % TAU)) % TAU;
        if(startAngle <= endAngle) {
            if(endAngle - startAngle <= Math.PI) {
                return startAngle <= angle && angle <= endAngle;
            } else {
                return endAngle <= angle || angle <= startAngle;
            }
        } else {
            if(startAngle - endAngle <= Math.PI) {
                return endAngle <= angle && angle <= startAngle;
            } else {
                return startAngle <= angle || angle <= endAngle;
            }
        }
    }

}