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