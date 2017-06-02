import { IShape } from "./base";
import { TransformMatrix } from "../ContextCurrentTransformPolyfill"
import { ICanvasContext } from "../TrackingContext";

export class Rectangle implements IShape {

    private dimensions: [number, number, number, number];
    private xform: TransformMatrix;

    constructor(context: CanvasRenderingContext2D, dimens: [number, number, number, number]) {
        this.dimensions = [dimens[0], dimens[1], dimens[2], dimens[3]];
        this.xform = (<any>context).currentTransform;
    }

    render(context: ICanvasContext) {
        context.rect(this.dimensions[0], this.dimensions[1], this.dimensions[2] ,this.dimensions[3]);
    }

    intersects(dimens: [number, number, number, number]) {
        return Rectangle.rectanglesIntersect(this.dimensions, Rectangle.matrixTransformRect(dimens, this.xform));
    }

    // Do not care about rotations or skews, only scale and translate
    // That way can enforce that all rectangles are axis aligned - much easier/faster hit detection
    static matrixTransformRect(rect: [number, number, number, number], matrix: TransformMatrix) : [number, number, number, number] {
       return [
            matrix.e + (rect[0] * matrix.a) + (rect[1] * matrix.c), 
            matrix.f + (rect[1] * matrix.d) + (rect[0] * matrix.b), 
            rect[2] * matrix.a, 
            rect[3] * matrix.d
        ];
    }

    static rectanglesIntersect(rectA: [number, number, number, number], rectB: [number, number, number, number]) {
        return rectA[0] < (rectB[0] + rectB[2]) &&
               (rectA[0] + rectA[2]) > rectB[0] &&
               rectA[1] < (rectB[1] + rectB[3]) &&
               (rectA[1] + rectA[3]) > rectB[1];
    }

}