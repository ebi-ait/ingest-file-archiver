/*

HTTP Range header

The "Range" header field on a GET request modifies the method
semantics to request transfer of only one or more subranges of the
selected representation data, rather than the entire selected
representation data.

E.g. The first 500 bytes (byte offsets 0-499, inclusive):

    bytes=0-499
*/

class HttpRange {
    private start: number;
    private readonly size: number;
    private end: number;

    constructor(start: number, size: number) {
        this.start = start;
        this.size = size;
        this.end = start + size - 1;
    }

    getEnd(): number {
        return this.end;
    }

    next(): HttpRange {
        this.start = this.start + this.size;
        this.end = this.end + this.size;
        return this;
    }

    toString(): string {
        return `bytes=${this.start}-${this.end}`
    }
}

export default HttpRange;
