module.exports = {
  apps: [
    {
      name: process.env.PM2_NAME || "mokushi-backend",
      script: "dist/src/main.js",
      instances: process.env.NODE_ENV === "production" ? 2 : 1,
      exec_mode: process.env.NODE_ENV === "production" ? "cluster" : "fork",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
      },
    },
  ],
};
