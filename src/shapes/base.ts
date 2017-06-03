import { ICanvasContext } from "../TrackingContext";

export interface IShape {
    intersects(dimens: [number, number, number, number]) : boolean;
    render(context: ICanvasContext): void;
    containsPoint?(point: [number, number]): boolean;
}