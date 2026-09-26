// Keep the existing command; one Python process decodes both sets with Pillow.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync('python3', [fileURLToPath(new URL('./check-images.py', import.meta.url))], { stdio: 'inherit' });
if (result.error) console.error('Image checks require Python 3 and Pillow: python3 -m pip install Pillow==11.3.0');
process.exit(result.status ?? 1);
