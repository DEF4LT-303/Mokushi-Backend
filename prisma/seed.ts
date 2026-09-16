import { faker } from '@faker-js/faker';
import { CategoryType, JlptLevel, PrismaClient, QuestionType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// CLI parsing: pass names like `users rules modules` to run specific seeders
const requested = process.argv.slice(2).map(s => s.toLowerCase()); // e.g. ['users','rules']
function shouldRun(name: string) {
  if (!requested.length) return true; // no args -> run all
  return requested.includes(name.toLowerCase()) || requested.includes('all');
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // No global deletion: each seeder will clean up only the rows it owns.
  console.log('🧹 No global deletion. Running targeted cleanup per requested seed(s)');
  // Variables to hold created data (so dependent seeders can run even if some skipped)
  let users: any[] = [];
  let lessons: any[] = [];
  let grammarRules: any[] = [];
  let modules: any[] = [];
  let questions: any[] = [];
  let quizzes: any[] = [];
  let attempts: any[] = [];
  let rapidFireLessons: any[] = [];
  let rapidFireOverallStats: any[] = [];
  let ruleModels: any[] = [];

  // Create users
  if (shouldRun('users')) {
    // Remove previous seed users (keep real users)
    await prisma.user.deleteMany({ where: { email: { contains: 'seed+' } } });
    users = await createUsers();
    console.log(`👥 Created ${users.length} users`);
  }

  // Create lessons and grammar rules
  if (shouldRun('rules')) {
    const modulesToSeed = modules.length ? modules : await prisma.module.findMany({ take: 5, orderBy: { createdAt: 'asc' } });
    const seededContent = await createLessonsAndGrammarRules(modulesToSeed);
    lessons = seededContent.lessons;
    grammarRules = seededContent.grammarRules;
    console.log(`📘 Created ${lessons.length} lessons and ${grammarRules.length} grammar rules`);
  }

  // Create module rule models
  if (shouldRun('rule-models')) {
    const modulesToSeed = modules.length ? modules : await prisma.module.findMany({ take: 5, orderBy: { createdAt: 'asc' } });
    const seededRules = await createRuleModels(modulesToSeed);
    console.log(`📗 Created ${seededRules.length} module rule records`);
  }

  // Create modules
  if (shouldRun('modules')) {
    // Remove previous seed modules by slug (cascades to related questions/quizConfigs/quizzes)
    await prisma.module.deleteMany({ where: { slug: { in: ['n5-hiragana-reading', 'n5-katakana-reading', 'n5-basic-vocabulary', 'n5-listening-basics', 'n5-basic-kanji'] } } });
    modules = await createModules();
    console.log(`📚 Created ${modules.length} modules`);

    const seededContent = await createLessonsAndGrammarRules(modules);
    lessons = seededContent.lessons;
    grammarRules = seededContent.grammarRules;
    console.log(`📘 Created ${lessons.length} lessons and ${grammarRules.length} grammar rules`);
  }

  // Create questions
  if (shouldRun('questions')) {
    // Remove previous seed questions belonging to our module slugs (if modules weren't re-created this run, find existing module ids)
    const seedModuleSlugs = ['n5-hiragana-reading', 'n5-katakana-reading', 'n5-basic-vocabulary', 'n5-listening-basics', 'n5-basic-kanji'];
    const existingModules = await prisma.module.findMany({ where: { slug: { in: seedModuleSlugs } } });
    const moduleIds = existingModules.map(m => m.id);
    if (moduleIds.length) {
      await prisma.question.deleteMany({ where: { moduleId: { in: moduleIds } } });
    }
    questions = await createQuestions(modules);
    console.log(`❓ Created ${questions.length} questions`);
  }

  // Quiz configs are created with modules; collect them
  const quizConfigs = modules.flatMap((m: any) => m.quizConfigs ?? []);
  if (shouldRun('quizzes')) {
    // Remove previous seed quizzes (aggregated and module-specific)
    const seedModuleSlugs = ['n5-hiragana-reading', 'n5-katakana-reading', 'n5-basic-vocabulary', 'n5-listening-basics', 'n5-basic-kanji'];
    const existingModules = await prisma.module.findMany({ where: { slug: { in: seedModuleSlugs } } });
    const moduleIds = existingModules.map(m => m.id);
    await prisma.quiz.deleteMany({ where: { OR: [{ title: 'JLPT N5 Practice Quiz' }, { moduleId: { in: moduleIds } }] } });
    quizzes = await createQuizzes(questions, modules, quizConfigs);
    console.log(`📝 Created ${quizzes.length} quizzes`);
  }

  // Create some sample user attempts and answers
  if (shouldRun('attempts')) {
    // Remove previous seed attempts for quizzes created by seed
    const seedModuleSlugs = ['n5-hiragana-reading', 'n5-katakana-reading', 'n5-basic-vocabulary', 'n5-listening-basics', 'n5-basic-kanji'];
    const existingModules = await prisma.module.findMany({ where: { slug: { in: seedModuleSlugs } } });
    const moduleIds = existingModules.map(m => m.id);
    const seedQuizzes = await prisma.quiz.findMany({ where: { OR: [{ title: 'JLPT N5 Practice Quiz' }, { moduleId: { in: moduleIds } }] } });
    const seedQuizIds = seedQuizzes.map(q => q.id);
    if (seedQuizIds.length) {
      await prisma.userAttempt.deleteMany({ where: { quizId: { in: seedQuizIds } } });
    }
    attempts = await createSampleAttempts(users, quizzes);
    console.log(`🧪 Created ${attempts.length} sample user attempts`);
  }

  if (shouldRun('rapid-fire') || shouldRun('rapidfire')) {
    const seedTitles = ['Rapid Fire N5 Vocabulary', 'Rapid Fire N5 Kanji'];
    // Remove previous seed overall stats (cascades to lesson stats & words)
    await prisma.rapidFireOverallStat.deleteMany({ where: { user: { email: { contains: 'seed+' } } } });

    // Build seed data and create overall stats with nested lesson stats + words
    rapidFireLessons = await createRapidFireLessons();
    if (users.length && rapidFireLessons.length) {
      rapidFireOverallStats = await createRapidFireStats(users, rapidFireLessons);
      console.log(`📊 Created ${rapidFireOverallStats.length} sample rapid-fire stats`);
    }
  }

  console.log('✅ Database seeding completed successfully!');
}

async function createUsers() {
  const users: any[] = [];

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mokushi.com' },
    update: {
      password: adminPassword,
      fullName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      provider: 'local',
    },
    create: {
      email: 'admin@mokushi.com',
      password: adminPassword,
      fullName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
      provider: 'local',
    },
  });
  users.push(admin as any);

  // Create identifiable seed users (emails contain 'seed+' so they can be targeted for cleanup)
  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = `seed+${i}@mokushi.local`;
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

