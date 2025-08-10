import { PrismaClient } from '@prisma/client';

export class DatabaseManager {
	private prisma: PrismaClient;

	constructor() {
		this.prisma = new PrismaClient({
			log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
		});
	}

	async connect(): Promise<void> {
		try {
			await this.prisma.$connect();
			console.log('🗃️ Database connected successfully');
		} catch (error) {
			console.error('❌ Failed to connect to database:', error);
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		await this.prisma.$disconnect();
		console.log('🗃️ Database disconnected');
	}

	async runTransaction<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
		return this.prisma.$transaction(callback);
	}

	async healthCheck(): Promise<boolean> {
		try {
			await this.prisma.$queryRaw`SELECT 1`;
			return true;
		} catch {
			return false;
		}
	}
}

export const database = new DatabaseManager();
