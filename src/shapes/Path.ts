import { IShape } from "./base";
import { TransformMatrix } from "../ContextCurrentTransformPolyfill";
import { Rectangle } from "./Rectangle";

type Point = [number, number, "M" | "L" | "Z"]; // x, y, type
type QuadraticCurve = [number, number, number, number, "Q"]; // CPx, CPy, x, y, type
type CuberBezierCurve = [number, number, number, number, number, number, "C"]; // CP1x, CP1y, CP2x, CP2y, x, y, type

export class Path implements IShape {

    readonly boundingBox: [number, number, number, number];
    private xform: TransformMatrix;
    private points: (Point | QuadraticCurve | CuberBezierCurve)[];
    private pointType: number;

    constructor(context: CanvasRenderingContext2D) {
        this.xform = (<any>context).currentTransform;
        this.pointType = 0;
        this.points = [];
    }

    moveTo(point: [number, number]) {
        this.points.push([point[0], point[1], "M"]);
    }

    lineTo(point: [number, number]) {
        this.points.push([point[0], point[1], "L"]);
    }

    closePath() {
        this.points.push([null, null, "Z"]);
    }

    // TODO: quadraticCurveTo, bezierCurveTo, arcTo -- all done via resampling unless can find a more optimal way
    quadraticCurveTo(controlPoint: [number, number], endPoint: [number, number]) {
        this.points.push([controlPoint[0], controlPoint[1], endPoint[0], endPoint[1], "Q"]);
    }

    bezierCurveTo(controlPoint1: [number, number], controlPoint2: [number, number], endPoint: [number, number]) {
        this.points.push([controlPoint1[0], controlPoint1[1], controlPoint2[0], controlPoint2[1], endPoint[0], endPoint[1], "C"]);
    }

    intersects(dimens: [number, number, number, number]) {
        let transformedRect = Rectangle.matrixTransformRect(dimens, this.xform);
        let i = 1, l = this.points.length;
        let previousSegment = this.points[0];
        let segmentInitialSubPath = this.points[0];
        for (i; i < l; ++i) {
            let currentSegment = this.points[i];
            if (currentSegment[2] === "M") {
                segmentInitialSubPath = currentSegment;
            } else if (currentSegment[2] === "L") {
                if (this.lineIntersectsRect(<Point>previousSegment, <Point>currentSegment, transformedRect)) {
                    return true;
                }
            } else if (currentSegment[2] === "Z") {
                if (this.lineIntersectsRect(<Point>previousSegment, <Point>segmentInitialSubPath, transformedRect)) {
                    return true;
                }
            } else if (currentSegment[4] === "Q") {

            } else if (currentSegment[6] === "C") {
                let bezierPoints = [
                    (-previousSegment[0] + 3*currentSegment[0] + -3*(<CuberBezierCurve>currentSegment)[2] + (<CuberBezierCurve>currentSegment)[4]), // P0x
                    (-previousSegment[1] + 3*currentSegment[1] + -3*(<CuberBezierCurve>currentSegment)[3] + (<CuberBezierCurve>currentSegment)[5]), // P0y
                    (3*previousSegment[0] - 6*currentSegment[0] + 3*(<CuberBezierCurve>currentSegment)[2]), (3*previousSegment[1] - 6*currentSegment[1] + 3*(<CuberBezierCurve>currentSegment)[3]), // P1x, P1y
                    (-3*previousSegment[0] + 3*currentSegment[0]), (-3*previousSegment[1] + 3*currentSegment[1]), // P2x, P2y
                    previousSegment[0], previousSegment[1] // P3x, P3y
                ];
                // x, y, x+w, y
                if (this.bezierIntersectsLineSegment(bezierPoints, [transformedRect[0], transformedRect[1], transformedRect[0] + transformedRect[2], transformedRect[1]])) return true;
                // x+w, y, x+w, y+h
                if (this.bezierIntersectsLineSegment(bezierPoints, [transformedRect[0] + transformedRect[2], transformedRect[1], transformedRect[0] + transformedRect[2], transformedRect[1] + transformedRect[3]])) return true;
                // x+w, y+h, x, y+h
                if (this.bezierIntersectsLineSegment(bezierPoints, [transformedRect[0] + transformedRect[2], transformedRect[1] + transformedRect[3], transformedRect[0], transformedRect[1] + transformedRect[3]])) return true;
                // x, y+h, x, y
                if (this.bezierIntersectsLineSegment(bezierPoints, [transformedRect[0], transformedRect[1] + transformedRect[3], transformedRect[0], transformedRect[1]])) return true;
            }
            previousSegment = currentSegment;
        }
        return false;
    }

