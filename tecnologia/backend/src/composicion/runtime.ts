export function comprobarRuntime(): void {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 24 || minor === undefined || minor < 15) {
    throw new Error('Esta aplicación requiere Node.js 24 LTS >=24.15.');
  }
}
