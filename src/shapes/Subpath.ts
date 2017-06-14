import { TransformMatrix } from "../ContextCurrentTransformPolyfill";
import { Rectangle } from "./Rectangle";
import { CubicBezierCurve } from "./CubicBezier";
import { QuadraticBezierCurve } from "./QuadraticBezier";
import { Arc } from "./Arc";
import { ICanvasContext } from "../TrackingContext";

type Point = ["M" | "L" | "Z" | "Q" | "C" | "A", number, number];
type Curve = ["Q" | "C" | "A", CubicBezierCurve | QuadraticBezierCurve | Arc];

export class Subpath {

    private boundingBox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    private xform: TransformMatrix;
    private subPath: (Point | Curve)[];
    private curSubpathStartPoint: [number, number];
    private containedPoints: boolean[][] = [];

    constructor(context: CanvasRenderingContext2D) {
        this.xform = (<any>context).currentTransform;
        this.subPath = [];
    }

    render(context: ICanvasContext) {
        for (let i = 0, l = this.subPath.length; i < l; i++) {
            let seg = this.subPath[i];
            switch (seg[0]) {
                case "M": context.moveTo((<Point>seg)[1], (<Point>seg)[2]); break;
                case "L": context.lineTo((<Point>seg)[1], (<Point>seg)[2]); break;
                case "Z": context.closePath(); break;
                case "Q": (<Curve>seg)[1].render(context); break;
                case "C": (<Curve>seg)[1].render(context); break;
                case "A": (<Curve>seg)[1].render(context); break;
            }
        }
    }

    private setBounds(x: number, y: number) {
        this.boundingBox[0] = Math.min(x, this.boundingBox[0]);
        this.boundingBox[1] = Math.min(y, this.boundingBox[1]);
        this.boundingBox[2] = Math.max(x, this.boundingBox[2]);
        this.boundingBox[3] = Math.max(y, this.boundingBox[3]);
    }

    moveTo(x: number, y: number) {
        this.subPath.push(["M", x, y]);
        this.curSubpathStartPoint = [x, y];
        this.setBounds(x, y);
    }

    lineTo(x: number, y: number) {
        this.ensureSubpathExists();
        this.subPath.push(["L", x, y]);
        this.setBounds(x, y);
    }

    closePath() {
        if (this.subPath.length > 0) this.subPath.push(["Z", this.curSubpathStartPoint[0], this.curSubpathStartPoint[1]]);
    }

    quadraticCurveTo(cpX: number, cpY: number, endPointX: number, endPointY: number) {
        this.ensureSubpathExists();
        let startPoint = this.getEndPointAtIndex(this.subPath.length - 1);
        this.subPath.push(["Q", new QuadraticBezierCurve(startPoint[0], startPoint[1], cpX, cpY, endPointX, endPointY)]);
        let bounds = (<QuadraticBezierCurve>this.subPath[this.subPath.length-1][1]).getBounds();
        this.setBounds(bounds[0], bounds[1]);
        this.setBounds(bounds[2], bounds[3]);
    }

    bezierCurveTo(controlPoint1X: number, controlPoint1Y: number, controlPoint2X: number, controlPoint2Y: number, endPointX: number, endPointY: number) {
        this.ensureSubpathExists();
        let startPoint = this.getEndPointAtIndex(this.subPath.length - 1);
        this.subPath.push(["C", new CubicBezierCurve(startPoint[0], startPoint[1], controlPoint1X, controlPoint1Y, controlPoint2X, controlPoint2Y, endPointX, endPointY)]);
        let bounds = (<CubicBezierCurve>this.subPath[this.subPath.length-1][1]).getBounds();
        this.setBounds(bounds[0], bounds[1]);
        this.setBounds(bounds[2], bounds[3]);
    }

    arcTo(cpX: number, cpY: number, endPointX: number, endPointY: number, radius: number) {
        this.ensureSubpathExists();
        let startPoint = this.getEndPointAtIndex(this.subPath.length - 1);
        let arc = new Arc(startPoint[0], startPoint[1], cpX, cpY, endPointX, endPointY, radius);
        let arcStart = arc.getStartPoint();
        if (!(arcStart[1] === startPoint[1] && arcStart[2] === startPoint[2])) {
            this.subPath.push(["L", arcStart[0], arcStart[1]]);
            this.setBounds(arcStart[0], arcStart[1]);
        }
        this.subPath.push(["A", arc]);
        let bounds = arc.getBounds();
        this.setBounds(bounds[0], bounds[1]);
        this.setBounds(bounds[2], bounds[3]);
    }

    private getEndPointAtIndex(i: number): [number, number] {
        let prevPath = this.subPath[i];
        if (prevPath[0] === "Q" || prevPath[0] === "C" || prevPath[0] === "A") {
            return (<Curve>prevPath)[1].getEndPoint();
        } else {
            return [<any>prevPath[1], <any>prevPath[2]];
        }
    }
    private getStartPointAtIndex(i: number): [number, number] {
        let prevPath = this.subPath[i];
        if (prevPath[0] === "Q" || prevPath[0] === "C" || prevPath[0] === "A") {
            return (<Curve>prevPath)[1].getStartPoint();
        } else {
            return [<any>prevPath[1], <any>prevPath[2]];
        }
    }

    private ensureSubpathExists() {
        if (this.subPath.length === 0) {
            this.subPath.push(["M", 0, 0]);
            this.setBounds(0,0);
        }
    }

