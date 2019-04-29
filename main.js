let ws = new WebSocket('ws://localhost:12345/ws')

ws.onopen = () => {console.log('connected')}
ws.onmessage = (e) => {
    console.log(e.data)
    let elem = document.getElementById('main')
    let text = e.data.replace("\n", '<br>')
    main.innerHTML = main.innerHTML + text
}