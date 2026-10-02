import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {readVerifiedRelease} from '../automation-release.mjs';

const root = new URL('../', import.meta.url);
const verified = {schemaVersion:1,release:{status:'verified',version:'1.0.0',sourceCommit:'a'.repeat(40),filename:'mini-quiz-lab-1.0.0-windows.zip',bytes:123,sha256:'b'.repeat(64),downloadUrl:'https://github.com/JzsCodegame/SDLC---STLC/releases/download/local-lab-v1.0.0/mini-quiz-lab-1.0.0-windows.zip',releaseUrl:'https://github.com/JzsCodegame/SDLC---STLC/releases/download/local-lab-v1.0.0/release.json',checksumsUrl:'https://github.com/JzsCodegame/SDLC---STLC/releases/download/local-lab-v1.0.0/SHA256SUMS',prerequisites:{node:'24.x',git:'2.x',browser:'Microsoft Edge or Google Chrome',internetForInitialInstall:true}}};

test('synthetic pending release is fail-closed', () => assert.equal(readVerifiedRelease({schemaVersion:1,release:{status:'pending'}}), null));
test('verified release requires a coherent package descriptor', () => { assert.equal(readVerifiedRelease(verified)?.filename, verified.release.filename); assert.equal(readVerifiedRelease({...verified,schemaVersion:2}), null); assert.equal(readVerifiedRelease({...verified,release:{...verified.release,version:'1.0'}}), null); assert.equal(readVerifiedRelease({...verified,release:{...verified.release,sourceCommit:'A'.repeat(40)}}), null); assert.equal(readVerifiedRelease({...verified,release:{...verified.release,downloadUrl:'https://github.com/JzsCodegame/SDLC---STLC/releases/download/other-tag/mini-quiz-lab-1.0.0-windows.zip'}}), null); });
test('checked-in configuration is either coherent verified metadata or a pending release', async () => { const config = JSON.parse(await fs.readFile(new URL('lab-config.json', root), 'utf8')); assert.equal(config.schemaVersion, 1); assert.ok(config.release?.status === 'pending' || readVerifiedRelease(config)); });
