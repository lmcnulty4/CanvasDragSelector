import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";
import { ICanvasContext } from "../TrackingContext";

export class CubicBezierCurve implements IShape {

    // These P0, P1, P2 and P3 are from the cubic x = P0(t^3) + P1(t^2) + P2(t) + P3 (and similarly for y)
    // P3X === startX, P3Y === startY
    private p0x: number;
    private p0y: number;
    private p1x: number;
    private p1y: number;
    private p2x: number;
    private p2y: number;
    // For initial checks - if any of these is inside rect then it intersects
    private startX: number;
    private startY: number;
    private endX: number;
    private endY: number;
    // AABB:
    private xMin: number;
    private xMax: number;
    private yMin: number;
    private yMax: number;
    // Intersection coefficients
    private qX: number;
    private qY: number;
    private rX: number;
    private rY: number;
    // For re-rendering
    private controlPoint1X: number;
    private controlPoint1Y: number;
    private controlPoint2X: number;
    private controlPoint2Y: number;

    constructor(startPointX: number, startPointY: number, controlPoint1X: number, controlPoint1Y: number, controlPoint2X: number, controlPoint2Y: number, endPointX: number, endPointY: number) {
        this.p0x = (-startPointX + 3*controlPoint1X + -3*controlPoint2X + endPointX);
        this.p0y = (-startPointY + 3*controlPoint1Y + -3*controlPoint2Y + endPointY);
        this.p1x = (3*startPointX - 6*controlPoint1X + 3*controlPoint2X);
        this.p1y = (3*startPointY - 6*controlPoint1Y + 3*controlPoint2Y);
        this.p2x = (-3*startPointX + 3*controlPoint1X);
        this.p2y = (-3*startPointY + 3*controlPoint1Y);
        this.startX = startPointX;
        this.startY = startPointY;
        this.endX = endPointX;
        this.endY = endPointY;
        this.qX = (3 * this.p0x * this.p2x - this.p1x * this.p1x) / (9 * this.p0x * this.p0x);
        this.qY = (3 * this.p0y * this.p2y - this.p1y * this.p1y) / (9 * this.p0y * this.p0y);
        this.rX = (9 * this.p0x * this.p1x * this.p2x - 27 * this.p0x * this.p0x * this.startX - 2 * this.p1x * this.p1x * this.p1x) / (54 * this.p0x * this.p0x * this.p0x);
        this.rY = (9 * this.p0y * this.p1y * this.p2y - 27 * this.p0y * this.p0y * this.startY - 2 * this.p1y * this.p1y * this.p1y) / (54 * this.p0y * this.p0y * this.p0y);
        this.calculateAABB(startPointX, startPointY, controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y, endPointX, endPointY);
    }

    render(context: ICanvasContext) {
        context.bezierCurveTo(this.controlPoint1X, this.controlPoint1Y, this.controlPoint2X, this.controlPoint2Y, this.endX, this.endY);
    }

    getEndPoint() : [number, number] {
        return [this.endX, this.endY];
    }

    // Note: In 1 dimension only
    private evaluateBezier(startPoint:number, controlPoint1: number, controlPoint2: number, endPoint: number, t: number) {
        return startPoint * (1 - t) * (1 - t) * (1 - t) + 3 * controlPoint1 * t * (1 - t) * (1 - t) + 3 * controlPoint2 * t * t * (1 - t) + endPoint * t * t * t;
    }

    // https://pomax.github.io/bezierinfo/#boundingbox
    // https://pomax.github.io/bezierinfo/#extremities
    private calculateAABB(startPointX: number, startPointY: number, controlPoint1X: number, controlPoint1Y: number, controlPoint2X: number, controlPoint2Y: number, endPointX: number, endPointY: number) {
        // Derivative and get roots
        let aX = 3 * this.p0x, aY = 3 * this.p0y;
        let bX = 2 * this.p1x, bY = 2 * this.p1y;
        let cX = this.p2x, cY = this.p2y;
        // initialise mins and maxes
        this.xMin = endPointX < startPointX ? endPointX : startPointX, this.xMax = endPointX > startPointX ? endPointX : startPointX;
        this.yMin = endPointY < startPointY ? endPointY : startPointY, this.yMax = endPointY > startPointY ? endPointY : startPointY;
        // roots where (-b +- sqrt(b*b - 4*a*c)) / 2*a = 0
        let discX = bX * bX - 4 * aX * cX, discY = bY * bY - 4 * aY * cY;
        if (discX >= 0) {
            let t1 = (-bX + Math.sqrt(discX)) / (2*aX), t2 = (-bX - Math.sqrt(discX)) / (2*aX); // from 
            if (t1 > 0 && t1 < 1) {
                let xt = this.evaluateBezier(startPointX, controlPoint1X, controlPoint2X, endPointX, t1);
                if (xt < this.xMin) this.xMin = xt;
                if (xt > this.xMax) this.xMax = xt;
            }
            if (t2 > 0 && t2 < 1) {
                let xt = this.evaluateBezier(startPointX, controlPoint1X, controlPoint2X, endPointX, t2);
                if (xt < this.xMin) this.xMin = xt;
                if (xt > this.xMax) this.xMax = xt;
            }
        }
        if (discY >= 0) {
            let t1 = (-bY + Math.sqrt(discY)) / (2*aY), t2 = (-bY - Math.sqrt(discY)) / (2*aY);
            if (t1 > 0 && t1 < 1) {
                let xt = this.evaluateBezier(startPointY, controlPoint1Y, controlPoint2Y, endPointY, t1);
                if (xt < this.yMin) this.yMin = xt;
                if (xt > this.yMax) this.yMax = xt;
            }
            if (t2 > 0 && t2 < 1) {
                let xt = this.evaluateBezier(startPointY, controlPoint1Y, controlPoint2Y, endPointY, t2);
                if (xt < this.yMin) this.yMin = xt;
                if (xt > this.yMax) this.yMax = xt;
            }
        }
    }

