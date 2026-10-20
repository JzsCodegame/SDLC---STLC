// Complete additional teaching recipes. Authored source is not browser acceptance.
const file = (path, code) => ({path, code});
const recipes = [];
const common = [
  'Working directory: your editable practice-app folder containing package.json, never the immutable kit template. Hosted: cd /home/student/workspace/practice-app.',
  'Use the installed locked Playwright 1.63.0 and Cypress 16.1.1 dependencies. These recipes do not install tools or change global configuration.',
  'Save every supplied file at its exact relative path. Outputs under test-results and playwright-report are private teaching evidence; never commit or publish authenticated state, paths or recordings containing personal information.',
  'For recipes visiting /ui-components.html, first install the separately supplied Academy UI fixtures into practice-app/public without deleting existing files. In terminal 1 run npm run build then npm run start. Leave it running; execute the recipe command in terminal 2. The Windows 1.1.3 kit predates these fixtures.'
];
const pwConfig = (id, extra = '', useExtra = '') => `import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'*.spec.ts',workers:1,outputDir:'../../test-results/${id}',use:{baseURL:'http://127.0.0.1:4173',channel:process.env.ACADEMY_PW_CHANNEL || 'msedge',${useExtra}},${extra}});
`;
function add(id, title, framework, category, summary, files, options = {}) {
  recipes.push({id, title, framework, category, summary, workingDirectory:'practice-app', prerequisites:[...common,...(options.prerequisites || [])], files,
    commands:options.commands || [`npx playwright test --config workshops/${id}/playwright.config.ts`], expected:options.expected,
    limitations:options.limitations || ['Authored recipe, not accepted browser coverage. Run it in your isolated workspace with the pinned environment.'],
    docs:options.docs, status:'workshop', verification:'TypeScript syntax checked; Playwright configs/specs loaded with --list. Actual integrated browser execution is tracked separately, not claimed here.'});
}

add('pw-assertion-flow','Soft assertions, polling and deterministic branching','Playwright','Assertions and browser evaluation',
  'Observe a known seeded condition, await an asynchronous result and dispose a browser handle.',[
    file('workshops/pw-assertion-flow/playwright.config.ts',pwConfig('pw-assertion-flow','expect:{timeout:3000},timeout:15000,')),
    file('workshops/pw-assertion-flow/example.spec.ts',`import {test,expect} from '@playwright/test';
test('seeded delivery decision and browser evaluation',async({page})=>{
 const scenario={kind:'express',reference:'DEMO-7'};
 await page.setContent('<main><button id="submit">Submit</button><output id="result">Ready</output></main>');
 await page.evaluate(data=>{
  const button=document.querySelector<HTMLButtonElement>('#submit')!;
  button.onclick=()=>{setTimeout(()=>{document.querySelector('#result')!.textContent=data.kind==='express'?'Express '+data.reference:'Standard '+data.reference;},25);};
 },scenario);
 await expect.soft(page.locator('#result')).toHaveText('Ready');
 // The branch is driven by explicit input, never an unsettled DOM or swallowed failure.
 const expected=scenario.kind==='express'?'Express DEMO-7':'Standard DEMO-7';
 await page.locator('#submit').click();
 await expect(page.locator('#result')).toHaveText(expected);
 await expect.poll(()=>page.locator('#result').textContent()).toBe(expected);
 const handle=await page.evaluateHandle(()=>({limit:3,used:2}));
 try{expect(await handle.evaluate(value=>value.limit-value.used)).toBe(1);}
 finally{await handle.dispose();}
});
`)
  ],{expected:'One passing test: the seeded Express decision is rendered, soft and polling assertions agree, and the browser handle is disposed.',
    prerequisites:['This isolated setContent example does not need the practice server or UI fixture ZIP. On Linux with bundled Chromium, set ACADEMY_PW_CHANNEL to chromium for the child command; do not install arbitrary latest binaries.'],
    limitations:['The 25 ms timer is application fixture behavior, not a fixed sleep in the test. Change an expected value deliberately to inspect a real failure; soft assertions must still fail the test. This is not a recipe for conditional error suppression.'],
    docs:[{title:'Playwright assertions',url:'https://playwright.dev/docs/test-assertions'},{title:'Evaluating JavaScript',url:'https://playwright.dev/docs/evaluating'},{title:'JSHandle disposal',url:'https://playwright.dev/docs/api/class-jshandle#js-handle-dispose'}]});

