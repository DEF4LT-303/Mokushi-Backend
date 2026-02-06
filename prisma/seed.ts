import { faker } from '@faker-js/faker';
import { CategoryType, JlptLevel, PrismaClient, QuestionType, Role } from '@prisma/client';
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
  await prisma.rule.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleared existing data');

  // Create users
  const users = await createUsers();
  console.log(`👥 Created ${users.length} users`);

  // Create rules
  const rules = await createRules();
  console.log(`📜 Created ${rules.length} rules`);

  // Create modules
  const modules = await createModules();
  console.log(`📚 Created ${modules.length} modules`);

  // Create questions
  const questions = await createQuestions(modules);
  console.log(`❓ Created ${questions.length} questions`);

  // Quiz configs are created with modules; collect them
  const quizConfigs = modules.flatMap((m: any) => m.quizConfigs ?? []);
  console.log(`⚙️ Found ${quizConfigs.length} quiz configs (created with modules)`);

  // Create quizzes (aggregate + module specific)
  const quizzes = await createQuizzes(questions, modules, quizConfigs);
  console.log(`📝 Created ${quizzes.length} quizzes`);

  // Create some sample user attempts and answers
  const attempts = await createSampleAttempts(users, quizzes);
  console.log(`🧪 Created ${attempts.length} sample user attempts`);

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

async function createRules() {
  const rulesData = [
    {
      name: 'Grammar Rules',
      rules: {
        items: [
          'Use particles correctly (は/が/を/に)',
          'Conjugate verbs according to tense and politeness',
          'Keep proper word order (Subject-Object-Verb)'
        ]
      }
    },
    {
      name: 'Vocabulary Rules',
      rules: {
        items: [
          'Learn words in context rather than isolation',
          'Practice spaced repetition for retention',
          'Use example sentences to understand usage'
        ]
      }
    },
    {
      name: 'Listening Rules',
      rules: {
        items: [
          'Listen actively and repeatedly to short clips',
          'Follow along with transcripts when available',
          'Focus on rhythm, intonation and common phrases'
        ]
      }
    },
  ];

  const created: any[] = [];
  for (const r of rulesData) {
    const rec = await prisma.rule.create({ data: r });
    created.push(rec);
  }

  return created;
}

