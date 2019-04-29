let keymap = {}
keymap[13] = "\n"
keymap[9] = "\t"
keymap[8] = "\b"

let ws = new WebSocket('ws://localhost:12345/ws')
let ptrcol=0;
let ptrrow=0;
let rows=[];
let insyscommand = false;
let title = '';
let currentStyle = {}
let colorList = {
    0: 'black',
    1: 'red',
    2: 'green',
    3: 'yellow',
    4: 'blue',
    5: 'magenta',
    6: 'cyan',
    7: 'white',
}

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
        console.log(JSON.stringify(data.text))
        let parser = new Parser(data.text)
        while (true) {
            let current = parser.next()
            //console.log(JSON.stringify(current), ptrcol, ptrrow, currentStyle)
            if (current === undefined) {
                break;
            } else if (current === "\u001b") {
                let next = parser.next();
                if (next === "]") {
                    console.log('insys')
                    insyscommand = true;
                } else if (next === "[") {
                    let [param, intermediate, final] = parser.getCSIparam()
                    if (final === 'm') {
                        param.split(';').map((str) => Number(str)).forEach((number) => {
                            if (number >= 30 && number <= 37) {
                                currentStyle.color = colorList[number - 30];
                            } else if (number >= 40 && number <= 47) {
                                currentStyle.backColor = colorList[number - 40];
                            } else if (number == 1) {
                                currentStyle.bold = true;
                            } else if (number == 0) {
                                // reset
                                currentStyle = {}
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
                insyscommand = false;
            } else if (current === "\r") {
                ptrrow = 0;
            } else if (current === "\n") {
                ptrcol++;
            } else {
                if (insyscommand) {
                    continue;
                }
                rows[ptrcol] = rows[ptrcol] || [];
                let char = Object.assign({text:current}, currentStyle)
                if (ptrrow == (rows[ptrcol].length)) {
                    rows[ptrcol].push(char);
                } else {
                    while(ptrrow > rows[ptrcol].length) {
                        rows[ptrcol].push({text: ' '});
                    }
                    rows[ptrcol][ptrrow] = char;
                }
                ptrrow++;
            }
        }
        render()
        document.scrollingElement.scrollTop=999999999999999
    }
}

function render() {
    let html = ""
    rows.forEach((line, idx) => {
        //console.log(line)
        html += "<div>"
        line.forEach((char) => {
            let css = {};
            if (char.color) {
                css['color'] = char.color;
            }
            if (char.backColor) {
                css['background-color'] = char.backColor
            }
            let cssString = Object.entries(css).map(([key,value]) => {
                return `${key}:${value}`
            }).join(';')
            if (cssString != "") {
                html += `<span style="${cssString}">${char.text}</span>`
            } else {
                html+= char.text
            }
        })
        html += "</div>"
    })
    document.getElementById("main").innerHTML = html
}

class Parser {
    constructor(str) {
        this.str = str;
        this.ptr = 0;
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
    getCSIparam() {
        let param = '';
        let i;
        while (i = this.peek().charCodeAt(0), i >= 0x30 && i <= 0x3f) {
            param += this.next()
        }
        let intermediate = '';
        while (i = this.peek().charCodeAt(0), i >= 0x20 && i <= 0x2f) {
            intermediate += this.next()
        }
        let final = this.next()
        if (i=final.charCodeAt(0), i < 0x40 || i > 0x7e) {
            console.log("===illegal CSI param ===")
        }
        return [param, intermediate, final];
    }
}