add('pw-observability','Console, screenshot, video and trace evidence','Playwright','Diagnostics',
  'Produce inspectable evidence from an isolated fictional page without logging personal data.',[
    file('workshops/pw-observability/playwright.config.ts',pwConfig('pw-observability',`reporter:[['list'],['html',{outputFolder:process.cwd()+'/playwright-report/pw-observability',open:'never'}]],`,`trace:'on',video:'on',screenshot:'only-on-failure',`)),
    file('workshops/pw-observability/example.spec.ts',`import {test,expect} from '@playwright/test';
test('capture fictional receipt evidence',async({page},info)=>{
 const messages:string[]=[];const pageErrors:string[]=[];
 page.on('console',message=>{if(message.type()==='info')messages.push(message.text());});
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.setContent('<main><h1>Fictional receipt</h1><button id="create">Create receipt</button><output id="result">Ready</output></main>');
 await page.evaluate(()=>{document.querySelector<HTMLButtonElement>('#create')!.onclick=()=>{console.info('DEMO_RECEIPT_7');document.querySelector('#result')!.textContent='Receipt DEMO-7 created';};});
 await page.locator('#create').click();
 await expect(page.locator('#result')).toHaveText('Receipt DEMO-7 created');
 await expect.poll(()=>messages).toContain('DEMO_RECEIPT_7');
 expect(pageErrors,'unexpected uncaught application errors').toEqual([]);
 const screenshot=info.outputPath('fictional-receipt.png');
 await page.screenshot({path:screenshot});
 await info.attach('fictional receipt screenshot',{path:screenshot,contentType:'image/png'});
 await info.attach('fictional diagnostics',{body:Buffer.from(JSON.stringify({messages,pageErrors,project:info.project.name})),contentType:'application/json'});
});
`)
  ],{commands:['npx playwright test --config workshops/pw-observability/playwright.config.ts','npx playwright show-report playwright-report/pw-observability','npx playwright test --config workshops/pw-observability/playwright.config.ts --ui','npx playwright test --config workshops/pw-observability/playwright.config.ts --debug'],
    expected:'One passing test, an attached PNG/diagnostic JSON, video and trace under test-results/pw-observability, and an HTML report under playwright-report/pw-observability.',
    prerequisites:['No practice server is required by the setContent test. Close the HTML report/UI mode with Ctrl+C before another run. To inspect a trace, copy the exact trace.zip path from this test report and run npx playwright show-trace "that exact path".'],
    limitations:['Recording is deliberately enabled only in this fictional workshop config. Existing kit defaults are unchanged. Inspect private artifacts before sharing. The recipe uses ordinary video, not every screencast API. UI mode, --debug and the remote desktop are different interfaces. No errors are globally suppressed.'],
    docs:[{title:'Trace viewer',url:'https://playwright.dev/docs/trace-viewer'},{title:'Screenshots',url:'https://playwright.dev/docs/screenshots'},{title:'Videos',url:'https://playwright.dev/docs/videos'},{title:'UI mode',url:'https://playwright.dev/docs/test-ui-mode'}]});