async function createLessonsAndGrammarRules(modules: any[]) {
  const module = modules[0];
  if (!module) {
    return { lessons: [], grammarRules: [] };
  }

  const moduleIds = modules.map((m: any) => m.id);
  await prisma.grammarRule.deleteMany({
    where: { lesson: { moduleId: { in: moduleIds } } },
  });
  await prisma.lesson.deleteMany({ where: { moduleId: { in: moduleIds } } });

  const lessonSeeds = [
    {
      title: 'Lesson 1: は / も',
      lessonNumber: 1,
      grammarRules: [
        {
          japanese: 'は',
          romaji: 'wa',
          englishTitle: 'Topic Marker',
          description: 'Marks the topic (often the subject) of the sentence.',
          structurePattern: '[Topic] は [Predicate]',
          usageNotes: 'Use to mark the topic of the sentence.',
          examples: [
            { japaneseSentence: 'わたしは がくせいです。', englishTranslation: 'As for me, I am a student.' },
            { japaneseSentence: 'これは ほんです。', englishTranslation: 'As for this, it is a book.' },
          ],
        },
        {
          japanese: 'も',
          romaji: 'mo',
          englishTitle: 'Also / Too',
          description: 'Replaces は, が, or を to mean “also.”',
          structurePattern: '[Subject] も [Predicate]',
          usageNotes: 'Use to express that something is also true or also happens.',
          examples: [
            { japaneseSentence: 'わたしも がくせいです。', englishTranslation: 'I am also a student.' },
            { japaneseSentence: 'にほんごも べんきょうします。', englishTranslation: 'I also study Japanese.' },
          ],
        },
      ],
    },
    {
      title: 'Lesson 2: の / Demonstratives',
      lessonNumber: 2,
      grammarRules: [
        {
          japanese: 'の',
          romaji: 'no',
          englishTitle: 'Possession / Description',
          description: 'Indicates possession or describes one noun by another.',
          structurePattern: '[Noun] の [Noun]',
          usageNotes: 'Use to show possession, ownership, or descriptive relationships.',
          examples: [
            { japaneseSentence: 'これは わたしの ほんです。', englishTranslation: 'This is my book.' },
            { japaneseSentence: 'にほんの たべものは おいしいです。', englishTranslation: 'Japanese food is delicious.' },
          ],
        },
        {
          japanese: 'この・その・あの',
          romaji: 'kono / sono / ano',
          englishTitle: 'This / That / That over there + Noun',
          description: 'Points to objects relative to the speaker or listener.',
          structurePattern: 'この／その／あの + Noun',
          usageNotes: 'Use この for near the speaker, その for near the listener, and あの for farther away.',
          examples: [
            { japaneseSentence: 'このほんは わたしのです。', englishTranslation: 'This book is mine.' },
            { japaneseSentence: 'あのくるまは ふるいです。', englishTranslation: 'That car over there is old.' },
          ],
        },
        {
          japanese: 'これ・それ・あれ',
          romaji: 'kore / sore / are',
          englishTitle: 'This / That / That over there',
          description: 'Used alone to refer to objects without a noun.',
          structurePattern: 'これ／それ／あれ + は + Noun です',
          usageNotes: 'Use これ for near the speaker, それ for near the listener, and あれ for farther away.',
          examples: [
            { japaneseSentence: 'これは ペンです。', englishTranslation: 'This is a pen.' },
            { japaneseSentence: 'それは ほんです。', englishTranslation: 'That is a book.' },
          ],
        },
      ],
    },
  ];

  const createdLessons: any[] = [];
  const createdRules: any[] = [];

  for (const lessonSeed of lessonSeeds) {
    const lesson = await prisma.lesson.create({
      data: {
        title: lessonSeed.title,
        lessonNumber: lessonSeed.lessonNumber,
        moduleId: module.id,
      },
    });
    createdLessons.push(lesson);

    for (const ruleSeed of lessonSeed.grammarRules) {
      const rule = await prisma.grammarRule.create({
        data: {
          japanese: ruleSeed.japanese,
          romaji: ruleSeed.romaji,
          englishTitle: ruleSeed.englishTitle,
          description: ruleSeed.description,
          structurePattern: ruleSeed.structurePattern,
          usageNotes: ruleSeed.usageNotes,
          lessonId: lesson.id,
          examples: {
            create: ruleSeed.examples.map((example: any) => ({
              japaneseSentence: example.japaneseSentence,
              englishTranslation: example.englishTranslation,
            })),
          },
        },
      });
      createdRules.push(rule);
    }
  }

  return { lessons: createdLessons, grammarRules: createdRules };
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

async function createRuleModels(modules: any[]) {
  const ruleSeedNames = [
    'N5 Vocabulary Rule Set',
    'N5 Kanji Rule Set',
    'N5 Listening Rule Set',
    'N5 Grammar Pattern Rule',
    'N5 Sentence Structure Rule',
  ];

  await prisma.rule.deleteMany({ where: { name: { in: ruleSeedNames } } });

  const ruleSeeds = [
    {
      name: 'N5 Vocabulary Rule Set',
      rules: [
        'Use core JLPT N5 vocabulary to create vocabulary practice exercises.',
        'Vocabulary category: VOCABULARY',
        'Example words: たべもの, のみもの, いえ, てんき',
      ],
      moduleSlug: 'n5-basic-vocabulary',
    },
    {
      name: 'N5 Kanji Rule Set',
      rules: [
        'Focus on basic N5 kanji reading and meaning rules.',
        'Kanji category: KANJI',
        'Example kanji: 人, 大, 小, 山, 川',
      ],
      moduleSlug: 'n5-basic-kanji',
    },
    {
      name: 'N5 Listening Rule Set',
      rules: [
        'Generate listening prompts and comprehension checks for N5 learners.',
        'Listening category: LISTENING',
        'Audio hints: short dialog, simple question, basic instruction',
      ],
      moduleSlug: 'n5-listening-basics',
    },
    {
      name: 'N5 Grammar Pattern Rule',
      rules: [
        'Create grammar questions using common N5 sentence patterns.',
        'Patterns: は, も, の, これ/それ/あれ',
        'Difficulty: beginner',
      ],
      moduleSlug: 'n5-basic-vocabulary',
    },
    {
      name: 'N5 Sentence Structure Rule',
      rules: [
        'Use simple subject-predicate sentence structures for N5 practice.',
        'Patterns: [Topic] は [Predicate], [Noun] の [Noun]',
      ],
      moduleSlug: 'n5-basic-vocabulary',
    },
  ];

  const createdRules: any[] = [];
  const moduleMap = modules.reduce((map: Record<string, any>, module: any) => {
    map[module.slug] = module;
    return map;
  }, {} as Record<string, any>);

  for (const seed of ruleSeeds) {
    const module = moduleMap[seed.moduleSlug];
    const rule = await prisma.rule.create({
      data: {
        name: seed.name,
        rules: seed.rules,
        ...(module ? { modules: { connect: { id: module.id } } } : {}),
      },
    });
    createdRules.push(rule);
  }

  return createdRules;
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
async function createRapidFireLessons() {
  const rapidFireLessons: any[] = [];

  const lessonSeedData = [
    {
      title: 'Rapid Fire N5 Vocabulary',
      lessonNumber: 1,
      jlptLevel: JlptLevel.N5,
      words: [
        { word: 'たべもの', reading: 'たべもの', romaji: 'tabemono', meaning: 'food' },
        { word: 'のみもの', reading: 'のみもの', romaji: 'nomimono', meaning: 'drink' },
        { word: 'いえ', reading: 'いえ', romaji: 'ie', meaning: 'house' },
        { word: 'ともだち', reading: 'ともだち', romaji: 'tomodachi', meaning: 'friend' },
        { word: 'がっこう', reading: 'がっこう', romaji: 'gakkou', meaning: 'school' },
      ],
    },
    {
      title: 'Rapid Fire N5 Kanji',
      lessonNumber: 2,
      jlptLevel: JlptLevel.N5,
      words: [
        { word: '人', reading: 'ひと', romaji: 'hito', meaning: 'person' },
        { word: '大', reading: 'だい', romaji: 'dai', meaning: 'big' },
        { word: '小', reading: 'しょう', romaji: 'shou', meaning: 'small' },
        { word: '山', reading: 'やま', romaji: 'yama', meaning: 'mountain' },
        { word: '川', reading: 'かわ', romaji: 'kawa', meaning: 'river' },
      ],
    },
  ];

  for (const seed of lessonSeedData) {
    const rapidFireLesson = await prisma.rapidFireLesson.create({
      data: {
        title: seed.title,
        lessonNumber: seed.lessonNumber,
        jlptLevel: seed.jlptLevel,
        words: { create: seed.words },
      },
      include: { words: true },
    });
    rapidFireLessons.push(rapidFireLesson);
  }

  return rapidFireLessons;
}

async function createRapidFireStats(users: any[], rapidFireLessons: any[]) {
  const overallStats: any[] = [];
  if (!users.length || !rapidFireLessons.length) return overallStats;

  const seedUser = users.find((u: any) => u.email?.includes('seed+')) || users[0];
  if (!seedUser) return overallStats;
  // Create one overall stat for the seed user and nested lesson stats that reference the static lessons
  const overallStat = await prisma.rapidFireOverallStat.create({
    data: {
      userId: seedUser.id,
      jlptLevel: rapidFireLessons[0].jlptLevel,
      masteryRate: 80,
      totalHardWords: 2,
      totalLessons: 25,
      totalAnswers: 10,
      totalCorrect: 8,
      lessonStats: {
        create: rapidFireLessons.map((lesson) => ({
          rapidFireLessonId: lesson.id,
          userId: seedUser.id,
          lessonNumber: lesson.lessonNumber,
          totalWords: lesson.words.length,
          masteryRate: 80,
          totalAnswers: 10,
          totalCorrect: 8,
          lastPracticed: new Date(),
        })),
      },
      lessonsPracticed: {
        connect: [{ id: rapidFireLessons[0].id }],
      },
    },
    include: { lessonStats: true },
  });

  overallStats.push(overallStat);
  // create some sample HardWord entries for the seed user (mark first two words of first lesson as hard)
  try {
    const firstLessonWords = rapidFireLessons[0]?.words || [];
    const hardRecords = firstLessonWords.slice(0, 2).map((w: any) => ({ userId: seedUser.id, rapidFireWordId: w.id }));
    if (hardRecords.length) {
      await prisma.hardWord.createMany({ data: hardRecords });
    }
  } catch (err) {
    // ignore if table doesn't exist yet when running older migrations
  }
  return overallStats;
}

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
