import fs from 'fs-extra';

await fs.ensureDir('dist');
await fs.copy('src/prompt.txt', 'dist/prompt.txt');
await fs.copy('src/user_context.txt', 'dist/user_context.txt');
