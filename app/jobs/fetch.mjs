import '../bootstrap.mjs';
import Fetcher from '../classes/Fetcher.mjs';

const token = process.argv[2].split('=')[1];
const fetcher = await Fetcher.make(token);

await fetcher.start();

console.log('finished process');

process.exit(0);