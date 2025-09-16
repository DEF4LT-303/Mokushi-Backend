import { faker } from '@faker-js/faker';
import { JlptLevel, LessonType, ModuleType, PrismaClient, QuestionType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.userAnswer.deleteMany();
  await prisma.userAttempt.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.question.deleteMany();
  await prisma.module.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleared existing data');

  // Create users
  const users = await createUsers();
  console.log(`👥 Created ${users.length} users`);

  // Create modules
  const modules = await createModules();
  console.log(`📚 Created ${modules.length} modules`);

  // Create questions
  const questions = await createQuestions(modules);
  console.log(`❓ Created ${questions.length} questions`);

  // Create quizzes
  // const quizzes = await createQuizzes(questions, modules);
  // console.log(`📝 Created ${quizzes.length} quizzes`);

  console.log('✅ Database seeding completed successfully!');
}

async function createUsers() {
  const users: any[] = [];

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@mokushi.com',
      password: adminPassword,
      fullName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      provider: 'local',
    },
  });
  users.push(admin);

  // Create regular users
  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName });
    const password = await bcrypt.hash('password123', 10);

    const user = await prisma.user.create({
      data: {
        email,
        password,
        fullName: `${firstName} ${lastName}`,
        firstName,
        lastName,
        role: Role.USER,
        provider: 'local',
        picture: faker.image.avatar(),
      },
    });
    users.push(user);
  }

  return users;
}

async function createModules() {
  const modules: any[] = [];

  // JLPT N5 Modules
  const n5Modules = [
    {
      slug: 'n5-hiragana-reading',
      name: 'Hiragana Reading Practice',
      description: 'Basic hiragana reading exercises for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      type: ModuleType.READING,
    },
    {
      slug: 'n5-katakana-reading',
      name: 'Katakana Reading Practice',
      description: 'Basic katakana reading exercises for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      type: ModuleType.READING,
    },
    {
      slug: 'n5-basic-vocabulary',
      name: 'Basic Vocabulary',
      description: 'Essential vocabulary words for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      type: ModuleType.READING,
    },
    {
      slug: 'n5-listening-basics',
      name: 'Basic Listening Comprehension',
      description: 'Simple listening exercises for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      type: ModuleType.LISTENING,
    },
  ];

  const allModules = [...n5Modules];

  for (const moduleData of allModules) {
    const module = await prisma.module.create({
      data: moduleData,
    });
    modules.push(module);
  }

  return modules;
}

async function createQuestions(modules: any[]) {
  const questions: any[] = [];

  for (const module of modules) {
    const questionCount = faker.number.int({ min: 5, max: 15 });

    for (let i = 0; i < questionCount; i++) {
      const questionData = generateQuestionData(module);

      const question = await prisma.question.create({
        data: {
          ...questionData,
          moduleId: module.id,
        },
      });
      questions.push(question);
    }
  }

  return questions;
}

function generateQuestionData(module: any) {
  const questionTypes = Object.values(QuestionType);
  const lessonTypes = Object.values(LessonType);

  const questionType = faker.helpers.arrayElement(questionTypes);
  const lessonType = faker.helpers.arrayElement(lessonTypes);

  // Generate content based on module type and JLPT level
  const content = generateQuestionContent(module, questionType, lessonType);
  const options = generateQuestionOptions(questionType, content);
  const correctAnswer = faker.helpers.arrayElement(options);
  const explanation = generateExplanation(lessonType);

  return {
    content,
    options,
    correctAnswer,
    explanation,
    type: questionType,
    lessonType,
  };
}

