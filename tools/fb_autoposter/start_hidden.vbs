Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
botDir = "K:\whatshap\tools\fb_autoposter"
stopFlag = botDir & "\STOP_BOT.flag"
nodeExe = "C:\Program Files\nodejs\node.exe"
botScript = "K:\whatshap\tools\fb_autoposter\bot.js"

WshShell.CurrentDirectory = botDir

If fso.FileExists(stopFlag) Then
    On Error Resume Next
    fso.DeleteFile stopFlag, True
    On Error Goto 0
End If

Do
    If fso.FileExists(stopFlag) Then
        WScript.Quit
    End If

    hasNet = False
    Do While Not hasNet
        If fso.FileExists(stopFlag) Then WScript.Quit
        pingRet = WshShell.Run("ping -n 1 8.8.8.8", 0, True)
        If pingRet = 0 Then
            hasNet = True
        Else
            WScript.Sleep 5000
        End If
    Loop

    WScript.Sleep 8000

    If fso.FileExists(stopFlag) Then WScript.Quit

    cmd = """" & nodeExe & """ """ & botScript & """ --hidden"
    WshShell.Run cmd, 0, True

    WScript.Sleep 30000
Loop
