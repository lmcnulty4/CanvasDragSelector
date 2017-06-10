import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";
import { ICanvasContext } from "../TrackingContext";
import { getUnitQuadRoots, isUnit } from "./MathLib";

export class QuadraticBezierCurve implements IShape {

    // For initial checks - if any of these is inside rect then it intersects
    private startX: number;
    private startY: number;
    private endX: number;
    private endY: number;
    // AABB:
    private bounds: number[] = [];
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
        //this.calculateAABB(startPointX, startPointY, controlPointX, controlPointY, endPointX, endPointY);
        this.calculate1dAABB(startPointX, controlPointX, endPointX, this.mbX / this.taX, 0);
        this.calculate1dAABB(startPointY, controlPointY, endPointY, this.mbY / this.taY, 1);
        this.generateSubcurves();
    }

    render(context: ICanvasContext) {
        context.quadraticCurveTo(this.controlPointX, this.controlPointY, this.endX, this.endY);
    }

    getEndPoint() : [number, number] {
        return [this.endX, this.endY];
    }

    getBounds(): [number,number,number,number] {
        return [this.bounds[0], this.bounds[1], this.bounds[2], this.bounds[3]];
    }

    private calculate1dAABB(start: number, cp: number, end: number, tVal: number, incr: number) {
        if (end < start) {
            this.bounds[incr] = end;
            this.bounds[incr+2] = start;
        } else {
            this.bounds[incr] = start;
            this.bounds[incr+2] = end;
        }
        if (isUnit(tVal)) {
            let val = this.evaluateBezier(start, cp, end, tVal);
            if (val < this.bounds[incr]) { this.bounds[incr] = val; }
            if (val > this.bounds[incr+2]) { this.bounds[incr+2] = val; }
        }
    }

    // Note: In 1 dimension only
    private evaluateBezier(startPoint:number, controlPoint: number, endPoint: number, t: number) {
        return (1 - t) * (1 - t) * startPoint + 2 * (1 - t) * t * controlPoint + t * t * endPoint;
    }

    private generateSubcurves() {
        if (!this.isMonotoneY()) {
            let t = this.mbY / this.taY; // Can do this because if it's not monotone then it has at one turning point which must have this value for t
            let midPointX = this.evaluateBezier(this.startX, this.controlPointX, this.endX, t);
            let midPointY = this.evaluateBezier(this.startY, this.controlPointY, this.endY, t);
            let newControlPoint1X = this.startX + (this.controlPointX - this.startX) * t;
            let newControlPoint1Y = this.startY + (this.controlPointY - this.startY) * t;
            let newControlPoint2X = this.controlPointX + (this.endX - this.controlPointX) * t;
            let newControlPoint2Y = this.controlPointY + (this.endY - this.controlPointY) * t;
            this.yMonoSubcurves.push(new QuadraticBezierCurve(this.startX, this.startY, newControlPoint1X, newControlPoint1Y, midPointX, midPointY));
            this.yMonoSubcurves.push(new QuadraticBezierCurve(midPointX, midPointY, newControlPoint2X, newControlPoint2Y, this.endX, this.endY));
        }
    }

    private isMonotoneY() {
        return (this.startY === this.bounds[1] && this.endY === this.bounds[3]) || (this.endY === this.bounds[1] && this.startY === this.bounds[3]);
    }

    // Assume transformation of rect & this curve identical 
    intersects(rect: [number, number, number, number]) :boolean {
        // If either start or end point is inside rect, it intersects
        if (rect[0] <= this.startX && rect[0] + rect[2] >= this.startX && rect[1] <= this.startY && rect[1] + rect[3] >= this.startY) return true;
        if (rect[0] <= this.endX && rect[0] + rect[2] >= this.endX && rect[1] <= this.endY && rect[1] + rect[3] >= this.endY) return true;
        // If it doesn't intersect bounding box, exit
        if (!Rectangle.rectanglesIntersect(rect, [this.bounds[0], this.bounds[1], this.bounds[2] - this.bounds[0], this.bounds[3] - this.bounds[1]])) return false;
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
        let n = getUnitQuadRoots(this.taY, this.mbY, this.startY - point[1], roots);
        if (n === 0) {
            //return (wn === 1) ? (this.startX < point[0] ? wn : 0) : (this.endX < point[0] ? wn : 0);
            return (wn === 1 ? this.startX : this.endX) < point[0] ? wn : 0;
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