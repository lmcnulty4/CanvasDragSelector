import { IShape } from "./base";

export class Ellipse implements IShape {

    

    intersects(dimens: [number, number, number, number]) {
        return true;
    }

}