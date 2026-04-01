module.exports = {
  apps: [
    {
      name: "mokushi-backend",
      script: "dist/src/main.js",
      instances: 2,
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
