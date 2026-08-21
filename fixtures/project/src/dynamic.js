// A dynamic require that cannot be resolved statically.
export async function load(name) {
  return require(name);
}