add('pw-lifecycle','Hooks, case data, tags and retry boundaries','Playwright','Test lifecycle',
  'Run two independent fictional quantity cases with a typed fixture and explicit timeout/retry policy.',[
    file('workshops/pw-lifecycle/playwright.config.ts',pwConfig('pw-lifecycle',`timeout:15000,expect:{timeout:3000},retries:1,reporter:'list',`)),
    file('workshops/pw-lifecycle/example.spec.ts',`import {test as base,expect} from '@playwright/test';
const test=base.extend<{customer:string}>({customer:['FICTIONAL-ADA',{option:true}]});
test.beforeEach(async({page})=>{
 await page.setContent('<main><label>Quantity<input id="quantity" type="number"></label><button id="save">Save</button><output id="result"></output></main>');
 await page.evaluate(()=>{document.querySelector<HTMLButtonElement>('#save')!.onclick=()=>{document.querySelector('#result')!.textContent='Saved quantity '+document.querySelector<HTMLInputElement>('#quantity')!.value;};});
});
test.afterEach(async({},info)=>{
 await info.attach('case outcome',{body:Buffer.from(JSON.stringify({title:info.title,project:info.project.name,retry:info.retry,status:info.status,expectedStatus:info.expectedStatus})),contentType:'application/json'});
});
for(const quantity of [1,3]){
 test('save quantity '+quantity,{tag:'@smoke'},async({page,customer})=>{
  expect(customer).toBe('FICTIONAL-ADA');
  await test.step('submit the explicit case',async()=>{
   await page.getByLabel('Quantity').fill(String(quantity));await page.getByRole('button',{name:'Save',exact:true}).click();
  });
  await expect(page.locator('#result')).toHaveText('Saved quantity '+quantity);
 });
}
`)
  ],{commands:['npx playwright test --config workshops/pw-lifecycle/playwright.config.ts','npx playwright test --config workshops/pw-lifecycle/playwright.config.ts --grep @smoke'],
    expected:'Two independently passing quantity cases with named steps and attached status metadata; workers remain one.',
    prerequisites:['This setContent fixture does not require the practice server. A retry reruns the test with a fresh page; it does not turn a wrong expected value into a valid result.'],
    limitations:['No intended skip or expected-failure is hidden in this passing recipe. Retain and investigate retry evidence instead of accepting flaky outcomes. This is test-scoped fixture coverage, not every worker-fixture scheduling case.'],
    docs:[{title:'Fixtures',url:'https://playwright.dev/docs/test-fixtures'},{title:'Annotations and tags',url:'https://playwright.dev/docs/test-annotations'},{title:'Retries',url:'https://playwright.dev/docs/test-retries'},{title:'Timeouts',url:'https://playwright.dev/docs/test-timeouts'}]});

add('pw-basic-auth','Owned local HTTP Basic authentication','Playwright','Authentication',
  'Verify an unauthenticated denial and a permitted fictional browser visit against a loopback-only server.',[
    file('workshops/pw-basic-auth/playwright.config.ts',`import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'*.spec.ts',workers:1,outputDir:'../../test-results/pw-basic-auth',use:{baseURL:'http://127.0.0.1:4197',channel:process.env.ACADEMY_PW_CHANNEL || 'msedge'},webServer:{command:'node workshops/pw-basic-auth/server.mjs',cwd:process.cwd(),url:'http://127.0.0.1:4197/health',reuseExistingServer:false,timeout:15000}});
`),
    file('workshops/pw-basic-auth/server.mjs',`import http from 'node:http';
const expected='Basic '+Buffer.from('fictional:classroom-only').toString('base64');
const server=http.createServer((req,res)=>{
 if(req.url==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('ready');return;}
 if(req.url!=='/private'){res.writeHead(404);res.end('Not found');return;}
 if(req.headers.authorization!==expected){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Academy fictional demo"','Content-Type':'text/plain'});res.end('Fictional authentication required');return;}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<main><h1>Fictional statement</h1><p>Access permitted for this local test.</p></main>');
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(4197,'127.0.0.1');
const stop=()=>server.close(()=>process.exit());process.on('SIGINT',stop);process.on('SIGTERM',stop);
`),
    file('workshops/pw-basic-auth/example.spec.ts',`import {test,expect} from '@playwright/test';
test('deny anonymous and allow fictional HTTP credentials',async({request,browser})=>{
 const denied=await request.get('/private');expect(denied.status()).toBe(401);
 const context=await browser.newContext({httpCredentials:{username:'fictional',password:'classroom-only'}});
 try{const page=await context.newPage();const response=await page.goto('http://127.0.0.1:4197/private');expect(response?.status()).toBe(200);await expect(page.getByRole('heading',{name:'Fictional statement'})).toBeVisible();}
 finally{await context.close();}
});
`)
  ],{expected:'One passing test: anonymous /private returns 401, the fictional credential context receives 200 and the statement heading.',
    prerequisites:['No public fixture or practice server is required. Playwright owns this loopback server on port 4197. If occupied, stop your own previous workshop or change BOTH server/config/test URLs together; do not kill unrelated services.'],
    limitations:['Credentials are deliberate public fictional constants for this loopback fixture, never a real login. This demonstrates HTTP Basic only, not TLS, client certificates, OAuth, identity-provider security or safe real-world password storage.'],
    docs:[{title:'HTTP authentication',url:'https://playwright.dev/docs/network#http-authentication'},{title:'Web server lifecycle',url:'https://playwright.dev/docs/test-webserver'}]});

