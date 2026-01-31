import { z } from 'zod';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { aiDataSchema, secretsSchema } from '../validators/yaml.js';

export type AIData = z.infer<typeof aiDataSchema>;
export type Secrets = z.infer<typeof secretsSchema>;

const loadYaml = <T>(filePath: string, schema: z.ZodSchema<T>): T => {
	const fullPath = path.resolve(filePath);
	const content = fs.readFileSync(fullPath, 'utf8');
	const parsed = yaml.load(content);
	return schema.parse(parsed);
};

console.log('✅ Validated YAML');
export const data: AIData = loadYaml('./data.yaml', aiDataSchema);
export const secrets: Secrets = loadYaml('./secrets.yaml', secretsSchema);
