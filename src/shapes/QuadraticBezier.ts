import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";
import { ICanvasContext } from "../TrackingContext";
import { getUnitQuadRoots } from "./MathLib";

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
    // t values for AABB
    private xMinT: number;
    private xMaxT: number;
    private yMinT: number;
    private yMaxT: number;
    // Intersection coefficients:
    private mbX: number;
    private mbY: number;
    private taX: number;
    private taY: number;
    // For re-rendering
    private controlPointX: number;
    private controlPointY: number;
    // For winding number testing for point in polygon:
    private yMonoSubcurves: QuadraticBezierCurve[] = [];

    constructor(startPointX: number, startPointY: number, controlPointX: number, controlPointY: number, endPointX: number, endPointY: number) {
        this.startX = startPointX;
        this.startY = startPointY;
        this.endX = endPointX;
        this.endY = endPointY;
        this.controlPointX = controlPointX;
        this.controlPointY = controlPointY;
        this.mbX = 2 * (startPointX - controlPointX);
        this.mbY = 2 * (startPointY - controlPointY);
        this.taX = 2 * (startPointX - controlPointX - controlPointX + endPointX);
        this.taY = 2 * (startPointY - controlPointY - controlPointY + endPointY);
        this.calculateAABB(startPointX, startPointY, controlPointX, controlPointY, endPointX, endPointY);
        this.generateSubcurves();
    }

    render(context: ICanvasContext) {
        context.quadraticCurveTo(this.controlPointX, this.controlPointY, this.endX, this.endY);
    }

    getEndPoint() : [number, number] {
        return [this.endX, this.endY];
    }

    getBounds(): [number,number,number,number] {
        return [this.xMin, this.yMin, this.xMax, this.yMax];
    }

    private calculateAABB(startPointX: number, startPointY: number, controlPointX: number, controlPointY: number, endPointX: number, endPointY: number) {
        // t value for derivative
        let tX = this.mbX / this.taX;
        let tY = this.mbY / this.taY;
        // Set bounds
        if (endPointX < startPointX) {
            this.xMin = endPointX; this.xMinT = 1;
            this.xMax = startPointX; this.xMinT = 0;
        } else {
            this.xMin = startPointX; this.xMinT = 0;
            this.xMax = endPointX; this.xMinT = 1;
        }
        if (endPointY < startPointY) {
            this.yMin = endPointY; this.yMinT = 1;
            this.yMax = startPointY; this.yMinT = 0;
        } else {
            this.yMin = startPointY; this.yMinT = 0;
            this.yMax = endPointY; this.yMinT = 1;
        }
        if (tX > 0 && tX < 1) {
            let xt = this.evaluateBezier(startPointX, controlPointX, endPointX, tX);
            if (xt < this.xMin) { this.xMin = xt; this.xMinT = tX; }
            if (xt > this.xMax) { this.xMax = xt; this.xMaxT = tX; }
        }
        if (tY > 0 && tY < 1) {
            let xt = this.evaluateBezier(startPointY, controlPointY, endPointY, tY);
            if (xt < this.yMin) { this.yMin = xt; this.yMinT = tY; }
            if (xt > this.yMax) { this.yMax = xt; this.yMaxT = tY; }
        }
    }
    // Note: In 1 dimension only
    private evaluateBezier(startPoint:number, controlPoint: number, endPoint: number, t: number) {
        return (1 - t) * (1 - t) * startPoint + 2 * (1 - t) * t * controlPoint + t * t * endPoint;
    }

    private generateSubcurves() {
        if (!this.isMonotoneY()) {
            let boundMax = this.yMin === this.startY || this.yMin === this.endY;
            let midPointX = this.evaluateBezier(this.startX, this.controlPointX, this.endX, boundMax ? this.yMaxT : this.yMinT);
            let midPointY = this.evaluateBezier(this.startY, this.controlPointY, this.endY, boundMax ? this.yMaxT : this.yMinT);
            let newControlPoint1X = this.startX + (this.controlPointX - this.startX) * (boundMax ? this.yMaxT : this.yMinT);
            let newControlPoint1Y = this.startY + (this.controlPointY - this.startY) * (boundMax ? this.yMaxT : this.yMinT);
            let newControlPoint2X = this.controlPointX + (this.endX - this.controlPointX) * (boundMax ? this.yMaxT : this.yMinT);
            let newControlPoint2Y = this.controlPointY + (this.endY - this.controlPointY) * (boundMax ? this.yMaxT : this.yMinT);
            this.yMonoSubcurves.push(new QuadraticBezierCurve(this.startX, this.startY, newControlPoint1X, newControlPoint1Y, midPointX, midPointY));
            this.yMonoSubcurves.push(new QuadraticBezierCurve(midPointX, midPointY, newControlPoint2X, newControlPoint2Y, this.endX, this.endY));
        }
    }

    private isMonotoneY() {
        return (this.startY === this.yMin && this.endY === this.yMax) || (this.endY === this.yMin && this.startY === this.yMax);
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
        if (this.curveIntersectsLine(this.taY, this.mbY, this.startY - (rect[1] + rect[3]), this.taX, this.mbX, this.startX, rect[0], rect[0] + rect[2])) return true;
        // right line
        if (this.curveIntersectsLine(this.taX, this.mbX, this.startX - (rect[0] + rect[2]), this.taY, this.mbY, this.startY, rect[1], rect[1] + rect[3])) return true;
        // top line
        if (this.curveIntersectsLine(this.taY, this.mbY, this.startY - rect[1], this.taX, this.mbX, this.startX, rect[0], rect[0] + rect[2])) return true;
        // left line
        if (this.curveIntersectsLine(this.taX, this.mbX, this.startX - rect[0], this.taY, this.mbY, this.startY, rect[1], rect[1] + rect[3])) return true;
        return false;
    }

    private curveIntersectsLine(a1: number, b1: number, c1: number, a: number, b: number, c: number, lineStart: number, lineEnd: number) {
        let roots: [number, number] = [null, null], n = getUnitQuadRoots(a1, b1, c1, roots);
        if (n === 2) { // 2 roots
            if (this.isRootOnSegment(a, b, c, roots[0], lineStart, lineEnd)) return true;
            if (this.isRootOnSegment(a, b, c, roots[1], lineStart, lineEnd)) return true;
        } else if (n === 1) {
            return this.isRootOnSegment(a, b, c, roots[0], lineStart, lineEnd);
        }
        return false;
    }

    windingNumber(point: [number, number]) {
        if (this.yMonoSubcurves.length === 0) {
            return this.monoWind(point);
        } else {
            return this.yMonoSubcurves[0].monoWind(point) + this.yMonoSubcurves[1].monoWind(point);
        }
    }

    private monoWind(point: [number, number]) {
        let wn = 1, y0 = this.startY, y2 = this.endY;
        if (y0 > y2) { wn = -1; y0 = this.endY, y2 = this.startY; }
        if (point[1] < y0 || point[1] >= y2) {
            return 0;
        }
        let roots: [number, number] = [null, null];
        let n = getUnitQuadRoots(this.taY, this.mbY, this.startY - point[1], roots), xt;
        if (n === 0) {
            return (wn === 1) ? (this.startX < point[0] ? wn : 0) : (this.endX < point[0] ? wn : 0);
        } else {
            return (this.evaluateAsPolynomial(this.taX, this.mbX, this.startX, roots[0]) < point[0]) ? wn : 0;
        }
    }

    private isRootOnSegment(a: number, b: number, c: number, t: number, segmentMin: number, segmentMax: number) {
        let val = this.evaluateAsPolynomial(a, b, c, t);
        return val > segmentMin && val < segmentMax;
    }
    private evaluateAsPolynomial(a: number, b: number, c: number, t: number) {
        return 0.5 * a * t * t - b * t + c;
    }
}