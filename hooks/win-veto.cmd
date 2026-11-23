@echo off
rem Runs a hook whose stdout is an answer (veto-subagent.sh, report-touched.sh)
rem through a POSIX shell on Windows, where Codex spawns a hook with `cmd.exe /C`
rem and cmd cannot execute a .sh itself. Unlike win-run.cmd it keeps the
rem script's stdout: a veto dropped there would let the native subagent run
rem beside the session lich opened for the same task, and a dropped edit note
rem is never told again. No bash on the machine prints nothing, which Codex
rem reads as allow and no note, and lich hears nothing because nothing asked.
where bash >nul 2>&1 || set "PATH=%PATH%;%ProgramFiles%\Git\bin"
bash %* 2>nul
exit /b 0
