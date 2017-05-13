import { IShape } from "./base";

export class Rectangle implements IShape {

    

    intersects(dimens: [number, number, number, number]) {
        return true;
    }

}