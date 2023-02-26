import '../bootstrap.mjs';
import Fetcher from '../classes/Fetcher.mjs';

const token = process.argv[2].split('=')[1];
const fetcher = new Fetcher(token);

await fetcher.start();

console.log('finished process');

process.exit(0);