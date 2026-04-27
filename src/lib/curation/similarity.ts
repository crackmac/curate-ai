export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function rankBySimilarity(
  candidates: { id: number; embedding: Float32Array }[],
  interestVector: Float32Array
): { id: number; similarity: number }[] {
  return candidates
    .map((c) => ({
      id: c.id,
      similarity: cosineSimilarity(c.embedding, interestVector),
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

export function computeInterestVector(
  embeddings: Float32Array[],
  decayFactor = 0.9
): Float32Array {
  if (embeddings.length === 0) return new Float32Array(384);

  const dim = embeddings[0].length;
  const result = new Float32Array(dim);

  let weight = 1;
  let totalWeight = 0;

  for (let i = embeddings.length - 1; i >= 0; i--) {
    for (let d = 0; d < dim; d++) {
      result[d] += embeddings[i][d] * weight;
    }
    totalWeight += weight;
    weight *= decayFactor;
  }

  for (let d = 0; d < dim; d++) {
    result[d] /= totalWeight;
  }

  // L2 normalize
  let norm = 0;
  for (let d = 0; d < dim; d++) norm += result[d] * result[d];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let d = 0; d < dim; d++) result[d] /= norm;
  }

  return result;
}
