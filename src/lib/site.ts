/**
 * Site-wide constants: this site's URL, its companion sites, the engine, the owner's slide
 * series it links into, and its repository.
 */

/** This site (production). */
export const SITE_URL = "https://agent-context-explained.vercel.app";

/** The companion sites. */
export const DECODER_URL = "https://transformer-decoder-explained.vercel.app";
export const INFERENCE_URL = "https://llm-inference-explained.vercel.app";
export const ARCHITECTURES_URL =
  "https://llm-architectures-explained.vercel.app";
export const KERNELS_URL = "https://gpu-kernels-explained.vercel.app";
export const NUMERICS_URL = "https://numerics-explained.vercel.app";
export const SILICON_URL = "https://systolic-arrays-explained.vercel.app";
export const TRADEOFFS_URL = "https://inference-tradeoffs-explained.vercel.app";
export const HARNESSES_URL = "https://agent-harnesses-explained.vercel.app";
export const PROTOCOLS_URL = "https://agent-protocols-explained.vercel.app";

export const GITHUB_URL =
  "https://github.com/BrendanJamesLynskey/agent-context-explained";
export const ENGINE_URL =
  "https://github.com/BrendanJamesLynskey/Agent_Loop_Sim";

/** The corpus and the two models (run offline once by the engine's build script). */
export const SQUAD_URL = "https://rajpurkar.github.io/SQuAD-explorer/";
export const SQUAD_PAPER = "https://arxiv.org/abs/1606.05250";
export const CC_BY_SA = "https://creativecommons.org/licenses/by-sa/4.0/";
export const EMBEDDER_URL =
  "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2";
export const RERANKER_URL =
  "https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2";

/** The owner's slide series the chapters link into ("go deeper"). */
export const RAG_HUB =
  "https://brendanjameslynskey.github.io/LLM_Hub_RAG_Retrieval/";
export const AGENTS_HUB =
  "https://brendanjameslynskey.github.io/LLM_Hub_Agents/";
export const RAG_03 =
  "https://brendanjameslynskey.github.io/RAG_03_Hybrid_Search_and_Reranking/";
export const RAG_08 =
  "https://brendanjameslynskey.github.io/RAG_08_Two_Step_Retrieval_Architecture/";
export const RAG_09 =
  "https://brendanjameslynskey.github.io/RAG_09_Reranker_Mathematics/";

/** A file in this site's repository on GitHub. */
export function repoFile(path: string): string {
  return `${GITHUB_URL}/blob/main/${path}`;
}
