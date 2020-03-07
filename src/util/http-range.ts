//"bytes=0-8191"
class HttpRange {
    private start: number;
    private size: number;
    private end: number;

    constructor(start: number, size: number) {
        this.start = start;
        this.size = size;
        this.end = start + size;
    }

    getStart(): number {
        return this.start
    }

    getEnd(): number {
        return this.end;
    }

    next(): HttpRange {
        this.start = this.end + 1;
        this.end = this.start + this.size;
        return this;
    }

    toString(): string {
        return `bytes=${this.start}-${this.end}`
    }
}

export default HttpRange;
