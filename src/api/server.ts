import { serve } from '@hono/node-server';
import { createAPI } from './index.js';

const port = parseInt(process.env.API_PORT || '9877');
const app = createAPI();

console.log(`🚀 API Server starting on http://localhost:${port}`);
console.log(`📚 API Documentation: http://localhost:${port}/docs`);
console.log(`📄 OpenAPI Spec: http://localhost:${port}/openapi.json`);

serve({
	fetch: app.fetch,
	port
});
