import { IShape } from "./base";

export class Path implements IShape {

    

    intersects(dimens: [number, number, number, number]) {
        return true;
    }

}