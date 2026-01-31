import { z } from 'zod';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiDataSchema, secretsSchema } from '../validators/yaml.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type AIData = z.infer<typeof aiDataSchema>;
export type Secrets = z.infer<typeof secretsSchema>;

const loadYaml = <T>(filePath: string, schema: z.ZodSchema<T>): T => {
	const fullPath = path.resolve(__dirname, '../..', filePath);
	const content = fs.readFileSync(fullPath, 'utf8');
	const parsed = yaml.load(content);
	return schema.parse(parsed);
};

console.log('✅ Validated YAML');
export const data: AIData = loadYaml('data.yaml', aiDataSchema);
export const secrets: Secrets = loadYaml('secrets.yaml', secretsSchema);
