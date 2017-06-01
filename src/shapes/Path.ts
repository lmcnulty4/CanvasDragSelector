import { IShape } from "./base";
import { TransformMatrix } from "../ContextCurrentTransformPolyfill";
import { Rectangle } from "./Rectangle";
import { CubicBezierCurve } from "./CubicBezier";
import { QuadraticBezierCurve } from "./QuadraticBezier";
import { Arc } from "./Arc";

type Point = ["M" | "L" | "Z" | "Q" | "C" | "A", number, number];
type BezierCurve = ["Q" | "C" | "A", CubicBezierCurve | QuadraticBezierCurve | Arc];

export class Path implements IShape {

    readonly boundingBox: [number, number, number, number];
    private xform: TransformMatrix;
    private subPath: (Point | BezierCurve)[];

    constructor(context: CanvasRenderingContext2D) {
        this.xform = (<any>context).currentTransform;
        this.subPath = [];
    }

    moveTo(x: number, y: number) {
        this.subPath.push(["M", x, y]);
    }

    lineTo(x: number, y: number) {
        this.ensureSubpathExists();
        this.subPath.push(["L", x, y]);
    }

    closePath() {
        if (this.subPath.length > 0) this.subPath.push(["Z", null, null]);
    }

    quadraticCurveTo(cpX: number, cpY: number, endPointX: number, endPointY: number) {
        this.ensureSubpathExists();
        let startPoint = this.getPreviousEndPoint();
        this.subPath.push(["Q", new QuadraticBezierCurve(startPoint[0], startPoint[1], cpX, cpY, endPointX, endPointY)]);
    }

    bezierCurveTo(controlPoint1X: number, controlPoint1Y: number, controlPoint2X: number, controlPoint2Y: number, endPointX: number, endPointY: number) {
        this.ensureSubpathExists();
        let startPoint = this.getPreviousEndPoint();
        this.subPath.push(["C", new CubicBezierCurve(startPoint[0], startPoint[1], controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y, endPointX, endPointY)]);
    }

    arcTo(cpX: number, cpY: number, endPointX: number, endPointY: number, radius: number) {
        this.ensureSubpathExists();
        let startPoint = this.getPreviousEndPoint();
        let arc = new Arc(startPoint[0], startPoint[1], cpX, cpY, endPointX, endPointY, radius);
        let arcStart = arc.getStartPoint();
        if (!(arcStart[1] === startPoint[1] && arcStart[2] === startPoint[2])) {
            this.subPath.push(["L", arcStart[0], arcStart[1]]);
        }
        this.subPath.push(["A", arc]);
    }

    private getPreviousEndPoint(): [number, number] {
        let prevPath = this.subPath[this.subPath.length - 1];
        if (prevPath instanceof QuadraticBezierCurve || prevPath instanceof CubicBezierCurve || prevPath instanceof Arc) {
            return prevPath.getEndPoint();
        } else {
            return [<any>prevPath[1], <any>prevPath[2]];
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
                let endPoint = (<QuadraticBezierCurve>currentSegment[1]).getEndPoint();
                previousSegment = ["Q", endPoint[0], endPoint[1]];
            } else if (currentSegment[0] === "C") {
                if ((<CubicBezierCurve>currentSegment[1]).intersects(transformedRect)) {
                    return true;
                }
                let endPoint = (<CubicBezierCurve>currentSegment[1]).getEndPoint();
                previousSegment = ["C", endPoint[0], endPoint[1]];
            } else if (currentSegment[0] === "A") {
                if ((<Arc>currentSegment[1]).intersects(transformedRect)) {
                    return true;
                }
                let endPoint = (<Arc>currentSegment[1]).getEndPoint();
                previousSegment = ["A", endPoint[0], endPoint[1]];
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