# Private publication infrastructure incident — resolved

Observed on 2026-11-15 after the version 8 local build. The native Sites read confirms version 7 is live with owner-only access: one owner, zero editors, zero groups. No version 8 source push, save-version or deployment was attempted.

The supported Sites helper requires a credential supplied through hidden stdin. `exec_command` with `tty:true` fails before process creation with Windows `CreateProcessW` error 5, targeting `C:\Users\gjtjw\AppData\Local\Microsoft\WindowsApps\pwsh.exe`. Supplying the actual packaged PowerShell path or the system Windows PowerShell path does not change that selected executable. The harmless probe ran no helper code.

Non-TTY execution works for builds and browser QA, but its stdin is closed. A nonsecret probe confirmed `write_stdin` cannot feed it. This runtime exposes no NodeREPL or other supported in-memory child-process input bridge. The returned repository credential mode was `http_extra_header`, so the Sites `work_proxy` alternative does not apply. The credential and private-access response remained in tool-session memory only and were cleared after diagnosis. No credential was written to a file, environment variable, shell argument, report or console.

No Windows alias, ACL, shell configuration or security setting was changed. The app can continue through local source, build, browser and performance checks. Publication can resume from the accepted local commit/artifact when a working PTY or supported memory-to-stdin bridge is available, using a fresh short-lived credential and the normal Sites helper. Keep the existing owner-only audience and version 7 deployment until then.

This is an execution-infrastructure failure, not an automatic approval rejection or a request for the user to approve publication again.

## Resolution after runtime restoration

On2026-11-15 the Node REPL became available again. A nonsecret child-process probe verified a working stdin pipe. The source credential was then transferred from tool-session memory to the standard Sites helper through that pipe; it was not put in a shell command, file or command-line argument. The helper pushed `e0853fe9454667282ca2c90c3dede41ae28fc474` and packaged the existing reviewed build. All70 dist files were compared with the accepted local artifact, and the owner-private native publication operation succeeded asversion8. [Receipt](deployment.json). The original PTY/Windows settings were not changed.
