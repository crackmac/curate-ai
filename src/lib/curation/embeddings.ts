import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";

if (process.env.DATABASE_PATH) {
  env.cacheDir = "/data/models";
}

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      dtype: "fp32",
    });
  }
  return extractor;
}

export async function generateEmbedding(text: string): Promise<Float32Array> {
  const ext = await getExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  const nested = output.tolist() as number[][];
  return new Float32Array(nested[0]);
}

export async function generateEmbeddings(
  texts: string[]
): Promise<Float32Array[]> {
  const ext = await getExtractor();
  const results: Float32Array[] = [];

  for (const text of texts) {
    const output = await ext(text, { pooling: "mean", normalize: true });
    const nested = output.tolist() as number[][];
    results.push(new Float32Array(nested[0]));
  }

  return results;
}

export function embeddingToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer);
}

export function bufferToEmbedding(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}
