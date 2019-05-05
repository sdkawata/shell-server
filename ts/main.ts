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
    38: "\x1b[A",
    40: "\x1b[B",
    37: "\x1b[D",  // <-
    39: "\x1b[C",  // ->
    27: "\x1b",
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
    curcol=0;
    currow=0;
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
    width: number;
    height: number;
    constructor(width:number, height:number) {
        this.width = width;
        this.height = height;
        console.log(`width=${width} height=${height}`)
    }
    escapeHTML(str: string) {
        return str.replace(/[&'`"<> \t]/g, function(match: string) {
            let map: {[key:string]: string} = {
                '&': '&amp;',
                "'": '&#x27;',
                '`': '&#x60;',
                '"': '&quot;',
                '<': '&lt;',
                '>': '&gt;',
                ' ': '&ensp;',
                "\t": '&ensp;&ensp;&ensp;&ensp;',
            }
            return map[match]
          });
    }
    createCssString(css:{[key: string]:string}) {
        return Object.entries(css).map(([key,value]) => {
            return `${key as string}:${value as string}`
        }).join(';');
    }
    render(elem: HTMLElement) {
        //console.log(this.rows)
        let html = ""
        let cursorcss: {[key: string]:string} = {
            'animation': '1s linear infinite cursor'
        }
        this.rows.forEach((line, rowidx) => {
            //console.log(line)
            html += "<div>"
            line.forEach((char, colidx) => {
                let css: {[key: string]:string} = {};
                if (char.color) {
                    css['color'] = char.color;
                }
                if (char.backColor) {
                    css['background-color'] = char.backColor
                }
                if (rowidx === this.currow && colidx === this.curcol) {
                    css = cursorcss;
                }
                let cssString = this.createCssString(css)
                let text = this.escapeHTML(char.text)
                if (cssString != "") {
                    html += `<span style="${cssString}">${text}</span>`
                } else {
                    html+= text
                }
            })
            if (rowidx === this.currow && line.length <= this.curcol) {
                html+=`<span style="${this.createCssString(cursorcss)}">&nbsp;</span>`
            }
            html += "&nbsp;</div>"
        })
        elem.innerHTML = html
    }
    fillRows() {
        // colrow, colcolの位置まで埋める
        for(let i=0; i<=this.currow;i++) {
            this.rows[i] = this.rows[i] || [];
        }
        for(let i=0;i<=this.curcol;i++) {
            this.rows[this.currow][i] = this.rows[this.currow][i] || {text: ' '}
        }
    }
    scrollRows() {
        // heightより上の行を削除
        if (this.currow >= this.height - 1) {
            let del = this.currow - (this.height - 1);
            this.rows.splice(0, del);
            this.currow -= del;
        }
    }
    addText(text:string) {
        console.log(JSON.stringify(text))
        let parser = new Parser(text)
        while (true) {
            let current = parser.next()
            //console.log(JSON.stringify(current), this.currow, this.curcol, this.currentStyle)
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
                                console.log("== unrecognizable escape sequence ==", param, intermediate, final)
                            }
                        });
                    } else if (final === 'K') {
                        if (param === '') {
                            // erase end of line
                            if (this.rows[this.currow] !== undefined) {
                                this.rows[this.currow].splice(this.curcol, this.rows[this.currow].length);
                            }
                        } else {
                            console.log("== unrecognizable escape sequence ==", param, intermediate, final)
                        }
                    } else if (final === 'H') {
                        // cursor home
                        if (param === '') {
                            this.curcol = 0;
                            this.currow = 0;
                        } else {
                            let [row, col] = param.split(';');
                            this.currow = Number(row) - 1;
                            this.curcol = Number(col) - 1;
                            this.fillRows();
                        }
                    } else if (final === 'J') {
                        this.rows.splice(this.currow, this.rows.length);
                    } else if (final === 'C') {
                        let count = param === '' ? 1 : Number(param);
                        this.curcol+=count
                        this.fillRows();
                    } else {
                        console.log("== unrecognizable escape sequence ==", param, intermediate, final)
                    }
                } else {
                    console.log("== unrecognizable escape sequence ==")
                }
            } else if (current === "\u0007") {
                this.insyscommand = false;
            } else if (current === "\r") {
                this.curcol = 0;
            } else if (current === "\n") {
                this.currow++;
                this.scrollRows();
                this.fillRows();
            } else if (current === "\b") {
                this.curcol--;
                // this.rows[this.currow].splice(this.curcol, 1);
            } else if (current === "\u0000") {
                // skip
            } else {
                if (this.insyscommand) {
                    continue;
                }
                this.rows[this.currow] = this.rows[this.currow] || [];
                let char: Char = Object.assign({text:current}, this.currentStyle)
                if (this.curcol == (this.rows[this.currow].length)) {
                    this.rows[this.currow].push(char);
                } else {
                    while(this.curcol > this.rows[this.currow].length) {
                        this.rows[this.currow].push({text: ' '});
                    }
                    this.rows[this.currow][this.curcol] = char;
                }
                this.curcol++;
                if (this.curcol >= this.width) {
                    this.curcol = 0;
                    this.currow++;
                    this.fillRows();
                }
            }
        }
    }
}

let ws = new WebSocket('ws://localhost:12345/ws')
let width = Math.floor(window.innerWidth / 16 * 2);
let height = Math.floor(window.innerHeight / 16 / 1.5);
let shell = new Shell(width, height)

function sendCurrentWinsize() {
    ws.send(JSON.stringify({
        height,
        width 
    }))
}

ws.onopen = () => {
    console.log('connected')
    sendCurrentWinsize()
    document.body.addEventListener('keydown', e => {
        console.log(e)
        let key = keymap[e.keyCode] || e.key
        if (key.length > 1 && keymap[e.keyCode] === undefined) {
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
