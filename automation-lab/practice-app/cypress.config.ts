import {defineConfig} from 'cypress';
export default defineConfig({video:false,e2e:{baseUrl:'http://127.0.0.1:4175',supportFile:false,specPattern:'cypress/e2e/*.cy.ts'},viewportWidth:1280,viewportHeight:900});
