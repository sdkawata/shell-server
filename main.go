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
	"crypto/rand"
	"encoding/hex"
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

type PassInput struct {
	Password string `json:"password`
}

type PassOutput struct {
	Auth bool `json:"auth"`
}

var pass string

func waitPass(encoder *json.Encoder, decoder *json.Decoder) error {
	input := PassInput{}
	err := decoder.Decode(&input)
	if err != nil {
		return err
	}
	output := PassOutput{Auth: input.Password == pass}
	err = encoder.Encode(&output)
	if err != nil {
		return nil
	}
	if !output.Auth {
		fmt.Printf("password auth failed %v %v", input.Password, pass)
		return fmt.Errorf("auth failed")
	}
	return nil
}

func wsHandler(ws *websocket.Conn) {
	defer ws.Close()
	encoder := json.NewEncoder(ws)
	decoder := json.NewDecoder(ws)
	fmt.Printf("ws connected\n")
	err := waitPass(encoder, decoder)
	if err != nil {
		return
	}
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
	defer syscall.Kill(-pid, syscall.SIGTERM)
	fmt.Printf("pid:%d\n", pid)
	cmd := exec.Command("bash")
	cmd.Start()
	shExited := make(chan struct{})
	wsExited := make(chan struct{})
	go func() {
		defer close(shExited)
		buf := make([]byte, 1000)
		for {
			n, err := file.Read(buf)
			if err == io.EOF {
				fmt.Printf("file EOF reached\n")
				return
			}
			if err != nil {
				fmt.Printf("write error:%v\n", err)
				return
			}
			encoder.Encode(&Output{Text: (string)(buf[0:n])})
		}
	}()
	go func() {
		defer close(wsExited)
		input := Input{}
		for {
			err := decoder.Decode(&input)
			if err == io.EOF {
				fmt.Printf("ws EOF reached\n")
				return
			}
			if err != nil {
				fmt.Printf("read error:%v\n", err)
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
	select {
	case <-wsExited:
	case <-shExited:
	}
}

func getPassword() string {
	passByte := make([]byte, 10)
	_, err := rand.Read(passByte)
	if err != nil {
		panic(err)
	}
	return hex.EncodeToString(passByte)
}
func main() {
	pass = getPassword()
	http.Handle("/ws", websocket.Handler(wsHandler))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "main.html")
	})
	http.HandleFunc("/main.js", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "main.js")
	})
	fmt.Printf("password:%s\n", pass)
	err := http.ListenAndServe("0.0.0.0:12345", nil)
	if err != nil {
		panic(err)
	}
}
