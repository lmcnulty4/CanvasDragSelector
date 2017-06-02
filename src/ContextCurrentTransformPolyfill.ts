
export interface TransformMatrix {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

export default function() {
    if ((<any>CanvasRenderingContext2D.prototype).currentTransform) return;
    if ("mozCurrentTransform" in CanvasRenderingContext2D.prototype) {
        Object.defineProperty(CanvasRenderingContext2D.prototype, "currentTransform", {
            get : function() { var m = this.mozCurrentTransform; return {a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]}; },
            set : function(x) { this.mozCurrentTransform = [x.a,x.b,x.c,x.d,x.e,x.f]; },
            enumerable : true,
            configurable : false
        });
   }
   else if ("webkitCurrentTransform" in CanvasRenderingContext2D.prototype) {
        Object.defineProperty(CanvasRenderingContext2D.prototype, "currentTransform", {
            get : function() { return this.webkitCurrentTransform; },
            set : function(x) { this.webkitCurrentTransform = x; },
            enumerable : true,
            configurable : false
        });
    }
    else {
        Object.defineProperty(CanvasRenderingContext2D.prototype, "currentTransform", {
            get: function() { return this._xformStack && this._xformStack.length ? this._xformStack[this._xformStack.length - 1] : getDefaultTransform(); },
            set : function(xform: TransformMatrix) { if (!this._xformStack) { this._xformStack = []; } this._xformStack.push(xform); },
            enumerable : true,
            configurable : false
        });
        addTransformPolyfill();
        addTranslatePolyfill();
        addRotatePolyfill();
        addScalePolyfill();
        addMemoryPolyfills();
   }
}

function addTransformPolyfill() {
    let setTransform = CanvasRenderingContext2D.prototype.setTransform;
    let transform = CanvasRenderingContext2D.prototype.transform;
    let resetTransform = (<any>CanvasRenderingContext2D.prototype).resetTransform;
    CanvasRenderingContext2D.prototype.setTransform = function(a, b, c, d, e, f) {
        if (!isLegalArgument(a) || !isLegalArgument(b) || !isLegalArgument(c) || !isLegalArgument(d) || !isLegalArgument(e) || !isLegalArgument(f)) return;
        if (this._xformStack) {
            this._xformStack.push([{a: a, b: b, c: c, d: d, e: e, f: f}]);
        } else {
            this._xformStack = [{a: a, b: b, c: c, d: d, e: e, f: f}];
        }
        let t : TransformMatrix = this._xformStack[this._xformStack.length - 1];
        setTransform.call(this, t.a, t.b, t.c, t.d, t.e, t.f);
    };
    CanvasRenderingContext2D.prototype.transform = function(a, b, c, d, e, f) {
        if (!isLegalArgument(a) || !isLegalArgument(b) || !isLegalArgument(c) || !isLegalArgument(d) || !isLegalArgument(e) || !isLegalArgument(f)) return;
        if (!this._xformStack || this._xformStack.length === 0) {
            this._xformStack = [getDefaultTransform()];
        }
        let t : TransformMatrix = this._xformStack[this._xformStack.length - 1];
        let newA = t.a*a + t.c * b;
        let newB = t.b*a + t.d * b;
        let newC = t.a*c + t.c * d;
        let newD = t.b*c + t.d * d;
        let newE = t.e + t.a*e + t.c*f;
        let newF = t.f + t.b*e + t.d*f;
        t.a = newA, t.b = newB, t.c = newC, t.d = newD, t.e = newE, t.f = newF;
        transform.call(this,a,b,c,d,e,f);
    };
    (<any>CanvasRenderingContext2D.prototype).resetTransform = function() {
        if (!this._xformStack) {
            this._xformStack = [];
        }
        this._xformStack.push(getDefaultTransform());
        if (resetTransform) {
            resetTransform.call(this);
        } else {
            let t : TransformMatrix = this._xformStack[this._xformStack.length - 1];
            this.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
        }
    }
}

function addTranslatePolyfill() {
    let translate = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function(x, y) {
        if (!isLegalArgument(x) || !isLegalArgument(y)) return;
        if (!this._xformStack || this._xformStack.length === 0) {
            this._xformStack = [getDefaultTransform()];
        }
        let t : TransformMatrix = this._xformStack[this._xformStack.length - 1];
        t.e = t.a * x + t.c * y + t.e;
        t.f = t.b * x + t.d * y + t.f;
        translate.call(this, x, y);
    };
}

function addRotatePolyfill() {
    let rotate = CanvasRenderingContext2D.prototype.rotate;
    CanvasRenderingContext2D.prototype.translate = function(a) {
        if (!isLegalArgument(a)) return;
        if (!this._xformStack || this._xformStack.length === 0) {
            this._xformStack = [getDefaultTransform()];
        }
        let t : TransformMatrix = this._xformStack[this._xformStack.length - 1];
        let sinA = Math.sin(a), cosA = Math.cos(a);
        let newA = t.a * cosA + t.c * sinA;
        let newB = t.b * cosA + t.d * sinA;
        let newC = t.a * -sinA + t.c * cosA;
        let newD = t.b * -sinA + t.d * cosA;
        t.a = newA, t.b = newB, t.c = newC, t.d = newD;
        rotate.call(this, a);
    };
}

function addScalePolyfill() {
    let scale = CanvasRenderingContext2D.prototype.scale;
    CanvasRenderingContext2D.prototype.scale = function(sx, sy) {
        if (!isLegalArgument(sx) || !isLegalArgument(sy)) return;
        if (!this._xformStack || this._xformStack.length === 0) {
            this._xformStack = [getDefaultTransform()];
        }
        let t : TransformMatrix = this._xformStack[this._xformStack.length - 1];
        t.a = t.a * sx;
        t.b = t.b * sx;
        t.c = t.c * sy;
        t.d = t.d * sy;
        scale.call(this, sx, sy);
    };
}

function addMemoryPolyfills() {
    let save = CanvasRenderingContext2D.prototype.save;
    let restore = CanvasRenderingContext2D.prototype.restore;
    CanvasRenderingContext2D.prototype.save = function() {
        if (!this._xformStack) {
            this._xformStack = [];
        }
        this._xformStack.push(getDefaultTransform());
        save.call(this);
    };
    CanvasRenderingContext2D.prototype.restore = function() {
        if (this._xformStack && this._xformStack.length > 0) {
            this._xformStack.pop();
        }
        restore.call(this);
    };
}

function getDefaultTransform() : TransformMatrix {
    return {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: 0,
        f: 0
    };
}

function isNaN(arg: any) {
    return arg !== arg;
}

function isLegalArgument(arg: any) {
    return isFinite(arg) && !isNaN(arg);
}