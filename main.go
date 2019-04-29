package main

// #cgo LDFLAGS: -lutil
/*
#include <pty.h>
#include <stdio.h>
#include <unistd.h>
*/
import "C"

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/net/websocket"
)

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
	attr := syscall.ProcAttr{Files: []uintptr{uintptr(aslave), uintptr(aslave), uintptr(aslave)}}
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
			ws.Write(buf[0:n])
		}
	}()
	go func() {
		defer close(exited)
		buf := make([]byte, 1000)
		for {
			n, err := ws.Read(buf)
			if err == io.EOF {
				fmt.Printf("ws EOF reached\n")
				return
			}
			if err != nil {
				panic(err)
			}
			file.Write(buf[0:n])
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
