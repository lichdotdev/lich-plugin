@echo off
rem Runs veto-subagent.sh through a POSIX shell on Windows, where Codex spawns a
rem hook with `cmd.exe /C` and cmd cannot execute a .sh itself. Unlike
rem win-run.cmd it keeps the script's stdout, which carries the veto: a veto
rem dropped there would let the native subagent run beside the session lich
rem opened for the same task. No bash on the machine prints nothing, which
rem Codex reads as allow, and lich opens nothing because nothing asked.
where bash >nul 2>&1 || set "PATH=%PATH%;%ProgramFiles%\Git\bin"
bash %* 2>nul
exit /b 0
