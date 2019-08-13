import {Shell} from './shell';
import { KeyMapper } from './keymaper';

let ws:WebSocket 
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

function startConn(pass: string) {
    ws = new WebSocket('ws://' + window.location.host + '/ws')
    ws.onopen = () => {
        console.log('connected')
        ws.send(JSON.stringify({password:pass}))
    }
    
    ws.onmessage = (e) => {
        let data = JSON.parse(e.data)
        if (data.auth === true) {
            localStorage.setItem('shell_password', pass)
            initShell()
        }
        if (data.auth === false) {
            ws.close()
        }
        if (data.text) {
            shell.addText(data.text)
            shell.render(document!.getElementById('main')!)
            document!.scrollingElement!.scrollTop=999999999999999
        }
    }
    
}

function initShell() {
    document.getElementById('initial')!.style.display='none'
    document.getElementById('main')!.style.display='block'
    sendCurrentWinsize()
    document.body.addEventListener('keydown', e => {
        console.log(e)
        keyMapper.keyDowned(e, (s) => ws.send(JSON.stringify({text:s})))
        e.preventDefault()
    })
}

document.getElementById('sendpass')!.addEventListener('click', ()=> {
    startConn((document.getElementById('password') as HTMLInputElement).value);
})

let lastPass = localStorage.getItem('shell_password')
if (lastPass) {
    startConn(lastPass)
}