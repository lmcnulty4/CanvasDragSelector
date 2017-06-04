
function uDivide(t: number, b: number, r: [number, number], incr: number) {
    if (t < 0) {
        t = -t; b = -b;
    }
    if (b == 0 || t == 0 || t > b) return 0;
    r[incr] = t / b;
    if (typeof r[incr] === 'number' && isNaN(r[incr])) return 0;
    return 1;
}

export function getUnitQuadRoots(a: number, b: number, c: number, roots: [number, number]): number {
    if (a === 0) {
        return uDivide(-c, -b, roots, 0);
    }
    let rootCount = 0, R = b*b - 2*a*c;
    if (R < 0) return 0;
    R = Math.sqrt(R);
    rootCount += uDivide(b - R, a, roots, rootCount);
    rootCount += uDivide(b + R, a, roots, rootCount);
    return rootCount;
}

export const TAU = 2 * Math.PI;