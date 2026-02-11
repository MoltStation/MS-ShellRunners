import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const DB_URL = process.env.DB_URL;
if (!DB_URL) {
  console.error('Missing DB_URL in .env');
  process.exit(1);
}

const authSchema = new mongoose.Schema(
  {
    wallet_address: { type: String, required: true },
    img: { data: Buffer, contentType: String },
    username: { type: String, immutable: true, required: true, unique: true },
    nickname: { type: String, required: true },
  },
  { timestamps: true }
);

const shellRunnersSchema = new mongoose.Schema({
  username: { type: String, immutable: true, required: true },
  shellRunners: [
    {
      id: { type: String, required: 'Error: shell runner identifier (uri)' },
      highScore: { type: Number, required: 'Error: shell runner high score' },
    },
  ],
  updatedAt: { type: Date, default: () => Date.now() },
});

const Auth = mongoose.models.auth || mongoose.model('auth', authSchema);
const ShellRunner =
  mongoose.models.shellrunner || mongoose.model('shellrunner', shellRunnersSchema);

const walletAddress =
  process.env.SEED_WALLET_ADDRESS ?? '0x0000000000000000000000000000000000000000';
const username = process.env.SEED_USERNAME ?? 'demo';
const nickname = process.env.SEED_NICKNAME ?? 'demo';
const runnerId = process.env.SEED_SHELLRUNNERS_ID ?? 'ipfs://example';
const runnerScore = Number(process.env.SEED_SHELLRUNNERS_SCORE ?? 10);

const seed = async () => {
  await mongoose.connect(DB_URL);

  await Auth.findOneAndUpdate(
    { wallet_address: walletAddress },
    { wallet_address: walletAddress, username, nickname },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await ShellRunner.findOneAndUpdate(
    { username },
    {
      username,
      shellRunners: [{ id: runnerId, highScore: runnerScore }],
      updatedAt: new Date(),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log('Seed complete');
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});