    private lineIntersectsRect(lineStart: Point, lineEnd: Point, rect: [number, number, number, number]) {
        // If they are axis aligned then test using Rect intersection with width/height set to 0
        // If both Xs are the same then they are y-axis aligned and have a width = 0 and height = difference between the Y values
        if (lineStart[0] === lineEnd[0]) return Rectangle.rectanglesIntersect([lineStart[0], lineStart[1], 0, Math.abs(lineEnd[1] - lineStart[1])], rect);
        // If both Ys are the same then they are x-axis aligned and have a height = 0 and width = difference between the X values
        if (lineStart[1] === lineEnd[1]) return Rectangle.rectanglesIntersect([lineStart[0], lineStart[1], Math.abs(lineEnd[0] - lineStart[0]), 0], rect);
        // Else more expensive check
        let bottomLeft: [number, number] = [rect[0], rect[1]];
        let topLeft: [number, number] = [rect[0], rect[1] + rect[3]];
        let topRight: [number, number] = [rect[0] + rect[2], rect[1] + rect[3]];
        let bottomRight: [number, number] = [rect[0] + rect[2], rect[1]];
        return (this.endProject(lineStart, lineEnd, topLeft, topRight, bottomRight, bottomLeft) && 
            this.cornersSameSide(lineStart, lineEnd, bottomLeft, bottomRight, topRight, topLeft));
    }

    private endProject(lineStart: Point, lineEnd: Point, tl: [number, number], tr: [number, number], br: [number, number], bl: [number, number]) {
        if (lineStart[1] > tr[1] && lineEnd[1] > tr[1]) return false;
        if (lineStart[1] < bl[1] && lineEnd[1] < bl[1]) return false;
        if (lineStart[0] > tr[0] && lineEnd[0] > tr[0]) return false;
        if (lineStart[0] < bl[0] && lineEnd[0] < bl[0]) return false;
        return true;
    }

