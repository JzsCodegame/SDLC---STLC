import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/playwright',fullyParallel:false,workers:1,retries:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4174',browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL||undefined,trace:'retain-on-failure',screenshot:'only-on-failure'},
 webServer:{command:'node server/index.js',url:'http://127.0.0.1:4174/api/health',reuseExistingServer:false,env:{PORT:'4174',HOST:'127.0.0.1',LAB_MODE:'true',DATA_DIR:'.test-data/playwright'},timeout:30000}
});