add('cy-network-throttle','Throttled fictional response transfer','Cypress','Network',
  'Throttle a known intercepted body and assert both the loading state and completed content without exact timing assertions.',[
    file('workshops/cy-network-throttle/cypress.config.ts',`import {defineConfig} from 'cypress';
export default defineConfig({video:false,e2e:{baseUrl:'http://127.0.0.1:4173',specPattern:'workshops/cy-network-throttle/*.cy.ts',supportFile:false}});
`),
    file('workshops/cy-network-throttle/tsconfig.json',`{"extends":"../../tsconfig.json","compilerOptions":{"types":["cypress"]},"include":["**/*.ts"]}\n`),
    file('workshops/cy-network-throttle/example.cy.ts',`describe('fictional throttled receipt',()=>{
 it('keeps loading until the controlled response completes',()=>{
  const payload={reference:'DEMO-7',padding:'x'.repeat(65536)};
  cy.intercept('GET','**/workshop-throttled',req=>{
   req.on('before:response',res=>{res.setThrottle(128);});
   req.reply({statusCode:200,body:payload,headers:{'content-type':'application/json'}});
  }).as('receipt');
  cy.visit('/ui-components.html');
  cy.window().then(win=>{
   win.document.body.innerHTML='<main><button id="load-receipt">Load fictional receipt</button><output id="receipt-status">Ready</output></main>';
   win.document.querySelector<HTMLButtonElement>('#load-receipt')!.onclick=async()=>{
    const out=win.document.querySelector('#receipt-status')!;out.textContent='Loading';
    try{const response=await win.fetch('/workshop-throttled');if(!response.ok)throw Error('HTTP failure');const body=await response.json();out.textContent='Receipt '+body.reference;}catch{out.textContent='Receipt unavailable';}
   };
  });
  cy.get('#load-receipt').click();cy.get('#receipt-status').should('have.text','Loading');
  cy.wait('@receipt').then(({response})=>{expect(response?.statusCode).to.eq(200);expect(response?.body.reference).to.eq('DEMO-7');});
  cy.get('#receipt-status').should('have.text','Receipt DEMO-7');
 });
});
`)
  ],{commands:['npx cypress run --config-file workshops/cy-network-throttle/cypress.config.ts --browser edge'],
    expected:'One passing Cypress test: Loading is observed, the intercepted 200 response contains DEMO-7, then the receipt is displayed.',
    limitations:['Only a fictional intercepted response is throttled. No strict elapsed-time assertion, load test or real production bandwidth claim is made. The installed browser must already be available; choose bundled Electron only if required by your isolated environment.'],
    docs:[{title:'Response throttling',url:'https://docs.cypress.io/api/commands/intercept#Response-object-properties'},{title:'Awaiting requests',url:'https://docs.cypress.io/api/commands/wait'}]});