    private cornersSameSide(lineStart: Point, lineEnd: Point, bottomLeft: [number, number], bottomRight: [number, number], topRight: [number, number], topLeft: [number, number]) {
        let xC = lineStart[0] - lineEnd[0];
        let yC = lineEnd[1] - lineStart[1]; 
        let os = lineEnd[0] * lineStart[1] - lineStart[0] * lineEnd[1];
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

    private bezierIntersectsLineSegment(bezierPoints: number[], lineSegment: [number, number, number, number]) {
        let A = lineSegment[3] - lineSegment[1], B = lineSegment[0] - lineSegment[2];
        let C = lineSegment[0]*(lineSegment[1] - lineSegment[3]) + lineSegment[1]*(lineSegment[2] - lineSegment[0]);
        return this.hasCubicRootInSegment(
            A*bezierPoints[0] + B*bezierPoints[1],
            A*bezierPoints[2] + B*bezierPoints[3],
            A*bezierPoints[4] + B*bezierPoints[5],
            A*bezierPoints[6] + B*bezierPoints[7] + C,
            lineSegment,
            bezierPoints
        );
    }

    private hasCubicRootInSegment(a: number, b: number, c: number, d: number, lineSegment: [number, number, number, number], bezierPoints: number[]): boolean {
        let A = b/a;
        let B = c/a;
        let C = d/a;
        let Q = (3*B - A*A)/9;
        let R = (9 *A*B - 27*C - 2*A*A*A)/54;
        let D = Q*Q*Q + R*R;
        if (D >= 0) {
            let S = (R + Math.sqrt(D) < 0 ? -1 : 1) * Math.pow(Math.abs(R + Math.sqrt(D)),(1/3));
            let T = (R - Math.sqrt(D) < 0 ? -1 : 1) * Math.pow(Math.abs(R - Math.sqrt(D)),(1/3));
            let root0 = -A/3 + (S + T);
            if (root0 > 0 && root0 < 1 && this.withinSegment(root0, lineSegment, bezierPoints)) return true;
            if (Math.abs(0.86602540375*(S - T)) !== 0) return false; // constant = (sqr root 3)/2 
            let root1 = -A/3 - (S + T)/2;
            if (root1 > 0 && root1 < 1 && this.withinSegment(root1, lineSegment, bezierPoints)) return true;
        } else {
            let th = Math.acos(R / Math.sqrt(-(Q*Q*Q)));
            let coef = 2*Math.sqrt(-Q); 
            let root0 = coef * Math.cos(th/3) - A/3;
            if (root0 > 0 && root0 < 1 && this.withinSegment(root0, lineSegment, bezierPoints)) return true;
            let root1 = coef * Math.cos((th + 2*Math.PI)/3) - A/3;
            if (root1 > 0 && root1 < 1 && this.withinSegment(root1, lineSegment, bezierPoints)) return true;
            let root2 = coef * Math.cos((th + 4*Math.PI)/3) - A/3;
            if (root2 > 0 && root2 < 1 && this.withinSegment(root2, lineSegment, bezierPoints)) return true;
        }
        return false;
    }

    private withinSegment(t: number, lineSegment: [number, number, number, number], bezierPoints: number[]) {
        let x0 = bezierPoints[0]*t*t*t + bezierPoints[2]*t*t + bezierPoints[4]*t + bezierPoints[6];
        let x1 = bezierPoints[1]*t*t*t + bezierPoints[3]*t*t + bezierPoints[5]*t + bezierPoints[7];
        let s: number;
        if ((lineSegment[2] - lineSegment[0]) !== 0) {
            s = (x0 - lineSegment[0])/(lineSegment[2] - lineSegment[0]);
        } else {
            s = (x1 - lineSegment[1])/(lineSegment[3] - lineSegment[1]);
        }
        return s > 0 && s < 1;
    }

}

export class QuadraticBezierCurve {

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
        this.startX = startPoint[0];
        this.startY = startPoint[1];
        this.endX = endPoint[0];
        this.endY = endPoint[1];
        this.mbX = -2 * (startPoint[0] - controlPoint[0]);
        this.mbY = -2 * (startPoint[1] - controlPoint[1]);
        this.taX = 2 * (startPoint[0] - controlPoint[0] - controlPoint[0] + endPoint[0]);
        this.taY = 2 * (startPoint[1] - controlPoint[1] - controlPoint[1] + endPoint[1]);
        this.qX = this.mbX * this.mbX - 2 * (this.taX * startPoint[0]);
        this.qY = this.mbY * this.mbY - 2 * (this.taY * startPoint[1]);
        this.calculateAABB(startPoint, controlPoint, endPoint);
    }

