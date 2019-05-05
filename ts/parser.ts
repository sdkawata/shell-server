export class Parser {
    str = ''
    ptr = 0;
    savedPos = 0;
    addText(str:string) {
        this.str += str
    }
    next() {
        if (this.str.length <= this.ptr) {
            return undefined;
        }
        let ret = this.str[this.ptr];
        this.ptr++;
        return ret;
    }
    peek() {
        return this.str[this.ptr]
    }
    savePos() {
        this.savedPos = this.ptr;
    }
    restorePos() {
        this.ptr = this.savedPos;
    }
    discardHandledText() {
        this.str = this.str.slice(this.ptr);
        this.ptr = 0
    }
    // https://www.vt100.net/docs/vt510-rm/chapter4.html
    // https://en.wikipedia.org/wiki/ANSI_escape_code
    getCSIparam(): [string, string, string] | undefined {
        let param = '';
        let i;
        while (this.peek() !== undefined && (i = this.peek()!.charCodeAt(0), i >= 0x30 && i <= 0x3f)) {
            param += this.next()
        }
        let intermediate = '';
        while (this.peek() !== undefined && (i = this.peek()!.charCodeAt(0), i >= 0x20 && i <= 0x2f)) {
            intermediate += this.next()
        }
        if (this.peek() === undefined) {
            return undefined;
        }
        let final = this.next()!
        if (i=final.charCodeAt(0), i < 0x40 || i > 0x7e) {
            console.log("===illegal CSI param ===")
        }
        return [param, intermediate, final];
    }
}