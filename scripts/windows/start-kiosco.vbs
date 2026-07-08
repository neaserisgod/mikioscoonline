' Shim para que el arranque no muestre ninguna ventana de consola parpadeando
' (el -WindowStyle Hidden de PowerShell solo no alcanza en todas las versiones
' de Windows). Este .vbs es el que va en la carpeta de Inicio de Windows.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1Path = scriptDir & "\start-kiosco.ps1"

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1Path & """"
CreateObject("WScript.Shell").Run cmd, 0, False
