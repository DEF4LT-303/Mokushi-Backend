import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const configuredOrigins = (
    process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",")
      : [
          process.env.FRONTEND_URL,
          "https://dev.mokushiken.com",
          "https://mokushiken.com",
          "https://www.mokushiken.com",
          "http://localhost:3000",
          "http://localhost:5173",
        ]
  )
    .filter((o): o is string => Boolean(o))
    .map((origin) => origin.trim().replace(/\/+$/, ""));

  if (process.env.FRONTEND_URL) {
    configuredOrigins.push(process.env.FRONTEND_URL.trim().replace(/\/+$/, ""));
  }

  const originsSet = new Set(configuredOrigins);

  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }

      const normalized = requestOrigin.trim().replace(/\/+$/, "");

      // Check explicit set, subdomain matching on mokushiken.com, or localhost
      if (
        originsSet.has(normalized) ||
        /^https?:\/\/([a-zA-Z0-9-]+\.)?mokushiken\.com$/.test(normalized) ||
        /^https?:\/\/localhost(:\d+)?$/.test(normalized)
      ) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
    ],
  });

  app.setGlobalPrefix("api");

  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger config
  const config = new DocumentBuilder()
    .setTitle("Mokushi Endpoints")
    .setDescription("Backend API documentation for Mokushi")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.PORT ?? 8000);

  console.log(`🚀 Server is running...`);

  console.log(`Environment: ${process.env.NODE_ENV ?? "development"}`);
}
bootstrap();
