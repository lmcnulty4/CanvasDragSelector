import { IShape } from "./base";
import { TransformMatrix } from "../ContextCurrentTransformPolyfill";
import { Rectangle } from "./Rectangle";

type Point = [number, number, "M" | "L" | "Z"]; // [x, y, type]

export class Path implements IShape {

    readonly boundingBox: [number, number, number, number];
    private xform: TransformMatrix;
    private points: Point[];
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
                if (this.lineIntersectsRect(previousSegment, currentSegment, transformedRect)) {
                    return true;
                }
            } else if (currentSegment[2] === "Z") {
                if (this.lineIntersectsRect(previousSegment, segmentInitialSubPath, transformedRect)) {
                    return true;
                }
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
            this.cornersSameSide([bottomLeft, bottomRight, topRight, topLeft], lineStart, lineEnd));
    }

    private endProject(lineStart: Point, lineEnd: Point, tl: [number, number], tr: [number, number], br: [number, number], bl: [number, number]) {
        if (lineStart[1] > tr[1] && lineEnd[1] > tr[1]) return false;
        if (lineStart[1] < bl[1] && lineEnd[1] < bl[1]) return false;
        if (lineStart[0] > tr[0] && lineEnd[0] > tr[0]) return false;
        if (lineStart[0] < bl[0] && lineEnd[0] < bl[0]) return false;
        return true;
    }

    private cornersSameSide(corners: [[number, number], [number, number], [number, number], [number, number]], lineStart: Point, lineEnd: Point) {
        let xC = lineStart[0] - lineEnd[0];
        let yC = lineEnd[1] - lineStart[1]; 
        let os = lineEnd[0] * lineStart[1] - lineStart[0] * lineEnd[1];
        let v: number, sign: number;
        v = corners[3][0] * yC + corners[3][1] * xC + os;
        sign = (v < 0 ? -1 : (v > 0 ? 1 : 0));
        v = corners[2][0] * yC + corners[2][1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        v = corners[1][0] * yC + corners[1][1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        v = corners[0][0] * yC + corners[0][1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        return false;
    }

}