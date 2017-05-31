import { IShape } from "./base";
import { TransformMatrix } from "../ContextCurrentTransformPolyfill";
import { Rectangle } from "./Rectangle";

type Point = ["M" | "L" | "Z" | "Q" | "C", number, number]; // type, x, y
type BezierCurve = ["Q" | "C" | "A", ICurve];

export class Path implements IShape {

    readonly boundingBox: [number, number, number, number];
    private xform: TransformMatrix;
    private subPath: (Point | BezierCurve)[];

    constructor(context: CanvasRenderingContext2D) {
        this.xform = (<any>context).currentTransform;
        this.subPath = [];
    }

    moveTo(point: [number, number]) {
        this.subPath.push(["M", point[0], point[1]]);
    }

    lineTo(point: [number, number]) {
        this.ensureSubpathExists();
        this.subPath.push(["L", point[0], point[1]]);
    }

    closePath() {
        this.subPath.push(["Z", null, null]);
    }

    quadraticCurveTo(controlPoint: [number, number], endPoint: [number, number]) {
        this.ensureSubpathExists();
        let startPoint = this.getPreviousEndPoint();
        this.subPath.push(["Q", new QuadraticBezierCurve(startPoint, controlPoint, endPoint)]);
    }

    bezierCurveTo(controlPoint1: [number, number], controlPoint2: [number, number], endPoint: [number, number]) {
        this.ensureSubpathExists();
        let startPoint = this.getPreviousEndPoint();
        this.subPath.push(["C", new CubicBezierCurve(startPoint, controlPoint1, controlPoint2, endPoint)]);
    }

    arcTo(controlPoint: [number, number], endPoint: [number, number], radius: number) {
        this.ensureSubpathExists();
        let startPoint = this.getPreviousEndPoint();
        let arc = new Arc(startPoint, controlPoint, endPoint, radius);
        let arcStart = arc.getStartPoint();
        if (!(arcStart[1] === startPoint[1] && arcStart[2] === startPoint[2])) {
            this.subPath.push(arcStart);
        }
        this.subPath.push(["A", arc]);
    }

    private getPreviousEndPoint(): Point {
        let prevPath = this.subPath[this.subPath.length - 1];
        if (prevPath instanceof QuadraticBezierCurve || prevPath instanceof CubicBezierCurve || prevPath instanceof Arc) {
            return prevPath.getEndPoint();
        } else {
            return <Point>prevPath;
        }
    }

    private ensureSubpathExists() {
        if (this.subPath.length === 0) {
            this.subPath.push(["M", 0, 0]);
        }
    }

    intersects(dimens: [number, number, number, number]) {
        let transformedRect = Rectangle.matrixTransformRect(dimens, this.xform);
        let i = 1, l = this.subPath.length;
        let previousSegment = this.subPath[0];
        let segmentInitialSubPath = this.subPath[0];
        for (i; i < l; ++i) {
            let currentSegment = this.subPath[i];
            if (currentSegment[0] === "M") {
                segmentInitialSubPath = currentSegment;
            } else if (currentSegment[0] === "L") {
                if (this.lineIntersectsRect(<Point>previousSegment, <Point>currentSegment, transformedRect)) {
                    return true;
                }
                previousSegment = currentSegment;
            } else if (currentSegment[0] === "Z") {
                if (this.lineIntersectsRect(<Point>previousSegment, <Point>segmentInitialSubPath, transformedRect)) {
                    return true;
                }
                previousSegment = currentSegment;
            } else if (currentSegment[0] === "Q") {
                if ((<QuadraticBezierCurve>currentSegment[1]).intersects(transformedRect)) {
                    return true;
                }
                previousSegment = (<QuadraticBezierCurve>currentSegment[1]).getEndPoint();
            } else if (currentSegment[0] === "C") {
                if ((<CubicBezierCurve>currentSegment[1]).intersects(transformedRect)) {
                    return true;
                }
                previousSegment = (<CubicBezierCurve>currentSegment[1]).getEndPoint();
            } else if (currentSegment[0] === "A") {
                if ((<Arc>currentSegment[1]).intersects(transformedRect)) {
                    return true;
                }
                previousSegment = (<Arc>currentSegment[1]).getEndPoint();
            }
        }
        return false;
    }

