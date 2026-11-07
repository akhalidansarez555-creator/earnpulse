Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
botDir = "K:\whatshap\tools\fb_autoposter"
stopFlag = botDir & "\STOP_BOT.flag"
nodeExe = "C:\Program Files\nodejs\node.exe"

WshShell.CurrentDirectory = botDir

' Check if user manually stopped bot previously; on Windows boot, if flag exists, remove it so PC boot auto-starts
' We pass argument "/boot" from Startup folder
If WScript.Arguments.Count > 0 Then
    If WScript.Arguments(0) = "/boot" Then
        If fso.FileExists(stopFlag) Then
            On Error Resume Next
            fso.DeleteFile stopFlag, True
            On Error Goto 0
        End If
    End If
End If

Do
    ' If user clicked STOP, exit cleanly
    If fso.FileExists(stopFlag) Then
        WScript.Quit
    End If

    ' 1. Wait for active internet connection
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

    ' Wait 8 seconds for DNS and network services to stabilize
    WScript.Sleep 8000

    If fso.FileExists(stopFlag) Then WScript.Quit

    ' 2. Launch node bot silently (0 = Hide window completely, True = Wait until process terminates)
    cmd = """" & nodeExe & """ bot.js --hidden"
    WshShell.Run cmd, 0, True

    ' Wait 30 seconds before recovering/restarting
    WScript.Sleep 30000
Loop
