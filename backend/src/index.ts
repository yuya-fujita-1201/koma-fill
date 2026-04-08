import app from './app';
import { CONFIG, validateConfig } from './config/constants';
import { initDatabase } from './database/connection';

async function main() {
  // 環境変数バリデーション
  validateConfig();

  await initDatabase();
  console.log(`🗄️ Database: ✓ configured (${CONFIG.DATABASE_PATH})`);

  // サーバー起動
  app.listen(CONFIG.PORT, () => {
    console.log(`🎨 koma-fill server running on ${CONFIG.BASE_URL}`);
    console.log(`📖 Environment: ${CONFIG.NODE_ENV}`);
    console.log(`🔑 OpenAI API Key: ${CONFIG.OPENAI_API_KEY ? '✓ configured' : '✗ missing'}`);
    console.log(`🍌 Gemini API Key: ${CONFIG.GEMINI_API_KEY ? '✓ configured' : '✗ missing'}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
