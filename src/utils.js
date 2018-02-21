/**
 * Converts a string in constant case to camel case. e.g. HELLO_WORLD => helloWorld. It also ignores characters between $ chars. e.g. $HELLO$_WORLD => HELLOWorld.
 * @param {string} str - The string to convert.
 * @returns {string} - The converted string.
 */
export function constantToCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/_./g, match => match[1].toUpperCase())
    .replace(/\$(.+?)\$/g, (_m, p1) => p1.toUpperCase())
}
