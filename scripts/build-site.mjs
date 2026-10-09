import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectories = new Set(['assets/curriculum', 'assets/whimsical', 'assets/windows-kit', 'practice']);
const rootExtensions = new Set(['.html', '.js', '.mjs', '.css', '.json']);
const marker = '.academy-public-build.json';

export function validateDefinition(definition) {
  if (definition.schemaVersion !== 1 || !Array.isArray(definition.files) || !definition.directories) throw new Error('Invalid public asset definition.');
  const names = new Set();
  for (const name of definition.files) {
    const permitted = name === '.nojekyll'
      || (name === path.posix.basename(name) && !name.startsWith('.') && rootExtensions.has(path.extname(name)))
      || ['downloads/mini-quiz-curriculum-v1.docx', 'downloads/mini-quiz-curriculum-v1.pdf'].includes(name);
    if (!permitted || name.includes('\\') || names.has(name.toLowerCase())) throw new Error('Unsafe or duplicate public asset: ' + name);
    names.add(name.toLowerCase());
  }
  for (const [directory, extensions] of Object.entries(definition.directories)) {
    if (!publicDirectories.has(directory) || !Array.isArray(extensions) || !extensions.length
      || extensions.some(extension => !(directory === 'assets/windows-kit' ? ['.png', '.jpg'] : ['.png', '.html', '.css', '.js']).includes(extension))) throw new Error('Unsafe public directory: ' + directory);
  }
  return definition;
}

async function regularPath(root, relative, directory = false) {
  let current = root;
  for (const part of relative.split('/')) {
    if (!part || part === '..' || part.includes('\\') || (part.startsWith('.') && part !== '.nojekyll')) throw new Error('Unsafe path: ' + relative);
    current = path.join(current, part);
    const info = await fs.lstat(current);
    if (info.isSymbolicLink()) throw new Error('Linked public input: ' + relative);
  }
  const info = await fs.lstat(current);
  if (directory ? !info.isDirectory() : !info.isFile()) throw new Error('Not a regular public input: ' + relative);
  return current;
}

export async function collectPublicFiles(root, definition) {
  validateDefinition(definition);
  const files = [...definition.files];
  for (const file of files) await regularPath(root, file);
  for (const [directory, extensions] of Object.entries(definition.directories)) {
    await regularPath(root, directory, true);
    const walk = async relative => {
      for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes: true})) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) throw new Error('Private or linked file in public tree: ' + relative + '/' + entry.name);
        const name = relative + '/' + entry.name;
        if (entry.isDirectory()) { await regularPath(root, name, true); await walk(name); }
        else if (entry.isFile() && extensions.includes(path.extname(entry.name))) files.push(name);
        else throw new Error('Unexpected public file: ' + name);
      }
    };
    await walk(directory);
  }
  if (new Set(files.map(file => file.toLowerCase())).size !== files.length) throw new Error('Duplicate public files.');
  return files.sort();
}

export async function buildSite(root = APP) {
  root = await fs.realpath(root);
  const definition = JSON.parse(await fs.readFile(path.join(root, 'public-assets.json'), 'utf8'));
  const files = await collectPublicFiles(root, definition);
  const output = path.resolve(root, 'dist');
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid export directory.');
  try {
    const info = await fs.lstat(output);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Export must be a real app-local directory.');
    let previous; try { previous = JSON.parse(await fs.readFile(path.join(output, marker), 'utf8')); } catch { throw new Error('Refusing to replace an unrecognized dist directory.'); }
    if (previous.schemaVersion !== 1 || previous.owner !== 'mini-quiz-academy-public-build') throw new Error('Refusing to replace an unrecognized dist directory.');
    await fs.rm(output, {recursive:true});
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(output, {recursive:true});
  const entries = [];
  for (const relative of files) {
    const source = await regularPath(root, relative);
    const bytes = await fs.readFile(source);
    const target = path.join(output, relative);
    await fs.mkdir(path.dirname(target), {recursive:true});
    await fs.writeFile(target, bytes);
    entries.push({path:relative, bytes:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  const result = {schemaVersion:1, owner:'mini-quiz-academy-public-build', files:entries};
  await fs.writeFile(path.join(output, marker), JSON.stringify(result,null,2)+'\n');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await buildSite();
    console.log(JSON.stringify({export:'dist', publicFiles:result.files.length, bytes:result.files.reduce((sum,file)=>sum+file.bytes,0)}));
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