    intersects(dimens: [number, number, number, number], anchorPoint:[number, number]) {
        let transformedRect = Rectangle.matrixTransformRect(dimens, this.xform);
        let transformedPoint: [number,number] = anchorPoint;
        if (this.hasVisited(transformedPoint)) return this.containedPoints[transformedPoint[0]][transformedPoint[1]];
        let i = 1, l = this.subPath.length, wn = 0, isClosed = this.isClosed();
        let [prevX, prevY] = this.getEndPointAtIndex(0);
        let [segStartX, segStartY] = [prevX, prevY];
        for (i; i < l; ++i) {
            let curSeg = this.subPath[i];
            switch (curSeg[0]) {
                case "L":
                    wn += isClosed ? this.windLine(prevX, prevY, <number>curSeg[1], <number>curSeg[2], transformedPoint) : 0;
                    if (this.lineIntersectsRect(prevX, prevY, <number>curSeg[1], <number>curSeg[2], transformedRect)) return true;
                    prevX = <number>curSeg[1]; prevY = <number>curSeg[2]; 
                    break;
                case "M":
                    segStartX = <number>curSeg[1]; segStartY = <number>curSeg[2];
                    prevX = <number>curSeg[1]; prevY = <number>curSeg[2]; 
                    break;
                case "Z":
                    wn += isClosed ? this.windLine(prevX, prevY, segStartX, segStartY, transformedPoint) : 0;
                    if (this.lineIntersectsRect(prevX, prevY, segStartX, segStartY, transformedRect)) return true;
                    prevX = segStartX; prevY = segStartY; 
                    break;
                case "Q":
                case "C":
                case "A":
                    wn += isClosed ? ((<Curve>curSeg)[1]).windingNumber(transformedPoint) : 0;
                    if ((<Curve>curSeg)[1].intersects(transformedRect)) return true;
                    let endPoint = (<Curve>curSeg)[1].getEndPoint();
                    prevX = endPoint[0]; prevY = endPoint[1]; 
                    break;
            }
        }
        if (wn !== 0) {
            this.visit(transformedPoint, true);
            return true;
        } else {
            this.visit(transformedPoint, false);
            return false;
        }
    }

    private lineIntersectsRect(lineStartX: number, lineStartY: number, lineEndX: number, lineEndY: number, rect: [number, number, number, number]) {
        // If they are axis aligned then test using Rect intersection with width/height set to 0
        // If both Xs are the same then they are y-axis aligned and have a width = 0 and height = difference between the Y values
        if (lineStartX === lineEndX) return Rectangle.rectanglesIntersect([lineStartX, lineStartY, 0, Math.abs(lineEndY - lineStartY)], rect);
        // If both Ys are the same then they are x-axis aligned and have a height = 0 and width = difference between the X values
        if (lineStartY === lineEndY) return Rectangle.rectanglesIntersect([lineStartX, lineStartY, Math.abs(lineEndX - lineStartX), 0], rect);
        // Else more expensive check
        return (this.endProject(lineStartX, lineStartY, lineEndX, lineEndY, rect) && 
            this.cornersSameSide(lineStartX, lineStartY, lineEndX, lineEndY, rect));
    }

    private endProject(lineStartX: number, lineStartY: number, lineEndX: number, lineEndY: number, rect: [number, number, number, number]) {
        if (lineStartY > rect[1] + rect[3] && lineEndY > rect[1] + rect[3]) return false;
        if (lineStartY < rect[1] && lineEndY < rect[1]) return false;
        if (lineStartX > rect[0] + rect[2] && lineEndX > rect[0] + rect[2]) return false;
        if (lineStartX < rect[0] && lineEndX < rect[0]) return false;
        return true;
    }

    private cornersSameSide(lineStartX: number, lineStartY: number, lineEndX: number, lineEndY: number, rect: [number, number, number, number]) {
        let xC = lineStartX - lineEndX;
        let yC = lineEndY - lineStartY; 
        let os = lineEndX * lineStartY - lineStartX * lineEndY;
        let v: number, sign: number;
        v = rect[0] * yC + (rect[1] + rect[3]) * xC + os;
        sign = (v < 0 ? -1 : (v > 0 ? 1 : 0));
        v = (rect[0] + rect[2]) * yC + (rect[1] + rect[3]) * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        v = (rect[0] + rect[2]) * yC + rect[1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        v = rect[0] * yC + rect[1] * xC + os;
        if ((v < 0 && sign > 0) || (v > 0 && sign < 0)) return true;
        return false;
    }
    
    private hasVisited(point: [number, number]) {
        if (!this.containedPoints[point[0]]) { this.containedPoints[point[0]] = [] };
        return typeof this.containedPoints[point[0]][point[1]] !== "undefined";
    }
    private visit(point: [number, number], isContained: boolean) {
        if (!this.containedPoints[point[0]]) { this.containedPoints[point[0]] = [] };
        this.containedPoints[point[0]][point[1]] = isContained;
    }

    private windLine(fromX: number, fromY: number, toX: number, toY: number, point: [number, number]) {
        let wn = 1, y0 = fromY, y1 = toY;
        if (fromY > toY) { wn = -1; y0 = toY; y1 = fromY; }
        if (point[1] < y0 || point[1] >= y1) return 0;
        let cross = (toX - fromX) * (point[1] - fromY) - (point[0] - fromX) * (toY - fromY);
        return (cross === 0) || (cross < 0 && wn < 0) || (cross > 0 && wn > 0) ? 0 : wn;
    }

    private isClosed() {
        if (this.subPath.length === 0) return true;
        if (this.subPath[this.subPath.length - 1][0] === "Z") return true;
        let startPoint = this.subPath[0], endPoint = this.getEndPointAtIndex(this.subPath.length - 1)
        if (startPoint instanceof QuadraticBezierCurve || startPoint instanceof CubicBezierCurve || startPoint instanceof Arc) {
            let sp = startPoint.getEndPoint();
            return sp[0] === endPoint[0] && sp[1] === endPoint[1];
        } else {
            return startPoint[1] === endPoint[0] && startPoint[2] === endPoint[1];
        }
    }

}