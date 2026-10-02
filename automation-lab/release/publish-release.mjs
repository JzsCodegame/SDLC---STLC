import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseOptions, sha256, verifyRelease} from './verify-release.mjs';

// Instructor context only. Jenkins and student ZIPs must never receive this token.
const options = parseOptions(process.argv.slice(2));
const proof = await verifyRelease(options);
const token = process.env.GITHUB_TOKEN;
assert.ok(token, 'Provide an instructor-scoped GITHUB_TOKEN after resolving the existing credential');
const repository = 'JzsCodegame/SDLC---STLC';
const base = `https://api.github.com/repos/${repository}`;
const headers = {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'mini-quiz-local-lab-release'};
async function api(url, method = 'GET', body) {
  const response = await fetch(url, {method, headers: {...headers, ...(body ? {'Content-Type': 'application/json'} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  if (!response.ok) throw new Error(`GitHub ${method} failed with HTTP ${response.status}`);
  return response.json();
}
const existing = await fetch(`${base}/releases/tags/${proof.tag}`, {headers});
let release;
if (existing.status === 404) {
  release = await api(`${base}/releases`, 'POST', {tag_name: proof.tag, target_commitish: proof.sourceCommit, name: `Mini Quiz local lab ${proof.version}`, draft: true, prerelease: false, body: `Windows student package from ${proof.sourceCommit}. Local Linux CI and Windows setup/browser rehearsal passed for the attached checksum. Initial setup requires Node 24, Git, Edge or Chrome, and Internet access. Student work remains on the student's computer.`});
} else {
  assert.equal(existing.status, 200, 'Cannot read existing release');
  release = await existing.json();
  assert.equal(release.target_commitish, proof.sourceCommit, 'Existing tag/release source differs; use a new version');
}
const results = [];
for (const asset of proof.assets) {
  const bytes = await fs.readFile(path.join(options.artifacts, asset.name));
  assert.equal(sha256(bytes), asset.sha256, 'Artifact changed after release verification');
  const matches = release.assets.filter(item => item.name === asset.name);
  assert.ok(matches.length <= 1, 'Duplicate release asset');
  let published = matches[0];
  if (!published) {
    assert.equal(release.draft, true, 'Cannot add files to an already published immutable release');
    const upload = release.upload_url.split('{')[0] + '?name=' + encodeURIComponent(asset.name);
    const response = await fetch(upload, {method: 'POST', headers: {...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length)}, body: bytes});
    assert.ok(response.ok, `Asset upload failed with HTTP ${response.status}`);
    published = await response.json();
  }
  const download = await fetch(published.url, {headers: {...headers, Accept: 'application/octet-stream'}});
  assert.ok(download.ok, `Asset verification failed with HTTP ${download.status}`);
  const received = Buffer.from(await download.arrayBuffer());
  assert.equal(sha256(received), asset.sha256, 'Uploaded asset checksum differs; no promotion');
  assert.equal(received.length, asset.bytes);
  results.push({name: asset.name, url: published.browser_download_url, sha256: asset.sha256, bytes: asset.bytes});
}
if (release.draft) release = await api(`${base}/releases/${release.id}`, 'PATCH', {draft: false});
for (const asset of results) {
  const response = await fetch(asset.url);
  assert.ok(response.ok, `Public asset is not available: HTTP ${response.status}`);
  const received = Buffer.from(await response.arrayBuffer());
  assert.equal(sha256(received), asset.sha256, 'Public asset checksum differs');
}
console.log(JSON.stringify({...proof, releaseUrl: release.html_url, published: true, publicAssetsVerified: true, assets: results, academyDescriptorChanged: false}, null, 2));