    private lineIntersectsRect(lineStart: Point, lineEnd: Point, rect: [number, number, number, number]) {
        // If they are axis aligned then test using Rect intersection with width/height set to 0
        // If both Xs are the same then they are y-axis aligned and have a width = 0 and height = difference between the Y values
        if (lineStart[1] === lineEnd[1]) return Rectangle.rectanglesIntersect([lineStart[1], lineStart[2], 0, Math.abs(lineEnd[2] - lineStart[2])], rect);
        // If both Ys are the same then they are x-axis aligned and have a height = 0 and width = difference between the X values
        if (lineStart[2] === lineEnd[2]) return Rectangle.rectanglesIntersect([lineStart[1], lineStart[2], Math.abs(lineEnd[1] - lineStart[1]), 0], rect);
        // Else more expensive check
        let bottomLeft: [number, number] = [rect[0], rect[1]];
        let topLeft: [number, number] = [rect[0], rect[1] + rect[3]];
        let topRight: [number, number] = [rect[0] + rect[2], rect[1] + rect[3]];
        let bottomRight: [number, number] = [rect[0] + rect[2], rect[1]];
        return (this.endProject(lineStart, lineEnd, topLeft, topRight, bottomRight, bottomLeft) && 
            this.cornersSameSide(lineStart, lineEnd, bottomLeft, bottomRight, topRight, topLeft));
    }

    private endProject(lineStart: Point, lineEnd: Point, tl: [number, number], tr: [number, number], br: [number, number], bl: [number, number]) {
        if (lineStart[2] > tr[1] && lineEnd[2] > tr[1]) return false;
        if (lineStart[2] < bl[1] && lineEnd[2] < bl[1]) return false;
        if (lineStart[1] > tr[0] && lineEnd[1] > tr[0]) return false;
        if (lineStart[1] < bl[0] && lineEnd[1] < bl[0]) return false;
        return true;
    }

