import {Shell} from './shell';

type Keymap = {
    [key: number]: string
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
