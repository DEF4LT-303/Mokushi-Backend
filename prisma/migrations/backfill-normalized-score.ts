// prisma/migrations/backfill-normalized-score.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const attempts = await prisma.userAttempt.findMany({
    where: { completed: true, normalizedScore: null },
    include: {
      quiz: {
        include: { questions: { select: { id: true } } },
      },
    },
  });

  for (const attempt of attempts) {
    const totalQuestions = attempt.quiz.questions.length;
    if (!totalQuestions) continue;

    const normalizedScore = parseFloat(
      ((attempt.score / totalQuestions) * 100).toFixed(2),
    );

    await prisma.userAttempt.update({
      where: { id: attempt.id },
      data: { normalizedScore },
    });
  }

  console.log(`Backfilled ${attempts.length} attempts`);
}

main().finally(() => prisma.$disconnect());