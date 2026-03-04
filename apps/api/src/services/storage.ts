import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3: S3Client | null = null;
let bucket: string;

function getClient(): S3Client {
	if (!s3) {
		const accountId = process.env.R2_ACCOUNT_ID;
		bucket = process.env.R2_BUCKET_NAME || "";
		if (!accountId || !bucket) {
			throw new Error("R2_ACCOUNT_ID and R2_BUCKET_NAME environment variables are required");
		}
		s3 = new S3Client({
			region: "auto",
			endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
			forcePathStyle: true,
			credentials: {
				accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
			},
		});
	}
	return s3;
}

function audioKey(sessionId: string): string {
	return `audio/${sessionId}.webm`;
}

export async function getUploadUrl(sessionId: string): Promise<string> {
	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: audioKey(sessionId),
		ContentType: "audio/webm",
	});
	return getSignedUrl(getClient(), command, { expiresIn: 1800 }); // 30 minutes
}

export async function getDownloadUrl(sessionId: string): Promise<string> {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: audioKey(sessionId),
	});
	return getSignedUrl(getClient(), command, { expiresIn: 3600 }); // 1 hour
}

export async function downloadAudio(sessionId: string): Promise<Buffer> {
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: audioKey(sessionId),
	});
	const response = await getClient().send(command);
	const stream = response.Body;
	if (!stream) {
		throw new Error(`No audio found for session ${sessionId}`);
	}
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream as AsyncIterable<Uint8Array>) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

export async function uploadAudio(
	sessionId: string,
	data: Buffer,
	contentType: string,
): Promise<void> {
	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: audioKey(sessionId),
		Body: data,
		ContentType: contentType,
	});
	await getClient().send(command);
}

export async function deleteAudio(sessionId: string): Promise<void> {
	const command = new DeleteObjectCommand({
		Bucket: bucket,
		Key: audioKey(sessionId),
	});
	await getClient().send(command);
}

// ─── Chunk-based storage ─────────────────────────────────

function chunkKey(sessionId: string, chunkIndex: number): string {
	return `audio/${sessionId}/chunk-${String(chunkIndex).padStart(3, "0")}.webm`;
}

export async function uploadChunk(
	sessionId: string,
	chunkIndex: number,
	data: Buffer,
	contentType: string,
): Promise<void> {
	const client = getClient();
	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: chunkKey(sessionId, chunkIndex),
		Body: data,
		ContentType: contentType,
	});
	await client.send(command);
}

export async function downloadChunk(sessionId: string, chunkIndex: number): Promise<Buffer> {
	const client = getClient();
	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: chunkKey(sessionId, chunkIndex),
	});
	const response = await client.send(command);
	const stream = response.Body;
	if (!stream) {
		throw new Error(`No audio chunk ${chunkIndex} found for session ${sessionId}`);
	}
	const chunks: Uint8Array[] = [];
	for await (const chunk of stream as AsyncIterable<Uint8Array>) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

export async function deleteSessionChunks(sessionId: string, totalChunks: number): Promise<void> {
	const client = getClient();
	for (let i = 0; i < totalChunks; i++) {
		const command = new DeleteObjectCommand({
			Bucket: bucket,
			Key: chunkKey(sessionId, i),
		});
		await client.send(command);
	}
}