    intersects(rect: [number, number, number, number]): boolean {
        // If either start or end point is inside rect, it intersects
        if (rect[0] <= this.startX && rect[0] + rect[2] >= this.startX && rect[1] <= this.startY && rect[1] + rect[3] >= this.startY) return true;
        if (rect[0] <= this.endX && rect[0] + rect[2] >= this.endX && rect[1] <= this.endY && rect[1] + rect[3] >= this.endY) return true;
        // If it doesn't intersect bounding box, exit
        let width = this.xMax - this.xMin,
            height = this.yMax - this.yMin;
        if (!Rectangle.rectanglesIntersect(rect, [this.xMin, this.yMin, width, height])) return false;
        // check each line
        // bottom line
        if (this.curveIntersectsLine(this.qY, this.rY + (rect[1] + rect[3]) * 0.5 / this.p0y, this.p1y / (3 * this.p0y), this.p0x, this.p1x, this.p2x, this.startX, rect[0], rect[0] + rect[2])) return true;
        // right line
        if (this.curveIntersectsLine(this.qX, this.rX + (rect[0] + rect[2]) * 0.5 / this.p0x, this.p1x / (3 * this.p0x), this.p0y, this.p1y, this.p2y, this.startY, rect[1], rect[1] + rect[3])) return true;
        // top line
        if (this.curveIntersectsLine(this.qY, this.rY + rect[1] * 0.5 / this.p0y, this.p1y / (3 * this.p0y), this.p0x, this.p1x, this.p2x, this.startX, rect[0], rect[0] + rect[2])) return true;
        // left line
        if (this.curveIntersectsLine(this.qX, this.rX + rect[0] * 0.5 / this.p0x, this.p1x / (3 * this.p0x), this.p0y, this.p1y, this.p2y, this.startY, rect[1], rect[1] + rect[3])) return true;
        return false;
    }

    // https://brilliant.org/wiki/cardano-method/
    // https://proofwiki.org/wiki/Cardano's_Formula
    private curveIntersectsLine(q: number, r: number, bo3a: number, a: number, b: number, c: number, d: number, lineStart: number, lineEnd: number): boolean {
        let D = q * q * q + r * r;
        if (D < 0) { // 3 real roots
            // 1st root:
            let mq = -q, mq3 = mq * mq * mq
            let thta = Math.acos(r / Math.sqrt(mq3)) / 3;
            let sqrtmq = 2 * Math.sqrt(mq);
            let r1 = sqrtmq * Math.cos(thta) - bo3a;
            if (r1 > 0 && r1 < 1 && this.isRootOnSegment(a, b, c, d, r1, lineStart, lineEnd)) return true;
            let r2 = sqrtmq * Math.cos(thta - 2.0943951024) - bo3a; // constant = 2pi/3
            if (r2 > 0 && r2 < 1 && this.isRootOnSegment(a, b, c, d, r2, lineStart, lineEnd)) return true;
            let r3 = sqrtmq * Math.cos(thta - 4.1887902048) - bo3a; // constant = 4pi/3
            if (r3 > 0 && r3 < 1 && this.isRootOnSegment(a, b, c, d, r3, lineStart, lineEnd)) return true;
        } else if (D > 0) { // 1 real root
            let S = Math.cbrt(r + Math.sqrt(D));
            let T = Math.cbrt(r - Math.sqrt(D));
            let r1 = S + T - bo3a;
            if (r1 > 0 && r1 < 1 && this.isRootOnSegment(a, b, c, d, r1, lineStart, lineEnd)) return true;
        } else { // D == 0, 3 roots, 2 unique roots
            let S = Math.cbrt(r);
            let r1 = 2 * S - bo3a;
            if (r1 > 0 && r1 < 1 && this.isRootOnSegment(a, b, c, d, r1, lineStart, lineEnd)) return true;
            let r2 = -S - bo3a;
            if (r2 > 0 && r2 < 1 && this.isRootOnSegment(a, b, c, d, r2, lineStart, lineEnd)) return true;
        }
        return false;
    }

    private isRootOnSegment(a: number, b: number, c: number, d: number, t: number, lineStart: number, lineEnd: number) {
        let val = a * t * t * t + b * t * t + c * t + d;
        return val > lineStart && val < lineEnd;
    }
}