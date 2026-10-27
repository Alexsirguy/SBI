import { fetchSeedImages, IMAGE_CACHE_DIR, loadSeedSet } from "../src";

const count = await fetchSeedImages(loadSeedSet());
console.log(`Verified ${count} seed images in ${IMAGE_CACHE_DIR}`);
