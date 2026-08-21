// A relative import that resolves to nothing (a real dangling reference).
import { gone } from './does-not-exist.js';
export const x = gone;
