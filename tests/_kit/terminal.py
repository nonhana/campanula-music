import errno
import fcntl
import json
import os
import pty
import select
import shlex
import struct
import sys
import termios

pid, terminal = pty.fork()
if pid == 0:
    fcntl.ioctl(1, termios.TIOCSWINSZ, struct.pack('HHHH', 30, 120, 0, 0))
    command = shlex.join(json.loads(sys.argv[1]))
    shell = (
        'trap ":" INT TERM; printf "\\n__SESSION__%s\\n" "$$"; '
        + command
        + '; code=$?; printf "\\n__CLI_EXIT__%s\\n" "$code"; read -r finish'
    )
    os.execl('/bin/sh', 'sh', '-c', shell)

inputs = [terminal, 0]
try:
    while terminal in inputs:
        for source in select.select(inputs, [], [])[0]:
            try:
                data = os.read(source, 65536)
            except OSError as error:
                if source == terminal and error.errno == errno.EIO:
                    inputs.remove(terminal)
                    break
                raise
            if not data:
                inputs.remove(source)
            elif source == terminal:
                os.write(1, data)
            else:
                os.write(terminal, data)
finally:
    os.close(terminal)
    _, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
