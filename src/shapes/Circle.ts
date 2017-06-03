import { IShape } from "./Base";
import { Rectangle } from "./Rectangle";
import { TransformMatrix } from "../ContextCurrentTransformPolyfill"
import { ICanvasContext } from "../TrackingContext";

export class Circle implements IShape {

    private centre: [number, number]; // x, y
    private radius: number;
    private squaredRadius: number;
    private xform: TransformMatrix;
    readonly boundingBox: [number, number, number, number];

    constructor(context: CanvasRenderingContext2D, centre: [number, number], radius: number) {
        this.centre = [centre[0], centre[1]];
        this.radius = radius;
        this.squaredRadius = radius * radius;
        this.boundingBox = [
            centre[0] - radius,
            centre[1] + radius,
            radius * 2,
            radius * 2
        ];
        this.xform = (<any>context).currentTransform;
    }

    render(context: ICanvasContext) {
        context.arc(this.centre[0], this.centre[1], this.radius, 0, 2*Math.PI, true);
    }

    containsPoint(point: [number, number]) {
        return Math.sqrt((point[0] - this.centre[0]) * (point[0] - this.centre[0]) + (point[1] - this.centre[1]) * (point[1] - this.centre[1])) <= this.radius;
    }

    intersects(rect: [number, number, number, number]) {
        let transformedRect = Rectangle.matrixTransformRect(rect, this.xform);
        if (!Rectangle.rectanglesIntersect(this.boundingBox, transformedRect)) return false;
        let half = [transformedRect[2] / 2, transformedRect[3] / 2];
        let centre = [this.centre[0] - transformedRect[0] + half[0], this.centre[1] - transformedRect[1] - half[1]];
        let side = [Math.abs(centre[0]) - half[0], Math.abs(centre[1]) - half[1]];
        if (side[0] > this.radius || side[1] > this.radius) return false;
        if (side[0] < -this.radius && side[1] < -this.radius) return true;
        if (side[0] < 0 || side[1] < 0) return true;
        return (side[0] * side[0]) + (side[1] * side[1]) < this.squaredRadius;
    }

}