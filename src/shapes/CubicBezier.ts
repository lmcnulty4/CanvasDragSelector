import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";
import { ICanvasContext } from "../TrackingContext";
import { getUnitQuadRoots, isUnit } from "./MathLib";

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
    private yMonoSubCurves: CubicBezierCurve[] = [];

    constructor(startPointX: number, startPointY: number, controlPoint1X: number, controlPoint1Y: number, controlPoint2X: number, controlPoint2Y: number, endPointX: number, endPointY: number, isSubcurve = false) {
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
        this.controlPoint1X = controlPoint1X;
        this.controlPoint1Y = controlPoint1Y;
        this.controlPoint2X = controlPoint2X;
        this.controlPoint2Y = controlPoint2Y;
        this.qX = (3 * this.p0x * this.p2x - this.p1x * this.p1x) / (9 * this.p0x * this.p0x);
        this.qY = (3 * this.p0y * this.p2y - this.p1y * this.p1y) / (9 * this.p0y * this.p0y);
        this.rX = (9 * this.p0x * this.p1x * this.p2x - 27 * this.p0x * this.p0x * this.startX - 2 * this.p1x * this.p1x * this.p1x) / (54 * this.p0x * this.p0x * this.p0x);
        this.rY = (9 * this.p0y * this.p1y * this.p2y - 27 * this.p0y * this.p0y * this.startY - 2 * this.p1y * this.p1y * this.p1y) / (54 * this.p0y * this.p0y * this.p0y);
        if (!isSubcurve) {
            let xRoots: [number,number] = <any>[], yRoots: [number,number] = <any>[], rootCounts: [number,number] = <any>[];
            this.calculateAABB(xRoots, yRoots, rootCounts);
            this.generateSubcurves(xRoots, yRoots, rootCounts[1]);
        }
    }

    render(context: ICanvasContext) {
        context.bezierCurveTo(this.controlPoint1X, this.controlPoint1Y, this.controlPoint2X, this.controlPoint2Y, this.endX, this.endY);
    }

    getEndPoint() : [number, number] {
        return [this.endX, this.endY];
    }

    getBounds(): [number,number,number,number] {
        return [this.xMin, this.yMin, this.xMax, this.yMax];
    }

    private generateSubcurves(xRoots: [number, number], yRoots: [number, number], rootCount: number) {
        if (rootCount == 2 && yRoots[0] > yRoots[1]) {
            let t = yRoots[0];
            yRoots[0] = yRoots[1];
            yRoots[1] = t;
        }
        if (rootCount > 0) { // 1 turning point / point of inflexion
            let cpts1: number[] = [];
            this.generateLeftCtrlPts(this.startX, this.startY, this.controlPoint1X, this.controlPoint1Y, this.controlPoint2X, this.controlPoint2Y, yRoots[0], 1-yRoots[0], cpts1);
            let mid1X = this.evaluateBezier(this.startX, this.controlPoint1X, this.controlPoint2X, this.endX, yRoots[0]);
            let mid1Y = this.evaluateBezier(this.startY, this.controlPoint1Y, this.controlPoint2Y, this.endY, yRoots[0]);
            this.yMonoSubCurves.push(new CubicBezierCurve(
                this.startX, this.startY, cpts1[0], cpts1[1], cpts1[2], cpts1[3], mid1X, mid1Y, true
            ));
            this.generateRightCtrlPts(this.controlPoint1X, this.controlPoint1Y, this.controlPoint2X, this.controlPoint2Y, this.endX, this.endY, yRoots[0], 1-yRoots[0], cpts1);
            if (rootCount === 1) {
                this.yMonoSubCurves.push(new CubicBezierCurve(
                    mid1X, mid1Y, cpts1[0], cpts1[1], cpts1[2], cpts1[3], this.endX, this.endY, true
                ));
            } else { // Split 2nd "half"" with 2nd yRoot interpolated along that "half". 2nd half ctrl pts are in cpts1 array
                yRoots[1] = (yRoots[1] - yRoots[0]) / (1 - yRoots[0]);
                let cpts2: number[] = [];
                this.generateLeftCtrlPts(mid1X, mid1Y, cpts1[0], cpts1[1], cpts1[2], cpts1[3], yRoots[1], 1-yRoots[1], cpts2);
                let mid2X = this.evaluateBezier(mid1X, cpts1[0], cpts1[2], this.endX, yRoots[1]);
                let mid2Y = this.evaluateBezier(mid1Y, cpts1[1], cpts1[3], this.endY, yRoots[1]);
                this.yMonoSubCurves.push(new CubicBezierCurve(
                    mid1X, mid1Y, cpts2[0], cpts2[1], cpts2[2], cpts2[3], mid2X, mid2Y, true
                ));
                this.generateRightCtrlPts(cpts1[0], cpts1[1], cpts1[2], cpts1[3], this.endX, this.endY, yRoots[1], 1-yRoots[1], cpts2);
                this.yMonoSubCurves.push(new CubicBezierCurve(
                    mid2X, mid2Y, cpts2[0], cpts2[1], cpts2[2], cpts2[3], this.endX, this.endY, true
                ));
            }
        }
    }

    private generateLeftCtrlPts(startX: number, startY: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, t: number, uinvT: number, cpts: number[]) {
        cpts[0] = (uinvT * startX) + (t * cp1x);
        cpts[1] = (uinvT * startY) + (t * cp1y);
        cpts[2] = (uinvT * uinvT * startX) + (2 * uinvT * t * cp1x) + (t * t * cp2x);
        cpts[3] = (uinvT * uinvT * startY) + (2 * uinvT * t * cp1y) + (t * t * cp2y);
    }
    private generateRightCtrlPts(cp1x: number, cp1y: number, cp2x: number, cp2y: number, endX: number, endY: number, t: number, uinvT: number, cpts: number[]) {
        cpts[0] = (uinvT * uinvT * cp1x) + (2 * uinvT * t * cp2x) + (t * t * endX),
        cpts[1] = (uinvT * uinvT * cp1y) + (2 * uinvT * t * cp2y) + (t * t * endY),
        cpts[2] = (uinvT * cp2x) + (t * endX),
        cpts[3] = (uinvT * cp2y) + (t * endY)
    }


    // Note: In 1 dimension only
    private evaluateBezier(startPoint:number, controlPoint1: number, controlPoint2: number, endPoint: number, t: number) {
        return startPoint * (1 - t) * (1 - t) * (1 - t) + 3 * controlPoint1 * t * (1 - t) * (1 - t) + 3 * controlPoint2 * t * t * (1 - t) + endPoint * t * t * t;
    }

    // https://pomax.github.io/bezierinfo/#boundingbox
    // https://pomax.github.io/bezierinfo/#extremities
    private calculateAABB(xRoots: [number, number], yRoots: [number, number], rootCount: [number, number]) {
        // Derivative and get roots
        let aX = 3 * this.p0x, aY = 3 * this.p0y;
        let bX = 2 * this.p1x, bY = 2 * this.p1y;
        let cX = this.p2x, cY = this.p2y;
        // initialise mins and maxes
        this.xMin = this.endX < this.startX ? this.endX : this.startX, this.xMax = this.endX > this.startX ? this.endX : this.startX;
        this.yMin = this.endY < this.startY ? this.endY : this.startY, this.yMax = this.endY > this.startY ? this.endY : this.startY;
        rootCount.push(getUnitQuadRoots(2 * aX, -bX, cX, xRoots));
        rootCount.push(getUnitQuadRoots(2 * aY, -bY, cY, yRoots));
        if (rootCount[0] > 0) {
            let x = this.evaluateBezier(this.startX, this.controlPoint1X, this.controlPoint2X, this.endX, xRoots[0]);
            if (x < this.xMin) this.xMin = x;
            if (x > this.xMax) this.xMax = x;
            if (rootCount[0] > 1) {
                x = this.evaluateBezier(this.startX, this.controlPoint1X, this.controlPoint2X, this.endX, xRoots[1]);
                if (x < this.xMin) this.xMin = x;
                if (x > this.xMax) this.xMax = x;
            }
        }
        if (rootCount[1] > 0) {
            let y = this.evaluateBezier(this.startY, this.controlPoint1Y, this.controlPoint2Y, this.endY, yRoots[0]);
            if (y < this.yMin) this.yMin = y;
            if (y > this.yMax) this.yMax = y;
            if (rootCount[1] > 1) {
                y = this.evaluateBezier(this.startY, this.controlPoint1Y, this.controlPoint2Y, this.endY, yRoots[1]);
                if (y < this.yMin) this.yMin = y;
                if (y > this.yMax) this.yMax = y;
            }
        }
    }

    intersects(rect: [number, number, number, number]): boolean {
        // If either start or end point is inside rect, it intersects
        if (rect[0] <= this.startX && rect[0] + rect[2] >= this.startX && rect[1] <= this.startY && rect[1] + rect[3] >= this.startY) return true;
        if (rect[0] <= this.endX && rect[0] + rect[2] >= this.endX && rect[1] <= this.endY && rect[1] + rect[3] >= this.endY) return true;
        // If it doesn't intersect bounding box, exit
        if (typeof this.xMin !== "undefined" && !Rectangle.rectanglesIntersect(rect, [this.xMin, this.yMin, this.xMax - this.xMin, this.yMax - this.yMin])) return false;
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

    private curveIntersectsLine(q: number, r: number, bo3a: number, a: number, b: number, c: number, d: number, lineStart: number, lineEnd: number): boolean {
        let roots: number[] = [], n = this.getCubicRoots(q, r, bo3a, roots);
        if (n === 0) return false;
        if (n === 3) {
            if (this.isRootOnSegment(a, b, c, d, roots[0], lineStart, lineEnd)) return true;
            if (this.isRootOnSegment(a, b, c, d, roots[1], lineStart, lineEnd)) return true;
            if (this.isRootOnSegment(a, b, c, d, roots[2], lineStart, lineEnd)) return true;
        } else if (n === 2) {
            if (this.isRootOnSegment(a, b, c, d, roots[0], lineStart, lineEnd)) return true;
            if (this.isRootOnSegment(a, b, c, d, roots[1], lineStart, lineEnd)) return true;
        } else {
            if (this.isRootOnSegment(a, b, c, d, roots[0], lineStart, lineEnd)) return true;
        }
    }

    // https://brilliant.org/wiki/cardano-method/
    // https://proofwiki.org/wiki/Cardano's_Formula
    private getCubicRoots(q: number, r: number, bo3a: number, roots: number[]) {
        let D = q * q * q + r * r, n = 0;
        if (D < 0) { // 3 real roots
            let thta = Math.acos(r / Math.sqrt(q*q*q*(q<0?-1:1))) / 3;
            let sqrtmq = 2 * Math.sqrt(-q);
            let r1 = sqrtmq * Math.cos(thta) - bo3a;
            let r2 = sqrtmq * Math.cos(thta + 2.0943951024) - bo3a; // constant = 2pi/3
            let r3 = sqrtmq * Math.cos(thta + 4.1887902048) - bo3a; // constant = 4pi/3
            if (isUnit(r1)) roots[n++] = r1;
            if (isUnit(r2)) roots[n++] = r2;
            if (isUnit(r3)) roots[n++] = r3;
        } else if (D > 0) { // 1 real root
            let sqrtD = Math.sqrt(D), r1 = Math.cbrt(r + sqrtD) + Math.cbrt(r - sqrtD) - bo3a;
            if (isUnit(r1)) roots[n++] = r1;
        } else {// D == 0, 3 roots, 2 unique roots
            let S = Math.cbrt(r);
            let r1 = 2 * S - bo3a;
            let r2 = -S - bo3a;
            if (isUnit(r1)) roots[n++] = r1;
            if (isUnit(r2)) roots[n++] = r2;
        }
        return n;
    }

    windingNumber(point: [number, number]) {
        if (this.yMonoSubCurves.length === 0) {
            return this.monoWind(point);
        }
        let wn = 0;
        wn += this.yMonoSubCurves[0].monoWind(point);
        wn += this.yMonoSubCurves[1].monoWind(point);
        wn += (this.yMonoSubCurves.length === 3 ? this.yMonoSubCurves[2].monoWind(point) : 0);
        return wn;
    }

    private monoWind(point: [number, number]): number {
        let wn = 1;
        if (this.startY > this.endY) {
            wn = -1;
            if (point[1] < this.endY || point[1] >= this.startY) return 0;
        } else {
            if (point[1] < this.startY || point[1] >= this.endY) return 0;
        }
        if (point[0] < Math.min(this.startX, this.controlPoint1X, this.controlPoint2X, this.endX)) return 0;
        if (point[0] > Math.max(this.startX, this.controlPoint1X, this.controlPoint2X, this.endX)) return wn;
        let roots: number[] = [];
        let n = this.getCubicRoots(this.qY, this.rY + (point[1] * 0.5 / this.p0y), this.p1y / (3 * this.p0y), roots);
        if (n === 0) {
            return 0;
        } else {
            return (this.evaluateAsPolynomial(this.p0x, this.p1x, this.p2x, this.startX, roots[0]) < point[0]) ? wn : 0;
        }
    }
    private evaluateAsPolynomial(a: number, b: number, c: number, d: number, t: number) {
        return a * t * t * t + b * t * t + c * t + d;
    }
    private isRootOnSegment(a: number, b: number, c: number, d: number, t: number, lineStart: number, lineEnd: number) {
        let val = this.evaluateAsPolynomial(a, b, c, d, t);
        return val > lineStart && val < lineEnd;
    }
}