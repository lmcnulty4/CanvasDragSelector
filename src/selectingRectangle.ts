
export class Rect {

    private rootCavnas: HTMLCanvasElement;
    private rectCanvas: HTMLCanvasElement;
    private rectContext: CanvasRenderingContext2D;
    private anchor: [number, number]; // x, y
    private canvasPosition: [number, number]; // top, left
    private dimensions: [number, number, number, number]; // x, y, w, h
    private widthIncreasing: boolean;
    private heightIncreasing: boolean;

    constructor(canvas: HTMLCanvasElement, anchorPoint: [number, number], rectStyler?: (ctx:CanvasRenderingContext2D) => void) {
        this.anchor = [anchorPoint[0], anchorPoint[1]];
        this.dimensions = [anchorPoint[0], anchorPoint[1], 0, 0];
        this.rootCavnas = canvas;
        this.createCanvas();
        this.positionCanvas();
        this.rectContext = this.rectCanvas.getContext("2d");
        if (rectStyler) { rectStyler(this.rectContext); } else { this.defaultRectStyler(this.rectContext); }
    }

    private createCanvas() {
        this.rectCanvas = document.createElement("canvas");
        this.rectCanvas.width = this.rootCavnas.width;
        this.rectCanvas.height = this.rootCavnas.height;
        this.rectCanvas.style.position = "absolute";
        this.rectCanvas.style.zIndex = ((Number(this.rootCavnas.style.zIndex)|0) || 0) + 1 + "";
        this.rectCanvas.style.pointerEvents = "none";
        this.rootCavnas.parentNode.appendChild(this.rectCanvas);
    }

    private positionCanvas() {
        let boundingRect = this.rootCavnas.getBoundingClientRect();
        this.rectCanvas.style.top = boundingRect.top + "px";
        this.rectCanvas.style.left = boundingRect.left + "px";
    }

    private recomputeRectDimensions(mousePosition: [number, number]) {
        let movement = [
            mousePosition[0] - this.dimensions[0],
            mousePosition[1] - this.dimensions[1]
        ];
        let oldHeight = this.dimensions[2];
        let oldWidth = this.dimensions[3];
        if (movement[0] < 1 || movement[0] * 2 < this.dimensions[2]) {
            this.dimensions[2] = Math.abs(this.anchor[0] - mousePosition[0]); 
            this.dimensions[0] = mousePosition[0];
        } else {
            this.dimensions[0] = this.anchor[0];
            this.dimensions[2] = movement[0];
        }
        if (movement[1] < 1 || movement[1] * 2 < this.dimensions[3]) {
            this.dimensions[3] = Math.abs(this.anchor[1] - mousePosition[1]);
            this.dimensions[1] = mousePosition[1];
        } else {
            this.dimensions[1] = this.anchor[1];
            this.dimensions[3] = movement[1];
        }
        this.widthIncreasing = oldWidth <= this.dimensions[2];
        this.heightIncreasing = oldHeight <= this.dimensions[3];
    }

    private defaultRectStyler(context: CanvasRenderingContext2D) {
        context.fillStyle = "rgba(0, 0, 255, 0.3)";
        context.strokeStyle = "rgba(0, 0, 255, 0.4)";
        context.lineWidth = 2;
    }

    private clearCanvas() {
        this.rectContext.clearRect(0, 0, this.rectCanvas.width, this.rectCanvas.height);
        this.rectContext.beginPath(); // this is needed because of using stroke() - for border
    }

    getDimensions() {
        return [this.dimensions[0], this.dimensions[1], this.dimensions[2], this.dimensions[3]];
    }

    redraw(mousePosition: [number, number]) {
        this.recomputeRectDimensions(mousePosition);
        this.clearCanvas();
        this.rectContext.rect(this.dimensions[0], this.dimensions[1], this.dimensions[2], this.dimensions[3]);
        this.rectContext.stroke();
        this.rectContext.fill();
    }

    remove() {
        this.rectCanvas.parentNode.removeChild(this.rectCanvas);
    }

    // Optimisation functions
    bothDimensionsIncreasing() {
        return this.heightIncreasing && this.widthIncreasing;
    }
    bothDimensionsDecreasing() {
        return !this.heightIncreasing && !this.widthIncreasing;
    }

}