function generateQuestionContent(module: any, questionType: QuestionType, lessonType: LessonType) {
  const isReading = module.type === 'READING';

  if (lessonType === LessonType.Grammar) {
    const patterns = [
      'これは___です。',
      '___は___です。',
      '___に___があります。',
      '___で___をします。',
      '___は___が好きです。',
    ];
    return faker.helpers.arrayElement(patterns);
  } else if (lessonType === LessonType.Vocabulary) {
    const words = ['食べ物', '飲み物', '家族', '学校', '家', '車', '本', '友達'];
    const word = faker.helpers.arrayElement(words);
    return `「${word}」の意味は何ですか？`;
  } else if (lessonType === LessonType.Kanji) {
    const kanji = ['人', '大', '小', '山', '川', '田', '木', '火'];
    const kanjiChar = faker.helpers.arrayElement(kanji);
    return `「${kanjiChar}」の読み方は何ですか？`;
  }

  return faker.lorem.sentence();
}

function generateQuestionOptions(questionType: QuestionType, content: string) {
  if (questionType === QuestionType.TRUE_FALSE) {
    return ['正しい', '間違い'];
  }

  if (questionType === QuestionType.FILL_IN_THE_BLANK) {
    const options = [
      'は', 'が', 'を', 'に', 'で', 'と', 'から', 'まで'
    ];
    return faker.helpers.arrayElements(options, 4);
  }

  // Multiple choice
  const correctOptions = generateCorrectOptions(content);
  const wrongOptions = generateWrongOptions(content);

  const allOptions = [...correctOptions, ...wrongOptions];
  return faker.helpers.shuffle(allOptions).slice(0, 4);
}

function generateCorrectOptions(content: string) {
  if (content.includes('食べ物')) return ['food'];
  if (content.includes('飲み物')) return ['drink'];
  if (content.includes('家族')) return ['family'];
  if (content.includes('学校')) return ['school'];
  if (content.includes('人')) return ['ひと', 'じん'];
  if (content.includes('大')) return ['おお', 'だい'];
  if (content.includes('小')) return ['ちい', 'しょう'];

  return ['正解1', '正解2'];
}

function generateWrongOptions(content: string) {
  const wrongOptions = [
    'wrong1', 'wrong2', 'wrong3', 'wrong4', 'wrong5',
    '間違い1', '間違い2', '間違い3', '間違い4'
  ];
  return faker.helpers.arrayElements(wrongOptions, 3);
}

function generateExplanation(lessonType: LessonType) {
  const explanations = {
    [LessonType.Grammar]: [
      'この文法は基本的な文型です。',
      'この表現は日常会話でよく使われます。',
      'この文法は丁寧語の形です。',
    ],
    [LessonType.Vocabulary]: [
      'この単語は基本的な語彙です。',
      'この言葉は漢字で書くことができます。',
      'この語彙はJLPTでよく出題されます。',
    ],
    [LessonType.Kanji]: [
      'この漢字は音読みと訓読みがあります。',
      'この漢字は部首から成り立っています。',
      'この漢字は複数の読み方があります。',
    ],
  };

  return faker.helpers.arrayElement(explanations[lessonType]);
}

async function createQuizzes(questions: any[], modules: any[]) {
  const quizzes: any[] = [];

  // Get N5 module IDs
  const n5ModuleIds = modules.filter(m => m.jlptLevel === 'N5').map(m => m.id);

  // Create N5 quiz
  const n5Questions = questions.filter(q => n5ModuleIds.includes(q.moduleId));

  if (n5Questions.length > 0) {
    const n5Quiz = await prisma.quiz.create({
      data: {
        title: 'JLPT N5 Practice Quiz',
        jlptLevel: JlptLevel.N5,
      },
    });

    // Add questions to quiz
    const selectedN5Questions = faker.helpers.arrayElements(n5Questions, Math.min(10, n5Questions.length));
    for (let i = 0; i < selectedN5Questions.length; i++) {
      await prisma.quizQuestion.create({
        data: {
          quizId: n5Quiz.id,
          questionId: selectedN5Questions[i].id,
          order: i + 1,
        },
      });
    }
    quizzes.push(n5Quiz);
  }

  return quizzes;
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
