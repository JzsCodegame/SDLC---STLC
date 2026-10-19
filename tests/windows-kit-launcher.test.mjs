import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

test('download-marked setup runs from a folder with spaces; altered setup never runs', async()=>{
 const root=await fs.mkdtemp(path.resolve('.local/windows launcher '));
 await fs.copyFile('automation-lab/student-kit/Setup.cmd',path.join(root,'Setup.cmd'));
 const script="param([switch]$CheckOnly)\r\nWrite-Output ('FIXTURE EXECUTED '+$CheckOnly)\r\nexit 0\r\n";
 await fs.writeFile(path.join(root,'Setup.ps1'),script);
 await fs.writeFile(path.join(root,'Setup.ps1:Zone.Identifier'),'[ZoneTransfer]\r\nZoneId=3');
 await fs.writeFile(path.join(root,'kit-manifest.json'),JSON.stringify({schemaVersion:1,files:[{path:'Setup.ps1',bytes:Buffer.byteLength(script),sha256:createHash('sha256').update(script).digest('hex')}]}));
 const run=()=>spawnSync('cmd.exe',['/d','/c','Setup.cmd -CheckOnly'],{cwd:root,input:'\r\n',encoding:'utf8'});
 let result=run();
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/FIXTURE EXECUTED True/);
 await fs.appendFile(path.join(root,'Setup.ps1'),'# altered');
 result=run();
 assert.notEqual(result.status,0);
 assert.match(result.stdout,/verification failed/);
 assert.doesNotMatch(result.stdout,/FIXTURE EXECUTED/);
});