add('pw-emulation-matrix','Regional, media and optional installed-browser projects','Playwright','Emulation and browser matrix',
  'Assert configured region, location permission, media preferences and a touch profile while keeping browser execution evidence explicit.',[
    file('workshops/pw-emulation-matrix/playwright.config.ts',`import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'*.spec.ts',workers:1,outputDir:'../../test-results/pw-emulation-matrix',use:{baseURL:'http://127.0.0.1:4173'},projects:[{name:'installed-chromium',use:{browserName:'chromium',channel:process.env.ACADEMY_PW_CHANNEL || 'msedge'}},...(process.env.ACADEMY_EXTRA_BROWSERS==='1'?[{name:'installed-firefox',use:{browserName:'firefox' as const}},{name:'installed-webkit',use:{browserName:'webkit' as const}}]:[])]});
`),
    file('workshops/pw-emulation-matrix/example.spec.ts',`import {test,expect,devices} from '@playwright/test';
test.afterEach(async({browser},info)=>{await info.attach('browser matrix evidence',{body:Buffer.from(JSON.stringify({browserVersion:browser.version(),project:info.project.name,platform:process.platform,status:info.status})),contentType:'application/json'});});
test('regional settings, granted then cleared permission and media',async({browser})=>{
 const context=await browser.newContext({locale:'fr-FR',timezoneId:'Europe/Paris',geolocation:{latitude:48.8566,longitude:2.3522},permissions:['geolocation'],colorScheme:'dark',reducedMotion:'reduce'});
 try{const page=await context.newPage();await page.goto('http://127.0.0.1:4173/ui-components.html');
  expect(await page.evaluate(()=>navigator.language)).toBe('fr-FR');
  expect(await page.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('Europe/Paris');
  expect(await page.evaluate(()=>matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const latitude=await page.evaluate(()=>new Promise<number>((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve(p.coords.latitude),reject)));
  expect(latitude).toBeCloseTo(48.8566);
  await context.clearPermissions();
  expect(await page.evaluate(()=>navigator.permissions.query({name:'geolocation'}).then(p=>p.state))).not.toBe('granted');
  await page.emulateMedia({media:'print'});expect(await page.evaluate(()=>matchMedia('print').matches)).toBe(true);
 }finally{await context.close();}
});
test('touch device profile',{tag:'@device'},async({browser,browserName})=>{
 test.skip(browserName==='firefox','Playwright Firefox does not support isMobile; run the desktop regional case separately.');
 const context=await browser.newContext({...devices['Pixel 5']});
 try{const page=await context.newPage();await page.goto('http://127.0.0.1:4173/ui-components.html');expect(page.viewportSize()?.width).toBe(devices['Pixel 5'].viewport.width);expect(await page.evaluate(()=>navigator.maxTouchPoints)).toBeGreaterThan(0);}
 finally{await context.close();}
});
`)
  ],{commands:['npx playwright test --config workshops/pw-emulation-matrix/playwright.config.ts --project installed-chromium'],
    expected:'Two passing checks in the selected installed Chromium channel. Optional additional projects require separate actual runs and browser-specific evidence; Firefox skips the unsupported mobile context.',
    prerequisites:['Only the default installed Chromium channel runs. To opt into Firefox/WebKit AFTER confirming their pinned binaries already exist, set ACADEMY_EXTRA_BROWSERS=1 in the child shell and select installed-firefox or installed-webkit explicitly. This recipe never installs browsers.'],
    limitations:['Browser emulation is not physical-device, real GPS or OS-permission acceptance. clearPermissions proves grant removal, not an automated denial dialog. Optional projects are an authored matrix, not evidence that every engine passed. Print media assertions do not operate a printer.'],
    docs:[{title:'Emulation',url:'https://playwright.dev/docs/emulation'},{title:'Browser projects',url:'https://playwright.dev/docs/test-projects'},{title:'Permissions',url:'https://playwright.dev/docs/api/class-browsercontext#browser-context-clear-permissions'}]});

export const supplementWorkshops = recipes;
