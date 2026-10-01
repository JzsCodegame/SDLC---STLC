import {spawn} from 'node:child_process';
import {once} from 'node:events';
const server=spawn(process.execPath,['server/index.js'],{stdio:['ignore','inherit','inherit','ipc'],env:{...process.env,HOST:'127.0.0.1',PORT:'4175',LAB_MODE:'true',DATA_DIR:'.test-data/cypress'}});
const ready=new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(new Error('Test server did not become ready')),10000);
 server.once('message',message=>{clearTimeout(timer);message?.ready?resolve():reject(new Error('Invalid readiness signal'))});
 server.once('error',error=>{clearTimeout(timer);reject(error)});
 server.once('exit',()=>{clearTimeout(timer);reject(new Error('Test server exited before becoming ready'))});
});
let runner;let stopped=false;
const cleanup=()=>{if(stopped)return;stopped=true;runner?.kill();server.kill()};
process.on('SIGINT',()=>{cleanup();process.exitCode=130});process.on('SIGTERM',cleanup);
try{
 await ready;
 const args=['node_modules/cypress/bin/cypress',process.argv.includes('--open')?'open':'run'];
 if(!process.argv.includes('--open')&&process.env.CYPRESS_BROWSER)args.push('--browser',process.env.CYPRESS_BROWSER);
 runner=spawn(process.execPath,args,{stdio:'inherit',env:process.env});
 const [code]=await once(runner,'exit');process.exitCode=typeof code==='number'?code:1;
}catch(error){console.error(error.message);process.exitCode=1}finally{cleanup()}
