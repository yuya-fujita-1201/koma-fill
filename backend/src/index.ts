import app from './app';
import { CONFIG, validateConfig } from './config/constants';

async function main() {
  // 環境変数バリデーション
  validateConfig();

  // TODO: DB初期化 (better-sqlite3)
  // await initDatabase();

  // サーバー起動
  app.listen(CONFIG.PORT, () => {
    console.log(`🎨 koma-fill server running on ${CONFIG.BASE_URL}`);
    console.log(`📖 Environment: ${CONFIG.NODE_ENV}`);
    console.log(`🔑 OpenAI API Key: ${CONFIG.OPENAI_API_KEY ? '✓ configured' : '✗ missing'}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
