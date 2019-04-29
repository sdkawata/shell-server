type Keymap = {
    [key: number]: string
}

type ColorList = {
    [key: number]:string
}

let keymap: Keymap= {
    13: "\n",
    9 : "\t",
    8: "\b",
}

type Style = {
    color?: string,
    backColor?: string,
}
type Char = Style & {text: string}


class Parser {
    str: string;
    ptr: number = 0;
    constructor(str: string) {
        this.str = str;
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
    // https://www.vt100.net/docs/vt510-rm/chapter4.html
    // https://en.wikipedia.org/wiki/ANSI_escape_code
    getCSIparam(): [string, string, string] {
        let param = '';
        let i;
        while (i = this.peek()!.charCodeAt(0), i >= 0x30 && i <= 0x3f) {
            param += this.next()
        }
        let intermediate = '';
        while (i = this.peek()!.charCodeAt(0), i >= 0x20 && i <= 0x2f) {
            intermediate += this.next()
        }
        let final = this.next()!
        if (i=final.charCodeAt(0), i < 0x40 || i > 0x7e) {
            console.log("===illegal CSI param ===")
        }
        return [param, intermediate, final];
    }
}

class Shell {
    ptrcol=0;
    ptrrow=0;
    rows: Char[][] = [];
    insyscommand = false;
    title = '';
    currentStyle: Style = {}
    colorList: ColorList= {
        0: 'black',
        1: 'red',
        2: 'green',
        3: 'yellow',
        4: 'blue',
        5: 'magenta',
        6: 'cyan',
        7: 'white',
    }
    render(elem: HTMLElement) {
        let html = ""
        this.rows.forEach((line, idx) => {
            //console.log(line)
            html += "<div>"
            line.forEach((char) => {
                let css: {[key: string]:string} = {};
                if (char.color) {
                    css['color'] = char.color;
                }
                if (char.backColor) {
                    css['background-color'] = char.backColor
                }
                let cssString = Object.entries(css).map(([key,value]) => {
                    return `${key as string}:${value as string}`
                }).join(';')
                if (cssString != "") {
                    html += `<span style="${cssString}">${char.text}</span>`
                } else {
                    html+= char.text
                }
            })
            html += "</div>"
        })
        elem.innerHTML = html
    }
    addText(text:string) {
        console.log(JSON.stringify(text))
        let parser = new Parser(text)
        while (true) {
            let current = parser.next()
            //console.log(JSON.stringify(current), ptrcol, ptrrow, currentStyle)
            if (current === undefined) {
                break;
            } else if (current === "\u001b") {
                let next = parser.next();
                if (next === "]") {
                    console.log('insys')
                    this.insyscommand = true;
                } else if (next === "[") {
                    let [param, intermediate, final] = parser.getCSIparam()
                    if (final === 'm') {
                        param.split(';').map((str) => Number(str)).forEach((number) => {
                            if (number >= 30 && number <= 37) {
                                this.currentStyle.color = this.colorList[number - 30];
                            } else if (number >= 40 && number <= 47) {
                                this.currentStyle.backColor = this.colorList[number - 40];
                            } else if (number == 1) {
                                //this.currentStyle.bold = true;
                            } else if (number == 0) {
                                // reset
                                this.currentStyle = {}
                            } else {
                                console.log("== unrecognizable escape sequence ==")
                            }
                        });
                    } else {
                        console.log("== unrecognizable escape sequence ==")
                    }
                } else {
                    console.log("== unrecognizable escape sequence ==")
                }
            } else if (current === "\u0007") {
                this.insyscommand = false;
            } else if (current === "\r") {
                this.ptrrow = 0;
            } else if (current === "\n") {
                this.ptrcol++;
            } else {
                if (this.insyscommand) {
                    continue;
                }
                this.rows[this.ptrcol] = this.rows[this.ptrcol] || [];
                let char: Char = Object.assign({text:current}, this.currentStyle)
                if (this.ptrrow == (this.rows[this.ptrcol].length)) {
                    this.rows[this.ptrcol].push(char);
                } else {
                    while(this.ptrrow > this.rows[this.ptrcol].length) {
                        this.rows[this.ptrcol].push({text: ' '});
                    }
                    this.rows[this.ptrcol][this.ptrrow] = char;
                }
                this.ptrrow++;
            }
        }
    }
}

let ws = new WebSocket('ws://localhost:12345/ws')
let shell = new Shell()

function sendCurrentWinsize() {
    ws.send(JSON.stringify({
        height: Math.floor(window.innerHeight / 16),
        width: Math.floor(window.innerWidth / 16),
    }))
}

ws.onopen = () => {
    console.log('connected')
    sendCurrentWinsize()
    document.body.addEventListener('keydown', e => {
        console.log(e)
        let key = keymap[e.keyCode] || e.key
        if (key.length > 1) {
            return;
        }
        ws.send(JSON.stringify({text:key}))
        e.preventDefault()
    })
}

ws.onmessage = (e) => {
    let data = JSON.parse(e.data)
    if (data.text) {
        shell.addText(data.text)
        shell.render(document!.getElementById('main')!)
        document!.scrollingElement!.scrollTop=999999999999999
    }
}
