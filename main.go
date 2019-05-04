package main

// #cgo LDFLAGS: -lutil
/*
#include <pty.h>
#include <unistd.h>
#include <termios.h>
#include <sys/ioctl.h>
int setwinsize(int fd, struct winsize *argp) {
	return ioctl(fd, TIOCSWINSZ, argp);
}
*/
import "C"

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/net/websocket"
)

type Output struct {
	Text string `json:"text"`
}
type Input struct {
	Text   string `json:"text"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

func wsHandler(ws *websocket.Conn) {
	defer ws.Close()
	fmt.Printf("ws connected\n")
	var amaster C.int
	var aslave C.int
	if errno := C.openpty((*C.int)(unsafe.Pointer(&amaster)), (*C.int)(unsafe.Pointer(&aslave)), nil, nil, nil); errno != 0 {
		panic(fmt.Sprintf("errorno: %d\n", errno))
	}
	file := os.NewFile(uintptr(amaster), "ptymaster")
	defer file.Close()
	sysattr := syscall.SysProcAttr{Setsid: true}
	attr := syscall.ProcAttr{
		Files: []uintptr{uintptr(aslave), uintptr(aslave), uintptr(aslave)},
		Env:   []string{"TERM=vt100"},
		Sys:   &sysattr,
	}
	pid, err := syscall.ForkExec("/usr/bin/bash", []string{}, &attr)
	if err != nil {
		panic(err)
	}
	fmt.Printf("pid:%d\n", pid)
	cmd := exec.Command("bash")
	cmd.Start()
	exited := make(chan struct{})
	go func() {
		defer close(exited)
		encoder := json.NewEncoder(ws)
		buf := make([]byte, 1000)
		for {
			n, err := file.Read(buf)
			if err == io.EOF {
				fmt.Printf("file EOF reached\n")
				return
			}
			if err != nil {
				panic(err)
			}
			encoder.Encode(&Output{Text: (string)(buf[0:n])})
		}
	}()
	go func() {
		defer close(exited)
		decoder := json.NewDecoder(ws)
		input := Input{}
		for {
			err := decoder.Decode(&input)
			if err == io.EOF {
				fmt.Printf("ws EOF reached\n")
				return
			}
			if err != nil {
				panic(err)
			}
			if input.Text != "" {
				file.Write([]byte(input.Text))
			} else if input.Width != 0 && input.Height != 0 {
				winsize := C.struct_winsize{ws_row: C.ushort(input.Height), ws_col: C.ushort(input.Width)}
				if errno := C.setwinsize(C.int(aslave), (*C.struct_winsize)(unsafe.Pointer(&winsize))); errno != 0 {
					panic(fmt.Sprintf("ioctl error errno:%d", errno))
				}
			}
		}
	}()
	<-exited
}

func main() {
	http.Handle("/ws", websocket.Handler(wsHandler))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "main.html")
	})
	http.HandleFunc("/main.js", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "main.js")
	})
	err := http.ListenAndServe("0.0.0.0:12345", nil)
	if err != nil {
		panic(err)
	}
}