    private cornersSameSide(lineStart: Point, lineEnd: Point, bottomLeft: [number, number], bottomRight: [number, number], topRight: [number, number], topLeft: [number, number]) {
        let xC = lineStart[1] - lineEnd[1];
        let yC = lineEnd[2] - lineStart[2]; 
        let os = lineEnd[1] * lineStart[2] - lineStart[1] * lineEnd[2];
        let v: number, sign: number;
        v = topLeft[0] * yC + topLeft[1] * xC + os;
        sign = (v < 0 ? -1 : (v > 0 ? 1 : 0));
        v = topRight[0] * yC + topRight[1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        v = bottomRight[0] * yC + bottomRight[1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        v = bottomLeft[0] * yC + bottomLeft[1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        return false;
    }

}

interface ICurve {
    intersects(rect: [number, number, number, number]): boolean;
    getEndPoint(): Point;
}

export class QuadraticBezierCurve implements ICurve {

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

    constructor(startPoint: Point, controlPoint: [number, number], endPoint: [number, number]) {
        this.startX = startPoint[1];
        this.startY = startPoint[2];
        this.endX = endPoint[0];
        this.endY = endPoint[1];
        this.mbX = 2 * (startPoint[1] - controlPoint[0]);
        this.mbY = 2 * (startPoint[2] - controlPoint[1]);
        this.taX = 2 * (startPoint[1] - controlPoint[0] - controlPoint[0] + endPoint[0]);
        this.taY = 2 * (startPoint[2] - controlPoint[1] - controlPoint[1] + endPoint[1]);
        this.qX = this.mbX * this.mbX - 2 * (this.taX * startPoint[1]);
        this.qY = this.mbY * this.mbY - 2 * (this.taY * startPoint[2]);
        this.calculateAABB(startPoint, controlPoint, endPoint);
    }

    getEndPoint() : ["M", number, number] {
        return ["M", this.endX, this.endY];
    }

    private calculateAABB(startPoint: Point, controlPoint: [number, number], endPoint: [number, number]) {
        // t value for derivative
        let tX = this.mbX / this.taX;
        let tY = this.mbY / this.taY;
        // Set bounds
        this.xMin = endPoint[0] < startPoint[1] ? endPoint[0] : startPoint[1], this.xMax = endPoint[0] > startPoint[1] ? endPoint[0] : startPoint[1];
        this.yMin = endPoint[1] < startPoint[2] ? endPoint[1] : startPoint[2], this.yMax = endPoint[1] > startPoint[2] ? endPoint[1] : startPoint[2];
        if (tX > 0 && tX < 1) {
            let xt = this.evaluateBezier(startPoint[1], controlPoint[0], endPoint[0], tX);
            if (xt < this.xMin) this.xMin = xt;
            if (xt > this.xMax) this.xMax = xt;
        }
        if (tY > 0 && tY < 1) {
            let xt = this.evaluateBezier(startPoint[2], controlPoint[1], endPoint[1], tY);
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

export class CubicBezierCurve implements ICurve {

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

    constructor(startPoint: Point, controlPoint1: [number, number], controlPoint2: [number, number], endPoint: [number, number]) {
        this.p0x = (-startPoint[1] + 3*controlPoint1[0] + -3*controlPoint2[0] + endPoint[0]);
        this.p0y = (-startPoint[2] + 3*controlPoint1[1] + -3*controlPoint2[1] + endPoint[1]);
        this.p1x = (3*startPoint[1] - 6*controlPoint1[0] + 3*controlPoint2[0]);
        this.p1y = (3*startPoint[2] - 6*controlPoint1[1] + 3*controlPoint2[1]);
        this.p2x = (-3*startPoint[1] + 3*controlPoint1[0]);
        this.p2y = (-3*startPoint[2] + 3*controlPoint1[1]);
        this.startX = startPoint[1];
        this.startY = startPoint[2];
        this.endX = endPoint[0];
        this.endY = endPoint[1];
        this.qX = (3 * this.p0x * this.p2x - this.p1x * this.p1x) / (9 * this.p0x * this.p0x);
        this.qY = (3 * this.p0y * this.p2y - this.p1y * this.p1y) / (9 * this.p0y * this.p0y);
        this.rX = (9 * this.p0x * this.p1x * this.p2x - 27 * this.p0x * this.p0x * this.startX - 2 * this.p1x * this.p1x * this.p1x) / (54 * this.p0x * this.p0x * this.p0x);
        this.rY = (9 * this.p0y * this.p1y * this.p2y - 27 * this.p0y * this.p0y * this.startY - 2 * this.p1y * this.p1y * this.p1y) / (54 * this.p0y * this.p0y * this.p0y);
        this.calculateAABB(startPoint, controlPoint1, controlPoint2, endPoint);
    }

    getEndPoint() : ["M", number, number] {
        return ["M", this.endX, this.endY];
    }

    // Note: In 1 dimension only
    private evaluateBezier(startPoint:number, controlPoint1: number, controlPoint2: number, endPoint: number, t: number) {
        return startPoint * (1 - t) * (1 - t) * (1 - t) + 3 * controlPoint1 * t * (1 - t) * (1 - t) + 3 * controlPoint2 * t * t * (1 - t) + endPoint * t * t * t;
    }

    // https://pomax.github.io/bezierinfo/#boundingbox
    // https://pomax.github.io/bezierinfo/#extremities
    private calculateAABB(startPoint: Point, controlPoint1: [number, number], controlPoint2: [number, number], endPoint: [number, number]) {
        // Derivative and get roots
        let aX = 3 * this.p0x, aY = 3 * this.p0y;
        let bX = 2 * this.p1x, bY = 2 * this.p1y;
        let cX = this.p2x, cY = this.p2y;
        // initialise mins and maxes
        this.xMin = endPoint[0] < startPoint[1] ? endPoint[0] : startPoint[1], this.xMax = endPoint[0] > startPoint[1] ? endPoint[0] : startPoint[1];
        this.yMin = endPoint[1] < startPoint[2] ? endPoint[1] : startPoint[2], this.yMax = endPoint[1] > startPoint[2] ? endPoint[1] : startPoint[2];
        // roots where (-b +- sqrt(b*b - 4*a*c)) / 2*a = 0
        let discX = bX * bX - 4 * aX * cX, discY = bY * bY - 4 * aY * cY;
        if (discX >= 0) {
            let t1 = (-bX + Math.sqrt(discX)) / (2*aX), t2 = (-bX - Math.sqrt(discX)) / (2*aX); // from 
            if (t1 > 0 && t1 < 1) {
                let xt = this.evaluateBezier(startPoint[1], controlPoint1[0], controlPoint2[0], endPoint[0], t1);
                if (xt < this.xMin) this.xMin = xt;
                if (xt > this.xMax) this.xMax = xt;
            }
            if (t2 > 0 && t2 < 1) {
                let xt = this.evaluateBezier(startPoint[1], controlPoint1[0], controlPoint2[0], endPoint[0], t2);
                if (xt < this.xMin) this.xMin = xt;
                if (xt > this.xMax) this.xMax = xt;
            }
        }
        if (discY >= 0) {
            let t1 = (-bY + Math.sqrt(discY)) / (2*aY), t2 = (-bY - Math.sqrt(discY)) / (2*aY);
            if (t1 > 0 && t1 < 1) {
                let xt = this.evaluateBezier(startPoint[2], controlPoint1[1], controlPoint2[1], endPoint[1], t1);
                if (xt < this.yMin) this.yMin = xt;
                if (xt > this.yMax) this.yMax = xt;
            }
            if (t2 > 0 && t2 < 1) {
                let xt = this.evaluateBezier(startPoint[2], controlPoint1[1], controlPoint2[1], endPoint[1], t2);
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

export class Arc implements ICurve {

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

    constructor(startPoint: Point, controlPoint: [number, number], endPoint: [number, number], radius: number) {
        this.radius = radius;
        this.controlX = controlPoint[0];
        this.controlY = controlPoint[1];
        this.endX = endPoint[0];
        this.endY = endPoint[1];
        this.getTangentPoints(startPoint);
        this.getCenter(startPoint);
        this.getAngles();
    }

    private getTangentPoints(startPoint: Point) {
        let magTan1 = Math.sqrt((this.controlX - startPoint[1]) * (this.controlX - startPoint[1]) + (this.controlY - startPoint[2]) * (this.controlY - startPoint[2]));
        let magTan2 = Math.sqrt((this.endX - this.controlX) * (this.endX - this.controlX) + (this.endY - this.controlY) * (this.endY - this.controlY));
        let beforeX = (this.controlX - startPoint[1]) / magTan1
        let beforeY = (this.controlY - startPoint[2]) / magTan1;
        let afterX = (this.endX - this.controlX) / magTan2;
        let afterY = (this.endY - this.controlY) / magTan2;
        let dist =  Math.abs(this.radius * (1 - (beforeX * afterX + beforeY * afterY)) / (beforeX * afterY - beforeY * afterX));
        this.tangent1X = this.controlX - dist * beforeX;
        this.tangent1Y = this.controlY - dist * beforeY;
        this.tangent2X = this.controlX + dist * afterX;
        this.tangent2Y = this.controlY + dist * afterY;
    }

    private getCenter(startPoint: Point) {
        let mInv = - (this.controlX - startPoint[1]) / (this.controlY - startPoint[2]);
        this.centerX = this.tangent1X + Math.sqrt(this.radius*this.radius/(1+mInv*mInv));
        this.centerY = this.tangent1Y + (this.centerX - this.tangent1X) * mInv;
    }

    private getAngles() {
        this.startAngle = Math.atan2(this.tangent1Y - this.centerY, this.tangent1X - this.centerX);
        this.endAngle = Math.atan2(this.tangent2Y - this.centerY, this.tangent2X - this.centerX);
    }

    getStartPoint(): Point {
        return ["L", this.tangent1X, this.tangent1Y];
    }

    getEndPoint(): Point {
        return ["M", this.tangent2X, this.tangent2Y];
    }

    intersects(rect: [number,number,number,number]) {
        let x0 = rect[0] - this.radius, 
            y0 = rect[1] - this.radius, 
            x1 = rect[0] + rect[2] + this.radius,
            y1 = rect[1] + rect[3] + this.radius;
        if (!(this.centerX > x0 && this.centerY > y0 && this.centerX < x1 && this.centerY < y1)) {
            return false;
        }
        // Translate rect so that circle is centred at 0,0
        rect[0] -= this.centerX;
        rect[1] -= this.centerY;
        // bottom line
        if (this.intersectsHorizontalSegment(rect[0], rect[0] + rect[2], rect[1] + rect[3])) return true;
        // right line
        if (this.intersectsVerticalSegment(rect[1], rect[1] + rect[3], rect[0] + rect[2])) return true;
        // top line
        if (this.intersectsHorizontalSegment(rect[0], rect[0] + rect[2], rect[1])) return true;
        // left line
        if (this.intersectsVerticalSegment(rect[1], rect[1] + rect[3], rect[0])) return true;
        return false;
    }

    private intersectsHorizontalSegment(startPoint: number, endPoint: number, axisDistance: number) {
        // x^2 + y^2 = r^2
        // y = mx + c with m = 0 => y = c = axisDistance
        // x^2 + axisDistance^2 = r^2, x = sqrt(r^2 - axisDistance^2)
        if (this.radius < Math.abs(axisDistance)) return false; // if radius < |axisDistance - centreX| then no intsct (centreX = 0);
        let xIntcpt1 = Math.sqrt(this.radius * this.radius - axisDistance * axisDistance), xIntcpt2 = -xIntcpt1;
        // Intcpt at (xIntcpt, axisDistance) and (-xIntcpt, axisDistance) -> must check if this point is within segments (circle & line)
        let angle1 = Math.atan2(axisDistance, xIntcpt1);
        //if (angle1 >= this.startAngle && angle1 <= this.endAngle && xIntcpt1 >= startPoint && xIntcpt1 <= endPoint) return true;
        if (this.betweenArc(angle1) && xIntcpt1 >= startPoint && xIntcpt1 <= endPoint) return true;
        let angle2 = Math.atan2(axisDistance, xIntcpt2);
        //if (angle2 >= this.startAngle && angle2 <= this.endAngle && xIntcpt2 >= startPoint && xIntcpt2 <= endPoint) return true;
        if (this.betweenArc(angle2) && xIntcpt2 >= startPoint && xIntcpt2 <= endPoint) return true;
        return false;
    }

    private intersectsVerticalSegment(startPoint: number, endPoint: number, axisDistance: number) {
        // x^2 + y^2 = r^2
        // y = mx + c with m = undefined... x = (y - c) / undefined
        // y^2 + axisDistance^2 = r^2, y = sqrt(r^2 - axisDistance^2)
        if (this.radius < Math.abs(axisDistance)) return false; // if radius < |axisDistance - centreX| then no intsct (centreX = 0);
        let yIntcpt1 = Math.sqrt(this.radius * this.radius - axisDistance * axisDistance), yIntcpt2 = -yIntcpt1;
        // Intcpt at (axisDistance, yIntcpt) and (axisDistance, -yIntcpt) -> must check if this point is within segments (circle & line)
        let angle1 = Math.atan2(yIntcpt1, axisDistance);
        //if (angle1 >= this.startAngle && angle1 <= this.endAngle && yIntcpt1 >= startPoint && yIntcpt1 <= endPoint) return true;
        if (this.betweenArc(angle1) && yIntcpt1 >= startPoint && yIntcpt1 <= endPoint) return true;
        let angle2 = Math.atan2(yIntcpt2, axisDistance);
        //if (angle2 >= this.startAngle && angle2 <= this.endAngle && yIntcpt2 >= startPoint && yIntcpt2 <= endPoint) return true;
        if (this.betweenArc(angle2) && yIntcpt2 >= startPoint && yIntcpt2 <= endPoint) return true;
        return false;
    }

    // This needs fixed but brain not working so committing and taking a break
    private betweenArc(angle: number) {
        return angle >= this.startAngle && angle <= this.endAngle;
    }

}