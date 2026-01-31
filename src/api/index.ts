import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { chatRoutes } from './routes/chat.routes.js';
// import { conversationRoutes } from './routes/conversation.routes.js';
// import { userRoutes } from './routes/user.routes.js';
import { createMiddleware } from 'hono/factory';
import { encode } from 'cbor2';

declare module 'hono' {
	interface ContextRenderer {
		(content: any): Response | Promise<Response>;
	}
}

const cborRenderer = createMiddleware(async (c, next) => {
	c.setRenderer((content) => {
		const encoded = encode(content);
		return new Response(encoded.buffer.slice(0) as ArrayBuffer, {
			headers: { 'Content-Type': 'application/cbor' }
		});
	});
	await next();
});

export function createAPI() {
	const app = new OpenAPIHono();
	app.use(cborRenderer);

	// Health check
	app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

	// API routes
	app.route('/api/chat', chatRoutes);
	// app.route('/api/conversations', conversationRoutes);
	// app.route('/api/users', userRoutes);

	// OpenAPI docs
	app.doc('/openapi.json', {
		openapi: '3.0.0',
		info: {
			version: '1.0.0',
			title: 'Quin AI API',
			description:
				'API for Quin AI assistant - a platform-agnostic conversational AI with memory, internet search, and social media integration'
		},
		servers: [{ url: 'http://localhost:3000', description: 'Development server' }]
	});

	// Swagger UI
	app.get('/docs', swaggerUI({ url: '/openapi.json' }));

	return app;
}
