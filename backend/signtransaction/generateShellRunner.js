import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The original upstream implementation composed PNG layers using a native `images`
// dependency. That breaks local dev and deployments where the native module isn't
// installed. For MoltStation testnet/dev, we mint a valid ShellRunner NFT using a
// stable placeholder image (the game already renders from local components).

const components = [
  'frontFeet',
  'hindFeet',
  'heads',
  'tails',
  'innerShells',
  'outerShells',
  'eyes',
];
const total_components = components.length;
const images_per_component = 5;
const total_number_of_breeds = 10;

const PLACEHOLDER_IMAGE_PATH = path.join(
  process.cwd(),
  'public',
  'assets',
  'img',
  'shellrunner.png'
);

export async function generateRandomShellRunner() {
  const breedRandomNumber = Math.floor(
    Math.random() * total_number_of_breeds + 1
  );
  const randomNumbers = [];
  for (let i = 0; i < total_components; i++) {
    const num = Math.floor(Math.random() * images_per_component + 1);
    randomNumbers.push(num.toString());
  }

  const imgdata = await readFile(PLACEHOLDER_IMAGE_PATH);

  return {
    componentIndicesArray: randomNumbers,
    imgdata,
    breed: breedRandomNumber,
  };
}

export async function dummyShellRunner() {
  const randomNumbers = [];
  for (let i = 0; i < total_components; i++) {
    const num = Math.floor(Math.random() * images_per_component + 1);
    randomNumbers.push(num.toString());
  }
  const imgdata = await readFile(PLACEHOLDER_IMAGE_PATH);
  return {
    componentIndicesArray: randomNumbers,
    imgdata,
    breed: 1,
  };
}
