import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";
import { ICanvasContext } from "../TrackingContext";

export class Arc implements IShape {

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
    private TAU = 2 * Math.PI;

    constructor(startPointX: number, startPointY: number, cpX: number, cpY: number, endPointX: number, endPointY: number, radius: number) {
        this.radius = radius;
        this.controlX = cpX;
        this.controlY = cpY;
        this.endX = endPointX;
        this.endY = endPointY;
        this.getTangentPoints(startPointX, startPointY);
        this.getCenter(startPointX, startPointY);
        this.getAngles();
    }
    
    render(context: ICanvasContext) {
        context.arcTo(this.controlX, this.controlY, this.endX, this.endY, this.radius);
    }

    private getTangentPoints(startPointX: number, startPointY: number) {
        let magTan1 = Math.sqrt((this.controlX - startPointX) * (this.controlX - startPointX) + (this.controlY - startPointY) * (this.controlY - startPointY));
        let magTan2 = Math.sqrt((this.endX - this.controlX) * (this.endX - this.controlX) + (this.endY - this.controlY) * (this.endY - this.controlY));
        let beforeX = (this.controlX - startPointX) / magTan1
        let beforeY = (this.controlY - startPointY) / magTan1;
        let afterX = (this.endX - this.controlX) / magTan2;
        let afterY = (this.endY - this.controlY) / magTan2;
        let dist =  Math.abs(this.radius * (1 - (beforeX * afterX + beforeY * afterY)) / (beforeX * afterY - beforeY * afterX));
        this.tangent1X = this.controlX - dist * beforeX;
        this.tangent1Y = this.controlY - dist * beforeY;
        this.tangent2X = this.controlX + dist * afterX;
        this.tangent2Y = this.controlY + dist * afterY;
    }

    private getCenter(startPointX: number, startPointY: number) {
        let mInv = - (this.controlX - startPointX) / (this.controlY - startPointY);
        this.centerX = this.tangent1X + Math.sqrt(this.radius*this.radius/(1+mInv*mInv));
        this.centerY = this.tangent1Y + (this.centerX - this.tangent1X) * mInv;
    }

    private getAngles() {
        this.startAngle = Math.atan2(this.tangent1Y - this.centerY, this.tangent1X - this.centerX);
        this.endAngle = Math.atan2(this.tangent2Y - this.centerY, this.tangent2X - this.centerX);
        this.startAngle = (this.TAU + this.startAngle) % this.TAU;
        this.endAngle = (this.TAU + this.endAngle) % this.TAU;
    }

    getStartPoint(): [number, number] {
        return [this.tangent1X, this.tangent1Y];
    }

    getEndPoint(): [number, number] {
        return [this.tangent2X, this.tangent2Y];
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

    private betweenArc(angle: number) {
        angle = (this.TAU + (angle % this.TAU)) % this.TAU;
        if (this.startAngle <= this.endAngle) {
            return this.startAngle <= angle && angle <= this.endAngle;
        } else {
            return this.startAngle <= angle || angle <= this.endAngle;
        }
    }

}