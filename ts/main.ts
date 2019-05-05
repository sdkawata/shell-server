import {Shell} from './shell';
import { KeyMapper } from './keymaper';

let ws = new WebSocket('ws://localhost:12345/ws')
let width = Math.floor(window.innerWidth / 16 * 2);
let height = Math.floor(window.innerHeight / 16 / 1.5);
let keyMapper = new KeyMapper()
let shell = new Shell(width, height, keyMapper)

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
        keyMapper.keyDowned(e, (s) => ws.send(JSON.stringify({text:s})))
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
