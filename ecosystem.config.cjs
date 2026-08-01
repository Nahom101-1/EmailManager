module.exports = {
  apps: [
    {
      name: "lifeos",
      script: ".next/standalone/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
        // Set these in your server environment, not here:
        // APP_PASSWORD, APP_SECRET, CRON_SECRET,
        // ANTHROPIC_API_KEY, LIFEOS_DB_PATH,
        // GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
      },
      max_memory_restart: "512M",
      restart_delay: 3000,
      watch: false,
    },
  ],
}
