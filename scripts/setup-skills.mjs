import { cp, lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const canonical = path.join(root, '.agents/skills/add-iot-feature');
const copy = process.argv.includes('--copy');

for (const tool of ['.github', '.claude']) {
  const destination = path.join(root, tool, 'skills/add-iot-feature');
  const target = '../../.agents/skills/add-iot-feature';
  const existing = await lstat(destination).catch(() => undefined);
  await mkdir(path.dirname(destination), { recursive: true });
  if (copy) {
    if (existing?.isSymbolicLink()) await rm(destination);
    else if (existing?.isFile()) {
      // Git on Windows can check out a symlink as a text file containing its target.
      const { readFile } = await import('node:fs/promises');
      if ((await readFile(destination, 'utf8')).trim() !== target) {
        throw new Error(`Refusing to replace an unrelated file at ${destination}.`);
      }
      await rm(destination);
    }
    await cp(canonical, destination, { recursive: true });
    console.log(`${tool}: copied shared skill (rerun after editing canonical skill).`);
  } else if (existing?.isSymbolicLink() && (await readlink(destination)) === target) {
    console.log(`${tool}: shared skill link is correct.`);
  } else if (existing) {
    throw new Error(
      `${destination} already exists. Use --copy to refresh a fallback copy, or inspect it before replacing it with a link.`
    );
  } else {
    try {
      await symlink(target, destination, 'dir');
    } catch {
      throw new Error('Cannot create skill links. Run npm run skills:setup -- --copy instead.');
    }
    console.log(`${tool}: linked shared skill.`);
  }
}
