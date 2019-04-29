let keymap = {}
keymap[13] = "\n"
keymap[9] = "\t"
keymap[8] = "\b"

let ws = new WebSocket('ws://localhost:12345/ws')

ws.onopen = () => {
    console.log('connected')
    document.body.addEventListener('keydown', e => {
        console.log(e)
        let key = keymap[e.keyCode] || e.key
        if (key.length > 1) {
            return;
        }
        ws.send(JSON.stringify({text:key}))
    })
}

ws.onmessage = (e) => {
    let data = JSON.parse(e.data)
    if (data.text) {
        let elem = document.getElementById('main')
        let text = data.text.replace(/\r\n/g, '<br>')
        main.innerHTML = main.innerHTML + text
        document.scrollingElement.scrollTop=999999999999999
    }
}
