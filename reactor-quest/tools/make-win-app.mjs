// `npm run app:win`: package the built game for Windows as a folder you can
// zip up, copy anywhere and double-click:
//
//   Reactor Quest (Windows)/
//     Reactor Quest.cmd   double-click to play (no install needed)
//     Install.cmd         adds Reactor Quest to the Start menu and the desktop
//     Uninstall.cmd       removes it again
//     launch.ps1 install.ps1 uninstall.ps1 reactor-quest.ico server.mjs app/
//
// Playing starts the bundled server with no console window and opens the game
// in your default browser; the server stops by itself about a minute after you
// close the game's tab. With --with-node the package carries its own Node.js
// (runtime\node.exe) and needs nothing else; without it, Node.js must be
// installed, and the launcher says so if it isn't.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeIco } from './icon.mjs';
import { bundleNode, nodeOptions } from './node-runtime.mjs';
import { crlf, ensureBuild, outDir, pkg, stageApp } from './packaging.mjs';

const out = outDir('Reactor Quest (Windows)');
ensureBuild();
stageApp(out);
writeFileSync(join(out, 'reactor-quest.ico'), makeIco());
const withNode = nodeOptions();
if (withNode) await bundleNode('win32', join(out, 'runtime', 'node.exe'), withNode);

const write = (name, text) => writeFileSync(join(out, name), crlf(text));

// PowerShell does the real work: it can find Node.js, show a friendly dialog,
// start a process without a console window, and make shortcuts.
write(
  'launch.ps1',
  `# Reactor Quest ${pkg.version}: find Node.js, start the game's server with no
# console window, and open the game in the default browser.
# Extra arguments (for example --no-open) are passed to the server.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Find-Node {
  # Its own copy first, when the package carries one.
  $bundled = Join-Path $here 'runtime\\node.exe'
  if (Test-Path $bundled) { return $bundled }
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:ProgramFiles\\nodejs\\node.exe",
    "$env:LOCALAPPDATA\\Programs\\nodejs\\node.exe",
    "$env:NVM_SYMLINK\\node.exe",
    "$env:LOCALAPPDATA\\Volta\\bin\\node.exe",
    "$env:ProgramFiles\\Volta\\node.exe"
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  return $null
}

$node = Find-Node
if (-not $node) {
  Add-Type -AssemblyName PresentationFramework
  $answer = [System.Windows.MessageBox]::Show(
    "Reactor Quest needs Node.js (version 20.19 or newer) to run.\`n\`nInstall it from nodejs.org, or in a terminal run:\`n    winget install OpenJS.NodeJS.LTS\`n\`nOpen the Node.js download page now?",
    'Reactor Quest', 'YesNo', 'Information')
  if ($answer -eq 'Yes') { Start-Process 'https://nodejs.org/en/download' }
  exit 1
}

$log = Join-Path $env:LOCALAPPDATA 'Reactor Quest\\reactor-quest.log'
$serverArgs = @("\`"$here\\server.mjs\`"", "\`"$here\\app\`"", '--app', '--log', "\`"$log\`"") + $args
Start-Process -FilePath $node -ArgumentList $serverArgs -WorkingDirectory $here -WindowStyle Hidden
`,
);

write(
  'install.ps1',
  `# Install Reactor Quest for this Windows user: copy it to
# %LOCALAPPDATA%\\Programs\\Reactor Quest and add Start menu + desktop shortcuts.
# No administrator rights needed.
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $env:LOCALAPPDATA 'Programs\\Reactor Quest'

if ((Resolve-Path $src).Path -ne $dest) {
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Recurse -Force -Path (Join-Path $src '*') -Destination $dest
}
# Files from a downloaded zip are marked as "from the internet"; the copies are ours now.
Get-ChildItem -Recurse -File $dest | Unblock-File

$powershell = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
$shell = New-Object -ComObject WScript.Shell
$links = @(
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Reactor Quest.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reactor Quest.lnk')
)
foreach ($path in $links) {
  $link = $shell.CreateShortcut($path)
  $link.TargetPath = $powershell
  $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \`"$dest\\launch.ps1\`""
  $link.WorkingDirectory = $dest
  $link.IconLocation = "$dest\\reactor-quest.ico,0"
  $link.WindowStyle = 7
  $link.Description = 'Reactor Quest: learn TypeScript and React by playing'
  $link.Save()
}
Write-Host ''
Write-Host "Reactor Quest is installed in $dest"
Write-Host 'Start it from the Start menu or the desktop shortcut.'
`,
);

write(
  'uninstall.ps1',
  `# Remove Reactor Quest's shortcuts and installed copy. Your progress lives in
# your browser, so it stays.
$ErrorActionPreference = 'SilentlyContinue'
$dest = Join-Path $env:LOCALAPPDATA 'Programs\\Reactor Quest'
Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'Reactor Quest.lnk')
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Reactor Quest.lnk')
Set-Location $env:TEMP
Remove-Item -Recurse -Force $dest
Write-Host 'Reactor Quest has been removed.'
`,
);

const runPs = (script, { hidden = false, pause = false } = {}) => `@echo off
powershell -NoProfile -ExecutionPolicy Bypass${hidden ? ' -WindowStyle Hidden' : ''} -File "%~dp0${script}" %*${pause ? '\r\npause' : ''}
`;
write('Reactor Quest.cmd', `@rem Double-click to play Reactor Quest.\n${runPs('launch.ps1', { hidden: true })}`);
write('Install.cmd', `@rem Double-click to add Reactor Quest to the Start menu and the desktop.\n${runPs('install.ps1', { pause: true })}`);
write('Uninstall.cmd', `@rem Double-click to remove Reactor Quest's shortcuts and installed copy.\n${runPs('uninstall.ps1', { pause: true })}`);
write(
  'README.txt',
  `Reactor Quest ${pkg.version} for Windows

${withNode ? 'Nothing else to install: Node.js comes with it (see runtime\\NODE-LICENSE.txt).' : 'Needs Node.js 20.19 or newer: https://nodejs.org (or: winget install OpenJS.NodeJS.LTS)'}

  Reactor Quest.cmd   Double-click to play. The game opens in your browser.
  Install.cmd         Adds Reactor Quest to the Start menu and the desktop.
  Uninstall.cmd       Removes it again.

If Windows says "Windows protected your PC", click "More info", then "Run anyway".
If the game says its port is busy, close the program using port 4310 (or restart) and try again.
Logs: %LOCALAPPDATA%\\Reactor Quest\\reactor-quest.log
`,
);
console.log(`Built ${out}\nZip it, copy it anywhere, and double-click "Reactor Quest.cmd" (or "Install.cmd").`);