    private calculateAABB(startPoint: Point, controlPoint: [number, number], endPoint: [number, number]) {
        // t value for derivative
        let tX = -this.mbX / this.taX;
        let tY = -this.mbY / this.taY;
        // Set bounds
        this.xMin = endPoint[0] < startPoint[0] ? endPoint[0] : startPoint[0], this.xMax = endPoint[0] > startPoint[0] ? endPoint[0] : startPoint[0];
        this.yMin = endPoint[1] < startPoint[1] ? endPoint[1] : startPoint[1], this.yMax = endPoint[1] > startPoint[1] ? endPoint[1] : startPoint[1];
        if (tX > 0 && tX < 1) {
            let xt = this.evaluateBezier(startPoint[0], controlPoint[0], endPoint[0], tX);
            if (xt < this.xMin) this.xMin = xt;
            if (xt > this.xMax) this.xMax = xt;
        }
        if (tY > 0 && tY < 1) {
            let xt = this.evaluateBezier(startPoint[1], controlPoint[1], endPoint[1], tY);
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
        if (this.curveIntersectsLine(this.mbY, this.taY, this.qY, (rect[1] + rect[3]), this.taX, this.mbX, this.endX, rect[0], rect[0] + rect[2])) return true;
        // right line
        if (this.curveIntersectsLine(this.mbX, this.taX, this.qX, rect[0] + rect[2], this.taY, this.mbY, this.endY, rect[1], rect[1] + rect[3])) return true;
        // top line
        if (this.curveIntersectsLine(this.mbY, this.taY, this.qY, rect[1], this.taX, this.mbX, this.endX, rect[0], rect[0] + rect[2])) return true;
        // left line
        if (this.curveIntersectsLine(this.mbX, this.taX, this.qX, rect[0], this.taY, this.mbY, this.endY, rect[1], rect[1] + rect[3])) return true;
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

class CubicBezierCurve {

    // These P0, P1, P2 and P3 are from the cubic x = P0(t^3) + P1(t^2) + P2(t) + P3 (and similarly for y)
    // I've gone off arrays
    private p0x: number;
    private p0y: number;
    private p1x: number;
    private p1y: number;
    private p2x: number;
    private p2y: number;
    private p3x: number;
    private p3y: number;
    private endX: number;
    private endY: number;
    private xMin: number;
    private xMax: number;
    private yMin: number;
    private yMax: number;

    constructor(startPoint: Point, controlPoint1: [number, number], controlPoint2: [number, number], endPoint: [number, number]) {
        this.p0x = (-startPoint[0] + 3*controlPoint1[0] + -3*controlPoint2[0] + endPoint[0]);
        this.p0y = (-startPoint[1] + 3*controlPoint1[1] + -3*controlPoint2[1] + endPoint[1]);
        this.p1x = (3*startPoint[0] - 6*controlPoint1[0] + 3*controlPoint2[0]);
        this.p1y = (3*startPoint[1] - 6*controlPoint1[1] + 3*controlPoint2[1]);
        this.p2x = (-3*startPoint[0] + 3*controlPoint1[0]);
        this.p2y = (-3*startPoint[1] + 3*controlPoint1[1]);
        this.p3x = startPoint[0];
        this.p3y = startPoint[1];
        this.endX = endPoint[0];
        this.endY = endPoint[1];
        this.calculateAABB(startPoint, controlPoint1, controlPoint2, endPoint);
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
        this.xMin = endPoint[0] < startPoint[0] ? endPoint[0] : startPoint[0], this.xMax = endPoint[0] > startPoint[0] ? endPoint[0] : startPoint[0];
        this.yMin = endPoint[1] < startPoint[1] ? endPoint[1] : startPoint[1], this.yMax = endPoint[1] > startPoint[1] ? endPoint[1] : startPoint[1];
        // roots where (-b +- sqrt(b*b - 4*a*c)) / 2*a = 0
        let discX = bX * bX - 4 * aX * cX, discY = bY * bY - 4 * aY * cY;
        if (discX >= 0) {
            let t1 = (-bX + Math.sqrt(discX)) / (2*aX), t2 = (-bX - Math.sqrt(discX)) / (2*aX); // from 
            if (t1 > 0 && t1 < 1) {
                let xt = this.evaluateBezier(startPoint[0], controlPoint1[0], controlPoint2[0], endPoint[0], t1);
                if (xt < this.xMin) this.xMin = xt;
                if (xt > this.xMax) this.xMax = xt;
            }
            if (t2 > 0 && t2 < 1) {
                let xt = this.evaluateBezier(startPoint[0], controlPoint1[0], controlPoint2[0], endPoint[0], t2);
                if (xt < this.xMin) this.xMin = xt;
                if (xt > this.xMax) this.xMax = xt;
            }
        }
        if (discY >= 0) {
            let t1 = (-bY + Math.sqrt(discY)) / (2*aY), t2 = (-bY - Math.sqrt(discY)) / (2*aY);
            if (t1 > 0 && t1 < 1) {
                let xt = this.evaluateBezier(startPoint[1], controlPoint1[1], controlPoint2[1], endPoint[1], t1);
                if (xt < this.yMin) this.yMin = xt;
                if (xt > this.yMax) this.yMax = xt;
            }
            if (t2 > 0 && t2 < 1) {
                let xt = this.evaluateBezier(startPoint[1], controlPoint1[1], controlPoint2[1], endPoint[1], t2);
                if (xt < this.yMin) this.yMin = xt;
                if (xt > this.yMax) this.yMax = xt;
            }
        }
    }

    intersects(rect: [number, number, number, number]): boolean {
        // If either start or end point is inside rect, it intersects
        if (rect[0] <= this.p3x && rect[0] + rect[2] >= this.p3x && rect[1] <= this.p3y && rect[1] + rect[3] >= this.p3y) return true;
        if (rect[0] <= this.endX && rect[0] + rect[2] >= this.endX && rect[1] <= this.endY && rect[1] + rect[3] >= this.endY) return true;
        // If it doesn't intersect bounding box, exit
        let width = this.xMax - this.xMin,
            height = this.yMax - this.yMin;
        if (!Rectangle.rectanglesIntersect(rect, [this.xMin, this.yMin, width, height])) return false;
        return true;
    }

    // https://www.particleincell.com/2013/cubic-line-intersection/
    // Optimisations will be made soon, due to lines always being axis aligned
    private hasCubicRootInSegment(a: number, b: number, c: number, d: number, lineSegment: [number, number, number, number], bezierPoints: number[]): boolean {
        let A = b/a;
        let B = c/a;
        let C = d/a;
        let Q = (3*B - A*A)/9;
        let R = (9 *A*B - 27*C - 2*A*A*A)/54;
        let D = Q*Q*Q + R*R;
        if (D >= 0) {
            let S = (R + Math.sqrt(D) < 0 ? -1 : 1) * Math.pow(Math.abs(R + Math.sqrt(D)),(1/3));
            let T = (R - Math.sqrt(D) < 0 ? -1 : 1) * Math.pow(Math.abs(R - Math.sqrt(D)),(1/3));
            let root0 = -A/3 + (S + T);
            if (root0 > 0 && root0 < 1 && this.withinSegment(root0, lineSegment, bezierPoints)) return true;
            if (Math.abs(0.86602540375*(S - T)) !== 0) return false; // constant = (sqr root 3)/2 
            let root1 = -A/3 - (S + T)/2;
            if (root1 > 0 && root1 < 1 && this.withinSegment(root1, lineSegment, bezierPoints)) return true;
        } else {
            let th = Math.acos(R / Math.sqrt(-(Q*Q*Q)));
            let coef = 2*Math.sqrt(-Q); 
            let root0 = coef * Math.cos(th/3) - A/3;
            if (root0 > 0 && root0 < 1 && this.withinSegment(root0, lineSegment, bezierPoints)) return true;
            let root1 = coef * Math.cos((th + 2*Math.PI)/3) - A/3;
            if (root1 > 0 && root1 < 1 && this.withinSegment(root1, lineSegment, bezierPoints)) return true;
            let root2 = coef * Math.cos((th + 4*Math.PI)/3) - A/3;
            if (root2 > 0 && root2 < 1 && this.withinSegment(root2, lineSegment, bezierPoints)) return true;
        }
        return false;
    }

    private withinSegment(t: number, lineSegment: [number, number, number, number], bezierPoints: number[]) {
        let x0 = bezierPoints[0]*t*t*t + bezierPoints[2]*t*t + bezierPoints[4]*t + bezierPoints[6];
        let x1 = bezierPoints[1]*t*t*t + bezierPoints[3]*t*t + bezierPoints[5]*t + bezierPoints[7];
        let s: number;
        if ((lineSegment[2] - lineSegment[0]) !== 0) {
            s = (x0 - lineSegment[0])/(lineSegment[2] - lineSegment[0]);
        } else {
            s = (x1 - lineSegment[1])/(lineSegment[3] - lineSegment[1]);
        }
        return s > 0 && s < 1;
    }
}