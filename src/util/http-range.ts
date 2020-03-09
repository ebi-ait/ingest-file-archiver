//"bytes=0-8191"
class HttpRange {
    private start: number;
    private size: number;
    private end: number;

    constructor(start: number, size: number) {
        this.start = start;
        this.size = size;
        this.end = start + size - 1;
    }

    getStart(): number {
        return this.start
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
