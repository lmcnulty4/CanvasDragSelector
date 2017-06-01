import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";

export class QuadraticBezierCurve implements IShape {

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
    // Intersection coefficients:
    private mbX: number;
    private mbY: number;
    private taX: number;
    private taY: number;
    private qX: number;
    private qY: number;

    constructor(startPointX: number, startPointY: number, controlPointX: number, controlPointY: number, endPointX: number, endPointY: number) {
        this.startX = startPointX;
        this.startY = startPointY;
        this.endX = endPointX;
        this.endY = endPointY;
        this.mbX = 2 * (startPointX - controlPointX);
        this.mbY = 2 * (startPointY - controlPointY);
        this.taX = 2 * (startPointX - controlPointX - controlPointX + endPointX);
        this.taY = 2 * (startPointY - controlPointY - controlPointY + endPointY);
        this.qX = this.mbX * this.mbX - 2 * (this.taX * startPointX);
        this.qY = this.mbY * this.mbY - 2 * (this.taY * startPointY);
        this.calculateAABB(startPointX, startPointY, controlPointX, controlPointY, endPointX, endPointY);
    }

    getEndPoint() : [number, number] {
        return [this.endX, this.endY];
    }

    private calculateAABB(startPointX: number, startPointY: number, controlPointX: number, controlPointY: number, endPointX: number, endPointY: number) {
        // t value for derivative
        let tX = this.mbX / this.taX;
        let tY = this.mbY / this.taY;
        // Set bounds
        this.xMin = endPointX < startPointX ? endPointX : startPointX, this.xMax = endPointX > startPointX ? endPointX : startPointX;
        this.yMin = endPointY < startPointY ? endPointY : startPointY, this.yMax = endPointY > startPointY ? endPointY : startPointY;
        if (tX > 0 && tX < 1) {
            let xt = this.evaluateBezier(startPointX, controlPointX, endPointX, tX);
            if (xt < this.xMin) this.xMin = xt;
            if (xt > this.xMax) this.xMax = xt;
        }
        if (tY > 0 && tY < 1) {
            let xt = this.evaluateBezier(startPointY, controlPointY, endPointY, tY);
            if (xt < this.yMin) this.yMin = xt;
            if (xt > this.yMax) this.yMax = xt;
        }
    }
    // Note: In 1 dimension only
    private evaluateBezier(startPoint:number, controlPoint: number, endPoint: number, t: number) {
        return (1 - t) * (1 - t) * startPoint + 2 * (1 - t) * t * controlPoint + t * t * endPoint;
    }

    // Assume transformation of rect & this curve identical 
    intersects(rect: [number, number, number, number]) :boolean {
        // If either start or end point is inside rect, it intersects
        if (rect[0] <= this.startX && rect[0] + rect[2] >= this.startX && rect[1] <= this.startY && rect[1] + rect[3] >= this.startY) return true;
        if (rect[0] <= this.endX && rect[0] + rect[2] >= this.endX && rect[1] <= this.endY && rect[1] + rect[3] >= this.endY) return true;
        // If it doesn't intersect bounding box, exit
        if (!Rectangle.rectanglesIntersect(rect, [this.xMin, this.yMin, this.xMax - this.xMin, this.yMax - this.yMin])) return false;
        // check each line
        // bottom line
        if (this.curveIntersectsLine(this.mbY, this.taY, this.qY, rect[1] + rect[3], this.taX, this.mbX, this.startX, rect[0], rect[0] + rect[2])) return true;
        // right line
        if (this.curveIntersectsLine(this.mbX, this.taX, this.qX, rect[0] + rect[2], this.taY, this.mbY, this.startY, rect[1], rect[1] + rect[3])) return true;
        // top line
        if (this.curveIntersectsLine(this.mbY, this.taY, this.qY, rect[1], this.taX, this.mbX, this.startX, rect[0], rect[0] + rect[2])) return true;
        // left line
        if (this.curveIntersectsLine(this.mbX, this.taX, this.qX, rect[0], this.taY, this.mbY, this.startY, rect[1], rect[1] + rect[3])) return true;
        return false;
    }

    private curveIntersectsLine(mb: number, ta: number, q: number, offset: number, a: number, b: number, c: number, lineStart: number, lineEnd: number) {
        let disc = q + 2 * ta * offset; // b^2 - 4ac
        if (disc > 0) { // 2 roots
            disc = Math.sqrt(disc);
            let r1 = (mb + disc) / ta;
            if (r1 > 0 && r1 < 1 && this.isRootOnSegment(a, b, c, r1, lineStart, lineEnd)) return true;
            let r2 = (mb - disc) / ta;
            if (r2 > 0 && r2 < 1 && this.isRootOnSegment(a, b, c, r2, lineStart, lineEnd)) return true;
        } else if (disc === 0) {
            let r1 = mb / ta;
            if (r1 > 0 && r1 < 1 && this.isRootOnSegment(a, b, c, r1, lineStart, lineEnd)) return true;
        }
        return false;
    }

    private isRootOnSegment(a: number, b: number, c: number, t: number, segmentMin: number, segmentMax: number) {
        let val = 0.5 * a * t * t - b * t + c;
        return val > segmentMin && val < segmentMax;
    }
}