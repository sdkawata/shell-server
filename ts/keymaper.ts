type Keymap = {
    [key: number]: string
}

export class KeyMapper{
    keymap: Keymap =  {
        13: "\n",
        9 : "\t",
        8: "\b",
        27: "\x1b",
    }
    constructor() {
        this.disableApplicateCursorKeysMode()
    }
    disableApplicateCursorKeysMode() {
        Object.assign(this.keymap, {
            38: "\x1b[A",
            40: "\x1b[B",
            37: "\x1b[D",  // <-
            39: "\x1b[C",  // ->
        });
    }

    enableApplicationCursorKeysMode() {
        Object.assign(this.keymap, {
            38: "\x1bOA",
            40: "\x1bOB",
            37: "\x1bOD",  // <-
            39: "\x1bOC",  // ->
        });
    }
    keyDowned(e:any, f: (s:string) => void) {
        let key = this.keymap[e.keyCode] || e.key
        if (key.length > 1 && this.keymap[e.keyCode] === undefined) {
            return;
        }
        f(key)
    }
}