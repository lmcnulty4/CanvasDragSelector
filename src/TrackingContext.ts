import { Circle } from "./shapes/Circle"
import { Subpath } from "./shapes/Subpath";
import { Rectangle } from "./shapes/Rectangle";

export interface ICanvasContext {
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean): void;
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
    rect(x: number, y: number, w: number, h: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    strokeRect(x: number, y: number, w: number, h: number): void;
    clearRect(x: number, y: number, w: number, h: number): void;
}

export class TrackingContext {

    private _context: CanvasRenderingContext2D;
    private _contextMethods: ICanvasContext;
    private shapes: (Circle | Rectangle)[] = [];
    private features: Subpath[][] = [];
    private currentPath: Subpath;
    private currentFeature: Subpath[];
    private pathInProgress: boolean = false;

    constructor(context: CanvasRenderingContext2D) {
        this._context = context;
        this._contextMethods = {
            beginPath: context.beginPath,
            closePath: context.closePath,
            moveTo: context.moveTo,
            lineTo: context.lineTo,
            quadraticCurveTo: context.quadraticCurveTo,
            bezierCurveTo: context.bezierCurveTo,
            arc: context.arc,
            arcTo: context.arcTo,
            rect: context.rect,
            fillRect: context.fillRect,
            strokeRect: context.strokeRect,
            clearRect: context.clearRect
        };
        this._context.beginPath = this.beginPath.bind(this);
        this._context.closePath = this.closePath.bind(this);
        this._context.moveTo = this.moveTo.bind(this);
        this._context.lineTo = this.lineTo.bind(this);
        this._context.quadraticCurveTo = this.quadraticCurveTo.bind(this);
        this._context.bezierCurveTo = this.bezierCurveTo.bind(this);
        this._context.arc = this.arc.bind(this);
        this._context.arcTo = this.arcTo.bind(this);
        this._context.rect = this.rect.bind(this);
        this._context.fillRect = this.fillRect.bind(this);
        this._context.strokeRect = this.strokeRect.bind(this);
        this._context.clearRect = this.clearRect.bind(this);
        this._context.canvas.getContext = function(a: string) {
            return this._context;
        };
    }

    notifyFeatureStarted() {
        this.pathInProgress = true;
        this.currentPath = new Subpath(this._context);
        this.currentFeature = [];
    }

    notifyFeatureFinished() {
        if (this.currentPath) {
            if (!this.features) this.features = [];
            this.features.push(this.currentFeature);
            this.currentPath = null;
            this.pathInProgress = false;
        }
    }

    renderIntersections(rect: [number, number, number, number], contextRenderer: () => void) {
        this._context.save();
        for (let i = 0; i < this.shapes.length; i++) {
            if (this.shapes[i].intersects(rect)) {
                this.renderShape(this.shapes[i], contextRenderer);
            }
        }
        for (let i = 0; i < this.features.length; i++) {
            let feature = this.features[i];
            for (let j = 0; j < feature.length; j++) {
                if (feature[j].intersects(rect)) {
                    this.renderFeature(feature, contextRenderer);
                    break;
                }
            }
        }
        this._context.restore();
    }

    private renderFeature(feature: Subpath[], contextRenderer: () => void) {
        for (let i = 0, l = feature.length; i < l; i++) {
            feature[i].render(this._contextMethods);
        }
        contextRenderer();
    }

    private renderShape(shape: (Circle | Rectangle), contextRenderer: () => void) {
        shape.render(this._contextMethods);
        contextRenderer();
    }

    private ensurePathInProgress() {
        if (!this.pathInProgress) this.currentPath = new Subpath(this._context);
        this.pathInProgress = true;
    }
    
    private beginPath(): void {
        this.ensurePathInProgress();
        this.notifyFeatureStarted(); // This and the below will be called externally if/when d3 implements a way to track features being rendered to a canvas. See https://github.com/d3/d3-geo/issues/100
        this._contextMethods.beginPath.call(this._context);
    }
    private closePath(): void {
        this.currentPath.closePath();
        if (!this.currentFeature) this.currentFeature = [];
        this.currentFeature.push(this.currentPath);
        this.notifyFeatureFinished(); // This and the above will be called externally if/when d3 implements a way to track features being rendered to a canvas. See https://github.com/d3/d3-geo/issues/100
        this._contextMethods.closePath.call(this._context);
    }
    private moveTo(x: number, y: number): void {
        this.ensurePathInProgress();
        this.currentPath.moveTo(x, y);
        this._contextMethods.moveTo.call(this._context, x, y);
    }
    private lineTo(x: number, y: number): void {
        this.ensurePathInProgress();
        this.currentPath.lineTo(x, y);
        this._contextMethods.lineTo.call(this._context, x, y);
    }
    private quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
        this.ensurePathInProgress();
        this.currentPath.quadraticCurveTo(cpx, cpy, x, y);
        this._contextMethods.quadraticCurveTo.call(this._context, cpx, cpy, x, y);
    }
    private bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
        this.ensurePathInProgress();
        this.currentPath.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        this._contextMethods.bezierCurveTo.call(this._context, cp1x, cp1y, cp2x, cp2y, x, y);
    }
    private arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
        this.ensurePathInProgress();
        this.currentPath.arcTo(x1, y1, x2, y2, radius);
        this._contextMethods.arcTo.call(this._context, x1, y1, x2, y2, radius);
    }
    private arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean): void {
        if (this.pathInProgress) {
            // add circle to subPath
        } else {
            this.shapes.push(new Circle(this._context, [x, y], radius));
        }
        this._contextMethods.arc.call(this._context, x, y, radius, startAngle, endAngle, counterclockwise);
    }
    private rect(x: number, y: number, w: number, h: number): void {
        if (this.pathInProgress) {
            // add rectangle to subPath
        } else {
            this.shapes.push(new Rectangle(this._context, [x, y, w, h]));
        }
        this._contextMethods.rect.call(this._context, x, y, w, h);
    }
    private fillRect(x: number, y: number, w: number, h: number): void {
        if (this.pathInProgress) {
            // add rectangle to subPath
        } else {
            this.shapes.push(new Rectangle(this._context, [x, y, w, h]));
        }
        this._contextMethods.fillRect.call(this._context, x, y, w, h);
    }
    private strokeRect(x: number, y: number, w: number, h: number): void {
        if (this.pathInProgress) {
            // add rectangle to subPath
        } else {
            this.shapes.push(new Rectangle(this._context, [x, y, w, h]));
        }
        this._contextMethods.strokeRect.call(this._context, x, y, w, h);
    }
    private clearRect(x: number, y: number, w: number, h: number): void { // Assume that every clearRect erases the whole canvas
        this.shapes = [];
        this.features = [];
        this.currentFeature = [];
        this._contextMethods.clearRect.call(this._context, x, y, w, h);
    }

}