async function createModules() {
  const modules: any[] = [];

  // JLPT N5 Modules (include required `rules` JSON)
  const n5Modules = [
    {
      slug: 'n5-hiragana-reading',
      name: 'Hiragana Reading Practice',
      description: 'Basic hiragana reading exercises for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      categoryType: CategoryType.VOCABULARY,
      learningObjectives: [
        'Master basic hiragana characters',
        'Read simple hiragana words',
        'Understand hiragana pronunciation'
      ],
      motivationalQuote: 'Every expert was once a beginner. Start your journey with hiragana!',
      instructions: [
        'Read each hiragana character carefully',
        'Practice pronunciation',
        'Complete the exercises'
      ]
    },
    {
      slug: 'n5-katakana-reading',
      name: 'Katakana Reading Practice',
      description: 'Basic katakana reading exercises for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      categoryType: CategoryType.VOCABULARY,
      learningObjectives: [
        'Master basic katakana characters',
        'Read simple katakana words',
        'Understand katakana pronunciation'
      ],
      motivationalQuote: 'Katakana opens the door to foreign words in Japanese!',
      instructions: [
        'Read each katakana character carefully',
        'Practice pronunciation',
        'Complete the exercises'
      ]
    },
    {
      slug: 'n5-basic-vocabulary',
      name: 'Basic Vocabulary',
      description: 'Essential vocabulary words for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      categoryType: CategoryType.VOCABULARY,
      learningObjectives: [
        'Learn essential N5 vocabulary',
        'Understand word meanings',
        'Practice word usage'
      ],
      motivationalQuote: 'Vocabulary is the foundation of language learning!',
      instructions: [
        'Study each vocabulary word',
        'Learn the meaning and usage',
        'Complete practice questions'
      ]
    },
    {
      slug: 'n5-listening-basics',
      name: 'Basic Listening Comprehension',
      description: 'Simple listening exercises for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      categoryType: CategoryType.LISTENING,
      learningObjectives: [
        'Improve listening comprehension',
        'Recognize basic Japanese sounds',
        'Understand simple conversations'
      ],
      motivationalQuote: 'Listening is the key to real communication!',
      instructions: [
        'Listen to the audio carefully',
        'Answer comprehension questions',
        'Review your answers'
      ]
    },
    {
      slug: 'n5-basic-kanji',
      name: 'Basic Kanji Practice',
      description: 'Essential kanji characters for JLPT N5 level',
      jlptLevel: JlptLevel.N5,
      categoryType: CategoryType.VOCABULARY,
      learningObjectives: [
        'Learn basic kanji characters',
        'Understand kanji readings',
        'Practice kanji recognition'
      ],
      motivationalQuote: 'Kanji is the heart of written Japanese!',
      instructions: [
        'Study each kanji character',
        'Learn both on-yomi and kun-yomi readings',
        'Complete practice questions'
      ]
    },
  ];

  const allModules = [...n5Modules];

  for (const moduleData of allModules) {
    const module = await prisma.module.create({
      data: {
        ...moduleData,
        quizConfigs: {
          create: {
            name: `${moduleData.name} Default Config`,
            numQuestions: 10,
            durationSec: 600,
          },
        },
      },
      include: {
        quizConfigs: true,
      },
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

  // Map module categoryType to questionType
  let questionType: QuestionType;
  if (module.categoryType === CategoryType.GRAMMAR) {
    questionType = QuestionType.GRAMMAR;
  } else if (module.categoryType === CategoryType.VOCABULARY) {
    // For kanji modules, always generate KANJI questions
    // For other vocabulary modules, sometimes generate KANJI questions (30% chance)
    if (module.slug.includes('kanji')) {
      questionType = QuestionType.KANJI;
    } else {
      questionType = faker.helpers.arrayElement([
        QuestionType.VOCABULARY,
        QuestionType.VOCABULARY,
        QuestionType.VOCABULARY,
        QuestionType.KANJI, // 25% chance for KANJI
      ]);
    }
  } else {
    // For LISTENING, use VOCABULARY as default
    questionType = faker.helpers.arrayElement([QuestionType.VOCABULARY, QuestionType.GRAMMAR]);
  }

  // Generate content based on module categoryType and questionType
  const content = generateQuestionContent(module, questionType);
  const options = generateQuestionOptions(questionType, content);
  const correctAnswer = faker.helpers.arrayElement(options);
  const explanation = generateExplanation(questionType);

  return {
    content,
    options,
    correctAnswer,
    explanation,
    questionType,
  };
}

function generateQuestionContent(module: any, questionType: QuestionType) {
  if (questionType === QuestionType.GRAMMAR) {
    const patterns = [
      'これは___です。',
      '___は___です。',
      '___に___があります。',
      '___で___をします。',
      '___は___が好きです。',
    ];
    return faker.helpers.arrayElement(patterns);
  } else if (questionType === QuestionType.VOCABULARY) {
    const words = ['食べ物', '飲み物', '家族', '学校', '家', '車', '本', '友達'];
    const word = faker.helpers.arrayElement(words);
    return `「${word}」の意味は何ですか？`;
  } else if (questionType === QuestionType.KANJI) {
    const kanji = ['人', '大', '小', '山', '川', '田', '木', '火'];
    const kanjiChar = faker.helpers.arrayElement(kanji);
    return `「${kanjiChar}」の読み方は何ですか？`;
  }

  return faker.lorem.sentence();
}

function generateQuestionOptions(questionType: QuestionType, content: string) {
  // For grammar questions, provide particle options
  if (questionType === QuestionType.GRAMMAR) {
    const options = [
      'は', 'が', 'を', 'に', 'で', 'と', 'から', 'まで'
    ];
    return faker.helpers.arrayElements(options, 4);
  }

  // For vocabulary and kanji questions, provide multiple choice options
  const correctOptions = generateCorrectOptions(content);
  const wrongOptions = generateWrongOptions(content);

  const allOptions = [...correctOptions, ...wrongOptions];
  return faker.helpers.shuffle(allOptions).slice(0, 4);
}

function generateCorrectOptions(content: string) {
  // Vocabulary word meanings
  if (content.includes('食べ物')) return ['food'];
  if (content.includes('飲み物')) return ['drink'];
  if (content.includes('家族')) return ['family'];
  if (content.includes('学校')) return ['school'];

  // Kanji readings
  if (content.includes('人')) return ['ひと', 'じん'];
  if (content.includes('大')) return ['おお', 'だい'];
  if (content.includes('小')) return ['ちい', 'しょう'];
  if (content.includes('山')) return ['やま', 'さん'];
  if (content.includes('川')) return ['かわ', 'せん'];
  if (content.includes('田')) return ['た', 'でん'];
  if (content.includes('木')) return ['き', 'もく'];
  if (content.includes('火')) return ['ひ', 'か'];

  return ['正解1', '正解2'];
}

function generateWrongOptions(content: string) {
  // If it's a kanji question, provide realistic wrong readings
  if (content.includes('人') || content.includes('大') || content.includes('小') ||
    content.includes('山') || content.includes('川') || content.includes('田') ||
    content.includes('木') || content.includes('火')) {
    const wrongKanjiReadings = [
      'あか', 'あお', 'しろ', 'くろ', 'みどり',
      'みず', 'つち', 'かぜ', 'そら', 'ほし',
      'つき', 'たいよう', 'はな', 'き', 'いえ'
    ];
    return faker.helpers.arrayElements(wrongKanjiReadings, 3);
  }

  // For vocabulary questions, use generic wrong options
  const wrongOptions = [
    'wrong1', 'wrong2', 'wrong3', 'wrong4', 'wrong5',
    '間違い1', '間違い2', '間違い3', '間違い4'
  ];
  return faker.helpers.arrayElements(wrongOptions, 3);
}

function generateExplanation(questionType: QuestionType) {
  const explanations = {
    [QuestionType.GRAMMAR]: [
      'この文法は基本的な文型です。',
      'この表現は日常会話でよく使われます。',
      'この文法は丁寧語の形です。',
    ],
    [QuestionType.VOCABULARY]: [
      'この単語は基本的な語彙です。',
      'この言葉は漢字で書くことができます。',
      'この語彙はJLPTでよく出題されます。',
    ],
    [QuestionType.KANJI]: [
      'この漢字は音読みと訓読みがあります。',
      'この漢字は部首から成り立っています。',
      'この漢字は複数の読み方があります。',
    ],
  };

  return faker.helpers.arrayElement(explanations[questionType]);
}


// Create sample user attempts and user answers for the first quiz
async function createSampleAttempts(users: any[], quizzes: any[]) {
  const attempts: any[] = [];
  if (!quizzes.length) return attempts;

  const quiz = quizzes[0];
  const quizQuestions = await prisma.quizQuestion.findMany({ where: { quizId: quiz.id } });

  // create attempts for a few users
  for (let i = 1; i < Math.min(4, users.length); i++) {
    const user = users[i];
    let correctCount = 0;

    const userAttempt = await prisma.userAttempt.create({
      data: {
        userId: user.id,
        quizId: quiz.id,
        score: 0,
        completed: true,
        startedAt: new Date(),
        submittedAt: new Date(),
      },
    });

    for (const qq of quizQuestions) {
      const question = await prisma.question.findUnique({ where: { id: qq.questionId } });
      const options = (question as any)?.options || [];
      const chosen = faker.helpers.arrayElement(options.length ? options : ['answer1']);
      const correct = chosen === (question as any)?.correctAnswer;
      if (correct) correctCount++;

      await prisma.userAnswer.create({
        data: {
          userAttemptId: userAttempt.id,
          quizQuestionId: qq.id,
          answer: chosen as any,
          correct,
        },
      });
    }

    const pct = Math.round((correctCount / (quizQuestions.length || 1)) * 100);
    await prisma.userAttempt.update({ where: { id: userAttempt.id }, data: { score: pct } });

    attempts.push(userAttempt);
  }

  return attempts;
}

async function createQuizzes(questions: any[], modules: any[], quizConfigs: any[] = []) {
  const quizzes: any[] = [];

  // Get N5 module IDs
  const n5ModuleIds = modules.filter(m => m.jlptLevel === JlptLevel.N5).map(m => m.id);

  // Create N5 aggregated quiz
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

  // Create module-specific quizzes using quiz configs
  for (const qc of quizConfigs) {
    const moduleQuestions = questions.filter(q => q.moduleId === qc.moduleId);
    if (moduleQuestions.length === 0) continue;

    const quiz = await prisma.quiz.create({
      data: {
        title: `${qc.name} - ${faker.word.noun()}`,
        jlptLevel: modules.find(m => m.id === qc.moduleId)?.jlptLevel || JlptLevel.N5,
        moduleId: qc.moduleId,
        quizConfigId: qc.id,
      },
    });

    const selected = faker.helpers.arrayElements(moduleQuestions, Math.min(qc.numQuestions, moduleQuestions.length));
    for (let i = 0; i < selected.length; i++) {
      await prisma.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionId: selected[i].id,
          order: i + 1,
        },
      });
    }

    quizzes.push(quiz);
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
