import {Parser} from './parser';
import { KeyMapper } from './keymaper';

type Style = {
    color?: string,
    backColor?: string,
}
type Char = Style & {text: string}

type ColorList = {
    [key: number]:string
}


export class Shell {
    curcol=0;
    currow=0;
    rows: Char[][] = [];
    insyscommand = false;
    title = '';
    scrollBegin = 0;
    scrollEnd = 0;
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
    parser = new Parser()
    keyMapper: KeyMapper
    constructor(width:number, height:number, keyMapper: KeyMapper) {
        this.width = width;
        this.height = height;
        this.keyMapper = keyMapper
        this.scrollBegin = 0;
        this.scrollEnd = width - 1;
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
    addText(text:string) {
        console.log(JSON.stringify(text))
        this.parser.addText(text)
        while (true) {
            this.parser.savePos()
            let current = this.parser.next()
            //console.log(JSON.stringify(current), this.currow, this.curcol, this.currentStyle)
            if (current === undefined) {
                break;
            } else if (current === "\u001b") {
                let next = this.parser.next();
                if (next === "]") {
                    console.log('insys')
                    this.insyscommand = true;
                } else if (next === 'M') {
                    this.rows.unshift([])
                    if (this.rows.length > this.height) {
                        this.rows.splice(this.height, this.rows.length);
                    }
                } else if (next === "[") {
                    let csiparam = this.parser.getCSIparam();
                    if (csiparam === undefined) {
                        // csiの途中で入力が終わった
                        this.parser.restorePos()
                        this.parser.discardHandledText()
                        console.log("unterminated CSIparam detected")
                        break;
                    }
                    let [param, intermediate, final] = csiparam;
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
                    } else if (final === 'h' && param === '?1') {
                        this.keyMapper.enableApplicationCursorKeysMode()
                    } else if (final === 'l' && param === '?1') {
                        this.keyMapper.disableApplicateCursorKeysMode()
                    } else if (final === 'r') {
                        let [b, e] = param.split(';')
                        this.scrollBegin = Number(b) - 1
                        this.scrollEnd = Number(e) - 1;
                        this.curcol = 0;
                        this.currow = 0;
                    } else {
                        console.log("== unrecognizable escape sequence ==", param, intermediate, final)
                    }
                } else {
                    console.log("=== unrecognizable escape sequence ===", next)
                }
            } else if (current === "\u0007") {
                this.insyscommand = false;
            } else if (current === "\r") {
                this.curcol = 0;
            } else if (current === "\n") {
                if (this.currow === this.scrollEnd) {
                    // scroll
                    this.rows.splice(this.scrollBegin, 1);
                    this.rows.splice(this.scrollEnd, 0, [])
                } else {
                    this.currow++;
                }

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